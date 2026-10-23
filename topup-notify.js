/* topup-notify.js — แจ้งเตือนเติมเงินใหม่ "ในหน้าแอดมิน" (ไม่ต้องพึ่ง Discord)
   - เช็ค topup_requests ที่ status = pending ทุก 8 วินาที (ผ่าน supabaseClient เดิมของ admin.js)
   - มีรายการใหม่ -> แบนเนอร์ด้านบน + เสียงติ๊ง + ป้ายที่แท็บเบราว์เซอร์ + (ถ้าอนุญาต) การแจ้งเตือนของเบราว์เซอร์
   - แตะแบนเนอร์ -> เปิดแผง "ຄຳຂໍເຕີມເງິນ" ให้กดยืนยัน/ปฏิเสธได้ทันที
   - ต้องแตะหน้าจอ 1 ครั้งหลังเปิดหน้า เบราว์เซอร์ถึงจะยอมให้เล่นเสียง (ข้อจำกัดของเบราว์เซอร์) */
(function () {
  'use strict';
  var POLL_MS = 8000;
  var known = null;            // Set ของ id ที่เห็นแล้ว (null = ยังไม่ได้ baseline)
  var baseTitle = document.title;
  var unseen = 0;              // จำนวนรายการใหม่ที่ยังไม่ได้เปิดดู
  var audioCtx = null;
  var busy = false;

  /* ---------- สไตล์แบนเนอร์ ---------- */
  var st = document.createElement('style');
  st.textContent =
    '.tn-banner{position:fixed;top:14px;left:50%;transform:translate(-50%,-140%);z-index:300;' +
    'max-width:min(92vw,420px);width:max-content;display:flex;align-items:center;gap:10px;cursor:pointer;' +
    'background:rgba(20,10,16,.92);border:1px solid rgba(255,0,1,.55);color:#fff;padding:12px 16px;' +
    'border-radius:14px;font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,.45);transition:transform .3s ease}' +
    '.tn-banner.show{transform:translate(-50%,0)}' +
    '.tn-banner b{color:#ff4d4d}.tn-banner small{display:block;opacity:.75;font-size:12px}' +
    '.tn-x{margin-left:6px;opacity:.6;font-size:18px;line-height:1}';
  document.head.appendChild(st);

  var banner = document.createElement('div');
  banner.className = 'tn-banner';
  banner.setAttribute('role', 'alert');
  banner.innerHTML = '<span>🔔</span><span class="tn-msg"></span><span class="tn-x" aria-label="ปิด">×</span>';
  document.body.appendChild(banner);
  var hideTimer = null;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function kip(n) { return Number(n || 0).toLocaleString('de-DE') + ' ກີບ'; }

  function showBanner(items) {
    var first = items[0];
    var who = esc(first.user_email || first.email || 'ລູກຄ້າ');
    banner.querySelector('.tn-msg').innerHTML = items.length > 1
      ? '<b>ມີຄຳຂໍເຕີມເງິນໃໝ່ ' + items.length + ' ລາຍການ</b><small>ແຕະເພື່ອກວດສອບ</small>'
      : '<b>ເຕີມເງິນໃໝ່ ' + esc(kip(first.amount)) + '</b><small>' + who + ' • ແຕະເພື່ອກວດສອບ</small>';
    banner.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { banner.classList.remove('show'); }, 15000);
  }

  /* ---------- เสียงติ๊ง (WebAudio ไม่ต้องมีไฟล์เสียง) ---------- */
  function unlockAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* ข้าม */ }
  }
  function beep() {
    try {
      unlockAudio();
      if (!audioCtx || audioCtx.state !== 'running') return;
      [880, 1175].forEach(function (f, i) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
        var t = audioCtx.currentTime + i * 0.18;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.start(t); o.stop(t + 0.3);
      });
    } catch (e) { /* ข้าม */ }
  }
  function onFirstGesture() {
    unlockAudio();
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
  }
  document.addEventListener('pointerdown', onFirstGesture, { once: true });

  /* ---------- ป้ายที่แท็บ ---------- */
  function updateTitle() { document.title = unseen > 0 ? '🔔 (' + unseen + ') ' + baseTitle : baseTitle; }

  function openTopupPanel() {
    var sw = document.querySelector('.switch[data-target="panelTopup"]');
    if (sw && !sw.classList.contains('open')) {
      var head = sw.querySelector('.switch-head');
      if (head) head.click();
    }
    if (sw) sw.scrollIntoView({ behavior: 'smooth', block: 'start' });
    banner.classList.remove('show');
    unseen = 0; updateTitle();
  }
  banner.addEventListener('click', function (e) {
    if (e.target.classList.contains('tn-x')) { banner.classList.remove('show'); return; }
    openTopupPanel();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { poll(); }
  });

  /* ---------- poll ---------- */
  async function poll() {
    if (busy || typeof supabaseClient === 'undefined') return;
    busy = true;
    try {
      var r = await supabaseClient.from('topup_requests')
        .select('id,amount,user_email,email,created_at')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(50);
      if (r.error) { console.warn('topup-notify:', r.error.message); return; }
      var rows = r.data || [];
      var ids = new Set(rows.map(function (x) { return x.id; }));

      if (known === null) { known = ids; return; }       // รอบแรก = baseline ไม่เตือนของเก่า

      var fresh = rows.filter(function (x) { return !known.has(x.id); });
      known = ids;
      if (fresh.length) {
        unseen += fresh.length; updateTitle();
        showBanner(fresh); beep();
        try {
          if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            new Notification('ເຕີມເງິນໃໝ່ ' + kip(fresh[0].amount), { body: fresh[0].user_email || fresh[0].email || '' });
          }
        } catch (e) { /* ข้าม */ }
      }
      // รายการเปลี่ยน (ใหม่เข้า หรือมีคนอนุมัติ/ปฏิเสธไปแล้ว) -> รีเฟรชรายการ+ป้ายตัวเลขของ admin.js
      if (typeof window.loadTopupRequests === 'function' &&
          (fresh.length || rows.length !== (typeof currentTopupRequests !== 'undefined' ? currentTopupRequests.length : -1))) {
        window.loadTopupRequests();
      }
    } catch (e) {
      console.warn('topup-notify poll error', e);
    } finally { busy = false; }
  }

  poll();
  setInterval(poll, POLL_MS);
})();
