/**
 * Recursive Character Text Splitter
 *
 * Chunks documents using a hierarchy of semantic separators:
 * double newlines (paragraphs) -> single newlines -> sentences -> words.
 * Preserves context across chunks using a configurable sliding-window overlap.
 */

export interface TextSplitterOptions {
  readonly chunkSize?: number; // Target chunk size in characters (~4 chars per token)
  readonly chunkOverlap?: number; // Overlap in characters between adjacent chunks
  readonly separators?: string[]; // Priority order of splitting separators
}

export interface TextChunk {
  readonly content: string;
  readonly chunkIndex: number;
  readonly characterCount: number;
  readonly estimatedTokens: number;
}

export class RecursiveCharacterTextSplitter {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;
  private readonly separators: string[];

  public constructor(options: TextSplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 1500; // ~375-400 tokens
    this.chunkOverlap = options.chunkOverlap ?? 300; // ~75-80 tokens overlap
    this.separators = options.separators ?? ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' ', ''];

    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error('chunkOverlap must be strictly smaller than chunkSize');
    }
  }

  public splitText(text: string): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const rawChunks = this.splitRecursive(text.trim(), this.separators);
    const mergedChunks = this.mergeSplitsWithOverlap(rawChunks);

    return mergedChunks.map((content, index) => ({
      content: content.trim(),
      chunkIndex: index,
      characterCount: content.length,
      estimatedTokens: Math.ceil(content.length / 4),
    }));
  }

  private splitRecursive(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];
    let separator = separators[separators.length - 1];
    let newSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const s = separators[i];
      if (s === '') {
        separator = s;
        break;
      }
      if (text.includes(s)) {
        separator = s;
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    const splits = separator !== '' ? text.split(separator) : text.split('');

    for (const s of splits) {
      if (!s.trim()) continue;

      if (s.length <= this.chunkSize) {
        finalChunks.push(s);
      } else {
        if (newSeparators.length === 0) {
          finalChunks.push(s);
        } else {
          const subChunks = this.splitRecursive(s, newSeparators);
          finalChunks.push(...subChunks);
        }
      }
    }

    return finalChunks;
  }

  private mergeSplitsWithOverlap(splits: string[]): string[] {
    const docs: string[] = [];
    let currentDoc: string[] = [];
    let total = 0;

    for (const split of splits) {
      const trimmed = split.trim();
      if (!trimmed) continue;

      const len = trimmed.length;

      if (total + len > this.chunkSize && currentDoc.length > 0) {
        const doc = currentDoc.join(' ').trim();
        if (doc) docs.push(doc);

        // Keep rolling overlap from the tail of currentDoc
        while (total > this.chunkOverlap && currentDoc.length > 0) {
          const removed = currentDoc.shift();
          total -= removed ? removed.length + 1 : 0;
        }
      }

      currentDoc.push(trimmed);
      total += len + 1;
    }

    if (currentDoc.length > 0) {
      const doc = currentDoc.join(' ').trim();
      if (doc) docs.push(doc);
    }

    return docs;
  }
}
