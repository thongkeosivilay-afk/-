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
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function money(n){ return Number(n || 0).toLocaleString('de-DE', { maximumFractionDigits:0 }) + ' ₭'; }

  function avatar(u){
    var inner = u.avatar
      ? '<img src="' + esc(u.avatar) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/>'
      : '<b>' + esc(u.name.charAt(0).toUpperCase()) + '</b>';
    return '<div class="avatar">' + inner + '</div>';
  }

  function card(u){
    var top = u.rank <= 3;
    var cls = 'lb-card r' + u.rank + (top ? ' top' : '');
    var frame = '';
    if (u.rank === 1) {
      frame = '<div class="frame">' + (u.frame ? '<img src="' + esc(u.frame) + '" alt=""/>' : '<i class="frame-ring"></i>') + avatar(u) + '</div>';
    } else {
      frame = '<div class="frame">' + avatar(u) + '</div>';
    }
    var badge = u.rank === 1
      ? '<span class="legend"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15c3 0 4-3 7-3l3 3 4-1c2 0 3 1 3 3H3Z"/><path d="M13 12c0-3 1-5 4-6-1 3 0 4 2 5M9 8c0-2 .8-3.500 3-4.500-.5 2 .2 3 1.500 3.500"/></svg>TOP 1 · LEGENDARY</span>'
      : '';
    return '<article class="' + cls + '">' + frame +
      '<div class="info">' + badge +
        '<div class="nm">' + esc(u.name) + '</div>' +
        '<div class="amt">' + money(u.amount) + '</div>' +
        '<div class="dt">สมัครเมื่อ ' + esc(u.joined) + '</div>' +
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
  }

  // ลำดับเข้าฉาก + ตัวเลขเงินวิ่งขึ้นจาก 0
  function intro(list){
    var cards = document.querySelectorAll('.lb-card');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var delays = [0, 180, 340];
    cards.forEach(function(el, i){
      var d = i < 3 ? delays[i] : 520 + (i - 3) * 90;
      el.style.setProperty('--d', d);
      var u = list[i], amt = el.querySelector('.amt');
      if (reduce || !amt) return;
      var t0 = performance.now() + 1100 + d + 250, dur = 1000;
      amt.dataset.final = money(u.amount); amt.textContent = money(0);
      (function tick(now){
        var p = Math.max(0, Math.min(1, (now - t0) / dur));
        amt.textContent = money(u.amount * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick); else amt.textContent = money(u.amount);
      })(performance.now());
    });
    var cover = document.getElementById('lbCover');
    if (cover) setTimeout(function(){ cover.remove(); }, 1000);
  }

  function showMessage(text){
    document.getElementById('top3').innerHTML = '<p class="lb-empty">' + esc(text) + '</p>';
    document.getElementById('rest').innerHTML = '';
    document.querySelector('.rank-divider').style.display = 'none';
    var cover = document.getElementById('lbCover'); if (cover) setTimeout(function(){ cover.remove(); }, 1000);
  }

  function show(list){
    if (!list.length) { showMessage('ยังไม่มีข้อมูลอันดับ'); return; }
    render(list);
    fitAmounts();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAmounts);
    document.querySelector('.rank-divider').style.display = list.length > 3 ? '' : 'none';
    intro(list);
  }

  function loadData(){
    if (/[?&]demo=1/.test(location.search)) { show(LEADERBOARD); return; }
    fetch('/api/public/top-spenders', { headers:{ accept:'application/json' } })
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d){ show((d && d.items) || []); })
      .catch(function(){ showMessage('โหลดข้อมูลอันดับไม่สำเร็จ ลองใหม่อีกครั้ง'); });
  }
  loadData();

  // ตัวเลขเงินยาว: ลดขนาดตัวอักษรอัตโนมัติให้อยู่ในกรอบการ์ด (ไม่ล้นออก)
  function fitAmounts(){
    document.querySelectorAll('.lb-card').forEach(function(card){
      var amt = card.querySelector('.amt'); if (!amt) return;
      var u = amt.dataset.final; if (u) amt.textContent = u;   // วัดจากตัวเลขสุดท้ายเสมอ
      amt.style.fontSize = '';
      var max = card.clientWidth - amt.offsetLeft - 18;
      var size = parseFloat(getComputedStyle(amt).fontSize);
      while (amt.scrollWidth > max && size > 11) { size -= 0.5; amt.style.fontSize = size + 'px'; }
    });
  }
  window.fitAmounts = fitAmounts;
  window.addEventListener('resize', fitAmounts);
})();
