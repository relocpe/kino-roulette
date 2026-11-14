// Процедурный звук для тёмных жанров: гул, сердцебиение, шёпот, свист ножа. Без файлов.
// Стартует только после жеста пользователя; переключатель в шапке, выбор запоминается.
const KEY = 'kr:sound';
const SCENES = {
  horror: { drone: 0.5, wind: 0.18, heart: 1.05, whisper: 0 },
  slasher: { drone: 0.35, wind: 0.1, heart: 0.72, whisper: 0 },
  psycho: { drone: 0.22, wind: 0, heart: 0, whisper: 0.5 },
  mystery: { drone: 0.2, wind: 0.35, heart: 0, whisper: 0 },
};
let on = localStorage.getItem(KEY) === '1';
let ac = null, nodes = null, scene = null, beatTimer = 0, whisperTimer = 0, nextBeat = 0;
const btn = document.getElementById('soundBtn');

function noiseBuf(sec = 2) {
  const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function loopNoise() { const s = ac.createBufferSource(); s.buffer = nodes.noise; s.loop = true; s.start(); return s; }
function lfo(freq, amount, target) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = freq; g.gain.value = amount; o.connect(g).connect(target); o.start(); }

function build() {
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  nodes = { master, noise: noiseBuf() };
  // гул
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 130; lp.Q.value = 6;
  const drone = ac.createGain(); drone.gain.value = 0; lp.connect(drone).connect(master);
  for (const f of [41.2, 41.9, 61.7]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = f > 60 ? 0.12 : 0.3; o.connect(g).connect(lp); o.start(); }
  lfo(0.07, 60, lp.frequency);
  // ветер
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.8;
  const wind = ac.createGain(); wind.gain.value = 0; loopNoise().connect(bp).connect(wind).connect(master);
  lfo(0.11, 220, bp.frequency); lfo(0.17, 0.08, wind.gain);
  // шёпот
  const wb = ac.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 2800; wb.Q.value = 1.6;
  const wenv = ac.createGain(); wenv.gain.value = 0;
  const whisper = ac.createGain(); whisper.gain.value = 0;
  loopNoise().connect(wb).connect(wenv).connect(whisper).connect(master);
  lfo(0.9, 900, wb.frequency);
  Object.assign(nodes, { drone, wind, whisper, wenv });
}

function thump(t, vol) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.16);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(nodes.master); o.start(t); o.stop(t + 0.25);
}
function swoosh() {
  const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = nodes.noise;
  const hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 3; hp.frequency.setValueAtTime(700, t); hp.frequency.exponentialRampToValueAtTime(7000, t + 0.16);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  s.connect(hp).connect(g).connect(nodes.master); s.start(t); s.stop(t + 0.3);
}
function boom() { const t = ac.currentTime; thump(t, 0.9); thump(t + 0.02, 0.5); }

function schedule() {
  const sc = SCENES[scene];
  if (!sc?.heart) return;
  const now = ac.currentTime;
  if (nextBeat < now) nextBeat = now + 0.05;
  while (nextBeat < now + 0.3) { thump(nextBeat, 0.55); thump(nextBeat + 0.27, 0.38); nextBeat += sc.heart * (0.92 + Math.random() * 0.16); }
}
function syllables() {
  if (!SCENES[scene]?.whisper) { window.__krWhisper = 0; return; }
  const t = ac.currentTime, g = nodes.wenv.gain, v = Math.random() < 0.35 ? 0 : 0.3 + Math.random() * 0.7;
  g.cancelScheduledValues(t); g.setTargetAtTime(v, t, 0.04);
  window.__krWhisper = v * SCENES[scene].whisper;
}
function apply() {
  if (!ac) return;
  const sc = SCENES[scene], t = ac.currentTime, live = on && sc && !document.hidden;
  nodes.master.gain.setTargetAtTime(live ? 0.5 : 0, t, 0.6);
  nodes.drone.gain.setTargetAtTime(sc?.drone || 0, t, 1.2);
  nodes.wind.gain.setTargetAtTime(sc?.wind || 0, t, 1.2);
  nodes.whisper.gain.setTargetAtTime(sc?.whisper || 0, t, 0.8);
  clearInterval(beatTimer); clearInterval(whisperTimer); window.__krWhisper = 0;
  if (live && sc.heart) beatTimer = setInterval(schedule, 100);
  if (live && sc.whisper) whisperTimer = setInterval(syllables, 140);
}
function gesture() {
  if (!on) return;
  if (!ac) build();
  if (ac.state === 'suspended') ac.resume();
  apply();
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, gesture, { capture: true, passive: true });
addEventListener('kr:fx', (e) => { const id = e.detail.id, two = e.detail.second; scene = SCENES[id] ? id : SCENES[two] ? two : null; apply(); });
addEventListener('kr:burst', (e) => { if (!ac || !on || !scene || e.detail.k < 1) return; if (scene === 'slasher') return; if (scene === 'horror') boom(); });
addEventListener('kr:sfx', (e) => { if (!ac || !on) return; if (e.detail === 'slash') swoosh(); if (e.detail === 'whisper') { nodes.wenv.gain.setTargetAtTime(1, ac.currentTime, 0.05); } });
addEventListener('kr:trailer', (e) => { if (!ac) return; e.detail ? ac.suspend() : (on && !document.hidden && ac.resume()); });
document.addEventListener('visibilitychange', () => { if (!ac) return; document.hidden ? ac.suspend() : (on && ac.resume()); apply(); });

function label() { btn.setAttribute('aria-pressed', on); btn.querySelector('span').textContent = 'Звук'; }
btn.addEventListener('click', () => { on = !on; localStorage.setItem(KEY, on ? '1' : '0'); label(); if (on) gesture(); else apply(); });
label();
export const sound = { get on() { return on; } };
