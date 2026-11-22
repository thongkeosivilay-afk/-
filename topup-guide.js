/* topup-guide.js — ปุ่มคลิปสอนเติมเงิน วางเหนือรูปของการ์ดแต่ละช่องทาง (ตั้งค่าร้านต่อช่อง 1-4) */
(function () {
  'use strict';
  var ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 21h16"/></svg>';
  var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  fetch('/api/topup-links', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      ((d && d.links) || []).forEach(function (l) {
        if (!l || !l.label || !/^https?:\/\//i.test(l.url || '')) return;
        var btn = document.querySelector('.tc-btn[data-tc-bank="' + l.ch + '"]');
        var card = btn && btn.closest('.tc-card');
        if (!card || card.querySelector('.tg-card')) return;
        var a = document.createElement('a');
        a.className = 'tg-card';
        a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.innerHTML = '<span class="tg-ico">' + ICO + '</span><span class="tg-name">' + esc(l.label) + '</span><span class="tg-chev">' + CHEV + '</span>';
        card.insertBefore(a, card.firstChild);
      });
    })
    .catch(function () { /* ไม่มีคลิป = ไม่โชว์ */ });
})();
