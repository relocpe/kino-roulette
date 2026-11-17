// «Поделиться»: ссылка на /title/:id через системное меню и картинка для сторис 1080×1920 (постер, название, рейтинг, сайт)
import { poster } from './api.js?v=19';
const SITE = 'relocpe.github.io/kino-roulette';
const loadImg = (src) => new Promise((res) => {
  if (!src) return res(null);
  const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
  const t = setTimeout(() => res(null), 8000);
  im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); };
  im.src = src + (src.includes('?') ? '&' : '?') + 'cors=1';
});
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrap(ctx, text, maxW, maxLines) {
  const words = text.split(/\s+/), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const l = lines.slice(0, maxLines); let s = l[maxLines - 1]; while (ctx.measureText(s + '…').width > maxW && s.length) s = s.slice(0, -1); l[maxLines - 1] = s.trimEnd() + '…'; return l; }
  return lines;
}
export async function storyBlob(t, title, meta) {
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  try { await document.fonts?.load('700 80px Golos'); await document.fonts?.load('500 40px Golos'); } catch {}
  const img = await loadImg(t.i ? poster(t.i, 720) : '');
  ctx.fillStyle = '#0c0b0a'; ctx.fillRect(0, 0, W, H);
  if (img) { // размытый постер на фоне: в старом Safari нет ctx.filter, тогда просто приглушённый и растянутый
    ctx.save(); if ('filter' in ctx) ctx.filter = 'blur(70px) saturate(1.2)'; ctx.globalAlpha = 'filter' in ctx ? 0.55 : 0.22;
    const s = Math.max(W / img.width, H / img.height) * 1.15; ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s); ctx.restore();
  }
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(12,11,10,.55)'); g.addColorStop(0.55, 'rgba(12,11,10,.35)'); g.addColorStop(1, 'rgba(12,11,10,.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // шапка
  ctx.fillStyle = '#e8b04a'; ctx.beginPath(); ctx.arc(120, 150, 26, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = '#e8b04a'; ctx.stroke();
  for (const [dx, dy] of [[0, -12], [0, 12], [-12, 0], [12, 0]]) { ctx.beginPath(); ctx.arc(120 + dx, 150 + dy, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f1ebe2'; ctx.font = '600 44px Golos, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('Кинорулетка', 168, 152);
  ctx.fillStyle = 'rgba(241,235,226,.6)'; ctx.font = '500 34px Golos, sans-serif'; ctx.fillText('Выпало на вечер', 96, 250);
  // постер
  const pw = 720, ph = 1066, px = (W - pw) / 2, py = 310;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30; rr(ctx, px, py, pw, ph, 28); ctx.fillStyle = '#1b1814'; ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, px, py, pw, ph, 28); ctx.clip();
  if (img) { const s = Math.max(pw / img.width, ph / img.height); ctx.drawImage(img, px + (pw - img.width * s) / 2, py + (ph - img.height * s) / 2, img.width * s, img.height * s); }
  else { ctx.fillStyle = 'rgba(241,235,226,.7)'; ctx.font = '600 56px Golos, sans-serif'; ctx.textAlign = 'center'; wrap(ctx, title, pw - 120, 4).forEach((l, i) => ctx.fillText(l, W / 2, py + ph / 2 - 60 + i * 70)); ctx.textAlign = 'left'; }
  ctx.restore();
  // название и мета
  ctx.textAlign = 'center'; ctx.fillStyle = '#f1ebe2'; ctx.textBaseline = 'alphabetic';
  let fs = 80; ctx.font = `700 ${fs}px Golos, sans-serif`;
  let lines = wrap(ctx, title, W - 160, 2);
  if (lines.length > 1 || ctx.measureText(lines[0]).width > W - 160) { fs = 64; ctx.font = `700 ${fs}px Golos, sans-serif`; lines = wrap(ctx, title, W - 160, 2); }
  let y = 1490; lines.forEach((l) => { ctx.fillText(l, W / 2, y); y += fs * 1.15; });
  if (meta) { ctx.font = '500 40px Golos, sans-serif'; ctx.fillStyle = 'rgba(241,235,226,.72)'; ctx.fillText(meta, W / 2, y + 22); y += 70; }
  if (t.r) {
    const txt = `★ ${Number(t.r).toFixed(1)}`; ctx.font = '700 46px Golos, sans-serif'; const tw = ctx.measureText(txt).width + 64;
    rr(ctx, (W - tw) / 2, y + 10, tw, 76, 38); ctx.fillStyle = '#e8b04a'; ctx.fill(); ctx.fillStyle = '#0c0b0a'; ctx.fillText(txt, W / 2, y + 64);
  }
  ctx.font = '500 34px Golos, sans-serif'; ctx.fillStyle = 'rgba(241,235,226,.55)'; ctx.fillText(SITE, W / 2, H - 90);
  return new Promise((res) => { try { cv.toBlob((b) => res(b), 'image/jpeg', 0.9); } catch { res(null); } });
}
export async function shareLink(url, title) {
  if (navigator.share) { try { await navigator.share({ title: `${title} · Кинорулетка`, text: `Кинорулетка выбрала: ${title}`, url }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancel'; } }
  try { await navigator.clipboard.writeText(url); return 'copied'; } catch { return 'fail'; }
}
export async function shareImage(blob, name, title) {
  const file = new File([blob], name, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancel'; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); return 'saved';
}
