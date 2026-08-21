/* =========================================================
   storefront.js — ໜ້າຫຼັກ (index.html)
   ດຶງຂໍ້ມູນຈິງຈາກ StorefrontData (GET /api/public/storefront) ແລ້ວ:
     1) ສ້າງກາຕູນ 4 ໝວດໝູ່ (#cat-stack) ຈາກຊື່/ຮູບຈິງທີ່ແອດມິນຕັ້ງໄວ້
        (ຖ້າຍັງບໍ່ຕັ້ງຊື່/ຮູບ ຈະໂຊວ໌ຄ່າເລີ່ມຕົ້ນ/placeholder ຄືເກົ່າ)
     2) ອັບເດດສະຖິຕິ "ສິນຄ້າ" ແລະ "ຄັງສິນຄ້າ" ໃຫ້ເປັນຕົວເລກຈິງ
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const stack = document.querySelector('#cat-stack');
  if (!stack || !window.StorefrontData) return;

  // ອົງປະກອບຕົກແຕ່ງປະຈຳແຕ່ລະຊ່ອງໝວດໝູ່ (1-4) — ບໍ່ໄດ້ຢູ່ໃນຖານຂໍ້ມູນ (ບໍ່ມີຄອລັມສຳລັບໄອຄອນ/ຄຳໂຄສະນາ)
  // ຈຶ່ງໃຊ້ຊຸດເລີ່ມຕົ້ນເກົ່າຄືເດີມ (ຕົງກັບ 4 ໝວດ PC/Android/iOS/Gear ຂອງຮ້ານນີ້) ສ່ວນຊື່/ຄຳອະທິບາຍ/
  // ຮູບແມ່ນອັນທີ່ດຶງມາຈິງ (ຊື່ ແລະ ຮູບ ດຶງຈິງ, ຄຳອະທິບາຍໃຊ້ຄ່າເລີ່ມຕົ້ນ ເພາະບໍ່ມີໃນຖານຂໍ້ມູນ)
  const SLOT_DECOR = {
    1: {
      tagIcon: '<rect x="6" y="2" width="12" height="20" rx="2.2"/><circle cx="12" cy="5" r=".6" fill="currentColor" stroke="none"/><path d="M10 19h4"/>',
      tagText: 'ໂປຣແກຣມຊ່ວຍຫຼິ້ນເທິງ PC',
      bigTitle: '',
      desc: '',
    },
    2: {
      tagIcon: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 18h6"/>',
      tagText: 'ໂປຣແກຣມຊ່ວຍຫຼິ້ນເທິງມືຖື',
      bigTitle: '',
      desc: '',
    },
    3: {
      tagIcon: '<path d="M9 4c.5-1 1.5-1 2 0M11 4c.5-1 1.5-1 2 0M13 4c.5-1 1.5-1 2 0"/><circle cx="13" cy="7" r="2.3"/><path d="M15.2 7.3l2 .4-1.6 1.3z"/><path d="M12.6 9.2v1.2"/><path d="M6 20c-.6-3.2.6-6.4 3-8.2 1.6-1.2 3.6-1.8 5.6-1.4 2.6.5 4.6 2.7 4.9 5.4"/><path d="M6 20h12"/><path d="M17.8 13.4c2-.4 3.6-1.8 4.4-3.6"/><path d="M9.5 20l-.6 2.4M9.5 20l1 2M14 20l-.6 2.4M14 20l1 2"/>',
      tagText: 'ໂປຣແກຣມຊ່ວຍຫຼິ້ນເທິງມືຖື',
      bigTitle: '',
      desc: '',
    },
    4: {
      tagIcon: '<path d="M4 15a8 8 0 0 1 16 0"/><rect x="2" y="15" width="5" height="6" rx="1.5"/><rect x="17" y="15" width="5" height="6" rx="1.5"/>',
      tagText: 'ອຸປະກອນເສີມເກມມິ່ງ',
      bigTitle: '',
      desc: '',
    },
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function categoryCardHTML(category, productCount, stockCount) {
    const decor = SLOT_DECOR[category.index] || {
      tagIcon: '<path d="M20 7L12 3 4 7l8 4 8-4Z"/><path d="M4 7v10l8 4 8-4V7"/>',
      tagText: 'ໝວດໝູ່ສິນຄ້າ',
      bigTitle: `CAT${category.index}`,
      desc: '',
    };
    // ໃຊ້ຫົວຂໍ້ ທີ່ແອດມິນຕັ້ງເອງ (category_{i}_title) ຖ້າມີ — ຖ້າຍັງບໍ່ໄດ້ຕັ້ງ ໃຫ້ໃຊ້ຄ່າ
    // ເລີ່ມຕົ້ນເກົ່າຈາກ SLOT_DECOR ຄືເດີມ (ຄຳອະທິບາຍ/ປ້າຍນ້ອຍ ບໍ່ໄດ້ໃຊ້ແລ້ວ, ເອົາອອກ
    // ຈາກກາຕູນຕາມການຮ້ອງຂໍ)
    const bigTitle = (category.title && String(category.title).trim()) || decor.bigTitle;

    const mediaHTML = category.image
      ? `<img src="${escapeHtml(category.image)}" alt="${escapeHtml(category.name)}">`
      : `
        <div class="cat-img-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-9 9"/></svg>
          <span>ໃສ່ຮູບພາບໝວດໝູ່ນີ້<br>ຂະໜາດ 1600×560px (ອັດຕາສ່ວນ 2.86:1)</span>
        </div>`;

    // ໝາຍເຫດ v3: ຕາມການຮ້ອງຂໍ, ເອົາແຖບປ້າຍນ້ອຍ (icon+tagText, ".cat-tag-row") ອອກ
    // ຈາກເທິງຫົວຂໍ້ໃຫຍ່, ແລະ ເອົາຄຳອະທິບາຍ (".cat-meta-desc") ອອກຈາກສ່ວນລຸ່ມ —
    // ດຽວນີ້ສ່ວນລຸ່ມເຫຼືອແຕ່ຊື່ໝວດໝູ່ + ຈຳນວນ/ຄົງເຫຼືອ ຊິດກັນ (ເບິ່ງ .cat-meta-name
    // margin-bottom ແລະ .cat-meta-count margin-top ໃນ style.css)
    return `
      <a class="cat-item" href="category.html?cat=${category.index}">
        <div class="cat-banner">
          <div class="cat-banner-bg"></div>
          <div class="cat-banner-media${category.image ? ' has-image' : ''}">${mediaHTML}</div>
          <div class="cat-glare"></div>
          <div class="cat-banner-content">
            <div class="cat-big-title display-en en">${escapeHtml(bigTitle)}</div>
          </div>
          <div class="cat-click"><span class="dot"></span>Click Here!</div>
        </div>
        <div class="cat-meta">
          <div class="cat-meta-text">
            <div class="cat-meta-name">${escapeHtml(category.name)}</div>
            <div class="cat-meta-count">${productCount.toLocaleString('en-US')} ລາຍການ • ຄົງເຫຼືອ ${stockCount.toLocaleString('en-US')} ຊິ້ນ</div>
          </div>
          <div class="cat-meta-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
        </div>
      </a>`;
  }

  // ແຖບແສງນຸ້ມໆທີ່ຕິດຕາມເມົາສ໌ເທິງກາຕູນ (.cat-glare) — ໃຊ້ delegation ຢູ່ນອກ
  // renderCategories() ຄັ້ງດຽວ ເພາະ innerHTML ຖືກສ້າງໃໝ່ທຸກຄັ້ງທີ່ fetch ຂໍ້ມູນ
  // (ຖ້າຜູກໃສ່ກາຕູນເລີຍ, ຈະຫາຍໄປພ້ອມກັບ innerHTML ເກົ່າ). ບໍ່ມີຜົນຫຍັງເທິງມືຖື —
  // CSS ເປີດ .cat-glare ສະເພາະ @media (hover:hover) and (pointer:fine) ຢູ່ແລ້ວ
  stack.addEventListener('pointermove', (e) => {
    const item = e.target.closest('.cat-item');
    if (!item) return;
    const rect = item.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    item.style.setProperty('--mx', x + '%');
    item.style.setProperty('--my', y + '%');
  });

  function renderCategories(data) {
    stack.innerHTML = data.categories.map((category) => {
      const products = window.StorefrontData.productsByCategoryName(data, category.name);
      const productCount = products.length;
      const stockCount = products.reduce((sum, p) => sum + window.StorefrontData.productTotalStock(p), 0);
      return categoryCardHTML(category, productCount, stockCount);
    }).join('');

    // ອານິເມຊັນ "ຄ່ອຍໆເຫັນ" ຕອນເລື່ອນລົງມາ (ຄືເກົ່າ ໃນ script.js) — ຕ້ອງຕິດຕັ້ງໃໝ່ ເພາະ
    // script.js ໄດ້ observe ໄປແລ້ວກ່ອນກາຕູນເຫຼົ່ານີ້ຈະຖືກສ້າງ (ດຶງຂໍ້ມູນແບບ async)
    const catItems = stack.querySelectorAll('.cat-item');
    if (catItems.length && 'IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('cat-in-view');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
      catItems.forEach((item) => revealObserver.observe(item));
    } else {
      catItems.forEach((item) => item.classList.add('cat-in-view'));
    }
  }

  // ນັບຕົວເລກແບບ "ໄຕ່ຂຶ້ນ" 0 -> ຄ່າຈິງ (ໃຊ້ requestAnimationFrame + easing ໃຫ້ນຸ້ມນວນ,
  // ຄວາມໄວປັບຕາມຂະໜາດຕົວເລກເລັກນ້ອຍ ແຕ່ບໍ່ໃຫ້ໄວເກີນໄປ ຕາມທີ່ຂໍໄວ້ "ບໍ່ຕ້ອງໄວຫຼາຍ")
  function animateCount(el, target, { duration = 1400, delay = 0 } = {}) {
    if (!el || !el.firstChild) return;
    const textNode = el.firstChild;
    const endVal = Math.max(0, Math.round(Number(target) || 0));
    if (endVal === 0) {
      textNode.textContent = '0';
      return;
    }
    const start = performance.now() + delay;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    function tick(now) {
      const elapsed = now - start;
      if (elapsed < 0) {
        requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(endVal * easeOutCubic(progress));
      textNode.textContent = current.toLocaleString('en-US');
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        textNode.textContent = endVal.toLocaleString('en-US');
      }
    }
    requestAnimationFrame(tick);
  }

  function updateStats(data) {
    const statCards = document.querySelectorAll('.stat-card');
    // ລຳດັບກາຕູນສະຖິຕິໃນ index.html: [0] ຜູ້ໃຊ້ງານ, [1] ສິນຄ້າ, [2] ຄັງສິນຄ້າ, [3] ຂາຍແລ້ວ
    const userStatValue = statCards[0]?.querySelector('.stat-value');
    const productStatValue = statCards[1]?.querySelector('.stat-value');
    const stockStatValue = statCards[2]?.querySelector('.stat-value');
    const soldStatValue = statCards[3]?.querySelector('.stat-value');

    // ນັບໄຕ່ຂຶ້ນທັງ 4 ກາຕູນພ້ອມກັນ (delay ໄລຍະສັ້ນໆລະຫວ່າງແຕ່ລະກາຕູນ ໃຫ້ເບິ່ງເປັນຈັງຫວະ)
    animateCount(userStatValue, data.stats.userCount || 0, { delay: 0 });
    animateCount(productStatValue, data.stats.productCount || 0, { delay: 80 });
    animateCount(stockStatValue, data.stats.totalStock || 0, { delay: 160 });
    animateCount(soldStatValue, data.stats.totalSold || 0, { delay: 240 });
  }

  // ກ່ອງ "ພື້ນທີ່ໃສ່ຮູບໂປຣໂມຊັ່ນ" — ຖ້າແອດມິນອັບໂຫລດຮູບ Hero ໄວ້ (store.heroImage) ໃຫ້ໂຊວ໌ຮູບນັ້ນແທນ placeholder
  function renderHeroPromo(data) {
    const promoEl = document.querySelector('.promo');
    if (!promoEl) return;
    const heroImage = data && data.store && data.store.heroImage;
    if (!heroImage) return; // ຍັງບໍ່ໄດ້ໃສ່ຮູບ -> ປ່ອຍ placeholder ເດີມໄວ້
    promoEl.classList.add('has-image');
    promoEl.innerHTML = `<img src="${escapeHtml(heroImage)}" alt="ໂປຣໂມຊັ່ນ">`;
  }

  window.StorefrontData.fetchData()
    .then((data) => {
      const { name } = window.StorefrontData.applyStoreBranding(data.store);
      document.title = `${name} — ຮ້ານເກມອອນລາຍ`;
      renderCategories(data);
      updateStats(data);
      renderHeroPromo(data);
    })
    .catch(() => {
      // ດຶງຂໍ້ມູນບໍ່ສຳເລັດ (ເຊັ່ນ Worker ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Supabase secret) — ປ່ອຍ markup ຄ່າເລີ່ມຕົ້ນ
      // ໄວ້ຄືເກົ່າ ບໍ່ໃຫ້ໜ້າເວັບພັງ, ພຽງແຕ່ຈະບໍ່ມີກາຕູນໝວດໝູ່/ສະຖິຕິຈິງໂຊວ໌
      stack.innerHTML = '<div class="empty-note">ດຶງຂໍ້ມູນໝວດໝູ່ບໍ່ສຳເລັດ, ກະລຸນາໂຫຼດໜ້ານີ້ໃໝ່ພາຍຫຼັງ</div>';
    });
});
