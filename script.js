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
