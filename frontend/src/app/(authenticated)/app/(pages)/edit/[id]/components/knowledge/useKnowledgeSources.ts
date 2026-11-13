import { useCallback, useEffect, useRef, useState } from "react";
import { isCancelled, KnowledgeSource, listSources } from "./knowledgeApi";

const POLL_INTERVAL_MS = 2000;
const MAX_CONSECUTIVE_FAILURES = 5;

const isWorking = (source: KnowledgeSource) =>
  source.status === "pending" || source.status === "processing";

/**
 * The knowledge base sources of an app, as the server sees them. Polls while
 * any source is still being processed and stops once all have settled.
 */
export function useKnowledgeSources(appId: number | null) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loaded, setLoaded] = useState(false);
  const failures = useRef(0);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (appId == null) return;
      try {
        const next = await listSources(appId, signal);
        failures.current = 0;
        setSources(next);
        setLoaded(true);
      } catch (error) {
        if (isCancelled(error)) return;
        failures.current += 1;
        console.warn("Could not load knowledge base sources:", error);
      }
    },
    [appId]
  );

  useEffect(() => {
    setSources([]);
    setLoaded(false);
    failures.current = 0;
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  const working = sources.some(isWorking);

  useEffect(() => {
    if (!working) return;
    const controller = new AbortController();
    const interval = setInterval(() => {
      if (failures.current >= MAX_CONSECUTIVE_FAILURES) {
        clearInterval(interval);
        return;
      }
      void reload(controller.signal);
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [working, reload]);

  /** Add or replace a source returned by a create, edit or refresh call. */
  const upsert = useCallback((source: KnowledgeSource, replacesId?: number) => {
    setSources((prev) => {
      const targetId = replacesId ?? source.id;
      const exists = prev.some((s) => s.id === targetId);
      return exists
        ? prev.map((s) => (s.id === targetId ? source : s))
        : [...prev, source];
    });
  }, []);

  const remove = useCallback((sourceId: number) => {
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
  }, []);

  return { sources, loaded, reload, upsert, remove };
}
