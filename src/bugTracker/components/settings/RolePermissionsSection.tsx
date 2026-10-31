import React from 'react';
import { CheckIcon, MinusIcon } from 'lucide-react';
import { permissionMatrix } from '../../data/trackerConfig';
import { rolePreviews } from '../../data/rolePreview';

export function RolePermissionsSection() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink">Roles & permissions</h2>
        <p className="mt-0.5 text-[13px] text-ink-subtle">Overview of what each role can do in the Bug Tracker. Role assignment is managed in Workforce access settings.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-line bg-canvas text-xs text-ink-subtle">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Capability</th>
              {rolePreviews.map((r) =>
              <th key={r.role} scope="col" className="px-3 py-2 text-center font-medium">
                  {r.label.split(' / ')[0]}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {permissionMatrix.map((row) =>
            <tr key={row.capability}>
                <th scope="row" className="px-4 py-2.5 font-normal text-ink">
                  {row.capability}
                </th>
                {rolePreviews.map((r) =>
              <td key={r.role} className="px-3 py-2.5 text-center">
                    {row.roles.includes(r.role) ?
                <CheckIcon className="mx-auto h-4 w-4 text-success" aria-label="Allowed" /> :

                <MinusIcon className="mx-auto h-4 w-4 text-line-strong" aria-label="Not allowed" />
                }
                  </td>
              )}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>);

}