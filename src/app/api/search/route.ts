import { NextRequest, NextResponse } from "next/server";
import {
  TrackResult,
  RESOURCES,
  isNoise,
  scoreRelevance,
  detectFormat,
} from "@/lib/tracks";

export const maxDuration = 60; // Vercel: allow up to 60s

// ─── Web Search ────────────────────────────────────────────────────────

interface SearchHit {
  url: string;
  name: string;
  snippet: string;
}

async function webSearch(query: string, num: number = 8): Promise<SearchHit[]> {
  const searchApiUrl = process.env.SEARCH_API_URL;
  if (!searchApiUrl) {
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

// ─── Page Scraper: extracts download links from HTML ───────────────────

interface ScrapedDownload {
  url: string;
  format: string | null;
  context: string; // nearby text describing the link
}

async function scrapeDownloadLinks(pageUrl: string): Promise<ScrapedDownload[]> {
  const results: ScrapedDownload[] = [];

  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GPSTrackFinder/1.0)",
      },
    });
    if (!res.ok) return results;

    const html = await res.text();
    const baseUrl = new URL(pageUrl).origin;

    // Pattern 1: Direct GPX/KML/KMZ file links
    const filePattern = /href=["']([^"']*\.(gpx|kml|kmz))["']/gi;
    let match;
    while ((match = filePattern.exec(html)) !== null) {
      let url = match[1];
      if (url.startsWith("/")) url = baseUrl + url;
      else if (!url.startsWith("http")) url = baseUrl + "/" + url;
      results.push({ url, format: match[2].toUpperCase(), context: "" });
    }

    // Pattern 2: Yandex.Disk shared links (yadi.sk or disk.yandex.ru)
    const yandexPattern = /href=["'](https?:\/\/(?:yadi\.sk\/d\/|disk\.yandex\.[a-z]+\/d\/)[^"']+)["']/gi;
    while ((match = yandexPattern.exec(html)) !== null) {
      // Find nearby text to describe the link
      const linkStart = match.index;
      const before = html.slice(Math.max(0, linkStart - 500), linkStart);
      const after = html.slice(linkStart, linkStart + 200);
      const contextMatch = before.match(
        /(?:Маршрут|Большой|LongWay|Поездка|Карелия|Кавказ|Алтай|Байкал|Карельск|озер|озёр|трек)[^<]{0,150}/i
      );
      const nameMatch = before.match(/<(?:strong|b|h[1-6])[^>]*>([^<]+)<\/(?:strong|b|h[1-6])>/);
      const context = contextMatch?.[0] || nameMatch?.[1] || "";
      results.push({ url: match[1], format: "GPX (архив)", context: context.trim() });
    }

    // Pattern 3: Google Drive shared links
    const gdrivePattern = /href=["'](https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)[^"']+)["']/gi;
    while ((match = gdrivePattern.exec(html)) !== null) {
      results.push({ url: match[1], format: "GPX (Google Drive)", context: "" });
    }

    // Pattern 4: Cloud Mail.ru links
    const cloudPattern = /href=["'](https?:\/\/cloud\.mail\.ru\/[^"']+)["']/gi;
    while ((match = cloudPattern.exec(html)) !== null) {
      results.push({ url: match[1], format: "GPX (Облако Mail.ru)", context: "" });
    }

    // Pattern 5: GPSies/Komoot track links
    const gpsiesPattern = /href=["'](https?:\/\/(?:www\.)?(?:gpsies|komoot)\.com\/[^"']+)["']/gi;
    while ((match = gpsiesPattern.exec(html)) !== null) {
      if (match[1].includes("map.do") || match[1].includes("/tour/")) {
        results.push({ url: match[1], format: "GPX (GPSies/Komoot)", context: "" });
      }
    }
  } catch {
    // Silently fail — scraping is best-effort
  }

  return results;
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

  // General queries (no site: filter) — these often find the best results
  const generalResource = { name: "Общий поиск", site: "", priority: 99, needsReg: false };
  queries.push({
    resource: generalResource,
    query: `${region} GPS трек GPX скачать маршрут автомобильный`,
  });
  queries.push({
    resource: generalResource,
    query: `${region} трек навигация GPX KMZ автопутешествие`,
  });
  // Add query for Yandex.Disk shared GPX files
  queries.push({
    resource: generalResource,
    query: `${region} GPS трек GPX скачать яндекс диск`,
  });

  // Execute searches
  const allTracks: TrackResult[] = [];
  const seenUrls = new Set<string>();
  const pagesToScrape: string[] = []; // Pages to scrape for download links

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
      // Detect Yandex.Disk link in snippet
      const yandexMatch = hit.snippet.match(/https?:\/\/yadi\.sk\/d\/[A-Za-z0-9_\-]+/i);
      const downloadUrl = dlMatch?.[0] || yandexMatch?.[0] || null;

      const track: TrackResult = {
        title: hit.name || "Без названия",
        source: resource.name,
        url: hit.url,
        downloadUrl,
        author: null,
        description: hit.snippet ? hit.snippet.slice(0, 300) : null,
        format: downloadUrl
          ? dlMatch
            ? detectFormat(downloadUrl)
            : "GPX (Яндекс.Диск)"
          : null,
        available: null,
        needsRegistration: resource.needsReg,
        relevanceScore: 0,
      };

      track.relevanceScore = scoreRelevance(track, region);
      allTracks.push(track);

      // If no download URL found, mark page for scraping
      if (!downloadUrl && hit.url.startsWith("http")) {
        pagesToScrape.push(hit.url);
      }
    }
  }

  // ─── Phase 2: Scrape promising pages for download links ──────────────
  // Scrape up to 5 most relevant pages that don't have download URLs yet
  const tracksNeedingDl = allTracks
    .filter((t) => !t.downloadUrl)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);

  if (tracksNeedingDl.length > 0) {
    const scrapeResults = await Promise.allSettled(
      tracksNeedingDl.map(async (track) => {
        const downloads = await scrapeDownloadLinks(track.url);
        return { track, downloads };
      })
    );

    for (const result of scrapeResults) {
      if (result.status !== "fulfilled") continue;
      const { track, downloads } = result.value;
      if (downloads.length > 0) {
        // Use the first download link found
        const best = downloads[0];
        track.downloadUrl = best.url;
        track.format = best.format || detectFormat(best.url);
        // If we found a context description, use it
        if (best.context && (!track.description || track.description.length < 20)) {
          track.description = best.context.slice(0, 300);
        }
        // Boost relevance for having a direct download
        track.relevanceScore += 2.0;
      }
    }

    // Also create separate entries for additional download links found on scraped pages
    for (const result of scrapeResults) {
      if (result.status !== "fulfilled") continue;
      const { track, downloads } = result.value;
      for (let i = 1; i < downloads.length && allTracks.length < limit * 3; i++) {
        const dl = downloads[i];
        if (seenUrls.has(dl.url)) continue;
        seenUrls.add(dl.url);
        const newTrack: TrackResult = {
          title: dl.context || track.title,
          source: track.source,
          url: track.url,
          downloadUrl: dl.url,
          author: null,
          description: dl.context ? dl.context.slice(0, 300) : track.description,
          format: dl.format || detectFormat(dl.url),
          available: null,
          needsRegistration: track.needsRegistration,
          relevanceScore: track.relevanceScore + 1.5, // Extra boost for direct link
        };
        allTracks.push(newTrack);
      }
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
