const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtINR(n: number | null | undefined, withSymbol = true): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${withSymbol ? '₹' : ''}${inr.format(n)}`;
}

export function maskAccount(acc: string): string {
  if (!acc) return 'Not provided';
  return `XXXX XXXX ${acc.slice(-4)}`;
}

const ones = [
'', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ones[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
}

export function rupeesInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return 'Rupees Zero Only';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor(n % 10000000 / 100000);
  const thousand = Math.floor(n % 100000 / 1000);
  const rest = n % 1000;
  const parts = [
  crore ? `${twoDigits(crore)} Crore` : '',
  lakh ? `${twoDigits(lakh)} Lakh` : '',
  thousand ? `${twoDigits(thousand)} Thousand` : '',
  rest ? threeDigits(rest) : ''].
  filter(Boolean);
  return `Rupees ${parts.join(' ')} Only`;
}