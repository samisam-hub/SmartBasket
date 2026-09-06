import { safeImageUrl, imageSuitable } from "./images";
import type { Product } from "../../types/product";

export type ProductImages = Pick<Product, "imageUrl" | "imageThumbnailUrl" | "sourceImageUrl" | "displayImageUrl" |
  "imageSource" | "imageQuality" | "imageWidth" | "imageHeight" | "imageThumbnailWidth" | "imageThumbnailHeight">;
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const dimension = (v: unknown): number | null => {
  const n = typeof v === "number" || typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 && n <= 50000 ? n : null;
};
type Candidate = { url: string; w: number; h: number; family: string };
/** Select only explicitly identified front crops, never arbitrary uploaded/nutrition images. */
export function normalizeOffImages(p: Record<string, unknown>, code: string): ProductImages {
  const data = object(p.images), modern = object(object(data.selected).front);
  const fronts = { ...Object.fromEntries(Object.entries(data).filter(([key]) => key.startsWith("front_")).map(([key, v]) => [key.slice(6), v])), ...modern };
  const folder = code.padStart(13, "0").replace(/^(...)(...)(...)(.*)$/, "$1/$2/$3/$4");
  const candidates: Candidate[] = [];
  let unverifiedFront: string | null = null;
  const languages = [...new Set(["en", "de", String(p.lc ?? ""), ...Object.keys(fronts)])];
  for (const language of languages) {
    if (!/^[a-z]{2}$/.test(language)) continue;
    const front = object(fronts[language]);
    if (!/^\d+$/.test(String(front.rev ?? ""))) continue;
    const sizes = object(front.sizes), full = object(sizes.full);
    const fullW = dimension(full.w), fullH = dimension(full.h);
    for (const [size, metadata] of Object.entries(sizes)) {
      if (size !== "full" && !/^\d+$/.test(size)) continue;
      const url = `https://images.openfoodfacts.org/images/products/${folder}/front_${language}.${front.rev}.${size}.jpg`;
      unverifiedFront ??= url;
      const m = object(metadata), w = dimension(m.w), h = dimension(m.h);
      if (!w || !h) continue;
      // A generated variant cannot restore detail absent from its original crop.
      if (fullW && fullH && (w > fullW || h > fullH)) continue;
      candidates.push({ url, w, h, family: language });
    }
  }
  candidates.sort((a, b) => b.w * b.h - a.w * a.h);
  const best = candidates.find(c => imageSuitable(c.w, c.h, true));
  const source = best ?? candidates[0];
  const thumbnail = best ? candidates.filter(c => c.family === best.family && imageSuitable(c.w, c.h, false))
    .sort((a, b) => a.w * a.h - b.w * b.h)[0] : undefined;
  // Unverified convenience URLs are retained for provenance, never blindly displayed.
  const sourceUrl = source?.url ?? unverifiedFront ?? safeImageUrl(p.image_front_url) ?? safeImageUrl(p.image_url);
  return {
    sourceImageUrl: sourceUrl, displayImageUrl: best?.url ?? null, imageUrl: best?.url ?? null,
    imageThumbnailUrl: thumbnail && thumbnail.url !== best?.url ? thumbnail.url : null,
    imageSource: sourceUrl ? "open-food-facts" : null,
    imageQuality: best ? "usable" : source ? "low-resolution" : sourceUrl ? "unknown" : "missing",
    imageWidth: best?.w ?? source?.w ?? null, imageHeight: best?.h ?? source?.h ?? null,
    imageThumbnailWidth: thumbnail && thumbnail.url !== best?.url ? thumbnail.w : null,
    imageThumbnailHeight: thumbnail && thumbnail.url !== best?.url ? thumbnail.h : null,
  };
}
