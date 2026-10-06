'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ChevronDown, Pause, Play } from 'lucide-react';
import { MUSIC_HISTORY_KEY, musicProgress, musicURL, readMusicHistory, rememberMusicTrack, type MusicSource, type MusicTrack } from '@/lib/music';
import { loadSoundCloudAPI, type SoundCloudWidget } from '@/lib/soundcloud';
import './MusicPlayer.css';

export type MusicPlayerHandle = { play(url: string, source?: MusicSource): void; focus(edge?: 'first' | 'last'): boolean };
type Selection = { url: string; position: number; revision: number };
const playerOptions = { auto_play: false, hide_related: true, show_comments: false, show_user: true, show_reposts: false };

export default forwardRef<MusicPlayerHandle>(function MusicPlayer(_, ref) {
 const [history, setHistory] = useState<MusicTrack[]>([]);
 const [selection, setSelection] = useState<Selection | null>(null);
 const [initialURL, setInitialURL] = useState<string | null>(null);
 const [ready, setReady] = useState(false);
 const [playing, setPlaying] = useState(false);
 const [expanded, setExpanded] = useState(false);
 const [error, setError] = useState('');
 const [apiAttempt, setAPIAttempt] = useState(0);
 const container = useRef<HTMLElement>(null);
 const iframe = useRef<HTMLIFrameElement>(null);
 const widget = useRef<SoundCloudWidget | null>(null);
 const tracks = useRef<MusicTrack[]>([]);
 const selected = useRef<Selection | null>(null);
 const loadedURL = useRef<string | null>(null);
 const revision = useRef(0);
 const appliedRevision = useRef(0);
 const lastPersist = useRef(0);
 const wantsPlayback = useRef(false);
 const persist = useCallback(() => { try { localStorage.setItem(MUSIC_HISTORY_KEY, JSON.stringify(tracks.current)); } catch {} }, []);
 const commit = useCallback((next: MusicTrack[]) => { tracks.current = next; setHistory(next); persist(); }, [persist]);
 const start = useCallback((value: string, source?: MusicSource) => {
  const url = musicURL(value); if (!url) return;
  const next = rememberMusicTrack(tracks.current, { url, source });
  commit(next);
  const track = next[0];
  const request = { url, position: track.position, revision: ++revision.current };
  selected.current = request; wantsPlayback.current = true;
  setSelection(request); setInitialURL(previous => previous || url); setError('');
  if (!widget.current) setAPIAttempt(n => n + 1);
 }, [commit]);
 const focus = useCallback((edge: 'first' | 'last' = 'first') => {
  const controls = Array.from(container.current?.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('button:not(:disabled), a[href]') || [])
   .filter(control => !control.closest('[inert], [hidden], [aria-hidden="true"]') && control.tabIndex >= 0 && control.getClientRects().length > 0 && getComputedStyle(control).visibility === 'visible');
  const control = edge === 'last' ? controls.at(-1) : controls[0];
  if (!control) return false;
  control.focus();
  return document.activeElement === control;
 }, []);
 useImperativeHandle(ref, () => ({ play: start, focus }), [start, focus]);
 useEffect(() => {
  try { commit(readMusicHistory(JSON.parse(localStorage.getItem(MUSIC_HISTORY_KEY) || 'null'))); } catch {}
  const save = () => persist(); window.addEventListener('pagehide', save);
  return () => { window.removeEventListener('pagehide', save); persist(); };
 }, [commit, persist]);
 useEffect(() => {
  if (!initialURL) return;
  let alive = true; let cleanup = () => {};
  setReady(false); appliedRevision.current = 0;
  void loadSoundCloudAPI().then(factory => {
   if (!alive || !iframe.current) return;
   const player = factory(iframe.current); widget.current = player;
   const events = factory.Events; let initialized = false;
   const progress = (data?: { currentPosition?: number }, force = false) => {
    if (!loadedURL.current || typeof data?.currentPosition !== 'number') return;
    tracks.current = musicProgress(tracks.current, loadedURL.current, data.currentPosition);
    if (force || Date.now() - lastPersist.current > 2000) { lastPersist.current = Date.now(); persist(); }
   };
   player.bind(events.READY, () => { if (!alive || initialized) return; initialized = true; loadedURL.current = initialURL; setReady(true); });
   player.bind(events.PLAY, () => { if (alive) { setPlaying(true); setError(''); } });
   player.bind(events.PAUSE, () => { if (alive) { setPlaying(false); persist(); } });
   player.bind(events.FINISH, () => { if (alive) { setPlaying(false); if (loadedURL.current) tracks.current = musicProgress(tracks.current, loadedURL.current, 0); persist(); } });
   player.bind(events.PLAY_PROGRESS, progress);
   player.bind(events.SEEK, data => progress(data, true));
   player.bind(events.ERROR, () => { if (alive) { setPlaying(false); setError('这首音乐暂时无法播放。'); } });
   cleanup = () => { player.pause(); for (const event of Object.values(events)) player.unbind(event); if (widget.current === player) widget.current = null; };
  }).catch(() => { if (alive) setError('SoundCloud 暂时无法连接，可在下方播放器中重试。'); });
  return () => { alive = false; cleanup(); loadedURL.current = null; };
 }, [initialURL, apiAttempt, persist]);
 useEffect(() => {
  const player = widget.current;
  if (!ready || !player || !selection || appliedRevision.current === selection.revision) return;
  const fresh = appliedRevision.current === 0;
  appliedRevision.current = selection.revision;
  const finish = (restore: boolean) => {
   if (widget.current !== player || selected.current?.revision !== selection.revision) return;
   loadedURL.current = selection.url;
   if (restore && selection.position > 0) player.seekTo(selection.position);
   if (wantsPlayback.current) player.play();
   player.getCurrentSound(sound => { if (selected.current?.revision === selection.revision && sound) commit(rememberMusicTrack(tracks.current, { url: selection.url, title: sound.title, author: sound.user?.username })); });
  };
  if (loadedURL.current === selection.url) finish(fresh);
  else { loadedURL.current = null; setPlaying(false); player.load(selection.url, { ...playerOptions, callback: () => finish(true) }); }
 }, [ready, selection, commit]);
 const pause = () => { wantsPlayback.current = false; widget.current?.pause(); setPlaying(false); persist(); };
 const active = history.find(track => track.url === selection?.url) || history[0];
 if (!active) return null;
 return <aside ref={container} className="music-player" aria-label="背景音乐播放器">
  <div className="music-bar">
   <button type="button" className="music-play" aria-label={playing ? '暂停音乐' : '继续播放音乐'} onClick={() => playing ? pause() : start(active.url)}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
   <button type="button" className="music-label" aria-label={expanded ? '收起播放记录' : '展开播放记录'} aria-expanded={expanded} aria-controls="music-library" onClick={() => setExpanded(value => !value)}>
    <span className="music-details"><span className="music-title" title={active.title}>{active.title}</span><small>{active.source && `来自〈${active.source.name}〉 · `}{active.author}</small></span><ChevronDown size={13} className={expanded ? 'expanded' : ''} />
   </button>
   <a className="music-origin" href={active.url} target="_blank" rel="noreferrer" aria-label={`在 SoundCloud 打开 ${active.title}，作者 ${active.author}`}>SoundCloud ↗</a>
  </div>
  {error && <p className="music-error" role="status">{error}</p>}
  <div id="music-library" className={`music-library${expanded ? ' expanded' : ''}`} aria-label="播放记录" aria-hidden={!expanded} inert={!expanded}>
   <ol>{history.map(track => <li key={track.url}><button type="button" className={track.url === active.url ? 'active' : ''} aria-current={track.url === active.url ? 'true' : undefined} onClick={() => start(track.url)}><span>{track.title}</span><small>{track.source && `来自〈${track.source.name}〉 · `}{track.author}</small></button><a href={track.url} target="_blank" rel="noreferrer" aria-label={`在 SoundCloud 打开 ${track.title}，作者 ${track.author}`}>↗</a></li>)}</ol>
   {initialURL && <iframe ref={iframe} title="SoundCloud 背景音乐播放器" width="100%" height="166" scrolling="no" allow="autoplay" src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(initialURL)}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false`} />}
  </div>
 </aside>;
});
