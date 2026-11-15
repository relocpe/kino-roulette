// Скопировано из /workspace/kino-vfx/presets.js (спека VFX-дизайнера, финальная версия); правки: ESM-экспорт и клон без structuredClone.
// Кинорулетка — пресеты 19 жанров (аниме внутри). atmo.mode: 0 нет,1 туман снизу,2 дымка/дым,3 пыль-штрихи,4 диагональный луч,5 шафты,6 прожектор,7 жалюзи,8 пятна фонарей.
// filter — на .stage один раз при выборе жанра; остальное — uniforms L0/L2. spin.* — цели при uI=1. wow.ms/ease — «вау» на остановке.
const E = {
  out:'cubic-bezier(.16,1,.3,1)', inOut:'cubic-bezier(.45,0,.55,1)', punch:'cubic-bezier(.3,1.4,.6,1)',
  settle:'cubic-bezier(.22,1,.36,1)', hardStop:'cubic-bezier(.2,.9,.1,1)', fall:'cubic-bezier(.7,0,.84,0)',
};
const H0 = { col:'#808080', a:0, r:40 }; // ореол выключен
const GENRES = {
  horror:     { ref:'Реинкарнация / Ведьма', filter:'contrast(1.15) saturate(.6) brightness(.88)', bg:'#0A0C0B', tint:'#3E4A44', tintAmt:.35, grain:.09, grainSize:2, vig:.55, vigR:.75, halo:H0, weave:.6,
    atmo:{mode:1,col:'#1A1E1C',density:.18,speed:.02,scale:1,angle:0,width:.2}, spin:{density:.30,vig:.70,halo:0,shake:0,shakeHz:0,ghost:false,stepFps:0,flicker:true},
    wow:{id:'eclipse',ms:880,ease:E.fall}, result:{scale:1.03,ms:12000} },
  thriller:   { ref:'Финчер: Зодиак / Исчезнувшая', filter:'contrast(1.12) saturate(.7) sepia(.12) hue-rotate(-8deg)', bg:'#0B0D0C', tint:'#59604A', tintAmt:.30, grain:.035, grainSize:1, vig:.35, vigR:.80, halo:H0, weave:0,
    atmo:{mode:0,col:'#0E1414',density:0,speed:0,scale:1,angle:0,width:.2}, spin:{density:0,vig:.55,halo:0,shake:0,shakeHz:0,ghost:false,stepFps:0},
    wow:{id:'rackFocus',ms:650,ease:E.hardStop}, result:{scale:1.015,ms:20000} },
  crime:      { ref:'Майкл Манн: Соучастник', filter:'contrast(1.1) saturate(.8)', bg:'#0A0E10', tint:'#2F5A63', tintAmt:.30, grain:.06, grainSize:1.5, vig:.40, vigR:.78, halo:{col:'#FF8A3A',a:.12,r:50}, weave:0,
    atmo:{mode:8,col:'#3A2410',density:.35,speed:.01,scale:1,angle:0,width:.2}, spin:{density:.20,vig:.50,halo:.06,shake:0,shakeHz:0,ghost:false,stepFps:0,headlightsMs:600},
    wow:{id:'headlights',ms:700,ease:E.inOut}, result:{scale:1.01,ms:15000} },
  drama:      { ref:'Земля кочевников', filter:'contrast(.95) saturate(.9) sepia(.15)', bg:'#0D0E10', tint:'#E9C9A0', tintAmt:.22, grain:.05, grainSize:1.5, vig:.40, vigR:.80, halo:{col:'#F4C58A',a:.12,r:50}, weave:.3,
    atmo:{mode:4,col:'#E9B97A',density:.10,speed:.002,scale:1,angle:.52,width:.18}, spin:{density:.05,vig:.40,halo:.12,shake:0,shakeHz:0,ghost:false,stepFps:0},
    wow:{id:'goldenHour',ms:900,ease:E.inOut}, result:{scale:1.01,ms:10000} },
  comedy:     { ref:'Уэс Андерсон: Гранд Будапешт', filter:'contrast(.95) saturate(1.15) brightness(1.04)', bg:'#1A1416', tint:'#E8B9A0', tintAmt:.20, grain:.025, grainSize:1, vig:.10, vigR:.90, halo:H0, weave:0,
    atmo:{mode:0,col:'#2A1E22',density:0,speed:0,scale:1,angle:0,width:.2}, spin:{density:0,vig:.10,halo:0,shake:0,shakeHz:0,ghost:true,stepFps:0},
    wow:{id:'snapZoom',ms:820,ease:'cubic-bezier(.2,.8,.2,1)'}, result:{scale:1.03,ms:0} },
  romance:    { ref:'Вонг Кар-вай: Любовное настроение', filter:'contrast(1.05) saturate(1.1)', bg:'#0E0A0A', tint:'#8A2A2A', tintAmt:.30, grain:.06, grainSize:1.5, vig:.50, vigR:.75, halo:{col:'#FF5A4A',a:.18,r:60}, weave:.5,
    atmo:{mode:2,col:'#2A1A18',density:.12,speed:.01,scale:1.5,angle:0,width:.2}, spin:{density:.18,vig:.55,halo:.10,shake:0,shakeHz:0,ghost:true,stepFps:12},
    wow:{id:'stepPrint',ms:800,ease:E.out}, result:{scale:1.02,ms:14000} },
  scifi:      { ref:'Бегущий по лезвию 2049', filter:'contrast(.9) saturate(.85) sepia(.25)', bg:'#120C08', tint:'#B8743A', tintAmt:.28, grain:.03, grainSize:1, vig:.30, vigR:.80, halo:{col:'#FF9A3C',a:.15,r:40}, weave:0,
    atmo:{mode:2,col:'#3A2414',density:.18,speed:.003,scale:.6,angle:0,width:.2}, spin:{density:.32,vig:.35,halo:.05,shake:0,shakeHz:0,ghost:false,stepFps:0},
    wow:{id:'hazeBreak',ms:750,ease:E.out}, result:{scale:1.01,ms:16000} },
  fantasy:    { ref:'Зелёный рыцарь', filter:'contrast(1.05) saturate(.8) sepia(.2)', bg:'#0B0D09', tint:'#6E7A4A', tintAmt:.28, grain:.06, grainSize:2, vig:.50, vigR:.75, halo:{col:'#FFB060',a:.15,r:50}, weave:.4,
    atmo:{mode:5,col:'#5A6A3A',density:.14,speed:.05,scale:1,angle:-1.05,width:.2}, spin:{density:.20,vig:.55,halo:.08,shake:0,shakeHz:0,ghost:false,stepFps:0},
    wow:{id:'shafts',ms:900,ease:'cubic-bezier(.33,1,.68,1)'}, result:{scale:1.02,ms:14000} },
  action:     { ref:'Безумный Макс: Дорога ярости', filter:'contrast(1.22) saturate(1.35)', bg:'#0F2226', tint:'#C76A2A', tintAmt:.30, grain:.05, grainSize:1.5, vig:.40, vigR:.78, halo:{col:'#FFB25A',a:.10,r:40}, weave:.4,
    atmo:{mode:3,col:'#6B4A2E',density:.10,speed:.02,scale:1,angle:0,width:.2}, spin:{density:.22,vig:.45,halo:.05,shake:3,shakeHz:3,ghost:false,stepFps:0,speed:.6},
    wow:{id:'punch',ms:520,ease:E.punch}, result:{scale:1.02,ms:0} },
  adventure:  { ref:'Спилберг: Индиана Джонс', filter:'contrast(1.08) saturate(1.15)', bg:'#120D08', tint:'#D49A4E', tintAmt:.25, grain:.05, grainSize:1.5, vig:.45, vigR:.78, halo:{col:'#FFC070',a:.10,r:50}, weave:.5,
    atmo:{mode:4,col:'#C8904A',density:.10,speed:0,scale:1,angle:1.2,width:.25}, spin:{density:.14,vig:.50,halo:.06,shake:0,shakeHz:0,ghost:false,stepFps:0,dolly:true},
    wow:{id:'dollyIn',ms:900,ease:'cubic-bezier(.33,0,.15,1)'}, result:{scale:1.05,ms:0} },
  western:    { ref:'Леоне: Однажды на Диком Западе', filter:'contrast(1.25) saturate(.75) sepia(.35)', bg:'#140E08', tint:'#C08A4A', tintAmt:.30, grain:.07, grainSize:2, vig:.50, vigR:.75, halo:{col:'#FFD08A',a:.10,r:50}, weave:.5,
    atmo:{mode:3,col:'#5A4028',density:.08,speed:.01,scale:1,angle:0,width:.2}, spin:{density:.14,vig:.55,halo:.05,shake:0,shakeHz:0,ghost:false,stepFps:0},
    wow:{id:'leone',ms:850,ease:E.inOut}, result:{scale:1.08,ms:0} },
  war:        { ref:'Спасти рядового Райана', filter:'contrast(1.3) saturate(.45)', bg:'#0C0C0B', tint:'#6A6E5E', tintAmt:.30, grain:.10, grainSize:2, vig:.45, vigR:.75, halo:H0, weave:.8,
    atmo:{mode:2,col:'#2A2A26',density:.20,speed:.01,scale:1.5,angle:0,width:.2}, spin:{density:.28,vig:.55,halo:0,shake:1.5,shakeHz:6,ghost:false,stepFps:24},
    wow:{id:'concussion',ms:800,ease:E.settle}, result:{scale:1.01,ms:0} },
  history:    { ref:'Кубрик: Барри Линдон', filter:'contrast(.9) saturate(.85) sepia(.3)', bg:'#100C08', tint:'#D8A86A', tintAmt:.30, grain:.06, grainSize:1.5, vig:.60, vigR:.70, halo:{col:'#FFB46A',a:.22,r:80}, weave:.3,
    atmo:{mode:0,col:'#1A120A',density:0,speed:0,scale:1,angle:0,width:.2}, spin:{density:0,vig:.60,halo:.15,shake:0,shakeHz:0,ghost:false,stepFps:0,candle:true,zoomTo:1.1},
    wow:{id:'kubrickZoomOut',ms:1000,ease:'cubic-bezier(.25,.1,.25,1)'}, result:{scale:1,ms:0} },
  documentary:{ ref:'Синема-верите, 16 мм (Мейслз)', filter:'contrast(1) saturate(.9)', bg:'#0C0C0B', tint:'#8A8A80', tintAmt:.10, grain:.08, grainSize:2, vig:.30, vigR:.80, halo:H0, weave:1.0,
    atmo:{mode:0,col:'#0C0C0B',density:0,speed:0,scale:1,angle:0,width:.2}, spin:{density:0,vig:.35,halo:0,shake:.8,shakeHz:.7,ghost:false,stepFps:0},
    wow:{id:'freeze',ms:600,ease:E.out}, result:{scale:1,ms:0} },
  animation:  { ref:'Pixar: ВАЛЛ-И', filter:'contrast(1) saturate(1.15)', bg:'#0E0C0A', tint:'#F0C890', tintAmt:.15, grain:.015, grainSize:1, vig:.25, vigR:.85, halo:{col:'#FFE0A8',a:.15,r:60}, weave:0,
    atmo:{mode:4,col:'#E8C890',density:.08,speed:0,scale:1,angle:1.2,width:.3}, spin:{density:.05,vig:.25,halo:.10,shake:0,shakeHz:0,ghost:false,stepFps:0},
    wow:{id:'squash',ms:580,ease:'spring(k180,d12)'}, result:{scale:1,ms:0} },
  anime:      { ref:'Макото Синкай: Твоё имя', filter:'contrast(1.05) saturate(1.25)', bg:'#0A0E14', tint:'#6FA0D8', tintAmt:.20, grain:0, grainSize:1, vig:.20, vigR:.85, halo:{col:'#9FC4FF',a:.05,r:70}, weave:0,
    atmo:{mode:4,col:'#8FB8E8',density:.10,speed:0,scale:1,angle:1.0,width:.3}, spin:{density:.06,vig:.25,halo:.05,shake:0,shakeHz:0,ghost:false,stepFps:0},
    wow:{id:'backlight',ms:800,ease:'cubic-bezier(.5,1,.89,1)',haloTo:'#FFD08A'}, result:{scale:1,ms:0} },
  musical:    { ref:'Ла-Ла Ленд', filter:'contrast(1.08) saturate(1.2)', bg:'#0C0A14', tint:'#4A3A8A', tintAmt:.25, grain:.04, grainSize:1.5, vig:.55, vigR:.75, halo:{col:'#FFE2A8',a:.20,r:60}, weave:0,
    atmo:{mode:6,col:'#E8D6B0',density:.18,speed:0,scale:1,angle:0,width:.35}, spin:{density:.22,vig:.60,halo:.10,shake:0,shakeHz:0,ghost:false,stepFps:0,spotSwingMs:1200},
    wow:{id:'spotlight',ms:870,ease:E.out}, result:{scale:1.01,ms:12000} },
  noir:       { ref:'Третий человек / Сладкий запах успеха', filter:'grayscale(1) contrast(1.35)', bg:'#0A0A0A', tint:'#808080', tintAmt:0, grain:.08, grainSize:1.5, vig:.60, vigR:.72, halo:{col:'#FFFFFF',a:.08,r:40}, weave:.5,
    atmo:{mode:7,col:'#2E2E2E',density:.25,speed:0,scale:1,angle:-.6,width:.2}, spin:{density:.30,vig:.65,halo:.04,shake:0,shakeHz:0,ghost:false,stepFps:0,blindsSlide:.3},
    wow:{id:'blinds',ms:700,ease:'cubic-bezier(.65,0,.35,1)'}, result:{scale:1.01,ms:14000} },
  family:     { ref:'Паддингтон 2', filter:'contrast(.98) saturate(1.1) brightness(1.05)', bg:'#120E0A', tint:'#F2C48A', tintAmt:.20, grain:.03, grainSize:1, vig:.20, vigR:.85, halo:{col:'#FFE0B0',a:.12,r:60}, weave:0,
    atmo:{mode:1,col:'#3A2818',density:.12,speed:.005,scale:.7,angle:0,width:.2}, spin:{density:.10,vig:.20,halo:.08,shake:0,shakeHz:0,ghost:false,stepFps:0},
    wow:{id:'lampOn',ms:750,ease:E.settle}, result:{scale:1.01,ms:0} },
};
// Приоритет при конфликте (левее = сильнее). Несовместимые пары: второй жанр игнорируется целиком.
const PRIORITY = ['horror','noir','thriller','war','crime','action','western','scifi','fantasy','history','adventure','drama','romance','musical','documentary','anime','animation','family','comedy'];
const INCOMPATIBLE = [['horror','comedy'],['horror','family'],['horror','animation'],['noir','animation'],['noir','family'],['war','comedy'],['war','musical'],['thriller','family']];
const hex = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255);
const toHex = rgb => '#' + rgb.map(c => Math.round(c*255).toString(16).padStart(2,'0')).join('');
const lerp = (a,b,t) => a+(b-a)*t;
// Первый выбранный = главный (грейд, зерно, камера, «вау»). Второй: тинт 25% + атмосфера 50%, если у главного её нет. Третий+ игнорируется.
function resolvePreset(selected){
  if (!selected || !selected.length) return null;
  let [a, b] = selected;
  if (b && INCOMPATIBLE.some(([x,y]) => (x===a&&y===b)||(x===b&&y===a))) { a = PRIORITY.indexOf(a) <= PRIORITY.indexOf(b) ? a : b; b = null; }
  const P = JSON.parse(JSON.stringify(GENRES[a])); // structuredClone нет в старых WebView
  if (b) { const S = GENRES[b];
    P.tint = toHex(hex(P.tint).map((c,i) => lerp(c, hex(S.tint)[i], .25)));
    if (P.atmo.mode === 0 && S.atmo.mode !== 0) P.atmo = { ...S.atmo, density: S.atmo.density*.5 };
  }
  return P;
}
// Значение параметра в текущей фазе: idle → spin по uI (0.35..1).
const phaseVal = (idle, spin, uI) => lerp(idle, spin, Math.max(0,(uI-.35)/.65));
export { GENRES, PRIORITY, INCOMPATIBLE, resolvePreset, phaseVal, hex, toHex, E };
