/* =========================================================
   promo-home.js — การ์ดโปรโมชั่นหน้าแรก (index.html)
   อ่าน data.promotions จาก /api/public/storefront (Worker ส่งเฉพาะโปรที่เปิดอยู่และอยู่ในช่วงเวลา)
   - แสดงการ์ดต่อโปร 1 ใบ: ชื่อ, ส่วนลด (% หรือ "ลดสูงสุด"), นับถอยหลังถึงเวลาหมด, รูปสินค้าที่ร่วมโปร
   - ตัวแทน (reseller) ไม่ได้ราคาโปร จึงไม่แสดงการ์ด
   - ครบเวลา: ซ่อนการ์ดแล้วโหลดหน้าใหม่ 1 ครั้งเพื่อให้ราคากลับเป็นปกติ
   ========================================================= */
(function () {
  const SD = window.StorefrontData;
  if (!SD) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const FIRE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5 4 5 4 9a4 4 0 0 1-8 0c0-1.5.6-2.6 1.4-3.6C10.2 9 11 8 11 6.5 11 5 11.5 3.5 12 2Z"/><path d="M6 15a6 6 0 0 0 12 0H6Z" opacity=".6"/></svg>';
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  let timer = null;

  function offLabel(pr, products) {
    if (pr.mode === 'percent') return { small: 'ລົດ', big: `${Number(pr.percent)}%` };
    // ลดเป็นราคา: โชว์ "ลดสูงสุด" จากรายการสินค้าในโปรนี้
    let max = 0;
    products.forEach((p) => {
      const hit = (p.promos || []).find((x) => x.id === pr.id);
      if (hit && Number(hit.amount) > max) max = Number(hit.amount);
    });
    return { small: 'ລົດສູງສຸດ', big: `-${Number(max).toLocaleString('de-DE')}` };
  }

  function productsOf(pr, all) {
    return all.filter((p) => (p.promos || []).some((x) => x.id === pr.id));
  }

  function cardHTML(pr, all) {
    const prods = productsOf(pr, all);
    if (!prods.length) return '';
    const off = offLabel(pr, prods);
    const shown = prods.slice(0, 6);
    const thumbs = shown.map((p) => `<a class="pm-thumb" href="product.html?pid=${encodeURIComponent(p.id)}" title="${esc(p.name)}">${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : esc((p.name || '?').slice(0, 1))}</a>`).join('');
    const more = prods.length > shown.length ? `<span class="pm-more">+${prods.length - shown.length}</span>` : '';
    return `<div class="pm-card" data-pm="${esc(pr.id)}" data-end="${esc(pr.endsAt)}">
      <div class="pm-top">
        <div><span class="pm-tag">${FIRE}PROMOTION</span><div class="pm-title">${esc(pr.title || 'ໂປຣໂມຊັ່ນ')}</div></div>
        <div class="pm-off"><small>${off.small}</small><b>${esc(off.big)}</b></div>
      </div>
      <div class="pm-count"><span class="lbl">ສິ້ນສຸດໃນ</span>
        <div class="pm-box"><b data-u="d">00</b><i>ວັນ</i></div>
        <div class="pm-box"><b data-u="h">00</b><i>ຊົ່ວໂມງ</i></div>
        <div class="pm-box"><b data-u="m">00</b><i>ນາທີ</i></div>
        <div class="pm-box"><b data-u="s">00</b><i>ວິນາທີ</i></div>
      </div>
      <div class="pm-thumbs">${thumbs}${more}</div>
      <a class="pm-cta" href="#all-products">ເບິ່ງສິນຄ້າໂປຣ (${prods.length})${ARROW}</a>
    </div>`;
  }

  function tick(root) {
    const now = Date.now();
    let alive = 0;
    root.querySelectorAll('.pm-card').forEach((card) => {
      const left = new Date(card.dataset.end).getTime() - now;
      if (!(left > 0)) {
        card.remove();
        // ครบเวลา: โหลดหน้าใหม่ 1 ครั้ง (กันวนด้วย sessionStorage) ให้ราคาบนการ์ดสินค้ากลับเป็นปกติ
        const key = 'promo_reload_' + card.dataset.pm;
        let done = false;
        try { done = !!sessionStorage.getItem(key); sessionStorage.setItem(key, '1'); } catch (e) { done = true; }
        if (!done) setTimeout(() => location.reload(), 800);
        return;
      }
      alive++;
      const s = Math.floor(left / 1000);
      const set = (u, v) => { const el = card.querySelector(`[data-u="${u}"]`); if (el) el.textContent = pad(v); };
      set('d', Math.floor(s / 86400));
      set('h', Math.floor(s % 86400 / 3600));
      set('m', Math.floor(s % 3600 / 60));
      set('s', s % 60);
    });
    if (!alive) {
      clearInterval(timer);
      const sec = document.getElementById('promoSection');
      if (sec) sec.classList.add('u-hidden');
    }
  }

  async function init() {
    const sec = document.getElementById('promoSection');
    const list = document.getElementById('promoList');
    if (!sec || !list) return;
    try {
      const [data, info] = await Promise.all([SD.fetchData(), SD.fetchResellerInfo()]);
      if (info && info.isReseller) return; // ตัวแทนไม่ได้ราคาโปร
      const promos = (data && data.promotions) || [];
      if (!promos.length) return;
      const html = promos.map((pr) => cardHTML(pr, data.products || [])).join('');
      if (!html) return;
      list.innerHTML = html;
      sec.classList.remove('u-hidden');
      tick(list);
      timer = setInterval(() => tick(list), 1000);
    } catch (err) {
      console.error('promo-home.js: init failed', err); // โปรเป็นของเสริม ไม่ให้หน้าหลักพัง
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
