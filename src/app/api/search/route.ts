import { NextRequest, NextResponse } from "next/server";
import {
  TrackResult,
  RESOURCES,
  isNoise,
  scoreRelevance,
  detectFormat,
} from "@/lib/tracks";

export const maxDuration = 60; // Vercel: allow up to 60s

// ─── Web Search via external API ───────────────────────────────────────

interface SearchHit {
  url: string;
  name: string;
  snippet: string;
}

async function webSearch(query: string, num: number = 8): Promise<SearchHit[]> {
  // Use the external search API endpoint or fallback
  const searchApiUrl = process.env.SEARCH_API_URL;
  if (!searchApiUrl) {
    // Direct SDK call via child_process (only works in Node.js runtime)
    return sdkSearch(query, num);
  }
  try {
    const res = await fetch(`${searchApiUrl}?q=${encodeURIComponent(query)}&num=${num}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function sdkSearch(query: string, num: number): Promise<SearchHit[]> {
  const { execFile } = await import("child_process");
  const argsJson = JSON.stringify({ query, num });

  return new Promise((resolve) => {
    execFile(
      "z-ai",
      ["function", "--name", "web_search", "--args", argsJson],
      { timeout: 20000, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve([]);
        try {
          // Extract JSON array from output (may have SDK banner text)
          const startIdx = stdout.indexOf("[");
          const endIdx = stdout.lastIndexOf("]");
          if (startIdx === -1 || endIdx <= startIdx) return resolve([]);
          const raw = JSON.parse(stdout.slice(startIdx, endIdx + 1));
          return resolve(
            raw.map((r: Record<string, string>) => ({
              url: r.url || "",
              name: r.name || r.title || "",
              snippet: r.snippet || "",
            }))
          );
        } catch {
          resolve([]);
        }
      }
    );
  });
}

// ─── URL availability check ────────────────────────────────────────────

async function checkUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

// ─── POST handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const region = (body.region || "").trim();
  const limit = Math.min(Math.max(body.limit || 10, 1), 30);
  const verify = body.verify !== false;

  if (!region) {
    return NextResponse.json({ error: "region is required" }, { status: 400 });
  }

  const startTime = Date.now();

  // Build search queries
  const queries: { resource: typeof RESOURCES[number]; query: string }[] = [];

  for (const resource of RESOURCES.slice(0, 6)) {
    queries.push({
      resource,
      query: `site:${resource.site} ${region} трек GPX скачать`,
    });
    queries.push({
      resource,
      query: `site:${resource.site} ${region} маршрут GPS трек`,
    });
  }

  // General queries (no site: filter)
  const generalResource = { name: "Общий поиск", site: "", priority: 99, needsReg: false };
  queries.push({
    resource: generalResource,
    query: `${region} GPS трек GPX скачать маршрут автомобильный`,
  });
  queries.push({
    resource: generalResource,
    query: `${region} трек навигация GPX KMZ автопутешествие`,
  });

  // Execute searches
  const allTracks: TrackResult[] = [];
  const seenUrls = new Set<string>();

  for (const { resource, query } of queries) {
    const hits = await webSearch(query, 6);

    for (const hit of hits) {
      if (!hit.url || seenUrls.has(hit.url)) continue;
      seenUrls.add(hit.url);

      const combined = `${hit.name} ${hit.snippet}`;
      if (isNoise(combined, hit.url)) continue;

      const relevantKeywords = [
        "gpx", "трек", "gps", "маршрут", "kmz", "kml",
        "путешествие", "навигация", "скачать", "экспедиция",
      ];
      const lower = combined.toLowerCase();
      const hasKw = relevantKeywords.some((kw) => lower.includes(kw));
      if (!hasKw) continue;

      // Detect download URL in snippet
      const dlMatch = hit.snippet.match(/https?:\/\/[^\s"'<>]+\.(gpx|kmz|kml)/i);
      const downloadUrl = dlMatch ? dlMatch[0] : null;

      const track: TrackResult = {
        title: hit.name || "Без названия",
        source: resource.name,
        url: hit.url,
        downloadUrl,
        author: null,
        description: hit.snippet ? hit.snippet.slice(0, 300) : null,
        format: downloadUrl ? detectFormat(downloadUrl) : null,
        available: null,
        needsRegistration: resource.needsReg,
        relevanceScore: 0,
      };

      track.relevanceScore = scoreRelevance(track, region);
      allTracks.push(track);
    }
  }

  // Sort by relevance
  allTracks.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const topTracks = allTracks.slice(0, limit);

  // Verify availability
  if (verify) {
    await Promise.allSettled(
      topTracks.map(async (track) => {
        const urlToCheck = track.downloadUrl || track.url;
        track.available = await checkUrl(urlToCheck);
      })
    );
  }

  const searchTimeSeconds = (Date.now() - startTime) / 1000;

  return NextResponse.json({
    region,
    tracks: topTracks,
    totalFound: allTracks.length,
    totalAvailable: topTracks.filter((t) => t.available === true).length,
    searchTimeSeconds: Math.round(searchTimeSeconds * 10) / 10,
  });
}
