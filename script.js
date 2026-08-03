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

  /* ---------- 4) Card-fold scroll animation ----------
     ແນວຄິດ: ແຕ່ລະການ໌ດ໌ໃນ .rail ຈະຄິດໄລ່ໄລຍະຫ່າງຈາກຈຸດກາງ (center)
     ຂອງແຖວ scroll ຂອງມັນເອງ. ຍິ່ງໄກຈາກກາງ (ຊິດຂອບ) ການ໌ດ໌ຍິ່ງໜຸນ/ພັບ
     ອອກ (rotateY) ພ້ອມຫຍໍ້ຂະໜາດ ແລະ ຈາງລົງເລັກນ້ອຍ — ຄືກັບເຈ້ຍພັບ.
     ເມື່ອ scroll ການ໌ດ໌ເຂົ້າໃກ້ກາງ ມັນຈະຄ່ອຍໆຄືນເປັນທ່າປົກກະຕິ (flat). */
  const FOLD_MAX_DEG   = 26;   // ອົງສາການພັບສູງສຸດທີ່ຂອບ
  const SCALE_MIN      = 0.9;  // ຂະໜາດນ້ອຍສຸດທີ່ຂອບ
  const OPACITY_MIN    = 0.55; // ຄວາມໂປ່ງໃສນ້ອຍສຸດທີ່ຂອບ

  const rails = document.querySelectorAll('.rail');

  rails.forEach((rail) => {
    const cards = Array.from(rail.querySelectorAll('.prod-card'));
    if (!cards.length) return;

    let rafId = null;

    const update = () => {
      const railRect = rail.getBoundingClientRect();
      const centerX = railRect.left + railRect.width / 2;
      const halfWidth = railRect.width / 2 || 1;

      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const cardCenter = r.left + r.width / 2;

        // -1 (ຊິດຂອບຊ້າຍ) ... 0 (ກາງ) ... 1 (ຊິດຂອບຂວາ)
        let progress = (cardCenter - centerX) / halfWidth;
        progress = Math.max(-1.3, Math.min(1.3, progress));
        const absProgress = Math.min(1, Math.abs(progress));

        const rotateY = -progress * FOLD_MAX_DEG;
        const scale = 1 - absProgress * (1 - SCALE_MIN);
        const opacity = 1 - absProgress * (1 - OPACITY_MIN);
        const originX = progress > 0 ? '0% 50%' : '100% 50%';

        card.style.transformOrigin = originX;
        card.style.transform =
          `perspective(900px) rotateY(${rotateY}deg) scale(${scale})`;
        card.style.opacity = opacity.toFixed(3);
      });

      rafId = null;
    };

    const onScroll = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(update);
      }
    };

    update(); // ตั้งค่าเริ่มต้นตอนโหลดหน้า
    rail.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
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
     ใช้ .avatar ที่มุมขวาบน (มีอยู่แล้วในหน้าเว็บ) เป็นทั้งปุ่ม
     "เข้าสู่ระบบ" (ยังไม่ login) และ "รูปโปรไฟล์ / ออกจากระบบ" (login แล้ว)
     ทำงานคู่กับ worker/src/index.js -> /api/me, /auth/discord/login, /auth/logout */
  (async () => {
    const avatarEl = document.querySelector('.avatar');
    if (!avatarEl) return;

    avatarEl.style.cursor = 'pointer';

    try {
      const res = await fetch('/api/me');
      const data = await res.json();

      if (data.loggedIn) {
        avatarEl.innerHTML = '';
        if (data.user.avatar) {
          const img = document.createElement('img');
          img.src = data.user.avatar;
          img.alt = data.user.username;
          img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
          avatarEl.appendChild(img);
        }
        avatarEl.title = `${data.user.username} — ກົດເພື່ອອອກຈາກລະບົບ`;
        avatarEl.addEventListener('click', () => {
          if (confirm(`ອອກຈາກລະບົບ (${data.user.username}) ບໍ?`)) {
            window.location.href = '/auth/logout';
          }
        });
      } else {
        avatarEl.title = 'ເຂົ້າສູ່ລະບົບດ້ວຍ Discord';
        avatarEl.addEventListener('click', () => {
          window.location.href = '/auth/discord/login';
        });
      }
    } catch (err) {
      // ยังไม่ deploy worker หรือ endpoint /api/me ใช้ไม่ได้ -> ปล่อยเป็น avatar เฉยๆ
      console.error('Session check failed:', err);
    }
  })();

});
