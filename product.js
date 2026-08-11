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
  const breadcrumbCatSep = document.getElementById('breadcrumbCatSep');
  const breadcrumbCatLink = document.getElementById('breadcrumbCatLink');
  const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');

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
  const prodDescBox = document.getElementById('prodDescBox');

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

  /* =========================================================
     Code-receiving sheet — ແທນ alert() ເກົ່າ
     ຫຼັງສັ່ງຊື້ສຳເລັດ: ໂຊວ໌ລະຫັດ + ນັບຖອຍຫຼັງເດັ້ງໄປ orders.html ອັດຕະໂນມັດ
     ========================================================= */
  const csOverlay = document.getElementById('codeSheetOverlay');
  const csScroll = document.getElementById('codeSheetScroll');
  let csRedirectTimer = null;

  function csOpen(html) {
    csScroll.innerHTML = html;
    csOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function csClose() {
    if (csRedirectTimer) clearInterval(csRedirectTimer);
    csOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  csOverlay.addEventListener('click', (e) => { if (e.target === csOverlay) { csClose(); window.location.reload(); } });

  function csSuccessHTML(codes, total) {
    const multi = codes.length > 1;
    return `
      <div class="cs-ok-wrap">
        <div class="cs-ok-ring">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <div class="cs-ok-title">ສັ່ງຊື້ສຳເລັດ</div>
        <div class="cs-ok-sub">ລະຫັດຂອງທ່ານພ້ອມໃຊ້ງານແລ້ວ</div>
      </div>
      <div class="cs-order-line">
        <div>
          <div class="p-name">${escapeHtml(product.name)}${currentDuration() && product.duration_enabled ? ' ' + escapeHtml(currentDuration().label) : ''}</div>
          <div class="p-meta">${codes.length} ອັນ</div>
        </div>
        <div class="p-total en">${formatKip(total)}</div>
      </div>
      <div class="cs-stub-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M3 7 12 3l9 4"/></svg>
        ລະຫັດສິນຄ້າ${multi ? ` (${codes.length})` : ''}
      </div>
      <div class="cs-stub">
        ${codes.map((c, i) => `
          <div class="cs-stub-item" style="animation-delay:${i * 0.08}s">
            <div class="cs-stub-idx">${i + 1}</div>
            <div class="cs-stub-code en">${escapeHtml(c)}</div>
            <button type="button" class="cs-copy-btn" data-code="${escapeHtml(c)}" title="ຄັດລອກ">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
      ${multi ? `<button type="button" class="cs-copy-all" id="csCopyAllBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        ຄັດລອກທັງໝົດ
      </button>` : ''}
      <div class="cs-warn-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
        ບັນທຶກລະຫັດນີ້ໄວ້ໃຫ້ດີ, ສາມາດເບິ່ງຄືນໄດ້ທີ່ໜ້າ "ປະຫວັດການສັ່ງຊື້" ຕະຫຼອດເວລາ
      </div>
      <div class="cs-redirect-note">ກຳລັງໄປໜ້າ "ປະຫວັດການສັ່ງຊື້" ໃນ <span class="n" id="csCountdown">3</span> ວິ...</div>
      <button type="button" class="cs-cancel-link" id="csCancelBtn">ຍົກເລີກ, ຢູ່ໜ້ານີ້ຕໍ່</button>
    `;
  }

  function csErrorHTML(message, partialCodes) {
    return `
      <div class="cs-ok-wrap">
        <div class="cs-err-ring">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </div>
        <div class="cs-ok-title">ສັ່ງຊື້ບໍ່ສຳເລັດ</div>
        <div class="cs-ok-sub">${escapeHtml(message)}</div>
      </div>
      ${partialCodes && partialCodes.length ? `
      <div class="cs-stub-label">ລະຫັດທີ່ໄດ້ຮັບກ່ອນຈະຕິດຂັດ (${partialCodes.length})</div>
      <div class="cs-stub">
        ${partialCodes.map((c, i) => `
          <div class="cs-stub-item" style="animation-delay:${i * 0.08}s">
            <div class="cs-stub-idx">${i + 1}</div>
            <div class="cs-stub-code en">${escapeHtml(c)}</div>
          </div>
        `).join('')}
      </div>` : ''}
      <div class="cs-warn-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
        ຖ້າຖືກຫັກເງິນໄປແລ້ວແຕ່ບໍ່ໄດ້ຮັບລະຫັດຄົບ, ກະລຸນາຕິດຕໍ່ແອດມິນພ້ອມແນບໃບຄິວອໍເດີ
      </div>
      <div class="cs-actions">
        <button type="button" class="cs-btn-ghost" id="csCloseBtn">ປິດ</button>
        ${partialCodes && partialCodes.length ? `<button type="button" class="cs-btn-primary" id="csHistoryBtn">ເບິ່ງປະຫວັດ</button>` : ''}
      </div>
    `;
  }

  function csBindCopyButtons() {
    csScroll.querySelectorAll('.cs-copy-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.code;
        try { await navigator.clipboard.writeText(code); } catch (e) {}
        btn.classList.add('copied');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        }, 1400);
      });
    });
    const copyAllBtn = document.getElementById('csCopyAllBtn');
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', async () => {
        const codes = Array.from(csScroll.querySelectorAll('.cs-stub-code')).map((el) => el.textContent);
        try { await navigator.clipboard.writeText(codes.join('\n')); } catch (e) {}
        const original = copyAllBtn.innerHTML;
        copyAllBtn.classList.add('copied');
        copyAllBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> ຄັດລອກແລ້ວ`;
        setTimeout(() => { copyAllBtn.classList.remove('copied'); copyAllBtn.innerHTML = original; }, 1400);
      });
    }
  }

  function showSuccessSheet(codes, total) {
    csOpen(csSuccessHTML(codes, total));
    csBindCopyButtons();

    let secondsLeft = 3;
    const countdownEl = document.getElementById('csCountdown');
    csRedirectTimer = setInterval(() => {
      secondsLeft--;
      if (countdownEl) countdownEl.textContent = secondsLeft;
      if (secondsLeft <= 0) {
        clearInterval(csRedirectTimer);
        window.location.href = 'orders.html';
      }
    }, 1000);

    document.getElementById('csCancelBtn').addEventListener('click', () => {
      clearInterval(csRedirectTimer);
      csClose();
      window.location.reload();
    });
  }

  function showErrorSheet(message, partialCodes) {
    csOpen(csErrorHTML(message, partialCodes));
    document.getElementById('csCloseBtn').addEventListener('click', () => {
      csClose();
      window.location.reload();
    });
    const historyBtn = document.getElementById('csHistoryBtn');
    if (historyBtn) historyBtn.addEventListener('click', () => { window.location.href = 'orders.html'; });
  }

  let product = null;
  let durations = [];       // ລາຍການໄລຍະເວລາ (ຫຼືລາຍການດຽວ ຖ້າສິນຄ້າບໍ່ມີໄລຍະເວລາ)
  let selectedIndex = 0;
  let qty = 1;
  let resellerActive = false; // true ຫຼັງຈາກ applyResellerPricing() ພົບວ່າຄົນນີ້ເປັນຕົວແທນ

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
    optList.innerHTML = durations.map((d, i) => {
      const outOfStock = !(d.stock > 0);
      return `
      <button type="button" class="opt-card ${i === selectedIndex ? 'selected' : ''}" data-i="${i}" ${outOfStock ? 'disabled' : ''}>
        <span class="opt-name-wrap">
          <span class="opt-name-line">
            <span class="opt-check">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </span>
            <span class="opt-name">${escapeHtml(product.name)} ${escapeHtml(d.label)}</span>
          </span>
          <span class="opt-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M3 7 12 3l9 4"/></svg>
            ${outOfStock ? 'ໝົດແລ້ວ' : `ເຫຼືອ ${d.stock}`}
          </span>
        </span>
        <span class="opt-divider"></span>
        <span class="opt-price">${formatKip(d.price)}</span>
      </button>
    `;
    }).join('');

    optList.querySelectorAll('.opt-card').forEach((el) => {
      el.addEventListener('click', () => {
        if (el.disabled) return;
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
    priceValue.classList.toggle('is-reseller-glow', resellerActive);
    priceValue.nextElementSibling?.classList?.contains('reseller-price-tag') && priceValue.nextElementSibling.remove();
    if (resellerActive) {
      const tag = document.createElement('span');
      tag.className = 'reseller-price-tag';
      tag.textContent = 'ລາຄາຕົວແທນ';
      tag.style.cssText = 'display:inline-block;margin-left:8px;font-size:11px;font-weight:700;color:var(--red-glow,#ff0001);border:1px solid var(--red-glow,#ff0001);border-radius:6px;padding:2px 7px;vertical-align:middle;text-shadow:0 0 6px rgba(255,0,1,.5);';
      priceValue.insertAdjacentElement('afterend', tag);
    }
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
    const unitPrice = currentDuration() ? currentDuration().price : 0;
    try {
      for (let i = 0; i < wantQty; i++) {
        buyBtnText.textContent = wantQty > 1 ? `ກຳລັງສັ່ງຊື້... (${i + 1}/${wantQty})` : 'ກຳລັງສັ່ງຊື້...';
        const code = await purchaseOne();
        codes.push(code);
      }
      showSuccessSheet(codes, unitPrice * codes.length);
    } catch (err) {
      if (err && err.message === '__redirecting__') return;
      console.error('purchase failed:', err);
      if (codes.length) {
        showErrorSheet(`ຊື້ໄດ້ ${codes.length}/${wantQty} ອັນ ກ່ອນຈະຕິດຂັດ — ${err.message}`, codes);
      } else {
        showErrorSheet(err.message || 'ສິນຄ້ານີ້ອາດໝົດສະຕັອກ ຫຼືເກີດຂໍ້ຜິດພາດຊົ່ວຄາວ');
      }
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
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = product.name || '';

      // ---- Breadcrumb ระดับกลาง (หมวดหมู่): เอาชื่อหมวดจริงจาก ?cat= ถ้ามี ไม่งั้นใช้ product.category ----
      const catIndexParam = params.get('cat');
      const categoryFromIndex = catIndexParam
        ? window.StorefrontData.categoryByIndex(data, Number(catIndexParam))
        : null;
      const breadcrumbCatName = (categoryFromIndex && categoryFromIndex.name) || product.category || '';
      if (breadcrumbCatName && breadcrumbCatLink && breadcrumbCatSep) {
        breadcrumbCatLink.textContent = breadcrumbCatName;
        breadcrumbCatLink.href = catIndexParam
          ? `category.html?cat=${encodeURIComponent(catIndexParam)}`
          : 'index.html#categories';
        breadcrumbCatLink.style.display = '';
        breadcrumbCatSep.style.display = '';
      }

      if (product.image_url) {
        prodImg.src = product.image_url;
        prodImg.alt = product.name || '';
        prodImg.style.display = 'block';
        prodImgPlaceholder.style.display = 'none';
      }

      const descText = (product.description || '').trim();
      if (prodDescBox) {
        prodDescBox.textContent = descText || 'ບໍ່ມີລາຍລະອຽດສິນຄ້າ';
        prodDescBox.classList.toggle('is-empty', !descText);
      }

      // ໝາຍເຫດ: ຄ່າກັບໄປ — ຖ້າມາຈາກ category.html?cat=N ໃຫ້ກັບໄປໝວດນັ້ນເລີຍ ບໍ່ແມ່ນໜ້າຫຼັກ
      const backCat = params.get('cat');
      if (backCat) backLink.href = `category.html?cat=${encodeURIComponent(backCat)}`;

      if (product.duration_enabled) {
        durations = (product.durations || []).map((d) => ({ id: d.id, label: d.label, price: d.price, resellerPrice: d.resellerPrice, stock: d.stock || 0 }));
        // ເລືອກໄລຍະທຳອິດທີ່ຍັງມີສະຕັອກເປັນຄ່າເລີ່ມຕົ້ນ (ຖ້າມີ)
        const firstInStock = durations.findIndex((d) => d.stock > 0);
        selectedIndex = firstInStock >= 0 ? firstInStock : 0;
      } else {
        durations = [{ id: null, label: null, price: Number(product.price) || 0, resellerPrice: product.resellerPrice, stock: product.stock || 0 }];
        selectedIndex = 0;
      }

      loadingState.style.display = 'none';
      prodContent.style.display = 'block';

      renderBadges();
      renderOptions();
      renderSummary();

      // ---- เช็คว่าคนที่ login อยู่เป็นตัวแทนไหม ถ้าใช่ คำนวณราคาตัวแทนมาทับราคาปกติ ----
      applyResellerPricing();
    })
    .catch((err) => {
      console.error('product.js: fetchData failed', err);
      showError('ດຶງຂໍ້ມູນສິນຄ້າບໍ່ສຳເລັດ, ກະລຸນາໂຫຼດໜ້ານີ້ໃໝ່ພາຍຫຼັງ');
    });

  async function applyResellerPricing() {
    try {
      const info = await window.StorefrontData.fetchResellerInfo();
      if (!info.isReseller) return;

      durations.forEach((d) => {
        d.price = window.StorefrontData.effectivePrice(d.price, d.resellerPrice, info);
      });

      resellerActive = true;
      document.querySelector('.prod-hero')?.classList.add('is-reseller');
      renderOptions();
      renderSummary();
    } catch (err) {
      console.error('product.js: ດຶງລາຄາຕົວແທນບໍ່ສຳເລັດ', err);
    }
  }
});
