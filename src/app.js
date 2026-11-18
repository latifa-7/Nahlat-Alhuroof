/* ================= نحلة الحروف — منطق التطبيق ================= */
const $ = s => document.querySelector(s);
const app = () => $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = x => Math.round(x * 100);
const strip = s => String(s).replace(/[ً-ْٰـ\s]/g, '');
const LIST = m => m === 'g' ? GRAMMAR : SPELLING;
const CON = id => GRAMMAR.find(c => c.id === id) || SPELLING.find(c => c.id === id);
const MODNAME = {g:'النحو والإعراب', s:'الإملاء'};

/* ---------- التخزين (على هذا الجهاز فقط) ---------- */
const KEY = 'nahlat-alhuroof-v1';
let S = {profiles:{}, cur:null, sound:true};
function load(){ try { const r = localStorage.getItem(KEY); if (r) S = Object.assign(S, JSON.parse(r)); } catch(e){} }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }
const P = () => S.profiles[S.cur];

/* ---------- الصوت ---------- */
let AC = null;
function tone(ok){
  if (!S.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const notes = ok ? [523, 659, 784] : [300, 220];
    notes.forEach((f, i) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(AC.destination);
      const t = AC.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
  } catch(e){}
}
/* نختار أوضح صوت عربي متوفر: الصوت الذي اختاره المستخدم، ثم الأصوات المحسّنة، ثم أصوات Google/Microsoft */
function arVoices(){ try { return speechSynthesis.getVoices().filter(v => /^ar/i.test(v.lang)); } catch(e){ return []; } }
function voiceScore(v){ const n = v.name.toLowerCase(); return (/premium|enhanced|محسّن|محسن|neural|natural/.test(n) ? 100 : 0) + (/google/.test(n) ? 40 : 0) + (/majed|maged|hamed|naayf|zariyah|laila|tarik|mariam/.test(n) ? 20 : 0) + (/sa/i.test(v.lang) ? 5 : 0) + (v.localService ? 1 : 0); }
function arVoice(){ const vs = arVoices(); if (!vs.length) return null; const pick = S.voice && vs.find(v => v.name === S.voice); return pick || vs.slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0]; }
function hasVoice(){ try { if (window.AndroidTTS) return !!AndroidTTS.hasArabic(); } catch(e){} return !!arVoice(); }
function say(text){
  try {
    const t = String(text).replace(/_+/g, ' ... ').replace(/[«»]/g, '');
    if (window.AndroidTTS){ AndroidTTS.speak(t); return true; }
    if (!('speechSynthesis' in window)) { toast('🔇 هذا الجهاز لا يدعم القراءة بالصوت'); return false; }
    const u = new SpeechSynthesisUtterance(t);
    const v = arVoice(); u.lang = v ? v.lang : 'ar-SA'; if (v) u.voice = v; u.volume = 1;
    // أبطأ قليلًا حتى تُسمع المدود بوضوح، والكلمات المفردة (الإملاء) أبطأ أكثر
    const base = S.rate || 0.75; u.rate = t.trim().split(/\s+/).length <= 2 ? base * 0.85 : base;
    window._u = u; // يمنع Safari من حذف الجملة قبل نطقها
    const go = () => { try { speechSynthesis.resume(); } catch(e){} speechSynthesis.speak(u); };
    // في آيفون/آيباد: الإلغاء ثم النطق فورًا يُسكت الصوت، فننتظر قليلًا إذا كان هناك كلام جارٍ
    if (speechSynthesis.speaking || speechSynthesis.pending){ speechSynthesis.cancel(); setTimeout(go, 120); } else go();
    if (!v && !S.warnedVoice){ S.warnedVoice = 1; setTimeout(() => toast('إذا لم تسمع صوتًا: نزّل صوتًا عربيًا من الإعدادات (انظر «فحص الصوت» في الدليل)'), 1500); }
    return true;
  } catch(e){ return false; }
}
try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); } catch(e){}
// يسمح بالصوت حتى لو كان الآيفون/الآيباد على الوضع الصامت (Safari 16.4+)
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e){}
// فتح الصوت عند أول لمسة (متطلب في آيفون/آيباد)
let UNLOCKED = false;
function unlockAudio(){
  if (UNLOCKED) return; UNLOCKED = true;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); const b = AC.createBuffer(1, 1, 22050), src = AC.createBufferSource(); src.buffer = b; src.connect(AC.destination); src.start(0); } catch(e){}
}
document.addEventListener('touchend', unlockAudio, {passive:true});
document.addEventListener('click', unlockAudio);
const spk = t => `<button class="spk" data-t="${esc(t)}" onclick="event.stopPropagation();say(this.dataset.t)" aria-label="استمع">🔊</button>`;

/* ---------- الشخصية: النحلة نحّولة ---------- */
function bee(sz = 64, mood = 'happy'){
  const mouth = mood === 'sad' ? 'M27 42 Q32 38 37 42' : 'M26 40 Q32 46 38 40';
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 64 64" aria-hidden="true">
  <ellipse cx="20" cy="18" rx="11" ry="8" fill="#dff3ff" stroke="#9bd3f5" stroke-width="2" transform="rotate(-25 20 18)"/>
  <ellipse cx="44" cy="18" rx="11" ry="8" fill="#dff3ff" stroke="#9bd3f5" stroke-width="2" transform="rotate(25 44 18)"/>
  <ellipse cx="32" cy="38" rx="20" ry="18" fill="#ffd23f" stroke="#3b2f2f" stroke-width="2.5"/>
  <path d="M14 34 H50 M13 44 H51" stroke="#3b2f2f" stroke-width="5" stroke-linecap="round" opacity=".85"/>
  <circle cx="25" cy="31" r="3.2" fill="#3b2f2f"/><circle cx="39" cy="31" r="3.2" fill="#3b2f2f"/>
  <circle cx="26" cy="30" r="1" fill="#fff"/><circle cx="40" cy="30" r="1" fill="#fff"/>
  <path d="${mouth}" stroke="#3b2f2f" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <circle cx="20" cy="38" r="2.6" fill="#ff8fab" opacity=".7"/><circle cx="44" cy="38" r="2.6" fill="#ff8fab" opacity=".7"/>
  <path d="M28 21 Q25 12 21 10 M36 21 Q39 12 43 10" stroke="#3b2f2f" stroke-width="2" fill="none"/><circle cx="21" cy="10" r="2.3" fill="#3b2f2f"/><circle cx="43" cy="10" r="2.3" fill="#3b2f2f"/>
  </svg>`;
}
const bubble = (html, mood) => `<div class="agent">${bee(54, mood)}<div class="bub">${html}</div></div>`;

/* ================= الوكيل الذكي (Agent) =================
   1) نموذج إتقان لكل درس (Bayesian Knowledge Tracing مبسّط)
   2) يختار السؤال التالي حسب مستوى الطفل (أسهل بعد الخطأ، أصعب بعد النجاح)
   3) يعطي تلميحًا ثم شرحًا عند الخطأ، ويقترح مراجعة الدرس إذا تكرر الخطأ
   4) يقترح الدرس التالي حسب العمر ونقاط الضعف ونتيجة الاختبار القبلي */
/* ================= التكييف حسب العمر =================
   كل عمر له «مستوى بداية» لصعوبة الأسئلة (1 = سهل جدًا … 5 = صعب)، وحدّ أعلى لا يتجاوزه.
   الأعمار الصغيرة: خيارات أقل، قراءة السؤال بالصوت تلقائيًا، اختيار بدل الكتابة، وجلسات أقصر. */
const AGE = {
  base(){ return {5:1, 6:1.5, 7:2, 8:2.5, 9:3, 10:3.5, 11:4, 12:4.5}[P().age] || 3; },
  maxD(){ return Math.min(5, Math.ceil(AGE.base() + 1)); },
  minD(){ return Math.max(1, Math.floor(AGE.base() - 1)); },
  nOpts(){ const a = P().age; return a <= 6 ? 2 : a <= 8 ? 3 : 4; },
  canType(){ return P().age >= 7; },
  autoRead(){ return P().age <= 7; },
  sesN(){ const a = P().age; return a <= 5 ? 4 : a <= 6 ? 5 : 6; },
  chalSec(){ const a = P().age; return a <= 6 ? 90 : a <= 8 ? 75 : 60; },
  band(){ const a = P().age; return a <= 6 ? 'A' : a <= 8 ? 'B' : a <= 10 ? 'C' : 'D'; },
  fits(c){ return c.a <= P().age; },
  /* يجهّز السؤال للعرض حسب العمر: عدد الخيارات، وتحويل الكتابة إلى اختيار للصغار */
  prepare(q){
    q = Object.assign({}, q);
    if ((q.type === 'fix' || q.type === 'dict') && !AGE.canType()){
      q.opts = q.type === 'fix' ? [q.ans, q.wrong] : q.opts; q.type = 'choose';
      q.q = q.type === 'choose' && q.wrong ? 'اختر الكتابة الصحيحة:' : 'استمع ثم اختر الكتابة الصحيحة:';
      q.listen = q.wrong ? null : q.ans;
    }
    if (q.opts){ const wrong = shuffle(q.opts.filter(o => o !== q.ans)).slice(0, AGE.nOpts() - 1); q.shown = shuffle([q.ans, ...wrong]); }
    return q;
  }
};
const DLABEL = ['', 'سهل جدًا', 'سهل', 'متوسط', 'صعب', 'صعب جدًا'];

const AG = {
  p(cid){ return (P().m[cid] ?? 0.15); },
  n(cid){ return (P().at[cid] || {n:0}).n; },
  update(cid, ok, nOpts){
    const pr = P(); const p = AG.p(cid);
    const slip = 0.1, learn = 0.2, guess = nOpts ? 1 / nOpts : 0.05;
    const post = ok ? p * (1 - slip) / (p * (1 - slip) + (1 - p) * guess)
                    : p * slip / (p * slip + (1 - p) * (1 - guess));
    pr.m[cid] = Math.min(0.99, post + (1 - post) * learn);
    const a = pr.at[cid] || {n:0, c:0}; a.n++; if (ok) a.c++; pr.at[cid] = a;
    pr.log.push({t:Date.now(), c:cid, ok:ok ? 1 : 0}); if (pr.log.length > 800) pr.log.shift();
    save();
  },
  recentWrong(cid, k = 4){ return P().log.filter(l => l.c === cid).slice(-k).filter(l => !l.ok).length; },
  /* الصعوبة المستهدفة = مستوى العمر ± حسب إتقان الطفل للدرس */
  target(cid){ const p = AG.p(cid), adj = p < 0.4 ? -0.5 : p < 0.75 ? 0 : 1; return Math.min(AGE.maxD(), Math.max(AGE.minD(), AGE.base() + adj)); },
  progress(mod){ const L = LIST(mod); return L.reduce((s, c) => s + (P().m[c.id] ?? 0), 0) / L.length; },
  accuracy(mod){ let n = 0, c = 0; LIST(mod).forEach(x => { const a = P().at[x.id]; if (a){ n += a.n; c += a.c; } }); return n ? c / n : null; },
  /* اختيار السؤال التالي */
  pick(ses){
    let cid = ses.cid;
    let why = '';
    if (!cid){ // مراجعة ذكية: نختار من أضعف الدروس التي بدأها الطفل
      const pool = ses.cids.slice().sort((a, b) => AG.p(a) - AG.p(b));
      cid = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
      why = `هذا السؤال من درس «${CON(cid).t}» لأن إتقانك فيه ${pct(AG.p(cid))}% فقط.`;
    }
    let tgt = AG.target(cid);
    if (ses.lastWrong) tgt = Math.max(1, tgt - 1);
    // نختار أولًا من الأسئلة التي تناسب عمر الطفل (لا أسهل كثيرًا ولا أصعب)، ثم نوسّع إذا انتهت
    const all = questionsOf(cid), fresh = all.filter(q => !ses.used.has(q.id));
    let cand = fresh.filter(q => q.d >= AGE.minD() && q.d <= AGE.maxD());
    if (!cand.length) cand = fresh.filter(q => q.d <= AGE.maxD());
    if (!cand.length) cand = fresh;
    if (!cand.length){ ses.used = new Set([...ses.used].filter(id => !id.startsWith(cid + '-'))); cand = all.filter(q => q.d <= AGE.maxD()); if (!cand.length) cand = all; }
    const best = Math.min(...cand.map(q => Math.abs(q.d - tgt)));
    cand = cand.filter(q => Math.abs(q.d - tgt) === best);
    const q = cand[Math.floor(Math.random() * cand.length)];
    ses.used.add(q.id);
    if (!why){
      why = ses.lastWrong ? 'اخترتُ لك سؤالًا أسهل قليلًا لنثبّت الفكرة 🌱'
          : tgt > AGE.base() ? 'أداؤك ممتاز! جرّب هذا السؤال الأصعب قليلًا 🚀'
          : tgt < AGE.base() ? 'نبدأ بسؤال أسهل حتى تتقن الفكرة 🌼' : `سؤال يناسب عمرك (${P().age} سنوات) ⭐`;
    }
    return Object.assign(AGE.prepare(q), {why2: why});
  },
  /* التوصية بالخطوة التالية */
  recommend(mod){
    const L = LIST(mod);
    const weak = L.filter(c => AG.n(c.id) >= 2 && AG.p(c.id) < 0.6).sort((a, b) => AG.p(a.id) - AG.p(b.id));
    if (weak.length) return {c:weak[0], kind:'weak', text:`لاحظتُ أن درس «${weak[0].t}» يحتاج إلى تدريب أكثر (إتقانك ${pct(AG.p(weak[0].id))}%). هيا نراجعه معًا!`};
    // درس جديد: نبدأ بالدروس القريبة من عمر الطفل (حتى لا يبدأ ابن 12 سنة بدروس عمر 5)
    const age = P().age, fresh = L.filter(c => AG.n(c.id) === 0 && AGE.fits(c));
    const nx = fresh.find(c => c.a >= Math.min(age - 3, 8)) || fresh[0];
    if (nx) return {c:nx, kind:'new', text:`أنت جاهز لدرس جديد في ${MODNAME[mod]}: «${nx.t}» ${nx.e}`};
    const nm = L.filter(c => AGE.fits(c) && AG.p(c.id) < 0.85).sort((a, b) => AG.p(a.id) - AG.p(b.id));
    if (nm.length) return {c:nm[0], kind:'practice', text:`جرّبت كل دروس عمرك! لنقوِّ «${nm[0].t}» حتى تحصل على التاج 👑`};
    const up = L.find(c => AG.n(c.id) === 0);
    if (up) return {c:up, kind:'new', text:`أتقنت دروس عمرك! هل تجرّب درسًا للأكبر منك؟ «${up.t}» ${up.e}`};
    return {c:null, kind:'done', text:`رائع! أتقنت كل دروس ${MODNAME[mod]}. جرّب التحدي السريع ⏱️`};
  }
};

/* تحويل المحتوى إلى أسئلة موحّدة */
function questionsOf(cid){
  const c = CON(cid);
  if (cid[0] === 'g') return c.q.map((x, i) => ({id:cid + '-' + i, cid, mod:'g', type:'mcq', q:x[0], opts:x[1], ans:x[1][0], d:x[2], exp:x[3], hint:c.h}));
  return c.it.map((x, i) => {
    const b = {id:cid + '-' + i, cid, mod:'s', d:x.d, exp:x.why, hint:c.tip, type:x.t};
    if (x.t === 'miss') return Object.assign(b, {q:'أكمل الحرف الناقص:', word:x.w, opts:x.o, ans:x.o[0], full:x.w.replace('_', x.o[0])});
    if (x.t === 'choose') return Object.assign(b, {q:x.q, opts:x.o, ans:x.o[0]});
    if (x.t === 'pic') return Object.assign(b, {q:'ما اسم هذه الصورة؟ اختر الكتابة الصحيحة:', emoji:x.e, opts:x.o, ans:x.o[0]});
    if (x.t === 'fix') return Object.assign(b, {q:'هذه الكلمة مكتوبة خطأ. اكتبها صحيحة:', wrong:x.w, ans:x.a});
    if (x.t === 'dict') return Object.assign(b, {q:'استمع إلى الكلمة ثم اكتبها:', ans:x.a, opts:x.o});
    return b;
  });
}

/* ---------- العرض العام ---------- */
function view(html, opts = {}){
  const pr = P();
  const top = opts.bare ? '' : `<header class="top">
    ${opts.back ? `<button class="ib" onclick="${opts.back}" aria-label="رجوع">➜</button>` : `<button class="ib" onclick="scrProfiles()" aria-label="تغيير الطفل">👤</button>`}
    <div class="tt">${opts.title || 'نحلة الحروف'}</div>
    <div class="row g6"><span class="chip">⭐ ${pr ? pr.stars : 0}</span><button class="ib" onclick="S.sound=!S.sound;save();this.textContent=S.sound?'🔔':'🔕'" aria-label="الصوت">${S.sound ? '🔔' : '🔕'}</button></div>
  </header>`;
  app().innerHTML = top + `<main class="${opts.cls || ''}">${html}</main>`;
  window.scrollTo(0, 0);
}
function confetti(){
  const box = document.createElement('div'); box.className = 'conf';
  box.innerHTML = Array.from({length:18}, (_, i) => `<span style="left:${Math.random() * 100}%;animation-delay:${Math.random() * .3}s">${['⭐','🌟','🎉','🐝','✨'][i % 5]}</span>`).join('');
  document.body.appendChild(box); setTimeout(() => box.remove(), 1400);
}
const starsOf = p => p >= 0.85 ? '👑' : '★'.repeat(p >= 0.6 ? 3 : p >= 0.4 ? 2 : p >= 0.25 ? 1 : 0).padEnd(3, '☆');
const bar = (v, color) => `<div class="bar"><i style="width:${Math.max(3, pct(v))}%;background:${color}"></i></div>`;

/* ---------- الملفات الشخصية ---------- */
function scrProfiles(){
  const ps = Object.values(S.profiles);
  view(`<div class="hero">${bee(110)}<h1>نحلة الحروف</h1><p>نتعلّم النحو والإملاء مع نحّولة!</p></div>
   ${ps.length ? `<h3>من يتعلّم الآن؟</h3><div class="grid2">${ps.map(p => `<button class="card pf" onclick="S.cur='${p.id}';save();scrHome()"><b>${esc(p.name)}</b><small>العمر ${p.age} • ⭐ ${p.stars}</small></button>`).join('')}</div>` : ''}
   <div class="card"><h3>➕ متعلّم جديد</h3>
    <label>اسم مستعار أو رمز (لا تكتب الاسم الكامل)</label>
    <input id="pn" maxlength="14" placeholder="مثال: نجمة ٣">
    <label>العمر</label>
    <div class="ages">${[5,6,7,8,9,10,11,12].map(a => `<button class="age" data-a="${a}" onclick="document.querySelectorAll('.age').forEach(b=>b.classList.remove('on'));this.classList.add('on')">${a}</button>`).join('')}</div>
    <button class="btn big" onclick="newProfile()">ابدأ 🚀</button></div>
   <div class="row center g10 foot"><button class="lnk" onclick="scrGuide()">📘 دليل الاستخدام</button><button class="lnk" onclick="scrSound()">🔊 فحص الصوت</button><button class="lnk" onclick="scrTeacherGate()">👩‍🏫 للمعلم / ولي الأمر</button></div>`, {bare:true});
}
function newProfile(){
  const name = ($('#pn').value || '').trim(); const ag = document.querySelector('.age.on');
  if (!name || !ag){ toast('اكتب اسمًا مستعارًا واختر العمر'); return; }
  const id = 'p' + Date.now().toString(36);
  S.profiles[id] = {id, name, age:+ag.dataset.a, m:{}, at:{}, log:[], stars:0, tests:{}, best:{}, created:Date.now()};
  S.cur = id; save(); scrHome();
}
function toast(t){ const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2200); }

/* ---------- الرئيسية ---------- */
function scrHome(){
  const pr = P(); if (!pr) return scrProfiles();
  const gp = AG.progress('g'), sp = AG.progress('s');
  let msg, act;
  if (!pr.tests.pre){ msg = `أهلًا ${esc(pr.name)}! أنا نحّولة 🐝 سأساعدك في التعلّم. لنبدأ باختبار قصير لأعرف مستواك.`; act = `<button class="btn" onclick="startTest('pre')">ابدأ الاختبار القصير</button>`; }
  else {
    const first = gp <= sp ? 'g' : 's', r = AG.recommend(first), r2 = AG.recommend(first === 'g' ? 's' : 'g');
    msg = r.text; act = r.c ? `<button class="btn" onclick="scrLesson('${r.c.id}')">هيا بنا!</button>` : `<button class="btn" onclick="startChallenge('${first}')">التحدي ⏱️</button>`;
    if (r2.c) act += `<button class="btn ghost" onclick="scrLesson('${r2.c.id}')">أو: ${r2.c.t}</button>`;
  }
  view(`${bubble(`<b>نحّولة تقترح:</b><br>${msg}<div class="row wrap g6 mt8">${act}</div>`)}
   <p class="small center">🎯 الأسئلة مضبوطة لعمر ${pr.age} سنوات</p>
   <div class="grid2">
    <button class="mod gram" onclick="scrMap('g')"><span class="em">📚</span><b>النحو والإعراب</b><small>${GRAMMAR.length} درسًا</small>${bar(gp, '#fff')}<small>${pct(gp)}%</small></button>
    <button class="mod spel" onclick="scrMap('s')"><span class="em">✏️</span><b>الإملاء</b><small>${SPELLING.length} دروس</small>${bar(sp, '#fff')}<small>${pct(sp)}%</small></button>
   </div>
   <div class="grid3">
    <button class="tile" onclick="scrParse()">🔬<b>مختبر الإعراب</b></button>
    <button class="tile" onclick="scrChalPick()">⏱️<b>التحدي السريع</b></button>
    <button class="tile" onclick="scrReviewPick()">🧠<b>مراجعة ذكية</b></button>
    <button class="tile" onclick="scrProgress()">📈<b>تقدّمي</b></button>
    <button class="tile" onclick="scrTestPick()">📝<b>الاختبارات</b></button>
    <button class="tile" onclick="scrSound()">🔊<b>فحص الصوت</b></button>
   </div>`, {title:`مرحبًا ${esc(pr.name)}`});
}

/* ---------- خريطة الدروس ---------- */
function scrMap(mod){
  const L = LIST(mod), r = AG.recommend(mod), age = P().age;
  const item = (c) => {
    const p = P().m[c.id] ?? 0, rec = r.c && r.c.id === c.id, i = L.indexOf(c);
    return `<button class="les ${mod === 'g' ? 'lg' : 'ls'} ${rec ? 'rec' : ''}" onclick="scrLesson('${c.id}')">
       <span class="num">${i + 1}</span><span class="em2">${c.e}</span>
       <span class="lt"><b>${c.t}</b><small>من عمر ${c.a}${rec ? ' • ⭐ مقترح' : ''}</small>${bar(p, mod === 'g' ? 'var(--g)' : 'var(--s)')}</span>
       <span class="st">${starsOf(p)}</span></button>`; };
  const mine = L.filter(c => c.a <= age), older = L.filter(c => c.a > age);
  view(`${bubble(r.text)}
   <h3>🎒 دروس تناسب عمرك (${age} سنوات) — ${mine.length} ${mine.length > 10 ? 'درسًا' : 'دروس'}</h3>
   <div class="list">${mine.map(item).join('')}</div>
   ${older.length ? `<details class="older"><summary>🔒 دروس للأعمار الأكبر (${older.length})</summary><div class="list">${older.map(item).join('')}</div></details>` : ''}
   ${mod === 'g' ? `<button class="btn big alt" onclick="scrParse()">🔬 مختبر الإعراب: حلّل الجملة${age < 8 ? ' (من عمر 8)' : ''}</button>` : `<button class="btn big alt" onclick="startChallenge('s')">⏱️ تحدي الإملاء السريع</button>`}`,
   {title:MODNAME[mod], back:'scrHome()'});
}

/* ---------- الدرس ---------- */
function scrLesson(cid){
  const c = CON(cid), mod = cid[0], young = P().age <= 6 && c.k;
  const full = `<div class="card"><h3>📖 الشرح</h3>${c.ex.map(x => `<p class="ln">${x} ${spk(x)}</p>`).join('')}</div>`;
  const expl = young ? `<div class="card kidc"><h3>📖 باختصار</h3><p class="ln big">${c.k} ${spk(c.k)}</p></div><details class="older"><summary>👀 اشرح أكثر (للكبار)</summary>${full}</details>` : full;
  const body = mod === 'g'
    ? `${expl}
       <div class="card"><h3>💡 مثال وإعرابه ${spk(c.s)}</h3><div class="sent">${c.s}</div>
       <table class="irab">${c.ir.map(r => `<tr><td class="w">${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table></div>`
    : `${expl}
       <div class="card tipc"><h3>🔑 الحيلة الذكية</h3><p>${c.tip}</p></div>
       <div class="card"><h3>💡 أمثلة</h3><div class="row wrap g10 center">${c.w.map(w => `<button class="wchip" onclick="say('${w}')">${w} 🔊</button>`).join('')}</div></div>`;
  view(`<div class="lhead ${mod === 'g' ? 'lg' : 'ls'}"><span>${c.e}</span><h2>${c.t}</h2><small>إتقانك: ${pct(AG.p(cid))}% ${starsOf(AG.p(cid))}${c.a > P().age ? ` • هذا الدرس لعمر ${c.a}+ وسأبدأ معك بأسهل أسئلته` : ''}</small></div>
    ${body}<button class="btn big" onclick="startPractice('${mod}','${cid}')">🎯 تدرّب الآن</button>`,
    {title:'درس', back:`scrMap('${mod}')`});
}

/* ================= جلسة التدريب ================= */
let SES = null;
function startPractice(mod, cid, cids){
  SES = {mod, cid, cids, n:AGE.sesN(), i:0, correct:0, used:new Set(), lastWrong:false, before:{}, touched:new Set(), earned:0};
  (cid ? [cid] : cids).forEach(x => SES.before[x] = AG.p(x));
  nextQ();
}
function nextQ(){
  if (SES.i >= SES.n) return endPractice();
  const q = AG.pick(SES); SES.cur = q; SES.tries = 0; SES.typed = '';
  SES.useChoice = q.type === 'dict' && !hasVoice(); // q هنا مجهّز حسب العمر
  renderQ();
}
function renderQ(){
  const q = SES.cur, c = CON(q.cid);
  let inner = '';
  const optBtns = (opts, big) => `<div class="opts ${big ? 'big' : ''}">${(q.shown || shuffle(opts)).map(o => `<button class="opt" data-v="${esc(o)}" onclick="answer(this)">${o}</button>`).join('')}</div>`;
  if (q.type === 'mcq' || q.type === 'choose') inner = `<div class="qt">${q.q} ${spk(q.q)}</div>${q.listen ? `<button class="btn listen" onclick="say('${q.listen}')">🔊 استمع</button>` : ''}${optBtns(q.opts)}`;
  else if (q.type === 'miss') inner = `<div class="qt">${q.q}</div><div class="bigword">${q.word.replace('_', '<span class="gap">؟</span>')}</div>${optBtns(q.opts, true)}`;
  else if (q.type === 'pic') inner = `<div class="qt">${q.q}</div><div class="pic">${q.emoji}</div>${optBtns(q.opts)}`;
  else if (q.type === 'fix') inner = `<div class="qt">${q.q}</div><div class="bigword wrongw">${q.wrong}</div>${kbd()}`;
  else if (q.type === 'dict' && SES.useChoice) inner = `<div class="qt">اختر الكتابة الصحيحة للكلمة:</div><div class="note">🔇 لا يتوفر صوت عربي على هذا الجهاز، لذلك حوّلتُ الإملاء إلى اختيار.</div><button class="btn ghost" onclick="say('${q.ans}')">🔊 جرّب الاستماع</button>${optBtns(q.opts)}`;
  else if (q.type === 'dict') inner = `<div class="qt">${q.q}</div><button class="btn listen" onclick="say('${q.ans}')">🔊 استمع</button>${kbd()}`;
  view(`<div class="prog"><i style="width:${pct(SES.i / SES.n)}%"></i></div>
    <div class="qhead"><span class="tag ${q.mod === 'g' ? 'tg' : 'ts'}">${c.e} ${c.t}</span><span class="tag">${DLABEL[q.d]}</span></div>
    <div class="why">🐝 ${q.why2}</div>
    <div class="card qcard">${inner}</div><div id="fb"></div>`,
    {title:`سؤال ${SES.i + 1} من ${SES.n}`, back:'scrHome()'});
  if (q.type === 'dict' && !SES.useChoice) setTimeout(() => say(q.ans), 350);
  else if (q.listen) setTimeout(() => say(q.listen), 350);
  else if (AGE.autoRead() && UNLOCKED) setTimeout(() => say(q.q), 350); // نقرأ السؤال للأطفال الصغار
}
function kbd(){
  const rows = ['ض ص ث ق ف غ ع ه خ ح ج', 'ش س ي ب ل ا ت ن م ك ط', 'ذ د ز ر و ة ى ظ', 'أ إ آ ء ؤ ئ'];
  return `<div class="typed" id="typed">${SES.typed || '<span class="ph">اكتب هنا</span>'}</div>
   <div class="kb">${rows.map(r => `<div class="kr">${r.split(' ').map(ch => `<button onclick="kb('${ch}')">${ch}</button>`).join('')}</div>`).join('')}
   <div class="kr"><button class="wide del" onclick="kb('⌫')">⌫ امسح</button><button class="wide ok" onclick="submitTyped()">✔ تحقّق</button></div></div>`;
}
function kb(ch){
  SES.typed = ch === '⌫' ? SES.typed.slice(0, -1) : (SES.typed + ch).slice(0, 16);
  $('#typed').innerHTML = SES.typed || '<span class="ph">اكتب هنا</span>';
}
function submitTyped(){ if (!SES.typed) return toast('اكتب الكلمة أولًا'); judge(strip(SES.typed) === strip(SES.cur.ans), null); }
function answer(btn){ judge(btn.dataset.v === SES.cur.ans, btn); }

function judge(ok, btn){
  const q = SES.cur; SES.tries++;
  const nOpts = (q.type === 'fix' || (q.type === 'dict' && !SES.useChoice)) ? 0 : (q.shown || q.opts || []).length;
  if (SES.tries === 1) AG.update(q.cid, ok, nOpts);
  const fb = $('#fb');
  if (ok){
    tone(true); if (btn) btn.classList.add('right');
    const gain = SES.tries === 1 ? 2 : 1; P().stars += gain; SES.earned += gain; save();
    if (SES.tries === 1) SES.correct++;
    SES.lastWrong = SES.tries > 1;
    confetti(); lockOpts();
    fb.innerHTML = bubble(`<b>${['أحسنت! 🌟','ممتاز! 🎉','رائع جدًا! 👏','بطل! 🏆'][Math.floor(Math.random() * 4)]}</b> +${gain} ⭐<br>${q.exp}`) + `<button class="btn big" onclick="SES.i++;nextQ()">التالي ⬅</button>`;
  } else if (SES.tries === 1){
    tone(false); if (btn){ btn.classList.add('wrong'); btn.disabled = true; }
    const lenHint = (q.type === 'fix' || q.type === 'dict') && !SES.useChoice ? `<br>🔢 عدد حروف الكلمة: ${strip(q.ans).length}` : '';
    fb.innerHTML = bubble(`<b>قريب! حاول مرة أخرى 💪</b><br>💡 تلميح: ${q.hint}${lenHint}`, 'sad');
    if (!btn){ SES.typed = ''; $('#typed').innerHTML = '<span class="ph">اكتب هنا</span>'; }
  } else {
    tone(false); if (btn) btn.classList.add('wrong');
    SES.lastWrong = true; lockOpts(true);
    const rep = AG.recentWrong(q.cid) >= 2;
    fb.innerHTML = bubble(`<b>لا بأس، نتعلّم من الخطأ 🌱</b><br>الإجابة الصحيحة: <span class="ans">${q.full || q.ans}</span><br>${q.exp}
      ${rep ? `<br><br>🔁 لاحظتُ أن هذا الدرس صعب عليك قليلًا. سأعطيك سؤالًا أسهل، ويمكنك مراجعة الشرح.` : ''}`, 'sad')
      + `<div class="row g6">${rep ? `<button class="btn ghost" onclick="scrLesson('${q.cid}')">📖 راجع الدرس</button>` : ''}<button class="btn big" onclick="SES.i++;nextQ()">التالي ⬅</button></div>`;
  }
}
function lockOpts(showRight){
  document.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (showRight && b.dataset.v === SES.cur.ans) b.classList.add('right'); });
  document.querySelectorAll('.kb button').forEach(b => b.disabled = true);
}
function endPractice(){
  const ids = Object.keys(SES.before);
  const rows = ids.map(id => `<tr><td>${CON(id).e} ${CON(id).t}</td><td>${pct(SES.before[id])}%</td><td><b>${pct(AG.p(id))}%</b></td></tr>`).join('');
  const r = AG.recommend(SES.mod), ratio = SES.correct / SES.n;
  const msg = ratio >= 0.83 ? 'عمل رائع! أنت تتقدّم بسرعة 🚀' : ratio >= 0.5 ? 'جيد! مع قليل من التدريب ستصبح ممتازًا 💪' : 'لا تقلق، كل بطل يبدأ هكذا. لنراجع معًا 🌱';
  if (ratio >= 0.83) confetti();
  view(`<div class="hero">${bee(90)}<h2>${SES.correct} / ${SES.n} من المحاولة الأولى</h2><p>${msg} • ربحت ${SES.earned} ⭐</p></div>
   <div class="card"><h3>📊 الإتقان قبل وبعد</h3><table class="tbl"><tr><th>الدرس</th><th>قبل</th><th>بعد</th></tr>${rows}</table></div>
   ${bubble('<b>اقتراحي التالي:</b><br>' + r.text)}
   <div class="row wrap g6">${r.c ? `<button class="btn big" onclick="scrLesson('${r.c.id}')">اذهب للاقتراح</button>` : ''}
   <button class="btn ghost" onclick="${SES.cid ? `startPractice('${SES.mod}','${SES.cid}')` : 'scrHome()'}">🔁 تدرّب مرة أخرى</button>
   <button class="btn ghost" onclick="scrHome()">🏠 الرئيسية</button></div>`, {title:'نهاية التدريب', back:'scrHome()'});
}

/* ---------- مراجعة ذكية ---------- */
function scrReviewPick(){
  view(`${bubble('سأختار لك أسئلة من الدروس التي تحتاج إلى مراجعة أكثر. اختر المجال:')}
   <div class="grid2"><button class="mod gram" onclick="startReview('g')"><span class="em">📚</span><b>مراجعة النحو</b></button>
   <button class="mod spel" onclick="startReview('s')"><span class="em">✏️</span><b>مراجعة الإملاء</b></button></div>`, {title:'مراجعة ذكية', back:'scrHome()'});
}
function startReview(mod){
  let ids = LIST(mod).filter(c => AG.n(c.id) > 0).map(c => c.id);
  if (ids.length < 2){ toast('تعلّم درسين على الأقل أولًا، ثم ارجع للمراجعة 🙂'); return scrMap(mod); }
  startPractice(mod, null, ids);
}

/* ---------- مختبر الإعراب ---------- */
let PS = null;
function scrParse(){ PS = {k:0, w:0, ok:0, tot:0, order:shuffle(PARSE.map((_, i) => i)), tries:0}; renderParse(); }
function renderParse(){
  const sen = PARSE[PS.order[PS.k]].s, cur = sen[PS.w];
  const opts = shuffle([cur[1], ...shuffle(ROLES.filter(r => r !== cur[1] && !cur[1].startsWith(r) && !r.startsWith(cur[1]))).slice(0, 2)]);
  PS.tries = 0;
  view(`${bubble('اضغط على الإعراب الصحيح للكلمة الملوّنة 🔬')}
   <div class="card"><div class="sent big">${sen.map((w, i) => `<span class="pw ${i === PS.w ? 'cur' : i < PS.w ? 'done' : ''}">${w[0]}</span>`).join(' ')} ${spk(sen.map(w => w[0]).join(' '))}</div>
   <div class="qt">ما إعراب «${cur[0]}»؟</div>
   <div class="opts">${opts.map(o => `<button class="opt" data-v="${o}" onclick="parseAns(this)">${o}</button>`).join('')}</div></div><div id="fb"></div>`,
   {title:`جملة ${PS.k + 1} من ${PARSE.length}`, back:'scrMap(\'g\')'});
}
function parseAns(btn){
  const cur = PARSE[PS.order[PS.k]].s[PS.w], ok = btn.dataset.v === cur[1]; PS.tries++;
  if (PS.tries === 1){ AG.update(cur[2], ok, 3); PS.tot++; if (ok) PS.ok++; }
  if (ok){
    tone(true); btn.classList.add('right'); if (PS.tries === 1){ P().stars++; save(); }
    lockOpts();
    $('#fb').innerHTML = `<button class="btn big" onclick="parseNext()">التالي ⬅</button>`;
  } else {
    tone(false); btn.classList.add('wrong'); btn.disabled = true;
    $('#fb').innerHTML = bubble(`💡 تلميح من درس «${CON(cur[2]).t}»: ${CON(cur[2]).h}`, 'sad');
  }
}
function parseNext(){
  const sen = PARSE[PS.order[PS.k]].s;
  PS.w++; if (PS.w >= sen.length){ PS.w = 0; PS.k++; }
  if (PS.k >= PARSE.length){
    confetti();
    return view(`<div class="hero">${bee(90)}<h2>أنهيت مختبر الإعراب!</h2><p>${PS.ok} / ${PS.tot} كلمة صحيحة من المحاولة الأولى</p></div>
      <button class="btn big" onclick="scrParse()">🔁 مرة أخرى</button><button class="btn ghost big" onclick="scrHome()">🏠 الرئيسية</button>`, {title:'مختبر الإعراب', back:'scrHome()'});
  }
  renderParse();
}

/* ---------- التحدي السريع (60 ثانية) ---------- */
let CH = null, CHT = null;
function scrChalPick(){
  view(`${bubble(`عندك ${AGE.chalSec()} ثانية! أجب عن أكبر عدد من الأسئلة ⏱️`)}
   <div class="grid2"><button class="mod gram" onclick="startChallenge('g')"><span class="em">📚</span><b>تحدي النحو</b><small>أفضل نتيجة: ${P().best.g || 0}</small></button>
   <button class="mod spel" onclick="startChallenge('s')"><span class="em">✏️</span><b>تحدي الإملاء</b><small>أفضل نتيجة: ${P().best.s || 0}</small></button></div>`, {title:'التحدي السريع', back:'scrHome()'});
}
function startChallenge(mod){
  // أسئلة من دروس عمر الطفل وبصعوبة لا تتجاوز مستواه
  let pool = LIST(mod).filter(AGE.fits).flatMap(c => questionsOf(c.id)).filter(q => q.opts && q.type !== 'dict' && q.d <= AGE.maxD());
  if (pool.length < 8) pool = LIST(mod).flatMap(c => questionsOf(c.id)).filter(q => q.opts && q.type !== 'dict' && q.d <= AGE.maxD() + 1);
  pool = shuffle(pool).map(AGE.prepare);
  CH = {mod, pool, i:0, score:0, end:Date.now() + AGE.chalSec() * 1000};
  clearInterval(CHT); CHT = setInterval(() => { const t = $('#tm'); if (!t){ clearInterval(CHT); return; } const s = Math.max(0, Math.ceil((CH.end - Date.now()) / 1000)); t.textContent = s; if (s <= 0) endChallenge(); }, 250);
  renderChal();
}
function renderChal(){
  const q = CH.pool[CH.i % CH.pool.length];
  view(`<div class="chalbar"><span>⏱️ <b id="tm">${AGE.chalSec()}</b></span><span>✅ <b>${CH.score}</b></span></div>
   <div class="card qcard">${q.emoji ? `<div class="pic sm">${q.emoji}</div>` : ''}<div class="qt">${q.type === 'miss' ? q.q + `<div class="bigword">${q.word.replace('_', '<span class="gap">؟</span>')}</div>` : q.q}</div>
   <div class="opts">${q.shown.map(o => `<button class="opt" data-v="${esc(o)}" onclick="chalAns(this)">${o}</button>`).join('')}</div></div>`,
   {title:'التحدي السريع', back:'clearInterval(CHT);scrHome()'});
  $('#tm').textContent = Math.max(0, Math.ceil((CH.end - Date.now()) / 1000));
}
function chalAns(btn){
  const q = CH.pool[CH.i % CH.pool.length], ok = btn.dataset.v === q.ans;
  AG.update(q.cid, ok, q.shown.length);
  if (ok){ CH.score++; tone(true); btn.classList.add('right'); } else { tone(false); btn.classList.add('wrong'); document.querySelectorAll('.opt').forEach(b => { if (b.dataset.v === q.ans) b.classList.add('right'); }); }
  document.querySelectorAll('.opt').forEach(b => b.disabled = true);
  setTimeout(() => { if (Date.now() >= CH.end) return endChallenge(); CH.i++; renderChal(); }, ok ? 450 : 1100);
}
function endChallenge(){
  if (!CH || CH.done) return; CH.done = true; clearInterval(CHT);
  const pr = P(), rec = CH.score > (pr.best[CH.mod] || 0);
  if (rec) pr.best[CH.mod] = CH.score; pr.stars += CH.score; save(); if (rec) confetti();
  view(`<div class="hero">${bee(90)}<h2>انتهى الوقت! ⏱️</h2><p>أجبت ${CH.score} إجابة صحيحة${rec ? ' — رقم قياسي جديد! 🏆' : ''}</p></div>
   <button class="btn big" onclick="startChallenge('${CH.mod}')">🔁 مرة أخرى</button><button class="btn ghost big" onclick="scrHome()">🏠 الرئيسية</button>`, {title:'التحدي السريع', back:'scrHome()'});
}

/* ---------- الاختبار القبلي والبعدي ---------- */
let TS = null;
function scrTestPick(){
  const t = P().tests;
  const res = k => t[k] ? `النحو ${t[k].g}% • الإملاء ${t[k].s}%` : 'لم يُجرَ بعد';
  view(`${bubble(`الاختبار القبلي قبل التعلّم، والاختبار البعدي بعد التدريب، لنقيس كم تعلّمت. أسئلة الاختبار مناسبة لعمر ${BAND_NAME[t.pre?.band || AGE.band()]}، ولا توجد تلميحات 🙂`)}
   <button class="card pf wide" onclick="startTest('pre')"><b>📝 الاختبار القبلي</b><small>${res('pre')}</small></button>
   <button class="card pf wide" ${t.pre ? '' : 'disabled'} onclick="startTest('post')"><b>🏁 الاختبار البعدي</b><small>${t.pre ? res('post') : 'متاح بعد الاختبار القبلي'}</small></button>`,
   {title:'الاختبارات', back:'scrHome()'});
}
function startTest(kind){
  // الاختبار البعدي من نفس فئة القبلي حتى تكون المقارنة عادلة
  const band = (kind === 'post' && P().tests.pre && P().tests.pre.band) || AGE.band(), T = TESTS[band][kind];
  TS = {kind, band, items:[...T.g.map(x => ({m:'g', q:x[0], opts:x[1], cid:x[2]})), ...T.s.map(x => ({m:'s', q:x[0], opts:x[1], cid:x[2]}))], k:0, g:0, s:0, ng:T.g.length, ns:T.s.length, ans:[]};
  renderTest();
}
function renderTest(){
  const it = TS.items[TS.k];
  view(`<div class="prog"><i style="width:${pct(TS.k / TS.items.length)}%"></i></div>
   <div class="qhead"><span class="tag ${it.m === 'g' ? 'tg' : 'ts'}">${it.m === 'g' ? '📚 نحو' : '✏️ إملاء'}</span><span class="tag">${TS.k + 1} / ${TS.items.length}</span></div>
   <div class="card qcard"><div class="qt">${it.q} ${spk(it.q)}</div><div class="opts">${shuffle(it.opts).map(o => `<button class="opt" data-v="${esc(o)}" onclick="testAns(this)">${o}</button>`).join('')}</div></div>`,
   {title:TS.kind === 'pre' ? 'الاختبار القبلي' : 'الاختبار البعدي', back:'scrHome()'});
  if (AGE.autoRead() && UNLOCKED) setTimeout(() => say(it.q), 350);
}
function testAns(btn){
  const it = TS.items[TS.k], ok = btn.dataset.v === it.opts[0];
  if (ok) TS[it.m]++; TS.ans.push({cid:it.cid, n:it.opts.length, ok});
  TS.k++; if (TS.k < TS.items.length) return renderTest();
  const pr = P(), g = Math.round(TS.g / TS.ng * 100), s = Math.round(TS.s / TS.ns * 100);
  pr.tests[TS.kind] = {g, s, band:TS.band, t:Date.now()};
  if (TS.kind === 'pre') TS.ans.forEach(a => AG.update(a.cid, a.ok, a.n)); // الوكيل يستخدم الاختبار القبلي لتحديد المستوى
  pr.stars += 5; save(); confetti();
  const pre = pr.tests.pre, post = pr.tests.post;
  view(`<div class="hero">${bee(90)}<h2>انتهى الاختبار! +5 ⭐</h2></div>
   <div class="grid2"><div class="card stat gram2"><small>النحو</small><b>${g}%</b></div><div class="card stat spel2"><small>الإملاء</small><b>${s}%</b></div></div>
   ${TS.kind === 'post' && pre ? `<div class="card">${testChart([{l:'النحو', a:pre.g, b:post.g}, {l:'الإملاء', a:pre.s, b:post.s}])}</div>` : ''}
   ${bubble(TS.kind === 'pre' ? 'شكرًا! عرفتُ الآن ما تحتاجه، وسأقترح عليك الدروس المناسبة 🐝' : `تحسّنك: النحو ${post.g - pre.g >= 0 ? '+' : ''}${post.g - pre.g} نقطة، الإملاء ${post.s - pre.s >= 0 ? '+' : ''}${post.s - pre.s} نقطة.`)}
   <button class="btn big" onclick="scrHome()">🏠 الرئيسية</button>`, {title:'النتيجة', back:'scrHome()'});
}
/* رسم بياني: قبل وبعد */
function testChart(rows, title = 'قبل وبعد استخدام التطبيق'){
  const W = 320, H = 200, bw = 46, gap = 160, x0 = 40;
  const y = v => 160 - v * 1.3;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${title}">
   <text x="${W / 2}" y="14" text-anchor="middle" class="ct">${title}</text>`;
  [0, 50, 100].forEach(v => s += `<line x1="28" x2="${W - 6}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="24" y="${y(v) + 4}" text-anchor="end" class="ax">${v}</text>`);
  rows.forEach((r, i) => {
    const x = x0 + i * gap;
    [[r.a, '#c4b5fd', 'قبل'], [r.b, i ? '#ff8a3d' : '#7c5cff', 'بعد']].forEach(([v, c, lb], j) => {
      if (v == null) return;
      const xx = x + j * (bw + 8);
      s += `<rect x="${xx}" y="${y(v)}" width="${bw}" height="${160 - y(v)}" rx="6" fill="${j ? c : '#d6d3e8'}"/><text x="${xx + bw / 2}" y="${y(v) - 5}" text-anchor="middle" class="vl">${Math.round(v)}%</text><text x="${xx + bw / 2}" y="176" text-anchor="middle" class="ax">${lb}</text>`;
    });
    s += `<text x="${x + bw + 4}" y="194" text-anchor="middle" class="cl">${r.l}</text>`;
  });
  return s + '</svg>';
}

/* ---------- تقدّمي ---------- */
function scrProgress(tab = 'g'){
  const pr = P(), t = pr.tests;
  const ring = (v, c, l) => `<div class="ring" style="--v:${pct(v)};--c:${c}"><div><b>${pct(v)}%</b><small>${l}</small></div></div>`;
  const acc = m => { const a = AG.accuracy(m); return a == null ? '—' : pct(a) + '%'; };
  view(`<div class="card"><div class="row center g20">${ring(AG.progress('g'), 'var(--g)', 'النحو')}${ring(AG.progress('s'), 'var(--s)', 'الإملاء')}</div>
     <p class="center small">الإتقان (تقدير الوكيل) • دقة الإجابات: النحو ${acc('g')} • الإملاء ${acc('s')}</p></div>
   <div class="card"><h3>📝 الاختبار القبلي والبعدي</h3>${t.pre ? testChart([{l:'النحو', a:t.pre.g, b:t.post ? t.post.g : null}, {l:'الإملاء', a:t.pre.s, b:t.post ? t.post.s : null}]) : '<p>لم يُجرَ الاختبار القبلي بعد.</p>'}</div>
   <div class="tabs"><button class="${tab === 'g' ? 'on' : ''}" onclick="scrProgress('g')">📚 النحو</button><button class="${tab === 's' ? 'on' : ''}" onclick="scrProgress('s')">✏️ الإملاء</button></div>
   <div class="card">${LIST(tab).map(c => { const p = pr.m[c.id] ?? 0, a = pr.at[c.id]; return `<div class="pr"><span>${c.e} ${c.t}</span>${bar(p, tab === 'g' ? 'var(--g)' : 'var(--s)')}<small>${pct(p)}% ${a ? `• ${a.c}/${a.n}` : ''}</small></div>`; }).join('')}</div>`,
   {title:'تقدّمي', back:'scrHome()'});
}

/* ---------- لوحة المعلم / ولي الأمر ---------- */
let GATE = null;
function scrTeacherGate(){
  const a = 3 + Math.floor(Math.random() * 7), b = 4 + Math.floor(Math.random() * 6); GATE = a * b;
  view(`<div class="card"><h3>👩‍🏫 للكبار فقط</h3><p>للدخول، أجب: كم يساوي ${a} × ${b}؟</p><input id="gate" inputmode="numeric" placeholder="الجواب"><button class="btn big" onclick="+$('#gate').value===GATE?scrTeacher():toast('إجابة غير صحيحة')">دخول</button></div>`,
   {title:'لوحة المعلم', back:S.cur ? 'scrHome()' : 'scrProfiles()'});
}
function scrTeacher(){
  const ps = Object.values(S.profiles);
  const paired = ps.filter(p => p.tests.pre && p.tests.post);
  const avg = (arr, f) => arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null;
  const A = {gp:avg(paired, p => p.tests.pre.g), ga:avg(paired, p => p.tests.post.g), sp:avg(paired, p => p.tests.pre.s), sa:avg(paired, p => p.tests.post.s)};
  const f = v => v == null ? '—' : Math.round(v) + '%';
  const d = (a, b) => a == null || b == null ? '—' : `${b - a >= 0 ? '+' : ''}${Math.round(b - a)}`;
  const bandOf = p => (p.tests.pre && p.tests.pre.band) || (p.age <= 6 ? 'A' : p.age <= 8 ? 'B' : p.age <= 10 ? 'C' : 'D');
  const byBand = Object.keys(BAND_NAME).map(b => { const ps2 = paired.filter(p => bandOf(p) === b); return ps2.length ? `<tr><td>${BAND_NAME[b]}</td><td>${ps2.length}</td><td>${f(avg(ps2, p => p.tests.pre.g))} ← ${f(avg(ps2, p => p.tests.post.g))}</td><td>${f(avg(ps2, p => p.tests.pre.s))} ← ${f(avg(ps2, p => p.tests.post.s))}</td></tr>` : ''; }).join('');
  const csv = ['code,age,test_group,pre_grammar,post_grammar,pre_spelling,post_spelling,grammar_mastery,spelling_mastery,stars',
    ...ps.map(p => [p.name.replace(/,/g, ' '), p.age, BAND_NAME[bandOf(p)], p.tests.pre?.g ?? '', p.tests.post?.g ?? '', p.tests.pre?.s ?? '', p.tests.post?.s ?? '', pctOf(p, 'g'), pctOf(p, 's'), p.stars].join(','))].join('\n');
  view(`<div class="card"><h3>👥 ملخص النتائج</h3>
     <p>عدد الأطفال: <b>${ps.length}</b> • أكملوا الاختبارين: <b>${paired.length}</b></p>
     <table class="tbl"><tr><th></th><th>قبل</th><th>بعد</th><th>التحسّن (نقاط)</th></tr>
     <tr><td>📚 النحو</td><td>${f(A.gp)}</td><td>${f(A.ga)}</td><td><b>${d(A.gp, A.ga)}</b></td></tr>
     <tr><td>✏️ الإملاء</td><td>${f(A.sp)}</td><td>${f(A.sa)}</td><td><b>${d(A.sp, A.sa)}</b></td></tr></table>
     ${byBand ? `<h3>حسب الفئة العمرية (لكل فئة اختبار يناسبها)</h3><table class="tbl sm"><tr><th>الفئة</th><th>العدد</th><th>النحو قبل ← بعد</th><th>الإملاء قبل ← بعد</th></tr>${byBand}</table>` : ''}
     ${paired.length ? testChart([{l:'النحو', a:A.gp, b:A.ga}, {l:'الإملاء', a:A.sp, b:A.sa}], `متوسط الدرجات (ن = ${paired.length})`) : '<p class="small">يظهر الرسم البياني بعد أن يُكمل طفل واحد على الأقل الاختبارين.</p>'}</div>
   <div class="card"><h3>📋 كل طفل (رموز فقط)</h3><div class="scroll"><table class="tbl sm"><tr><th>الرمز</th><th>العمر</th><th>نحو قبل</th><th>نحو بعد</th><th>إملاء قبل</th><th>إملاء بعد</th><th></th></tr>
     ${ps.map(p => `<tr><td>${esc(p.name)}</td><td>${p.age}</td><td>${f(p.tests.pre?.g)}</td><td>${f(p.tests.post?.g)}</td><td>${f(p.tests.pre?.s)}</td><td>${f(p.tests.post?.s)}</td><td><button class="mini" onclick="delP('${p.id}')">🗑</button></td></tr>`).join('')}</table></div></div>
   <div class="card"><h3>📤 تصدير البيانات (CSV)</h3><p class="small">انسخ النص والصقه في Excel لعمل الرسوم في العرض التقديمي.</p>
     <textarea id="csv" readonly>${esc(csv)}</textarea><button class="btn" onclick="copyCSV()">📋 نسخ</button></div>`,
   {title:'لوحة المعلم', back:S.cur ? 'scrHome()' : 'scrProfiles()'});
}
const pctOf = (p, m) => Math.round(LIST(m).reduce((s, c) => s + (p.m[c.id] ?? 0), 0) / LIST(m).length * 100);
function copyCSV(){ const t = $('#csv'); try { navigator.clipboard.writeText(t.value).then(() => toast('تم النسخ ✅'), () => { t.select(); toast('حدّد النص وانسخه يدويًا'); }); } catch(e){ t.select(); toast('حدّد النص وانسخه يدويًا'); } }
let DEL = null;
function delP(id){
  if (DEL !== id){ DEL = id; return toast('اضغط 🗑 مرة ثانية للتأكيد'); }
  delete S.profiles[id]; if (S.cur === id) S.cur = null; DEL = null; save(); scrTeacher();
}

/* ---------- فحص الصوت ---------- */
function scrSound(){
  let vs = []; try { vs = speechSynthesis.getVoices(); } catch(e){}
  const ar = vs.filter(v => /^ar/i.test(v.lang));
  const ok = window.AndroidTTS ? AndroidTTS.hasArabic() : ar.length > 0;
  view(`<div class="card"><h3>🔊 فحص الصوت</h3>
    <p>القراءة بالصوت: ${'speechSynthesis' in window || window.AndroidTTS ? '✅ مدعومة' : '❌ غير مدعومة'}</p>
    <p>صوت عربي في الجهاز: ${ok ? '✅ موجود' + (ar[0] ? ` (${esc(ar[0].name)})` : '') : '❌ غير موجود'}</p>
    <button class="btn big" onclick="say('مرحبًا! أنا نحّولة. بابٌ، نورٌ، فيلٌ، صاروخٌ')">🗣️ جرّب القراءة</button></div>
   ${ar.length ? `<div class="card"><h3>🎙️ اختر الصوت</h3><p class="small">اضغط على صوت لتسمعه ويُحفظ اختيارك.</p>
    <div class="opts">${ar.slice().sort((a, b) => voiceScore(b) - voiceScore(a)).map(v => `<button class="opt ${arVoice() && arVoice().name === v.name ? 'right' : ''}" data-n="${esc(v.name)}" onclick="S.voice=this.dataset.n;save();say('بابٌ، نورٌ، فيلٌ');scrSound()">${esc(v.name)}${voiceScore(v) >= 100 ? ' ⭐' : ''}</button>`).join('')}</div></div>` : ''}
   <div class="card"><h3>🐢 سرعة القراءة</h3><div class="row g6">${[[0.6, 'بطيئة'], [0.75, 'متوسطة'], [0.9, 'عادية']].map(([r, l]) => `<button class="btn ${ (S.rate || 0.75) === r ? '' : 'ghost'}" style="flex:1" onclick="S.rate=${r};save();say('صاروخٌ، عصفورٌ، سفينةٌ');scrSound()">${l}</button>`).join('')}</div>
    <button class="btn big ghost mt8" onclick="S.sound=true;tone(true)">🎵 جرّب نغمة الإجابة الصحيحة</button></div><div>
</div>
   <div class="card"><h3>إذا لم تسمع شيئًا (آيفون / آيباد)</h3>
    <p>1) ارفع الصوت بأزرار الجهاز، وأوقف الوضع الصامت 🔕.<br>
    2) الإعدادات ← تسهيلات الاستخدام ← المحتوى المنطوق ← الأصوات ← العربية ← نزّل صوتًا (مثل Majed). اختر النسخة «المحسّنة» (Enhanced) لأنها أوضح بكثير.<br>
    3) أغلق التطبيق تمامًا وافتحه من جديد، ثم ارجع لهذه الصفحة.<br>
    4) إذا لم يعمل من أيقونة الشاشة الرئيسية، جرّبه من Safari مباشرة.</p></div>`,
   {title:'فحص الصوت', back:S.cur ? 'scrHome()' : 'scrProfiles()'});
}

/* ---------- دليل الاستخدام ---------- */
function scrGuide(){
  view(`<div class="card guide">
   <h3>📱 التثبيت</h3><p><b>أندرويد:</b> نزّل ملف التطبيق (APK) وافتحه، واسمح بالتثبيت من هذا المصدر عند الطلب.<br><b>آيفون/آيباد:</b> افتح رابط التطبيق في Safari ← زر «مشاركة» ← «إضافة إلى الشاشة الرئيسية». يظهر التطبيق بأيقونة النحلة ويعمل بدون إنترنت.</p>
   <h3>👤 إنشاء متعلّم</h3><p>اكتب اسمًا مستعارًا أو رمزًا (مثل: نجمة ٣) واختر العمر. لا تكتب الاسم الكامل. يمكن إضافة أكثر من طفل على نفس الجهاز.</p>
   <h3>📝 الاختبار القبلي</h3><p>أسئلة نحو وإملاء بلا تلميحات، تناسب عمر الطفل (6 + 6 لعمر 5–6، و8 + 8 للأكبر). يستخدمه الوكيل لتحديد المستوى.</p>
   <h3>📚 النحو والإعراب (${GRAMMAR.length} درسًا)</h3><p>اختر درسًا ← اقرأ الشرح واستمع إليه 🔊 ← شاهد المثال وإعرابه ← «تدرّب الآن» (6 أسئلة). «مختبر الإعراب» لتحليل الجمل كلمة كلمة.</p>
   <h3>✏️ الإملاء (${SPELLING.length} دروس)</h3><p>لكل درس شرح وحيلة ذكية وأمثلة مسموعة، وأنشطة: أكمل الحرف الناقص، اختر الكتابة الصحيحة، طابق الصورة، صحّح الكلمة، استمع واكتب.</p>
   <h3>🎂 التكييف حسب العمر</h3><p>• لكل عمر دروس تناسبه، والدروس الأصعب تظهر تحت «دروس للأعمار الأكبر».<br>• صعوبة الأسئلة خمسة مستويات؛ عمر 5 يبدأ بالأسهل، وكل سنة أصعب قليلًا، حتى عمر 12.<br>• عمر 5–6: خياران فقط، أسئلة بالصور، شرح مختصر، قراءة السؤال بالصوت، ولا كتابة.<br>• عمر 7–8: ثلاثة خيارات، وتبدأ أنشطة الكتابة.<br>• عمر 9 فما فوق: كل الخيارات وأسئلة أصعب.<br>• الاختبار القبلي والبعدي له أربع نسخ: 5–6، 7–8، 9–10، 11–12.</p>
   <h3>🐝 الوكيل الذكي «نحّولة»</h3><p>• يقدّر إتقان الطفل لكل درس بعد كل إجابة (نموذج تتبّع المعرفة).<br>• يختار السؤال التالي: أسهل بعد الخطأ، وأصعب بعد النجاح، ويشرح سبب اختياره.<br>• عند الخطأ: تلميح أولًا ثم الإجابة الصحيحة مع الشرح، ويقترح مراجعة الدرس إذا تكرر الخطأ.<br>• يقترح الدرس التالي حسب العمر ونقاط الضعف ونتيجة الاختبار القبلي.<br>• «المراجعة الذكية» تجمع أسئلة من أضعف الدروس.</p>
   <h3>⚠️ حدود الوكيل</h3><p>• يعتمد على قواعد ونموذج إحصائي بسيط، ولا يكتب شرحًا جديدًا بالذكاء التوليدي؛ كل الشروح مكتوبة مسبقًا ومراجعة لتجنّب الأخطاء.<br>• لا يفهم الكلام الحر ولا يقيّم الخط اليدوي.<br>• تقدير الإتقان تقريبي ويحتاج إلى عدة إجابات ليصبح دقيقًا.<br>• الإملاء الصوتي يحتاج صوتًا عربيًا في الجهاز؛ وإن لم يتوفر يتحول إلى اختيار.</p>
   <h3>📈 التقدّم والاختبار البعدي</h3><p>«تقدّمي» يعرض إتقان النحو والإملاء كلٌّ على حدة. بعد التدريب أجرِ «الاختبار البعدي» للمقارنة.</p>
   <h3>👩‍🏫 لوحة المعلم</h3><p>من الشاشة الأولى ← «للمعلم / ولي الأمر» (سؤال حساب بسيط). تعرض عدد الأطفال ومتوسط الدرجات قبل وبعد مع رسم بياني، وتصدير CSV.</p>
   <h3>🔒 الخصوصية</h3><p>البيانات محفوظة على هذا الجهاز فقط ولا تُرسل إلى أي خادم. استخدم رموزًا لا أسماء حقيقية، واحصل على إذن ولي الأمر قبل التجربة.</p>
   <p class="small center">© 2026 Latifa Al-Mulla — جميع الحقوق محفوظة. للاستخدام الشخصي والتعليمي فقط؛ الاستخدام التجاري يحتاج إذنًا كتابيًا.</p></div>`,
   {title:'دليل الاستخدام', back:S.cur ? 'scrHome()' : 'scrProfiles()'});
}

/* ---------- التشغيل ---------- */
load();
S.cur && S.profiles[S.cur] ? scrHome() : scrProfiles();
