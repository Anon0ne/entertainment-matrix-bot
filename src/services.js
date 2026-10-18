export async function json(url, headers = {}, options = {}) {
  const response = await fetch(url, { ...options, headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Service returned HTTP ${response.status}`);
  return response.json();
}

export class Arr {
  constructor(kind, config) { this.kind = kind; this.config = config; this.resource = kind === 'movie' ? 'movie' : 'series'; }
  api(path, options) {
    return json(`${this.config.url.replace(/\/$/, '')}/api/v3/${path}`, { 'X-Api-Key': this.config.key, 'Content-Type': 'application/json' }, options);
  }
  search(term) { return this.api(`${this.resource}/lookup?term=${encodeURIComponent(term)}`); }
  async add(item) {
    const idKey = this.kind === 'movie' ? 'tmdbId' : 'tvdbId';
    const existing = (await this.api(this.resource)).find(x => x[idKey] === item[idKey]);
    if (existing) return { item: existing, existing: true };
    const payload = { ...item, id: undefined, rootFolderPath: this.config.root, qualityProfileId: this.config.profile, monitored: true };
    if (this.kind === 'movie') Object.assign(payload, { minimumAvailability: 'released', addOptions: { searchForMovie: true } });
    else Object.assign(payload, { seasonFolder: true, seriesType: 'standard', seasons: (item.seasons || []).map(s => ({ ...s, monitored: s.seasonNumber > 0 })), addOptions: { searchForMissingEpisodes: true } });
    return { item: await this.api(this.resource, { method: 'POST', body: JSON.stringify(payload) }), existing: false };
  }
}

export class Plex {
  constructor(config) { this.config = config; }
  api(path) { return json(`${this.config.url.replace(/\/$/, '')}${path}`, { 'X-Plex-Token': this.config.token }); }
  async recent() {
    const items = [];
    for (let offset = 0; ; offset += 100) {
      const { MediaContainer: c } = await this.api(`/library/recentlyAdded?X-Plex-Container-Start=${offset}&X-Plex-Container-Size=100`);
      items.push(...(c.Metadata || []));
      if (!(c.Metadata?.length) || offset + c.Metadata.length >= (c.totalSize ?? c.size)) break;
    }
    return items;
  }
}
