"use client";

import { useState, useCallback } from "react";
import {
  Search,
  MapPin,
  Download,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  Compass,
  Globe,
  Shield,
} from "lucide-react";
import {
  POPULAR_REGIONS,
  type TrackResult,
  type SearchResults,
} from "@/lib/tracks";

// ─── Status helpers ────────────────────────────────────────────────────

function StatusIcon({ available }: { available: boolean | null }) {
  if (available === true)
    return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (available === false)
    return <XCircle className="w-4 h-4 text-red-400" />;
  return <Circle className="w-4 h-4 text-stone-500" />;
}

function StatusLabel({ available }: { available: boolean | null }) {
  if (available === true) return <span className="text-emerald-400">доступна</span>;
  if (available === false) return <span className="text-red-400">недоступна</span>;
  return <span className="text-stone-500">не проверена</span>;
}

function FormatBadge({ format }: { format: string | null }) {
  if (!format) return null;
  const colors: Record<string, string> = {
    GPX: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    KMZ: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    KML: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    "ZIP/RAR": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  };
  const cls = colors[format] || "bg-stone-500/20 text-stone-300 border-stone-500/30";
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${cls}`}>
      {format}
    </span>
  );
}

// ─── Track Card ────────────────────────────────────────────────────────

function TrackCard({ track, index }: { track: TrackResult; index: number }) {
  return (
    <div
      className="animate-fade-in bg-stone-900/60 border border-stone-800 rounded-xl p-5 hover:border-stone-700 hover:bg-stone-900/80 transition-all"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-stone-100 truncate">
            {track.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-stone-400">
              <Globe className="w-3 h-3" />
              {track.source}
            </span>
            {track.needsRegistration && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-400/80">
                <Shield className="w-3 h-3" />
                регистрация
              </span>
            )}
            <FormatBadge format={track.format} />
            <span className="inline-flex items-center gap-1 text-xs">
              <StatusIcon available={track.available} />
              <StatusLabel available={track.available} />
            </span>
          </div>
        </div>
      </div>

      {track.description && (
        <p className="mt-3 text-sm text-stone-400 leading-relaxed line-clamp-3">
          {track.description}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {track.downloadUrl && (
          <a
            href={track.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Скачать трек
          </a>
        )}
        <a
          href={track.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-700 hover:border-stone-600 text-stone-300 hover:text-stone-100 text-sm font-medium rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Открыть страницу
        </a>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────

export default function HomePage() {
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(async () => {
    if (!region.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: region.trim(),
          limit: 10,
          verify: true,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Ошибка: ${res.status}`);
      }

      const data: SearchResults = await res.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка при поиске");
    } finally {
      setLoading(false);
    }
  }, [region]);

  const setRegionAndSearch = useCallback(
    (r: string) => {
      setRegion(r);
      // Auto-search after setting region
      setTimeout(() => {
        setRegion(r); // ensure state is set
      }, 0);
    },
    []
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Compass className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-stone-100 tracking-tight">
              GPS Track Finder
            </h1>
            <p className="text-xs text-stone-500">
              Поиск треков автопутешествий
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Search Section */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-stone-100 mb-2">
              Найдите GPS-треки для вашего маршрута
            </h2>
            <p className="text-stone-400 text-sm leading-relaxed">
              Укажите регион или направление — агент пройдётся по&nbsp;форумам,
              чатам и&nbsp;сайтам автопутешественников и&nbsp;найдёт доступные
              для скачивания треки в&nbsp;форматах GPX, KMZ, KML.
            </p>
          </div>

          {/* Search Input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500" />
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Алтай, Кавказ, Карелия, Кольский..."
                className="w-full pl-11 pr-4 py-3 bg-stone-900 border border-stone-700 rounded-xl text-stone-100 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                disabled={loading}
              />
            </div>
            <button
              onClick={doSearch}
              disabled={loading || !region.trim()}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 font-semibold rounded-xl transition-colors flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              {loading ? "Ищем..." : "Найти"}
            </button>
          </div>

          {/* Popular Regions */}
          <div>
            <p className="text-xs text-stone-500 mb-2">Популярные направления:</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_REGIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setRegion(r.id.charAt(0).toUpperCase() + r.id.slice(1));
                  }}
                  className="px-3 py-1.5 bg-stone-900 border border-stone-800 hover:border-stone-700 rounded-lg text-sm text-stone-300 hover:text-stone-100 transition-colors"
                >
                  {r.emoji} {r.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-12 flex flex-col items-center gap-4 text-stone-400">
            <div className="w-16 h-16 rounded-full border-4 border-stone-800 border-t-amber-500 animate-spin" />
            <p className="text-sm">
              Обходим форумы и&nbsp;сайты автопутешественников...
            </p>
            <p className="text-xs text-stone-600">
              Это может занять 20–40 секунд
            </p>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <section className="mt-8 space-y-4">
            {/* Stats bar */}
            <div className="flex items-center gap-4 text-sm text-stone-400">
              <span className="font-semibold text-stone-200">
                🗺️ Треки для: {results.region}
              </span>
              <span className="h-4 w-px bg-stone-800" />
              <span>Найдено: {results.totalFound}</span>
              <span>В топе: {results.tracks.length}</span>
              <span>Доступно: {results.totalAvailable}</span>
              <span>Время: {results.searchTimeSeconds}с</span>
            </div>

            {results.tracks.length === 0 ? (
              <div className="mt-8 p-8 bg-stone-900/40 border border-stone-800 rounded-xl text-center">
                <p className="text-stone-400">
                  Треки не найдены. Попробуйте другое направление или уточните запрос.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.tracks.map((track, i) => (
                  <TrackCard key={track.url} track={track} index={i} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-800 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-xs text-stone-600">
          <span>GPS Track Finder v1.0</span>
          <span>
            Источники: 4x4forum, drive2, autotravel, expedition, wikiloc, klimovs-travels, ...
          </span>
        </div>
      </footer>
    </div>
  );
}
