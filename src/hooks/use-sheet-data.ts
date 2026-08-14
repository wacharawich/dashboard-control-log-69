import { api } from "@/convex/_generated/api";
import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Reactive access to the Google Sheet data cached in Convex.
 * - Subscribes to the cached chunks via useQuery (charts stay in sync).
 * - Auto-triggers a single sync from Google when nothing is cached yet.
 * - Exposes `sync(force)` for the manual refresh button.
 */
export function useSheetData() {
  const data = useQuery(api.sheet.getSheetData);
  const syncSheetData = useAction(api.sheet.syncSheetData);

  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const attemptedRef = useRef(false);

  const rows = useMemo(
    () => (data ? data.chunks.flatMap((c) => c.rows) : []),
    [data],
  );
  const meta = data?.meta ?? null;

  const sync = useCallback(
    async (force = false) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setSyncing(true);
      setError(null);
      try {
        await syncSheetData({ force });
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "เกิดข้อผิดพลาดในการโหลดข้อมูลจาก Google Sheets",
        );
      } finally {
        busyRef.current = false;
        setSyncing(false);
      }
    },
    [syncSheetData],
  );

  const loaded = data !== undefined;

  useEffect(() => {
    if (loaded && rows.length === 0 && !attemptedRef.current) {
      attemptedRef.current = true;
      void sync(false);
    }
  }, [loaded, rows.length, sync]);

  return { rows, meta, syncing, error, loaded, sync };
}
