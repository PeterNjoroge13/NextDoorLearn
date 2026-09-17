import { useCallback, useEffect, useRef, useState } from 'react';

export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const loaderRef = useRef(loader);
  const dependencyKey = JSON.stringify(deps);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { loaderRef.current = loader; });
  const load = useCallback(async (refresh = false) => {
    void dependencyKey;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try { setData(await loaderRef.current()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load this page'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [dependencyKey]);
  // Loading remote data is the intended synchronization performed by this hook.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  return { data, setData, loading, refreshing, error, reload: () => load(true) };
}
