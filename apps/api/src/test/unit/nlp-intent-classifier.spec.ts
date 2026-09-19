import { describe, it, expect } from 'vitest';
import { NlpIntentClassifier } from '../../modules/whatsapp-assistant/nlp/nlp-intent-classifier.js';

describe('NlpIntentClassifier (Multi-Lingual 2-Tier Intent Classification)', () => {
  const classifier = new NlpIntentClassifier();

  it('should correctly classify Fees queries in English and Hinglish', () => {
    expect(classifier.classify('fees')).toBe('FEES');
    expect(classifier.classify('How much fee is pending?')).toBe('FEES');
    expect(classifier.classify('kitni fees baki hai?')).toBe('FEES');
    expect(classifier.classify('fee receipt download')).toBe('FEES');
    expect(classifier.classify('agli kist kab deni hai')).toBe('FEES');
  });

  it('should correctly classify Attendance queries in English and Hinglish', () => {
    expect(classifier.classify('attendance')).toBe('ATTENDANCE');
    expect(classifier.classify('attendance percentage')).toBe('ATTENDANCE');
    expect(classifier.classify('mera beta aaj aaya tha ya nahi?')).toBe('ATTENDANCE');
    expect(classifier.classify('haziri check karni hai')).toBe('ATTENDANCE');
    expect(classifier.classify('total classes attended')).toBe('ATTENDANCE');
  });

  it('should correctly classify Results and Marks queries', () => {
    expect(classifier.classify('result')).toBe('RESULTS');
    expect(classifier.classify('marks')).toBe('RESULTS');
    expect(classifier.classify('latest test score')).toBe('RESULTS');
    expect(classifier.classify('paper me kitne number aaye?')).toBe('RESULTS');
    expect(classifier.classify('exam results published')).toBe('RESULTS');
  });

  it('should correctly classify Homework queries', () => {
    expect(classifier.classify('homework')).toBe('HOMEWORK');
    expect(classifier.classify('hw')).toBe('HOMEWORK');
    expect(classifier.classify('pending assignments')).toBe('HOMEWORK');
    expect(classifier.classify('aaj ka homework kya mila hai')).toBe('HOMEWORK');
  });

  it('should correctly classify Notices and Announcements', () => {
    expect(classifier.classify('notices')).toBe('NOTICES');
    expect(classifier.classify('latest announcement')).toBe('NOTICES');
    expect(classifier.classify('coaching notice board')).toBe('NOTICES');
  });

  it('should route institutional policy and general inquiries to RAG_KNOWLEDGE', () => {
    expect(classifier.classify('What is your fee refund policy?')).toBe('RAG_KNOWLEDGE');
    expect(classifier.classify('Class 10 Physics batch timings kya hain?')).toBe('RAG_KNOWLEDGE');
    expect(classifier.classify('Diwali ki chutti kab se kab tak hai?')).toBe('RAG_KNOWLEDGE');
    expect(classifier.classify('Who is the Chemistry teacher?')).toBe('RAG_KNOWLEDGE');
    expect(classifier.classify('Can we pay in cash at the office?')).toBe('RAG_KNOWLEDGE');
    expect(classifier.classify('What is the syllabus for next week exam?')).toBe('RAG_KNOWLEDGE');
  });

  it('should return HELP for standard greetings', () => {
    expect(classifier.classify('hi')).toBe('HELP');
    expect(classifier.classify('hello')).toBe('HELP');
    expect(classifier.classify('namaste')).toBe('HELP');
    expect(classifier.classify('help')).toBe('HELP');
    expect(classifier.classify('menu')).toBe('HELP');
  });
});
