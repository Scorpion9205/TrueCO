export type AssistantIntent =
  | 'FEES'
  | 'ATTENDANCE'
  | 'RESULTS'
  | 'HOMEWORK'
  | 'NOTICES'
  | 'RAG_KNOWLEDGE'
  | 'HELP'
  | 'OPT_OUT'
  | 'OPT_IN'
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
  /**
   * Set on replies given before a coaching is known (STOP, an unknown number, choosing an
   * institute): the inbound worker sends these itself instead of the notification pipeline.
   */
  readonly sendDirectly?: boolean;
}
