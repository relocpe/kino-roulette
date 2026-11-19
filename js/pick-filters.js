/** Регион и длительность для рулетки. Страна берётся из карточки, длительность — из runtime. */

export const REGIONS = {
  us: { label: 'США', cc: ['US'] },
  eu: { label: 'Европа', cc: ['GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IS', 'PL', 'CZ', 'HU', 'RO', 'GR', 'UA'] },
  ru: { label: 'Россия', cc: ['RU'] },
  asia: { label: 'Азия', cc: ['JP', 'KR', 'CN', 'HK', 'TW', 'TH'] },
  latam: { label: 'Латинская Америка', cc: ['MX', 'BR', 'AR', 'CL', 'CO'] },
};

export const DURS = {
  short: 'До 90 минут',
  mid: '90–120 минут',
  long: '2 часа и дольше',
};

export function passesRuntime(t, dur) {
  if (!dur || !DURS[dur]) return true;
  const sec = Number(t?.s) || 0;
  if (!sec) return false;
  const m = sec / 60;
  if (dur === 'short') return m <= 90;
  if (dur === 'mid') return m > 90 && m <= 120;
  return m > 120;
}

export function passesRegion(t, region) {
  if (!region || !REGIONS[region]) return true;
  const cc = t?.countries?.length ? t.countries : (t?.src === 'al' ? ['JP'] : []);
  if (!cc.length) return false;
  const want = new Set(REGIONS[region].cc);
  return cc.some((c) => want.has(c));
}
