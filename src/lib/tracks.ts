/**
 * GPS Track Finder — Library for searching GPS tracks.
 * Mirrors the logic from the skill's find_tracks.py script.
 */

export interface TrackResult {
  title: string;
  source: string;
  url: string;
  downloadUrl: string | null;
  author: string | null;
  description: string | null;
  format: string | null;
  available: boolean | null;
  needsRegistration: boolean;
  relevanceScore: number;
}

export interface SearchResults {
  region: string;
  tracks: TrackResult[];
  totalFound: number;
  totalAvailable: number;
  searchTimeSeconds: number;
}

// ─── Resources ────────────────────────────────────────────────────────

export const RESOURCES = [
  { name: "4x4forum.ru", site: "4x4forum.ru", priority: 1, needsReg: true },
  { name: "drive2.ru", site: "drive2.ru", priority: 2, needsReg: false },
  { name: "forum.autotravel.ru", site: "forum.autotravel.ru", priority: 3, needsReg: true },
  { name: "expedition.ru", site: "expedition.ru", priority: 4, needsReg: true },
  { name: "klimovs-travels.ru", site: "klimovs-travels.ru", priority: 5, needsReg: false },
  { name: "wikiloc.com", site: "ru.wikiloc.com", priority: 6, needsReg: false },
  { name: "ttrails.ru", site: "ttrails.ru", priority: 7, needsReg: false },
  { name: "trekkingmania.ru", site: "trekkingmania.ru", priority: 8, needsReg: false },
  { name: "ykoctpa.ru", site: "ykoctpa.ru", priority: 9, needsReg: false },
  { name: "VK", site: "vk.com", priority: 10, needsReg: false },
];

// ─── Region keywords ──────────────────────────────────────────────────

export const REGION_KEYWORDS: Record<string, string[]> = {
  алтай: ["Чуйский тракт", "Улаган", "Кату-Ярык", "Ташант", "Чемал"],
  кавказ: ["Архыз", "Домбай", "Приэльбрусье", "Военно-Сухумская", "Дагестан"],
  карелия: ["Кизи", "Валаам", "Сортавала", "Ладога", "Рускеала"],
  кольский: ["Териберка", "Сейдозеро", "Ловозеро", "Мурманск"],
  дагестан: ["Дербент", "Сулак", "Чох", "Гуниб", "Салтау"],
  урал: ["Таганай", "Зюраткуль", "Иремель", "Аркаим"],
  байкал: ["КБЖД", "Ольхон", "Слюдянка", "Северобайкальск"],
  камчатка: ["Долина гейзеров", "Мутновский", "Петропавловск"],
  саяны: ["Орлик", "Жемчуг", "Аршан", "Тунка", "Окинский тракт"],
  якутия: ["Колыма", "Ленские столбы", "Вилюй"],
};

// ─── Popular regions for the UI ───────────────────────────────────────

export const POPULAR_REGIONS = [
  { id: "алтай", label: "Алтай", emoji: "🏔️" },
  { id: "кавказ", label: "Кавказ", emoji: "⛰️" },
  { id: "карелия", label: "Карелия", emoji: "🌲" },
  { id: "кольский", label: "Кольский", emoji: "🌊" },
  { id: "дагестан", label: "Дагестан", emoji: "🕌" },
  { id: "урал", label: "Урал", emoji: "🪨" },
  { id: "байкал", label: "Байкал", emoji: "💎" },
  { id: "камчатка", label: "Камчатка", emoji: "🌋" },
  { id: "саяны", label: "Саяны", emoji: "🏕️" },
  { id: "якутия", label: "Якутия", emoji: "❄️" },
];

// ─── Noise filtering ──────────────────────────────────────────────────

const NOISE_DOMAINS = [
  "youtube.com", "wikipedia.org", "topografix.com", "inertialsense.com",
  "arlight.ru", "the-flow.ru", "amazon.", "aliexpress.",
  "instagram.com", "pubmed.ncbi.nlm.nih.gov", "m.vk.ru",
  "tiktok.com", "spotify.com", "genius.com", "azlyrics.com",
  "play.google.com", "garmin.com", "klops.ru", "gosweb.gosuslugi.ru",
  "zabugorshiki.com", "ncbi.nlm.nih.gov",
];

const NOISE_WORDS = [
  "музык", "песн", "сингл", "рэп", "хип-хоп", "моргенштерн", "крид",
  "выпустил трек", "новый трек", "приятного",
  "магнитный трек", "трековый свет", "MAG-TRACK", "светильник",
  "GNSS receiver", "GPS Exchange Format", "XML schema",
  "Amazfit", "Garmin Connect", "Apple Watch", "Galaxy Watch",
  "туры на ", "Ганеман", "автобус", "муниципальн",
  "What is GPS", "Global Positioning System is a",
  "Поиск маршрута", "железнодорожный вокзал", "график движения",
  "Korzinka", "Eurasian Bank", "Altel.kz",
];

export function isNoise(text: string, url: string): boolean {
  const lower = text.toLowerCase();
  const urlLower = url.toLowerCase();
  for (const d of NOISE_DOMAINS) {
    if (urlLower.includes(d)) return true;
  }
  for (const w of NOISE_WORDS) {
    if (lower.includes(w.toLowerCase())) return true;
  }
  return false;
}

// ─── Relevance scoring ────────────────────────────────────────────────

export function scoreRelevance(track: TrackResult, region: string): number {
  let score = 0;
  const rl = region.toLowerCase();
  const tl = (track.title || "").toLowerCase();
  const dl = (track.description || "").toLowerCase();

  if (tl.includes(rl)) score += 3.0;
  if (dl.includes(rl)) score += 2.0;
  if (track.downloadUrl) score += 2.0;
  if (track.description && track.description.length > 50) score += 1.0;
  if (track.format && track.format !== "неизвестный") score += 1.0;
  if (track.available) score += 1.0;

  for (const res of RESOURCES) {
    if (res.name === track.source) {
      score += Math.max(0, (10 - res.priority)) * 0.1;
      break;
    }
  }

  return score;
}

// ─── Format detection ─────────────────────────────────────────────────

export function detectFormat(url: string): string | null {
  const u = url.toLowerCase();
  if (u.endsWith(".gpx")) return "GPX";
  if (u.endsWith(".kmz")) return "KMZ";
  if (u.endsWith(".kml")) return "KML";
  if (u.includes(".zip") || u.includes(".rar")) return "ZIP/RAR";
  return null;
}
