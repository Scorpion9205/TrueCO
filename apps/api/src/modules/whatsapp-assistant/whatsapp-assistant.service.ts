import { IWhatsAppAssistantRepository } from './whatsapp-assistant.repository.js';
import { IEventBus } from '../../events/event-bus.interface.js';
import {
  AssistantIntent,
  AssistantReplyDto,
  ConversationContext,
  InboundWhatsAppMessageDto,
} from './dto/whatsapp-assistant.dto.js';
import { WhatsAppAssistantMapper } from './whatsapp-assistant.mapper.js';
import {
  createAssistantRepliedEvent,
  createInboundMessageReceivedEvent,
} from './whatsapp-assistant.events.js';
import { NlpIntentClassifier } from './nlp/nlp-intent-classifier.js';
import { KnowledgeBaseService } from '../ai/rag/knowledge-base.service.js';
import { AiService } from '../ai/ai.service.js';
import { buildWhatsAppRagSystemPrompt } from './prompts/whatsapp-rag-system.prompt.js';
import { logger } from '../../common/logger/logger.service.js';
import { RequestContextService } from '../../common/services/request-context.service.js';

export class WhatsAppAssistantService {
  private readonly intentClassifier: NlpIntentClassifier;

  public constructor(
    private readonly repository: IWhatsAppAssistantRepository,
    private readonly eventBus: IEventBus,
    private readonly knowledgeBaseService?: KnowledgeBaseService,
    private readonly aiService?: AiService,
    intentClassifier?: NlpIntentClassifier,
  ) {
    this.intentClassifier = intentClassifier || new NlpIntentClassifier();
  }

  public async processInboundMessage(
    dto: InboundWhatsAppMessageDto,
    correlationId: string = crypto.randomUUID(),
  ): Promise<AssistantReplyDto | null> {
    // 1. Idempotency: Meta redelivers webhooks, and the claim is shared by every worker
    if (!(await this.repository.claimMessage(dto.messageId))) {
      return null;
    }
    try {
      return await this.handleClaimedMessage(dto, correlationId);
    } catch (err) {
      // Let the queue's retry process the message instead of treating it as a duplicate
      await this.repository.releaseMessage(dto.messageId);
      throw err;
    }
  }

  private async handleClaimedMessage(
    dto: InboundWhatsAppMessageDto,
    correlationId: string,
  ): Promise<AssistantReplyDto | null> {
    await this.eventBus.publish(
      createInboundMessageReceivedEvent(
        { messageId: dto.messageId, from: dto.from, body: dto.body },
        correlationId,
      ),
    );

    // 2. Identity resolution: exact phone match, possibly at several coachings
    const parents = await this.repository.resolveParentsByPhone(dto.from);
    if (parents.length === 0) {
      return WhatsAppAssistantMapper.toReplyDto(
        dto.from,
        'Hello! This mobile number is not registered with our coaching institute. Please contact the front office to register your phone number.',
        'UNKNOWN',
      );
    }

    const chosen = await this.chooseCoaching(dto, parents);
    if ('reply' in chosen) return chosen.reply;

    // Everything after identification acts on behalf of the parent's coaching only
    const parent = chosen.parent;
    return RequestContextService.runForTenant(parent.coachingId, () =>
      this.replyForParent(dto, parent, correlationId),
    );
  }

  /**
   * One Vargly number serves every institute. A parent registered at more than one is asked
   * which to talk to, and the choice is remembered for later messages.
   */
  private async chooseCoaching(
    dto: InboundWhatsAppMessageDto,
    parents: any[],
  ): Promise<{ parent: any } | { reply: AssistantReplyDto }> {
    if (parents.length === 1) return { parent: parents[0] };

    const options = [...parents].sort((a, b) =>
      String(a.coaching?.name ?? '').localeCompare(String(b.coaching?.name ?? '')),
    );
    const remembered = await this.repository.getCoachingChoice(dto.from);
    const rememberedParent = options.find((p) => p.coachingId === remembered);
    if (rememberedParent) return { parent: rememberedParent };

    const picked = Number.parseInt(dto.body.trim(), 10);
    if (Number.isInteger(picked) && picked >= 1 && picked <= options.length) {
      const parent = options[picked - 1];
      await this.repository.saveCoachingChoice(dto.from, parent.coachingId);
      return {
        reply: WhatsAppAssistantMapper.toReplyDto(
          dto.from,
          `You are now connected to ${parent.coaching?.name ?? 'your coaching'}. How can I help? You can ask for fees, attendance, results, or homework.`,
          'HELP',
        ),
      };
    }

    const list = options.map((p, n) => `${n + 1}. ${p.coaching?.name ?? 'Coaching'}`).join('\n');
    return {
      reply: WhatsAppAssistantMapper.toReplyDto(
        dto.from,
        `Your number is registered with more than one institute. Reply with a number to choose:\n${list}`,
        'HELP',
      ),
    };
  }

  private async replyForParent(
    dto: InboundWhatsAppMessageDto,
    parent: any,
    correlationId: string,
  ): Promise<AssistantReplyDto | null> {
    const coachingId = parent.coachingId;
    const studentParents = parent.studentParents || [];
    const students = studentParents.map((sp: any) => sp.student).filter(Boolean);

    if (students.length === 0) {
      return WhatsAppAssistantMapper.toReplyDto(
        dto.from,
        'Hello! No active student records were found linked to your profile. Please contact the front office.',
        'UNKNOWN',
      );
    }

    // 3. Conversation Context & Multi-child disambiguation
    let context = await this.repository.getConversationContext(coachingId, dto.from);
    const bodyTrimmed = dto.body.trim();

    // Check if replying to child selection
    if (context?.awaitingChildSelection) {
      const selectedIndex = parseInt(bodyTrimmed, 10) - 1;
      if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < context.studentIds.length) {
        const selectedId = context.studentIds[selectedIndex];
        const selectedStudent = students.find((s: any) => s.id === selectedId);

        context = {
          ...context,
          selectedStudentId: selectedId,
          awaitingChildSelection: false,
          lastInteractionAt: new Date(),
        };
        await this.repository.saveConversationContext(coachingId, dto.from, context);

        const reply = WhatsAppAssistantMapper.toReplyDto(
          dto.from,
          `Selected student: ${selectedStudent?.firstName} ${selectedStudent?.lastName}.\nHow can I help you today? You can ask for fees, attendance, results, or homework.`,
          'HELP',
          selectedId,
        );
        return reply;
      }
    }

    // Determine targeted student
    let activeStudentId: string | undefined = context?.selectedStudentId;

    if (!activeStudentId) {
      if (students.length === 1) {
        activeStudentId = students[0].id;
      } else {
        // Multi-child ambiguity: prompt parent
        const childList = students
          .map((s: any, idx: number) => `${idx + 1}. ${s.firstName} ${s.lastName}`)
          .join('\n');

        const newContext: ConversationContext = {
          parentId: parent.id,
          studentIds: students.map((s: any) => s.id),
          awaitingChildSelection: true,
          lastInteractionAt: new Date(),
        };
        await this.repository.saveConversationContext(coachingId, dto.from, newContext);

        return WhatsAppAssistantMapper.toReplyDto(
          dto.from,
          `Dear Parent, you have multiple students registered with us:\n${childList}\n\nPlease reply with the number (e.g. 1 or 2) to choose the student.`,
          'HELP',
        );
      }
    }

    if (!activeStudentId) {
      return null;
    }

    // 4. Intent Classification
    const intent = this.classifyIntent(dto.body);
    const academicData = await this.repository.getStudentAcademicSnapshot(activeStudentId);
    const studentName = academicData?.student
      ? `${academicData.student.firstName} ${academicData.student.lastName}`.trim()
      : 'Student';

    let replyText: string;

    switch (intent) {
      case 'FEES': {
        const pending = academicData?.feeSummary.totalPending || 0;
        if (pending > 0) {
          const dueDateStr = academicData?.feeSummary.upcomingDueDate
            ? `Due Date: ${new Date(academicData.feeSummary.upcomingDueDate).toLocaleDateString('en-IN')}`
            : '';
          replyText = `💳 Fee Details for ${studentName}:\nPending Balance: ₹${pending}\n${dueDateStr}\n\nPlease pay at your earliest convenience. Thank you!`;
        } else {
          replyText = `✅ All fees for ${studentName} are fully paid. Thank you!`;
        }
        break;
      }

      case 'ATTENDANCE': {
        const att = academicData?.attendanceSummary;
        replyText = `📊 Attendance Summary for ${studentName}:\nOverall: ${att?.percentage ?? 100}%\nClasses Attended: ${att?.attendedClasses ?? 0} of ${att?.totalClasses ?? 0}\nBatch: ${academicData?.batch?.name || 'Assigned Batch'}`;
        break;
      }

      case 'RESULTS': {
        const res = academicData?.recentTestResult;
        if (res) {
          replyText = `📝 Recent Test Result for ${studentName}:\nTest: ${res.testTitle}\nMarks: ${res.marksObtained}/${res.totalMarks} (${res.percentage}%)\nWell done!`;
        } else {
          replyText = `ℹ️ No test results have been published yet for ${studentName}.`;
        }
        break;
      }

      case 'HOMEWORK': {
        const hwList = academicData?.pendingHomework || [];
        if (hwList.length > 0) {
          const formatted = hwList
            .map(
              (h: any, i: number) =>
                `${i + 1}. ${h.title} (Due: ${new Date(h.dueDate).toLocaleDateString('en-IN')})`,
            )
            .join('\n');
          replyText = `📚 Pending Homework for ${studentName}:\n${formatted}`;
        } else {
          replyText = `🎉 No pending homework for ${studentName}!`;
        }
        break;
      }

      case 'NOTICES': {
        const notices = await this.repository.getRecentNotices(
          coachingId,
          academicData?.batch?.id,
        );
        if (notices.length > 0) {
          const formatted = notices
            .map((n: any, i: number) => `${i + 1}. *${n.title}*: ${n.content}`)
            .join('\n\n');
          replyText = `📢 Recent Notices:\n\n${formatted}`;
        } else {
          replyText = `ℹ️ There are no active announcements at this time.`;
        }
        break;
      }

      case 'RAG_KNOWLEDGE': {
        if (this.knowledgeBaseService) {
          try {
            // The relevance floor suits the embedding model in use (see KnowledgeBaseService)
            const chunks = await this.knowledgeBaseService.searchKnowledge(dto.body, coachingId, 3);
            if (chunks.length > 0 && this.aiService) {
              const contextTexts = chunks.map((c) => c.content);
              const systemPrompt = buildWhatsAppRagSystemPrompt(
                parent.coaching?.name ?? 'your coaching institute',
                contextTexts,
              );
              const aiCompletion = await this.aiService.generateCompletion(
                {
                  prompt: dto.body,
                  systemPrompt,
                  maxTokens: 250,
                  feature: 'whatsapp.rag_assistant',
                },
                coachingId,
              );
              replyText = aiCompletion.content.trim();
            } else {
              replyText =
                'ℹ️ Mujhe is baare me poori jankari nahi mil pa rahi hai. Kripya hamare coaching office se sampark karein.';
            }
          } catch (err) {
            logger.error('[WhatsAppAssistantService] Error in RAG processing:', err);
            replyText =
              'ℹ️ Hum aapka prashna samajh gaye hain, kintu abhi jankari prapt karne me asuvidha ho rahi hai. Kripya front office se sampark karein.';
          }
        } else {
          replyText = 'ℹ️ Kripya hamare coaching office se sampark karein.';
        }
        break;
      }

      case 'HELP':
      default: {
        replyText =
          `🤖 Vargly Student Assistant for ${studentName}\n\n` +
          `You can reply with keywords:\n` +
          `• *fees* - View pending fee balance\n` +
          `• *attendance* - Check class attendance\n` +
          `• *marks* - View latest test score\n` +
          `• *homework* - See current assignments\n` +
          `• *notices* - Latest coaching notices\n` +
          `• Or ask any questions about batch timings, syllabus, or rules!\n` +
          `• *help* - Show this menu`;
        break;
      }
    }

    const replyDto = WhatsAppAssistantMapper.toReplyDto(
      dto.from,
      replyText,
      intent,
      activeStudentId,
    );

    await this.eventBus.publish(
      createAssistantRepliedEvent(
        {
          to: dto.from,
          intent,
          studentId: activeStudentId,
          replyText,
        },
        coachingId,
        correlationId,
      ),
    );

    return replyDto;
  }

  public classifyIntent(message: string): AssistantIntent {
    return this.intentClassifier.classify(message);
  }
}
