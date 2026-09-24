import { describe, expect, it } from 'vitest';
import { safeNextPath } from './redirect';

describe('safeNextPath', () => {
  it('keeps paths on this site', () => {
    expect(safeNextPath('/app/students?batch=1')).toBe('/app/students?batch=1');
  });

  it.each([
    undefined,
    '',
    'https://evil.example',
    '//evil.example/path',
    '/\\evil.example',
    'javascript:alert(1)',
  ])('sends %s to the app home instead', (next) => {
    expect(safeNextPath(next)).toBe('/app');
  });
});
