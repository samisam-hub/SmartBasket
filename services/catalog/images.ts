/** Shared URL validation; independent of any catalog provider. */
export function safeImageUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
/** Resolution suitability, not a claim about focus, lighting or packaging accuracy. */
export function imageSuitable(width: number | null, height: number | null, large: boolean): boolean {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return false;
  return Math.max(width, height) >= (large ? 600 : 240) && Math.min(width, height) >= (large ? 200 : 120);
}
