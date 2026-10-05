import { soundcloudURL } from './world.ts';

export const MUSIC_HISTORY_KEY = 'openworld-music-history';
const historyLimit = 50;
export type MusicTrack = { url: string; title: string; position: number };

export function musicURL(value: string): string | null {
 if (!soundcloudURL(value)) return null;
 const url = new URL(value);
 url.hostname = 'soundcloud.com';
 url.hash = '';
 for (const key of Array.from(url.searchParams.keys())) if (key === 'si' || key.startsWith('utm_')) url.searchParams.delete(key);
 return url.toString();
}
function trackTitle(url: string) {
 const name = new URL(url).pathname.split('/').pop() || 'SoundCloud';
 try { return decodeURIComponent(name).replaceAll('-', ' '); } catch { return name; }
}
const safePosition = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.min(86400000, Math.max(0, value)) : 0;
export function readMusicHistory(value: unknown): MusicTrack[] {
 if (!Array.isArray(value)) return [];
 const tracks: MusicTrack[] = [];
 for (const item of value.slice(0, historyLimit)) {
  if (!item || typeof item !== 'object' || typeof item.url !== 'string') continue;
  const url = musicURL(item.url);
  if (!url || tracks.some(track => track.url === url)) continue;
  tracks.push({ url, title: typeof item.title === 'string' && item.title.trim() ? item.title.slice(0, 150) : trackTitle(url), position: safePosition(item.position) });
 }
 return tracks;
}
export function rememberMusicTrack(history: MusicTrack[], input: { url: string; title?: string; position?: number }): MusicTrack[] {
 const url = musicURL(input.url);
 if (!url) return history;
 const previous = history.find(track => track.url === url);
 const track = { url, title: (input.title?.trim() || previous?.title || trackTitle(url)).slice(0, 150), position: input.position === undefined ? previous?.position || 0 : safePosition(input.position) };
 return [track, ...history.filter(item => item.url !== url)].slice(0, historyLimit);
}
export function musicProgress(history: MusicTrack[], url: string, position: number): MusicTrack[] {
 return history.map(track => track.url === url ? { ...track, position: safePosition(position) } : track);
}
