'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { api } from '@/lib/auth/session';
import { useSession } from '@/lib/auth/use-session';
import {
  type BillingPayment,
  openCheckout,
  type OrderRequest,
  type PaymentOrder,
  useCreateOrder,
  useRefreshBilling,
  useSimulatePayment,
} from '@/lib/billing';
import { formatCurrency } from '@/lib/format';
import { useCoachingProfile } from '@/lib/queries';
import { useApiError } from '@/lib/use-api-error';

const POLL_MS = 2000;
const POLL_TRIES = 30;

/** Waits for the payment webhook to settle an order, as the payment history shows it */
async function waitForSettlement(orderId: string): Promise<boolean> {
  for (let i = 0; i < POLL_TRIES; i += 1) {
    const payments = await api.get<BillingPayment[]>('/billing/payments').catch(() => []);
    if (payments.some((payment) => payment.orderId === orderId && payment.status === 'PAID')) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return false;
}

/**
 * Buying a plan or credits: the API prices the order, Razorpay takes the payment and the API
 * applies it when the webhook arrives. Without Razorpay keys (development) orders are mock
 * ones, which can be marked paid from a dialog instead.
 */
export function usePurchase() {
  const t = useTranslations('Billing.purchase');
  const describeError = useApiError();
  const user = useSession()?.user;
  const profile = useCoachingProfile();
  const createOrder = useCreateOrder();
  const refresh = useRefreshBilling();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [mockOrder, setMockOrder] = useState<{ order: PaymentOrder; label: string } | null>(null);

  const buy = async (request: OrderRequest, label: string, key: string) => {
    setBusy(key);
    try {
      const order = await createOrder.mutateAsync(request);
      if (order.mock) {
        setMockOrder({ order, label });
        return;
      }
      const outcome = await openCheckout(order, {
        name: 'TrueCO',
        description: label,
        email: user?.email,
        contact: profile.data?.phone,
      });
      if (outcome === 'failed') toast.error(t('failed'));
      if (outcome !== 'paid') return;

      setConfirming(true);
      const settled = await waitForSettlement(order.orderId);
      await refresh();
      if (settled) toast.success(t('done', { item: label }));
      else toast.info(t('slow'));
    } catch (error) {
      toast.error(describeError(error));
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  const dialogs = (
    <>
      <Dialog
        open={confirming}
        onOpenChange={() => undefined}
        title={t('confirmingTitle')}
        description={t('confirmingBody')}
        closeLabel={t('close')}
      >
        <div className="flex justify-center py-4">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        </div>
      </Dialog>
      {mockOrder ? (
        <MockPaymentDialog
          order={mockOrder.order}
          label={mockOrder.label}
          onClose={() => setMockOrder(null)}
          onPaid={async () => {
            await refresh();
            toast.success(t('done', { item: mockOrder.label }));
            setMockOrder(null);
          }}
        />
      ) : null}
    </>
  );

  return { buy, busy, dialogs };
}

function MockPaymentDialog({
  order,
  label,
  onClose,
  onPaid,
}: {
  order: PaymentOrder;
  label: string;
  onClose: () => void;
  onPaid: () => Promise<void>;
}) {
  const t = useTranslations('Billing.purchase');
  const describeError = useApiError();
  const simulate = useSimulatePayment();
  const [error, setError] = useState<string | null>(null);
  // Only a development build offers to fake the payment; the API refuses it elsewhere anyway
  const canSimulate = process.env.NODE_ENV !== 'production';

  const pay = async () => {
    setError(null);
    try {
      await simulate.mutateAsync(order.orderId);
      await onPaid();
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('mockTitle')}
      description={`${label} · ${formatCurrency(order.amount)}`}
      closeLabel={t('close')}
    >
      <div className="flex flex-col gap-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Alert tone="warning">{canSimulate ? t('mockDev') : t('mockLive')}</Alert>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
          {canSimulate ? (
            <Button
              onClick={() => void pay()}
              disabled={simulate.isPending}
              aria-busy={simulate.isPending}
            >
              {simulate.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t('simulate')}
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
