import { differenceInCalendarDays, format, formatDistanceStrict, parseISO } from 'date-fns';

export function nowIso(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
}

export function todayIsoDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return format(parseISO(iso), 'MMM d, yyyy');
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return format(parseISO(iso), 'MMM d');
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy 'at' h:mm a");
}

export function relativeTime(iso: string): string {
  const reference = new Date();
  const date = parseISO(iso);
  if (Math.abs(reference.getTime() - date.getTime()) < 60_000) return 'just now';
  return formatDistanceStrict(date, reference, { addSuffix: true });
}

export function daysFromToday(isoDate: string): number {
  return differenceInCalendarDays(parseISO(isoDate), new Date());
}
