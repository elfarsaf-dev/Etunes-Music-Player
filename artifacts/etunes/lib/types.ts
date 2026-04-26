export type TrackSource = "local" | "online";

export type Track = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail?: string;
  duration?: number;
  source: TrackSource;
  spotifyUrl?: string;
  uri?: string;
  /** Local file URI if this online track has been downloaded for offline use. */
  localUri?: string;
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  tracks: Track[];
};

export type Profile = {
  id: string;
  api_key: string;
  is_premium: boolean;
};

export type Usage = {
  today: number;
  limit: number;
};

export type SearchResultRaw = {
  title: string;
  artist: string;
  duration?: string;
  thumbnail?: string;
  popularity?: number;
  album?: string;
  release_date?: string;
  url: string;
};

export type DownloadRecord = {
  trackId: string;
  uri: string;
  size?: number;
  downloadedAt: number;
};

export type LyricLine = {
  /** Start time in seconds. 0 for unsynced lines. */
  time: number;
  text: string;
};

export type LyricsResult = {
  trackName: string;
  artistName: string;
  albumName?: string;
  /** Parsed synced lyrics (LRC). Empty if unavailable. */
  synced: LyricLine[];
  /** Plain-text lyrics, line-split. */
  plain: string[];
};
