#!/usr/bin/env node

/**
 * Batch image processor for WPCNA neighborhood photos.
 *
 * Reads every image from ./raw-images, converts to .webp,
 * resizes to a 1200px max width, sanitizes filenames, and
 * writes production-ready files to src/assets/images/neighborhoods.
 *
 * Usage:  node scripts/process-images.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// ── Config ──────────────────────────────────────────────────────────
const INPUT_DIR = path.resolve("raw-images");
const OUTPUT_DIR = path.resolve("src/assets/images/neighborhoods");

const MAX_WIDTH = 1200;
const WEBP_QUALITY = 80; // good balance of size vs. fidelity

const IMAGE_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".tif", ".tiff",
  ".gif", ".bmp", ".webp", ".avif", ".svg",
]);

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Turn a messy Wikimedia / Google download filename into a clean,
 * lowercase, hyphenated slug.
 *
 *   "Fisher_Hill_(aerial_view)_-_Wikimedia_Commons_2024.jpg"
 *   → "fisher-hill-aerial-view"
 */
function sanitize(name) {
  return (
    name
      // Drop the extension — we'll add .webp later
      .replace(/\.[^.]+$/, "")
      // Strip common Wikimedia / Google junk suffixes
      .replace(/[-_]+(wikimedia|commons|google|images|wikipedia|upload|thumb|original|(\d{3,4}px))/gi, "")
      // Remove resolution tags like 1280x720
      .replace(/\d{3,4}x\d{3,4}/g, "")
      // Remove isolated long numeric strings (timestamps, IDs)
      .replace(/[-_]?\b\d{6,}\b/g, "")
      // Convert separators to hyphens
      .replace(/[_\s]+/g, "-")
      // Strip anything that isn't alphanumeric or a hyphen
      .replace(/[^a-z0-9-]/gi, "")
      // Collapse repeated hyphens
      .replace(/-{2,}/g, "-")
      // Trim leading/trailing hyphens
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
  );
}

/**
 * Deduplicate output filenames by appending -1, -2, … when collisions
 * occur within the same batch run.
 */
function dedup(slug, seen) {
  if (!seen.has(slug)) {
    seen.add(slug);
    return slug;
  }
  let i = 1;
  while (seen.has(`${slug}-${i}`)) i++;
  const unique = `${slug}-${i}`;
  seen.add(unique);
  return unique;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  // Ensure dirs exist
  try {
    await fs.access(INPUT_DIR);
  } catch {
    console.error(`\n  Input directory not found: ${INPUT_DIR}`);
    console.error("  Create it and drop your raw images inside, then re-run.\n");
    process.exit(1);
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Gather image files (flat + one level of subdirectories)
  const entries = await fs.readdir(INPUT_DIR, { withFileTypes: true, recursive: true });
  const files = entries
    .filter((e) => e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(e.parentPath ?? e.path, e.name));

  if (files.length === 0) {
    console.log("No images found in", INPUT_DIR);
    return;
  }

  console.log(`\nProcessing ${files.length} images …\n`);

  const seen = new Set();
  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const raw = path.basename(file);
    const slug = dedup(sanitize(raw), seen);
    const outFile = path.join(OUTPUT_DIR, `${slug}.webp`);

    try {
      const img = sharp(file);
      const meta = await img.metadata();

      let pipeline = img;

      // Only downscale — never upscale
      if (meta.width && meta.width > MAX_WIDTH) {
        pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
      }

      await pipeline
        .webp({ quality: WEBP_QUALITY })
        .toFile(outFile);

      const stat = await fs.stat(outFile);
      const kb = (stat.size / 1024).toFixed(0);
      console.log(`  ✓  ${raw}  →  ${slug}.webp  (${kb} KB)`);
      ok++;
    } catch (err) {
      console.error(`  ✗  ${raw}  — ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} processed, ${fail} failed.`);
  console.log(`Output: ${OUTPUT_DIR}\n`);
}

main();
