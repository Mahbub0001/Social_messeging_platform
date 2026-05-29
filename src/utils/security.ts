/**
 * Sanitizes URLs to prevent XSS attacks (e.g., javascript:, data:text/html, etc.).
 * Only allows safe protocols: http, https, and blob (for voice recordings).
 */
export const sanitizeUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  const trimmed = url.trim();
  
  // Prevent javascript:, data:, vbscript: protocols
  if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) {
    return "about:blank";
  }
  
  // Only allow http, https, and blob protocols
  if (/^((https?|blob):)/i.test(trimmed)) {
    return trimmed;
  }
  
  // If it's a relative URL, allow it
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return trimmed;
  }
  
  return "about:blank";
};

/**
 * Escapes HTML characters for extra safety (defense-in-depth).
 * (Note: React handles this automatically in standard JSX, but this is useful for raw logs/texts).
 */
export const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
