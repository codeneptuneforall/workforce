import { cn } from '../../utils/cn';
import logoUrl from '../../assets/brand/code-neptune-icon.png';

export function Logo({ compact, className, inverted }: {compact?: boolean;className?: string;inverted?: boolean;}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src={logoUrl}
        alt="Code Neptune"
        className={cn('h-8 w-8 shrink-0 rounded-lg object-contain bg-white p-0.5', inverted ? 'ring-1 ring-white/40' : '')}
        aria-hidden={!compact ? undefined : true}
      />
      {!compact &&
      <span className="flex flex-col leading-tight">
          <span className={cn('text-sm font-semibold', inverted ? 'text-white' : 'text-ink')}>Code Neptune</span>
          <span className={cn('text-[11px]', inverted ? 'text-brand-100' : 'text-ink-muted')}>Workforce</span>
        </span>
      }
    </span>);

}