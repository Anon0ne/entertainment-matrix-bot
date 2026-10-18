import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
export async function loadState(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return { initialized: false, delivered: {} }; }
}
export async function saveState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify(state), { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}
export async function pollPlex(plex, state, rooms, notify, persist) {
  const items = await plex.recent();
  if (!state.initialized) {
    for (const item of items) state.delivered[item.ratingKey] = [...rooms];
    state.initialized = true;
    await persist();
    return;
  }
  for (const item of items.reverse()) {
    const delivered = state.delivered[item.ratingKey] ||= [];
    for (const room of rooms) {
      if (delivered.includes(room)) continue;
      await notify(room, item);
      delivered.push(room);
      await persist();
    }
  }
}
