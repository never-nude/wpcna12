#!/usr/bin/env node

/**
 * Search Wikimedia Commons for landmark photos near placeholder neighborhoods.
 */

import https from "node:https";

const SEARCHES = [
  // Prospect Park — nearby landmarks
  { slug: "prospect-park", search: "St. Bartholomew's Church White Plains" },
  { slug: "prospect-park", search: "Druss Park White Plains playground" },

  // Eastview — Westchester County Center is nearby
  { slug: "eastview", search: "Westchester County Center White Plains" },
  { slug: "eastview", search: "Pace University White Plains" },

  // North Street — White Plains High School
  { slug: "north-street", search: "White Plains High School" },

  // Bryant Gardens — garden cooperative
  { slug: "bryant-gardens", search: "Burke Rehabilitation White Plains" },

  // Rosedale / Saxon Woods area
  { slug: "rosedale", search: "Saxon Woods Park Westchester" },
  { slug: "rosedale", search: "Saxon Woods pool White Plains" },

  // Soundview — residential area
  { slug: "soundview", search: "Highlands Middle School White Plains" },
  { slug: "soundview", search: "White Plains Middle School" },

  // Gedney Farms area — broad Gedney search
  { slug: "gedney-park", search: "Gedney Farm White Plains" },
  { slug: "gedney-park", search: "Ridgeway White Plains residential" },

  // Fulton Street — west side
  { slug: "fulton-street", search: "Westchester County Center White Plains building" },

  // Ferris Avenue
  { slug: "ferris-avenue", search: "Bronx River Parkway White Plains" },
  { slug: "ferris-avenue", search: "Bronx River White Plains bridge" },

  // Old Mamaroneck Road
  { slug: "old-mamaroneck-road", search: "Mamaroneck Avenue White Plains" },

  // Colonial Corners / Idle Forest area
  { slug: "colonial-corners", search: "Greenacres Elementary School White Plains" },
  { slug: "idle-forest", search: "Parker Stadium White Plains" },

  // General White Plains residential
  { slug: "general", search: "White Plains New York residential neighborhood" },
  { slug: "general", search: "White Plains New York suburban street" },
  { slug: "general", search: "White Plains New York houses" },
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
    srnamespace: "6",
    srlimit: String(limit),
    format: "json",
  });
  const url = `https://commons.wikimedia.org/w/api.php?${params}`;
  const data = await fetchJSON(url);
  return (data.query?.search || []).map((r) => ({
    title: r.title.replace("File:", ""),
    pageUrl: `https://commons.wikimedia.org/wiki/${r.title.replace(/ /g, "_")}`,
    snippet: r.snippet.replace(/<[^>]+>/g, "").substring(0, 100),
  }));
}

async function main() {
  console.log("Searching for landmark photos near neighborhoods...\n");

  for (const s of SEARCHES) {
    process.stdout.write(`  [${s.slug}] "${s.search}" … `);
    try {
      const hits = await searchCommons(s.search);
      const images = hits.filter((h) =>
        /\.(jpg|jpeg|png|webp)$/i.test(h.title)
      );
      console.log(`${images.length} image(s)`);
      for (const img of images.slice(0, 2)) {
        console.log(`       → ${img.title}`);
        console.log(`         ${img.pageUrl}`);
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

main();
