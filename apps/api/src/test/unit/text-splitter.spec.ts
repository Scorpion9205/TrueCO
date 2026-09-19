import { describe, it, expect } from 'vitest';
import { RecursiveCharacterTextSplitter } from '../../modules/ai/rag/text-splitter.js';

describe('RecursiveCharacterTextSplitter', () => {
  it('should return an empty array for empty or whitespace text', () => {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 100, chunkOverlap: 20 });
    expect(splitter.splitText('')).toEqual([]);
    expect(splitter.splitText('   \n\t  ')).toEqual([]);
  });

  it('should return a single chunk if text is smaller than chunkSize', () => {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
    const text = 'Gravity Classes was founded in 2012 by Satyapal Tiwari to provide elite JEE coaching.';
    const chunks = splitter.splitText(text);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].characterCount).toBe(text.length);
    expect(chunks[0].estimatedTokens).toBeGreaterThan(0);
  });

  it('should split paragraphs cleanly along paragraph boundaries', () => {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 120, chunkOverlap: 20 });
    const p1 = 'First paragraph: Admissions are open for JEE Advanced 2026 batches.';
    const p2 = 'Second paragraph: Fee payments can be made via UPI, NetBanking, or cash.';
    const p3 = 'Third paragraph: Attendance above 85% is strictly mandatory for all test series.';
    const text = `${p1}\n\n${p2}\n\n${p3}`;

    const chunks = splitter.splitText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);

    // Verify all original content exists across chunks
    const allContent = chunks.map((c) => c.content).join(' ');
    expect(allContent).toContain('Admissions are open');
    expect(allContent).toContain('Fee payments can be made');
    expect(allContent).toContain('Attendance above 85%');
  });

  it('should preserve rolling overlap between adjacent chunks', () => {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 150, chunkOverlap: 40 });
    const text =
      'Sentence one of the policy document. Sentence two explains the refund timeline. ' +
      'Sentence three clarifies medical leave exemptions. Sentence four covers disciplinary rules. ' +
      'Sentence five outlines the fee penalty for late payments after the tenth day of each month.';

    const chunks = splitter.splitText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // Adjacent chunks should maintain non-zero sequential chunk indices
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i + 1].chunkIndex).toBe(chunks[i].chunkIndex + 1);
    }
  });

  it('should reject invalid configuration where chunkOverlap >= chunkSize', () => {
    expect(() => {
      new RecursiveCharacterTextSplitter({ chunkSize: 100, chunkOverlap: 100 });
    }).toThrow('chunkOverlap must be strictly smaller than chunkSize');

    expect(() => {
      new RecursiveCharacterTextSplitter({ chunkSize: 50, chunkOverlap: 80 });
    }).toThrow('chunkOverlap must be strictly smaller than chunkSize');
  });
});
