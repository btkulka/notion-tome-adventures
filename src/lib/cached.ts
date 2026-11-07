import { useCallback, useRef, type SetStateAction } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Data from the Worker that outlives the component showing it.
 *
 * Switching tools unmounts the page. When the DM comes back, this hands over what
 * the page last had, including its own edits (`set` writes them through), and
 * refreshes in the background instead of dropping to a spinner and starting over.
 * `data` is undefined only until the first load for that key.
 *
 * A refresh that brings back equal JSON keeps the old objects, so nothing
 * re-renders. Values that can't be compared that way (a map's terrain is typed
 * arrays) pass `keep`, which picks what to show from the old and the new.
 */
export function useCached<T>(
  key: QueryKey,
  load: () => Promise<T>,
  { enabled = true, keep }: { enabled?: boolean; keep?: (old: T, next: T) => T } = {}
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const next = await load();
      const old = queryClient.getQueryData<T>(key);
      return keep && old !== undefined ? keep(old, next) : next;
    },
    enabled,
    staleTime: 0,
    gcTime: Infinity,
    retry: false,
  });

  const keyRef = useRef(key);
  keyRef.current = key;
  const set = useCallback(
    (next: SetStateAction<T>) =>
      queryClient.setQueryData<T>(keyRef.current, (prev) => (typeof next === 'function' ? (next as (p: T) => T)(prev as T) : next)),
    [queryClient]
  );

  return { data: query.data, set, error: query.error, reload: query.refetch };
}

/** `keep` for a map document: the same version is the same map. */
export const sameVersion = <M extends { id: string; version: number }>(old: M, next: M): M =>
  old.id === next.id && old.version === next.version ? old : next;
