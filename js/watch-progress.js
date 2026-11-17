// Прогресс онлайн-просмотра в модалке (локально). Позицию внутри чужого iframe прочитать нельзя —
// копим время, пока открыт плеер и вкладка видима; для фильмов сравниваем с длительностью из IMDb.
const KEY = 'kr:watchprog';
const DONE = 0.9;
const MIN_SHOW = 45;

let data = {};
try { data = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}

function save() {
  try {
    const keys = Object.keys(data);
    if (keys.length > 800) keys.sort((a, b) => (data[b].updated || 0) - (data[a].updated || 0)).slice(400).forEach((k) => delete data[k]);
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function runtimeSec(t) {
  if (t?.s > 0) return Math.round(t.s);
  if (/tvSeries|tvMiniSeries/.test(t?.k || '')) return 45 * 60;
  return 100 * 60;
}

export function getProgress(id) {
  return id ? data[id] || null : null;
}

export function clearProgress(id) {
  if (!id || !data[id]) return;
  delete data[id];
  save();
}

export function touchProgress(id, deltaSec, t) {
  if (!id || deltaSec <= 0) return null;
  const dur = runtimeSec(t);
  const cur = data[id] || { seconds: 0, dur, updated: 0 };
  if (!cur.dur) cur.dur = dur;
  cur.seconds = Math.min(cur.dur, cur.seconds + deltaSec);
  cur.updated = Date.now();
  if (cur.seconds >= cur.dur * DONE) cur.complete = true;
  data[id] = cur;
  save();
  return cur;
}

export function fraction(id, t) {
  const p = getProgress(id);
  if (!p?.seconds) return 0;
  const dur = p.dur || runtimeSec(t);
  return dur ? p.seconds / dur : 0;
}

export function inProgress(id, t) {
  const p = getProgress(id);
  return !!(p && !p.complete && p.seconds >= MIN_SHOW);
}

export function formatClock(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function watchButtonText(t) {
  const p = getProgress(t.id);
  if (p && !p.complete && p.seconds >= MIN_SHOW) {
    const dur = p.dur || runtimeSec(t);
    const pct = Math.min(99, Math.round((100 * p.seconds) / dur));
    return { label: `Продолжить · ${pct}%`, hint: `Остановились на ${formatClock(p.seconds)}` };
  }
  return { label: 'Смотреть', hint: '' };
}

export function progressNote(t) {
  const { hint } = watchButtonText(t);
  return hint;
}

export function isComplete(id, t) {
  const p = getProgress(id);
  if (p?.complete) return true;
  return fraction(id, t) >= DONE;
}