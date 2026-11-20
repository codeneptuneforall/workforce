import { useState } from "react";
import { cn } from "../../utils/cn";
import { cloudinaryThumb } from "../../utils/cloudinary";

/** Rendered avatar diameter in px (h-7 / h-9 / h-14), used to request a right-sized photo. */
const AVATAR_PX = { sm: 28, md: 36, lg: 56 } as const;

export function Avatar({
  name,
  size = 'md',
  src,
  className
}: {name: string;size?: 'sm' | 'md' | 'lg';src?: string | null;className?: string;}) {
  const [broken, setBroken] = useState(false);
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const s = {
    sm: 'h-7 w-7 text-[11px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-14 w-14 text-base'
  }[size];
  if (src && !broken) {
    return <img src={cloudinaryThumb(src, AVATAR_PX[size])} alt={name} onError={() => setBroken(true)} className={cn('inline-flex shrink-0 items-center justify-center rounded-full object-cover bg-brand-100', s, className)} />;
  }
  return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800', s, className)} aria-hidden>{initials}</span>;
}
