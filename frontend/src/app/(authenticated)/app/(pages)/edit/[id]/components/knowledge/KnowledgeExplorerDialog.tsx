"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import SkeletonLoader from "@/components/layout/loading/skeletonLoader";
import { Input } from "@/components/basic/input";
import { TEST_IDS } from "@/constants/testIds";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  apiErrorMessage,
  isCancelled,
  KnowledgeChunk,
  KnowledgeSource,
  listChunks,
  searchChunks,
} from "./knowledgeApi";
import { formatDate, SOURCE_TYPE_LABELS, SourceTypeIcon } from "./sourceDisplay";

interface KnowledgeExplorerDialogProps {
  appId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: KnowledgeSource[];
  /** Open with only this source selected; otherwise all are selected. */
  initialSourceId?: number | null;
}

export default function KnowledgeExplorerDialog({
  appId,
  open,
  onOpenChange,
  sources,
  initialSourceId,
}: KnowledgeExplorerDialogProps) {
  // Only sources with stored text can be explored.
  const explorable = useMemo(
    () => sources.filter((s) => (s.chunk_count ?? 0) > 0),
    [sources]
  );
  const explorableIds = useMemo(() => explorable.map((s) => s.id), [explorable]);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [matches, setMatches] = useState<KnowledgeChunk[] | null>(null);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const wasOpen = useRef(false);

  // Reset when the dialog opens.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSelectedIds(
        initialSourceId != null && explorableIds.includes(initialSourceId)
          ? [initialSourceId]
          : explorableIds
      );
      setQueryInput("");
      setActiveQuery("");
      setMatches(null);
      setExpanded(new Set());
      setError(null);
    }
    wasOpen.current = open;
  }, [open, initialSourceId, explorableIds]);

  const selectionKey = selectedIds.join(",");

  // Browse mode: load the first page of chunks for the selected sources.
  useEffect(() => {
    if (!open || activeQuery) return;
    if (selectedIds.length === 0) {
      setChunks([]);
      setCount(0);
      setHasMore(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    listChunks(appId, selectedIds, 1, controller.signal)
      .then((result) => {
        setChunks(result.results);
        setCount(result.count);
        setHasMore(result.has_more);
        setPage(1);
        setLoading(false);
      })
      .catch((e) => {
        if (isCancelled(e)) return;
        setError(apiErrorMessage(e, "The knowledge base could not be loaded."));
        setLoading(false);
      });
    return () => controller.abort();
    // selectionKey stands in for selectedIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appId, selectionKey, activeQuery]);

  // Test-query mode: show what a run would retrieve for the query.
  useEffect(() => {
    if (!open || !activeQuery) return;
    if (selectedIds.length === 0) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    searchChunks(appId, activeQuery, selectedIds, controller.signal)
      .then((results) => {
        setMatches(results);
        setLoading(false);
      })
      .catch((e) => {
        if (isCancelled(e)) return;
        setMatches([]);
        setError(apiErrorMessage(e, "The test query could not be run."));
        setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appId, selectionKey, activeQuery]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const result = await listChunks(appId, selectedIds, page + 1);
      setChunks((prev) => [...prev, ...result.results]);
      setHasMore(result.has_more);
      setPage(page + 1);
    } catch (e) {
      setError(apiErrorMessage(e, "More chunks could not be loaded."));
    } finally {
      setLoadingMore(false);
    }
  };

  const submitQuery = (event: React.FormEvent) => {
    event.preventDefault();
    const query = queryInput.trim();
    setExpanded(new Set());
    setActiveQuery(query);
    if (!query) setMatches(null);
  };

  const clearQuery = () => {
    setQueryInput("");
    setActiveQuery("");
    setMatches(null);
    setExpanded(new Set());
  };

  const toggleSource = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected =
    explorableIds.length > 0 && selectedIds.length === explorableIds.length;
  const totalChunks = explorable.reduce((sum, s) => sum + (s.chunk_count ?? 0), 0);
  const searching = Boolean(activeQuery);
  const rows = searching ? matches ?? [] : chunks;

  let heading: string;
  if (searching) {
    heading = loading
      ? "Finding matches…"
      : `Top ${rows.length} ${rows.length === 1 ? "match" : "matches"} for “${activeQuery}”`;
  } else {
    heading = `${count.toLocaleString()} knowledge ${count === 1 ? "chunk" : "chunks"}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid={TEST_IDS.KNOWLEDGE_EXPLORER}
        overlayStyle={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        className="flex h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:rounded-lg"
      >
        <DialogHeader className="border-b p-5 pr-12 text-left">
          <DialogTitle className="text-xl font-semibold">
            Explore knowledge base
          </DialogTitle>
          <DialogDescription>
            This is the text the AI can draw on. Try a question to see which
            chunks would be sent to the AI when someone asks it.
          </DialogDescription>
          <form onSubmit={submitQuery} className="flex gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                data-testid={TEST_IDS.KNOWLEDGE_EXPLORER_QUERY_INPUT}
                type="text"
                value={queryInput}
                maxLength={2000}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Test a question or phrase to see the chunks your app will retrieve"
                aria-label="Test question"
                className="pl-9 pr-9"
              />
              {(queryInput || searching) && (
                <button
                  type="button"
                  onClick={clearQuery}
                  aria-label="Clear test question"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>
            <Button type="submit" disabled={!queryInput.trim() || loading}>
              Test
            </Button>
          </form>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="max-h-48 shrink-0 overflow-y-auto border-b p-4 md:max-h-none md:w-72 md:border-b-0 md:border-r">
            <p className="text-xs font-medium uppercase text-gray-500">Sources</p>
            <p className="mb-2 text-xs text-gray-500">
              {selectedIds.length} of {explorable.length} shown
            </p>
            {explorable.length > 1 && (
              <label className="mb-1 flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) =>
                    setSelectedIds(checked ? explorableIds : [])
                  }
                />
                <span className="flex-1 text-sm font-medium text-gray-800">
                  All sources
                </span>
                <span className="text-xs text-gray-500">{totalChunks}</span>
              </label>
            )}
            <ul className="space-y-1">
              {explorable.map((source) => (
                <li key={source.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-gray-50">
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedIds.includes(source.id)}
                      onCheckedChange={() => toggleSource(source.id)}
                    />
                    <SourceTypeIcon
                      type={source.type}
                      className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-medium text-gray-800"
                        title={source.name}
                      >
                        {source.name}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {SOURCE_TYPE_LABELS[source.type]} · {source.chunk_count}{" "}
                        {source.chunk_count === 1 ? "chunk" : "chunks"}
                        {" · "}
                        {formatDate(source.last_fetched_at ?? source.created_at)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </aside>

          <section className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <h3 className="text-base font-semibold text-gray-900">{heading}</h3>
              {searching && (
                <button
                  type="button"
                  onClick={clearQuery}
                  className="shrink-0 text-sm text-primary-600 hover:underline"
                >
                  Show all chunks
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {error && (
                <p role="alert" className="mb-3 text-sm text-red-600">
                  {error}
                </p>
              )}
              {loading ? (
                <div className="flex justify-center py-12">
                  <SkeletonLoader />
                </div>
              ) : explorable.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">
                  Nothing to explore yet. Add a source and wait for it to
                  finish processing.
                </p>
              ) : selectedIds.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">
                  Select at least one source to see its chunks.
                </p>
              ) : rows.length === 0 ? (
                !error && (
                  <p className="py-12 text-center text-sm text-gray-500">
                    {searching
                      ? "No chunks matched this question."
                      : "No text was found in the selected sources."}
                  </p>
                )
              ) : (
                <>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-56">Source · chunk</TableHead>
                          <TableHead>Text</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((chunk) => {
                          const isExpanded = expanded.has(chunk.id);
                          return (
                            <TableRow
                              key={chunk.id}
                              data-testid={TEST_IDS.KNOWLEDGE_CHUNK_ROW}
                            >
                              <TableCell className="w-56 align-top">
                                <p
                                  className="break-words text-sm font-medium text-gray-800"
                                  title={chunk.source_name}
                                >
                                  {chunk.source_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {chunk.chunk_index + 1}/{chunk.source_chunk_count}
                                </p>
                                {chunk.metadata.url &&
                                  chunk.source_type === "website" && (
                                    <a
                                      href={chunk.metadata.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-1 block break-all text-xs text-primary-600 hover:underline"
                                    >
                                      {chunk.metadata.title || chunk.metadata.url}
                                    </a>
                                  )}
                                {chunk.similarity != null && (
                                  <span className="mt-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                                    {Math.round(chunk.similarity * 100)}% match
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="align-top">
                                <p
                                  className={`whitespace-pre-wrap break-words text-sm text-gray-800 ${
                                    isExpanded ? "" : "line-clamp-3"
                                  }`}
                                >
                                  {chunk.content}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(chunk.id)}
                                  aria-expanded={isExpanded}
                                  className="mt-1 text-xs text-primary-600 hover:underline"
                                >
                                  {isExpanded ? "Show less" : "Show full text"}
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {!searching && hasMore && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={loadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore
                          ? "Loading…"
                          : `Load more (${chunks.length} of ${count})`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
