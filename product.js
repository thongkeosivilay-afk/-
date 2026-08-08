/* =========================================================
   product.js — ໜ້າລາຍລະອຽດ/ຢືນຢັນສັ່ງຊື້ສິນຄ້າ (product.html)
   ອ່ານ ?pid= ຈາກ URL, ດຶງສິນຄ້ານັ້ນຈາກ /api/public/storefront (ຂໍ້ມູນຈິງ),
   ໃຫ້ເລືອກໄລຍະເວລາ (ຖ້າມີ) + ຈຳນວນ ແລ້ວກົດ "ຊື້ເລີຍ" -> ຮຽກ /api/orders/create
   ຄັ້ງລະ 1 ຫົວ (ຊ້ຳຕາມຈຳນວນ) ຄືກັນກັບທີ່ category.js ເຄີຍເຮັດ
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const pid = params.get('pid');

  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const errorMsg = document.getElementById('errorMsg');
  const prodContent = document.getElementById('prodContent');
  const backLink = document.getElementById('backLink');

  const prodImg = document.getElementById('prodImg');
  const prodImgPlaceholder = document.getElementById('prodImgPlaceholder');
  const prodTitle = document.getElementById('prodTitle');
  const badgeRow = document.getElementById('badgeRow');

  const optionsSection = document.getElementById('optionsSection');
  const optList = document.getElementById('optList');
  const optCount = document.getElementById('optCount');
  const selectedLabel = document.getElementById('selectedLabel');

  const priceValue = document.getElementById('priceValue');
  const totalValue = document.getElementById('totalValue');
  const qtyValue = document.getElementById('qtyValue');
  const qtyMinus = document.getElementById('qtyMinus');
  const qtyPlus = document.getElementById('qtyPlus');
  const stockNote = document.getElementById('stockNote');
  const buyBtn = document.getElementById('buyBtn');
  const buyBtnText = document.getElementById('buyBtnText');

  if (!window.StorefrontData || !pid) {
    showError('ບໍ່ພົບສິນຄ້ານີ້ (ລິ້ງບໍ່ຖືກຕ້ອງ)');
    return;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function showError(message) {
    loadingState.style.display = 'none';
    prodContent.style.display = 'none';
    errorState.style.display = 'block';
    errorMsg.textContent = message;
  }

  let product = null;
  let durations = [];       // ລາຍການໄລຍະເວລາ (ຫຼືລາຍການດຽວ ຖ້າສິນຄ້າບໍ່ມີໄລຍະເວລາ)
  let selectedIndex = 0;
  let qty = 1;

  function formatKip(n) { return window.StorefrontData.formatKip(n); }

  function currentDuration() { return durations[selectedIndex] || null; }

  function renderBadges() {
    const stock = currentDuration() ? currentDuration().stock : 0;
    const parts = [];
    parts.push(`<span class="badge"><span class="dot"></span>ໝວດ: ${escapeHtml(product.category || '')}</span>`);
    if (product.paused) {
      parts.push(`<span class="badge out"><span class="dot"></span>ຢຸດຂາຍຊົ່ວຄາວ${product.paused_note ? ' — ' + escapeHtml(product.paused_note) : ''}</span>`);
    } else if (stock > 0) {
      parts.push(`<span class="badge ready"><span class="dot"></span>ພ້ອມສົ່ງ</span>`);
    } else {
      parts.push(`<span class="badge out"><span class="dot"></span>ບໍ່ພ້ອມຂາຍ</span>`);
    }
    badgeRow.innerHTML = parts.join('');
  }

  function renderOptions() {
    if (!product.duration_enabled) {
      optionsSection.style.display = 'none';
      return;
    }
    optionsSection.style.display = 'block';
    optCount.textContent = durations.length;
    optList.innerHTML = durations.map((d, i) => `
      <button type="button" class="opt-card ${i === selectedIndex ? 'selected' : ''}" data-i="${i}">
        <span class="opt-name-wrap">
          <span class="opt-name-line">
            <span class="opt-name">${escapeHtml(product.name)} ${escapeHtml(d.label)}</span>
            <span class="opt-check">
              <svg viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </span>
          <span class="opt-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M3 7 12 3l9 4"/></svg>
            ສິນຄ້າດິຈິທັນ • ເຫຼືອ ${d.stock}
          </span>
        </span>
        <span class="opt-price">${formatKip(d.price)}</span>
      </button>
    `).join('');

    optList.querySelectorAll('.opt-card').forEach((el) => {
      el.addEventListener('click', () => {
        selectedIndex = Number(el.dataset.i);
        qty = 1;
        renderOptions();
        renderBadges();
        renderSummary();
      });
    });
  }

  function renderSummary() {
    const d = currentDuration();
    const price = d ? d.price : 0;
    const stock = d ? d.stock : 0;

    selectedLabel.textContent = d && product.duration_enabled ? d.label : '';
    priceValue.textContent = formatKip(price);
    totalValue.textContent = formatKip(price * qty);
    qtyValue.textContent = qty;

    const buyable = !product.paused && stock > 0;
    if (!buyable) {
      stockNote.textContent = product.paused ? 'ສິນຄ້ານີ້ຢຸດຂາຍຊົ່ວຄາວ' : 'ສິນຄ້ານີ້ໝົດສະຕັອກ';
    } else {
      stockNote.textContent = `ຄົງເຫຼືອ ${stock} ອັນ ໃນຕົວເລືອກນີ້`;
    }

    qtyMinus.disabled = qty <= 1;
    qtyPlus.disabled = !buyable || qty >= stock;
    buyBtn.disabled = !buyable;
  }

  qtyMinus.addEventListener('click', () => { if (qty > 1) { qty--; renderSummary(); } });
  qtyPlus.addEventListener('click', () => {
    const d = currentDuration();
    if (d && qty < d.stock) { qty++; renderSummary(); }
  });

  async function purchaseOne() {
    const d = currentDuration();
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: product.id,
        durationId: product.duration_enabled ? d.id : null,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || data.requireLogin) {
      window.location.href = '/login.html?next=' + encodeURIComponent(window.location.pathname + window.location.search);
      throw new Error('__redirecting__');
    }
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'ສັ່ງຊື້ບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ');
    }
    return data.code;
  }

  buyBtn.addEventListener('click', async () => {
    if (buyBtn.disabled) return;
    const wantQty = qty;
    buyBtn.disabled = true;
    qtyMinus.disabled = true;
    qtyPlus.disabled = true;

    const codes = [];
    try {
      for (let i = 0; i < wantQty; i++) {
        buyBtnText.textContent = wantQty > 1 ? `ກຳລັງສັ່ງຊື້... (${i + 1}/${wantQty})` : 'ກຳລັງສັ່ງຊື້...';
        const code = await purchaseOne();
        codes.push(code);
      }
      alert(`ສັ່ງຊື້ສຳເລັດ! ລະຫັດສິນຄ້າຂອງທ່ານ:\n${codes.join('\n')}\n\nເບິ່ງລາຍການນີ້ໄດ້ອີກຄັ້ງທີ່ "ປະຫວັດການສັ່ງຊື້"`);
      window.location.reload();
    } catch (err) {
      if (err && err.message === '__redirecting__') return;
      console.error('purchase failed:', err);
      if (codes.length) {
        alert(`ສັ່ງຊື້ໄດ້ ${codes.length}/${wantQty} ອັນ ກ່ອນຈະຕິດຂັດ:\n${codes.join('\n')}\n\nຂໍ້ຜິດພາດ: ${err.message}`);
      } else {
        alert(err.message || 'ສັ່ງຊື້ບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ');
      }
      window.location.reload();
    }
  });

  window.StorefrontData.fetchData()
    .then((data) => {
      const { name } = window.StorefrontData.applyStoreBranding(data.store);
      product = (data.products || []).find((p) => String(p.id) === String(pid));

      if (!product) {
        showError('ບໍ່ພົບສິນຄ້ານີ້ (ອາດຖືກລຶບ/ເຊື່ອງໄປແລ້ວ)');
        return;
      }

      document.title = `${product.name} — ${name}`;
      prodTitle.textContent = product.name || '';

      if (product.image_url) {
        prodImg.src = product.image_url;
        prodImg.alt = product.name || '';
        prodImg.style.display = 'block';
        prodImgPlaceholder.style.display = 'none';
      }

      // ໝາຍເຫດ: ຄ່າກັບໄປ — ຖ້າມາຈາກ category.html?cat=N ໃຫ້ກັບໄປໝວດນັ້ນເລີຍ ບໍ່ແມ່ນໜ້າຫຼັກ
      const backCat = params.get('cat');
      if (backCat) backLink.href = `category.html?cat=${encodeURIComponent(backCat)}`;

      if (product.duration_enabled) {
        durations = (product.durations || []).map((d) => ({ id: d.id, label: d.label, price: d.price, stock: d.stock || 0 }));
        // ເລືອກໄລຍະທຳອິດທີ່ຍັງມີສະຕັອກເປັນຄ່າເລີ່ມຕົ້ນ (ຖ້າມີ)
        const firstInStock = durations.findIndex((d) => d.stock > 0);
        selectedIndex = firstInStock >= 0 ? firstInStock : 0;
      } else {
        durations = [{ id: null, label: null, price: Number(product.price) || 0, stock: product.stock || 0 }];
        selectedIndex = 0;
      }

      loadingState.style.display = 'none';
      prodContent.style.display = 'block';

      renderBadges();
      renderOptions();
      renderSummary();
    })
    .catch((err) => {
      console.error('product.js: fetchData failed', err);
      showError('ດຶງຂໍ້ມູນສິນຄ້າບໍ່ສຳເລັດ, ກະລຸນາໂຫຼດໜ້ານີ້ໃໝ່ພາຍຫຼັງ');
    });
});
