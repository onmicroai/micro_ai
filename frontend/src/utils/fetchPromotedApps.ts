export interface PromotedApp {
  hashId: string;
  title: string;
  description: string;
  appUrl: string;
}

interface PromotedAppApiRow {
  hash_id: string;
  title: string;
  description: string;
  app_url: string;
}

function getPromotedAppsApiBase(): string {
  const publicBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  const internalBase = (process.env.INTERNAL_API_URL ?? "").replace(/\/+$/, "");

  // Browser requests go through the public URL (nginx → Django).
  if (typeof window !== "undefined") {
    return publicBase;
  }

  // Server components run inside the frontend container; localhost is not Django.
  if (internalBase) {
    return internalBase;
  }

  if (
    !publicBase ||
    publicBase.includes("localhost") ||
    publicBase.includes("127.0.0.1")
  ) {
    return "http://web:8000";
  }

  return publicBase;
}

function promotedAppsRequestUrl(limit?: number): string {
  const base = getPromotedAppsApiBase();
  const path = "/api/microapps/public/promoted/";
  const params =
    limit !== undefined ? `?limit=${encodeURIComponent(String(limit))}` : "";
  return base ? `${base}${path}${params}` : `${path}${params}`;
}

export async function fetchPromotedApps(
  limit?: number
): Promise<PromotedApp[]> {
  try {
    const response = await fetch(promotedAppsRequestUrl(limit), {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    const rows: PromotedAppApiRow[] = json?.data ?? [];

    return rows.map((row) => ({
      hashId: row.hash_id,
      title: row.title,
      description: row.description,
      appUrl: row.app_url,
    }));
  } catch {
    return [];
  }
}
