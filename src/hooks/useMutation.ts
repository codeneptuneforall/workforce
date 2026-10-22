import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '../contexts/DataContext';
import type { Result } from '@shared/types';
import type { Command } from '../utils/commands';

/**
 * Runs a command against the API. Success is only shown once the server has confirmed
 * the write, so a failed save never looks like a completed one.
 *
 * `mutate` reports success as a boolean (the common case). Use `mutateWithResult` when
 * the response matters, for example the one-time password returned after creating an
 * employee account.
 */
export function useMutation() {
  const { run } = useData();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutateWithResult = useCallback(
    async (command: Command, successMessage?: string): Promise<Result> => {
      setPending(true);
      setError(null);
      const res = await run(command);
      setPending(false);
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong.');
        return res;
      }
      if (successMessage) toast.success(successMessage);
      return res;
    },
    [run]
  );

  const mutate = useCallback(
    async (command: Command, successMessage?: string): Promise<boolean> =>
      (await mutateWithResult(command, successMessage)).ok,
    [mutateWithResult]
  );

  return { mutate, mutateWithResult, pending, error, setError };
}
