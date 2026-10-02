/* =========================================================
   header-fx.js — ตัวควบคุมอนิเมชั่นแถบ header (คู่กับ header-fx.css)
   - วางใน <head> (ไม่ต้อง defer) เพื่อให้รู้ทันทีว่าเคยเล่นฉากเปิดตัวใน session นี้แล้วหรือยัง
   - ฉากเปิดตัวเล่นครั้งเดียวต่อ session (เปลี่ยนหน้าไม่เล่นซ้ำ ไม่รำคาญ)
   - แยกตัวอักษรชื่อร้าน (.brand-name) เป็น span เพื่อทำอนิเมชั่นทีละตัว
   - ใส่ class is-scrolled ให้ header ตอนเลื่อนลง (ใช้ IntersectionObserver ไม่ผูก scroll event)
   - แตะโลโก้ -> หมุนสปริง
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var KEY = 'hdrfx-seen';

  // เคยเล่นฉากเปิดตัวแล้วใน session นี้ -> ข้าม (ทำก่อนหน้าวาด จึงไม่มีภาพวูบ)
  try { if (sessionStorage.getItem(KEY)) root.classList.add('fx-seen'); } catch (e) {}

  function init() {
    var header = document.querySelector('header');
    if (!header) return;

    // บันทึกว่าเล่นแล้ว (ไม่ใส่ class ให้หน้านี้ เพื่อให้ฉากเปิดตัวของหน้านี้เล่นจนจบ)
    window.addEventListener('load', function () {
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    });

    // ฉากเปิดตัวจบแล้ว (หลังตัว loader หายไป ~3 วินาที) -> ใส่ fx-seen เพื่อปลดสไตล์ฉากเปิดตัวออก
    // ไม่งั้นสไตล์ฉากเปิดตัวจะ "ชนะ" .fx-spin ทำให้แตะโลโก้แล้วไม่หมุนในหน้าแรกของ session
    var markIntroDone = function () {
      setTimeout(function () { root.classList.add('fx-seen'); }, 3200);
    };
    if (!root.classList.contains('pl-lock')) {
      markIntroDone();
    } else {
      var plWatch = new MutationObserver(function () {
        if (!root.classList.contains('pl-lock')) { plWatch.disconnect(); markIntroDone(); }
      });
      plWatch.observe(root, { attributes: true, attributeFilter: ['class'] });
    }

    /* ---------- แยกตัวอักษรชื่อร้าน ---------- */
    var nameEl = header.querySelector('.brand-name');
    if (nameEl) {
      var lastSplit = null;
      var split = function () {
        var text = nameEl.textContent;
        if (!text || text === lastSplit) return;
        lastSplit = text;
        mo.disconnect(); // กัน observer วนซ้ำจากการแก้ DOM ของเราเอง
        nameEl.setAttribute('aria-label', text);
        nameEl.textContent = '';
        var frag = document.createDocumentFragment();
        var chars = Array.from(text); // รองรับอักขระหลายไบต์ (ลาว/ไทย/อีโมจิ)
        for (var i = 0; i < chars.length; i++) {
          var s = document.createElement('span');
          s.className = 'fx-ch';
          s.setAttribute('aria-hidden', 'true');
          s.style.setProperty('--i', String(i));
          s.textContent = chars[i];
          frag.appendChild(s);
        }
        nameEl.appendChild(frag);
        mo.observe(nameEl, { childList: true, characterData: true, subtree: true });
      };
      var mo = new MutationObserver(function () {
        // ข้อความถูกโค้ดอื่นเขียนใหม่ (เช่น โหลดชื่อร้านจาก API) -> แยกใหม่
        if (nameEl.textContent !== lastSplit) split();
      });
      split();
      mo.observe(nameEl, { childList: true, characterData: true, subtree: true });
    }

    /* ---------- header หดนิดๆ ตอนเลื่อนลง ---------- */
    if ('IntersectionObserver' in window) {
      var sentinel = document.createElement('div');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:28px;pointer-events:none;visibility:hidden;';
      document.body.appendChild(sentinel);
      new IntersectionObserver(function (entries) {
        header.classList.toggle('is-scrolled', !entries[0].isIntersecting);
      }, { threshold: 0 }).observe(sentinel);
    }

    /* ---------- แตะโลโก้ -> หมุนสปริง ---------- */
    var logo = header.querySelector('.logo');
    if (logo) {
      var spinning = false;
      logo.addEventListener('pointerdown', function () {
        if (spinning) return;
        spinning = true;
        logo.classList.add('fx-spin');
        setTimeout(function () {
          logo.classList.remove('fx-spin');
          spinning = false;
        }, 950);
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
