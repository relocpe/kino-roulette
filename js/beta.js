export const isBeta = (v) => v === true;

export function betaFromQuery(search) {
  const v = new URLSearchParams(search || '').get('beta');
  if (v === '1') return true;
  if (v === '0') return false;
  return null;
}

export const betaAttr = (on) => (on ? '1' : '');
