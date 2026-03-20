"use client";

import MicroappStatsContent from "./MicroappStatsContent";

export default function StatsPage({ params }: { params: { id: string } }) {
  return <MicroappStatsContent hashId={params.id} />;
}
