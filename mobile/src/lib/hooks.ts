import { useCallback, useEffect, useState } from 'react';

export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError('');
    try { setData(await loader()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load this page'); }
    finally { setLoading(false); setRefreshing(false); }
  // The caller controls reload boundaries with deps, just like useEffect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, setData, loading, refreshing, error, reload: () => load(true) };
}
