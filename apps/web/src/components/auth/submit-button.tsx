import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Full-width submit that shows progress and blocks double submits while pending */
export function SubmitButton({
  pending,
  label,
  pendingLabel,
  disabled = false,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  /** Blocks submitting for another reason, e.g. nothing has changed */
  disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
