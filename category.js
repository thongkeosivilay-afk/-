/* =========================================================
   category.js — ໜ້າສະແດງສິນຄ້າຕາມໝວດໝູ່ (category.html)
   ອ່ານ ?cat=1..4 ຈາກ URL (ເລກຊ່ອງໝວດໝູ່ ຄືກັນກັບ category_1..4_name
   ໃນການຕັ້ງຄ່າຮ້ານ) ແລ້ວດຶງສິນຄ້າຈິງຂອງໝວດນັ້ນຈາກ /api/public/storefront
   (ຊື່/ລາຄາ/ສະຕັອກ/ຮູບ ຈິງ 100% — ບໍ່ໃຊ້ລະບົບ demo localStorage ອີກຕໍ່ໄປ)
   ໄຟລ໌ນີ້ຄຸມທັງການສ້າງກາຕູນ ແລະ ການເຮັດວຽກ (ຄົ້ນຫາ/ປຸ່ມຊື້) ດ້ວຍຕົນເອງທັງໝົດ
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const catIndex = Number(params.get('cat')) || 1;

  const titleEl = document.querySelector('#cat-title');
  const descEl = document.querySelector('#cat-desc');
  const grid = document.querySelector('#prod-grid');
  const emptyEl = document.querySelector('#empty-state');
  const searchBox = document.querySelector('.search-box');
  const searchInput = document.querySelector('#search-input');

  if (!grid || !window.StorefrontData) return;

  // ຄຳອະທິບາຍປະຈຳຊ່ອງ (ຄ່າສຳຮອງ) — ໃຊ້ພຽງຖ້າແອດມິນຍັງບໍ່ໄດ້ຕັ້ງຄ່າ category_{i}_desc ເອງ
  const SLOT_DESC = {
    1: '',
    2: '',
    3: '',
    4: '',
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function showEmpty(message) {
    // ໝາຍເຫດ: ບໍ່ເຊື່ອງ .search-box ອີກຕໍ່ໄປ (ບໍ່ວ່າຈະໂຫຼດຍັງບໍ່ສຳເລັດ ຫຼື ໝວດນີ້
    // ຍັງບໍ່ມີສິນຄ້າ) — ໃຫ້ box + icon ຄົ້ນຫາຄົງຢູ່ໜ້າຈໍສະເໝີ ບໍ່ຫາຍ/ບໍ່ກະພິບ
    if (grid) grid.innerHTML = '';
    if (emptyEl) {
      emptyEl.style.display = 'flex';
      const p = emptyEl.querySelector('p');
      if (p && message) p.innerHTML = message;
    }
  }

  // ໄອຄອນທີ່ໃຊ້ໃນອນິເມຊັນ 2 ສະຖານະ: "ຢຸດຂາຍຊົ່ວຄາວ" (ແອດມິນປິດເອງ) ແລະ "ສິນຄ້າໝົດ" (ໝົດແທ້)
  const GEAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.5a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 17.85a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H2.5a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.15 6.99a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H8.6a1.7 1.7 0 0 0 1.04-1.56V.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V6.6a1.7 1.7 0 0 0 1.56 1.04h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z"/></svg>`;
  const WRENCH_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2Z"/></svg>`;
  const BOX_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8L12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>`;
  const CART_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;

  // ສະຖານະຂອງສິນຄ້າ: 'ok' ພ້ອມຂາຍ, 'paused' ແອດມິນປິດຂາຍເອງ, 'soldout' ສິນຄ້າໝົດແທ້ໆ
  function stockState(product, stock) {
    if (product.paused) return 'paused';
    if (!(stock > 0)) return 'soldout';
    return 'ok';
  }

  function mediaHTML(product) {
    if (product.image_url) {
      return `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" class="prod-img">`;
    }
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-9 9"/>
      </svg>`;
  }

  // stable pseudo-random 0..-2.5s delay per product id, so cards in the same
  // grid don't all pulse/rotate in perfect unison
  function fxDelay(id) {
    const str = String(id || '');
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return -(h % 250) / 100; // 0 .. -2.5s
  }

  // ອນິເມຊັນທັບຢູ່ໃນຮູບສິນຄ້າ: ຟັນເຟືອງ+ປະແຈ (ຢຸດຂາຍຊົ່ວຄາວ) ຫຼື ລົດເຂັນ+ກ່ອງຕົກ (ສິນຄ້າໝົດ)
  function stockFxHTML(state, id) {
    const d = fxDelay(id);
    if (state === 'paused') {
      return `
        <div class="stock-fx">
          <div class="fix-glow" style="animation-delay:${d}s;"></div>
          <div class="fix-icons">
            <div class="gear-icon" style="animation-delay:${d}s;">${GEAR_SVG}</div>
            <div class="wrench-icon" style="animation-delay:${d}s;">${WRENCH_SVG}</div>
          </div>
        </div>`;
    }
    if (state === 'soldout') {
      return `
        <div class="stock-fx">
          <div class="cart-floor"></div>
          <div class="drop-item" style="animation-delay:${d}s;">${BOX_SVG}</div>
          <div class="cart-icon" style="animation-delay:${d}s;">${CART_SVG}</div>
        </div>`;
    }
    return '';
  }

  function outBadgeHTML(state) {
    if (state === 'paused') return `<div class="out-badge">ຢຸດຂາຍ</div>`;
    if (state === 'soldout') return `<div class="out-badge">ໝົດແລ້ວ</div>`;
    return '';
  }

  function waitingNoteHTML(state) {
    if (state === 'paused') return `<div class="waiting-note">ກຳລັງປັບປຸງ</div>`;
    if (state === 'soldout') return `<div class="waiting-note">ລໍຖ້າສະຕ໋ອກ</div>`;
    return '';
  }

  function statusHTML(product, stock, state) {
    if (state === 'paused') {
      const note = product.paused_note ? ` — ${escapeHtml(product.paused_note)}` : '';
      return `<div class="prod-status out"><span class="dot"></span>ຢຸດຂາຍຊົ່ວຄາວ${note}</div>`;
    }
    if (state === 'soldout') {
      return `<div class="prod-status out"><span class="dot"></span>ສິນຄ້າໝົດ</div>`;
    }
    return `<div class="prod-status"><span class="dot"></span>ພ້ອມຂາຍ <span class="stock">(ເຫຼືອ ${stock.toLocaleString('en-US')})</span></div>`;
  }

  function buyLabel(state) {
    if (state === 'paused') return 'ຢຸດຂາຍຊົ່ວຄາວ';
    if (state === 'soldout') return 'ສິນຄ້າໝົດ';
    return 'ຊື້ເລີຍ';
  }

  function priceHTML(product) {
    const price = window.StorefrontData.productDisplayPrice(product);
    if (price === null) return `<div class="prod-price todo">₭ 0</div>`;
    const prefix = product.duration_enabled ? 'ເລີ່ມຕົ້ນ ' : '';
    return `<div class="prod-price">${prefix}${window.StorefrontData.formatKip(price)}</div>`;
  }

  function cardHTML(product) {
    const stock = window.StorefrontData.productTotalStock(product);
    const buyable = window.StorefrontData.isProductBuyable(product);
    const state = stockState(product, stock);
    const mediaClass = state === 'ok' ? 'prod-media' : `prod-media is-${state}`;
    return `
      <article class="prod-card grid-card" data-pid="${escapeHtml(product.id)}">
        ${outBadgeHTML(state)}
        <div class="${mediaClass}">
          <span class="hud-corner tl"></span><span class="hud-corner br"></span>
          ${mediaHTML(product)}
          ${stockFxHTML(state, product.id)}
        </div>
        <div class="prod-body">
          <div class="prod-name">${escapeHtml(product.name || 'ໃສ່ຊື່ສິນຄ້າ')}</div>
          ${priceHTML(product)}
          ${statusHTML(product, stock, state)}
          ${waitingNoteHTML(state)}
          <button type="button" class="buy-btn" ${buyable ? '' : 'disabled'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            ${buyLabel(state)}
          </button>
        </div>
      </article>`;
  }

  // ກົດ "ຊື້ເລີຍ" -> ໄປໜ້າ product.html ເພື່ອເລືອກໄລຍະເວລາ/ຈຳນວນ ແລະ ຢືນຢັນສັ່ງຊື້ຢູ່ນັ້ນ
  // (ການສັ່ງຊື້ຈິງ + POST /api/orders/create ຄຸມຢູ່ product.js ແທນ)
  function wireBuyButtons(products) {
    grid.querySelectorAll('.prod-card[data-pid] .buy-btn:not([disabled])').forEach((btn) => {
      const card = btn.closest('.prod-card[data-pid]');
      const pid = card ? card.dataset.pid : null;
      btn.addEventListener('click', () => {
        window.location.href = `product.html?pid=${encodeURIComponent(pid)}&cat=${encodeURIComponent(catIndex)}`;
      });
    });
  }

  function wireSearch(allProducts) {
    if (!searchInput) return;
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;
      grid.querySelectorAll('.prod-card').forEach((card) => {
        const name = card.querySelector('.prod-name')?.textContent.toLowerCase() || '';
        const match = name.includes(q);
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      if (emptyEl) {
        if (visibleCount === 0 && allProducts.length > 0) {
          emptyEl.style.display = 'flex';
          const p = emptyEl.querySelector('p');
          if (p) p.innerHTML = 'ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ<br>ລອງຄຳອື່ນ';
        } else {
          emptyEl.style.display = 'none';
        }
      }
    });
  }

  window.StorefrontData.fetchData()
    .then((data) => {
      const category = window.StorefrontData.categoryByIndex(data, catIndex)
        || { index: catIndex, name: `ໝວດໝູ່ ${catIndex}` };

      const { name } = window.StorefrontData.applyStoreBranding(data.store);
      if (titleEl) { titleEl.textContent = category.name; titleEl.classList.remove('is-loading'); }
      if (descEl) {
        descEl.textContent = (category.desc && String(category.desc).trim()) || SLOT_DESC[catIndex] || '';
        descEl.classList.remove('is-loading');
      }
      document.title = `${category.name} — ${name}`;

      const products = window.StorefrontData.productsByCategoryName(data, category.name);

      if (!products.length) {
        showEmpty('ຍັງບໍ່ມີສິນຄ້າໃນໝວດນີ້<br>ກະລຸນາກັບມາເບິ່ງພາຍຫຼັງ');
        return;
      }

      grid.innerHTML = products.map(cardHTML).join('');
      if (emptyEl) emptyEl.style.display = 'none';

      wireBuyButtons(products);
      wireSearch(products);
    })
    .catch(() => {
      if (titleEl) { titleEl.textContent = 'ໝວດໝູ່ສິນຄ້າ'; titleEl.classList.remove('is-loading'); }
      if (descEl) descEl.classList.remove('is-loading');
      showEmpty('ດຶງຂໍ້ມູນສິນຄ້າບໍ່ສຳເລັດ<br>ກະລຸນາໂຫຼດໜ້ານີ້ໃໝ່ພາຍຫຼັງ');
    });
});
