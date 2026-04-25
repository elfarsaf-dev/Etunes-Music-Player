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
