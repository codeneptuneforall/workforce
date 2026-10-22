import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

export function DateStepper({ label, onPrev, onNext, nextDisabled, onToday }: {label: string;onPrev: () => void;onNext: () => void;nextDisabled?: boolean;onToday?: () => void;}) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onPrev} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink-2 hover:bg-canvas" aria-label="Previous">
        <ChevronLeftIcon className="h-4 w-4" />
      </button>
      <span className="min-w-[150px] px-2 text-center text-sm font-medium text-ink tnum">{label}</span>
      <button onClick={onNext} disabled={nextDisabled} className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink-2 hover:bg-canvas disabled:opacity-40" aria-label="Next">
        <ChevronRightIcon className="h-4 w-4" />
      </button>
      {onToday &&
      <button onClick={onToday} className="ml-1 h-9 rounded-lg px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">Today</button>
      }
    </div>);

}