import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AnimationItem } from 'lottie-web';
import { cn } from '../../utils/cn';

/**
 * A Lottie animation used purely as decoration.
 *
 * `lottie-web` is imported lazily and only its light SVG player is used: the
 * files are shape animations with no expressions, so the expression engine and
 * the canvas/HTML renderers would be dead weight. It is `aria-hidden` unless a
 * `label` is given, never accepts pointer events, and freezes on its first frame
 * when the visitor asked for reduced motion.
 */
export function LottieMark({
  src,
  className,
  label,
  loop = true,
  speed = 1,
  fallback = null
}: {
  src: object;
  className?: string;
  /** Accessible name. Omit for purely decorative animations. */
  label?: string;
  loop?: boolean;
  speed?: number;
  /** Shown if the animation cannot be drawn at all. */
  fallback?: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let animation: AnimationItem | null = null;

    void import('lottie-web/build/player/lottie_light')
      .then(({ default: lottie }) => {
        if (cancelled || !hostRef.current) return;
        animation = lottie.loadAnimation({
          container: hostRef.current,
          renderer: 'svg',
          loop,
          // Paused on the first frame, which is what reduced motion asks for.
          autoplay: !reduced,
          animationData: src,
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
        });
        animation.setSpeed(speed);
        animation.addEventListener('error', () => setFailed(true));
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [src, loop, reduced, speed]);

  return (
    <div
      className={cn('pointer-events-none relative select-none', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}>
      <div ref={hostRef} className="h-full w-full" />
      {failed && <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>}
    </div>);
}
