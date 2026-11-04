import { cn } from '../../utils/cn';
import logoUrl from '../../assets/brand/code-neptune-icon.png';

const LOGO_SIZES: Record<string, string> = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
};

export function Logo({ compact, className, inverted, hideSubtitle, size = 'md' }: {compact?: boolean;className?: string;inverted?: boolean;hideSubtitle?: boolean;size?: 'sm' | 'md' | 'lg' | 'xl';}) {
  const imgSize = LOGO_SIZES[size] ?? LOGO_SIZES.md;
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src={logoUrl}
        alt="Code Neptune"
        className={cn(imgSize, 'shrink-0 rounded-lg object-contain bg-white p-0.5', inverted ? 'ring-1 ring-white/40' : '')}
        aria-hidden={!compact ? undefined : true}
      />
      {!compact && !hideSubtitle &&
      <span className="flex flex-col leading-tight">
          <span className={cn('text-sm font-semibold', inverted ? 'text-white' : 'text-ink')}>Code Neptune</span>
          <span className={cn('text-[11px]', inverted ? 'text-brand-100' : 'text-ink-muted')}>Workforce</span>
        </span>
      }
      {!compact && hideSubtitle &&
      <span className="flex flex-col leading-tight">
          <span className={cn('text-sm font-semibold', inverted ? 'text-white' : 'text-ink')}>Code Neptune</span>
        </span>
      }
    </span>);
}
