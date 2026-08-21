/* =========================================================
   prod-card-beam.js — ตัวขับอนิเมชัน "แสงวิ่งรอบขอบการ์ด" (.prod-card)
   ไม่แตะ category.js เลย: ไฟล์นี้แค่สแกนหา .prod-card ที่มีอยู่ในหน้า
   (และคอย MutationObserver ดักการ์ดที่ถูกสร้างใหม่ตอน grid re-render
   เช่นตอน fetchResellerInfo() เสร็จแล้วเรนเดอร์ราคาตัวแทนใหม่) แล้วขับ
   ตัวแปร CSS --angle ของแต่ละใบด้วย requestAnimationFrame ตัวเดียว
   (ไม่ใช่ CSS @keyframes) เพื่อให้เปลี่ยนความเร็วตอน hover/touch แบบ
   ease ได้จริง ไม่มีจังหวะกระตุกหรือรีเซ็ตมุมกลับ 0 เวลาแสงวิ่งครบรอบ

   CSS ที่คู่กับไฟล์นี้อยู่ใน style.css: ".prod-card::before" (วงแหวน
   conic-gradient แบบ mask-composite:exclude) และ ".prod-card.is-hot"
   ========================================================= */

(function () {
  'use strict';

  const BASE_SPEED = 360 / 3.6; // deg/sec — ~3.6 วินาทีต่อรอบตอนปกติ
  const HOT_SPEED = 360 / 2.5;  // deg/sec — ตอน hover/touch (เร็วขึ้นเล็กน้อย ไม่ใช่เท่าตัว)
  const EASE = 4.2;             // ค่ายิ่งมาก ยิ่งเร่ง/ผ่อนความเร็วไว (แต่ยัง smooth)

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** @type {Map<HTMLElement, {angle:number, speed:number, target:number, visible:boolean}>} */
  const state = new Map();
  let io = null;
  let rafId = null;
  let last = 0;

  function setHot(el, hot) {
    const s = state.get(el);
    if (!s) return;
    el.classList.toggle('is-hot', hot);
    s.target = hot ? HOT_SPEED : BASE_SPEED;
  }

  function bindCard(el, index) {
    if (state.has(el)) return; // กันผูก event ซ้ำถ้าถูกเรียกซ้ำโดยไม่ตั้งใจ
    // กระจายมุมเริ่มต้นของแต่ละใบไม่ให้แสงวิ่งพร้อมกันเป๊ะทุกใบ
    const startAngle = (index % 6) * 60;
    state.set(el, { angle: startAngle, speed: BASE_SPEED, target: BASE_SPEED, visible: true });
    el.style.setProperty('--angle', startAngle + 'deg');

    if (reduceMotion) return; // ไม่ผูก pointer speed-up ถ้าผู้ใช้ตั้ง reduce motion ไว้

    el.addEventListener('pointerenter', () => setHot(el, true));
    el.addEventListener('pointerleave', () => setHot(el, false));
    el.addEventListener('pointerdown', () => setHot(el, true));
    el.addEventListener('pointerup', () => setHot(el, false));
    el.addEventListener('pointercancel', () => setHot(el, false));

    if (io) io.observe(el);
  }

  function scan(root) {
    const cards = (root || document).querySelectorAll('.prod-card:not([data-beam-skip])');
    cards.forEach((el, i) => bindCard(el, i));
  }

  function unbindMissing() {
    // เก็บกวาดการ์ดเก่าที่ถูกลบออกจาก DOM แล้ว (เช่นตอน grid.innerHTML ถูกแทนที่)
    state.forEach((_, el) => {
      if (!el.isConnected) {
        if (io) io.unobserve(el);
        state.delete(el);
      }
    });
  }

  function tick(now) {
    let dt = (now - last) / 1000;
    if (dt > 0.05) dt = 0.05; // กันจังหวะกระโดดตอนสลับแท็บ/หน้าค้าง
    last = now;
    state.forEach((s, el) => {
      if (!s.visible) return;
      s.speed += (s.target - s.speed) * Math.min(1, EASE * dt);
      s.angle = (s.angle + s.speed * dt) % 360;
      el.style.setProperty('--angle', s.angle.toFixed(2) + 'deg');
    });
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    const grid = document.querySelector('#prod-grid');
    if (!grid) return; // หน้านี้ไม่มีการ์ดสินค้า ไม่ต้องทำอะไร

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const s = state.get(entry.target);
          if (s) s.visible = entry.isIntersecting;
        });
      }, { threshold: 0.01 });
    }

    scan(grid);

    // การ์ดถูกสร้างใหม่ทั้ง grid ทุกครั้งที่ category.js เรนเดอร์ใหม่
    // (โหลดแรก + ตอน fetchResellerInfo เสร็จ) — เฝ้าดูแล้วผูกใบใหม่อัตโนมัติ
    const mo = new MutationObserver(() => {
      unbindMissing();
      scan(grid);
    });
    mo.observe(grid, { childList: true });

    if (reduceMotion) return; // ค้างมุมเริ่มต้นแบบ static ไม่หมุน ไม่ต้องเริ่ม rAF loop

    last = performance.now();
    rafId = requestAnimationFrame(tick);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!rafId) {
        last = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
