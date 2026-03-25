export interface StremioManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  types: string[];
  idPrefixes: string[];
  catalogs: StremioCatalog[];
  resources: string[];
  behaviorHints: { configurable: boolean; configurationRequired: boolean };
}

export interface StremioCatalog {
  type: string;
  id: string;
  name: string;
  extra?: StremioExtra[];
}

export interface StremioExtra {
  name: string;
  isRequired?: boolean;
  options?: string[];
}

export interface StremioMetaPreview {
  id: string;
  type: string;
  name: string;
  poster: string;
  posterShape?: 'square' | 'poster' | 'landscape';
  description?: string;
  releaseInfo?: string;
  links?: StremioLink[];
}

export interface StremioMeta extends StremioMetaPreview {
  background?: string;
  logo?: string;
  runtime?: string;
  behaviorHints?: { defaultVideoId?: string };
}

export interface StremioLink {
  name: string;
  category: string;
  url: string;
}

export interface StremioStream {
  url: string;
  name?: string;
  description?: string;
  behaviorHints?: {
    filename?: string;
    bingeGroup?: string;
    notWebReady?: boolean;
    proxyHeaders?: { request?: Record<string, string> };
  };
}

export interface StremioSubtitle {
  id: string;
  url: string;
  lang: string;
}

export interface CatalogResponse {
  metas: StremioMetaPreview[];
}

export interface MetaResponse {
  meta: StremioMeta;
}

export interface StreamResponse {
  streams: StremioStream[];
}

export interface SubtitleResponse {
  subtitles: StremioSubtitle[];
}
