export interface VideoFormat {
  format_id: string;
  ext: string;
  width?: number;
  height?: number;
  vcodec?: string;
  acodec?: string;
  url: string;
  filesize?: number;
  tbr?: number;
  abr?: number;
  protocol?: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  upload_date?: string;
  uploader?: string;
  uploader_url?: string;
  channel?: string;
  channel_url?: string;
  view_count?: number;
  formats?: VideoFormat[];
  subtitles?: Record<string, SubtitleTrack[]>;
  automatic_captions?: Record<string, SubtitleTrack[]>;
}

export interface SubtitleTrack {
  ext: string;
  url: string;
  name?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  channel_url?: string;
}
