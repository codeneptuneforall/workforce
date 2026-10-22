import { DownloadIcon, PrinterIcon } from 'lucide-react';
import type { Payslip } from '@shared/types';
import { monthLabel } from '@shared/domain/payroll';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Overlay';
import { PayslipDocument } from './PayslipDocument';

export function printPayslip() {
  window.print();
}

export function PayslipViewer({ payslip, onClose }: {payslip: Payslip | null;onClose: () => void;}) {
  return (
    <Modal
      open={!!payslip}
      onClose={onClose}
      size="xl"
      title={payslip ? `Payslip · ${monthLabel(payslip.month)}` : ''}
      description={payslip ? `${payslip.data.employee.name} · Version ${payslip.version}${payslip.status !== 'Released' ? ` · ${payslip.status}` : ''}` : undefined}
      footer={
      <>
          <p className="mr-auto self-center text-xs text-ink-muted">Download opens your browser’s print dialog — choose “Save as PDF”. A4 layout.</p>
          <Button variant="secondary" icon={PrinterIcon} onClick={printPayslip}>Print</Button>
          <Button icon={DownloadIcon} onClick={printPayslip}>Download PDF</Button>
        </>
      }>
      
      {payslip &&
      <div className="-mx-5 -my-4 bg-canvas p-3 sm:p-6">
          <div className="rounded-md border border-line shadow-card">
            <PayslipDocument data={payslip.data} version={payslip.version} watermark={payslip.status === 'Generated' ? 'Draft' : payslip.status === 'Superseded' ? 'Superseded' : undefined} />
          </div>
        </div>
      }
    </Modal>);

}