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

export class WhatsAppAssistantService {
  public constructor(
    private readonly repository: IWhatsAppAssistantRepository,
    private readonly eventBus: IEventBus,
  ) {}

  public async processInboundMessage(
    dto: InboundWhatsAppMessageDto,
    correlationId: string = crypto.randomUUID(),
  ): Promise<AssistantReplyDto | null> {
    // 1. Idempotency check
    if (await this.repository.isMessageProcessed(dto.messageId)) {
      return null;
    }
    await this.repository.markMessageProcessed(dto.messageId);

    await this.eventBus.publish(
      createInboundMessageReceivedEvent(
        { messageId: dto.messageId, from: dto.from, body: dto.body },
        correlationId,
      ),
    );

    // 2. Identity resolution
    const parent = await this.repository.resolveParentByPhone(dto.from);
    if (!parent) {
      const reply = WhatsAppAssistantMapper.toReplyDto(
        dto.from,
        'Hello! This mobile number is not registered with our coaching institute. Please contact the front office to register your phone number.',
        'UNKNOWN',
      );
      return reply;
    }

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
    let context = await this.repository.getConversationContext(dto.from);
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
        await this.repository.saveConversationContext(dto.from, context);

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
        await this.repository.saveConversationContext(dto.from, newContext);

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

    let replyText = '';

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

      case 'HELP':
      default: {
        replyText =
          `🤖 TrueCO Student Assistant for ${studentName}\n\n` +
          `You can reply with keywords:\n` +
          `• *fees* - View pending fee balance\n` +
          `• *attendance* - Check class attendance\n` +
          `• *marks* - View latest test score\n` +
          `• *homework* - See current assignments\n` +
          `• *notices* - Latest coaching notices\n` +
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
    const text = message.toLowerCase();

    if (/\b(fee|fees|dues|balance|receipt|payment|installment)\b/.test(text)) {
      return 'FEES';
    }
    if (/\b(attendance|present|absent|attendance%|classes)\b/.test(text)) {
      return 'ATTENDANCE';
    }
    if (/\b(result|results|marks|score|test|exam)\b/.test(text)) {
      return 'RESULTS';
    }
    if (/\b(homework|hw|assignment|assignments)\b/.test(text)) {
      return 'HOMEWORK';
    }
    if (/\b(notice|notices|announcement|holiday|holidays)\b/.test(text)) {
      return 'NOTICES';
    }
    if (/\b(help|menu|start|hi|hello|namaste)\b/.test(text)) {
      return 'HELP';
    }

    return 'HELP';
  }
}
