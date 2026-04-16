#!/usr/bin/env node

/**
 * Download usable Wikimedia images for the remaining placeholder neighborhoods.
 * These are landmark/nearby photos that can represent each neighborhood.
 */

import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import https from "node:https";

const OUTPUT_DIR = path.resolve("raw-images");

// Curated list: only photos actually relevant to White Plains neighborhoods
const DOWNLOADS = [
  {
    slug: "north-street",
    localFilename: "wp-white-plains-high-school.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:White_Plains_High_School_(NY)_northwestern_wing,_June_2025.jpg",
    altText: "White Plains High School on North Street.",
    photographer: "Wikimedia contributor",
    license: "CC BY-SA 4.0",
  },
  {
    slug: "fulton-street",
    localFilename: "wp-county-center.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Bike_Sunday_in_front_of_Westchester_County_Center_jeh.jpg",
    altText: "Westchester County Center near Fulton Street.",
    photographer: "Jim Henderson",
    license: "CC0 1.0",
  },
  {
    slug: "eastview",
    localFilename: "wp-pace-university-law.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Elisabeth_Haub_School_of_Law_-_Pace_University_(52641711048).jpg",
    altText: "Elisabeth Haub School of Law at Pace University, near the Eastview neighborhood.",
    photographer: "ajay_suresh",
    license: "CC BY 2.0",
  },
  {
    slug: "old-mamaroneck-road",
    localFilename: "wp-peoples-bank-mamaroneck.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Peoples_National_Bank_and_Trust_Company_Building_31_Mamaroneck_Av_jeh.jpg",
    altText: "Peoples National Bank building on Mamaroneck Avenue.",
    photographer: "Jim Henderson",
    license: "CC0 1.0",
  },
  {
    slug: "rosedale",
    localFilename: "wp-saxon-woods-pool-2.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Saxon_Woods_Bathing_Pool,_White_Plains,_New_York._LOC_gsc.5a26870.jpg",
    altText: "Saxon Woods Bathing Pool near the Rosedale neighborhood.",
    photographer: "Library of Congress",
    license: "Public Domain",
  },
];

function fetch(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "WPCNA-ImageBot/1.0" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
        return resolve(fetch(res.headers.location, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      resolve(res);
    }).on("error", reject);
  });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

async function resolveWikimediaUrl(filePageUrl) {
  const match = filePageUrl.match(/\/wiki\/File:(.+)$/);
  if (!match) throw new Error(`Cannot parse: ${filePageUrl}`);
  const title = `File:${decodeURIComponent(match[1])}`;
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json`;
  const data = await fetchJSON(apiUrl);
  const page = Object.values(data.query.pages)[0];
  if (!page.imageinfo?.[0]?.url) throw new Error(`No URL for ${title}`);
  return page.imageinfo[0].url;
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  const ws = createWriteStream(dest);
  return new Promise((resolve, reject) => {
    res.pipe(ws);
    ws.on("finish", resolve);
    ws.on("error", reject);
  });
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`\nDownloading ${DOWNLOADS.length} landmark images...\n`);

  for (const d of DOWNLOADS) {
    const dest = path.join(OUTPUT_DIR, d.localFilename);
    try {
      await fs.access(dest);
      console.log(`  ⏭  ${d.localFilename} (exists)`);
      continue;
    } catch {}

    try {
      process.stdout.write(`  ⬇  ${d.slug} … `);
      const url = await resolveWikimediaUrl(d.sourceUrl);
      await downloadFile(url, dest);
      const stat = await fs.stat(dest);
      console.log(`${d.localFilename} (${(stat.size/1024).toFixed(0)} KB)`);
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.log(`FAILED — ${e.message}`);
    }
  }
  console.log("\nDone.\n");
}

main();
