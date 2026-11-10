import axios, { type AxiosResponse } from "axios";

/**
 * The public app payload and the visibility check are independent. The run
 * and embed layouts cannot mount the runtime until visibility returns, so
 * this starts the payload request early and lets fetchApp join it.
 *
 * A private app answers 403 here. That result stays in this module until a
 * public fetch claims it, so the 403 never lands in the survey store.
 */

export type PublicAppPrefetchResult =
  | { status: "ok"; response: AxiosResponse }
  | { status: "error"; error: unknown }
  | { status: "aborted" };

interface PrefetchSlot {
  key: string;
  claimed: boolean;
  controller: AbortController;
  promise: Promise<PublicAppPrefetchResult>;
}

let slot: PrefetchSlot | null = null;
/** Hash whose payload was already delivered. Skips a second speculative GET. */
let settledKey: string | null = null;

export function publicAppUrl(hashId: string, embedOrigin?: string): string {
  let appUrl = `/api/microapps/public/hash/${hashId}`;
  if (embedOrigin) {
    appUrl += `?embed_origin=${encodeURIComponent(embedOrigin)}`;
  }
  return appUrl;
}

function prefetchKey(hashId: string, embedOrigin?: string): string {
  return `${hashId}:${embedOrigin || ""}`;
}

function isCanceled(error: unknown): boolean {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: string }).name)
      : "";
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  return (
    name === "CanceledError" ||
    name === "AbortError" ||
    code === "ERR_CANCELED"
  );
}

function canceledError(): Error {
  const canceled = new Error("canceled");
  canceled.name = "CanceledError";
  return canceled;
}

export function prefetchPublicApp(hashId: string, embedOrigin?: string): void {
  if (!hashId || typeof window === "undefined") return;

  const key = prefetchKey(hashId, embedOrigin);
  if (slot?.key === key || settledKey === key) return;

  // Nobody is waiting on the previous speculative request (the runtime never
  // mounted). Drop it instead of letting it finish after the user has moved on.
  if (slot && !slot.claimed) {
    slot.controller.abort();
  }

  const controller = new AbortController();
  const promise = axios
    .get(publicAppUrl(hashId, embedOrigin), { signal: controller.signal })
    .then(
      (response): PublicAppPrefetchResult => ({ status: "ok", response }),
      (error: unknown): PublicAppPrefetchResult => {
        if (isCanceled(error)) return { status: "aborted" };
        return { status: "error", error };
      }
    );

  settledKey = null;
  slot = { key, claimed: false, controller, promise };
}

/**
 * Join the in-flight public fetch when one exists for this app. Otherwise
 * start the request now. A claimed prefetch is left running if a later
 * navigation replaces the slot — its caller already holds the promise.
 */
export async function loadPublicApp(
  hashId: string,
  embedOrigin: string | undefined,
  signal: AbortSignal
): Promise<AxiosResponse> {
  const key = prefetchKey(hashId, embedOrigin);
  // Several callers (a Strict Mode remount, the runtime) may join this one
  // response. `claimed` only stops a later navigation from aborting it.
  const pending = slot?.key === key ? slot.promise : null;
  if (slot?.key === key) {
    slot.claimed = true;
  }

  const result = pending
    ? await pending
    : await axios
        .get(publicAppUrl(hashId, embedOrigin), { signal })
        .then(
          (response): PublicAppPrefetchResult => ({ status: "ok", response }),
          (error: unknown): PublicAppPrefetchResult => {
            if (isCanceled(error)) return { status: "aborted" };
            return { status: "error", error };
          }
        );

  if (signal.aborted || result.status === "aborted") {
    throw canceledError();
  }
  if (result.status === "error") {
    if (pending && slot?.promise === pending) {
      slot = null;
    }
    throw result.error;
  }

  if (pending && slot?.promise === pending) {
    slot = null;
    settledKey = key;
  }
  return result.response;
}
