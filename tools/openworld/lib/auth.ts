import type { Session, SupabaseClient } from '@supabase/supabase-js';

type AuthBootstrap = Pick<SupabaseClient['auth'], 'initialize' | 'getSession'>;
type CallbackLocation = { readURL: () => string; replaceURL: (url: string) => void };
const callbackParameters = new Set(['code', 'error', 'error_code', 'error_description']);

// Remove only callback parameters, retaining unrelated values and their encoding.
function stripCallbackParameters(value: string) {
 let changed = false;
 const remaining = value.split('&').filter(part => {
  try {
   const name = decodeURIComponent(part.split('=', 1)[0].replace(/\+/g, ' '));
   if (callbackParameters.has(name)) { changed = true; return false; }
  } catch { /* Keep malformed, unrelated parameters unchanged. */ }
  return true;
 });
 return { value: remaining.join('&'), changed };
}

export function cleanOAuthCallbackURL(href: string): string {
 const url = new URL(href);
 const query = stripCallbackParameters(url.search.slice(1));
 const hash = url.hash.slice(1);
 const fragment = hash.includes('=') || hash.includes('&') ? stripCallbackParameters(hash) : { value: hash, changed: false };
 if (!query.changed && !fragment.changed) return href;
 if (query.changed) url.search = query.value ? `?${query.value}` : '';
 if (fragment.changed) url.hash = fragment.value ? `#${fragment.value}` : '';
 return url.href;
}

export function oauthErrorNotice(error: unknown): string {
 const value = error && typeof error === 'object' ? error as { code?: unknown; details?: { error?: unknown; code?: unknown } } : null;
 const codes = [value?.code, value?.details?.error, value?.details?.code];
 return codes.some(code => code === 'access_denied' || code === 'user_cancelled' || code === 'user_canceled')
  ? '已取消登录。你的绘画草稿已保留。'
  : '登录未完成，请重新登录。你的绘画草稿已保留。';
}

export async function restoreAuthSession(auth: AuthBootstrap, location?: CallbackLocation): Promise<{ session: Session | null; error: unknown; notice: string }> {
 let initializationError: unknown = null;
 try { initializationError = (await auth.initialize()).error; }
 catch (error) { initializationError = error; }

 // The SDK must finish reading/exchanging the callback before its URL is cleaned.
 if (location) {
  try {
   const href = location.readURL();
   const clean = cleanOAuthCallbackURL(href);
   if (clean !== href) location.replaceURL(clean);
  } catch { /* URL cleanup must not prevent session restoration. */ }
 }

 try {
  const { data, error } = await auth.getSession();
  return { session: data.session, error: initializationError ?? error, notice: initializationError ? oauthErrorNotice(initializationError) : error ? '登录状态读取失败，请重试。' : '' };
 } catch (error) {
  return { session: null, error: initializationError ?? error, notice: initializationError ? oauthErrorNotice(initializationError) : '登录状态读取失败，请重试。' };
 }
}
