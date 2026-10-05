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
test('music keeps the resident source through progress, metadata and history restoration', () => {
 const source = { residentId: 'resident-a', name: '小树' };
 let history = rememberMusicTrack([], { url: first, source, position: 42000 });
 history = rememberMusicTrack(history, { url: second, source: { residentId: 'resident-b', name: '' } });
 assert.equal(history[0].source?.name, '佚名');
 history = rememberMusicTrack(history, { url: first });
 history = musicProgress(history, first, 45000);
 history = rememberMusicTrack(history, { url: first, title: '第一首', author: '真实作者' });
 const restored = readMusicHistory(JSON.parse(JSON.stringify(history)));
 assert.deepEqual(restored[0].source, source);
 assert.equal(restored[0].position, 45000);
 assert.equal(restored[0].author, '真实作者');
 assert.equal(restored[0].title, '第一首');
});
test('the newest resident sharing the same track replaces the previous attribution', () => {
 let history = rememberMusicTrack([], { url: first, source: { residentId: 'resident-a', name: '小树' }, position: 1000 });
 history = rememberMusicTrack(history, { url: first, source: { residentId: 'resident-b', name: '远方' } });
 assert.equal(history.length, 1);
 assert.deepEqual(history[0].source, { residentId: 'resident-b', name: '远方' });
 assert.equal(history[0].position, 1000);
});
test('old records have an author fallback without inventing a resident source', () => {
 const record = readMusicHistory([{ url: first, title: '旧曲目', position: 500 }])[0];
 assert.equal(record.author, 'artist');
 assert.equal(record.source, undefined);
 assert.equal(rememberMusicTrack([record], { url: first })[0].source, undefined);
});
test('stored attribution and author metadata are validated and bounded', () => {
 const records = readMusicHistory([
  { url: first, source: { residentId: 'resident-a', name: '名'.repeat(40) }, author: 'a'.repeat(100) },
  { url: second, source: { residentId: 'id'.repeat(101), name: '伪来源' }, author: {} },
  { url: 'https://soundcloud.com/artist/third', source: { residentId: 'resident-c', name: 2 } },
  { url: 'https://soundcloud.com/artist/fourth', source: { residentId: '', name: '伪来源' } },
 ]);
 assert.equal(records[0].source?.name.length, 30);
 assert.equal(records[0].author.length, 80);
 assert.equal(records[1].source, undefined);
 assert.equal(records[1].author, 'artist');
 assert.equal(records[2].source, undefined);
 assert.equal(records[3].source, undefined);
});
