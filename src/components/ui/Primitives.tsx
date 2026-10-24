import type * as React from 'react';
import { Link } from "react-router-dom";
import { AlertTriangleIcon, ArrowLeftIcon, CheckCircle2Icon, InfoIcon, XCircleIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tone } from "@shared/types";
import { cn } from "../../utils/cn";
export function PageHeader({
  title,
  description,
  actions,
  back








}: {title: string;description?: React.ReactNode;actions?: React.ReactNode;back?: {to: string;label: string;};}) {
  return <div className="mb-6">
      {back && <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeftIcon className="h-4 w-4" /> {back.label}
        </Link>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>;
}
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush








}: {title?: React.ReactNode;description?: React.ReactNode;actions?: React.ReactNode;children: React.ReactNode;className?: string;bodyClassName?: string;flush?: boolean;}) {
  return <section className={cn('rounded-xl border border-line bg-white shadow-card', className)}>
      {(title || actions) && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>}
      <div className={cn(!flush && 'p-5', bodyClassName)}>{children}</div>
    </section>;
}
const bannerTones: Record<Tone, {
  box: string;
  icon: LucideIcon;
}> = {
  ok: {
    box: 'border-ok-line bg-ok-bg text-ok',
    icon: CheckCircle2Icon
  },
  warn: {
    box: 'border-warn-line bg-warn-bg text-warn',
    icon: AlertTriangleIcon
  },
  bad: {
    box: 'border-bad-line bg-bad-bg text-bad',
    icon: XCircleIcon
  },
  info: {
    box: 'border-info-line bg-info-bg text-info',
    icon: InfoIcon
  },
  brand: {
    box: 'border-brand-200 bg-brand-50 text-brand-800',
    icon: InfoIcon
  },
  neutral: {
    box: 'border-line bg-canvas text-ink-2',
    icon: InfoIcon
  }
};
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  className






}: {tone?: Tone;title?: React.ReactNode;children?: React.ReactNode;action?: React.ReactNode;className?: string;}) {
  const t = bannerTones[tone];
  const Icon = t.icon;
  return <div role={tone === 'bad' ? 'alert' : 'status'} className={cn('flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-start', t.box, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn('text-ink-2', title ? 'mt-0.5' : undefined)}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>;
}
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className






}: {icon: LucideIcon;title: string;body?: string;action?: React.ReactNode;className?: string;}) {
  return <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-ink-muted">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>;
}
export function ProgressBar({
  value,
  tone = 'brand',
  className,
  label





}: {value: number;tone?: 'brand' | 'ok' | 'warn' | 'bad';className?: string;label?: string;}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = {
    brand: 'bg-brand-600',
    ok: 'bg-ok',
    warn: 'bg-warn',
    bad: 'bg-bad'
  }[tone];
  return <div className={cn('h-2 w-full overflow-hidden rounded-full bg-line', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-300 ease-out', fill)} style={{
      width: `${pct}%`
    }} />
    </div>;
}
export function Avatar({
  name,
  size = 'md',
  src,
  className

}: {name: string;size?: 'sm' | 'md' | 'lg';src?: string | null;className?: string;}) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const s = {
    sm: 'h-7 w-7 text-[11px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-14 w-14 text-base'
  }[size];
  if (src && src.trim()) {
    return <img src={src} alt={name} className={cn('inline-flex shrink-0 items-center justify-center rounded-full object-cover bg-brand-100', s, className)} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
  }
  return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800', s, className)} aria-hidden>{initials}</span>;
}
export function Skeleton({
  className


}: {className?: string;}) {
  return <div className={cn('animate-pulse rounded-md bg-line', className)} />;
}
export function KeyValue({
  label,
  value,
  className




}: {label: string;value: React.ReactNode;className?: string;}) {
  return <div className={className}>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{value}</dd>
    </div>;
}
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label








}: {value: T;onChange: (v: T) => void;options: {value: T;label: string;}[];label: string;}) {
  return <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-canvas p-0.5">
      {options.map((o) => <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={cn('h-8 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors duration-150', value === o.value ? 'bg-white text-ink shadow-card' : 'text-ink-muted hover:text-ink')}>
          {o.label}
        </button>)}
    </div>;
}
export function Tabs<T extends string>({
  tabs,
  value,
  onChange








}: {tabs: {id: T;label: string;count?: number;}[];value: T;onChange: (v: T) => void;}) {
  return <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cn('flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors duration-150', value === t.id ? 'border-brand-700 text-brand-800' : 'border-transparent text-ink-muted hover:text-ink')}>
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="rounded-full bg-canvas px-1.5 text-xs text-ink-2">{t.count}</span>}
        </button>)}
    </div>;
}