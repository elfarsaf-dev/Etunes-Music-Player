import type {
  LyricLine,
  LyricsResult,
  Profile,
  SearchResultRaw,
  Usage,
} from "./types";

export const API_BASE = "https://musicapi.cocspedsafliz.workers.dev";
export const SPOTIFY_FALLBACK = "https://spotify.elfar.my.id/api/spotify";
export const LYRICS_API = "https://api.nexray.web.id/search/lyrics";

class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = "UNKNOWN") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Translate raw API errors / status codes into user-friendly Indonesian
 * messages. Keep the original message as a fallback.
 */
function friendlyError(rawMessage: string, status: number): { message: string; code: string } {
  const lower = rawMessage.toLowerCase();

  if (status === 401 || lower.includes("invalid api key") || lower.includes("unauthorized")) {
    return {
      message: "API key tidak valid. Cek lagi atau buat akun baru.",
      code: "INVALID_KEY",
    };
  }
  if (status === 403 && (lower.includes("limit") || lower.includes("quota"))) {
    return {
      message: "Kuota harian habis. Coba lagi besok atau upgrade ke Premium.",
      code: "QUOTA_EXCEEDED",
    };
  }
  if (status === 403) {
    return {
      message: "Akses ditolak oleh server.",
      code: "FORBIDDEN",
    };
  }
  if (
    status === 409 ||
    lower.includes("already exists") ||
    lower.includes("already registered") ||
    lower.includes("duplicate") ||
    // The Cloudflare worker returns 500 with this generic message whenever
    // the email is already in its DB (it doesn't differentiate). Treating
    // this as EMAIL_TAKEN lets the client fall back to the API key form
    // instead of dead-ending on "Server bermasalah".
    lower.includes("gagal register") ||
    lower.includes("register failed")
  ) {
    return {
      message: "Email sudah terdaftar. Coba masuk pakai API key kamu.",
      code: "EMAIL_TAKEN",
    };
  }
  if (
    lower.includes("invalid email") ||
    lower.includes("email format") ||
    lower.includes("must be a valid email")
  ) {
    return {
      message: "Format email tidak valid.",
      code: "INVALID_EMAIL",
    };
  }
  if (
    lower.includes("password") &&
    (lower.includes("short") || lower.includes("weak") || lower.includes("8"))
  ) {
    return {
      message: "Password minimal 8 karakter.",
      code: "WEAK_PASSWORD",
    };
  }
  if (
    lower.includes("wrong password") ||
    lower.includes("incorrect password") ||
    lower.includes("invalid password")
  ) {
    return {
      message: "Password salah. Coba lagi.",
      code: "WRONG_PASSWORD",
    };
  }
  if (status === 404) {
    return {
      message: "Akun tidak ditemukan.",
      code: "NOT_FOUND",
    };
  }
  if (status === 429) {
    return {
      message: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.",
      code: "RATE_LIMITED",
    };
  }
  if (status >= 500) {
    return {
      message: "Server lagi bermasalah. Coba beberapa saat lagi.",
      code: "SERVER_ERROR",
    };
  }
  return { message: rawMessage || "Terjadi kesalahan tak terduga.", code: "UNKNOWN" };
}

async function request<T>(
  path: string,
  apiKey: string | null,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Tidak ada koneksi internet. Cek jaringan kamu.",
      0,
      "NETWORK",
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiError("Respon server tidak valid.", res.status, "BAD_RESPONSE");
  }

  if (!res.ok) {
    const raw =
      (data as { error?: string; message?: string })?.error ??
      (data as { error?: string; message?: string })?.message ??
      `Permintaan gagal (${res.status})`;
    const { message, code } = friendlyError(raw, res.status);
    throw new ApiError(message, res.status, code);
  }

  return data as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ message: string; api_key: string }>("/register", null, {
      method: "POST",
      body: { email, password },
    }),
  me: (apiKey: string) => request<Profile>("/me", apiKey),
  usage: (apiKey: string) => request<Usage>("/usage", apiKey),
  regenerateKey: (apiKey: string) =>
    request<{ api_key: string }>("/regenerate-key", apiKey, { method: "POST" }),

  search: async (
    apiKey: string,
    q: string,
  ): Promise<SearchResultRaw[]> => {
    const data = await request<{
      status?: boolean;
      result?: SearchResultRaw[];
    }>(`/search?q=${encodeURIComponent(q)}`, apiKey);
    return data.result ?? [];
  },

  /**
   * Resolve a Spotify track URL into a playable streaming URL.
   * Tries the worker first (which counts toward the user's daily quota),
   * and falls back to the underlying provider if the worker response is
   * incomplete.
   */
  resolveStream: async (
    apiKey: string,
    spotifyUrl: string,
  ): Promise<{
    title?: string;
    artist?: string;
    thumbnail?: string;
    streamUrl: string;
  }> => {
    let workerData:
      | {
          title?: string;
          artist?: string;
          thumbnail?: string;
          download?: string;
        }
      | undefined;
    try {
      workerData = await request("/download", apiKey, {
        method: "POST",
        body: { url: spotifyUrl },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) throw err;
    }

    if (workerData?.download) {
      return {
        title: workerData.title,
        artist: workerData.artist,
        thumbnail: workerData.thumbnail,
        streamUrl: workerData.download,
      };
    }

    let fallbackRes: Response;
    try {
      fallbackRes = await fetch(
        `${SPOTIFY_FALLBACK}?link=${encodeURIComponent(spotifyUrl)}`,
      );
    } catch {
      throw new ApiError(
        "Tidak bisa terhubung ke server musik.",
        0,
        "NETWORK",
      );
    }
    const fallback = (await fallbackRes.json().catch(() => ({}))) as {
      result?: {
        title?: string;
        artist?: string;
        thumbnail?: string;
        url?: string;
      };
    };

    const url = fallback.result?.url;
    if (!url) {
      throw new ApiError(
        "Lagu ini tidak bisa diputar. Coba lagu lain.",
        502,
        "RESOLVE_FAILED",
      );
    }

    return {
      title: workerData?.title ?? fallback.result?.title,
      artist: workerData?.artist ?? fallback.result?.artist,
      thumbnail: workerData?.thumbnail ?? fallback.result?.thumbnail,
      streamUrl: url,
    };
  },
};

export { ApiError };

/**
 * Parse a single LRC timestamp like "[01:23.45]" into seconds.
 * Returns null if the prefix is not a valid timestamp.
 */
function parseLrcTime(prefix: string): number | null {
  const m = prefix.match(/^\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]$/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  const frac = m[3] ? Number(`0.${m[3]}`) : 0;
  return min * 60 + sec + frac;
}

/**
 * Parse synced LRC text into an array of timed lines. A single line may
 * carry multiple timestamps like "[00:10.00][00:30.00] text" — in that
 * case it appears once per timestamp.
 */
export function parseSyncedLyrics(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const stamps: number[] = [];
    let rest = rawLine;
    while (true) {
      const m = rest.match(/^\s*(\[[^\]]+\])/);
      if (!m) break;
      const t = parseLrcTime(m[1]);
      if (t === null) break;
      stamps.push(t);
      rest = rest.slice(m[0].length);
    }
    const text = rest.trim();
    if (stamps.length === 0) continue;
    for (const t of stamps) {
      lines.push({ time: t, text });
    }
  }
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

/**
 * Search for lyrics by free-text query. Returns null when the API has no
 * match or the response is malformed.
 */
export async function searchLyrics(
  query: string,
): Promise<LyricsResult | null> {
  let res: Response;
  try {
    res = await fetch(`${LYRICS_API}?q=${encodeURIComponent(query)}`);
  } catch {
    throw new ApiError(
      "Tidak ada koneksi internet. Cek jaringan kamu.",
      0,
      "NETWORK",
    );
  }
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new ApiError(
      "Server lirik bermasalah. Coba beberapa saat lagi.",
      res.status,
      "LYRICS_FAILED",
    );
  }
  const data = (await res.json().catch(() => null)) as {
    status?: boolean;
    result?: {
      title?: string;
      artist?: string;
      lyrics?: {
        track_name?: string;
        artist_name?: string;
        album_name?: string;
        plain_lyrics?: string;
        synced_lyrics?: string;
      };
    };
  } | null;

  const lyrics = data?.result?.lyrics;
  if (!data?.status || !lyrics) return null;

  const plainText = (lyrics.plain_lyrics ?? "").trim();
  const syncedText = (lyrics.synced_lyrics ?? "").trim();
  if (!plainText && !syncedText) return null;

  return {
    trackName: lyrics.track_name ?? data.result?.title ?? "",
    artistName: lyrics.artist_name ?? data.result?.artist ?? "",
    albumName: lyrics.album_name,
    synced: syncedText ? parseSyncedLyrics(syncedText) : [],
    plain: plainText
      ? plainText.split(/\r?\n/).map((s) => s.trim())
      : [],
  };
}
