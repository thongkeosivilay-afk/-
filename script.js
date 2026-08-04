/* =========================================================
   script.js — ການເຮັດວຽກ (interaction) ຂອງໜ້າເວັບ NEXUS STORE
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- ດຶງຂໍ້ມູນສິນຄ້າ/ສະຕັອກລະຫັດຈາກ store-data.js ມາສະແດງ ---------- */
  function renderProductCards() {
    if (!window.StoreData) return;
    const data = StoreData.load();
    document.querySelectorAll('.prod-card[data-pid]').forEach((card) => {
      const pid = card.dataset.pid;
      const p = StoreData.getProduct(data, pid);
      if (!p) return;

      const nameEl = card.querySelector('.prod-name');
      const priceEl = card.querySelector('.prod-price');
      const statusEl = card.querySelector('.prod-status');
      const soldEl = card.querySelector('.sold-badge');
      const buyBtn = card.querySelector('.buy-btn');
      const stockLeft = p.codes.length;

      if (p.name) {
        nameEl.textContent = p.name;
        nameEl.classList.remove('todo');
      } else {
        nameEl.textContent = 'ໃສ່ຊື່ສິນຄ້າ';
        nameEl.classList.add('todo');
      }

      if (p.name && p.price > 0) {
        priceEl.textContent = `₭ ${Number(p.price).toLocaleString('en-US')}`;
        priceEl.classList.remove('todo');
      } else {
        priceEl.textContent = '₭ 0';
        priceEl.classList.add('todo');
      }

      if (soldEl && soldEl.lastChild) {
        soldEl.lastChild.textContent = ` ຂາຍແລ້ວ ${p.sold.length}`;
      }

      if (p.status === 'ready' && stockLeft > 0) {
        statusEl.classList.remove('out');
        statusEl.innerHTML = `<span class="dot"></span>ພ້ອມຂາຍ <span class="stock">(ເຫຼືອ ${stockLeft})</span>`;
        buyBtn.disabled = false;
      } else {
        statusEl.classList.add('out');
        statusEl.innerHTML = `<span class="dot"></span>ບໍ່ພ້ອມຂາຍ`;
        buyBtn.disabled = true;
      }
    });
  }

  renderProductCards();

  document.querySelectorAll('.prod-card[data-pid] .buy-btn').forEach((btn) => {
    const originalText = btn.textContent.trim();
    btn.addEventListener('click', () => {
      const card = btn.closest('.prod-card');
      const pid = card?.dataset.pid;
      if (!pid || !window.StoreData) return;

      const code = StoreData.consumeCode(pid);
      if (!code) {
        alert('ຂໍອະໄພ ສິນຄ້ານີ້ໝົດສະຕັອກແລ້ວ 🙏');
        renderProductCards();
        return;
      }

      btn.disabled = true;
      const prevText = btn.textContent;
      btn.textContent = 'ສຳເລັດ ✓';
      btn.style.opacity = '0.75';

      // Demo mode: ບໍ່ມີລະບົບຊຳລະເງິນຈິງ — ສະແດງລະຫັດທີ່ໄດ້ຮັບໃຫ້ລູກຄ້າເລີຍ
      alert(`ຊື້ສຳເລັດ!\nລະຫັດຂອງທ່ານ: ${code}\n\n(ໂໝດ demo: ຍັງບໍ່ມີລະບົບຊຳລະເງິນຈິງ)`);

      setTimeout(() => {
        btn.style.opacity = '1';
        renderProductCards();
      }, 800);
    });
  });

  // ປຸ່ມ buy ໃນກາຕູນທີ່ບໍ່ມີ data-pid (ຖ້າມີ — ສຳຮອງໄວ້) ໃຫ້ໃຊ້ animation ເກົ່າ
  document.querySelectorAll('.buy-btn').forEach((btn) => {
    if (btn.closest('.prod-card[data-pid]')) return; // ຖືກຈັດການແລ້ວຂ້າງເທິງ
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
          window.location.href = '/login.html';
        });
      }
    } catch (err) {
      console.error('Session check failed:', err);
      loginBtn.title = 'ລົງຊື່ເຂົ້າໃຊ້ / ສະໝັກສະມາຊິກ';
      loginBtn.addEventListener('click', () => {
        window.location.href = '/login.html';
      });
    }
  })();

});
