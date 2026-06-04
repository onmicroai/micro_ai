/**
 * Turn API error payloads into user-facing copy for toasts and inline errors.
 */
export async function errorMessageFromResponse(
  response: Response,
): Promise<string> {
  try {
    const payload = await response.json();
    return formatApiErrorPayload(payload, response.status);
  } catch {
    return defaultMessageForStatus(response.status);
  }
}

export function formatApiErrorPayload(
  payload: unknown,
  status?: number,
): string {
  if (payload == null) {
    return defaultMessageForStatus(status);
  }

  if (typeof payload === "string") {
    return mapKnownErrorText(payload);
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const code =
      typeof record.status === "string" ? record.status : undefined;
    const text =
      typeof record.error === "string"
        ? record.error
        : typeof record.message === "string"
          ? record.message
          : undefined;

    if (code) {
      const byCode = MESSAGE_BY_CODE[code];
      if (byCode) return byCode;
    }
    if (text) {
      return mapKnownErrorText(text);
    }
  }

  return defaultMessageForStatus(status);
}

/** @deprecated Prefer formatApiErrorPayload; kept for callers that already parsed JSON. */
export function mapKnownErrorText(raw: string): string {
  const normalized = raw.trim();
  if (
    normalized.includes("No credits remaining") ||
    normalized.includes("no_credits")
  ) {
    return MESSAGE_BY_CODE.no_credits;
  }
  if (normalized.includes("Daily usage limit exceeded")) {
    return MESSAGE_BY_CODE.guest_limit;
  }
  if (normalized.includes("app isn't available") || normalized.includes("creator has no credits")) {
    return MESSAGE_BY_CODE.owner_no_credits_public;
  }
  if (normalized.startsWith("Request failed (")) {
    return defaultMessageForStatus(
      parseInt(normalized.match(/\((\d+)\)/)?.[1] ?? "0", 10) || undefined,
    );
  }
  return normalized;
}

const MESSAGE_BY_CODE: Record<string, string> = {
  no_credits:
    "You've used all your credits for this billing period. Open Settings → Subscription to add credits or upgrade your plan.",
  owner_no_credits_public:
    "This app isn't available right now because the creator has no credits remaining. Please try again later.",
  guest_limit:
    "You've reached the guest usage limit for today. Sign in or try again tomorrow.",
  invalid_subscription:
    "This subscription can't run apps right now. Check Settings → Subscription to fix billing.",
};

function defaultMessageForStatus(status?: number): string {
  if (status === 400) {
    return "We couldn't complete that request. Please check your input and try again.";
  }
  if (status === 401 || status === 403) {
    return "You're not signed in or don't have permission to do that.";
  }
  if (status === 404) {
    return "We couldn't find what you were looking for.";
  }
  if (status && status >= 500) {
    return "Something went wrong on our side. Please try again in a moment.";
  }
  return "Something went wrong. Please try again.";
}
