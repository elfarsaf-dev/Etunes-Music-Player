import { storage } from "./storage";
import type { ArtistRegion } from "./featuredArtists";

const CACHE_KEY = "@etunes/region";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

type CachedRegion = {
  region: ArtistRegion;
  countryCode: string;
  fetchedAt: number;
};

/**
 * Detect the user's region from their IP, with a 7-day cache.
 * Falls back to "International" on any error so the UI remains usable.
 */
export async function detectRegion(): Promise<ArtistRegion> {
  try {
    const cached = await storage.get<CachedRegion>(CACHE_KEY);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.region;
    }
  } catch {
    // ignore cache errors
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://api.country.is/", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error("region lookup failed");
    const data = (await res.json()) as { country?: string };
    const countryCode = (data.country ?? "").toUpperCase();
    const region: ArtistRegion = countryCode === "ID" ? "Indonesia" : "International";

    const next: CachedRegion = {
      region,
      countryCode,
      fetchedAt: Date.now(),
    };
    await storage.set(CACHE_KEY, next);
    return region;
  } catch {
    return "International";
  }
}
