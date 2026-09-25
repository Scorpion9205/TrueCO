import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// findBy*/waitFor give up after 1s by default. Pages that load in steps (a list, then its
// details) can take longer when the whole suite runs in parallel or on a slow CI machine.
configure({ asyncUtilTimeout: 5000 });
