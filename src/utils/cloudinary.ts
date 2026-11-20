/**
 * Ask Cloudinary for a small square version of a public image (avatars), instead of
 * downloading the full 400px original for a 28px circle. Non-Cloudinary URLs (legacy
 * base64 photos, external links) are returned unchanged.
 */
export function cloudinaryThumb(src: string | null | undefined, sizePx: number): string | undefined {
  if (!src) return undefined;
  const marker = '/image/upload/';
  if (!src.includes('res.cloudinary.com') || !src.includes(marker)) return src;
  const px = Math.max(16, Math.round(sizePx * 2)); // 2x for sharp rendering on HiDPI screens
  return src.replace(marker, `${marker}c_fill,g_face,w_${px},h_${px},f_auto,q_auto/`);
}
