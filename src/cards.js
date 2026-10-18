export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function trailer(item) {
  return item.youTubeTrailerId && /^[\w-]+$/.test(item.youTubeTrailerId)
    ? { label: 'Watch trailer', url: `https://www.youtube.com/watch?v=${item.youTubeTrailerId}` }
    : { label: 'Find trailer on YouTube', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.grandparentTitle || item.title} ${item.year || ''} official trailer`)}` };
}
export async function card(client, room, item, heading, imageLoader) {
  const title = `${item.grandparentTitle ? `${item.grandparentTitle}: ` : ''}${item.title}${item.year ? ` (${item.year})` : ''}`;
  const link = trailer(item);
  await client.sendMessage(room, { msgtype: 'm.notice', body: `${heading}\n${title}\n${(item.overview || item.summary || '').slice(0, 700)}\n${link.label}: ${link.url}`, format: 'org.matrix.custom.html', formatted_body: `<b>${escapeHtml(heading)}</b><br><b>${escapeHtml(title)}</b><p>${escapeHtml((item.overview || item.summary || '').slice(0, 700))}</p><a href="${escapeHtml(link.url)}">${link.label}</a>` });
  try {
    const image = await imageLoader(item);
    if (image) {
      const mxc = await client.uploadContent(image.bytes, image.type, 'cover');
      await client.sendMessage(room, { msgtype: 'm.image', body: `${title} — cover`, url: mxc, info: { mimetype: image.type, size: image.bytes.length } });
    }
  } catch { await client.sendText(room, 'Cover unavailable.'); }
}
