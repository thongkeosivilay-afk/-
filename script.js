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

  /* ---------- 1b) ໄອຄອນກະຕ່າລອຍ (cart-quick) ເທິງແຕ່ລະການ໌ດ໌ສິນຄ້າ ----------
     ກົດແລ້ວໄອຄອນປ່ຽນເປັນເຄື່ອງໝາຍຖືກຊົ່ວຄາວ ເພື່ອຢືນຢັນວ່າເພີ່ມໃສ່ກະຕ່າແລ້ວ */
  document.querySelectorAll('.cart-quick').forEach((btn) => {
    const originalIcon = btn.innerHTML;
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // ບໍ່ໃຫ້ trigger click ຂອງການ໌ດ໌/ລິ້ງອ້ອມຂ້າງ
      if (btn.classList.contains('is-added')) return;
      // TODO: ຕໍ່ໄປສາຍານກັບລະບົບຕະກ້າ (cart state) ຈິງຂອງທ່ານທີ່ນີ້
      btn.classList.add('is-added');
      btn.setAttribute('aria-label', 'ເພີ່ມໃສ່ກະຕ່າແລ້ວ');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      setTimeout(() => {
        btn.classList.remove('is-added');
        btn.setAttribute('aria-label', 'ເພີ່ມໃສ່ກະຕ່າ');
        btn.innerHTML = originalIcon;
      }, 1300);
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

  /* ---------- 4) Category card scroll-reveal ----------
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
     ໃຊ້ .login-btn ທີ່ມຸມຂວາເທິງ ເປັນທັງປຸ່ມ "ລົງຊື່ເຂົ້າໃຊ້ດ້ວຍ Discord"
     (ຍັງບໍ່ login) ແລະ "ຮູບໂປຣໄຟລ໌ / ອອກຈາກລະບົບ" (login ແລ້ວ)
     ຄົນທີ່ຍັງບໍ່ login ຈະຖືກພາໄປໜ້າ login.html ກ່ອນ (ຟອມອີເມວ + Discord)
     ທຳງານຄູ່ກັບ worker/src/index.js -> /api/me, /auth/discord/login, /auth/logout */
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
        loginBtn.title = 'ລົງຊື່ເຂົ້າໃຊ້ / ສະໝັກສະມາຊິກ';
        loginBtn.addEventListener('click', () => {
          // ພາໄປໜ້າ login.html ກ່ອນ (ມີທັງຟອມອີເມວ ແລະ ປຸ່ມ Discord)
          window.location.href = '/login.html';
        });
      }
    } catch (err) {
      // ຍັງບໍ່ deploy worker ຫຼື endpoint /api/me ໃຊ້ບໍ່ໄດ້ -> ພາໄປໜ້າ login ຄືເກົ່າ
      console.error('Session check failed:', err);
      loginBtn.title = 'ລົງຊື່ເຂົ້າໃຊ້ / ສະໝັກສະມາຊິກ';
      loginBtn.addEventListener('click', () => {
        window.location.href = '/login.html';
      });
    }
  })();

});
