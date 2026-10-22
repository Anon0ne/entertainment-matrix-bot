# Entertainment Matrix Bot

A Node.js bot using Element's `@vector-im/matrix-bot-sdk` to announce new Plex additions and request movies through Radarr and series through Sonarr. End-to-end encryption support is optional.

## Setup

1. Install Node.js 24 or newer, then run `npm ci`.
2. Copy `.env.example` to `.env` and fill in the settings. Keep `.env` private.
3. Create a dedicated Matrix bot account and obtain its access token. Invite it to each configured room. Set `MATRIX_ROOM_IDS` to actual room IDs (`!…:server`), not aliases. Add the full Matrix IDs of permitted requesters to `MATRIX_ALLOWED_USERS`. Comma separates multiple entries. To use encrypted rooms, set `MATRIX_ENCRYPTION_ENABLED=true` before starting the bot; the default is `false`.
4. Supply Plex's server URL and token. Supply each media manager's base URL and API key from Settings → General, root folder path, and quality profile ID. Root paths are paths **inside Sonarr/Radarr**, not inside this bot. Profile IDs can be read from `GET /api/v3/qualityprofile` with the `X-Api-Key` header; root folders from `GET /api/v3/rootfolder`.
5. Start with `npm start`, or `docker compose up -d --build`.

On Windows PowerShell, create the private configuration with `Copy-Item .env.example .env`. On Linux/macOS use `cp .env.example .env`. Edit the copied file before starting. Never commit access tokens or API keys.

### Configuration reference

| Variable | Purpose |
| --- | --- |
| `MATRIX_HOMESERVER_URL` | Matrix client API base URL, including a port if required. |
| `MATRIX_ACCESS_TOKEN` | Dedicated bot account access token. |
| `MATRIX_ROOM_IDS` | Comma-separated IDs of rooms where commands and Plex alerts are enabled. |
| `MATRIX_ALLOWED_USERS` | Comma-separated full Matrix IDs allowed to issue commands. |
| `MATRIX_ENCRYPTION_ENABLED` | Set to `true` to enable end-to-end encryption for configured rooms; defaults to `false`. |
| `PLEX_URL` / `PLEX_TOKEN` | Plex Media Server URL and authentication token. |
| `PLEX_POLL_SECONDS` | Poll interval, defaults to 60 seconds. |
| `RADARR_URL` / `RADARR_API_KEY` | Radarr base URL and API key. |
| `RADARR_ROOT_FOLDER` / `RADARR_QUALITY_PROFILE_ID` | Movie destination and quality profile ID from Radarr. |
| `SONARR_URL` / `SONARR_API_KEY` | Sonarr base URL and API key. |
| `SONARR_ROOT_FOLDER` / `SONARR_QUALITY_PROFILE_ID` | Series destination and quality profile ID from Sonarr. |
| `DATA_DIR` | Persistent storage path; defaults to `./data`. |

For a native install on the same machine as your media services, common URLs are `http://127.0.0.1:32400`, `http://127.0.0.1:7878`, and `http://127.0.0.1:8989`. Windows root folder examples are `F:/Movies` and `F:/TV`; verify the exact paths in your media managers.

Use URLs reachable from the bot. In Docker, `localhost` refers to the bot container; use your server's hostname/IP or a shared Docker network. Preserve the `data` directory (Docker uses a named volume) to retain the Matrix sync position, Plex alert history, and encryption keys. The encryption store is created at `data/matrix-crypto` when encryption is enabled. Back up and protect the full data directory: losing the crypto store can prevent the bot from decrypting room history, and the access token/device identity must remain stable across restarts. Run one bot process per data directory and Matrix account.

All three services are required by this initial version. No credentials are included, and live services must be configured before the bot can run.

## Commands

| Command | Action |
| --- | --- |
| `!help` | Display available commands. |
| `!movie <title>` | Search Radarr for up to five movie matches. |
| `!tv <title>` | Search Sonarr for up to five series matches. |
| `!pick <number>` | Preview a search result with artwork and a trailer link. |
| `!confirm` | Add the selected title and start a download search. |
| `!cancel` | Discard your current search. |

```text
!movie Alien 1979
!tv Severance
!pick 1
!confirm
!cancel
!help
```

Search returns up to five numbered matches. Pick one to receive a preview with its cover and trailer link, then confirm within ten minutes. Search selections belong to the requester and room. Requests add monitored titles and start an automatic download search; acceptance does not guarantee a download. TV requests monitor all regular seasons and exclude specials. Existing titles are reported without changing monitoring or launching another search. Responses include an uploaded Matrix image when artwork is available. Missing trailer metadata produces a labeled YouTube search link; it is not a verified trailer URL. No TMDB key is required.

Only configured rooms and users can issue commands. Invites are accepted only for configured room IDs from allowed users. Old timeline messages, edits, and self messages are ignored. The bot serializes command handling to prevent overlapping adds within this process. With encryption enabled, the SDK decrypts incoming room messages and encrypts bot replies and media automatically. The setting enables crypto support; it does not change a room's encryption state. Create or configure encrypted rooms in your Matrix client, then invite the bot. If a configured room is encrypted while the setting is off, startup fails with a configuration error.

## Troubleshooting

- **No reply to `!help`:** Verify the command is in a configured room, sent by an allowed user, and sent from an account different from the bot. Check the bot has permission to send messages under the room's Roles & Permissions. A Moderator role is sufficient only if its power level meets the room's message requirement. A Matrix space and a room inside that space have different IDs; configure the actual chat room.
- **Changed `.env`:** Restart the native process with `npm start` after stopping the old process. For Docker use `docker compose up -d --force-recreate`.
- **`Missing ...` at startup:** Fill in the named variable. All three media services and at least one allowed user are required.
- **Media connection errors:** Check URLs from the bot host. Names such as `plex`, `radarr`, and `sonarr` normally require a shared Docker network. Use `127.0.0.1` only when the service shares the bot's host network.
- **Request rejected:** Verify the API key, quality profile ID, and root folder. The destination must already be configured in Sonarr/Radarr.
- **Plex alerts stop:** Check the token, network connection, persistent data permissions, and bot message permissions. Logs report failed polls and retry on the next interval.
- **No old Plex alerts on first run:** This is expected; the first poll records a silent baseline.

For Docker logs use `docker compose logs -f bot`; stop with `docker compose down`. For a foreground native install, stop with Ctrl+C. The native process needs a service manager for automatic startup after reboot.

## Sharing and contributing

The source archive includes `.env.example` with blank credential fields. Your `.env`, dependencies, runtime history, and logs are excluded. To create a source archive from a committed checkout, use `git archive --format=zip --prefix=entertainment-matrix-bot/ --output=entertainment-matrix-bot.zip HEAD`.

Before submitting changes, run `npm ci`, `npm test`, and `npm run check`. Keep examples generic and do not include tokens, private server details, or runtime data in issues or pull requests.

## Plex alerts

The bot polls Plex's recently added endpoint every 60 seconds by default. The first successful poll silently records existing entries. Later polls announce unseen entries oldest first, with per-room delivery history and retries on failures. It pages through the endpoint's available results. Plex may group TV additions into show/season entries; this is not an individual episode event feed. Items that disappear from Plex's recent feed during a long outage cannot be recovered by this approach.

State is written atomically after each successful room notification. A crash between sending a message and saving state can produce a repeated alert. Keep the data volume private: it contains Matrix sync state and media IDs. Deleting Plex state creates a new silent baseline. Delivery history grows with the library. Covers are optional: a failed image upload does not block the text notification.

## Verification

```sh
npm test
npm run check
```

Tests cover confirmation gating, unauthorized users, repeated Matrix events, existing media, TV monitoring, first-poll behavior, per-room retry, HTML escaping, and trailer fallback. They use fake services and do not contact your library. After configuration, verify one movie and one TV request in a test room, repeat a request to check the duplicate response, then import an item into Plex and check its alert after a poll.

## Matrix encryption

End-to-end encryption is disabled by default. Set `MATRIX_ENCRYPTION_ENABLED=true` to enable the Element-maintained bot SDK's Rust-backed crypto support. Existing unencrypted rooms continue to work with this option enabled. The bot does not create rooms or turn encryption on for existing rooms; use a Matrix client to create an encrypted room and invite the bot.

The crypto database is separate from `matrix.json` and lives under `DATA_DIR/matrix-crypto`. Keep the entire data directory persistent and backed up, and restrict access to it because it contains the bot's cryptographic state. Do not run multiple bot processes with the same account or data directory. If the crypto store is lost, encrypted history may no longer be decryptable by the bot.

## Suggested next features

- Requester mentions when their title becomes available in Plex, backed by persistent request tracking and provider ID matching.
- Per-user quotas and an admin approval queue.
- Season-specific TV requests, rather than monitoring an entire series.
- Download progress and failure commands.
- Daily digest and quiet hours for busy libraries.

## References

- [Matrix introductory guide](https://matrix.org/docs/older/matrix-bot-sdk-intro/) (marked outdated)
- [Current SDK documentation](https://element-hq.github.io/matrix-bot-sdk/)
- [Sonarr API](https://sonarr.tv/docs/api/)
- [Radarr API](https://radarr.video/docs/api/)
- [Plex API](https://developer.plex.tv/pms/)

