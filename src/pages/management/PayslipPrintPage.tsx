import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Payslip } from '@shared/types';
import { PayslipDocument } from '../../components/payslip/PayslipDocument';
import { monthLabel } from '@shared/domain/payroll';

declare global {
  interface Window {
    /**
     * Payslip payload injected by the server before the page loads.
     * Used by the PDF renderer so it does not need to make an authenticated
     * API call (and therefore does not depend on cookie propagation).
     */
    __WF_PAYSLIP__?: Payslip;
  }
}

export function PayslipPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    // Fast path: the PDF renderer injects the already-authorised payslip data.
    const injected = typeof window !== 'undefined' ? window.__WF_PAYSLIP__ : undefined;
    if (injected && injected.id === id) {
      setPayslip(injected);
      return;
    }

    (async () => {
      try {
        const res = await api.state();
        const p = res.state.payslips.find((x: Payslip) => x.id === id);
        if (p) {
          setPayslip(p);
        } else {
          setError('Payslip not found.');
        }
      } catch {
        setError('Failed to load payslip data.');
      }
    })();
  }, [id]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-ink">
        <h1 className="text-xl font-semibold text-bad">Error</h1>
        <p className="mt-2 text-sm text-ink-muted">{error}</p>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex h-8 w-8 rounded-full border-4 border-brand-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="print-page-wrapper bg-white">
      <PayslipDocument
        data={payslip.data}
        version={payslip.version}
        watermark={
          payslip.status === 'Generated'
            ? 'Draft'
            : payslip.status === 'Superseded'
            ? 'Superseded'
            : undefined
        }
      />
    </div>
  );
}
