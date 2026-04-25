import type { Profile, SearchResultRaw, Usage } from "./types";

export const API_BASE = "https://musicapi.cocspedsafliz.workers.dev";
export const SPOTIFY_FALLBACK = "https://spotify.elfar.my.id/api/spotify";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiError("Invalid response", res.status);
  }

  if (!res.ok) {
    const msg =
      (data as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
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

    const fallbackRes = await fetch(
      `${SPOTIFY_FALLBACK}?link=${encodeURIComponent(spotifyUrl)}`,
    );
    const fallback = (await fallbackRes.json()) as {
      result?: {
        title?: string;
        artist?: string;
        thumbnail?: string;
        url?: string;
      };
    };

    const url = fallback.result?.url;
    if (!url) throw new ApiError("Could not resolve stream URL", 502);

    return {
      title: workerData?.title ?? fallback.result?.title,
      artist: workerData?.artist ?? fallback.result?.artist,
      thumbnail: workerData?.thumbnail ?? fallback.result?.thumbnail,
      streamUrl: url,
    };
  },
};

export { ApiError };
