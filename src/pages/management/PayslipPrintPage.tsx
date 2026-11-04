import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Payslip } from '@shared/types';
import { PayslipDocument } from '../../components/payslip/PayslipDocument';
import { monthLabel } from '@shared/domain/payroll';

/**
 * PayslipPrintPage — a full-page, print-optimized view of a single payslip.
 *
 * Reuses the exact same PayslipDocument component and CSS as the preview.
 * No AppShell chrome — just the payslip document positioned at the top margin
 * of the page, using the full available printable area.
 * Intended to be rendered by Playwright on the server for PDF generation,
 * but also works standalone in a browser for direct printing.
 */
export function PayslipPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
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
