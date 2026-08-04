/* =========================================================
   script.js — ການເຮັດວຽກ (interaction) ຂອງໜ້າເວັບ NEXUS STORE
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('.buy-btn').forEach((btn) => {
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
