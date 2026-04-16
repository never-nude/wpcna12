#!/usr/bin/env node

/**
 * Search Wikimedia Commons for photos matching each neighborhood.
 * Outputs a JSON report of what was found.
 */

import https from "node:https";

const NEIGHBORHOODS = [
  { slug: "fulton-street", search: "Fulton Street White Plains New York" },
  { slug: "ferris-avenue", search: "Ferris Avenue White Plains New York" },
  { slug: "prospect-park", search: "Prospect Park White Plains New York" },
  { slug: "westminster-ridge", search: "Westminster White Plains New York" },
  { slug: "woodcrest-heights", search: "Woodcrest White Plains New York" },
  { slug: "eastview", search: "Eastview White Plains New York" },
  { slug: "old-oak-ridge", search: "Old Oak Ridge White Plains New York" },
  { slug: "old-mamaroneck-road", search: "Old Mamaroneck Road White Plains" },
  { slug: "bryant-gardens", search: "Bryant Gardens White Plains New York" },
  { slug: "havilands-manor", search: "Havilands Manor White Plains New York" },
  { slug: "north-street", search: "North Street White Plains New York" },
  { slug: "gedney-park", search: "Gedney Park White Plains New York" },
  { slug: "gedney-circle", search: "Gedney White Plains New York" },
  { slug: "gedney-commons", search: "Gedney Commons White Plains" },
  { slug: "gedney-manor", search: "Gedney Manor White Plains" },
  { slug: "gedney-meadows", search: "Gedney Meadows White Plains" },
  { slug: "brook-hills", search: "Brook Hills White Plains New York" },
  { slug: "holbrooke", search: "Holbrooke White Plains New York" },
  { slug: "reynal-park", search: "Reynal Park White Plains New York" },
  { slug: "colonial-corners", search: "Colonial Corners White Plains" },
  { slug: "soundview", search: "Soundview White Plains New York" },
  { slug: "rosedale", search: "Rosedale White Plains New York" },
  { slug: "idle-forest", search: "Idle Forest White Plains New York" },
];

// Also search broader terms for neighborhoods that will likely have no results
const FALLBACK_SEARCHES = [
  { slug: "fulton-street", search: "White Plains New York residential street" },
  { slug: "prospect-park", search: "Druss Park White Plains" },
  { slug: "eastview", search: "Westchester County Center White Plains" },
  { slug: "north-street", search: "White Plains High School New York" },
  { slug: "gedney-park", search: "Gedney Way White Plains" },
  { slug: "rosedale", search: "Saxon Woods White Plains" },
  { slug: "bryant-gardens", search: "Bryant Crescent White Plains cooperative" },
  { slug: "old-mamaroneck-road", search: "Mamaroneck Avenue White Plains" },
];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "WPCNA-Search/1.0" } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function searchCommons(query, limit = 5) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srnamespace: "6", // File namespace
    srlimit: String(limit),
    format: "json",
  });
  const url = `https://commons.wikimedia.org/w/api.php?${params}`;
  const data = await fetchJSON(url);
  return (data.query?.search || []).map((r) => ({
    title: r.title.replace("File:", ""),
    pageUrl: `https://commons.wikimedia.org/wiki/${r.title.replace(/ /g, "_")}`,
    snippet: r.snippet.replace(/<[^>]+>/g, ""),
  }));
}

async function main() {
  console.log("Searching Wikimedia Commons for 23 neighborhoods...\n");

  const results = {};

  for (const n of NEIGHBORHOODS) {
    process.stdout.write(`  ${n.slug} … `);
    try {
      const hits = await searchCommons(n.search);
      // Filter to likely image files
      const images = hits.filter((h) =>
        /\.(jpg|jpeg|png|tif|tiff|webp)$/i.test(h.title)
      );
      results[n.slug] = { primary: images, fallback: [] };
      console.log(`${images.length} image(s)`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      results[n.slug] = { primary: [], fallback: [] };
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  // Fallback searches for neighborhoods with 0 results
  console.log("\nRunning fallback searches...\n");
  for (const f of FALLBACK_SEARCHES) {
    if (results[f.slug]?.primary.length === 0) {
      process.stdout.write(`  ${f.slug} (fallback) … `);
      try {
        const hits = await searchCommons(f.search);
        const images = hits.filter((h) =>
          /\.(jpg|jpeg|png|tif|tiff|webp)$/i.test(h.title)
        );
        results[f.slug].fallback = images;
        console.log(`${images.length} image(s)`);
      } catch (e) {
        console.log(`ERROR: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Print summary
  console.log("\n═══ RESULTS SUMMARY ═══\n");
  for (const [slug, data] of Object.entries(results)) {
    const total = data.primary.length + data.fallback.length;
    const icon = total > 0 ? "✓" : "✗";
    console.log(`  ${icon}  ${slug} — ${data.primary.length} primary, ${data.fallback.length} fallback`);
    for (const img of [...data.primary, ...data.fallback].slice(0, 2)) {
      console.log(`       → ${img.title}`);
      console.log(`         ${img.pageUrl}`);
    }
  }

  // Count
  const found = Object.values(results).filter((d) => d.primary.length + d.fallback.length > 0).length;
  const missing = Object.values(results).filter((d) => d.primary.length + d.fallback.length === 0).length;
  console.log(`\nFound images for ${found}/23 neighborhoods. ${missing} still need manual sourcing.\n`);
}

main();
