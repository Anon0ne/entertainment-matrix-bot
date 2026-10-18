import { card } from './cards.js';
export const HELP = 'Entertainment bot commands:\n!movie <title> — search movies\n!tv <title> — search series\n!pick <number> — preview a result\n!confirm — add the selected title and search for downloads\n!cancel — discard your search\n!help — show commands\nSelections expire after 10 minutes. TV requests monitor all regular seasons. Existing titles are reported without changing their settings.';
export class Bot {
  constructor({ client, services, rooms, users, imageLoader, now = Date.now }) {
    Object.assign(this, { client, services, rooms, users, imageLoader, now });
    this.sessions = new Map(); this.recentEvents = new Set(); this.cooldowns = new Map();
  }
  async handle(room, event) {
    if (!this.rooms.includes(room) || !this.users.includes(event.sender) || event.content?.msgtype !== 'm.text' || event.content?.['m.relates_to']?.rel_type === 'm.replace') return;
    if (!event.event_id || this.recentEvents.has(event.event_id) || !Number.isFinite(event.origin_server_ts) || this.now() - event.origin_server_ts > 120000) return;
    const match = /^!(help|movie|tv|pick|confirm|cancel)(?:\s+(.*))?$/is.exec(event.content.body || '');
    if (!match) return;
    this.recentEvents.add(event.event_id);
    if (this.recentEvents.size > 5000) this.recentEvents.delete(this.recentEvents.values().next().value);
    const key = `${room}/${event.sender}`;
    const [ , commandRaw, argument = '' ] = match;
    const command = commandRaw.toLowerCase();
    const say = text => this.client.sendText(room, text);
    if (command === 'help') return say(HELP);
    if (command === 'cancel') { this.sessions.delete(key); return say('Search cancelled.'); }
    if (command === 'movie' || command === 'tv') {
      if (!argument.trim() || argument.length > 200) return say(`Usage: !${command} <title up to 200 characters>`);
      if (this.now() - (this.cooldowns.get(key) ?? -Infinity) < 3000) return say('Please wait a few seconds before searching again.');
      this.cooldowns.set(key, this.now());
      this.sessions.delete(key);
      for (const [id, session] of this.sessions) if (session.expires < this.now()) this.sessions.delete(id);
      const results = (await this.services[command].search(argument.trim())).slice(0, 5);
      if (!results.length) return say('No matches found. Try a different title or include the year.');
      this.sessions.set(key, { kind: command, results, expires: this.now() + 600000 });
      return say(results.map((x, i) => `${i + 1}. ${x.title} (${x.year || 'year unknown'})`).join('\n') + '\nReply !pick <number> to preview a title.');
    }
    const session = this.sessions.get(key);
    if (!session || session.expires < this.now()) { this.sessions.delete(key); return say('Search expired or missing. Start with !movie <title> or !tv <title>.'); }
    if (command === 'pick') {
      if (!/^[1-5]$/.test(argument.trim()) || !session.results[Number(argument) - 1]) return say('Choose one of the result numbers shown above.');
      session.selected = session.results[Number(argument) - 1];
      await card(this.client, room, session.selected, 'Request preview — reply !confirm to request, or !cancel', this.imageLoader);
      return;
    }
    if (!session.selected) return say('Use !pick <number> before confirming.');
    const result = await this.services[session.kind].add(session.selected);
    this.sessions.delete(key);
    await card(this.client, room, { ...session.selected, ...result.item }, result.existing ? 'Already in your media manager' : 'Request accepted — download search started', this.imageLoader);
  }
}
