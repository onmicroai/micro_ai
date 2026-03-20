import type {
  AppSerialized,
  DashboardListScope,
} from "@/app/(authenticated)/(dashboard)/types";

export function filterAppsForDashboard(
  apps: AppSerialized[],
  listScope: DashboardListScope,
  activeTab: string
): AppSerialized[] {
  let next = apps;
  if (listScope.kind === "owned") {
    next = next.filter((a) => a.role === "owner");
  } else if (listScope.kind === "shared") {
    next = next.filter((a) => a.role === "admin");
  }
  if (activeTab !== "all") {
    const t = activeTab.toLowerCase();
    next = next.filter((a) => (a.privacy ?? "").toLowerCase() === t);
  }
  return next;
}

/**
 * Same ordering as the dashboard app list (must match Droppable row indices).
 * Drag indices from @hello-pangea/dnd refer to this array, not raw filter output.
 */
export function getSortedDashboardAppList(
  apps: AppSerialized[],
  listScope: DashboardListScope,
  activeTab: string,
  globalDashboardOrderIds: number[] | null | undefined,
  collectionDashboardOrderIds: number[] | null | undefined,
  collectionOrderForId: number | null | undefined
): AppSerialized[] {
  const orderIdsForSort =
    listScope.kind === "collection" &&
    collectionOrderForId === listScope.id
      ? collectionDashboardOrderIds
      : listScope.kind === "collection"
        ? null
        : globalDashboardOrderIds;

  return sortAppsByOrderIds(
    filterAppsForDashboard(apps, listScope, activeTab),
    orderIdsForSort
  );
}

/** When no saved order (null / empty), callers should fall back to id sort. */
export function sortAppsByOrderIds(
  apps: AppSerialized[],
  orderIds: number[] | null | undefined
): AppSerialized[] {
  if (!orderIds?.length) {
    return [...apps].sort((a, b) => a.id - b.id);
  }
  const rank = new Map(orderIds.map((id, i) => [id, i]));
  return [...apps].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.id - b.id;
  });
}

export function reorderArray<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

/**
 * Replace positions of apps in `subsetIds` within `fullOrder` using `newSubsetOrder`
 * (same length as subset occurrences in fullOrder).
 */
export function mergeSubsetReorder(
  fullOrder: number[],
  subsetIds: Set<number>,
  newSubsetOrder: number[]
): number[] {
  let j = 0;
  return fullOrder.map((id) => {
    if (!subsetIds.has(id)) return id;
    return newSubsetOrder[j++];
  });
}
