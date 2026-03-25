const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function isValidVideoId(id: string): boolean {
  const cleaned = id.startsWith('yt:') ? id.slice(3) : id;
  return VIDEO_ID_REGEX.test(cleaned);
}

export function extractVideoId(id: string): string {
  return id.startsWith('yt:') ? id.slice(3) : id;
}
