/* =========================================================
   orders.js — ການເຮັດວຽກຂອງໜ້າ orders.html
   ດຶງປະຫວັດການສັ່ງຊື້ຈິງຂອງລູກຄ້າຄົນທີ່ login ຢູ່ (GET /api/orders/history)
   ແລ້ວຄິດໄລ່ສະຖິຕິ (ລາຍການທັງໝົດ / ສຳເລັດແລ້ວ / ຍອດຊື້ລວມ) ຈາກຂໍ້ມູນຈິງເອງ
   ບໍ່ໄດ້ hardcode ຫຍັງໄວ້ເລີຍ — ຖ້າຍັງບໍ່ມີລາຍການ ຈະສະແດງ empty state ຄືໃນຮູບຕົວຢ່າງ
   (ໂຄງສ້າງອ້າງອີງມາຈາກ topup-history.js)

   ໝາຍເຫດ: ລະບົບຫຼັງບ້ານຊື້ 1 ຄັ້ງ = 1 ລະຫັດ = 1 ແຖວໃນຕາຕະລາງ orders (ເບິ່ງ src/index.js
   handleOrderCreate). ສະນັ້ນເວລາລູກຄ້າກົດ "ຊື້ເລີຍ" ດ້ວຍຈຳນວນຫຼາຍກວ່າ 1 ອັນ (product.js ຈະຍິງ
   /api/orders/create ຊ້ຳຫຼາຍຄັ້ງຕິດຕໍ່ກັນ) ຈະໄດ້ຫຼາຍແຖວທີ່ product_name/duration_label/status
   ຄືກັນ ແລະເວລາ created_at ໃກ້ກັນຫຼາຍ — ໜ້ານີ້ຈຶ່ງລວມ (group) ແຖວພວກນັ້ນເປັນກາດດຽວ ພ້ອມສະແດງ
   ລະຫັດທຸກອັນຮຽງລົງມາ ແລະປຸ່ມ "ຄັດລອກທັງໝົດ" (ບໍ່ໄດ້ໄປແກ້ຫຍັງໃນຝັ່ງ backend/ຖານຂໍ້ມູນເລີຍ)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const loadingEl = document.querySelector('#ohLoading');
  const emptyEl = document.querySelector('#ohEmpty');
  const listEl = document.querySelector('#ohList');
  if (!loadingEl || !emptyEl || !listEl) return; // ไม่ใช่หน้า orders

  // ชื่อร้าน/โลโก้/แถบประกาศ — หน้านี้เคยลืมเรียก ทำให้ชื่อร้านไม่ขึ้นและโลโก้ท้ายหน้าว่างเปล่า
  if (window.StorefrontData) {
    window.StorefrontData.fetchData()
      .then((data) => window.StorefrontData.applyStoreBranding(data.store))
      .catch((err) => console.error('orders.js: applyStoreBranding failed', err));
  }

  const statTotalEl = document.querySelector('#ohStatTotal');

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // สกุลเงินกีบ (₭) — รูปแบบเดียวกับหน้าอื่นของร้าน เช่น 20.000 ₭
  function formatMoney(n) {
    return Math.round(Number(n || 0)).toLocaleString('de-DE') + ' ₭';
  }

  // วันที่รูปแบบ 10/10/2026 21:47 ตามภาพอ้างอิง
  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso || '-';
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  const STATUS_LABEL = {
    completed: 'ສຳເລັດແລ້ວ',
    failed: 'ລົ້ມເຫຼວ',
  };

  // ຖ້າແຖວ 2 ອັນ ຊື້ຕິດກັນ (product/duration/status ຄືກັນ) ຫ່າງກັນບໍ່ເກີນ 90 ວິນາທີ
  // ຖືວ່າແມ່ນການສັ່ງຊື້ຊຸດດຽວກັນ (ຈາກການກົດ "ຊື້ເລີຍ" ຄັ້ງດຽວ ຫຼາຍຈຳນວນ) -> ລວມກາດດຽວກັນ
  const GROUP_WINDOW_MS = 90 * 1000;

  function groupOrders(items) {
    const groups = [];
    items.forEach((r) => {
      const last = groups[groups.length - 1];
      const sameBatch = last
        && last.product_name === (r.product_name || '')
        && last.duration_label === (r.duration_label || '')
        && last.status === r.status
        && Math.abs(new Date(last.earliestAt) - new Date(r.created_at)) <= GROUP_WINDOW_MS;

      if (sameBatch) {
        last.rows.push(r);
        last.earliestAt = r.created_at; // ຂໍ້ມູນຮຽງ created_at ໃໝ່ -> ເກົ່າ, ຂະຫຍາຍຂອບເຂດຕໍ່ໄປເລື່ອຍໆ
      } else {
        groups.push({
          product_name: r.product_name || '',
          duration_label: r.duration_label || '',
          status: r.status,
          image_url: r.image_url || '',
          rows: [r],
          earliestAt: r.created_at,
        });
      }
    });
    return groups;
  }

  const ICON = {
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7v5l3.2 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    mark: '<svg class="oh-mh-logo" viewBox="0 0 40 40"><path d="M20 3 36 12 31 18 20 12 9 18 4 12Z M8 22l12 6 12-6 2 5-14 9L6 27Z" fill="#e0261a"/><path d="M20 15l6 4-6 4-6-4Z" fill="#ff5a4a"/></svg>',
    // รูปสำรองเมื่อสินค้าไม่มีรูป (กล่องสีแดง-ดำ)
    art: '<svg viewBox="0 0 60 60"><rect width="60" height="60" fill="#0b0303"/><rect x="9" y="5" width="42" height="50" rx="3" fill="#1b0606" stroke="#e0261a" stroke-width="1.4"/><path d="M30 14l12 7-4 5-8-4-8 4-4-5Z M20 31l10 5 10-5 2 4-12 8-12-8Z" fill="#ff3b2d" opacity=".9"/><rect x="17" y="44" width="26" height="4" rx="1" fill="#ff3b2d" opacity=".7"/></svg>',
  };

  function thumbHTML(g) {
    // หมายเหตุ: CSP ของเว็บบล็อก inline handler (onerror) จึงใช้ class + listener ด้านล่างแทน
    const inner = g.image_url
      ? `<img class="oh-img" src="${escapeHtml(g.image_url)}" alt="${escapeHtml(g.product_name)}" loading="lazy"/>`
      : ICON.art;
    return `<div class="oh-thumb">${inner}</div>`;
  }

  // รูปสินค้าโหลดไม่ได้ -> สลับเป็นรูปสำรอง
  function bindImgFallback(root) {
    root.querySelectorAll('img.oh-img').forEach((img) => {
      const swap = () => { img.outerHTML = ICON.art; };
      img.addEventListener('error', swap, { once: true });
      if (img.complete && img.naturalWidth === 0) swap();
    });
  }

  // เก็บกลุ่มทั้งหมดไว้ให้ป๊อปอัปอ้างอิงตาม index
  let currentGroups = [];

  function groupHTML(g, i) {
    const head = g.rows[0]; // แถวแรก (ใหม่สุดในกลุ่ม) — ใช้แสดงเลขออเดอร์/วันที่
    const qty = g.rows.length;
    const totalPrice = g.rows.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const pill = g.duration_label
      ? `<span class="oh-pill${g.status === 'failed' ? ' is-failed' : ''}">${escapeHtml(g.duration_label)}</span>` : '';

    return `
      <div class="oh-item" style="--i:${i}">
        <div class="oh-item-main">
          ${thumbHTML(g)}
          <div class="oh-item-body">
            <div class="oh-item-top"><h3 class="oh-item-name">${escapeHtml(g.product_name || 'ສິນຄ້າ')}</h3>${pill}</div>
            <div class="oh-item-meta">#${escapeHtml(head.id || '')} <span>•</span> ${ICON.clock}${formatDate(head.created_at)}</div>
            <div class="oh-item-lbl oh-lo">ລາຄາຈ່າຍ</div>
            <div class="oh-item-price" data-amount="${totalPrice}">${formatMoney(totalPrice)}</div>
          </div>
        </div>
        <button type="button" class="oh-view oh-lo" data-i="${i}">ເບິ່ງຄີ ${ICON.arrow}</button>
      </div>`;
  }

  /* ---------- ตัวเลขนับขึ้น ---------- */
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countUp(el, to, ms) {
    if (reduceMotion()) { el.textContent = formatMoney(to); return; }
    const t0 = performance.now();
    (function tick(t) {
      const k = Math.min((t - t0) / ms, 1);
      el.textContent = formatMoney(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------- คัดลอก (มี fallback สำหรับ iOS/เบราว์เซอร์เก่า) ---------- */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch { return false; }
    }
  }

  /* ---------- ป๊อปอัปรายละเอียด ---------- */
  const modalEl = document.querySelector('#ohModal');
  const modalBody = document.querySelector('#ohModalBody');

  function openModal(g) {
    if (!modalEl || !modalBody) return;
    const head = g.rows[0];
    const qty = g.rows.length;
    const total = g.rows.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const unit = qty ? total / qty : 0;
    const keys = g.rows.map((r) => r.code).filter(Boolean);
    const failed = g.status === 'failed';
    const optLine = g.duration_label ? `<div class="oh-sub oh-lo">ຕົວເລືອກ: ${escapeHtml(g.duration_label)}</div>` : '';

    const keyBlock = keys.length
      ? keys.map((k) => `<div class="oh-key"><span>${escapeHtml(k)}</span><button type="button" class="oh-key-copy" data-code="${escapeHtml(k)}" aria-label="ຄັດລອກ">${ICON.copy}</button></div>`).join('')
        + `<button type="button" class="oh-cp oh-lo" id="ohCopyAll">${ICON.copy}<span>ຄັດລອກລະຫັດຄີ</span></button>`
      : `<div class="oh-nokey oh-lo">ບໍ່ມີຄີສຳລັບລາຍການນີ້</div>`;

    modalBody.innerHTML = `
      <div class="oh-mh">${ICON.mark}<h2>DEKMASH <i></i> #${escapeHtml(head.id || '')}</h2><button type="button" class="oh-x" id="ohClose" aria-label="ປິດ">${ICON.close}</button></div>
      <div class="oh-prod">${thumbHTML(g)}<div><h3>${escapeHtml(g.product_name || 'ສິນຄ້າ')}</h3>${optLine}
        <div class="oh-sub oh-lo">${qty} ຊິ້ນ - ${formatMoney(unit)}/ຊິ້ນ <em class="${failed ? 'is-failed' : ''}">${STATUS_LABEL[g.status] ? (failed ? STATUS_LABEL.failed : 'ສຳເລັດ') : escapeHtml(g.status)}</em></div></div></div>
      <div class="oh-lbl oh-lo">ຄີທີ່ໄດ້ຮັບ (${keys.length} ຄີ)</div>
      <div>${keyBlock}</div>
      <div class="oh-lbl oh-lo">ສະຫຼຸບຄຳສັ່ງຊື້</div>
      <div class="oh-line"><span class="oh-lo">ວັນທີສັ່ງຊື້</span><b>${formatDate(head.created_at)}</b></div>
      <div class="oh-tot"><span class="oh-lo">ຍອດລວມທັງໝົດ</span><b id="ohTotal">${formatMoney(0)}</b></div>`;

    bindImgFallback(modalBody);
    modalEl.classList.add('open');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('oh-lock');
    setTimeout(() => countUp(modalBody.querySelector('#ohTotal'), total, 800), 550);

    modalBody.querySelector('#ohClose').addEventListener('click', closeModal);

    const flash = (el) => { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 700); };
    modalBody.querySelectorAll('.oh-key-copy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (await copyText(btn.dataset.code || '')) flash(btn.closest('.oh-key'));
      });
    });
    const all = modalBody.querySelector('#ohCopyAll');
    if (all) {
      all.addEventListener('click', async () => {
        if (!(await copyText(keys.join('\n')))) return;
        const label = all.querySelector('span');
        all.classList.add('ok'); label.textContent = 'ຄັດລອກແລ້ວ ✓';
        modalBody.querySelectorAll('.oh-key').forEach(flash);
        setTimeout(() => { all.classList.remove('ok'); label.textContent = 'ຄັດລອກລະຫັດຄີ'; }, 1400);
      });
    }
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('oh-lock');
  }
  if (modalEl) {
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  }

  function renderList(items) {
    currentGroups = groupOrders(items);
    listEl.innerHTML = currentGroups.map(groupHTML).join('');
    bindImgFallback(listEl);

    // ราคานับขึ้นตอนการ์ดเข้า
    listEl.querySelectorAll('.oh-item-price').forEach((el, i) => {
      const to = Number(el.dataset.amount) || 0;
      el.textContent = formatMoney(0);
      setTimeout(() => countUp(el, to, 900), 450 + i * 120);
    });

    listEl.querySelectorAll('.oh-view').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = currentGroups[Number(btn.dataset.i)];
        if (g) openModal(g);
      });
    });
  }

  (async () => {
    try {
      const res = await fetch('/api/orders/history', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || data.requireLogin) {
        window.location.href = '/login.html?next=' + encodeURIComponent('/orders.html');
        return;
      }
      if (!res.ok || !data.ok) {
        loadingEl.textContent = data.error || 'ດຶງປະຫວັດການສັ່ງຊື້ບໍ່ສຳເລັດ, ລອງໃໝ່ພາຍຫຼັງ';
        loadingEl.classList.add('oh-error');
        return;
      }

      const items = data.items || [];

      // ---- สถิติ: คิดจากข้อมูลจริงที่ดึงมาเท่านั้น ----
      const total = items.length;

      statTotalEl.textContent = total.toLocaleString('th-TH');

      loadingEl.style.display = 'none';

      if (!items.length) {
        emptyEl.style.display = '';
        return;
      }

      renderList(items);
      listEl.style.display = '';
    } catch (err) {
      console.error('ດຶງປະຫວັດການສັ່ງຊື້ບໍ່ສຳເລັດ', err);
      loadingEl.textContent = 'ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ໄດ້, ລອງໃໝ່ພາຍຫຼັງ';
      loadingEl.classList.add('oh-error');
    }
  })();
});
