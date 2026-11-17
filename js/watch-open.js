// Что делать, когда в комнату заходят с конкретным фильмом.
// Прошлая комната не должна подменять только что выбранный тайтл.
export function decideWatchOpen({ host, createdHere, boot, film }) {
  const picked = boot?.id || '';
  const ready = !!(picked && film?.id === picked && (film.embedUrl || film.pageUrl));
  if (!picked) return (film?.embedUrl || film?.pageUrl || film?.id) ? 'room' : 'wait';
  if (!host && !createdHere && !ready) return 'own-room';
  if (ready) return 'saved';
  return 'play-boot';
}
