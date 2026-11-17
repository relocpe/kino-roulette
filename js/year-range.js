export const YEAR_RANGE_MIN = 1900;
export const YEAR_RANGE_MAX = new Date().getFullYear();

function clampYear(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const year = Number(value);
  return Number.isFinite(year)
    ? Math.max(YEAR_RANGE_MIN, Math.min(YEAR_RANGE_MAX, Math.round(year)))
    : fallback;
}

export function mountYearRange(host, { from, to, onInput, onChange } = {}) {
  const span0 = YEAR_RANGE_MAX - YEAR_RANGE_MIN || 1;
  const ticks = [1920, 1950, 1980, 2010, YEAR_RANGE_MAX].map((y) => `<span data-y="${y}" style="--t:${(y - YEAR_RANGE_MIN) / span0}">${y}</span>`).join('');
  host.innerHTML = `
    <div class="year-range" data-year-range>
      <div class="year-range-values" aria-hidden="true">
        <div class="yr-val"><small>от</small><output data-year-from-value></output></div><i class="yr-dash"></i>
        <div class="yr-val"><small>до</small><output data-year-to-value></output></div>
      </div>
      <div class="year-range-track" data-year-track>
        <div class="year-range-selected"></div>
        <input type="range" min="${YEAR_RANGE_MIN}" max="${YEAR_RANGE_MAX}" step="1" data-year-from aria-label="Год от">
        <input type="range" min="${YEAR_RANGE_MIN}" max="${YEAR_RANGE_MAX}" step="1" data-year-to aria-label="Год до">
      </div>
      <div class="year-range-ruler" aria-hidden="true"></div>
      <div class="year-range-scale" aria-hidden="true">${ticks}</div>
    </div>`;
  const range = host.querySelector('[data-year-range]');
  const lower = range.querySelector('[data-year-from]');
  const upper = range.querySelector('[data-year-to]');
  const lowerValue = range.querySelector('[data-year-from-value]');
  const upperValue = range.querySelector('[data-year-to-value]');
  const track = range.querySelector('[data-year-track]');

  function selectedYears() {
    const lo = Number(lower.value), hi = Number(upper.value);
    return {
      from: lo > YEAR_RANGE_MIN ? lo : undefined,
      to: hi < YEAR_RANGE_MAX ? hi : undefined,
    };
  }

  function sync() {
    const lo = Number(lower.value), hi = Number(upper.value);
    const span = YEAR_RANGE_MAX - YEAR_RANGE_MIN || 1;
    range.style.setProperty('--year-from', String((lo - YEAR_RANGE_MIN) / span));
    range.style.setProperty('--year-to', String((hi - YEAR_RANGE_MIN) / span));
    lowerValue.textContent = lo;
    upperValue.textContent = hi;
    range.querySelectorAll('.year-range-scale span').forEach((t) => t.classList.toggle('in', +t.dataset.y >= lo && +t.dataset.y <= hi));
    lower.setAttribute('aria-valuetext', lo > YEAR_RANGE_MIN ? String(lo) : 'Любой год');
    upper.setAttribute('aria-valuetext', hi < YEAR_RANGE_MAX ? String(hi) : 'Текущий год');
  }

  function set(nextFrom, nextTo) {
    let lo = clampYear(nextFrom, YEAR_RANGE_MIN);
    let hi = clampYear(nextTo, YEAR_RANGE_MAX);
    if (lo > hi) [lo, hi] = [hi, lo];
    lower.value = String(lo);
    upper.value = String(hi);
    sync();
  }

  function update(which) {
    let lo = Number(lower.value), hi = Number(upper.value);
    if (lo > hi) {
      if (which === 'from') hi = lo;
      else lo = hi;
      lower.value = String(lo);
      upper.value = String(hi);
    }
    sync();
    return selectedYears();
  }

  lower.addEventListener('input', () => onInput?.(update('from')));
  upper.addEventListener('input', () => onInput?.(update('to')));
  lower.addEventListener('change', () => onChange?.(selectedYears()));
  upper.addEventListener('change', () => onChange?.(selectedYears()));
  track.addEventListener('pointerdown', (event) => {
    if (event.target.closest('input')) return;
    const bounds = track.getBoundingClientRect();
    if (!bounds.width) return;
    event.preventDefault();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left - 12) / (bounds.width - 24)));
    const year = Math.round(YEAR_RANGE_MIN + ratio * (YEAR_RANGE_MAX - YEAR_RANGE_MIN));
    const which = Math.abs(year - Number(lower.value)) <= Math.abs(year - Number(upper.value)) ? 'from' : 'to';
    (which === 'from' ? lower : upper).value = String(year);
    const selected = update(which);
    onInput?.(selected);
    onChange?.(selected);
  });

  set(from, to);
  return set;
}
