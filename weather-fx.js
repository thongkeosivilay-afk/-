/* =========================================================
   weather-fx.js — สภาพอากาศเป็น "พื้นหลังของเว็บ" ทุกหน้า
   หิมะดาว → ลมพายุหิมะ → ฝน → พายุฟ้าร้องฟ้าผ่า → วนใหม่ (เปลี่ยนแบบไหลต่อกัน)

   ชั้นการแสดงผล (ล่าง -> บน):
     1) .wfx-tint   (z -3)  ความมืดของพายุ ดำอมแดง          ┐
     2) .wfx-glow   (z -2)  แสงแดงสะท้อน + แถบแสงวิ่งผ่าน     │ อยู่หลังเนื้อหาเว็บทั้งหมด
     3) .wfx-back   (z -1)  หิมะ/ฝน/ลม/หมอก/สายฟ้า (ส่วนใหญ่)  ┘ (เห็นผ่านช่องว่าง/แถบหัวเว็บแบบกระจก)
     4) เนื้อหาเว็บ
     5) .wfx-front  (z 35)  "บางเม็ด" ที่ลอยผ่านหน้าจอ: เกล็ดดาวใหญ่ใกล้กล้อง, เม็ดฝนใหญ่, แสงสายฟ้าสาดทับ
   ทุกชั้น pointer-events:none ไม่ขวางการกด — ใต้หัวเว็บ (z 40) และป๊อปอัป (z 50+)
   - หยุดเมื่อแท็บถูกซ่อน, ลดคุณภาพอัตโนมัติถ้าเครื่องช้า
   - เปิดโหมดลดการเคลื่อนไหวในเครื่อง -> เหลือแค่หิมะเบาๆ ไม่มีแฟลช/สายฟ้า
   ทดสอบเฉพาะแบบ: เติม ?weather=snow | wind | rain | storm ท้าย URL (หรือเรียก WeatherFX.set('storm') ใน console)
   ========================================================= */
(function () {
  'use strict';
  if (window.WeatherFX) return;
  function boot() {
  if (window.WeatherFX) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  root.classList.add('wfx-on'); // CSS ใช้ class นี้ทำให้พื้นหลังหน้าเว็บโปร่งใส เพื่อให้เห็นชั้นสภาพอากาศด้านหลัง

  function mk(tag, cls) {
    var e = document.createElement(tag);
    e.className = cls; e.setAttribute('aria-hidden', 'true');
    return e;
  }
  var cvB = mk('canvas', 'wfx-back');
  var cvF = mk('canvas', 'wfx-front');
  root.appendChild(cvB); root.appendChild(cvF);
  var ctx = cvB.getContext('2d');   // ชั้นหลัง
  var ctxF = cvF.getContext('2d');  // ชั้นหน้า (บางเม็ด)

  var W = 0, H = 0, dprB = 1, dprF = 1, quality = 1, halfRate = false;
  var rand = Math.random;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  /* ---------- สไปรต์เกล็ดหิมะ (วาดไว้ล่วงหน้า) ---------- */
  function makeSprite(size, stops) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    var gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  }
  var sprSharp = makeSprite(48, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(250,253,255,.95)'], [0.7, 'rgba(225,238,255,.4)'], [1, 'rgba(200,225,255,0)']]);
  var sprSharpR = makeSprite(48, [[0, 'rgba(255,238,234,1)'], [0.4, 'rgba(255,130,115,.95)'], [0.7, 'rgba(255,45,30,.4)'], [1, 'rgba(255,0,0,0)']]);
  var sprSoft = makeSprite(64, [[0, 'rgba(255,255,255,.75)'], [0.45, 'rgba(225,238,255,.35)'], [1, 'rgba(210,230,255,0)']]);

  // แถบลมแบบเรืองจาง (วาดไว้ล่วงหน้า แทนการสร้าง gradient ใหม่ทุกเฟรม)
  function makeStreak(dir) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 3;
    var g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 128, 0);
    gr.addColorStop(dir > 0 ? 0 : 1, 'rgba(255,205,200,0)');
    gr.addColorStop(dir > 0 ? 1 : 0, 'rgba(255,225,220,1)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 3);
    return c;
  }
  var streakR = makeStreak(1), streakL = makeStreak(-1);

  /* ---------- สไปรต์ "ดาวหิมะ" (ผลึก 6 แฉก / ดาวประกาย 4 แฉก) วาดไว้ล่วงหน้า ---------- */
  function makeStar(variant, soft, red) {
    var size = 64, c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    var R = size * 0.38;
    g.lineCap = 'round'; g.lineJoin = 'round';
    var col = red ? (soft ? 'rgba(255,205,200,.75)' : 'rgb(255,222,218)') : (soft ? 'rgba(235,245,255,.7)' : '#ffffff');
    g.strokeStyle = col; g.fillStyle = col;
    g.shadowColor = red ? 'rgba(255,40,28,1)' : 'rgba(170,210,255,1)';
    g.shadowBlur = soft ? size * 0.24 : size * 0.11;
    g.lineWidth = soft ? size * 0.075 : size * 0.04;
    var i;
    if (variant === 2) { // ดาวประกายโค้งเว้า 4 แฉก + 4 แฉกเล็กเฉียง
      var pts = [[0, -R], [R, 0], [0, R], [-R, 0]];
      g.beginPath();
      g.moveTo(0, -R);
      for (i = 0; i < 4; i++) { var n = pts[(i + 1) % 4]; g.quadraticCurveTo(0, 0, n[0], n[1]); }
      g.closePath(); g.fill();
      g.rotate(Math.PI / 4);
      var r2 = R * 0.5;
      g.beginPath();
      g.moveTo(0, -r2);
      var q2 = [[r2, 0], [0, r2], [-r2, 0], [0, -r2]];
      for (i = 0; i < 4; i++) g.quadraticCurveTo(0, 0, q2[i][0], q2[i][1]);
      g.closePath(); g.fill();
      return c;
    }
    for (i = 0; i < 6; i++) {
      g.save(); g.rotate(i * Math.PI / 3);
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(0, -R);
      if (variant === 0) { // ผลึกแบบใบเฟิร์น: กิ่งสองคู่
        g.moveTo(0, -R * 0.42); g.lineTo(-R * 0.3, -R * 0.64); g.moveTo(0, -R * 0.42); g.lineTo(R * 0.3, -R * 0.64);
        g.moveTo(0, -R * 0.7); g.lineTo(-R * 0.22, -R * 0.88); g.moveTo(0, -R * 0.7); g.lineTo(R * 0.22, -R * 0.88);
      } else { // ผลึกแบบแฉกปลายแยก + จุดที่ปลาย
        g.moveTo(0, -R * 0.62); g.lineTo(-R * 0.26, -R * 0.84); g.moveTo(0, -R * 0.62); g.lineTo(R * 0.26, -R * 0.84);
      }
      g.stroke();
      if (variant === 1) { g.beginPath(); g.arc(0, -R * 1.02, size * 0.032, 0, 6.283); g.fill(); }
      g.restore();
    }
    g.beginPath(); g.arc(0, 0, size * (variant === 1 ? 0.06 : 0.045), 0, 6.283); g.fill();
    if (variant === 1) { // วงหกเหลี่ยมกลาง
      g.lineWidth = soft ? size * 0.05 : size * 0.025;
      g.beginPath();
      for (i = 0; i < 6; i++) { var a = i * Math.PI / 3; g[i ? 'lineTo' : 'moveTo'](Math.sin(a) * R * 0.34, -Math.cos(a) * R * 0.34); }
      g.closePath(); g.stroke();
    }
    return c;
  }
  var starSharp = [makeStar(0, false), makeStar(1, false), makeStar(2, false)];
  var starSoft = [makeStar(0, true), makeStar(1, true), makeStar(2, true)];
  var starSharpR = [makeStar(0, false, 1), makeStar(1, false, 1), makeStar(2, false, 1)];
  var starSoftR = [makeStar(0, true, 1), makeStar(1, true, 1), makeStar(2, true, 1)];

  /* ---------- สภาพอากาศอัตโนมัติ (เหมือนสภาพอากาศจริง) ----------
     ไม่ได้วนเป็นวงกลมตายตัว แต่เป็น "เครือข่ายสถานะ" ที่สุ่มเปลี่ยนตามความน่าจะเป็น
     เช่น หิมะ -> ลมแรง/หิมะเบา/ฝนปนหิมะ -> ฝนปรอย -> ฝน -> ฝนหนัก -> พายุ -> ซาลง
     พายุจะ "ก่อตัวก่อน" (ฝนหนักมีแลบฟ้าไกลๆ) ไม่โผล่มาทันที, ฟ้าผ่าถี่สุดช่วงกลางพายุแล้วห่างลง
     ความแรงขึ้นลงเป็นระลอก, ทิศลมค่อยๆ เบนไม่กระตุก, และจำสภาพอากาศข้ามหน้าเว็บได้ */
  var PRESETS = {
    flurry: { snow: 0.55, rain: 0, storm: 0, wind: 0.10, gust: 0.25 },
    snow:   { snow: 1,    rain: 0, storm: 0, wind: 0.12, gust: 0.30 },
    heavy:  { snow: 1,    rain: 0, storm: 0, wind: 0.18, gust: 0.35 }
  };
  var GRAPH = {
    flurry: [['snow', 0.60], ['heavy', 0.15], ['flurry', 0.25]],
    snow:   [['flurry', 0.50], ['heavy', 0.30], ['snow', 0.20]],
    heavy:  [['snow', 0.70], ['flurry', 0.30]]
  };
  var DUR = { flurry: [20, 38], snow: [30, 58], heavy: [20, 36] };
  var S = { snow: 1, rain: 0, storm: 0, wind: 0.12, gust: 0.35 }; // ค่าปัจจุบัน
  var T = { snow: 1, rain: 0, storm: 0, wind: 0.12, gust: 0.35 }; // ค่าเป้าหมาย
  var seqLeft = 40, stateDur = 40, auto = true, forced = false, currentName = 'snow', speed = 1;
  var dirTarget = 1, dirCur = 1, time = 0;
  var gustEv = 0, gustTimer = 6, gustAge = 99, gustPow = 0;

  function pickNext(cur) {
    var row = GRAPH[cur] || GRAPH.snow, r = rand(), acc = 0;
    for (var i = 0; i < row.length; i++) { acc += row[i][1]; if (r <= acc) return row[i][0]; }
    return row[0][0];
  }
  function applyPreset(name) {
    var p = PRESETS[name]; if (!p) return;
    currentName = name;
    var v = name === 'storm' ? 1 : 0.88 + rand() * 0.24; // แต่ละครั้งแรงไม่เท่ากัน
    for (var k in p) T[k] = clamp(p[k] * (k === 'gust' ? 1 : v), 0, 1);
    // ทิศลม: ส่วนใหญ่คงทิศเดิม พลิกกลับนานๆ ครั้ง และเบนไปทีละน้อย (ไม่สลับทิศฉับพลัน)
    if (rand() < 0.22) dirTarget = -dirTarget;
    dirTarget = (dirTarget < 0 ? -1 : 1) * (0.75 + rand() * 0.4);
  }
  function startState(name) {
    applyPreset(name);
    var d = DUR[name] || [20, 40];
    stateDur = seqLeft = d[0] + rand() * (d[1] - d[0]);
  }

  /* ---------- จำสภาพอากาศข้ามหน้า (เว็บเปลี่ยนหน้าแล้วอากาศต้องไม่รีเซ็ต) ---------- */
  var KEY = 'wfx_state_v3';
  function saveState() {
    if (!auto || forced) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ n: currentName, l: seqLeft, d: stateDur, S: S, T: T, dt: dirTarget, dc: dirCur, t: Date.now() }));
    } catch (e) { /* ignore */ }
  }
  function loadState() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!o || !PRESETS[o.n] || Date.now() - o.t > 10 * 60 * 1000) return false;
      var el = (Date.now() - o.t) / 1000;
      var name = o.n, left = o.l - el, guard = 0;
      while (left <= 0 && guard++ < 8) { name = pickNext(name); var d = DUR[name]; left += d[0] + rand() * (d[1] - d[0]); }
      for (var k in S) { if (typeof o.S[k] === 'number') S[k] = o.S[k]; }
      currentName = name; dirTarget = o.dt || 1; dirCur = o.dc || dirTarget;
      applyPreset(name);
      if (name === o.n) for (var k2 in T) if (typeof o.T[k2] === 'number') T[k2] = o.T[k2];
      seqLeft = Math.max(left, 4); stateDur = Math.max(o.d || 40, seqLeft);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- อนุภาค ---------- */
  var MAX_SNOW = 0, MAX_RAIN = 0, snow = [], rain = [], streaks = [], splashes = [];
  var SNOW_SCALE = 0.36; // ขนาดเกล็ดหิมะ (เล็กลงอีก) — ปรับเลขนี้ถ้าอยากใหญ่/เล็กกว่านี้
  var FRONT_SNOW_Z = 0.78, FRONT_RAIN_Z = 0.88; // เฉพาะเม็ดที่ "ใกล้กล้อง" เท่านั้นที่ลอยอยู่หน้าเนื้อหา

  function initSnow(f, i, n) {
    f.z = rand(); f.th = i / n;
    f.x = rand() * W; f.y = rand() * H;
    f.ph = rand() * 6.283; f.sw = 8 + rand() * 18;
    f.r = 0.8 + f.z * f.z * 3.2 + f.z * 0.6;
    f.ty = (rand() * 3) | 0; f.rot = rand() * 6.283; f.sp = (rand() - 0.5) * 1.4;
    f.front = f.z > FRONT_SNOW_Z;
  }
  function initRain(d, i, n) {
    d.z = rand(); d.th = i / n;
    d.x = rand() * (W + 200) - 100; d.y = rand() * H;
    d.len = 0.8 + rand() * 0.9; d.v = false; d.tx = 0; d.ty = 0;
    d.front = d.z > FRONT_RAIN_Z;
  }
  // ล็อกขนาดแคนวาสเป็น px ตายตัว: แถบ URL มือถือหด/ขยายตอนเลื่อน จะไม่ทำให้ภาพถูกยืด/หด/รีเซ็ต
  function sizeCanvas(cv, c, d) {
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    c.setTransform(d, 0, 0, d, 0, 0);
  }
  var fogGrad = null;
  var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var EXTRA = coarse ? 180 : 0; // เผื่อความสูงสำหรับตอนแถบ URL บนมือถือหดลง (หน้าจอสูงขึ้นแต่แคนวาสไม่ต้องสร้างใหม่)
  function viewW() { return document.documentElement.clientWidth || window.innerWidth; }
  function viewH() { return Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0); }
  function allocCanvases() { // ปรับความละเอียด/ขนาดแคนวาสอย่างเดียว ไม่ยุ่งกับตำแหน่งเกล็ด
    var dv = window.devicePixelRatio || 1;
    // ชั้นหลังเป็นฉากนุ่มๆ ใช้ความละเอียดต่ำกว่าได้ (เบากว่ามาก) / ชั้นหน้าคมกว่าเล็กน้อย
    dprB = quality < 0.6 ? 1 : Math.min(dv, 1.25);
    dprF = quality < 0.6 ? 1 : Math.min(dv, 1.5);
    sizeCanvas(cvB, ctx, dprB); sizeCanvas(cvF, ctxF, dprF);
    fogGrad = ctx.createLinearGradient(0, H * 0.62, 0, H);
    fogGrad.addColorStop(0, 'rgba(255,40,30,0)');
    fogGrad.addColorStop(1, 'rgba(255,40,30,.20)');
    dirtyF = false;
  }
  function resize() {
    var nw = viewW(), nh = viewH() + EXTRA;
    var first = !W, sameW = !first && Math.abs(nw - W) < 2;
    // ความสูงเปลี่ยนเพราะแถบ URL / คีย์บอร์ด (ความกว้างเท่าเดิม): ไม่ต้องทำอะไร ยกเว้นจอสูงกว่าแคนวาสเดิมจริงๆ ค่อยขยาย
    if (sameW && nh <= H) return;
    var ow = W, oh = H;
    W = nw; H = nh;
    allocCanvases();
    var sx = first ? 1 : W / ow, sy = (first || sameW) ? 1 : H / oh;
    var area = W * H;
    MAX_SNOW = Math.round(clamp(area / 6000, 30, 120));
    MAX_RAIN = 0; // ไม่มีฝนแล้ว
    var i, j, f, d;
    // เก็บเกล็ด/เม็ดฝนเดิมไว้ แค่ย้ายตำแหน่งตามสัดส่วน -> ไม่หายวับแล้วโผล่ใหม่ตอนปรับขนาด
    for (i = 0; i < snow.length; i++) { snow[i].x *= sx; snow[i].y *= sy; }
    for (j = 0; j < rain.length; j++) { rain[j].x *= sx; rain[j].y *= sy; }
    if (snow.length > MAX_SNOW) snow.length = MAX_SNOW;
    while (snow.length < MAX_SNOW) { f = {}; initSnow(f, snow.length, MAX_SNOW); snow.push(f); }
    for (i = 0; i < snow.length; i++) snow[i].th = i / MAX_SNOW;
    if (rain.length > MAX_RAIN) rain.length = MAX_RAIN;
    while (rain.length < MAX_RAIN) { d = {}; initRain(d, rain.length, MAX_RAIN); rain.push(d); }
    for (j = 0; j < rain.length; j++) rain[j].th = j / MAX_RAIN;
    if (!streaks.length) for (var k = 0; k < 8; k++) streaks.push({ x: rand() * W, y: rand() * H, len: 90 + rand() * 170, sp: 0.7 + rand() * 0.9, a: 0.05 + rand() * 0.08 });
  }

  /* ---------- สายฟ้า ---------- */
  var bolts = [], flashI = 0, nextStrike = 1e9, pendingRumble = [];
  function genBolt(x1, y1, x2, y2, d, w, out, depth) {
    if (d < 7) { out.push([x1, y1, x2, y2, w]); return; }
    var mx = (x1 + x2) / 2 + (rand() - 0.5) * d;
    var my = (y1 + y2) / 2 + (rand() - 0.5) * d * 0.4;
    genBolt(x1, y1, mx, my, d / 2, w, out, depth);
    genBolt(mx, my, x2, y2, d / 2, w, out, depth);
    if (depth < 2 && rand() < 0.22) {
      var a = Math.atan2(y2 - y1, x2 - x1) + (rand() - 0.5) * 1.4;
      var L = Math.hypot(x2 - x1, y2 - y1) * (0.5 + rand() * 0.6);
      genBolt(mx, my, mx + Math.cos(a) * L, my + Math.sin(a) * L, d / 2, w * 0.55, out, depth + 1);
    }
  }
  function strike(sheetOnly) {
    var sheet = sheetOnly || rand() < 0.3; // แลบฟ้าไกลๆ (เห็นแต่แสงวาบ)
    var x = W * (0.12 + rand() * 0.76);
    var b = { t0: time, x: x, sheet: sheet, segs: [], pow: 0.75 + rand() * 0.25, third: rand() < 0.35 };
    if (!sheet) {
      var y2 = H * (0.42 + rand() * 0.4), x2 = x + (rand() - 0.5) * W * 0.35;
      genBolt(x, -10, x2, y2, Math.hypot(x2 - x, y2) * 0.35, 2.6, b.segs, 0);
    }
    bolts.push(b);
    // สั่นเบาๆ ตามเสียงฟ้าร้อง (Android เท่านั้น และต้องเคยแตะหน้าจอแล้ว)
    var delay = 0.5 + rand() * 1.8;
    pendingRumble.push(time + delay);
    // ความถี่ขึ้นอยู่กับความแรงของพายุ และช่วงของพายุ (ถี่สุดกลางพายุ ห่างลงตอนก่อตัว/ซา)
    var inten = clamp((S.storm - 0.2) / 0.8, 0, 1);
    var prog = currentName === 'storm' && stateDur > 0 ? 1 - seqLeft / stateDur : 0.5;
    var peak = 1 - Math.abs(prog - 0.5) * 2;
    var gap = (14 - 11 * inten * (0.35 + 0.65 * peak)) * (0.7 + rand() * 0.8);
    nextStrike = time + gap;
    if (!sheetOnly && rand() < 0.3) nextStrike = time + 0.35 + rand() * 0.5; // ฟาดซ้ำเร็วๆ
  }
  function boltI(a) { // a = วินาทีนับจากเริ่มฟาด -> ความสว่าง 0..1 (วาบ-ดับ-วาบซ้ำ-ค่อยๆ จาง)
    var ms = a * 1000;
    if (ms < 90) return 1;
    if (ms < 150) return 0.18;
    if (ms < 260) return 0.9;
    return Math.max(0, 0.9 * Math.exp(-(ms - 260) / 150));
  }
  function thirdI(a) { var ms = a * 1000 - 330; return ms > 0 && ms < 70 ? 0.7 : 0; }

  /* ---------- ลูปหลัก ---------- */
  var glowV = -1, tintV = -1, dirtyF = false, lastRender = 0, last = 0, raf = 0, slowFrames = 0, emaDt = 0.016;

  function drawSnow(c, front, w, sAmt, nS, q) {
    for (var i = 0; i < nS; i++) {
      var f = snow[i];
      if (f.front !== front) continue;
      var fade = clamp((sAmt - f.th * q) * 6, 0, 1);
      if (fade <= 0) continue;
      var near = f.z > 0.82;
      var twk = 0.78 + 0.22 * Math.sin(time * 2.2 + f.ph * 3);
      // ยิ่งตกลงต่ำ (เข้าใกล้แสงแดงด้านล่าง) เกล็ดยิ่งเปลี่ยนจากขาวน้ำแข็งเป็นแดงเรืองแสง
      var rd = clamp((f.y / H - 0.45) * 2.0, 0, 1);
      var a0 = fade * twk * (1 - rd), a1 = fade * twk * rd;
      if (f.z < 0.22) { // เกล็ดไกลสุด: จุดประกายเล็กๆ
        var sd = f.r * 3.2, al = 0.55 + 0.4 * f.z;
        if (a0 > 0.01) { c.globalAlpha = al * a0; c.drawImage(sprSharp, f.x - sd / 2, f.y - sd / 2, sd, sd); }
        if (a1 > 0.01) { c.globalAlpha = al * a1; c.drawImage(sprSharpR, f.x - sd / 2, f.y - sd / 2, sd, sd); }
        continue;
      }
      var sz = (f.r * (near ? 9.5 : 6.4) + 6) * SNOW_SCALE;
      var D = front ? dprF : dprB;
      var spr = (near ? (a1 > a0 ? starSoftR : starSoft) : (a1 > a0 ? starSharpR : starSharp))[f.ty];
      var al2 = (near ? 0.75 : 0.7 + 0.3 * f.z) * (front ? 1 : 0.9);
      if (sz < 13) { // เกล็ดเล็ก: ไม่ต้องหมุน (วาดตรงๆ เร็วกว่ามาก)
        c.globalAlpha = al2 * (a0 + a1) * 0.95;
        c.drawImage(spr, f.x - sz / 2, f.y - sz / 2, sz, sz);
        continue;
      }
      var co = Math.cos(f.rot) * D, si = Math.sin(f.rot) * D;
      c.setTransform(co, si, -si, co, f.x * D, f.y * D);
      if (a0 > 0.01) { c.globalAlpha = al2 * a0; c.drawImage((near ? starSoft : starSharp)[f.ty], -sz / 2, -sz / 2, sz, sz); }
      if (a1 > 0.01) { c.globalAlpha = al2 * a1; c.drawImage((near ? starSoftR : starSharpR)[f.ty], -sz / 2, -sz / 2, sz, sz); }
      c.setTransform(D, 0, 0, D, 0, 0);
    }
    c.globalAlpha = 1;
  }

  function drawRain(c, front, nR, base) {
    c.lineCap = 'round';
    for (var bkt = 0; bkt < 3; bkt++) {
      if (front && bkt < 2) continue; // ชั้นหน้ามีแต่เม็ดใหญ่
      c.beginPath();
      c.lineWidth = front ? 2 : (bkt === 0 ? 0.7 : bkt === 1 ? 1.1 : 1.6);
      var al = front ? 0.5 : (bkt === 0 ? 0.18 : bkt === 1 ? 0.28 : 0.4);
      c.strokeStyle = 'rgba(' + (flashI > 0.2 ? '255,226,222' : '200,196,214') + ',' + clamp(base * al, 0, 1).toFixed(3) + ')';
      for (var j = 0; j < nR; j++) {
        var d = rain[j];
        if (!d.v || d.front !== front) continue;
        var db = d.z < 0.4 ? 0 : d.z < 0.75 ? 1 : 2;
        if (!front && db !== bkt) continue;
        c.moveTo(d.x, d.y); c.lineTo(d.tx, d.ty);
      }
      c.stroke();
    }
  }

  function drawBoltPasses(c, bo, I2, passes) {
    for (var pz = 0; pz < passes.length; pz++) {
      var P = passes[pz];
      c.beginPath();
      for (var sg = 0; sg < bo.segs.length; sg++) { var g = bo.segs[sg]; c.moveTo(g[0], g[1]); c.lineTo(g[2], g[3]); }
      c.lineWidth = P[0] * 0.8;
      c.strokeStyle = 'rgba(' + P[2] + ',' + (P[1] * I2).toFixed(3) + ')';
      c.stroke();
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // โหมดประหยัด: เครื่องช้ามาก -> วาด 30 เฟรม/วิ สม่ำเสมอ (ลื่นกว่าสะดุดที่ 40-50)
    if (halfRate && now - lastRender < 26) return;
    lastRender = now;
    var dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.066);
    time += dt;

    // ปรับคุณภาพอัตโนมัติ: ลดจำนวนอนุภาค -> ลดความละเอียด -> เหลือ 30 เฟรม/วิ
    // (ต้องช้าต่อเนื่องนานจริงๆ ถึงจะลด และลดแล้วไม่รีเซ็ตเกล็ด กันหิมะหายวับตอนเลื่อนหน้าจอ)
    emaDt = emaDt * 0.95 + dt * 0.05;
    var limit = halfRate ? 0.045 : 0.026;
    if (emaDt > limit) {
      if (++slowFrames > 120) {
        slowFrames = 0;
        if (quality > 0.55) { quality -= 0.15; if (quality < 0.6) allocCanvases(); } // ต่ำกว่า 0.6 -> ใช้ความละเอียด 1x
        else if (!halfRate) halfRate = true;
      }
    } else slowFrames = Math.max(0, slowFrames - 1);

    // เปลี่ยนสภาพอากาศอัตโนมัติ: สุ่มตามเครือข่ายความน่าจะเป็น
    if (auto && !reduce) {
      seqLeft -= dt * speed;
      if (seqLeft <= 0) startState(pickNext(currentName));
    }
    var k = 1 - Math.exp(-dt / 3.2); // ค่อยๆ ไหลเปลี่ยนช้าลงอีกนิด
    for (var key in T) S[key] += (T[key] - S[key]) * k;
    dirCur += (dirTarget - dirCur) * (1 - Math.exp(-dt / 4.5)); // ทิศลมค่อยๆ เบน

    // ลม: ฐาน + คลื่นเบาๆ + ลมกระโชกเป็นช่วงๆ
    gustTimer -= dt;
    if (gustTimer <= 0) { gustAge = 0; gustPow = 0.5 + rand() * 0.5; gustTimer = 6 + rand() * 10; }
    gustAge += dt;
    gustEv = gustAge < 1.6 ? gustAge / 1.6 : Math.max(0, 1 - (gustAge - 1.6) / 3.2);
    gustEv *= gustPow * S.gust;
    var n = (Math.sin(time * 0.4) + Math.sin(time * 0.93 + 2) + 2) / 4;
    var w = dirCur * (S.wind * (0.7 + 0.6 * n) + gustEv * 0.8);
    // ความแรงฝน/หิมะขึ้นลงเป็นระลอก (ซา-ซัด) ไม่คงที่ตลอด
    var pulse = (Math.sin(time * 0.23) + Math.sin(time * 0.61 + 1.7) + 2) / 4;

    flashI = 0;
    ctx.clearRect(0, 0, W, H);
    if (dirtyF) { ctxF.clearRect(0, 0, W, H); dirtyF = false; }
    var q = quality;

    // ----- หิมะ: อัปเดตตำแหน่งครั้งเดียว แล้ววาดแยกชั้นหลัง/หน้า -----
    var sAmt = clamp(S.snow * (0.9 + 0.2 * pulse), 0, 1) * (reduce ? 0.4 : 1);
    if (sAmt > 0.01) {
      var nS = Math.floor(MAX_SNOW * q);
      for (var i = 0; i < nS; i++) {
        var f = snow[i];
        var zz = 0.35 + f.z;
        f.ph += dt * (0.8 + f.z * 0.9);
        var turb = Math.sin(f.y * 0.012 + time * 1.3 + f.ph) * 16 * (0.3 + Math.abs(w));
        f.x += (w * 170 * zz + Math.sin(f.ph) * f.sw * (0.4 + f.z) + turb) * dt;
        f.y += (20 + f.z * 78) * (1 + 0.25 * Math.abs(w)) * dt;
        f.rot += f.sp * dt * (1 + Math.abs(w) * 1.2);
        if (f.y > H + 12) { f.y = -12; f.x = rand() * W; }
        if (f.x > W + 24) f.x = -24; else if (f.x < -24) f.x = W + 24;
      }
      drawSnow(ctx, false, w, sAmt, nS, q);
      drawSnow(ctxF, true, w, sAmt, nS, q); dirtyF = true;
    }
  }

  function start() { if (!raf) { last = performance.now(); emaDt = Math.min(emaDt, 0.02); slowFrames = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  resize();
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 200); });
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); saveState(); stop(); }
    else {
      if (hiddenAt && auto) seqLeft -= Math.min((Date.now() - hiddenAt) / 1000, 600); // เวลาผ่านไปแม้แท็บถูกซ่อน
      hiddenAt = 0; start();
    }
  });
  window.addEventListener('pagehide', saveState);
  setInterval(saveState, 15000); // เขียน localStorage ไม่ถี่ (การเขียนแบบ sync ทำให้เฟรมสะดุดได้)

  /* ---------- API สำหรับทดสอบ ---------- */
  window.WeatherFX = {
    set: function (name) { if (!PRESETS[name]) return false; auto = false; forced = true; applyPreset(name); return true; },
    auto: function () { auto = true; forced = false; startState(pickNext(currentName)); },
    speed: function (x) { speed = clamp(+x || 1, 1, 20); return speed; }, // เร่งเวลาไว้ดูการเปลี่ยนอากาศ
    state: function () { return { name: currentName, auto: auto, left: Math.max(0, seqLeft / speed), speed: speed, quality: quality, snow: S.snow, rain: S.rain, storm: S.storm, wind: S.wind }; },
    strike: function () {}
  };
  var forcedMode = false;
  try {
    var qp = new URLSearchParams(location.search).get('weather');
    if (qp && PRESETS[qp]) { auto = false; forced = true; forcedMode = true; applyPreset(qp); for (var kk in T) S[kk] = T[kk]; }
  } catch (e) { /* ignore */ }
  if (!forcedMode && !loadState()) startState('snow'); // เปิดครั้งแรกเริ่มจากหิมะ

  start();
  } // end boot

  // เริ่มหลังหน้าเว็บโหลดเสร็จและเบราว์เซอร์ว่าง — ไม่แย่งงานตอนเปิด/เปลี่ยนหน้า (กันกระตุกช่วงแรก)
  function go() {
    var f = function () { boot(); };
    if (window.requestIdleCallback) window.requestIdleCallback(f, { timeout: 1200 }); else setTimeout(f, 250);
  }
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
})();
