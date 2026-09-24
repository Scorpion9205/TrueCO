'use client';

import { useSyncExternalStore } from 'react';
import { getSession, subscribe } from './session';

/** The current session (null when signed out), re-rendering when it changes */
export function useSession() {
  return useSyncExternalStore(subscribe, getSession, () => null);
}
