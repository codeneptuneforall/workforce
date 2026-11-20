import type { HeavyIssueField, IssueSummary } from '../types/bugTracker';

const HEAVY_FIELDS: HeavyIssueField[] = [
'description',
'stepsToReproduce',
'expectedResult',
'actualResult',
'attachments',
'comments',
'activity',
'resolution'];


const ATTACHMENT_PREVIEW_COUNT = 3;

/**
 * Convert any issue payload (list item, full issue from a mutation response or
 * socket event) into the list summary shape. Derived fields are computed from
 * the heavy arrays when present, otherwise taken from the payload. Heavy
 * fields are stripped so the shared list never holds them.
 */
export function toIssueSummary(raw: any): IssueSummary {
  const out: any = { ...raw };
  if (out.id === undefined && out._id !== undefined) out.id = out._id;

  if (Array.isArray(raw.comments)) {
    out.commentCount = raw.comments.length;
    out.commentAuthorIds = [...new Set<string>(raw.comments.map((c: any) => c.authorId))];
  }
  if (Array.isArray(raw.attachments)) {
    out.attachmentCount = raw.attachments.length;
    // First few *image* attachments — what the Kanban card renders as thumbnails.
    out.attachmentPreview = raw.attachments.filter((a: any) => a.kind === 'image').slice(0, ATTACHMENT_PREVIEW_COUNT);
  }
  if (out.resolvedAt === undefined) out.resolvedAt = raw.resolution?.resolvedAt ?? null;

  out.commentCount ??= 0;
  out.commentAuthorIds ??= [];
  out.attachmentCount ??= 0;
  out.attachmentPreview ??= [];

  for (const field of HEAVY_FIELDS) delete out[field];
  return out as IssueSummary;
}
