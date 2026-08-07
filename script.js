/* =========================================================
   script.js — ການເຮັດວຽກ (interaction) ຂອງໜ້າເວັບ NEXUS STORE
   ========================================================= */

// ---- ป้องกัน "ข้อมูลเก่าโผล่มาแวบหนึ่ง" ตอนกดย้อนกลับ/ปัดกลับมาหน้านี้ ----
// มือถือหลายรุ่นจะเก็บภาพหน้าเว็บเก่า (bfcache) ไว้โชว์ทันทีตอนย้อนกลับมา
// ก่อนข้อมูลจริงจะโหลดใหม่ ทำให้เห็นข้อมูลเก่าแวบหนึ่งแล้วค่อยหาย — บังคับโหลด
// หน้าใหม่ทั้งหมดทุกครั้งที่หน้านี้ถูกดึงกลับมาจาก bfcache แทน
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

document.addEventListener('DOMContentLoaded', () => {

  // ໝາຍເຫດ: ການສ້າງກາຕູນສິນຄ້າ (.prod-card[data-pid]) ແລະ ປຸ່ມຊື້ຂອງມັນ ຕອນນີ້ຄຸມ
  // ໂດຍ storefront.js (index.html) ແລະ category.js (category.html) ໂດຍກົງ — ດຶງ
  // ຊື່/ລາຄາ/ສະຕັອກຈິງຈາກ /api/public/storefront ແລ້ວ, ບໍ່ໄດ້ໃຊ້ລະບົບ demo
  // localStorage (store-data.js) ອີກຕໍ່ໄປ, ຈຶ່ງບໍ່ຕ້ອງມີ logic render/buy ຢູ່ນີ້ອີກ

  // ປຸ່ມ buy ໃນກາຕູນທີ່ບໍ່ມີ data-pid (ຖ້າມີ — ສຳຮອງໄວ້) ໃຫ້ໃຊ້ animation ເກົ່າ
  document.querySelectorAll('.buy-btn').forEach((btn) => {
    if (btn.closest('.prod-card[data-pid]')) return; // ຄຸມແຍກໂດຍ storefront.js/category.js
    const originalText = btn.textContent.trim();
    btn.addEventListener('click', () => {
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

  const chatFab = document.querySelector('.chat-fab');
  if (chatFab) {
    chatFab.addEventListener('click', () => {
      window.open('https://discord.com', '_blank', 'noopener');
    });
  }

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

  /* ---------- Account dropdown menu helpers ---------- */
  function acctEscapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function acctFormatKip(n) {
    return Number(n || 0).toLocaleString('th-TH') + ' ₭';
  }

  function renderAccountMenu(loginBtn, user) {
    // ຫໍ່ .login-btn ດ້ວຍ .acct-slot ເພື່ອວາງ dropdown ໄວ້ຂ້າງໆ
    const wrap = document.createElement('div');
    wrap.className = 'acct-slot';
    loginBtn.replaceWith(wrap);
    wrap.appendChild(loginBtn);

    loginBtn.classList.add('is-authed');
    loginBtn.innerHTML = '';
    loginBtn.type = 'button';
    loginBtn.setAttribute('aria-haspopup', 'true');
    loginBtn.setAttribute('aria-expanded', 'false');
    if (user.avatar) {
      const img = document.createElement('img');
      img.src = user.avatar;
      img.alt = user.username;
      loginBtn.appendChild(img);
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = user.username;
    loginBtn.appendChild(nameSpan);
    loginBtn.title = user.username;

    const badgeHtml = user.isAdmin
      ? `<span class="acct-dd-badge is-admin"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7l-9-5Z"/></svg> ADMIN</span>`
      : `<span class="acct-dd-badge"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> ຜູ້ໃຊ້</span>`;

    const adminLinkHtml = user.isAdmin
      ? `<a class="acct-dd-link" href="admin.html" role="menuitem">
           <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7l-9-5Z"/><path d="m9 12 2 2 4-4"/></svg>
           ຫ້ອງຄວບຄຸມແອດມິນ
         </a>`
      : '';

    const dropdown = document.createElement('div');
    dropdown.className = 'acct-dropdown';
    dropdown.id = 'acctDropdown';
    dropdown.setAttribute('role', 'menu');
    dropdown.setAttribute('aria-hidden', 'true');
    dropdown.innerHTML = `
      <div class="acct-dd-user">
        <div class="acct-dd-name">${acctEscapeHtml(user.username)}</div>
        ${badgeHtml}
        <div class="acct-dd-balance">ຍອດເງິນ: <b>${acctFormatKip(user.balance)}</b></div>
      </div>
      <nav class="acct-dd-nav">
        ${adminLinkHtml}
        <a class="acct-dd-link" href="index.html#categories" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7L12 3 4 7l8 4 8-4Z"/><path d="M4 7v10l8 4 8-4V7"/></svg>
          ຮ້ານຄ້າ
        </a>
        <a class="acct-dd-link" href="orders.html" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
          ປະຫວັດການຊື້
        </a>
        <a class="acct-dd-link" href="topup-history.html" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
          ປະຫວັດເຕີມເງິນ
        </a>
      </nav>
      <div class="acct-dd-divider"></div>
      <nav class="acct-dd-nav">
        <button type="button" class="acct-dd-link danger" id="acctDdLogout" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          ອອກຈາກລະບົບ
        </button>
      </nav>
    `;
    wrap.appendChild(dropdown);

    const closeDropdown = () => {
      dropdown.classList.remove('show');
      dropdown.setAttribute('aria-hidden', 'true');
      loginBtn.setAttribute('aria-expanded', 'false');
    };
    const openDropdown = () => {
      dropdown.classList.add('show');
      dropdown.setAttribute('aria-hidden', 'false');
      loginBtn.setAttribute('aria-expanded', 'true');
    };

    loginBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.contains('show') ? closeDropdown() : openDropdown();
    });
    dropdown.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', closeDropdown);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDropdown(); });

    dropdown.querySelector('#acctDdLogout').addEventListener('click', () => {
      window.location.href = '/auth/logout';
    });
  }

  (async () => {
    const loginBtn = document.querySelector('.login-btn');
    const adminLink = document.querySelector('#admin-link');

    try {
      // cache: 'no-store' — สถานะล็อกอิน ต้องเป็นข้อมูลสดจาก server เสมอ ห้ามใช้ค่าเก่าที่ค้าง
      const res = await fetch('/api/me', { cache: 'no-store' });
      const data = await res.json();

      // ---- ปุ่ม Admin: โผล่เฉพาะตอนล็อกอินอยู่แล้ว "และ" เป็นแอดมินเท่านั้น ----
      // คนทั่วไป/ยังไม่ล็อกอิน จะไม่เห็นปุ่มนี้เลย
      if (adminLink) {
        if (data.loggedIn && data.user && data.user.isAdmin) {
          adminLink.style.display = 'inline-block';
        } else {
          adminLink.style.display = 'none';
        }
      }

      if (!loginBtn) return;

      if (data.loggedIn) {
        // ยอดเงิน (wallet balance): ยังไม่มี endpoint จริงในโปรเจกต์นี้
        // ถ้ามี /api/wallet/balance ในอนาคต ให้ดึงค่าจริงมาแทน 0 ตรงนี้
        // TODO: เชื่อม endpoint ยอดเงินจริงเมื่อ backend พร้อม
        let balance = 0;
        try {
          const balRes = await fetch('/api/wallet/balance', { cache: 'no-store' });
          if (balRes.ok) {
            const balData = await balRes.json();
            balance = balData.balance || 0;
          }
        } catch (e) { /* ยังไม่มี endpoint นี้ — ใช้ 0 ไปก่อน */ }

        renderAccountMenu(loginBtn, {
          username: data.user.username,
          avatar: data.user.avatar,
          isAdmin: data.user.isAdmin,
          balance,
        });
      } else {
        loginBtn.title = 'ລົງຊື່ເຂົ້າໃຊ້ / ສະໝັກສະມາຊິກ';
        loginBtn.addEventListener('click', () => {
          window.location.href = '/login.html';
        });
      }
    } catch (err) {
      console.error('Session check failed:', err);
      if (adminLink) adminLink.style.display = 'none';
      if (loginBtn) {
        loginBtn.title = 'ລົງຊື່ເຂົ້າໃຊ້ / ສະໝັກສະມາຊິກ';
        loginBtn.addEventListener('click', () => {
          window.location.href = '/login.html';
        });
      }
    }
  })();

});
