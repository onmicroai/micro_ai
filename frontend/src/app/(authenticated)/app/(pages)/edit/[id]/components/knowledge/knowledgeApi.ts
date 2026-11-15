import axios from "axios";
import axiosInstance from "@/utils/axiosInstance";
import type { KnowledgeSourceType } from "@/app/(authenticated)/app/types";

export type KnowledgeSourceStatus = "pending" | "processing" | "ready" | "failed";

export interface KnowledgeSource {
  id: number;
  type: KnowledgeSourceType;
  name: string;
  url: string | null;
  status: KnowledgeSourceStatus;
  error: string | null;
  warning: string | null;
  chunk_count: number | null;
  word_count: number | null;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
  /** Websites only. */
  page_count?: number;
  failed_pages?: { url: string; error: string }[];
  progress?: { pages_done: number; pages_total: number } | null;
  /** Pasted text only, and only from getSource(). */
  text?: string;
}

export interface KnowledgeChunk {
  id: number;
  source_id: number;
  source_name: string;
  source_type: KnowledgeSourceType;
  /** Zero-based position within the source. */
  chunk_index: number;
  source_chunk_count: number;
  content: string;
  metadata: { url?: string; title?: string };
  /** Present on test-query results only. */
  similarity?: number;
}

export interface KnowledgeChunkPage {
  count: number;
  page: number;
  page_size: number;
  has_more: boolean;
  results: KnowledgeChunk[];
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 200_000;
export const MAX_SITE_PAGES = 50;

const base = (appId: number) => `/api/microapps/${appId}/knowledge`;

export const sanitizeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "");

export async function listSources(
  appId: number,
  signal?: AbortSignal
): Promise<KnowledgeSource[]> {
  const res = await axiosInstance().get(`${base(appId)}/sources/`, { signal });
  return res.data.data;
}

export async function getSource(
  appId: number,
  sourceId: number
): Promise<KnowledgeSource> {
  const res = await axiosInstance().get(`${base(appId)}/sources/${sourceId}/`);
  return res.data.data;
}

export async function uploadFileSource(
  appId: number,
  file: File
): Promise<{ id: number; original_filename: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", sanitizeFileName(file.name));
  formData.append("content_type", file.type || "application/octet-stream");
  const res = await axiosInstance().post(
    `/api/microapps/${appId}/upload-file/`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data.data;
}

export async function addWebSource(
  appId: number,
  url: string,
  mode: "page" | "site"
): Promise<KnowledgeSource> {
  const res = await axiosInstance().post(`${base(appId)}/sources/web/`, {
    url,
    mode,
  });
  return res.data.data;
}

export async function addTextSource(
  appId: number,
  title: string,
  text: string
): Promise<KnowledgeSource> {
  const res = await axiosInstance().post(`${base(appId)}/sources/text/`, {
    title,
    text,
  });
  return res.data.data;
}

export async function updateTextSource(
  appId: number,
  sourceId: number,
  changes: { title?: string; text?: string }
): Promise<KnowledgeSource> {
  const res = await axiosInstance().patch(
    `${base(appId)}/sources/${sourceId}/`,
    changes
  );
  return res.data.data;
}

export async function refreshSource(
  appId: number,
  sourceId: number
): Promise<KnowledgeSource> {
  const res = await axiosInstance().post(
    `${base(appId)}/sources/${sourceId}/refresh/`
  );
  return res.data.data;
}

export async function deleteSource(
  appId: number,
  sourceId: number
): Promise<void> {
  await axiosInstance().delete(`${base(appId)}/sources/${sourceId}/`);
}

/** For entries saved before sources had ids. */
export async function deleteFileByName(
  appId: number,
  filename: string
): Promise<void> {
  await axiosInstance().delete(`/api/microapps/${appId}/delete-file/`, {
    data: { filename },
  });
}

export async function listChunks(
  appId: number,
  sourceIds: number[],
  page: number,
  signal?: AbortSignal
): Promise<KnowledgeChunkPage> {
  const res = await axiosInstance().get(`${base(appId)}/chunks/`, {
    params: { source_ids: sourceIds.join(","), page },
    signal,
  });
  return res.data;
}

export async function searchChunks(
  appId: number,
  query: string,
  sourceIds: number[],
  signal?: AbortSignal
): Promise<KnowledgeChunk[]> {
  const res = await axiosInstance().post(
    `${base(appId)}/search/`,
    { query, source_ids: sourceIds },
    { signal }
  );
  return res.data.results;
}

/** A message from an API error that is safe to show, or the fallback. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (error.response?.status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }
  const data = error.response?.data;
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (typeof record.detail === "string") return record.detail;
  for (const value of Object.values(record)) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return fallback;
}

export function isCancelled(error: unknown): boolean {
  return axios.isCancel(error);
}
