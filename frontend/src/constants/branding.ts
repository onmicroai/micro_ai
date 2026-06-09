const DEFAULT_LOGO_FILENAME = "logo.svg";
const DEFAULT_PLATFORM_NAME = "Micro AI";

/**
 * Public URL path for the platform logo.
 * Set NEXT_PUBLIC_LOGO_FILENAME to swap logos per deployment (file must exist in /public).
 * Accepts a filename (e.g. "acme-logo.svg") or a path (e.g. "/img/acme-logo.svg").
 */
function resolveLogoSrc(): string {
  const value =
    process.env.NEXT_PUBLIC_LOGO_FILENAME?.trim() || DEFAULT_LOGO_FILENAME;
  return value.startsWith("/") ? value : `/${value}`;
}

export const LOGO_SRC = resolveLogoSrc();

/** Display name for the platform (logo alt text, headings, etc.). */
export const PLATFORM_NAME =
  process.env.NEXT_PUBLIC_PLATFORM_NAME?.trim() || DEFAULT_PLATFORM_NAME;

export const LOGO_ALT = PLATFORM_NAME;
