import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sdk from 'matrix-bot-sdk';
import { config } from './config.js';
import { Arr, Plex } from './services.js';
import { Bot } from './bot.js';
import { card } from './cards.js';
import { loadState, saveState, pollPlex } from './state.js';

async function main() {
  const c = config();
  await mkdir(c.data, { recursive: true });
  const client = new sdk.MatrixClient(c.homeserver, c.token, new sdk.SimpleFsStorageProvider(join(c.data, 'matrix.json')));
  const self = await client.getUserId();
  const plex = new Plex(c.plex);
  const imageLoader = async item => {
    const poster = item.images?.find(x => x.coverType === 'poster');
    const remote = poster?.remoteUrl || poster?.url;
    let url, headers = {};
    if (item.thumb) {
      url = new URL(item.thumb, `${c.plex.url.replace(/\/$/, '')}/`);
      if (url.origin !== new URL(c.plex.url).origin) return null;
      headers['X-Plex-Token'] = c.plex.token;
    } else if (remote) {
      url = new URL(remote);
      if (url.protocol !== 'https:') return null;
    } else return null;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error('Cover fetch failed');
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return null;
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) throw new Error('Cover too large');
      chunks.push(chunk);
    }
    return { bytes: Buffer.concat(chunks), type };
  };
  const bot = new Bot({ client, services: { movie: new Arr('movie', c.movie), tv: new Arr('tv', c.tv) }, rooms: c.rooms, users: c.users, imageLoader });
  let ready = false;
  let queue = Promise.resolve();
  client.on('room.message', (room, event) => {
    if (!ready || event.sender === self) return;
    queue = queue.then(() => bot.handle(room, event)).catch(async () => {
      console.error('Command failed; check service connectivity and configuration.');
      if (c.rooms.includes(room) && c.users.includes(event.sender)) await client.sendText(room, 'Request could not be completed. Check the service configuration and try again; an existing request will not be added twice.').catch(() => {});
    });
  });
  client.on('room.invite', async (room, event) => {
    if (c.rooms.includes(room) && c.users.includes(event.sender)) await client.joinRoom(room).catch(() => console.error('Could not join configured room.'));
  });
  await client.start();
  for (const room of c.rooms) {
    try {
      await client.joinRoom(room);
      const state = await client.getRoomState(room);
      if (state.some(x => x.type === 'm.room.encryption')) throw new Error('Encrypted room');
    } catch { throw new Error('Cannot use configured room. Ensure the bot is invited and the room is unencrypted.'); }
  }
  const path = join(c.data, 'plex.json');
  ready = true;
  const state = await loadState(path);
  let stopped = false;
  const poll = async () => {
    try { await pollPlex(plex, state, c.rooms, (room, item) => card(client, room, item, 'New on Plex', imageLoader), () => saveState(path, state)); }
    catch { console.error('Plex poll failed; will retry on the next interval.'); }
    if (!stopped) timer = setTimeout(poll, c.interval);
  };
  let timer;
  await poll();
  console.log('Entertainment bot running.');
  const stop = () => { stopped = true; clearTimeout(timer); client.stop(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
main().catch(error => { console.error(error.message.startsWith('Missing ') || error.message.startsWith('Invalid ') || error.message.startsWith('Cannot use') ? error.message : 'Startup failed. Check credentials, connectivity, and persistent data.'); process.exit(1); });
