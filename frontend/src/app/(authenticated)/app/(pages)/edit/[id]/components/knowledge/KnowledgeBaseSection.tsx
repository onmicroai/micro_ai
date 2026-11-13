"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "react-toastify";
import {
  Globe,
  HelpCircle,
  Pencil,
  RefreshCw,
  Search,
  Type,
  Upload,
  X,
} from "lucide-react";
import { Input } from "@/components/basic/input";
import { TEST_IDS } from "@/constants/testIds";
import type { AttachedFile } from "@/app/(authenticated)/app/types";
import { useSurveyStore } from "../../store/editSurveyStore";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import AddWebSourceDialog from "./AddWebSourceDialog";
import KnowledgeExplorerDialog from "./KnowledgeExplorerDialog";
import PasteTextDialog from "./PasteTextDialog";
import {
  apiErrorMessage,
  deleteFileByName,
  deleteSource,
  KnowledgeSource,
  MAX_FILE_SIZE,
  refreshSource,
  sanitizeFileName,
  uploadFileSource,
} from "./knowledgeApi";
import { formatDate, SOURCE_TYPE_LABELS, SourceTypeIcon } from "./sourceDisplay";
import { useKnowledgeSources } from "./useKnowledgeSources";

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
  "text/plain": [".txt", ".log"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/tiff": [".tiff"],
  "image/bmp": [".bmp"],
};

const MAX_DESCRIPTION_LENGTH = 200;

const DESCRIPTION_PLACEHOLDERS = {
  file: "Add a description so the AI understands the content of this file better (optional)",
  webpage: "Add a description so the AI understands what this page covers (optional)",
  website: "Add a description so the AI understands what this site covers (optional)",
  text: "Add a description so the AI understands what this text covers (optional)",
} as const;

interface PendingDuplicate {
  name: string;
  file: File;
}

const entryType = (entry: AttachedFile) => entry.type ?? "file";

const entryKey = (entry: AttachedFile) =>
  entry.source_id != null
    ? `id:${entry.source_id}`
    : `name:${entry.original_filename}`;

/** The server-side source behind an app_json entry: by id, or by name for older entries. */
function findSource(
  entry: AttachedFile,
  sources: KnowledgeSource[]
): KnowledgeSource | undefined {
  if (entry.source_id != null) {
    const byId = sources.find((s) => s.id === entry.source_id);
    if (byId) return byId;
  }
  return sources.find((s) => s.name === entry.original_filename);
}

function updateEntries(change: (files: AttachedFile[]) => AttachedFile[]) {
  const { attachedFiles, setAttachedFiles } = useSurveyStore.getState();
  return setAttachedFiles(change(attachedFiles ?? []));
}

function entryFromSource(source: KnowledgeSource): AttachedFile {
  return {
    original_filename: source.name,
    text_filename: source.name,
    size: 0,
    source_id: source.id,
    type: source.type,
    ...(source.url ? { url: source.url } : {}),
  };
}

export default function KnowledgeBaseSection({
  appId,
}: {
  appId: number | null;
}) {
  const attachedFiles = useSurveyStore((s) => s.attachedFiles);
  const addAttachedFile = useSurveyStore((s) => s.addAttachedFile);
  const { sources, loaded, reload, upsert, remove } = useKnowledgeSources(appId);

  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const [duplicates, setDuplicates] = useState<PendingDuplicate[]>([]);
  const [refreshingIds, setRefreshingIds] = useState<number[]>([]);
  const [webDialogOpen, setWebDialogOpen] = useState(false);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [editingTextId, setEditingTextId] = useState<number | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [explorerSourceId, setExplorerSourceId] = useState<number | null>(null);

  const isUploading = uploadsInFlight > 0;

  const rows = useMemo(
    () =>
      (attachedFiles ?? [])
        .filter((entry) => entry && entry.original_filename)
        .map((entry) => ({ entry, source: findSource(entry, sources) })),
    [attachedFiles, sources]
  );

  // Sources listed in this app, in the order shown, for the explorer.
  const attachedSources = useMemo(
    () =>
      rows
        .map((row) => row.source)
        .filter((source): source is KnowledgeSource => Boolean(source)),
    [rows]
  );
  const canExplore = attachedSources.some((s) => (s.chunk_count ?? 0) > 0);

  // A web source is saved under its URL and takes the page title once read.
  useEffect(() => {
    const renamed = rows.filter(
      ({ entry, source }) =>
        source &&
        source.status === "ready" &&
        entry.source_id === source.id &&
        entry.original_filename !== source.name
    );
    if (renamed.length === 0) return;
    void updateEntries((files) =>
      files.map((file) => {
        const match = renamed.find(({ entry }) => entry.source_id === file.source_id);
        return match?.source
          ? {
              ...file,
              original_filename: match.source.name,
              text_filename: match.source.name,
            }
          : file;
      })
    );
  }, [rows]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (appId == null) return;
      setUploadsInFlight((n) => n + 1);
      try {
        const result = await uploadFileSource(appId, file);
        const name = result.original_filename;
        const existing = (useSurveyStore.getState().attachedFiles ?? []).some(
          (f) => entryType(f) === "file" && f.original_filename === name
        );
        if (existing) {
          // Same file name uploaded again: the content was replaced.
          await updateEntries((files) =>
            files.map((f) =>
              entryType(f) === "file" && f.original_filename === name
                ? { ...f, size: file.size, source_id: result.id, type: "file" }
                : f
            )
          );
        } else {
          await addAttachedFile({
            original_filename: name,
            text_filename: name,
            size: file.size,
            source_id: result.id,
            type: "file",
          });
        }
        await reload();
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error(apiErrorMessage(error, `Failed to upload ${file.name}`));
      } finally {
        setUploadsInFlight((n) => n - 1);
      }
    },
    [appId, addAttachedFile, reload]
  );

  const handleDroppedFile = useCallback(
    (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} is larger than 20MB`);
        return;
      }
      const name = sanitizeFileName(file.name);
      const alreadyAttached = (useSurveyStore.getState().attachedFiles ?? []).some(
        (f) => entryType(f) === "file" && f.original_filename === name
      );
      if (alreadyAttached) {
        setDuplicates((prev) => [
          ...prev.filter((d) => d.name !== name),
          { name, file },
        ]);
        return;
      }
      void uploadFile(file);
    },
    [uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted, rejected) => {
      accepted.forEach(handleDroppedFile);
      rejected.forEach(({ file, errors }) => {
        const tooLarge = errors.some((e) => e.code === "file-too-large");
        toast.error(
          tooLarge
            ? `${file.name} is larger than 20MB`
            : `${file.name} is not a supported file type`
        );
      });
    },
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: isUploading || appId == null,
  });

  const replaceDuplicate = (duplicate: PendingDuplicate) => {
    setDuplicates((prev) => prev.filter((d) => d !== duplicate));
    void uploadFile(duplicate.file);
  };

  const removeRow = async (entry: AttachedFile, source?: KnowledgeSource) => {
    if (appId == null) return;
    const key = entryKey(entry);
    await updateEntries((files) => files.filter((f) => entryKey(f) !== key));
    setDuplicates((prev) =>
      prev.filter((d) => d.name !== entry.original_filename)
    );
    try {
      if (source) {
        remove(source.id);
        await deleteSource(appId, source.id);
      } else if (entryType(entry) === "file") {
        await deleteFileByName(appId, entry.original_filename);
      }
    } catch (error) {
      // The entry is already gone from the app; a 404 just means there was nothing left to delete.
      console.error("Failed to delete knowledge base source:", error);
      void reload();
    }
  };

  const refreshRow = async (source: KnowledgeSource) => {
    if (appId == null) return;
    setRefreshingIds((prev) => [...prev, source.id]);
    try {
      const updated = await refreshSource(appId, source.id);
      upsert(updated, source.id);
      if (updated.id !== source.id) {
        await updateEntries((files) =>
          files.map((f) =>
            f.source_id === source.id ? { ...f, source_id: updated.id } : f
          )
        );
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, "This source could not be refreshed."));
    } finally {
      setRefreshingIds((prev) => prev.filter((id) => id !== source.id));
    }
  };

  const onSourceAdded = (source: KnowledgeSource) => {
    upsert(source);
    void addAttachedFile(entryFromSource(source));
  };

  const onTextSaved = (source: KnowledgeSource, previousId?: number) => {
    if (previousId == null) {
      onSourceAdded(source);
      return;
    }
    upsert(source, previousId);
    void updateEntries((files) =>
      files.map((f) =>
        f.source_id === previousId
          ? {
              ...f,
              source_id: source.id,
              original_filename: source.name,
              text_filename: source.name,
            }
          : f
      )
    );
  };

  const updateDescription = (entry: AttachedFile, description: string) => {
    const key = entryKey(entry);
    const value = description.slice(0, MAX_DESCRIPTION_LENGTH);
    void updateEntries((files) =>
      files.map((f) => (entryKey(f) === key ? { ...f, description: value } : f))
    );
  };

  const openExplorer = (sourceId: number | null) => {
    setExplorerSourceId(sourceId);
    setExplorerOpen(true);
  };

  return (
    <div
      className="border-t border-gray-200 pt-4"
      data-testid={TEST_IDS.KNOWLEDGE_SECTION}
    >
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-left text-sm font-medium uppercase text-gray-500">
          Knowledge Base
        </h3>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 cursor-help text-gray-400" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              <p className="w-[220px] text-sm">
                Give your app material to draw on: upload files, add web pages
                or websites, or paste text. The AI uses the most relevant
                parts when answering.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div
        {...getRootProps()}
        className={`
          mt-2 rounded-lg border-2 border-dashed p-4 transition-colors duration-150 ease-in-out
          ${
            isDragActive
              ? "border-primary-400 bg-primary-50"
              : isUploading
              ? "border-primary-300 bg-primary-50"
              : "border-gray-300 hover:border-primary-600"
          }
          ${isUploading ? "cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <input
          {...getInputProps()}
          data-testid={TEST_IDS.KNOWLEDGE_FILE_INPUT}
        />
        <div className="text-center">
          <Upload
            className={`mx-auto h-8 w-8 ${
              isDragActive || isUploading ? "text-primary-400" : "text-gray-400"
            }`}
          />
          <p className="mt-2 text-sm text-gray-600">
            {isDragActive
              ? "Drop files here"
              : "Drag and drop files here, or click to select files"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            PDF, Word, PowerPoint, Excel, CSV, TXT, images
          </p>
          <p className="mt-1 text-xs text-gray-500">Max file size: 20MB</p>
          {isUploading && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary-600"></div>
              <span className="text-sm text-gray-600">Uploading...</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={appId == null}
          onClick={() => setWebDialogOpen(true)}
          data-testid={TEST_IDS.KNOWLEDGE_ADD_WEB_BUTTON}
        >
          <Globe className="mr-2 h-4 w-4" />
          Add web page
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={appId == null}
          onClick={() => {
            setEditingTextId(null);
            setTextDialogOpen(true);
          }}
          data-testid={TEST_IDS.KNOWLEDGE_ADD_TEXT_BUTTON}
        >
          <Type className="mr-2 h-4 w-4" />
          Paste text
        </Button>
      </div>

      {rows.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          disabled={!canExplore}
          onClick={() => openExplorer(null)}
          data-testid={TEST_IDS.KNOWLEDGE_EXPLORE_BUTTON}
        >
          <Search className="mr-2 h-4 w-4" />
          Explore knowledge base
        </Button>
      )}

      {duplicates.map((duplicate) => (
        <div
          key={duplicate.name}
          className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700"
        >
          <p>
            <span className="font-medium">{duplicate.name}</span> is already
            attached. Replace it with the new file?
          </p>
          <div className="mt-1 flex gap-3">
            <button
              type="button"
              onClick={() => replaceDuplicate(duplicate)}
              className="text-blue-600 hover:underline"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() =>
                setDuplicates((prev) => prev.filter((d) => d !== duplicate))
              }
              className="text-gray-600 hover:underline"
            >
              Keep the current file
            </button>
          </div>
        </div>
      ))}

      {rows.length > 0 && (
        <div className="mt-4 space-y-4">
          {rows.map(({ entry, source }) => {
            const type = source?.type ?? entryType(entry);
            const name = source?.name ?? entry.original_filename;
            const url = source?.url ?? entry.url;
            const status = source?.status;
            const wordCount = source?.word_count ?? entry.word_count;
            const isRefreshing = source ? refreshingIds.includes(source.id) : false;
            const isWorking = status === "pending" || status === "processing";
            const hasChunks = (source?.chunk_count ?? 0) > 0;

            const details: string[] = [];
            if (type === "file") {
              details.push(`${(entry.size / 1024 / 1024).toFixed(2)} MB`);
            } else if (type === "website" && source?.page_count) {
              details.push(
                `${source.page_count} ${source.page_count === 1 ? "page" : "pages"}`
              );
            } else {
              details.push(SOURCE_TYPE_LABELS[type]);
            }
            if (wordCount) details.push(`${wordCount.toLocaleString()} words`);
            if (source?.last_fetched_at) {
              details.push(`Fetched ${formatDate(source.last_fetched_at)}`);
            }

            let workingLabel = status === "pending" ? "Queued…" : "Processing…";
            if (status === "processing" && source?.progress) {
              workingLabel = `Reading pages… ${source.progress.pages_done} of about ${source.progress.pages_total}`;
            }

            return (
              <div
                key={entryKey(entry)}
                className="space-y-2"
                data-testid={TEST_IDS.KNOWLEDGE_SOURCE_ROW}
              >
                <div className="flex items-start justify-between gap-2 rounded-lg bg-gray-50 p-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <SourceTypeIcon
                      type={type}
                      className="mt-0.5 h-5 w-5 shrink-0 text-gray-400"
                    />
                    <div className="min-w-0">
                      <p
                        className="break-words text-sm font-medium text-gray-700"
                        title={name}
                      >
                        {name}
                      </p>
                      {url && url !== name && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-primary-600 hover:underline"
                          title={url}
                        >
                          {url}
                        </a>
                      )}
                      <p className="text-xs text-gray-500">
                        {details.join(" • ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {hasChunks && source && (
                      <RowAction
                        label="See the text that was picked up"
                        onClick={() => openExplorer(source.id)}
                      >
                        <Search className="h-4 w-4 text-gray-500" />
                      </RowAction>
                    )}
                    {source && (type === "webpage" || type === "website") && (
                      <RowAction
                        label="Refresh: read this address again"
                        disabled={isWorking || isRefreshing}
                        onClick={() => void refreshRow(source)}
                      >
                        <RefreshCw
                          className={`h-4 w-4 text-gray-500 ${
                            isWorking || isRefreshing ? "animate-spin" : ""
                          }`}
                        />
                      </RowAction>
                    )}
                    {source && type === "text" && (
                      <RowAction
                        label="Edit text"
                        disabled={isWorking}
                        onClick={() => {
                          setEditingTextId(source.id);
                          setTextDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 text-gray-500" />
                      </RowAction>
                    )}
                    <RowAction
                      label="Remove from knowledge base"
                      onClick={() => void removeRow(entry, source)}
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </RowAction>
                  </div>
                </div>

                {(isWorking || status === "ready") && (
                  <div className="space-y-1">
                    <div className="h-0.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width:
                            status === "pending"
                              ? "30%"
                              : status === "processing"
                              ? "85%"
                              : "100%",
                          backgroundColor:
                            status === "ready" ? "#22c55e" : "#3b82f6",
                          transition:
                            status === "processing"
                              ? "width 8s linear"
                              : "width 0.4s ease",
                        }}
                      />
                    </div>
                    <span
                      className={`block text-xs ${
                        status === "ready" ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {isWorking
                        ? workingLabel
                        : `✓ Ready${
                            source?.chunk_count
                              ? ` • ${source.chunk_count} ${
                                  source.chunk_count === 1 ? "chunk" : "chunks"
                                }`
                              : ""
                          }`}
                    </span>
                  </div>
                )}
                {status === "failed" && (
                  <span className="block text-xs text-red-600">
                    ✕ Failed{source?.error ? `: ${source.error}` : ""}
                  </span>
                )}
                {source?.warning && status !== "failed" && (
                  <span className="block text-xs text-amber-600">
                    {source.warning}
                  </span>
                )}
                {type === "website" &&
                  status === "ready" &&
                  (source?.failed_pages?.length ?? 0) > 0 && (
                    <span className="block text-xs text-gray-500">
                      {source?.failed_pages?.length}{" "}
                      {source?.failed_pages?.length === 1 ? "page" : "pages"}{" "}
                      could not be read.
                    </span>
                  )}
                {loaded && !source && (
                  <span className="block text-xs text-amber-600">
                    This item is no longer in the knowledge base. Remove it and
                    add it again.
                  </span>
                )}

                <div className="relative">
                  <Input
                    type="text"
                    value={entry.description || ""}
                    onChange={(e) => updateDescription(entry, e.target.value)}
                    placeholder={DESCRIPTION_PLACEHOLDERS[type]}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    className="pr-12 text-sm"
                  />
                  <div className="absolute bottom-1 right-2 text-xs text-gray-400">
                    {entry.description?.length || 0}/{MAX_DESCRIPTION_LENGTH}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {appId != null && (
        <>
          <AddWebSourceDialog
            appId={appId}
            open={webDialogOpen}
            onOpenChange={setWebDialogOpen}
            onAdded={onSourceAdded}
          />
          <PasteTextDialog
            appId={appId}
            open={textDialogOpen}
            onOpenChange={setTextDialogOpen}
            editingSourceId={editingTextId}
            onSaved={onTextSaved}
          />
          <KnowledgeExplorerDialog
            appId={appId}
            open={explorerOpen}
            onOpenChange={setExplorerOpen}
            sources={attachedSources}
            initialSourceId={explorerSourceId}
          />
        </>
      )}
    </div>
  );
}

function RowAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-full p-1 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
