import { AssistantIntent, AssistantReplyDto } from './dto/whatsapp-assistant.dto.js';

export class WhatsAppAssistantMapper {
  public static toReplyDto(
    to: string,
    text: string,
    intent: AssistantIntent,
    studentId?: string,
  ): AssistantReplyDto {
    return {
      to,
      text,
      intent,
      studentId,
    };
  }
}
