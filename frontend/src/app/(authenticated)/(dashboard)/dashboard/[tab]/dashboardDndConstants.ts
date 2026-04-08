export const dashboardAppsListDroppableId = "dashboard-apps-list";

/** Set on each collection row in the sidebar for pointer-based drop targeting */
export const DASHBOARD_COLLECTION_ID_DATA_ATTR = "data-dashboard-collection-id";

/**
 * Resolve which collection row is under the pointer (cursor/finger).
 * hello-pangea/dnd picks a droppable from the draggable’s geometry (center/overlap),
 * which mismatches the user’s intent when a wide card overlaps a different row than the pointer.
 */
export function collectionIdUnderPointer(
  clientX: number,
  clientY: number,
  validIds: ReadonlySet<number>
): number | null {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    if (!(el instanceof Element)) continue;
    const row = el.closest(`[${DASHBOARD_COLLECTION_ID_DATA_ATTR}]`);
    if (!row) continue;
    const raw = row.getAttribute(DASHBOARD_COLLECTION_ID_DATA_ATTR);
    if (raw == null) continue;
    const id = Number(raw);
    if (Number.isFinite(id) && validIds.has(id)) {
      return id;
    }
  }
  return null;
}

export function collectionSidebarDroppableId(
  instance: "desktop" | "mobile",
  collectionId: number
) {
  return `coll-${instance}-${collectionId}`;
}

const COLL_DROP_RE = /^coll-(desktop|mobile)-(\d+)$/;

export function parseCollectionDropDestination(
  droppableId: string
): number | null {
  const m = droppableId.match(COLL_DROP_RE);
  if (!m) return null;
  return Number(m[2]);
}
