/* admin-clean.js — แท็บในหน้า "ລະບົບຕົວແທນ" (ภาพล้วน ๆ ไม่แตะตรรกะ admin.js)
   แยก 5 ส่วนที่เรียงยาวเป็น 4 แท็บ: ຕົວແທນ · ຄີຍ໌ · ລະດັບ · ລາຄາ */
(function () {
  'use strict';
  var panel = document.getElementById('panelAgent');
  if (!panel) return;
  var bar = panel.querySelector('.ag-tabs');
  if (!bar) return;

  var KEY = 'agTab';
  var VALID = ['accounts', 'keys', 'tiers', 'prices'];
  var tabs = Array.prototype.slice.call(bar.querySelectorAll('[data-ag]'));

  function set(name, scrollTop) {
    if (VALID.indexOf(name) < 0) name = 'accounts';
    panel.setAttribute('data-ag-now', name);
    tabs.forEach(function (b) {
      var on = b.getAttribute('data-ag') === name;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    try { sessionStorage.setItem(KEY, name); } catch (e) {}
    if (scrollTop) {
      var sc = panel.closest('.xp-scroll');
      if (sc) sc.scrollTo({ top: 0 });
    }
  }

  tabs.forEach(function (b) {
    b.addEventListener('click', function () { set(b.getAttribute('data-ag'), true); });
  });

  var saved = null;
  try { saved = sessionStorage.getItem(KEY); } catch (e) {}
  set(saved || 'accounts', false);
})();
