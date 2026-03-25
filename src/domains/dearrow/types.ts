export interface DeArrowBranding {
  title?: string;
  thumbnail?: string;
}

export interface DeArrowApiResponse {
  titles: Array<{ title: string; votes: number; original: boolean }>;
  thumbnails: Array<{ thumbnail: string; votes: number; original: boolean }>;
}
