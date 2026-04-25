export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function parseDurationStr(d?: string): number | undefined {
  if (!d) return undefined;
  const parts = d.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

export function splitTitle(rawTitle: string, fallbackArtist?: string) {
  const idx = rawTitle.indexOf(" - ");
  if (idx > 0) {
    return {
      artist: rawTitle.slice(0, idx).trim(),
      title: rawTitle.slice(idx + 3).trim(),
    };
  }
  return { artist: fallbackArtist ?? "Unknown", title: rawTitle };
}
