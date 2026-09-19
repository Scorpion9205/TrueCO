import { AssistantIntent } from '../dto/whatsapp-assistant.dto.js';

export class NlpIntentClassifier {
  /**
   * Classifies user message into deterministic academic queries or RAG knowledge queries.
   * Fully supports English, Hindi (transliterated), and Hinglish phrasing.
   */
  public classify(message: string): AssistantIntent {
    const text = message.toLowerCase().trim();

    // 1. Pure Greetings / Help
    if (/^(hi|hello|hey|namaste|pranam|ram ram|help|menu|start|\?)$/i.test(text)) {
      return 'HELP';
    }

    // 2. Institutional Policies, Refunds, Timings, Rules -> RAG Knowledge Base
    // Questions about refund policies, rules, faculty, or syllabus must route to RAG
    // even if they contain words like 'fee' (e.g. 'fee refund policy')
    if (
      /\b(refund|refunds|policy|policies|rules|niyam|teacher|teachers|faculty|sir|maam|madam|admission|dakhila|chutti|holiday|holidays|syllabus|timing|timings)\b/i.test(
        text,
      )
    ) {
      return 'RAG_KNOWLEDGE';
    }

    // 3. Fees & Payments (Deterministic personal student fee record lookup)
    if (
      /\b(fee|fees|dues|balance|pending fee|receipt|payment|installment|paise|baki|rupaye|kist|chalan)\b/i.test(
        text,
      )
    ) {
      return 'FEES';
    }

    // 3. Attendance & Presence (Deterministic)
    if (
      /\b(attendance|present|absent|attendance%|classes attended|haziri|upsthiti|aaya tha|aayi thi)\b/i.test(
        text,
      )
    ) {
      return 'ATTENDANCE';
    }

    // 4. Test Results & Marks (Deterministic)
    if (
      /\b(result|results|marks|score|test score|exam marks|number|kitne number|paper ka result)\b/i.test(
        text,
      )
    ) {
      return 'RESULTS';
    }

    // 5. Homework & Assignments (Deterministic)
    if (
      /\b(homework|hw|assignment|assignments|home work|karyakram|task|aaj ka kaam)\b/i.test(
        text,
      )
    ) {
      return 'HOMEWORK';
    }

    // 6. Notices & Announcements (Deterministic)
    if (
      /\b(notice|notices|announcement|circular|khabar|suchna)\b/i.test(
        text,
      )
    ) {
      return 'NOTICES';
    }

    // 7. General Institutional Inquiries -> RAG Knowledge Base
    // Matches policies, timings, rules, teachers, holidays, syllabus, refunds, admissions
    if (
      /\b(timing|timings|time|schedule|samay|refund|policy|rules|niyam|teacher|faculty|sir|maam|madam|admission|dakhila|chutti|holiday|holidays|syllabus|course|subject|office|contact|address|uniform|dress code)\b/i.test(
        text,
      ) ||
      /\b(kya|kab|kaise|kahan|what|when|how|where|is there|can i|will there)\b/i.test(text)
    ) {
      return 'RAG_KNOWLEDGE';
    }

    // If message is longer than 3 words and doesn't match above, default to RAG search
    if (text.split(/\s+/).length >= 4) {
      return 'RAG_KNOWLEDGE';
    }

    return 'HELP';
  }
}
