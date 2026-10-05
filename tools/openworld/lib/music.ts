import { soundcloudURL } from './world.ts';

export const MUSIC_HISTORY_KEY = 'openworld-music-history';
const historyLimit = 50;
export type MusicSource = { residentId: string; name: string };
export type MusicTrack = { url: string; title: string; author: string; position: number; source?: MusicSource };

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
function trackAuthor(url: string) {
 const name = new URL(url).pathname.split('/')[1] || 'SoundCloud';
 try { return decodeURIComponent(name).slice(0, 80); } catch { return name.slice(0, 80); }
}
function musicSource(value: unknown): MusicSource | undefined {
 if (!value || typeof value !== 'object' || !('residentId' in value) || !('name' in value)) return;
 if (typeof value.residentId !== 'string' || typeof value.name !== 'string') return;
 const residentId = value.residentId.trim();
 if (!residentId || residentId.length > 200 || /[\u0000-\u001f\u007f]/.test(residentId)) return;
 return { residentId, name: value.name.trim().slice(0, 30) || '佚名' };
}
const trackText = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const safePosition = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.min(86400000, Math.max(0, value)) : 0;
export function readMusicHistory(value: unknown): MusicTrack[] {
 if (!Array.isArray(value)) return [];
 const tracks: MusicTrack[] = [];
 for (const item of value.slice(0, historyLimit)) {
  if (!item || typeof item !== 'object' || typeof item.url !== 'string') continue;
  const url = musicURL(item.url);
  if (!url || tracks.some(track => track.url === url)) continue;
  const source = musicSource(item.source);
  tracks.push({ url, title: trackText(item.title, 150) || trackTitle(url), author: trackText(item.author, 80) || trackAuthor(url), position: safePosition(item.position), ...(source ? { source } : {}) });
 }
 return tracks;
}
export function rememberMusicTrack(history: MusicTrack[], input: { url: string; title?: string; author?: string; position?: number; source?: MusicSource }): MusicTrack[] {
 const url = musicURL(input.url);
 if (!url) return history;
 const previous = history.find(track => track.url === url);
 const source = musicSource(input.source) || previous?.source;
 const track = { url, title: trackText(input.title, 150) || previous?.title || trackTitle(url), author: trackText(input.author, 80) || previous?.author || trackAuthor(url), position: input.position === undefined ? previous?.position || 0 : safePosition(input.position), ...(source ? { source } : {}) };
 return [track, ...history.filter(item => item.url !== url)].slice(0, historyLimit);
}
export function musicProgress(history: MusicTrack[], url: string, position: number): MusicTrack[] {
 return history.map(track => track.url === url ? { ...track, position: safePosition(position) } : track);
}
