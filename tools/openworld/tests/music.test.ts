import { test } from 'node:test';
import assert from 'node:assert/strict';
import { musicURL, readMusicHistory, rememberMusicTrack, musicProgress } from '../lib/music.ts';
const first = 'https://soundcloud.com/artist/first';
const second = 'https://soundcloud.com/artist/second';
test('stored music accepts only SoundCloud tracks and removes duplicate tracking links', () => {
 assert.equal(musicURL('https://www.soundcloud.com/artist/first?si=abc&utm_source=clipboard#t=10'), first);
 assert.equal(musicURL('https://evil.test/artist/first'), null);
 assert.equal(musicURL('https://soundcloud.com:443/artist/first'), null);
 const result = readMusicHistory([{ url: first, title: '第一首', position: 42000 }, { url: first + '?si=duplicate', position: 0 }, { url: 'javascript:alert(1)' }, { url: second, position: Infinity }]);
 assert.equal(result.length, 2); assert.equal(result[0].position, 42000); assert.equal(result[1].position, 0);
});
test('reopening music keeps its position and moves it to the front of the local library', () => {
 let history = rememberMusicTrack([], { url: first, position: 42000 });
 history = rememberMusicTrack(history, { url: second });
 history = rememberMusicTrack(history, { url: first });
 assert.deepEqual(history.map(track => track.url), [first, second]); assert.equal(history[0].position, 42000);
 history = musicProgress(history, first, 45000);
 assert.equal(history[0].position, 45000); assert.equal(readMusicHistory(JSON.parse(JSON.stringify(history)))[0].position, 45000);
 assert.equal(musicProgress(history, first, -100)[0].position, 0);
});
test('music history remains bounded and invalid persisted progress cannot be restored', () => {
 let history: ReturnType<typeof readMusicHistory> = [];
 for (let i = 0; i < 60; i++) history = rememberMusicTrack(history, { url: `https://soundcloud.com/artist/track-${i}` });
 assert.equal(history.length, 50); assert.ok(history[0].url.endsWith('track-59')); assert.ok(history[49].url.endsWith('track-10'));
 assert.deepEqual(readMusicHistory({ url: first }), []);
 assert.equal(readMusicHistory([{ url: first, position: '123' }])[0].position, 0);
});
