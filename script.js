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

// (ตัด Page transition ซ้ำซ้อนออก — ใช้ page-transition.js ตัวเดียว ไม่ไปซ่อน body ซ้ำอีกชั้น)

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

  /* ---------- Contact modal (popup ຕອນກົດ chat FAB) ----------
     ດຶງລິ້ງແທ້ຈາກ /api/public/storefront -> store.social (ອິງຄ່າທີ່ແອດມິນຕັ້ງໄວ້ໃນ
     ຫ້ອງແອດມິນ ຊ່ອງທາງໂຊເຊียล — social_facebook / social_discord / social_line /
     social_telegram / social_whatsapp). ຊ່ອງທາງໃດແອດມິນຍັງບໍ່ໄດ້ໃສ່ລິ້ງ (null/ຫວ່າງ)
     ຈະບໍ່ໂຊວ໌ໃນ popup ນີ້ອັດຕະໂນມັດ */
  const SOCIAL_META = {
    facebook: {
      name: 'Facebook', color: '#1877F2',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.6h2.55l.38-2.96h-2.93V8.55c0-.86.24-1.44 1.47-1.44h1.57V4.46A20.9 20.9 0 0 0 14.3 4.3c-2.25 0-3.79 1.37-3.79 3.89v2.25H8v2.96h2.51V21h2.99Z"/></svg>',
    },
    discord: {
      name: 'Discord', color: '#5865F2',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 5.4A17.6 17.6 0 0 0 15.9 4a.06.06 0 0 0-.07.03c-.2.34-.4.79-.56 1.14a16.4 16.4 0 0 0-4.87 0c-.15-.36-.36-.8-.57-1.14A.07.07 0 0 0 9.86 4c-1.4.24-2.75.66-4.02 1.4a.06.06 0 0 0-.03.02C3.1 8.8 2.4 12.1 2.7 15.4a.07.07 0 0 0 .03.05 17.7 17.7 0 0 0 5.3 2.65.07.07 0 0 0 .08-.02c.4-.56.77-1.15 1.08-1.77a.07.07 0 0 0-.04-.1 11.6 11.6 0 0 1-1.67-.79.07.07 0 0 1 0-.12c.11-.08.22-.17.33-.26a.07.07 0 0 1 .07 0c3.5 1.6 7.3 1.6 10.76 0a.07.07 0 0 1 .07 0c.11.09.22.18.33.26a.07.07 0 0 1 0 .12c-.53.31-1.09.57-1.67.79a.07.07 0 0 0-.04.1c.32.62.69 1.21 1.08 1.77a.07.07 0 0 0 .08.02 17.6 17.6 0 0 0 5.32-2.65.07.07 0 0 0 .03-.05c.36-3.8-.6-7.08-2.55-10a.06.06 0 0 0-.03-.03ZM8.68 13.4c-.94 0-1.71-.87-1.71-1.94 0-1.06.76-1.93 1.71-1.93.96 0 1.73.88 1.71 1.93 0 1.07-.76 1.94-1.71 1.94Zm6.65 0c-.94 0-1.71-.87-1.71-1.94 0-1.06.76-1.93 1.71-1.93.96 0 1.73.88 1.71 1.93 0 1.07-.75 1.94-1.71 1.94Z"/></svg>',
    },
    line: {
      name: 'Line', color: '#06C755',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.48 3 2 6.58 2 11c0 3.95 3.56 7.26 8.37 7.9.33.07.77.22.88.5.1.26.07.66.03.92l-.14.85c-.04.26-.2 1 .87.55 1.07-.46 5.77-3.4 7.87-5.83C21.3 13.85 22 12.5 22 11c0-4.42-4.48-8-10-8Zm-3.9 10.4H6.6a.4.4 0 0 1-.4-.4V8.9c0-.22.18-.4.4-.4s.4.18.4.4v3.7h1.1c.22 0 .4.18.4.4s-.18.4-.4.4Zm2.05 0a.4.4 0 0 1-.4-.4V8.9c0-.22.18-.4.4-.4s.4.18.4.4V13c0 .22-.18.4-.4.4Zm4.75 0a.4.4 0 0 1-.32-.16l-2.03-2.75V13c0 .22-.18.4-.4.4s-.4-.18-.4-.4V8.9c0-.18.11-.33.28-.38a.4.4 0 0 1 .44.14l2.03 2.75V8.9c0-.22.18-.4.4-.4s.4.18.4.4V13c0 .18-.11.33-.28.38a.4.4 0 0 1-.12.02Zm3.7-3.29c.22 0 .4.18.4.4s-.18.4-.4.4h-1.5v.89h1.5c.22 0 .4.18.4.4s-.18.4-.4.4h-1.9a.4.4 0 0 1-.4-.4V8.9c0-.22.18-.4.4-.4h1.9c.22 0 .4.18.4.4s-.18.4-.4.4h-1.5v.81h1.5Z"/></svg>',
    },
    telegram: {
      name: 'Telegram', color: '#26A5E4',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 4.6 2.9 11.8c-.9.36-.9 1.65.03 1.98l4.4 1.53 1.7 5.4c.24.75 1.2.95 1.73.36l2.5-2.8 4.6 3.4c.72.53 1.75.14 1.94-.73l3.13-14.5c.22-1-.75-1.83-1.53-1.34ZM8.9 14.9l-1.2-4 9.6-6.35c.16-.1.33.11.19.24L9.6 12.9l-.22 2Z"/></svg>',
    },
    whatsapp: {
      name: 'WhatsApp', color: '#25D366',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.28-.14-1.64-.8-1.9-.9-.25-.09-.44-.14-.62.14-.18.28-.72.9-.88 1.08-.16.18-.32.2-.6.07-.28-.14-1.18-.43-2.24-1.37-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.53-.45-.46-.62-.47h-.53c-.18 0-.48.07-.73.34-.25.28-.96.94-.96 2.28 0 1.34.98 2.64 1.12 2.82.14.18 1.93 2.95 4.68 4.14.65.28 1.16.45 1.56.58.66.21 1.25.18 1.72.11.53-.08 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.12-.25-.19-.53-.33Z"/><path d="M12.04 2C6.5 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.08L2 22l5.06-1.33A9.96 9.96 0 0 0 12.04 22C17.6 22 22 17.5 22 12S17.6 2 12.04 2Zm0 18.14c-1.68 0-3.24-.5-4.55-1.35l-.33-.2-3.34.88.9-3.25-.22-.34a8.12 8.12 0 0 1-1.28-4.4c0-4.5 3.68-8.15 8.22-8.15 4.53 0 8.22 3.66 8.22 8.15 0 4.5-3.69 8.15-8.22 8.15Z"/></svg>',
    },
  };

  function escHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function contactLinksHTML(social) {
    const entries = Object.keys(SOCIAL_META)
      .map((key) => ({ key, ...SOCIAL_META[key], href: social && String(social[key] || '').trim() }))
      .filter((l) => l.href);

    if (!entries.length) {
      return `<p class="contact-modal-empty">ຮ້ານຍັງບໍ່ໄດ້ຕັ້ງຄ່າຊ່ອງທາງຕິດຕໍ່ — ເຂົ້າ "ຫ້ອງແອດມິນ &gt; ຊ່ອງທາງໂຊເຊียล" ເພື່ອເພີ່ມລິ້ງ</p>`;
    }

    return `<div class="contact-modal-links">${entries.map((l) => `
      <a class="contact-link" href="${escHtml(l.href)}" target="_blank" rel="noopener">
        <span class="contact-link-icon" style="background:${l.color}">${l.icon}</span>
        <span class="contact-link-name">${escHtml(l.name)}</span>
        <svg class="contact-link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
      </a>
    `).join('')}</div>`;
  }

  let contactModalOverlay = null;

  function buildContactModal(storeName, social) {
    const name = (storeName || document.querySelector('.brand-name, .brand-name-inline')?.textContent || '').trim() || 'ຮ້ານຄ້າ';
    const logoImg = document.querySelector('.logo img');

    const overlay = document.createElement('div');
    overlay.className = 'contact-modal-overlay';
    overlay.innerHTML = `
      <div class="contact-modal" role="dialog" aria-modal="true" aria-label="ຊ່ອງທາງຕິດຕໍ່">
        <button type="button" class="contact-modal-close" id="contactModalClose" aria-label="ປິດ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
        <div class="contact-modal-logo">
          ${logoImg ? `<img src="${logoImg.src}" alt="${escHtml(name)}">` : `
          <svg viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
        </div>
        <h3 class="contact-modal-title">${escHtml(name)}</h3>
        <p class="contact-modal-sub">ຊ່ອງທາງຕິດຕໍ່ &amp; ໂຊເຊียล</p>
        ${contactLinksHTML(social)}
      </div>
    `;
    document.body.appendChild(overlay);

    const closeModal = () => {
      overlay.classList.remove('show');
      document.body.classList.remove('contact-modal-open');
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(); // ກົດພື້ນທີ່ນອກກ່ອງ ໃຫ້ປິດ
    });
    overlay.querySelector('#contactModalClose').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    return overlay;
  }

  const chatFab = document.querySelector('.chat-fab');
  if (chatFab) {
    chatFab.addEventListener('click', async () => {
      if (!contactModalOverlay) {
        let storeName = null;
        let social = null;
        try {
          // StorefrontData ດຶງ/cache ຈາກ /api/public/storefront ຢູ່ແລ້ວ (storefront-data.js) —
          // ຮຽກຊ້ຳຢູ່ນີ້ຈະບໍ່ຍິງ request ໃໝ່ຖ້າໜ້ານັ້ນເຄີຍດຶງໄປແລ້ວ
          const data = await window.StorefrontData.fetchData();
          storeName = data?.store?.name || null;
          social = data?.store?.social || null;
        } catch (err) {
          console.error('Contact modal: fetchData failed', err);
        }
        contactModalOverlay = buildContactModal(storeName, social);
      }
      contactModalOverlay.classList.add('show');
      document.body.classList.add('contact-modal-open');
    });
  }

  /* ---------- ໄອຄອນຊ່ອງທາງຕິດຕໍ່ໃນ footer (ໃຊ້ SOCIAL_META ດຽວກັນກັບ contact modal) ----------
     ດຶງລິ້ງແທ້ຈາກ store.social — ຊ່ອງທາງໃດແອດມິນຍັງບໍ່ໄດ້ຕັ້ງລິ້ງໄວ້ ຈະບໍ່ໂຊວ໌ໄອຄອນນັ້ນ,
     ຖ້າຍັງບໍ່ໄດ້ຕັ້ງລິ້ງໃດເລີຍ ແຖວໄອຄອນທັງໝົດຈະຖືກເຊື່ອງໄປ */
  const footerSocialEl = document.getElementById('footer-social');
  if (footerSocialEl) {
    (async () => {
      try {
        const data = await window.StorefrontData.fetchData();
        const social = data?.store?.social || null;
        const entries = Object.keys(SOCIAL_META)
          .map((key) => ({ key, ...SOCIAL_META[key], href: social && String(social[key] || '').trim() }))
          .filter((l) => l.href);

        if (entries.length) {
          footerSocialEl.innerHTML = entries.map((l) => `
            <a class="footer-social-link" href="${escHtml(l.href)}" target="_blank" rel="noopener" aria-label="${escHtml(l.name)}" style="background:${l.color}">${l.icon}</a>
          `).join('');
        } else {
          footerSocialEl.style.display = 'none';
        }
      } catch (err) {
        console.error('Footer social icons: fetchData failed', err);
      }
    })();
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

  /* ---------- Bottom tab bar (แทน dropdown เดิม) ----------
     กดโปรไฟล์ (ปุ่ม .login-btn ตอนล็อกอินแล้ว) -> แถบไอคอนเด้งขึ้นจากด้านล่าง
     กดไอคอน -> แถบสีแดงเลื่อนไปหาไอคอนนั้น แล้วพาไปหน้านั้น
     กดที่ว่าง / กดโปรไฟล์ซ้ำ / กด Esc -> แถบหุบลง */
  const TB_ICON = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const TB_TABS = [
    { key: 'admin',   label: 'ແອດມິນ', short: 'ແອດມິນ',          href: 'admin.html',          adminOnly: true,
      icon: TB_ICON('<path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7l-9-5Z"/><path d="m9 12 2 2 4-4"/>') },
    { key: 'shop',    label: 'ຮ້ານຄ້າ', short: 'ຮ້ານຄ້າ',          href: 'index.html#categories',
      icon: TB_ICON('<path d="M20 7L12 3 4 7l8 4 8-4Z"/><path d="M4 7v10l8 4 8-4V7"/>') },
    { key: 'reseller', label: 'ຕົວແທນ', short: 'ຕົວແທນ',          href: 'reseller.html',
      icon: TB_ICON('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>') },
    { key: 'topup',   label: 'ເຕີມເງິນ', short: 'ເຕີມເງິນ',         href: 'topup.html',
      icon: TB_ICON('<rect x="2" y="6" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/>') },
    { key: 'orders',  label: 'ປະຫວັດການຊື້', short: 'ປະຫວັດຊື້',     href: 'orders.html',
      icon: TB_ICON('<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/>') },
    { key: 'history', label: 'ປະຫວັດເຕີມເງິນ', short: 'ປະຫວັດເຕີມ',   href: 'topup-history.html',
      icon: TB_ICON('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>') },
  ];
  const TB_LOGOUT_ICON = TB_ICON('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>');

  // หน้าปัจจุบัน -> แท็บไหนต้อง active (รองรับทั้ง /topup และ /topup.html)
  function tbCurrentKey() {
    const page = (location.pathname.split('/').pop() || '').replace(/\.html$/i, '').toLowerCase();
    switch (page) {
      case '': case 'index': case 'category': case 'product': return 'shop';
      case 'admin': return 'admin';
      case 'reseller': return 'reseller';
      case 'topup': return 'topup';
      case 'orders': return 'orders';
      case 'topup-history': return 'history';
      default: return null;
    }
  }

  function renderAccountMenu(loginBtn, user) {
    if (user.isReseller) {
      loginBtn.classList.add('is-reseller');
      document.querySelector('header')?.classList.add('is-reseller');
      document.querySelector('.logo')?.classList.add('is-reseller');
    }

    // ---- ปุ่มโปรไฟล์ในหัวเว็บ (รูป + ชื่อ) ----
    loginBtn.classList.add('is-authed');
    loginBtn.innerHTML = '';
    loginBtn.type = 'button';
    loginBtn.setAttribute('aria-haspopup', 'true');
    loginBtn.setAttribute('aria-expanded', 'false');
    loginBtn.setAttribute('aria-controls', 'acctTabbar');
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

    // ---- สร้างแถบไอคอนด้านล่าง ----
    const tabs = TB_TABS.filter((t) => !t.adminOnly || user.isAdmin);
    const currentKey = tbCurrentKey();

    const bar = document.createElement('nav');
    bar.className = 'tabbar';
    bar.id = 'acctTabbar';
    bar.setAttribute('aria-label', 'ເມນູບັນຊີ');
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML =
      '<span class="tabbar-pill"></span>' +
      tabs.map((t, i) =>
        `<a href="${t.href}" class="tabbar-item${t.key === currentKey ? ' active' : ''}" data-key="${t.key}" aria-label="${t.label}" title="${t.label}" style="--i:${i}">${t.icon}<span class="tabbar-label">${t.short || t.label}</span></a>`
      ).join('') +
      `<button type="button" class="tabbar-item danger" id="acctTabLogout" aria-label="ອອກຈາກລະບົບ" title="ອອກຈາກລະບົບ" style="--i:${tabs.length}">${TB_LOGOUT_ICON}<span class="tabbar-label">ອອກ</span></button>`;
    document.body.appendChild(bar);

    // ---- การ์ดโปรไฟล์ที่ไหลลงมาจากปุ่มโปรไฟล์: ยอดเงิน + สถิติ + ทางลัด ----
    const kip = (n) => Number(n || 0).toLocaleString('de-DE');
    const roleText = user.isAdmin ? 'ADMIN' : (user.isReseller ? 'ຕົວແທນ' : 'ຜູ້ໃຊ້');
    const card = document.createElement('div');
    card.className = 'acct-card';
    card.id = 'acctCard';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML =
      '<div class="acct-card-top">' +
        '<div class="acct-ava">' + (user.avatar ? `<img src="${escHtml(user.avatar)}" alt="">` : `<div class="acct-card-ph">${escHtml((user.username || '?').trim().slice(0, 1).toUpperCase())}</div>`) + '</div>' +
        `<div class="acct-card-id"><b>${escHtml(user.username)}</b><span class="acct-role${user.isAdmin ? ' is-admin' : ''}">${roleText}</span></div>` +
      '</div>' +
      '<div class="acct-balance"><span><i class="acct-dot"></i>ຍອດເງິນ</span><b id="acctBal">0 ₭</b></div>' +
      '<div class="acct-stats">' +
        '<div><b id="acctOrders">–</b><span>ຄຳສັ່ງຊື້</span></div>' +
        '<div><b id="acctSpent">–</b><span>ໃຊ້ຈ່າຍແລ້ວ ₭</span></div>' +
      '</div>' +
      '<div class="acct-actions">' +
        '<a href="topup.html" class="acct-btn primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>ເຕີມເງິນ</a>' +
      '</div>';
    document.body.appendChild(card);
    let statsLoaded = false;
    const loadCardStats = async () => {
      if (statsLoaded) return;
      statsLoaded = true;
      try {
        const r = await fetch('/api/account/stats', { cache: 'no-store' });
        if (!r.ok) { statsLoaded = false; return; }
        const st = await r.json();
        card.querySelector('#acctOrders').textContent = st.ordersCompleted ?? 0;
        card.querySelector('#acctSpent').textContent = kip(st.totalSpent);
      } catch (e) { statsLoaded = false; }
    };
    const placeCard = () => {
      const r = loginBtn.getBoundingClientRect();
      const right = Math.max(12, window.innerWidth - r.right);
      card.style.top = (r.bottom + 14) + 'px';
      card.style.right = right + 'px';
      const left = window.innerWidth - right - card.offsetWidth;
      const ax = Math.min(card.offsetWidth - 26, Math.max(26, r.left + r.width / 2 - left));
      card.style.setProperty('--ax', ax + 'px');
      card.style.transformOrigin = ax + 'px 0';
    };
    // ตัวเลขยอดเงินวิ่งขึ้นจาก 0 ทุกครั้งที่เปิดการ์ด
    const balEl = card.querySelector('#acctBal');
    let countRaf = 0;
    const countUp = () => {
      const target = Number(user.balance || 0);
      cancelAnimationFrame(countRaf);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { balEl.textContent = kip(target) + ' ₭'; return; }
      const t0 = performance.now(), dur = 1100;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        balEl.textContent = kip(Math.round(target * (1 - Math.pow(1 - p, 4)))) + ' ₭';
        if (p < 1) countRaf = requestAnimationFrame(step);
      };
      balEl.textContent = '0 ₭';
      countRaf = requestAnimationFrame(step);
    };

    const pill = bar.querySelector('.tabbar-pill');
    const items = [...bar.querySelectorAll('a.tabbar-item')];
    const activeItem = () => items.find((x) => x.classList.contains('active'));
    const isOpen = () => bar.classList.contains('show');

    // เลื่อนแถบสีแดงไปใต้ไอคอนที่เลือก (anim=false = วาร์ปไปเลย ไม่ต้องไหลมา)
    const movePill = (el, anim = true) => {
      if (!el) { pill.style.opacity = 0; return; }
      pill.style.transition = anim ? '' : 'none';
      pill.style.width = el.offsetWidth + 'px';
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.opacity = 1;
      if (!anim) { void pill.offsetWidth; pill.style.transition = ''; }
    };

    let fabTimer = null;
    const closeBar = () => {
      if (!isOpen()) return; // ไม่ได้เปิดอยู่ ก็ไม่ต้องเล่นอนิเมชั่นปิด (เช่นกด Esc ตอนแถบปิดอยู่)
      // อนิเมชั่นปิด (tabbar-close-fx.js): ต้องเรียก "ก่อน" เอา .show ออก เพื่อวัดตำแหน่งแถบตอนยังเปิดเต็ม
      const animating = !!(window.TabbarFX && window.TabbarFX.close(bar, loginBtn));
      bar.classList.remove('show');
      bar.setAttribute('aria-hidden', 'true');
      clearTimeout(fabTimer);
      if (animating) {
        // ปุ่มแชทค่อยลอยลงตอนแถบหายไปแล้ว ไม่ให้ซ้อนกับฉากบีบแถบ
        fabTimer = setTimeout(() => document.body.classList.remove('tabbar-open'), 380);
      } else {
        document.body.classList.remove('tabbar-open');
      }
      loginBtn.setAttribute('aria-expanded', 'false');
      card.classList.remove('show');
      card.setAttribute('aria-hidden', 'true');
    };
    const openBar = () => {
      clearTimeout(fabTimer);
      if (window.TabbarFX) window.TabbarFX.cancel(bar); // เปิดซ้ำระหว่างกำลังปิด -> ยกเลิกฉากปิดทันที
      bar.classList.add('show');
      bar.setAttribute('aria-hidden', 'false');
      document.body.classList.add('tabbar-open');
      loginBtn.setAttribute('aria-expanded', 'true');
      movePill(activeItem(), false);
      placeCard();
      card.classList.add('show');
      setTimeout(countUp, 220);
      card.setAttribute('aria-hidden', 'false');
      loadCardStats();
    };

    loginBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen() ? closeBar() : openBar();
    });

    // กดที่ว่างนอกแถบ -> หุบ (ไม่ใช้ stopPropagation บนแถบ เพราะ page-transition.js
    // ฟังคลิกที่ document เพื่อเล่นแอนิเมชั่นสลับหน้า ถ้าตัดไว้ลิงก์จะไม่เล่นแอนิเมชั่น)
    document.addEventListener('click', (e) => {
      if (!isOpen()) return;
      if (bar.contains(e.target) || card.contains(e.target) || loginBtn.contains(e.target)) return;
      closeBar();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBar(); });
    window.addEventListener('scroll', () => { if (isOpen()) placeCard(); }, { passive: true });
    window.addEventListener('resize', () => { if (isOpen()) { movePill(activeItem(), false); placeCard(); } });

    items.forEach((el) => {
      el.addEventListener('click', (e) => {
        const alreadyHere = el.classList.contains('active');
        if (alreadyHere) {
          // อยู่หน้านี้อยู่แล้ว: ไม่ต้องโหลดซ้ำ (ยกเว้นลิงก์ #categories บนหน้าแรก ให้เลื่อนตามปกติ)
          if (!(el.getAttribute('href') || '').includes('#')) e.preventDefault();
          closeBar();
          return;
        }
        // หน้าอื่น: เลื่อนแถบสีแดงไปหาไอคอน แล้วปล่อยให้ลิงก์ทำงานต่อ
        // (page-transition.js จะเล่นแอนิเมชั่นออก แล้วค่อยเปลี่ยนหน้า)
        items.forEach((x) => x.classList.toggle('active', x === el));
        movePill(el);
      });
    });

    bar.querySelector('#acctTabLogout').addEventListener('click', () => {
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
        // ยอดเงิน (wallet balance): /api/me คืนค่ายอดเงินจริงมาให้อยู่แล้ว (ดึงจาก
        // Supabase ฝั่ง Worker ที่ src/index.js) เดิมโค้ดตรงนี้ไปยิง
        // /api/wallet/balance ซ้ำ ซึ่ง endpoint นั้นไม่มีอยู่จริงในโปรเจกต์เลย
        // (ไม่มี route นี้ใน src/index.js) fetch จึงล้มเหลว/404 เงียบๆ แล้ว fallback
        // เป็น 0 เสมอ ทำให้ยอดเงินในเมนู dropdown ค้างที่ 0 ตลอด ต่อให้แอดมิน
        // อนุมัติการเติมเงินไปแล้วก็ตาม -> ตอนนี้ใช้ค่าจาก data.user.balance ตรงๆ
        const balance = data.user.balance || 0;

        // ---- เช็คสถานะตัวแทนควบคู่ไปด้วย (ไม่บล็อกการเรนเดอร์เมนูบัญชี) ----
        // ใช้ StorefrontData.fetchResellerInfo() ตัวเดียวกับที่ category.js/product.js ใช้
        // เพื่อไม่ยิง request ซ้ำ (มัน cache promise ไว้อยู่แล้ว)
        let isReseller = false;
        try {
          const rsInfo = window.StorefrontData ? await window.StorefrontData.fetchResellerInfo() : null;
          isReseller = !!(rsInfo && rsInfo.isReseller);
        } catch (err) {
          console.error('ດຶງສະຖານະຕົວແທນ (header) ບໍ່ສຳເລັດ', err);
        }

        renderAccountMenu(loginBtn, {
          username: data.user.username,
          avatar: data.user.avatar,
          isAdmin: data.user.isAdmin,
          isReseller,
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
