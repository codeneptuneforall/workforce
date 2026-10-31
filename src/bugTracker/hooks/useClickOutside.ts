import { useEffect, type RefObject } from 'react';

export function useClickOutside(ref: RefObject<HTMLElement>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handlePointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOutside();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, onOutside, active]);
}