#!/usr/bin/env node

/**
 * Downloads hero images from Wikimedia Commons for WPCNA neighborhoods.
 *
 * Reads neighborhood-heroes.json, filters entries with real Wikimedia
 * source URLs, resolves each to a direct download link via the
 * Wikimedia API, and saves the file into ./raw-images/.
 *
 * Usage:  node scripts/download-heroes.mjs
 */

import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import https from "node:https";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const HEROES_PATH = path.resolve("src/_data/neighborhood-heroes.json");
const OUTPUT_DIR = path.resolve("raw-images");

// Only download entries whose sourceUrl is a unique Wikimedia Commons file page
const GENERIC_URL = "https://commons.wikimedia.org/wiki/File:City_of_White_Plains,_Jul_2012.jpg";

// ── Helpers ─────────────────────────────────────────────────────────

/** Promisified https.get that follows redirects (up to 5). */
function fetch(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "WPCNA-ImageBot/1.0 (civic site; contact: dev@wpcna.org)" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
        return resolve(fetch(res.headers.location, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      resolve(res);
    }).on("error", reject);
  });
}

/** Fetch JSON from a URL. */
async function fetchJSON(url) {
  const res = await fetch(url);
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

/** Download a URL to a local file path. */
async function downloadFile(url, dest) {
  const res = await fetch(url);
  const ws = createWriteStream(dest);
  return new Promise((resolve, reject) => {
    res.pipe(ws);
    ws.on("finish", () => resolve());
    ws.on("error", reject);
  });
}

/**
 * Given a Wikimedia Commons file-page URL like
 *   https://commons.wikimedia.org/wiki/File:Foo_bar.jpg
 * return the direct image download URL via the API.
 */
async function resolveWikimediaUrl(filePageUrl) {
  const match = filePageUrl.match(/\/wiki\/File:(.+)$/);
  if (!match) throw new Error(`Cannot parse file page URL: ${filePageUrl}`);

  const title = `File:${decodeURIComponent(match[1])}`;
  const apiUrl =
    `https://commons.wikimedia.org/w/api.php` +
    `?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=imageinfo&iiprop=url&format=json`;

  const data = await fetchJSON(apiUrl);
  const pages = data.query.pages;
  const page = Object.values(pages)[0];

  if (!page.imageinfo || !page.imageinfo[0]?.url) {
    throw new Error(`No image URL found for ${title}`);
  }

  return page.imageinfo[0].url;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const heroes = require(HEROES_PATH);

  const toDownload = heroes.filter((h) =>
    h.sourceUrl.startsWith("https://commons.wikimedia.org/wiki/File:") &&
    h.sourceUrl !== GENERIC_URL &&
    !h.localFilename.startsWith("generated/") &&
    !h.localFilename.startsWith("photos/")
  );

  console.log(`\nFound ${toDownload.length} images to download.\n`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let ok = 0;
  let fail = 0;

  for (const hero of toDownload) {
    const outName = hero.localFilename;
    const dest = path.join(OUTPUT_DIR, outName);

    // Skip if already downloaded
    try {
      await fs.access(dest);
      console.log(`  ⏭  ${outName}  (already exists, skipping)`);
      ok++;
      continue;
    } catch {
      // file doesn't exist yet — proceed
    }

    try {
      process.stdout.write(`  ⬇  ${hero.slug} … `);
      const directUrl = await resolveWikimediaUrl(hero.sourceUrl);
      await downloadFile(directUrl, dest);

      const stat = await fs.stat(dest);
      const kb = (stat.size / 1024).toFixed(0);
      console.log(`${outName}  (${kb} KB)`);
      ok++;

      // Be polite to Wikimedia — small delay between requests
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.log(`FAILED — ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} downloaded, ${fail} failed.`);
  console.log(`Output: ${OUTPUT_DIR}\n`);
}

main();
