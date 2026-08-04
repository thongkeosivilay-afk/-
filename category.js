/* =========================================================
   category.js — ໜ້າສະແດງສິນຄ້າຕາມໝວດໝູ່ (category.html)
   ອ່ານ ?cat=pc|android|ios|gear ຈາກ URL ແລ້ວສ້າງກາຕູນສິນຄ້າ
   ສະເພາະໝວດນັ້ນ. ການເຮັດວຽກຂອງກາຕູນ (render ຊື່/ລາຄາ/ສະຕັອກ
   ແລະ ປຸ່ມຊື້) ຍັງໃຊ້ຮ່ວມກັບ script.js ຄືເກົ່າ — ໄຟລ໌ນີ້ມີໜ້າທີ່
   ແຕ່ງໜ້າ (title/desc) ແລະ ສ້າງກາຕູນ .prod-card ໃສ່ grid ເທົ່ານັ້ນ.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('cat') || 'pc';

  // ຂໍ້ມູນຫົວຂໍ້/ຄຳອະທິບາຍ ຂອງແຕ່ລະໝວດ — ຄືກັນກັບ cat-meta ໃນ index.html
  const CATS = {
    pc: {
      title: 'ໂປຣແກຣມຊ່ວຍຫຼິ້ນເທິງຄອມ',
      desc: 'ລວມໂປຣແກຣມເສີມສຳລັບເກມ PC ໃຊ້ງານງ່າຍ ຮອງຮັບຫຼາກຫຼາຍເກມ ພ້ອມອັບເດດສະໝ່ຳສະເໝີ'
    },
    android: {
      title: 'ໂປຣແກຣມຊ່ວຍຫຼິ້ນ ANDROID',
      desc: 'ລວມແອັບ ແລະ ເຄື່ອງມືເສີມສຳລັບເກມມືຖື Android ເພີ່ມຄວາມສະດວກໃນການຫຼິ້ນ'
    },
    ios: {
      title: 'ໂປຣແກຣມຊ່ວຍຫຼິ້ນ IOS',
      desc: 'ລວມແອັບ ແລະ ບໍລິການສຳລັບຜູ້ໃຊ້ iPhone/iPad ພ້ອມເຄື່ອງມືເສີມ'
    },
    gear: {
      title: 'ອຸປະກອນເສີມເກມມິ່ງ',
      desc: 'ຄີບອດ, ເມົາສ໌, ຫູຟັງ ແລະ ອຸປະກອນເສີມເກມມິ່ງຄຸນນະພາບສູງ'
    }
  };

  const meta = CATS[cat] || { title: 'ໝວດໝູ່ສິນຄ້າ', desc: '' };

  const titleEl = document.querySelector('#cat-title');
  const descEl = document.querySelector('#cat-desc');
  if (titleEl) titleEl.textContent = meta.title;
  if (descEl) descEl.textContent = meta.desc;
  document.title = `${meta.title} — 𝐃𝐄𝐊 𝐌𝐀𝐒𝐇 𝐒𝐇𝐎𝐏`;

  const grid = document.querySelector('#prod-grid');
  const emptyEl = document.querySelector('#empty-state');
  const searchBox = document.querySelector('.search-box');
  if (!grid || !window.StoreData) return;

  const data = StoreData.load();
  const products = data.products.filter((p) => p.category === cat);

  if (!products.length) {
    if (emptyEl) emptyEl.style.display = 'flex';
    if (searchBox) searchBox.style.display = 'none';
    return;
  }

  function cardHTML(p) {
    return `
      <article class="prod-card grid-card" data-pid="${p.id}">
        <div class="prod-media">
          <span class="hud-corner tl"></span><span class="hud-corner br"></span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5-9 9"/>
          </svg>
          <span class="sold-badge">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>
            ຂາຍແລ້ວ 0
          </span>
        </div>
        <div class="prod-body">
          <div class="prod-name todo">ໃສ່ຊື່ສິນຄ້າ</div>
          <div class="prod-price todo">₭ 0</div>
          <div class="prod-status out"><span class="dot"></span>ບໍ່ພ້ອມຂາຍ</div>
          <button type="button" class="buy-btn" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6h15l-1.5 9h-12L6 6Z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>
            ຊື້ເລີຍ
          </button>
        </div>
      </article>`;
  }

  grid.innerHTML = products.map(cardHTML).join('');
  // script.js's own DOMContentLoaded listener (registered after this one)
  // will pick up these .prod-card[data-pid] elements and fill in the real
  // name/price/stock + wire up the buy button, same as it does on index.html.

  // Search-as-you-type filter, scoped to this category's grid only.
  const searchInput = document.querySelector('#search-input');
  if (searchInput) {
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
        emptyEl.style.display = visibleCount === 0 ? 'flex' : 'none';
        emptyEl.querySelector('p').innerHTML = 'ບໍ່ພົບສິນຄ້າທີ່ຄົ້ນຫາ<br>ລອງຄຳອື່ນ';
      }
    });
  }
});
