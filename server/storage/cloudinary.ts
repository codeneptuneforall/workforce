/**
 * Cloudinary file storage for profile photos and bug tracker attachments.
 *
 * Layout (root = config.cloudinaryFolder, e.g. "workforce" or "workforce-dev"):
 *   <root>/profiles/<employeeId>                  public image, replaced in place
 *   <root>/bug-tracker/<issueKey>/<attachmentId>  "authenticated" (private) asset
 *
 * Private attachments are only reachable through signed delivery URLs that the API
 * generates after its own permission check. Those URLs are unguessable but do not
 * expire on their own (expiring links need Cloudinary token auth, a paid add-on).
 *
 * Both folder modes are supported: the public_id carries the full path (fixed-folder
 * accounts) and asset_folder sets the Media Library folder (dynamic-folder accounts).
 */
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { config } from '../config';

export type ResourceType = 'image' | 'raw';
export type DeliveryType = 'upload' | 'authenticated';

/** What we persist for a stored file. Never accepted from clients. */
export interface StoredAsset {
  publicId: string;
  resourceType: ResourceType;
  deliveryType: DeliveryType;
  format?: string;
  version?: number;
  bytes: number;
}

let configured: boolean | null = null;

/** Parses CLOUDINARY_URL explicitly instead of relying on the SDK reading the env at import time. */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(config.cloudinaryUrl.trim());
  if (!match) {
    configured = false;
    if (config.cloudinaryUrl) console.error('[storage] CLOUDINARY_URL is set but not in the form cloudinary://key:secret@cloud');
    return configured;
  }
  // analytics: false stops the SDK appending a "?_a=..." tracking parameter to every URL.
  cloudinary.config({ api_key: match[1], api_secret: match[2], cloud_name: match[3], secure: true, analytics: false });
  configured = true;
  return configured;
}

export function isStorageConfigured(): boolean {
  return ensureConfigured();
}

/** Thrown when storage is needed but CLOUDINARY_URL is missing; routes map it to 503. */
export class StorageUnavailableError extends Error {
  constructor() {
    super('File storage is not configured on the server.');
  }
}

export function folderPath(...parts: string[]): string {
  return [config.cloudinaryFolder, ...parts]
    .map((p) => String(p).replace(/[^A-Za-z0-9_\-./]/g, '_').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function uploadBuffer(buffer: Buffer, options: Record<string, unknown>): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) reject(error ?? new Error('Cloudinary returned no result'));
      else resolve(result);
    });
    stream.end(buffer);
  });
}

function toStored(result: UploadApiResponse): StoredAsset {
  return {
    publicId: result.public_id,
    resourceType: result.resource_type === 'raw' ? 'raw' : 'image',
    deliveryType: result.type === 'authenticated' ? 'authenticated' : 'upload',
    format: result.format || undefined,
    version: result.version,
    bytes: result.bytes
  };
}

/**
 * Public https URL for a stored public image (profile photos), built from its path.
 * Includes the version, which changes on every replacement, so browsers never show a
 * stale cached photo. Returns undefined when storage is not configured.
 */
export function publicImageUrl(photo: { publicId: string; version?: number; format?: string }): string | undefined {
  if (!ensureConfigured()) return undefined;
  return cloudinary.url(photo.publicId, {
    resource_type: 'image',
    type: 'upload',
    secure: true,
    ...(photo.format ? { format: photo.format } : {}),
    ...(photo.version ? { version: photo.version } : {})
  });
}

/** True for URLs that point at this Cloudinary account (i.e. URLs the API itself builds). */
export function isOwnAssetUrl(url: string | undefined | null): boolean {
  if (!url || !ensureConfigured()) return false;
  const cloud = cloudinary.config().cloud_name;
  return Boolean(cloud) && url.startsWith(`https://res.cloudinary.com/${cloud}/`);
}

/**
 * Upload (or replace) an employee's profile photo. Public, so <img> works across the
 * Vercel/Render domains without cookies. Returns the versioned https URL, which
 * changes on every replacement so browsers never show a stale cached photo.
 */
export async function uploadProfilePhoto(employeeId: string, buffer: Buffer): Promise<{ url: string; asset: StoredAsset }> {
  if (!ensureConfigured()) throw new StorageUnavailableError();
  const folder = folderPath('profiles');
  const result = await uploadBuffer(buffer, {
    public_id: `${folder}/${employeeId.replace(/[^A-Za-z0-9_\-]/g, '_')}`,
    asset_folder: folder,
    resource_type: 'image',
    type: 'upload',
    overwrite: true,
    invalidate: true
  });
  return { url: result.secure_url, asset: toStored(result) };
}

/** Images and PDFs are stored as image resources (previewable); everything else as raw. */
export function resourceTypeFor(mimeType: string, originalName: string): ResourceType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf' || /\.pdf$/i.test(originalName)) return 'image';
  return 'raw';
}

/** Upload a private bug tracker attachment under <root>/bug-tracker/<issueKey>/. */
export async function uploadAttachment(
  issueKey: string,
  attachmentId: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<StoredAsset> {
  if (!ensureConfigured()) throw new StorageUnavailableError();
  const folder = folderPath('bug-tracker', issueKey);
  const resourceType = resourceTypeFor(mimeType, originalName);
  // Raw public_ids keep their extension so downloads have the right file type.
  const ext = resourceType === 'raw' ? (/(\.[A-Za-z0-9]{1,8})$/.exec(originalName)?.[1]?.toLowerCase() ?? '') : '';
  const result = await uploadBuffer(buffer, {
    public_id: `${folder}/${attachmentId}${ext}`,
    asset_folder: folder,
    resource_type: resourceType,
    type: 'authenticated',
    overwrite: false
  });
  return toStored(result);
}

/** Signed delivery URL for a stored asset. Call only after the caller's permission check. */
export function signedUrl(asset: Pick<StoredAsset, 'publicId' | 'resourceType' | 'deliveryType' | 'format' | 'version'>): string | undefined {
  if (!ensureConfigured()) return undefined;
  return cloudinary.url(asset.publicId, {
    resource_type: asset.resourceType,
    type: asset.deliveryType,
    sign_url: asset.deliveryType !== 'upload',
    secure: true,
    ...(asset.resourceType === 'image' && asset.format ? { format: asset.format } : {}),
    ...(asset.version ? { version: asset.version } : {})
  });
}

/** Best-effort delete; failures are logged, never thrown. */
export async function deleteAsset(asset: Pick<StoredAsset, 'publicId' | 'resourceType' | 'deliveryType'>): Promise<void> {
  if (!ensureConfigured()) return;
  try {
    await cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType, type: asset.deliveryType, invalidate: true });
  } catch (err) {
    console.error('[storage] delete failed', asset.publicId, err instanceof Error ? err.message : err);
  }
}
