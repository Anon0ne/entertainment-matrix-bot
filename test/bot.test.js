import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot } from '../src/bot.js';
import { Arr } from '../src/services.js';
import { pollPlex } from '../src/state.js';
import { escapeHtml, trailer } from '../src/cards.js';

test('requests require selection and confirmation and cannot be replayed', async () => {
  const messages = []; let adds = 0; let searches = 0;
  const service = { search: async () => { searches++; return [{ title: 'Alien', tmdbId: 348 }]; }, add: async item => { adds++; return { item }; } };
  const bot = new Bot({ client: { sendText: async (_, text) => messages.push(text), sendMessage: async (_, message) => messages.push(message.body) }, services: { movie: service }, rooms: ['room'], users: ['user'], imageLoader: async () => null, now: () => 10000 });
  let id = 0;
  const event = (body, sender = 'user') => ({ sender, event_id: String(++id), origin_server_ts: 10000, content: { msgtype: 'm.text', body } });
  await bot.handle('room', event('!movie Alien', 'stranger'));
  assert.equal(searches, 0);
  await bot.handle('room', event('!movie Alien'));
  await bot.handle('room', event('!confirm'));
  assert.equal(adds, 0);
  await bot.handle('room', event('!pick 1'));
  assert.equal(adds, 0);
  const confirm = event('!confirm');
  await bot.handle('room', confirm);
  await bot.handle('room', confirm);
  assert.equal(adds, 1);
  assert.ok(messages.some(x => x.includes('Request accepted')));
});

test('Plex baseline is quiet and failed room delivery retries independently', async () => {
  let items = [{ ratingKey: 'old' }];
  const plex = { recent: async () => [...items] };
  const state = { initialized: false, delivered: {} }; const sent = [];
  const persist = async () => {};
  await pollPlex(plex, state, ['a', 'b'], async () => assert.fail('baseline must be silent'), persist);
  items.push({ ratingKey: 'new' });
  await assert.rejects(pollPlex(plex, state, ['a', 'b'], async room => { if (room === 'b') throw Error('offline'); sent.push(room); }, persist));
  await pollPlex(plex, state, ['a', 'b'], async room => sent.push(room), persist);
  assert.deepEqual(sent, ['a', 'b']);
});

test('Arr does not POST an existing title and constructs TV monitoring options', async () => {
  const arr = new Arr('movie', {});
  arr.api = async path => { assert.equal(path, 'movie'); return [{ tmdbId: 348 }]; };
  assert.equal((await arr.add({ tmdbId: 348 })).existing, true);
  const tv = new Arr('tv', { root: '/tv', profile: 7 });
  let payload;
  tv.api = async (_, options) => { if (!options) return []; payload = JSON.parse(options.body); return payload; };
  await tv.add({ tvdbId: 1, seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }] });
  assert.equal(payload.qualityProfileId, 7);
  assert.equal(payload.seasons[0].monitored, false);
  assert.equal(payload.seasons[1].monitored, true);
  assert.equal(payload.addOptions.searchForMissingEpisodes, true);
});

test('cards escape upstream markup and distinguish trailer search links', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  assert.equal(trailer({ title: 'Alien' }).label, 'Find trailer on YouTube');
  assert.equal(trailer({ youTubeTrailerId: 'abc-123' }).url, 'https://www.youtube.com/watch?v=abc-123');
});
