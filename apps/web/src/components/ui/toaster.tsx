'use client';

import { Toaster as Sonner } from 'sonner';

/** Short confirmations ("Student added"), announced to screen readers; bottom centre on phones */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      richColors
      closeButton
      toastOptions={{ className: 'font-sans', duration: 4000 }}
    />
  );
}

export { toast } from 'sonner';
