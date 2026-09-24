// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', 'apps/web/**', 'apps/mobile/**', '**/*.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/api/src/**/*.ts', 'packages/*/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Unhandled promises crashed the API (Phase 0) and silently dropped work: every promise
      // must be awaited, returned, or explicitly marked with `void`.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { arguments: false } }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // The codebase uses `any` at repository boundaries (Prisma results); tightening it is
      // tracked separately rather than blocking every change.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Architecture rule (.agents/rules/oop-architecture.md): services hold business logic and
    // stay independent of the HTTP framework and the ORM.
    files: ['apps/api/src/modules/**/*.service.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'express', message: 'Services must not depend on Express; keep HTTP in controllers.' },
            { name: '@prisma/client', message: 'Services must not depend on Prisma; use a repository.' },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
);
