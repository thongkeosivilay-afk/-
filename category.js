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

  // ຄຳອະທິບາຍປະຈຳຊ່ອງ (ບໍ່ມີໃນຖານຂໍ້ມູນ ໃຊ້ຄ່າເລີ່ມຕົ້ນ) — ຊື່ຫົວຂໍ້ຈິງໆດຶງມາຈາກ API ຂ້າງລຸ່ມ
  const SLOT_DESC = {
    1: 'ລວມໂປຣແກຣມເສີມສຳລັບເກມ PC ໃຊ້ງານງ່າຍ ຮອງຮັບຫຼາກຫຼາຍເກມ ພ້ອມອັບເດດສະໝ່ຳສະເໝີ',
    2: 'ລວມແອັບ ແລະ ເຄື່ອງມືເສີມສຳລັບເກມມືຖື Android ເພີ່ມຄວາມສະດວກໃນການຫຼິ້ນ',
    3: 'ລວມແອັບ ແລະ ບໍລິການສຳລັບຜູ້ໃຊ້ iPhone/iPad ພ້ອມເຄື່ອງມືເສີມ',
    4: 'ຄີບອດ, ເມົາສ໌, ຫູຟັງ ແລະ ອຸປະກອນເສີມເກມມິ່ງຄຸນນະພາບສູງ',
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function showEmpty(message) {
    if (grid) grid.innerHTML = '';
    if (searchBox) searchBox.style.display = 'none';
    if (emptyEl) {
      emptyEl.style.display = 'flex';
      const p = emptyEl.querySelector('p');
      if (p && message) p.innerHTML = message;
    }
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

  function statusHTML(product, stock) {
    if (product.paused) {
      const note = product.paused_note ? ` — ${escapeHtml(product.paused_note)}` : '';
      return `<div class="prod-status out"><span class="dot"></span>ຢຸດຂາຍຊົ່ວຄາວ${note}</div>`;
    }
    if (stock > 0) {
      return `<div class="prod-status"><span class="dot"></span>ພ້ອມຂາຍ <span class="stock">(ເຫຼືອ ${stock.toLocaleString('en-US')})</span></div>`;
    }
    return `<div class="prod-status out"><span class="dot"></span>ບໍ່ພ້ອມຂາຍ</div>`;
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
    return `
      <article class="prod-card grid-card" data-pid="${escapeHtml(product.id)}">
        <div class="prod-media">
          <span class="hud-corner tl"></span><span class="hud-corner br"></span>
          ${mediaHTML(product)}
        </div>
        <div class="prod-body">
          <div class="prod-name">${escapeHtml(product.name || 'ໃສ່ຊື່ສິນຄ້າ')}</div>
          ${priceHTML(product)}
          ${statusHTML(product, stock)}
          <button type="button" class="buy-btn" ${buyable ? '' : 'disabled'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6h15l-1.5 9h-12L6 6Z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>
            ຊື້ເລີຍ
          </button>
        </div>
      </article>`;
  }

  // ໂໝດ demo/ຍັງບໍ່ມີລະບົບສັ່ງຊື້ຈິງ: ບອກລູກຄ້າຢ່າງຊັດເຈນແທນການສະແດງລະຫັດປອມໆ
  // (ສະຕັອກ/ລາຄາ/ຂໍ້ມູນສິນຄ້າແມ່ນຈິງ 100% ແລ້ວ, ເຫຼືອພຽງຂັ້ນຕອນຊຳລະເງິນ/ອອກລະຫັດ
  // ທີ່ຍັງຕ້ອງເຮັດຕ່າງຫາກຝັ່ງ backend ກ່ອນຈຶ່ງຈະເປີດໃຫ້ກົດຊື້ໄດ້ຈິງ)
  function wireBuyButtons() {
    grid.querySelectorAll('.prod-card[data-pid] .buy-btn:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        alert('ຂອບໃຈທີ່ສົນໃຈ! ລະບົບສັ່ງຊື້ອັດຕະໂນມັດຍັງບໍ່ເປີດໃຫ້ນຳໃຊ້ຢູ່ຕອນນີ້ — ກະລຸນາຕິດຕໍ່ແອດມິນຜ່ານປຸ່ມແຊັດເພື່ອສັ່ງຊື້.');
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

      if (titleEl) titleEl.textContent = category.name;
      if (descEl) descEl.textContent = SLOT_DESC[catIndex] || '';
      document.title = `${category.name} — 𝐃𝐄𝐊 𝐌𝐀𝐒𝐇 𝐒𝐇𝐎𝐏`;

      const products = window.StorefrontData.productsByCategoryName(data, category.name);

      if (!products.length) {
        showEmpty('ຍັງບໍ່ມີສິນຄ້າໃນໝວດນີ້<br>ກະລຸນາກັບມາເບິ່ງພາຍຫຼັງ');
        return;
      }

      grid.innerHTML = products.map(cardHTML).join('');
      if (emptyEl) emptyEl.style.display = 'none';
      if (searchBox) searchBox.style.display = '';

      wireBuyButtons();
      wireSearch(products);
    })
    .catch(() => {
      if (titleEl) titleEl.textContent = 'ໝວດໝູ່ສິນຄ້າ';
      showEmpty('ດຶງຂໍ້ມູນສິນຄ້າບໍ່ສຳເລັດ<br>ກະລຸນາໂຫຼດໜ້ານີ້ໃໝ່ພາຍຫຼັງ');
    });
});
