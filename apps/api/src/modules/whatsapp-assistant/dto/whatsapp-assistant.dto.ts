export type AssistantIntent =
  | 'FEES'
  | 'ATTENDANCE'
  | 'RESULTS'
  | 'HOMEWORK'
  | 'NOTICES'
  | 'HELP'
  | 'UNKNOWN';

export interface InboundWhatsAppMessageDto {
  readonly messageId: string;
  readonly from: string; // e.g. "919876543210"
  readonly body: string;
  readonly timestamp?: number;
}

export interface ConversationContext {
  readonly parentId: string;
  readonly studentIds: string[];
  readonly selectedStudentId?: string;
  readonly awaitingChildSelection: boolean;
  readonly lastInteractionAt: Date;
}

export interface AssistantReplyDto {
  readonly to: string;
  readonly text: string;
  readonly intent: AssistantIntent;
  readonly studentId?: string;
}
