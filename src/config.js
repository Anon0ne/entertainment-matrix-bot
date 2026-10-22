export function config(env = process.env) {
  const required = key => { if (!env[key]?.trim()) throw new Error(`Missing ${key}`); return env[key].trim(); };
  const list = key => required(key).split(',').map(x => x.trim()).filter(Boolean);
  const boolean = (key, fallback = false) => {
    const value = (env[key] ?? String(fallback)).trim().toLowerCase();
    if (value !== 'true' && value !== 'false') throw new Error(`Invalid ${key}`);
    return value === 'true';
  };
  const url = key => { const value = required(key); if (!['http:', 'https:'].includes(new URL(value).protocol)) throw new Error(`Invalid ${key}`); return value; };
  const positive = (key, fallback) => { const value = Number(env[key] || fallback); if (!Number.isInteger(value) || value < 1) throw new Error(`Invalid ${key}`); return value; };
  const arr = prefix => ({ url: url(`${prefix}_URL`), key: required(`${prefix}_API_KEY`), root: required(`${prefix}_ROOT_FOLDER`), profile: positive(`${prefix}_QUALITY_PROFILE_ID`) });
  return { homeserver: url('MATRIX_HOMESERVER_URL'), token: required('MATRIX_ACCESS_TOKEN'), rooms: list('MATRIX_ROOM_IDS'), users: list('MATRIX_ALLOWED_USERS'), encryption: boolean('MATRIX_ENCRYPTION_ENABLED'), data: env.DATA_DIR || './data', interval: positive('PLEX_POLL_SECONDS', 60) * 1000, plex: { url: url('PLEX_URL'), token: required('PLEX_TOKEN') }, movie: arr('RADARR'), tv: arr('SONARR') };
}

