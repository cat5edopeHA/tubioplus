import type { VideoFormat } from './types.js';

const H264_CODECS = ['avc1', 'h264'];

function isH264(format: VideoFormat): boolean {
  return H264_CODECS.some((c) => format.vcodec?.startsWith(c));
}

function isVideoOnly(format: VideoFormat): boolean {
  return format.vcodec !== undefined && format.vcodec !== 'none' && (format.acodec === undefined || format.acodec === 'none');
}

function isMuxed(format: VideoFormat): boolean {
  return format.vcodec !== undefined && format.vcodec !== 'none' && format.acodec !== undefined && format.acodec !== 'none';
}

function isAudioOnly(format: VideoFormat): boolean {
  return (format.vcodec === undefined || format.vcodec === 'none') && format.acodec !== undefined && format.acodec !== 'none';
}

function isAAC(format: VideoFormat): boolean {
  return format.acodec?.startsWith('mp4a') ?? false;
}

export function findVideoFormat(formats: VideoFormat[], targetHeight: number): VideoFormat | undefined {
  if (targetHeight <= 360) {
    const muxed = formats.filter((f) => isMuxed(f) && (f.height ?? 0) <= targetHeight).sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
    if (muxed.length > 0) return muxed[0];
  }
  const candidates = formats.filter((f) => isVideoOnly(f) && (f.height ?? 0) <= targetHeight).sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  if (candidates.length === 0) return undefined;
  if (targetHeight <= 1080) {
    const h264 = candidates.find((f) => isH264(f));
    if (h264) return h264;
  }
  return candidates[0];
}

export function findAudioFormat(formats: VideoFormat[]): VideoFormat | undefined {
  const audioFormats = formats.filter(isAudioOnly);
  if (audioFormats.length === 0) return undefined;
  const aac = audioFormats.filter(isAAC).sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0));
  if (aac.length > 0) return aac[0];
  return audioFormats.sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))[0];
}
