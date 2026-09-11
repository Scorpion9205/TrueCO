import { AiProviderType } from '@trueco/types';
import {
  AiCompletionOptions,
  AiCompletionResult,
  IAiProvider,
} from './ai-provider.interface.js';

export class MockAiProvider implements IAiProvider {
  public readonly providerType: AiProviderType = AiProviderType.OPENAI;
  private readonly defaultModel = 'mock-gpt-4o';

  public async generateCompletion(
    options: AiCompletionOptions,
  ): Promise<AiCompletionResult> {
    const promptLower = options.prompt.toLowerCase();
    let content = '';

    if (
      promptLower.includes('academic progress') ||
      promptLower.includes('student narrative') ||
      promptLower.includes('monthly progress')
    ) {
      content =
        'Overall, the student has demonstrated steady academic engagement this month. Attendance remains consistent with prompt homework submissions. In recent unit evaluations, strong conceptual grasp was observed in core concepts, while additional focus is recommended on advanced numerical problem sets.';
    } else if (
      promptLower.includes('whatsapp') ||
      promptLower.includes('report card') ||
      promptLower.includes('parent report')
    ) {
      content =
        '*TrueCO Academy — Student Performance Report*\n\n' +
        'Dear Parent,\n' +
        'Here is the latest academic snapshot for your child:\n' +
        '• *Attendance*: 92% (Regular & Punctual)\n' +
        '• *Latest Test*: Physics Mechanics - 84/100 (Grade A)\n' +
        '• *Homework Completion*: 100% on schedule\n\n' +
        'Keep encouraging their regular study habits!\n' +
        '_TrueCO Coaching Management_';
    } else if (promptLower.includes('teacher') || promptLower.includes('batch insight')) {
      content =
        'Teacher Batch Performance Insight:\n' +
        'Batch engagement is strong with an overall attendance average above 88%. Test scores demonstrate significant improvement in algebraic topics, with 75% of students scoring above the 70th percentile. Recommendation: Schedule 15 minutes of revision on calculus fundamentals to support borderline students.';
    } else {
      content = `[Mock AI Response for: ${options.prompt.slice(0, 50)}...] Generated content successfully based on prompt.`;
    }

    const promptTokens = Math.max(10, Math.ceil(options.prompt.length / 4));
    const completionTokens = Math.max(15, Math.ceil(content.length / 4));

    return {
      content,
      provider: this.providerType,
      model: options.model || this.defaultModel,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }
}
