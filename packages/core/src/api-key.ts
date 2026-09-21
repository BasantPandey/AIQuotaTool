/**
 * Normalize a user-pasted provider API key.
 * Returns null when the value is empty, multi-line, or an implausible length.
 * Does not check a vendor prefix — key formats change.
 */
export function normalizeApiKey(raw: string): string | null {
  let trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  trimmed = trimmed.replace(/^Bearer\s+/i, '').trim();
  if (trimmed.length < 8 || trimmed.length > 256) return null;
  if (/\s/.test(trimmed)) return null;
  return trimmed;
}
