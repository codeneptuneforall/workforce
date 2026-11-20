/**
 * Profile photos are stored as a Cloudinary path (`employee.photo`), never as a URL.
 *
 * - On the way out, `presentEmployeePhotos` builds `photoUrl` from the path and removes
 *   `photo`, so the browser only ever sees a ready-to-use URL.
 * - On the way in, `protectEmployeePhotos` makes `photo` server-owned: only the upload
 *   endpoint may change it. When the browser saves an employee it sends back the built
 *   URL; that URL is dropped instead of being stored.
 */
import type { AppState, Employee } from '../../shared/types';
import { isOwnAssetUrl, publicImageUrl } from './cloudinary';

/** Browser-facing employee: photoUrl built from the stored path, path removed. */
export function presentEmployee(employee: Employee): Employee {
  const { photo, ...rest } = employee;
  if (photo?.publicId) {
    const url = publicImageUrl(photo);
    if (url) rest.photoUrl = url;
  }
  return rest;
}

export function presentEmployeePhotos(state: AppState): AppState {
  return { ...state, employees: state.employees.map(presentEmployee) };
}

/**
 * Apply to the result of a client command before it is persisted.
 * `photo` always comes from the server copy; a built Cloudinary URL echoed back by the
 * browser is replaced by whatever photoUrl was stored before (usually nothing).
 * External links typed into the employee form are still saved as photoUrl.
 */
export function protectEmployeePhotos(current: AppState, next: AppState): AppState {
  const before = new Map(current.employees.map((e) => [e.id, e]));
  let changed = false;
  const employees = next.employees.map((employee) => {
    const prev = before.get(employee.id);
    const { photo: _clientPhoto, ...rest } = employee;
    const out: Employee = { ...rest };
    if (prev?.photo) out.photo = prev.photo;
    if (isOwnAssetUrl(out.photoUrl)) {
      if (prev?.photoUrl !== undefined) out.photoUrl = prev.photoUrl;
      else delete out.photoUrl;
    }
    // Keep the original object when nothing changed, so persistDiff sees no difference.
    const photoChanged = JSON.stringify(out.photo) !== JSON.stringify(employee.photo);
    const urlChanged = out.photoUrl !== employee.photoUrl;
    if (!photoChanged && !urlChanged) return employee;
    changed = true;
    return out;
  });
  return changed ? { ...next, employees } : next;
}
