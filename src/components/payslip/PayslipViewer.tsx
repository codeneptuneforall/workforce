import { useRef } from 'react';
import { DownloadIcon } from 'lucide-react';
import type { Payslip } from '@shared/types';
import { monthLabel } from '@shared/domain/payroll';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Overlay';
import { PayslipDocument } from './PayslipDocument';

/**
 * Download a payslip PDF generated server-side by Playwright Chromium.
 *
 * Calls the API endpoint which renders the actual payslip preview page through
 * a real browser engine and returns a single-page A4 PDF.
 */
export async function downloadPayslip(payslipId: string, fileName: string) {
  try {
    const res = await fetch(`/api/payslip/download/${payslipId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to download PDF (${res.status})`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[downloadPayslip] PDF download failed:', err);
    throw err;
  }
}

/**
 * Build the mandatory filename: EmployeeName_Month_Year.pdf
 * e.g. Aditya_Rao_August_2026.pdf
 */
export function buildPayslipFileName(employeeName: string, monthKey: string): string {
  const label = monthLabel(monthKey); // e.g. "October 2026"
  const [monthName, year] = label.split(' ');
  const safeName = employeeName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const safeMonth = (monthName ?? '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const safeYear = (year ?? '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  return `${safeName}_${safeMonth}_${safeYear}.pdf`;
}

export function PayslipViewer({ payslip, onClose }: { payslip: Payslip | null; onClose: () => void; }) {
  const handleDownload = async () => {
    if (!payslip) return;
    const fileName = buildPayslipFileName(payslip.data.employee.name, payslip.month);
    await downloadPayslip(payslip.id, fileName);
  };

  return (
    <Modal
      open={!!payslip}
      onClose={onClose}
      size="xl"
      title={payslip ? `Payslip · ${monthLabel(payslip.month)}` : ''}
      description={payslip ? `${payslip.data.employee.name} · Version ${payslip.version}${payslip.status !== 'Released' ? ` · ${payslip.status}` : ''}` : undefined}
      footer={
        <>
          <p className="mr-auto self-center text-xs text-ink-muted">Download generates a single-page A4 PDF via Playwright.</p>
          <Button icon={DownloadIcon} onClick={handleDownload}>Download PDF</Button>
        </>
      }
    >
      {payslip && (
        <div className="-mx-5 -my-4 bg-canvas p-3 sm:p-6">
          <div className="rounded-md border border-line shadow-card">
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
        </div>
      )}
    </Modal>
  );
}
