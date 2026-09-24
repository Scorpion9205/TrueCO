import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import messages from '../../messages/en.json';
import { CLIENT_NAMESPACES, pickClientMessages } from './client-messages';

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('client messages', () => {
  it('includes every namespace a client component translates with', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(SRC)) {
      const code = readFileSync(file, 'utf8');
      if (!/^['"]use client['"]/m.test(code)) continue;
      for (const match of code.matchAll(/useTranslations\(\s*['"]([\w-]+)/g)) used.add(match[1]!);
    }

    expect(used.size).toBeGreaterThan(0);
    expect(
      [...used].filter((ns) => !(CLIENT_NAMESPACES as readonly string[]).includes(ns)),
    ).toEqual([]);
  });

  it('sends only those namespaces to the browser', () => {
    expect(Object.keys(pickClientMessages(messages)).sort()).toEqual([...CLIENT_NAMESPACES].sort());
  });
});
