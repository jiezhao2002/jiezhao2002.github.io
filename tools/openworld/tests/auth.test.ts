import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthError, AuthImplicitGrantRedirectError, type Session } from '@supabase/supabase-js';
import { cleanOAuthCallbackURL, oauthErrorNotice, restoreAuthSession } from '../lib/auth.ts';
import { emptyResidentDraft, resolveAccountDraft } from '../lib/world.ts';

const session: Session = {
 access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600,
 user: { id: 'owner', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-06T00:00:00Z' },
};

test('initialization failure is surfaced even when getSession returns no error', async () => {
 const error = new AuthImplicitGrantRedirectError('Provider detail must not be displayed', { error: 'access_denied', code: 'provider_error' });
 const result = await restoreAuthSession({ initialize: async () => ({ error }), getSession: async () => ({ data: { session: null }, error: null }) });
 assert.equal(result.error, error);
 assert.equal(result.session, null);
 assert.equal(result.notice, '已取消登录。你的绘画草稿已保留。');
 assert.ok(!result.notice.includes(error.message));
});

test('callback cleanup waits for SDK initialization, preserves other URL state, and retains an existing session on failure', async () => {
 const events: string[] = [];
 let release!: () => void;
 const initialized = new Promise<void>(resolve => { release = resolve; });
 let href = 'https://jiezhao2002.github.io/openworld/?view=world&code=test-code&term=a%20b#tab=you&error=server_error&error_description=private%20detail';
 const error = new AuthError('Private provider error', 400, 'bad_code');
 const pending = restoreAuthSession({
  initialize: async () => { events.push('initialize'); await initialized; events.push('initialized'); return { error }; },
  getSession: async () => { events.push('session'); return { data: { session }, error: null }; },
 }, { readURL: () => href, replaceURL: url => { events.push('cleanup'); href = url; } });
 assert.deepEqual(events, ['initialize']);
 assert.ok(href.includes('test-code'));
 release();
 const result = await pending;
 assert.deepEqual(events, ['initialize', 'initialized', 'cleanup', 'session']);
 assert.equal(href, 'https://jiezhao2002.github.io/openworld/?view=world&term=a%20b#tab=you');
 assert.equal(result.session, session);
 assert.equal(result.error, error);
 assert.equal(result.notice, '登录未完成，请重新登录。你的绘画草稿已保留。');
});

test('successful PKCE restoration uses the SDK once and resumes the anonymous draft under the signed-in owner', async () => {
 const anonymous = emptyResidentDraft();
 anonymous.avatar[0] = '#123456';
 anonymous.messages[0].text = '登录前的绘画';
 const original = JSON.stringify(anonymous);
 let href = 'https://jiezhao2002.github.io/openworld/?code=test-code&view=world#drawing';
 let initializationCalls = 0;
 const result = await restoreAuthSession({
  initialize: async () => { initializationCalls++; href = href.replace('code=test-code&', ''); return { error: null }; },
  getSession: async () => ({ data: { session }, error: null }),
 }, { readURL: () => href, replaceURL: () => { assert.fail('The SDK already removed the successful callback code'); } });
 assert.equal(initializationCalls, 1);
 assert.equal(result.error, null);
 assert.equal(result.notice, '');
 const resumed = resolveAccountDraft(result.session!.user.id, null, anonymous);
 assert.equal(resumed.draft.user_id, 'owner');
 assert.deepEqual(resumed.draft.avatar, anonymous.avatar);
 assert.deepEqual(resumed.draft.messages, anonymous.messages);
 assert.equal(resumed.adoptedAnonymous, true);
 assert.equal(JSON.stringify(anonymous), original);
 assert.equal(href, 'https://jiezhao2002.github.io/openworld/?view=world#drawing');
});

test('cleanup removes OAuth query/hash error parameters without changing normal anchors or unrelated values', () => {
 assert.equal(cleanOAuthCallbackURL('https://example.com/?error=access_denied&error_code=400&error_description=private&view=a%2Bb#section'), 'https://example.com/?view=a%2Bb#section');
 assert.equal(cleanOAuthCallbackURL('https://example.com/?view=you#error=access_denied&error_code=400&error_description=private&theme=white%20canvas'), 'https://example.com/?view=you#theme=white%20canvas');
 assert.equal(cleanOAuthCallbackURL('https://example.com/?view=you#code'), 'https://example.com/?view=you#code');
 assert.equal(cleanOAuthCallbackURL('https://example.com/?view=you&state=keep&%ZZ=value#drawing'), 'https://example.com/?view=you&state=keep&%ZZ=value#drawing');
 assert.equal(cleanOAuthCallbackURL('https://example.com/?code=x#error=server_error'), 'https://example.com/');
 assert.ok(!oauthErrorNotice(new Error('client_secret=private code=private')).includes('private'));
});
