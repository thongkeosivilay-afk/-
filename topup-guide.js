/* topup-guide.js — โชว์ลิ้งคลิปสอนเติมเงินที่แอดมินตั้งไว้ (ตั้งค่าร้าน > ຄລິບສອນເຕີມເງິນ) */
(function () {
  'use strict';
  var box = document.getElementById('tgList');
  if (!box) return;
  var ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 21h16"/></svg>';
  var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  fetch('/api/topup-links', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var links = (d && d.links) || [];
      links = links.filter(function (l) { return l && l.label && /^https?:\/\//i.test(l.url || ''); });
      if (!links.length) return;
      box.innerHTML = links.map(function (l) {
        return '<a class="tg-item" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="tg-ico">' + ICO + '</span><span class="tg-name">' + esc(l.label) + '</span>' +
          '<span class="tg-chev">' + CHEV + '</span></a>';
      }).join('');
      box.hidden = false;
    })
    .catch(function () { /* ไม่มีลิ้ง = ไม่โชว์อะไร */ });
})();
