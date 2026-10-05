export type SoundCloudWidget = {
 bind(event: string, callback: (data?: { currentPosition?: number }) => void): void;
 unbind(event: string): void;
 load(url: string, options: Record<string, unknown> & { callback: () => void }): void;
 play(): void;
 pause(): void;
 seekTo(milliseconds: number): void;
 getCurrentSound(callback: (sound: { title?: string } | null) => void): void;
};
type WidgetFactory = ((iframe: HTMLIFrameElement) => SoundCloudWidget) & { Events: Record<'READY' | 'PLAY' | 'PAUSE' | 'FINISH' | 'PLAY_PROGRESS' | 'SEEK' | 'ERROR', string> };
declare global { interface Window { SC?: { Widget: WidgetFactory } } }
let widgetAPI: Promise<WidgetFactory> | null = null;

export function loadSoundCloudAPI(): Promise<WidgetFactory> {
 if (window.SC?.Widget) return Promise.resolve(window.SC.Widget);
 if (widgetAPI) return widgetAPI;
 widgetAPI = new Promise<WidgetFactory>((resolve, reject) => {
  const existing = document.querySelector<HTMLScriptElement>('script[data-openworld-soundcloud]');
  const script = existing || document.createElement('script');
  let timeout: ReturnType<typeof setTimeout>;
  const cleanup = () => { clearTimeout(timeout); script.removeEventListener('load', loaded); script.removeEventListener('error', failed); };
  const failed = () => { cleanup(); script.remove(); widgetAPI = null; reject(new Error('SoundCloud 暂时无法连接。')); };
  const loaded = () => { if (!window.SC?.Widget) { failed(); return; } cleanup(); resolve(window.SC.Widget); };
  script.addEventListener('load', loaded, { once: true });
  script.addEventListener('error', failed, { once: true });
  timeout = setTimeout(failed, 15000);
  if (!existing) { script.src = 'https://w.soundcloud.com/player/api.js'; script.async = true; script.dataset.openworldSoundcloud = ''; document.head.appendChild(script); }
 });
 return widgetAPI;
}
