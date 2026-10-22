import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { AccountSummary } from '../api/client';

/**
 * The list of active user accounts.
 *
 * Only management users can read it, so the hook stays empty for employees and never
 * turns an authorisation problem into a broken page.
 */
export function useAccounts(enabled: boolean) {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setAccounts([]);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .accounts()
      .then((res) => {
        if (active) setAccounts(res.accounts);
      })
      .catch((err) => {
        if (active && !(err instanceof ApiError && err.status === 403)) {
          console.error('[accounts] could not load the account list', err);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return { accounts, loading };
}
