// leaderboard.js — ดึงข้อมูลจริงจาก GET /api/public/top-spenders (ข้อมูลตัวอย่างด้านล่างใช้เฉพาะตอนเปิด ?demo=1)
// avatar: ใส่ path รูป เช่น 'assets/avatars/nac.png' ถ้าเป็น null จะแสดงตัวอักษรแรกแทน
// frame:  (อันดับ 1) path รูปกรอบมังกร ถ้า null จะใช้กรอบ CSS
var LEADERBOARD = [
  { rank:1,  name:'NAC***', amount:10000.00, joined:'20/06/2026', avatar:null, frame:null },
  { rank:2,  name:'cry***', amount:5989.00,  joined:'17/06/2026', avatar:null },
  { rank:3,  name:'yun***', amount:5675.47,  joined:'29/09/2026', avatar:null },
  { rank:4,  name:'kha***', amount:3185.27,  joined:'13/09/2026', avatar:null },
  { rank:5,  name:'MAF***', amount:2482.54,  joined:'12/08/2026', avatar:null },
  { rank:6,  name:'pht***', amount:2182.00,  joined:'21/09/2026', avatar:null },
  { rank:7,  name:'CRA***', amount:1599.63,  joined:'13/09/2026', avatar:null },
  { rank:8,  name:'Ray***', amount:1358.62,  joined:'04/10/2026', avatar:null },
  { rank:9,  name:'POO***', amount:1165.00,  joined:'30/09/2026', avatar:null },
  { rank:10, name:'KIL***', amount:1115.61,  joined:'01/10/2026', avatar:null }
];

(function () {
  'use strict';

  /* ===================================================================
     หน้าจัดอันดับ "สด": โพล /api/public/top-spenders ทุก ~4 วินาที (เฉพาะตอนแท็บเปิดอยู่)
     เมื่ออันดับเปลี่ยน → การ์ดสลับตำแหน่งแบบเลื่อน (FLIP), ตัวเลขเงินวิ่งไปค่าใหม่,
     คนใหม่เข้าติดอันดับมีเอฟเฟกต์เด้งเข้า, คนที่อันดับขึ้นมีลูกศร ▲
     ป้องกันบัค: ไม่โพลซ้อนกัน, ทิ้งผลลัพธ์เก่าที่มาช้ากว่า, เน็ตหลุดแล้วคงข้อมูลเดิมไว้ + ลองใหม่เอง (backoff)
     =================================================================== */
  var POLL_MS = 4000, MAX_BACKOFF_MS = 30000, INTRO_MS = 3400;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var demo = /[?&]demo=1/.test(location.search);

  var S = { version: null, items: null, seq: 0, applied: 0, busy: false, timer: null, fails: 0, introDone: false, pending: null, ctrl: null };

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function money(n){ return Number(n || 0).toLocaleString('de-DE', { maximumFractionDigits:0 }) + ' ₭'; }
  function keyOf(u){ return u.key || (u.name + '|' + u.joined); }

  function avatar(u){
    var inner = u.avatar
      ? '<img src="' + esc(u.avatar) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>'
      : '<b>' + esc(u.name.charAt(0).toUpperCase()) + '</b>';
    return '<div class="avatar">' + inner + '</div>';
  }

  function card(u){
    var top = u.rank <= 3;
    var cls = 'lb-card r' + u.rank + (top ? ' top' : '');
    var frame = u.rank === 1
      ? '<div class="frame">' + (u.frame ? '<img src="' + esc(u.frame) + '" alt=""/>' : '<i class="frame-ring"></i>') + avatar(u) + '</div>'
      : '<div class="frame">' + avatar(u) + '</div>';
    var badge = u.rank === 1
      ? '<span class="legend"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c3 0 4-3 7-3l3 3 4-1c2 0 3 1 3 3H3Z"/><path d="M13 12c0-3 1-5 4-6-1 3 0 4 2 5M9 8c0-2 .8-3.5 3-4.5-.5 2 .2 3 1.5 3.5"/></svg>TOP 1 · LEGENDARY</span>'
      : '';
    return '<article class="' + cls + '" data-key="' + esc(keyOf(u)) + '">' + frame +
      '<div class="info">' + badge +
        '<div class="nm">' + esc(u.name) + '</div>' +
        '<div class="amt">' + money(u.amount) + '</div>' +
        '<div class="dt">ສະໝັກເມື່ອ ' + esc(u.joined) + '</div>' +
      '</div>' +
      '<div class="rk">' + u.rank + '</div></article>';
  }

  function render(list){
    document.getElementById('top3').innerHTML = list.filter(function(u){ return u.rank <= 3; }).map(card).join('');
    document.getElementById('rest').innerHTML = list.filter(function(u){ return u.rank > 3; }).map(card).join('');
    // รูปโหลดไม่ได้ -> กลับไปใช้ตัวอักษรแรกของชื่อ
    document.querySelectorAll('.avatar img').forEach(function(img){
      img.addEventListener('error', function(){
        var b = document.createElement('b'), nm = img.closest('.lb-card').querySelector('.nm');
        b.textContent = (nm ? nm.textContent : '?').charAt(0).toUpperCase();
        img.replaceWith(b);
      });
    });
    document.querySelector('.rank-divider').style.display = list.length > 3 ? '' : 'none';
  }

  // ตัวเลขเงินยาว: ลดขนาดตัวอักษรอัตโนมัติให้อยู่ในกรอบการ์ด (ไม่ล้นออก)
  function fitAmounts(){
    document.querySelectorAll('.lb-card').forEach(function(card){
      var amt = card.querySelector('.amt'); if (!amt) return;
      var u = amt.dataset.final; if (u) amt.textContent = u;
      amt.style.fontSize = '';
      var max = card.clientWidth - amt.offsetLeft - (card.classList.contains('r1') ? 48 : 18);
      var size = parseFloat(getComputedStyle(amt).fontSize);
      while (amt.scrollWidth > max && size > 11) { size -= 0.5; amt.style.fontSize = size + 'px'; }
    });
  }
  window.fitAmounts = fitAmounts;
  window.addEventListener('resize', fitAmounts);

  function countAmount(el, from, to, delay, onDone){
    var dur = 900, t0 = performance.now() + (delay || 0);
    (function tick(now){
      var p = Math.max(0, Math.min(1, (now - t0) / dur));
      el.textContent = money(from + (to - from) * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick); else { el.textContent = money(to); if (onDone) onDone(); }
    })(performance.now());
  }

  /* ---------- ฉากเปิดหน้า (ครั้งแรกเท่านั้น) ---------- */
  function intro(list){
    var cards = document.querySelectorAll('.lb-card');
    var delays = [0, 180, 340];
    cards.forEach(function(el, i){
      var d = i < 3 ? delays[i] : 520 + (i - 3) * 90;
      el.style.setProperty('--d', d);
      var u = list[i], amt = el.querySelector('.amt');
      if (reduce || !amt) return;
      amt.dataset.final = money(u.amount);
      amt.textContent = money(0);
      countAmount(amt, 0, u.amount, 1100 + d + 250, function(){ delete amt.dataset.final; });
    });
    var cover = document.getElementById('lbCover');
    if (cover) setTimeout(function(){ cover.remove(); }, 1000);
    // หลังฉากเปิดจบ: ปิดอนิเมชันเข้าฉากของการ์ด (กันเล่นซ้ำเวลาอัปเดตสด) แล้วรับอัปเดตที่รออยู่
    setTimeout(function(){
      S.introDone = true;
      document.body.classList.add('lb-live');
      if (S.pending) { var p = S.pending; S.pending = null; applyUpdate(p); }
    }, INTRO_MS);
  }

  /* ---------- อัปเดตสด: FLIP + เอฟเฟกต์ ---------- */
  function snapshot(){
    var m = {};
    document.querySelectorAll('.lb-card').forEach(function(el){
      var r = el.getBoundingClientRect();
      m[el.dataset.key] = { top: r.top };
    });
    return m;
  }

  function applyUpdate(list){
    var prev = S.items || [];
    var prevByKey = {};
    prev.forEach(function(u){ prevByKey[keyOf(u)] = u; });
    var before = snapshot();

    render(list);
    S.items = list;
    // ใส่ค่าสุดท้ายไว้ก่อน แล้ว fit ให้ขนาดตัวอักษรพอดีกับ "ตัวเลขใหม่" (กันล้นกรอบ)
    document.querySelectorAll('.lb-card .amt').forEach(function(a){ a.dataset.final = a.textContent; });
    fitAmounts();

    document.querySelectorAll('.lb-card').forEach(function(el, i){
      var u = list[i], k = keyOf(u), old = prevByKey[k], amt = el.querySelector('.amt');
      var final = money(u.amount);
      if (!old) {
        // คนใหม่เข้าติดอันดับ
        if (!reduce && el.animate) {
          el.animate(
            [{ opacity: 0, transform: 'translateX(60px) scale(.92)' }, { opacity: 1, transform: 'none' }],
            { duration: 700, easing: 'cubic-bezier(.2,.9,.25,1)' });
          el.classList.add('lb-new');
          setTimeout(function(){ el.classList.remove('lb-new'); }, 2600);
        }
        delete amt.dataset.final;
        return;
      }
      // สลับตำแหน่ง (FLIP): เลื่อนจากที่เดิมมาที่ใหม่
      var b = before[k];
      if (b && !reduce && el.animate) {
        var r = el.getBoundingClientRect();
        var dy = b.top - r.top;
        if (Math.abs(dy) > 2) {
          el.style.zIndex = '5';
          var anim = el.animate(
            [{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }],
            { duration: 750, easing: 'cubic-bezier(.2,.9,.25,1)' });
          anim.onfinish = anim.oncancel = function(){ el.style.zIndex = ''; };
        }
      }
      // อันดับขึ้น → ลูกศร ▲
      if (u.rank < old.rank) {
        var chip = document.createElement('i');
        chip.className = 'lb-up';
        chip.textContent = '▲ ' + (old.rank - u.rank);
        el.appendChild(chip);
        setTimeout(function(){ chip.remove(); }, 4200);
      }
      // ยอดเปลี่ยน → ตัวเลขวิ่งไปค่าใหม่ + การ์ดเรืองแสงชั่วครู่
      if (old.amount !== u.amount) {
        if (!reduce) {
          countAmount(amt, old.amount, u.amount, 150, function(){ delete amt.dataset.final; });
          el.classList.add('lb-bump');
          setTimeout(function(){ el.classList.remove('lb-bump'); }, 2000);
        } else { amt.textContent = final; delete amt.dataset.final; }
      } else {
        amt.textContent = final;
        delete amt.dataset.final;
      }
    });
  }

  function sameData(a, b){
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (keyOf(a[i]) !== keyOf(b[i]) || a[i].amount !== b[i].amount || a[i].avatar !== b[i].avatar || a[i].name !== b[i].name) return false;
    }
    return true;
  }

  function setLive(on){
    var el = document.getElementById('lbLive');
    if (el) el.classList.toggle('off', !on);
  }

  function showMessage(text){
    document.getElementById('top3').innerHTML = '<p class="lb-empty">' + esc(text) + '</p>';
    document.getElementById('rest').innerHTML = '';
    document.querySelector('.rank-divider').style.display = 'none';
    var cover = document.getElementById('lbCover'); if (cover) setTimeout(function(){ cover.remove(); }, 1000);
  }

  function onData(list, version, seq){
    if (seq < S.applied) return;           // ผลลัพธ์เก่าที่มาช้ากว่าคำขอใหม่ → ทิ้ง
    S.applied = seq;
    S.version = version || S.version;
    if (!list.length) {
      if (S.items && S.items.length) { S.items = []; showMessage('ຍັງບໍ່ມີຂໍ້ມູນອັນດັບ'); }
      else if (!S.items) { S.items = []; showMessage('ຍັງບໍ່ມີຂໍ້ມູນອັນດັບ'); }
      return;
    }
    if (!S.items || !S.items.length) {     // ครั้งแรก (หรือเพิ่งมีข้อมูลหลังว่าง)
      var first = !S.introDone && !document.querySelector('.lb-card');
      S.items = list;
      render(list);
      if (first) { document.querySelectorAll('.lb-card .amt').forEach(function(a){ a.dataset.final = a.textContent; }); fitAmounts(); intro(list); }
      else { fitAmounts(); S.introDone = true; document.body.classList.add('lb-live'); }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ if (!S.pending) fitAmounts(); });
      return;
    }
    if (sameData(S.items, list)) return;
    if (!S.introDone) { S.pending = list; return; }   // รอฉากเปิดหน้าจบก่อน แล้วค่อยใส่ข้อมูลล่าสุด
    applyUpdate(list);
  }

  function schedule(ms){
    clearTimeout(S.timer);
    S.timer = setTimeout(poll, ms);
  }

  function poll(){
    if (demo) return;
    if (document.hidden) return;           // แท็บซ่อนอยู่ → หยุดโพล (กลับมาแล้วเริ่มใหม่ทันทีใน visibilitychange)
    if (S.busy) return;
    S.busy = true;
    var seq = ++S.seq;
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    S.ctrl = ctrl;
    var timeout = setTimeout(function(){ if (ctrl) ctrl.abort(); }, 12000);
    var url = '/api/public/top-spenders' + (S.version ? '?v=' + encodeURIComponent(S.version) : '');
    fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d){
        S.fails = 0; setLive(true);
        if (d && d.unchanged) { S.applied = Math.max(S.applied, seq); return; }
        onData((d && d.items) || [], d && d.version, seq);
      })
      .catch(function(){
        S.fails++; setLive(false);
        // ยังไม่เคยได้ข้อมูลเลย → แจ้งผู้ใช้ ; ถ้ามีข้อมูลแล้ว → คงข้อมูลเดิมไว้เงียบ ๆ
        if (!S.items) showMessage('ໂຫຼດຂໍ້ມູນອັນດັບບໍ່ສຳເລັດ ລອງໃໝ່ອີກຄັ້ງ');
      })
      .then(function(){
        clearTimeout(timeout);
        S.busy = false;
        if (!document.hidden) schedule(Math.min(POLL_MS * Math.pow(2, Math.min(S.fails, 4)), MAX_BACKOFF_MS));
      });
  }

  document.addEventListener('visibilitychange', function(){
    if (document.hidden) { clearTimeout(S.timer); }
    else { clearTimeout(S.timer); poll(); }
  });
  window.addEventListener('online', function(){ clearTimeout(S.timer); poll(); });
  window.addEventListener('pageshow', function(e){ if (e.persisted) { clearTimeout(S.timer); poll(); } });

  if (demo) {
    var list = LEADERBOARD.map(function(u, i){ return Object.assign({ key: 'demo' + i }, u); });
    onData(list, 'demo', 1);
    // โหมดทดลอง: ?demo=1 → จำลองการแซงอันดับทุก 5 วินาที เพื่อดูอนิเมชัน
    setInterval(function(){
      if (!S.introDone) return;
      var l = S.items.map(function(u){ return Object.assign({}, u); });
      var i = 1 + Math.floor(Math.random() * (l.length - 1));
      l[i].amount += Math.floor(Math.random() * 9000) + 2000;
      l.sort(function(a, b){ return b.amount - a.amount; }).forEach(function(u, k){ u.rank = k + 1; });
      applyUpdate(l);
    }, 5000);
  } else {
    poll();
  }

  // ຊື່ຮ້ານ/ໂລໂກ້ ໃນ header + footer (ຄືກັນກັບໜ້າອື່ນ)
  if (window.StorefrontData) {
    window.StorefrontData.fetchData()
      .then(function(data){ window.StorefrontData.applyStoreBranding(data.store); })
      .catch(function(err){ console.error('leaderboard.js: applyStoreBranding failed', err); });
  }
})();
