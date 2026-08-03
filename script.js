/* =========================================================
   script.js — ການເຮັດວຽກ (interaction) ຂອງໜ້າເວັບ NEXUS STORE
   ໜ້າທີ່ຂອງໄຟລ໌ນີ້:
   1) ປຸ່ມ "ຊື້ເລີຍ" (buy-btn)  -> ສະແດງ feedback ສັ້ນໆເມື່ອກົດ
   2) ປຸ່ມແຊທລອຍ (chat-fab)     -> ຈຸດເຊື່ອມຕໍ່ໄປລະບົບແຊັດ/Discord ຂອງທ່ານ
   3) ປຸ່ມ "ເລີ່ມຕົ້ນໃຊ້ງານ" ແລະ "ວິທີໃຊ້ງານ" -> scroll ໄປສ່ວນທີ່ກ່ຽວຂ້ອງ
   4) .rail (product cards) -> "paper-fold" 3D animation while swiping
      ການ໌ດ໌ຈະໜຸນ/ພັບອອກຄ້າຍ folding card ຕາມຕຳແໜ່ງທີ່ scroll ຢູ່
   ບໍ່ມີການເອີ້ນ API ພາຍນອກ ຫຼື ເກັບຂໍ້ມູນຜູ້ໃຊ້ໃດໆ ໃນໄຟລ໌ນີ້
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- 1) ປຸ່ມຊື້ເລີຍ: ໃຫ້ feedback ວ່າກົດແລ້ວ ---------- */
  document.querySelectorAll('.buy-btn').forEach((btn) => {
    const originalText = btn.textContent.trim();
    btn.addEventListener('click', () => {
      // TODO: ຕໍ່ໄປສາຍານກັບລະບົບຕະກ້າ/ຊຳລະເງິນຈິງຂອງທ່ານທີ່ນີ້
      btn.disabled = true;
      btn.textContent = 'ເພີ່ມແລ້ວ ✓';
      btn.style.opacity = '0.75';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = originalText;
        btn.style.opacity = '1';
      }, 1400);
    });
  });

  /* ---------- 2) ປຸ່ມແຊທລອຍ ---------- */
  const chatFab = document.querySelector('.chat-fab');
  if (chatFab) {
    chatFab.addEventListener('click', () => {
      // TODO: ປ່ຽນ URL ນີ້ເປັນລິ້ງ Discord / Messenger / LiveChat ຈິງຂອງຮ້ານທ່ານ
      window.open('https://discord.com', '_blank', 'noopener');
    });
  }

  /* ---------- 3) ປຸ່ມ Hero: scroll ໄປສ່ວນທີ່ກ່ຽວຂ້ອງ ---------- */
  const startBtn = document.querySelector('.btn-primary');
  const howBtn = document.querySelector('.btn-ghost');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      document.querySelector('.section.cat-block')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (howBtn) {
    howBtn.addEventListener('click', () => {
      document.querySelector('.promo')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* ---------- 4) Card "float away into space" scroll animation ----------
     ແນວຄິດ: ແຕ່ລະການ໌ດ໌ໃນ .rail ຄິດໄລ່ໄລຍະຫ່າງຈາກຈຸດກາງ (center) ຄືເດີມ
     ແຕ່ແທນທີ່ຈະພັບແປ໊ະໆ (fold ທຳມະດາ) ຄາດ໌ຈະ:
       - ໜຸນອອກ (rotateY) + ໝຸນຄ້າຍໜີນ (rotateZ) ຄືວັດຖຸລອຍໝຸນຢູ່ໃນອາວະກາດ
       - ຖອຍລົງເລິກ (translateZ) ແລະ ຖືກຜັກອອກທາງຂ້າງ (translateX) ຄືຖືກໂຍນລອຍ
         ໜີໄກອອກຈາກຈໍເມື່ອຫ່າງຈາກກາງ
       - ຫຍໍ້ຂະໜາດ + ຈາງລົງ ຄືໄກສາຍຕາຂຶ້ນ
       - ໃນຂະນະດຽວກັນ ທຸກການ໌ດ໌ (ບໍ່ວ່າຈະຢູ່ກາງ ຫຼື ຂອບ) ຈະໂຍກຂຶ້ນ-ລົງເບົາໆ
         ຕະຫຼອດເວລາ (ບໍ່ຢຸດນິ່ງ) ຄືລອຍຢູ່ໃນສະພາບໄຮ້ແຮງໂນ້ມຖ່ວງ
     ເມື່ອ scroll ການ໌ດ໌ກັບເຂົ້າໃກ້ກາງ ທຸກຄ່າຈະຄ່ອຍໆຄືນເປັນທ່າປົກກະຕິ (flat)
     ໂດຍອັດຕະໂນມັດ ເພາະທຸກຄ່າຄຳນວນຈາກຕຳແໜ່ງ scroll ປັດຈຸບັນສະເໝີ (reversible). */
  const FOLD_MAX_DEG  = 30;   // ອົງສາການໜຸນ (rotateY) ສູງສຸດທີ່ຂອບ
  const TILT_MAX_DEG  = 24;   // ອົງສາການໝຸນຄ້າຍໜີນ (rotateZ) ສູງສຸດ — ໃຫ້ຄວາມຮູ້ສຶກລອຍໝຸນ
  const SCALE_MIN     = 0.76; // ຂະໜາດນ້ອຍສຸດ — ຄືລອຍໄກອອກຈາກຈໍ
  const OPACITY_MIN   = 0.3;  // ຄວາມໂປ່ງໃສນ້ອຍສຸດ — ຄືໄກສາຍຕາ
  const DRIFT_X_MAX   = 60;   // px ຜັກອອກທາງຂ້າງເພີ່ມຈາກຕຳແໜ່ງ scroll ປົກກະຕິ
  const DEPTH_MAX     = 260;  // px ຖອຍເລິກເຂົ້າຈໍ (translateZ) ເມື່ອຫ່າງຈາກກາງ
  const BOB_AMPLITUDE = 6;    // px ໄລຍະໂຍກຂຶ້ນ-ລົງຂອງການລອຍຕົວເບົາໆ (idle float)
  const BOB_SPEED     = 0.0017;

  const rails = document.querySelectorAll('.rail');

  rails.forEach((rail) => {
    const cards = Array.from(rail.querySelectorAll('.prod-card'));
    if (!cards.length) return;

    // ໃຫ້ແຕ່ລະການ໌ດ໌ໂຍກຄົນລະຈັງຫວະກັນ (phase offset) ບໍ່ໃຫ້ລອຍພ້ອມກັນທຸກໃບ
    const phases = cards.map(() => Math.random() * Math.PI * 2);

    const update = (now) => {
      const railRect = rail.getBoundingClientRect();
      const centerX = railRect.left + railRect.width / 2;
      // ຄູນຫາຄ່າ halfWidth ໃຫ້ໃຫຍ່ຂຶ້ນ (SCROLL_EASE) — ຕ້ອງເລື່ອນໄກກວ່າເກົ່າ
      // ກ່ອນທີ່ການ໌ດ໌ຈະໝຸນ/ລອຍເຕັມທີ່ ເຮັດໃຫ້ຄວາມຮູ້ສຶກຕອນເລື່ອນຊ້າລົງ ບໍ່ວູບວາບ
      const SCROLL_EASE = 1.8;
      const halfWidth = (railRect.width / 2 || 1) * SCROLL_EASE;

      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const cardCenter = r.left + r.width / 2;

        // -1 (ຊິດຂອບຊ້າຍ) ... 0 (ກາງ) ... 1 (ຊິດຂອບຂວາ), ຍອມໃຫ້ເກີນເລັກນ້ອຍເພື່ອ
        // ໃຫ້ການ໌ດ໌ທີ່ຫຼຸດອອກຈາກຈໍໄປແລ້ວຍັງໝຸນ/ລອຍຕໍ່ໄປອີກໜ້ອຍໜຶ່ງ
        let progress = (cardCenter - centerX) / halfWidth;
        progress = Math.max(-1.4, Math.min(1.4, progress));
        const absProgress = Math.min(1, Math.abs(progress));

        const rotateY = -progress * FOLD_MAX_DEG;
        const rotateZ = progress * TILT_MAX_DEG * absProgress;
        const scale = 1 - absProgress * (1 - SCALE_MIN);
        const opacity = 1 - absProgress * (1 - OPACITY_MIN);
        const driftX = progress * DRIFT_X_MAX * absProgress;
        const depthZ = -absProgress * DEPTH_MAX;

        // ການລອຍໂຍກຂຶ້ນ-ລົງເບົາໆຕະຫຼອດເວລາ — ຫຍໍ້ລົງເລັກນ້ອຍເມື່ອການ໌ດ໌ລອຍໄກ
        // ອອກຈາກກາງ (ໃຫ້ຄວາມຮູ້ສຶກວ່າມັນ "ນິ້ງລົງ" ຂະນະລອຍໜີໄປ ບໍ່ແມ່ນໂຍກແຮງຂຶ້ນ)
        const bobY = Math.sin(now * BOB_SPEED + phases[i]) * BOB_AMPLITUDE * (1 - absProgress * 0.65);

        const originX = progress > 0 ? '0% 50%' : '100% 50%';

        card.style.transformOrigin = originX;
        card.style.transform =
          `perspective(900px) translate3d(${driftX.toFixed(1)}px, ${bobY.toFixed(1)}px, ${depthZ.toFixed(1)}px) ` +
          `rotateY(${rotateY.toFixed(2)}deg) rotateZ(${rotateZ.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        card.style.opacity = opacity.toFixed(3);
      });
    };

    // ວົນ animation loop ຕະຫຼອດເວລາ (ບໍ່ແມ່ນແຕ່ຕອນ scroll ເທົ່ານັ້ນ) ເພື່ອໃຫ້
    // ການລອຍໂຍກເບົາໆ (idle float) ເຮັດວຽກແມ່ນແຕ່ຕອນທ່ານບໍ່ໄດ້ scroll ຢູ່
    const loop = (now) => {
      update(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    window.addEventListener('resize', () => update(performance.now()));
  });

  /* ---------- 5) Category card scroll-reveal ----------
     ການ໌ດ໌ໝວດໝູ່ (.cat-item) ຈະ fade + ເລື່ອນຂຶ້ນເບົາໆ ເມື່ອ scroll
     ເຂົ້າມາໃນຈໍ, ແທນທີ່ຈະໂຜ່ອອກມາແບບແຂງໆໃນເທື່ອດຽວ */
  const catItems = document.querySelectorAll('.cat-item');
  if (catItems.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('cat-in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    catItems.forEach((item) => revealObserver.observe(item));
  }

  /* ---------- 6) Discord login state ----------
     ใช้ .login-btn ที่มุมขวาบน เป็นทั้งปุ่ม "ลงชื่อเข้าใช้ด้วย Discord"
     (ยังไม่ login) และ "รูปโปรไฟล์ / ออกจากระบบ" (login แล้ว)
     ทำงานคู่กับ worker/src/index.js -> /api/me, /auth/discord/login, /auth/logout */
  (async () => {
    const loginBtn = document.querySelector('.login-btn');
    if (!loginBtn) return;

    try {
      const res = await fetch('/api/me');
      const data = await res.json();

      if (data.loggedIn) {
        loginBtn.classList.add('is-authed');
        loginBtn.innerHTML = '';
        if (data.user.avatar) {
          const img = document.createElement('img');
          img.src = data.user.avatar;
          img.alt = data.user.username;
          loginBtn.appendChild(img);
        }
        const nameSpan = document.createElement('span');
        nameSpan.textContent = data.user.username;
        loginBtn.appendChild(nameSpan);

        loginBtn.title = `${data.user.username} — ກົດເພື່ອອອກຈາກລະບົບ`;
        loginBtn.addEventListener('click', () => {
          if (confirm(`ອອກຈາກລະບົບ (${data.user.username}) ບໍ?`)) {
            window.location.href = '/auth/logout';
          }
        });
      } else {
        loginBtn.title = 'ເຂົ້າສູ່ລະບົບດ້ວຍ Discord';
        loginBtn.addEventListener('click', () => {
          window.location.href = '/auth/discord/login';
        });
      }
    } catch (err) {
      // ยังไม่ deploy worker หรือ endpoint /api/me ใช้ไม่ได้ -> ปล่อยเป็นปุ่มเฉยๆ
      console.error('Session check failed:', err);
      loginBtn.addEventListener('click', () => {
        window.location.href = '/auth/discord/login';
      });
    }
  })();

});
