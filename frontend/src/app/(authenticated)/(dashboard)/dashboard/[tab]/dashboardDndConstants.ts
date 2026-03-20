export const dashboardAppsListDroppableId = "dashboard-apps-list";

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
