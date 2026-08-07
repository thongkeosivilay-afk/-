/* =========================================================
   script.js — ການເຮັດວຽກ (interaction) ຂອງໜ້າເວັບ NEXUS STORE
   ========================================================= */

/* ---------- Red Lightning Background (ผ่าแดงพื้นหลังทั้งเว็บ) ----------
   สร้าง canvas + style ของตัวเองแบบไดนามิก ไม่ต้องแก้ HTML/CSS ไฟล์อื่น
   ผ่าอัตโนมัติทุก 5 วินาที — ไม่มีการผ่าเมื่อแตะจอแล้ว */
(function initRedLightningBackground() {
  const style = document.createElement('style');
  style.textContent = `
    #rl-stage {
      position: fixed;
      inset: 0;
      z-index: -1;
      background: #000000;
      overflow: hidden;
      pointer-events: none;
    }
    #rl-stage canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    #rl-flash {
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background: radial-gradient(ellipse at var(--rl-fx, 50%) var(--rl-fy, 20%), rgba(255,20,20,0.35), rgba(255,0,0,0.10) 45%, rgba(0,0,0,0) 80%);
      opacity: 0;
      mix-blend-mode: screen;
    }
    /* ให้พื้นหลังทึบของ body/.shell โปร่งใส เพื่อให้เห็นฟ้าผ่าด้านหลังทะลุออกมา
       (การ์ด/ส่วนประกอบต่างๆ ยังทึบตามปกติเพราะมีสีพื้นหลังของตัวเองอยู่แล้ว) */
    body, .shell { background: transparent !important; }
  `;
  document.head.appendChild(style);

  const stage = document.createElement('div');
  stage.id = 'rl-stage';
  stage.innerHTML = `<canvas id="rl-glow"></canvas><canvas id="rl-bolt"></canvas>`;
  document.body.prepend(stage);

  const flashEl = document.createElement('div');
  flashEl.id = 'rl-flash';
  document.body.prepend(flashEl);

  const glowCanvas = document.getElementById('rl-glow');
  const boltCanvas = document.getElementById('rl-bolt');
  const glowCtx = glowCanvas.getContext('2d');
  const boltCtx = boltCanvas.getContext('2d');

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    [glowCanvas, boltCanvas].forEach((c) => {
      c.width = w * devicePixelRatio;
      c.height = h * devicePixelRatio;
    });
    glowCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    boltCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function generateBolt(x1, y1, x2, y2, displace, branches, out) {
    if (displace < 6) {
      out.push([x1, y1, x2, y2]);
      return;
    }
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * displace;
    const my = (y1 + y2) / 2 + (Math.random() - 0.5) * displace * 0.5;

    generateBolt(x1, y1, mx, my, displace / 2, branches, out);
    generateBolt(mx, my, x2, y2, displace / 2, branches, out);

    if (branches > 0 && Math.random() < 0.35) {
      const bx = mx + (Math.random() - 0.5) * displace * 2.2;
      const by = my + Math.abs(Math.random()) * displace * 1.4 + 20;
      generateBolt(mx, my, bx, by, displace / 2.2, branches - 1, out);
    }
  }

  function drawSegments(ctx, segs) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    segs.forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  }

  function strike() {
    const w = window.innerWidth, h = window.innerHeight;
    const startX = w * (0.25 + Math.random() * 0.5);
    const startY = -10;
    const endX = startX + (Math.random() - 0.5) * w * 0.25;
    const endY = h * (0.55 + Math.random() * 0.35);

    const segs = [];
    generateBolt(startX, startY, endX, endY, 90, 4, segs);

    flashEl.style.setProperty('--rl-fx', (endX / w * 100) + '%');
    flashEl.style.setProperty('--rl-fy', (endY / h * 100) + '%');

    animateStrike(segs);
  }

  let rafId = null;
  function animateStrike(segs) {
    const duration = 550;
    const start = performance.now();

    function frame(now) {
      const t = (now - start) / duration;
      glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
      boltCtx.clearRect(0, 0, boltCanvas.width, boltCanvas.height);
      flashEl.style.opacity = 0;

      if (t < 1) {
        let intensity;
        if (t < 0.08) intensity = t / 0.08;
        else if (t < 0.18) intensity = 1;
        else if (t < 0.30) intensity = 1 - (t - 0.18) / 0.12 * 0.7;
        else if (t < 0.40) intensity = 0.3 + Math.random() * 0.5;
        else intensity = Math.max(0, 0.6 * (1 - (t - 0.40) / 0.60));

        glowCtx.save();
        glowCtx.strokeStyle = 'rgba(255,30,30,' + (0.5 * intensity) + ')';
        glowCtx.lineWidth = 22;
        glowCtx.shadowColor = 'rgba(255,0,0,0.9)';
        glowCtx.shadowBlur = 70 * intensity;
        drawSegments(glowCtx, segs);
        glowCtx.restore();

        glowCtx.save();
        glowCtx.strokeStyle = 'rgba(255,60,60,' + (0.32 * intensity) + ')';
        glowCtx.lineWidth = 42;
        glowCtx.shadowColor = 'rgba(255,0,0,0.6)';
        glowCtx.shadowBlur = 130 * intensity;
        drawSegments(glowCtx, segs);
        glowCtx.restore();

        glowCtx.save();
        glowCtx.strokeStyle = 'rgba(255,80,80,' + (0.16 * intensity) + ')';
        glowCtx.lineWidth = 70;
        glowCtx.shadowColor = 'rgba(255,0,0,0.4)';
        glowCtx.shadowBlur = 190 * intensity;
        drawSegments(glowCtx, segs);
        glowCtx.restore();

        boltCtx.save();
        boltCtx.strokeStyle = 'rgba(120,0,0,' + (0.9 * intensity) + ')';
        boltCtx.lineWidth = 6;
        boltCtx.translate(1.5, 1.5);
        drawSegments(boltCtx, segs);
        boltCtx.restore();

        boltCtx.save();
        boltCtx.strokeStyle = 'rgba(220,20,20,' + intensity + ')';
        boltCtx.lineWidth = 3.5;
        drawSegments(boltCtx, segs);
        boltCtx.restore();

        boltCtx.save();
        boltCtx.strokeStyle = 'rgba(255,220,220,' + (0.95 * intensity) + ')';
        boltCtx.lineWidth = 1.4;
        boltCtx.translate(-0.6, -0.6);
        drawSegments(boltCtx, segs);
        boltCtx.restore();

        flashEl.style.opacity = (0.55 * intensity).toFixed(3);

        rafId = requestAnimationFrame(frame);
      } else {
        flashEl.style.opacity = 0;
      }
    }
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  // ผ่าอัตโนมัติทุก 5 วินาทีเท่านั้น — ไม่มีการผ่าเมื่อแตะ/คลิกหน้าจอ
  strike();
  setInterval(strike, 5000);
})();

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
        <a class="acct-dd-link" href="topup.html" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M16 15h.01"/></svg>
          ເຕີມເງິນ
        </a>
        <a class="acct-dd-link" href="orders.html" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
          ປະຫວັດການຊື້
        </a>
        <a class="acct-dd-link" href="topup-history.html" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
          ປະຫວັດເຕີມເງິນ
        </a>
        <a class="acct-dd-link" href="profile.html" id="acctDdProfileLink" role="menuitem">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ໂປຣໄຟລ໌
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

    const profileLink = dropdown.querySelector('#acctDdProfileLink');
    if (profileLink && window.openProfileModal) {
      profileLink.addEventListener('click', (e) => {
        e.preventDefault();
        closeDropdown();
        window.openProfileModal();
      });
    }

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

  /* =========================================================
     Profile modal — ເດັ້ງຂຶ້ນເປັນປັອບອັບທັບໜ້າປັດຈຸບັນ (ບໍ່ປ່ຽນໜ້າ)
     ໃຊ້ຜ່ານ window.openProfileModal() — ສ້າງ DOM ຄັ້ງດຽວແລ້ວໃຊ້ຊ້ຳ
     ========================================================= */
  let pmOverlay = null;
  let pmBuilt = false;

  function pmFormatMoney(n) {
    return Number(n || 0).toLocaleString('lo-LA') + ' ₭';
  }
  const PM_LAO_MONTHS = ['ມັງກອນ','ກຸມພາ','ມີນາ','ເມສາ','ພຶດສະພາ','ມິຖຸນາ','ກໍລະກົດ','ສິງຫາ','ກັນຍາ','ຕຸລາ','ພະຈິກ','ທັນວາ'];
  function pmFormatDate(iso) {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '-';
      const day = d.getDate();
      const month = PM_LAO_MONTHS[d.getMonth()];
      const year = d.getFullYear() + 543;
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${year} ເວລາ ${hh}:${mm}`;
    } catch {
      return '-';
    }
  }
  function pmInitials(name) {
    return (name || '?').trim().slice(0, 1).toUpperCase();
  }
  function pmEscapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  let pmToastTimer = null;
  function pmShowToast(message, isError) {
    let toast = document.querySelector('.pm-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'pm-toast';
      toast.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"/></svg><span></span>`;
      document.body.appendChild(toast);
    }
    toast.classList.toggle('error', !!isError);
    toast.querySelector('span').textContent = message;
    toast.classList.add('show');
    clearTimeout(pmToastTimer);
    pmToastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function pmBuild() {
    if (pmBuilt) return;
    pmBuilt = true;

    pmOverlay = document.createElement('div');
    pmOverlay.className = 'pm-overlay';
    pmOverlay.id = 'pmOverlay';
    pmOverlay.innerHTML = `
      <div class="pm-modal" role="dialog" aria-modal="true" aria-label="ໂປຣໄຟລ໌ຂອງຂ້ອຍ">
        <button type="button" class="pm-close" id="pmClose" aria-label="ປິດ">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <div class="pm-loading" id="pmLoading">ກຳລັງໂຫຼດ...</div>
        <div class="pm-content" id="pmContent">

          <div class="pm-card pm-headcard">
            <div class="pm-head-row">
              <div class="pm-avatar-wrap">
                <div class="pm-avatar" id="pmAvatarBox"><div class="pm-avatar-fallback" id="pmAvatarFallback">?</div></div>
                <button type="button" class="pm-avatar-edit" id="pmAvatarEditBtn" aria-label="ປ່ຽນຮູບໂປຣໄຟລ໌">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <input type="file" id="pmAvatarFile" accept="image/png,image/jpeg,image/webp" hidden>
              </div>
              <div class="pm-head-info">
                <div class="pm-username" id="pmUsername">—</div>
                <div class="pm-email" id="pmEmail">—</div>
                <span class="pm-badge" id="pmBadge">
                  <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  <span id="pmBadgeText">ສະມາຊິກ</span>
                </span>
              </div>
            </div>
            <div class="pm-stats">
              <div class="pm-stat">
                <div class="pm-stat-value" id="pmStatBalance">0 ₭</div>
                <div class="pm-stat-label">ຍອດເງິນຄົງເຫຼືອ</div>
              </div>
              <div class="pm-stat">
                <div class="pm-stat-value" id="pmStatOrders">0</div>
                <div class="pm-stat-label">ອໍເດີ້ສຳເລັດ</div>
              </div>
              <div class="pm-stat">
                <div class="pm-stat-value" id="pmStatSpent">0 ₭</div>
                <div class="pm-stat-label">ຍອດຊື້ລວມ</div>
              </div>
            </div>
          </div>

          <div class="pm-card">
            <div class="pm-card-title">
              <span class="pm-card-title-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span>
              ຂໍ້ມູນບັນຊີ
            </div>
            <div class="pm-row"><span class="pm-row-label">ຊື່ຜູ້ໃຊ້</span><span class="pm-row-value" id="pmInfoUsername">—</span></div>
            <div class="pm-row"><span class="pm-row-label">ອີເມວ</span><span class="pm-row-value" id="pmInfoEmail">—</span></div>
            <div class="pm-row"><span class="pm-row-label">ສະໝັກເມື່ອ</span><span class="pm-row-value" id="pmInfoCreated">—</span></div>
            <div class="pm-row"><span class="pm-row-label">ເຂົ້າສູ່ລະບົບລ່າສຸດ</span><span class="pm-row-value" id="pmInfoLastLogin">—</span></div>
            <div class="pm-row"><span class="pm-row-label">Discord</span><span class="pm-row-value" id="pmInfoDiscord">—</span></div>
          </div>

          <div class="pm-card">
            <div class="pm-card-title">
              <span class="pm-card-title-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>
              <span id="pmPwCardTitle">ປ່ຽນລະຫັດຜ່ານ</span>
            </div>
            <p class="pm-note" id="pmPwNote" style="display:none;">
              ບັນຊີນີ້ຍັງບໍ່ເຄີຍຕັ້ງລະຫັດຜ່ານມາກ່ອນ (ລ໋ອກອິນຜ່ານ Discord ຢ່າງດຽວ) — ຕັ້ງໄວ້ນຳ ຈະໄດ້ລ໋ອກອິນດ້ວຍອີເມວ+ລະຫັດຜ່ານໄດ້ນຳ
            </p>
            <form id="pmPwForm" class="pm-form" novalidate>
              <div class="field" id="pmCurrentPwField">
                <label for="pmCurrentPw">ລະຫັດຜ່ານປັດຈຸບັນ</label>
                <div class="field-input">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                  <input id="pmCurrentPw" type="password" placeholder="••••••••" autocomplete="current-password">
                  <button type="button" class="field-toggle" data-toggle-for="pmCurrentPw" aria-label="ສະແດງລະຫັດຜ່ານ">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
                <div class="field-error"></div>
              </div>
              <div class="field" id="pmNewPwField">
                <label for="pmNewPw">ລະຫັດຜ່ານໃໝ່</label>
                <div class="field-input">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                  <input id="pmNewPw" type="password" placeholder="••••••••" autocomplete="new-password">
                  <button type="button" class="field-toggle" data-toggle-for="pmNewPw" aria-label="ສະແດງລະຫັດຜ່ານ">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
                <div class="field-error"></div>
              </div>
              <div class="field" id="pmNewPw2Field">
                <label for="pmNewPw2">ຢືນຢັນລະຫັດຜ່ານໃໝ່</label>
                <div class="field-input">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                  <input id="pmNewPw2" type="password" placeholder="••••••••" autocomplete="new-password">
                  <button type="button" class="field-toggle" data-toggle-for="pmNewPw2" aria-label="ສະແດງລະຫັດຜ່ານ">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
                <div class="field-error"></div>
              </div>
              <button type="submit" class="btn-block btn-submit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                ບັນທຶກລະຫັດຜ່ານ
              </button>
            </form>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(pmOverlay);

    // ---- close interactions ----
    const closePm = () => {
      pmOverlay.classList.remove('show');
      document.body.style.overflow = '';
    };
    pmOverlay.querySelector('#pmClose').addEventListener('click', closePm);
    pmOverlay.addEventListener('click', (e) => { if (e.target === pmOverlay) closePm(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && pmOverlay.classList.contains('show')) closePm();
    });

    // ---- password show/hide toggles ----
    pmOverlay.querySelectorAll('.field-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.closest('.field-input').querySelector('input');
        const isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        btn.classList.toggle('is-visible', isPw);
      });
    });

    function setPmFieldError(fieldEl, message) {
      fieldEl.classList.toggle('has-error', !!message);
      const errEl = fieldEl.querySelector('.field-error');
      if (errEl) errEl.textContent = message || '';
    }

    // ---- avatar edit ----
    const avatarEditBtn = pmOverlay.querySelector('#pmAvatarEditBtn');
    const avatarFileInput = pmOverlay.querySelector('#pmAvatarFile');
    avatarEditBtn.addEventListener('click', () => avatarFileInput.click());
    avatarFileInput.addEventListener('change', () => {
      const file = avatarFileInput.files && avatarFileInput.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        pmShowToast('ກະລຸນາເລືອກໄຟລ໌ຮູບພາບເທົ່ານັ້ນ', true);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const size = 240;
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

          avatarEditBtn.disabled = true;
          fetch('/api/account/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarDataUrl: dataUrl }),
          })
            .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
              if (!ok) { pmShowToast(data.error || 'ອັບເດດຮູບໂປຣໄຟລ໌ບໍ່ສຳເລັດ', true); return; }
              const avatarBox = pmOverlay.querySelector('#pmAvatarBox');
              avatarBox.innerHTML = `<img src="${dataUrl}" alt="">`;
              pmShowToast('ອັບເດດຮູບໂປຣໄຟລ໌ສຳເລັດແລ້ວ');
            })
            .catch(() => pmShowToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true))
            .finally(() => { avatarEditBtn.disabled = false; avatarFileInput.value = ''; });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    // ---- change password form ----
    const pwForm = pmOverlay.querySelector('#pmPwForm');
    pwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentField = pmOverlay.querySelector('#pmCurrentPwField');
      const newField = pmOverlay.querySelector('#pmNewPwField');
      const new2Field = pmOverlay.querySelector('#pmNewPw2Field');
      const currentPw = pmOverlay.querySelector('#pmCurrentPw').value;
      const newPw = pmOverlay.querySelector('#pmNewPw').value;
      const newPw2 = pmOverlay.querySelector('#pmNewPw2').value;

      let ok = true;
      if (currentField.style.display !== 'none' && !currentPw) {
        setPmFieldError(currentField, 'ກະລຸນາໃສ່ລະຫັດຜ່ານປັດຈຸບັນ'); ok = false;
      } else setPmFieldError(currentField, '');

      if (newPw.length < 6) {
        setPmFieldError(newField, 'ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງໜ້ອຍ 6 ໂຕ'); ok = false;
      } else setPmFieldError(newField, '');

      if (newPw2 !== newPw || !newPw2) {
        setPmFieldError(new2Field, 'ລະຫັດຜ່ານບໍ່ກົງກັນ'); ok = false;
      } else setPmFieldError(new2Field, '');

      if (!ok) return;

      const submitBtn = pwForm.querySelector('.btn-submit');
      const originalHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.textContent = 'ກຳລັງບັນທຶກ...';

      try {
        const res = await fetch('/api/account/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
        });
        const data = await res.json();
        if (!res.ok) { pmShowToast(data.error || 'ປ່ຽນລະຫັດຜ່ານບໍ່ສຳເລັດ', true); return; }

        pmShowToast('ບັນທຶກລະຫັດຜ່ານສຳເລັດແລ້ວ');
        pwForm.reset();
        pmOverlay.querySelector('#pmCurrentPwField').style.display = '';
        pmOverlay.querySelector('#pmPwNote').style.display = 'none';
        pmOverlay.querySelector('#pmPwCardTitle').textContent = 'ປ່ຽນລະຫັດຜ່ານ';
      } catch (err) {
        console.error('ປ່ຽນລະຫັດຜ່ານບໍ່ສຳເລັດ', err);
        pmShowToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });
  }

  function pmRenderDiscordCell(user) {
    const cell = pmOverlay.querySelector('#pmInfoDiscord');
    if (user.discordLinked) {
      cell.innerHTML = `
        <span class="pm-discord-actions">
          <span class="pm-discord-chip">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865f2"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.9-1.52.07.07 0 0 0-.08.04c-.21.38-.45.86-.61 1.24a18.3 18.3 0 0 0-5.46 0 12.6 12.6 0 0 0-.62-1.24.08.08 0 0 0-.08-.04c-1.7.29-3.34.8-4.9 1.52a.07.07 0 0 0-.03.03C.53 8.7-.32 12.9.1 17.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.11 13 13 0 0 1-1.87-.9.08.08 0 0 1 0-.13c.13-.09.25-.19.37-.28a.07.07 0 0 1 .08 0c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08 0c.12.1.24.19.37.28a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.04.12c.37.7.78 1.36 1.23 2a.08.08 0 0 0 .08.02 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.05c.5-4.83-.83-9-3.51-12.66a.06.06 0 0 0-.03-.03Z"/></svg>
            <span>${pmEscapeHtml(user.username)}</span>
          </span>
          <button type="button" class="pm-unlink-btn" id="pmUnlinkDiscordBtn">ຍົກເລີກ</button>
        </span>`;
      const unlinkBtn = cell.querySelector('#pmUnlinkDiscordBtn');
      unlinkBtn.addEventListener('click', async () => {
        if (!window.confirm('ຍົກເລີກການເຊື່ອມຕໍ່ Discord ຈາກບັນຊີນີ້?')) return;
        unlinkBtn.disabled = true;
        try {
          const res = await fetch('/api/account/discord/unlink', { method: 'POST' });
          const data = await res.json();
          if (!res.ok) { pmShowToast(data.error || 'ຍົກເລີກການເຊື່ອມຕໍ່ບໍ່ສຳເລັດ', true); unlinkBtn.disabled = false; return; }
          pmShowToast('ຍົກເລີກການເຊື່ອມຕໍ່ Discord ແລ້ວ');
          user.discordLinked = false;
          pmRenderDiscordCell(user);
        } catch {
          pmShowToast('ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ', true);
          unlinkBtn.disabled = false;
        }
      });
    } else {
      cell.innerHTML = `<button type="button" class="pm-connect-btn" id="pmConnectDiscordBtn">ເຊື່ອມຕໍ່ Discord</button>`;
      cell.querySelector('#pmConnectDiscordBtn').addEventListener('click', () => {
        window.location.href = '/auth/discord/login?next=' + encodeURIComponent(window.location.pathname);
      });
    }
  }

  window.openProfileModal = async function openProfileModal() {
    pmBuild();
    pmOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';

    const loadingEl = pmOverlay.querySelector('#pmLoading');
    const contentEl = pmOverlay.querySelector('#pmContent');
    contentEl.classList.remove('ready');
    loadingEl.style.display = 'block';

    let me;
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      me = await res.json();
    } catch (err) {
      console.error('ດຶງ /api/me ບໍ່ສຳເລັດ', err);
      loadingEl.textContent = 'ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ';
      return;
    }

    if (!me.loggedIn) {
      window.location.href = '/login.html?next=' + encodeURIComponent(window.location.pathname);
      return;
    }

    const user = me.user || {};

    const avatarBox = pmOverlay.querySelector('#pmAvatarBox');
    avatarBox.innerHTML = user.avatar
      ? `<img src="${user.avatar}" alt="${pmEscapeHtml(user.username)}">`
      : `<div class="pm-avatar-fallback">${pmInitials(user.username)}</div>`;

    pmOverlay.querySelector('#pmUsername').textContent = user.username || 'ຜູ້ໃຊ້';
    pmOverlay.querySelector('#pmEmail').textContent = user.email || '';
    pmOverlay.querySelector('#pmEmail').style.display = user.email ? '' : 'none';
    pmOverlay.querySelector('#pmInfoUsername').textContent = user.username || '—';

    const badge = pmOverlay.querySelector('#pmBadge');
    const badgeText = pmOverlay.querySelector('#pmBadgeText');
    badge.classList.toggle('is-admin', !!user.isAdmin);
    badgeText.textContent = user.isAdmin ? 'ADMIN' : 'ສະມາຊິກ';

    pmOverlay.querySelector('#pmStatBalance').textContent = pmFormatMoney(user.balance);
    pmOverlay.querySelector('#pmInfoEmail').textContent = user.email || 'ບໍ່ມີ';
    pmOverlay.querySelector('#pmInfoCreated').textContent = pmFormatDate(user.createdAt);
    pmOverlay.querySelector('#pmInfoLastLogin').textContent = pmFormatDate(user.lastLoginAt);

    pmRenderDiscordCell(user);

    const hasPassword = !!user.hasPassword;
    const currentPwField = pmOverlay.querySelector('#pmCurrentPwField');
    const pwNote = pmOverlay.querySelector('#pmPwNote');
    const pwCardTitle = pmOverlay.querySelector('#pmPwCardTitle');
    if (!hasPassword) {
      currentPwField.style.display = 'none';
      pwNote.style.display = 'block';
      pwCardTitle.textContent = 'ຕັ້ງລະຫັດຜ່ານ';
    } else {
      currentPwField.style.display = '';
      pwNote.style.display = 'none';
      pwCardTitle.textContent = 'ປ່ຽນລະຫັດຜ່ານ';
    }

    loadingEl.style.display = 'none';
    contentEl.classList.add('ready');

    try {
      const statsRes = await fetch('/api/account/stats', { cache: 'no-store' });
      if (statsRes.ok) {
        const stats = await statsRes.json();
        pmOverlay.querySelector('#pmStatOrders').textContent = stats.ordersCompleted ?? 0;
        pmOverlay.querySelector('#pmStatSpent').textContent = pmFormatMoney(stats.totalSpent);
      }
    } catch (err) {
      console.error('ດຶງ /api/account/stats ບໍ່ສຳເລັດ', err);
    }
  };

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
