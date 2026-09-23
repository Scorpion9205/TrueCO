import {
  IWhatsAppAssistantRepository,
  normalizePhone,
  StudentAcademicSnapshot,
} from '../../modules/whatsapp-assistant/whatsapp-assistant.repository.js';
import { ConversationContext } from '../../modules/whatsapp-assistant/dto/whatsapp-assistant.dto.js';

export class InMemoryWhatsAppAssistantRepository implements IWhatsAppAssistantRepository {
  public parents: Map<string, any> = new Map();
  public snapshots: Map<string, StudentAcademicSnapshot> = new Map();
  public notices: any[] = [];
  public claimedMessages = new Set<string>();
  public contexts = new Map<string, ConversationContext>();
  public coachingChoices = new Map<string, string>();

  public async resolveParentsByPhone(phone: string): Promise<any[]> {
    const clean = normalizePhone(phone);
    return [...this.parents.values()].filter((p) => normalizePhone(p.phone) === clean);
  }

  public async getStudentAcademicSnapshot(studentId: string): Promise<StudentAcademicSnapshot | null> {
    return this.snapshots.get(studentId) || null;
  }

  public async getRecentNotices(_coachingId: string, _batchId?: string): Promise<any[]> {
    return this.notices;
  }

  public async saveConversationContext(coachingId: string, phone: string, context: ConversationContext): Promise<void> {
    this.contexts.set(`${coachingId}:${normalizePhone(phone)}`, context);
  }

  public async getConversationContext(coachingId: string, phone: string): Promise<ConversationContext | null> {
    return this.contexts.get(`${coachingId}:${normalizePhone(phone)}`) || null;
  }

  public async saveCoachingChoice(phone: string, coachingId: string): Promise<void> {
    this.coachingChoices.set(normalizePhone(phone), coachingId);
  }

  public async getCoachingChoice(phone: string): Promise<string | null> {
    return this.coachingChoices.get(normalizePhone(phone)) ?? null;
  }

  public async claimMessage(messageId: string): Promise<boolean> {
    if (this.claimedMessages.has(messageId)) return false;
    this.claimedMessages.add(messageId);
    return true;
  }

  public async releaseMessage(messageId: string): Promise<void> {
    this.claimedMessages.delete(messageId);
  }
}
