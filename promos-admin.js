/* =========================================================
   promos-admin.js — แผง "ໂປຣໂມຊັ່ນ" ในห้องแอดมิน (admin.html > #panelPromos)
   - สร้างโปรได้ 2 แบบ:  (1) ลดเป็น %  (ทุกสินค้า หรือเลือกสินค้า)
                        (2) ลดเป็นราคา: แอดมินติ๊กเลือกสินค้าแต่ละชิ้น แล้วใส่ยอดที่ลด (₭) แยกชิ้นได้
   - ตั้งเวลาเริ่ม (ค่าเริ่มต้น = ตอนนี้) และเวลาหมดอายุ (บังคับ) — หมดเวลาแล้วราคากลับปกติอัตโนมัติ
   - อ่าน/เขียนตาราง promotions + promotion_items ผ่าน supabaseClient (-> Worker proxy ที่เช็คสิทธิ์แอดมิน)
   - ราคาที่หักจริงตอนลูกค้าซื้อคิดใน SQL get_effective_price / promo_discount ไม่ใช่ที่นี่
   - ถูกเรียกจาก initAdminPanel() ใน admin.js ผ่าน window.initPromosPanel()
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE'); // 15.000
  const kip = (n) => '₭ ' + fmt(n);
  const toast = (t) => { if (typeof showToast === 'function') showToast(t); };
  const pad = (n) => String(n).padStart(2, '0');

  let mode = 'percent';        // 'percent' | 'fixed'
  let scope = 'all';           // percent เท่านั้น: 'all' | 'pick'
  let endMs = 24 * 3600 * 1000; // ระยะเวลา (ms) จาก chip — null = ใช้ช่องวันเวลาเอง
  let products = [];
  const picked = new Map();    // product_id -> amount (fixed) หรือ true
  let promos = [];
  let bound = false;
  let saving = false;
  let tickTimer = null;

  const pickNeeded = () => mode === 'fixed' || scope === 'pick';

  /* ---------- helpers ---------- */
  function localInputValue(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function leftText(ms) {
    if (ms <= 0) return '00:00:00';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
    const t = `${pad(Math.floor(s % 86400 / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
    return d ? `${d} ວັນ ${t}` : t;
  }
  function statusOf(p) {
    const now = Date.now();
    if (new Date(p.ends_at).getTime() <= now) return { k: 'ended', t: 'ໝົດເວລາແລ້ວ' };
    if (!p.active) return { k: 'off', t: 'ປິດຢູ່' };
    if (new Date(p.starts_at).getTime() > now) return { k: 'wait', t: 'ລໍຖ້າເລີ່ມ' };
    return { k: 'live', t: 'ກຳລັງເປີດ' };
  }
  function setErr(msg) {
    const el = $('pmaErr');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('show', !!msg);
  }
  function calcEnd() {
    // เวลาหมดอายุ: ถ้าเลือก chip = เริ่ม(หรือตอนนี้) + ระยะเวลา ; ถ้าเลือกเอง = ค่าจากช่อง
    const start = startMs();
    if (endMs != null) return start + endMs;
    const v = $('pmaEndAt').value;
    return v ? new Date(v).getTime() : NaN;
  }
  function startMs() {
    const v = $('pmaStartAt').value;
    return v ? new Date(v).getTime() : Date.now();
  }

  /* ---------- ตัวเลือกสินค้า ---------- */
  async function loadProducts() {
    const { data, error } = await supabaseClient.from('products').select('id,name,category,price,image_url,duration_enabled,archived').order('name', { ascending: true }).limit(1000);
    if (error) { console.error('promos: products load failed', error); $('pmaProdList').innerHTML = '<div class="pma-empty">ໂຫຼດສິນຄ້າບໍ່ສຳເລັດ</div>'; return; }
    products = (data || []).filter((p) => !p.archived);
    renderProducts();
  }
  function renderProducts() {
    const wrap = $('pmaProdWrap');
    wrap.classList.toggle('u-hidden', !pickNeeded());
    if (!pickNeeded()) { upd(); return; }
    const q = $('pmaSearch').value.trim().toLowerCase();
    const list = products.filter((p) => !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
    $('pmaProdList').innerHTML = list.length ? list.map((p) => {
      const on = picked.has(p.id);
      const amt = picked.get(p.id);
      return `<div class="pma-prod ${on ? 'on' : ''}" data-id="${esc(p.id)}">
        <button type="button" class="pma-chk" data-a="tg" aria-label="ເລືອກ">${on ? '✓' : ''}</button>
        <div class="pma-img">${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : esc((p.name || '?').slice(0, 1))}</div>
        <div class="pma-pn"><b>${esc(p.name)}</b><small>${esc(p.category || '')} · ${p.duration_enabled ? 'ຫຼາຍໄລຍະ' : kip(p.price)}<span class="pma-np">${on ? newPriceTxt(p, amt) : ''}</span></small></div>
        ${mode === 'fixed' && on ? `<div class="pma-amt"><span>-</span><input inputmode="numeric" data-a="amt" placeholder="5000" value="${amt ? esc(amt) : ''}"></div>` : ''}
      </div>`;
    }).join('') : '<div class="pma-empty">ບໍ່ພົບສິນຄ້າ</div>';
    $('pmaPickCount').textContent = picked.size ? `ເລືອກແລ້ວ ${picked.size}` : 'ຍັງບໍ່ເລືອກ';
    upd();
  }

  /* ---------- ราคาใหม่ต่อสินค้า + ตัวอย่างป้ายบนการ์ด ---------- */
  const pctVal = () => Math.min(parseInt(String($('pmaVal').value).replace(/\D/g, ''), 10) || 0, 100);
  // ราคาหลังลดของสินค้า 1 ชิ้น (เฉพาะสินค้าที่ไม่ได้ตั้งหลายระยะเวลา) — ' → ₭ xx.xxx' หรือ '' ถ้ายังไม่มียอดลด
  function newPriceTxt(p, amt) {
    if (!p || p.duration_enabled) return '';
    const price = Number(p.price) || 0;
    const off = mode === 'percent' ? Math.round(price * pctVal() / 100) : Math.min(Number(amt) || 0, price);
    return off > 0 ? ` → <b>${kip(price - off)}</b>` : '';
  }
  function refreshNewPrices() {
    document.querySelectorAll('#pmaProdList .pma-prod').forEach((row) => {
      const el = row.querySelector('.pma-np');
      if (!el) return;
      const id = row.dataset.id;
      el.innerHTML = picked.has(id) ? newPriceTxt(products.find((x) => x.id === id), picked.get(id)) : '';
    });
  }
  // ป้ายตัวอย่างหน้าตาเหมือนบนการ์ดจริง (ใช้ class เดียวกับ promo.css)
  function badgePreview(pct, off) {
    if (!(pct >= 1) && !(off > 0)) return '';
    const showPct = pct >= 1;
    const big = showPct ? `-${pct}<small>%</small>` : `-${fmt(off)}`;
    const cls = ['prod-promo-badge', showPct ? '' : 'is-amount', pct >= 100 ? 'is-wide' : ''].filter(Boolean).join(' ');
    return `<div class="pma-prev"><div class="${cls}"><span class="ppb-in"><span class="ppb-top">SALE</span><span class="ppb-num">${big}</span></span></div><span class="pma-prev-t">ປ້າຍທີ່ລູກຄ້າຈະເຫັນເທິງການ໌ດສິນຄ້າ</span></div>`;
  }
  function previewFor() {
    if (mode === 'percent') return badgePreview(pctVal(), 0);
    for (const [id, amt] of picked) {
      const p = products.find((x) => x.id === id);
      const a = Number(amt) || 0;
      if (!p || !a) continue;
      if (p.duration_enabled) return badgePreview(0, a);
      const price = Number(p.price) || 0;
      return badgePreview(price ? Math.round(Math.min(a, price) / price * 100) : 0, a);
    }
    return '';
  }

  /* ---------- สรุป/ตัวอย่าง ---------- */
  function upd() {
    const v = parseInt(String($('pmaVal').value).replace(/\D/g, ''), 10) || 0;
    const end = calcEnd();
    const endTxt = Number.isFinite(end) ? fmtDate(end) : '—';
    let line;
    if (mode === 'percent') {
      const base = 30000, off = Math.round(base * Math.min(v, 100) / 100);
      line = v ? `ລົດ <b>${v}%</b> ${scope === 'all' ? 'ທຸກສິນຄ້າ' : `ສະເພາະ ${picked.size} ສິນຄ້າ`} — ຕົວຢ່າງ <s>${kip(base)}</s> → <b>${kip(base - off)}</b>` : 'ໃສ່ເປີເຊັນທີ່ຈະລົດ';
    } else {
      const n = picked.size;
      line = n ? `ລົດລາຄາ ${n} ສິນຄ້າ (ແຕ່ລະຊິ້ນຕາມຍອດທີ່ໃສ່)` : 'ຕິກເລືອກສິນຄ້າ ແລ້ວໃສ່ຍອດທີ່ຈະລົດ';
    }
    $('pmaSum').innerHTML = `${line}<br>ໝົດເວລາ: <b>${esc(endTxt)}</b>${previewFor()}`;
    refreshNewPrices();
  }

  /* ---------- สร้างโปรโมชั่น ---------- */
  async function submitCreate(e) {
    e.preventDefault();
    if (saving) return;
    setErr('');
    const title = $('pmaTitle').value.trim() || 'ໂປຣໂມຊັ່ນ';
    const v = parseInt(String($('pmaVal').value).replace(/\D/g, ''), 10) || 0;
    const start = startMs(), end = calcEnd();

    if (mode === 'percent') {
      if (!v || v > 100) return setErr('ເປີເຊັນຕ້ອງຢູ່ລະຫວ່າງ 1 – 100');
      if (scope === 'pick' && !picked.size) return setErr('ກະລຸນາເລືອກສິນຄ້າຢ່າງໜ້ອຍ 1 ອັນ');
    } else {
      if (!picked.size) return setErr('ກະລຸນາເລືອກສິນຄ້າຢ່າງໜ້ອຍ 1 ອັນ');
      for (const [id, amt] of picked) {
        const p = products.find((x) => x.id === id);
        if (!(Number(amt) > 0)) return setErr(`ໃສ່ຍອດທີ່ຈະລົດຂອງ "${p ? p.name : id}"`);
      }
    }
    if (!Number.isFinite(end)) return setErr('ກະລຸນາກຳນົດເວລາໝົດໂປຣ');
    if (end <= Date.now()) return setErr('ເວລາໝົດໂປຣຕ້ອງເປັນເວລາໃນອະນາຄົດ');
    if (end <= start) return setErr('ເວລາໝົດຕ້ອງຫຼັງຈາກເວລາເລີ່ມ');

    saving = true;
    const btn = $('pmaCreate');
    btn.disabled = true;
    try {
      const row = {
        title, mode,
        percent: mode === 'percent' ? v : null,
        apply_all: mode === 'percent' && scope === 'all',
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
        active: true,
      };
      const ins = await supabaseClient.from('promotions').insert(row).select('id').single();
      if (ins.error) throw ins.error;
      const pid = ins.data.id;
      if (pickNeeded()) {
        const items = [...picked.entries()].map(([product_id, amt]) => ({
          promotion_id: pid, product_id, amount: mode === 'fixed' ? Number(amt) : null,
        }));
        const it = await supabaseClient.from('promotion_items').insert(items);
        if (it.error) {
          await supabaseClient.from('promotions').delete().eq('id', pid); // ย้อนกลับ ไม่ให้เหลือโปรครึ่งๆ
          throw it.error;
        }
      }
      toast('ສ້າງໂປຣໂມຊັ່ນແລ້ວ');
      $('pmaTitle').value = ''; $('pmaVal').value = ''; picked.clear();
      renderProducts();
      await loadPromos();
    } catch (err) {
      console.error('promotions create failed:', err);
      setErr('ສ້າງບໍ່ສຳເລັດ: ' + ((err && err.message) || 'ລອງໃໝ່ພາຍຫຼັງ') + (/relation|does not exist|schema cache/i.test((err && err.message) || '') ? ' — ກວດວ່າໄດ້ສ້າງຕາຕະລາງ promotions ໃນ Supabase ແລ້ວ' : ''));
    } finally {
      saving = false;
      btn.disabled = false;
    }
  }

  /* ---------- รายการโปรโมชั่น ---------- */
  function cardHtml(p) {
    const st = statusOf(p);
    const items = p.promotion_items || [];
    const names = items.slice(0, 3).map((i) => { const pr = products.find((x) => x.id === i.product_id); return pr ? pr.name : ''; }).filter(Boolean);
    const scopeTxt = p.mode === 'percent' && p.apply_all ? 'ທຸກສິນຄ້າ' : `${items.length} ສິນຄ້າ${names.length ? ' · ' + names.map(esc).join(', ') + (items.length > names.length ? '…' : '') : ''}`;
    const what = p.mode === 'percent' ? `ລົດ ${Number(p.percent)}%` : 'ລົດເປັນລາຄາ (ແຍກຕາມສິນຄ້າ)';
    return `<div class="pma-cp ${st.k}" data-id="${esc(p.id)}">
      <div class="pma-top">
        <div class="pma-ttl"><b>${esc(p.title)}</b><small>${what} · ${scopeTxt}</small></div>
        <span class="pma-st ${st.k}">${st.t}</span>
      </div>
      <div class="pma-meta">
        <span>ເລີ່ມ ${esc(fmtDate(p.starts_at))}</span>
        <span>ໝົດ ${esc(fmtDate(p.ends_at))}</span>
        ${st.k === 'live' || st.k === 'wait' || st.k === 'off' ? `<span class="pma-left">ເຫຼືອ <b data-end="${esc(p.ends_at)}">${leftText(new Date(p.ends_at).getTime() - Date.now())}</b></span>` : ''}
      </div>
      <div class="pma-act">
        <button type="button" class="pma-b" data-a="ptg">${p.active ? 'ປິດໂປຣ' : 'ເປີດໂປຣ'}</button>
        <button type="button" class="pma-b" data-a="ext">+1 ວັນ</button>
        <button type="button" class="pma-b del" data-a="del">ລຶບ</button>
      </div></div>`;
  }
  function renderList() {
    const el = $('pmaList');
    $('pmaCount').textContent = promos.length ? promos.length + ' ໂປຣ' : '';
    const live = promos.filter((p) => statusOf(p).k === 'live').length;
    const badge = $('d2BadgePromos');
    if (badge) badge.textContent = live + ' ເປີດຢູ່';
    el.innerHTML = promos.length ? promos.map(cardHtml).join('') : '<div class="pma-empty">ຍັງບໍ່ມີໂປຣໂມຊັ່ນ — ສ້າງອັນທຳອິດດ້ານເທິງ</div>';
  }
  async function loadPromos() {
    const btn = $('pmaRefresh');
    if (btn) btn.classList.add('spinning');
    const { data, error } = await supabaseClient.from('promotions').select('*, promotion_items(product_id, amount)').order('created_at', { ascending: false }).limit(200);
    if (btn) setTimeout(() => btn.classList.remove('spinning'), 400);
    if (error) {
      console.error('promotions select failed:', error);
      $('pmaList').innerHTML = '<div class="pma-empty">ໂຫຼດຂໍ້ມູນຜິດພາດ — ກວດວ່າໄດ້ສ້າງຕາຕະລາງ promotions ໃນ Supabase ແລ້ວ</div>';
      return;
    }
    promos = data || [];
    renderList();
  }
  async function onListClick(e) {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    const el = b.closest('.pma-cp');
    const p = promos.find((x) => x.id === el.dataset.id);
    if (!p) return;
    b.disabled = true;
    try {
      if (b.dataset.a === 'ptg') {
        const { error } = await supabaseClient.from('promotions').update({ active: !p.active }).eq('id', p.id);
        if (error) throw error;
        toast(!p.active ? 'ເປີດໂປຣແລ້ວ' : 'ປິດໂປຣແລ້ວ');
      } else if (b.dataset.a === 'ext') {
        const base = Math.max(new Date(p.ends_at).getTime(), Date.now());
        const { error } = await supabaseClient.from('promotions').update({ ends_at: new Date(base + 86400000).toISOString() }).eq('id', p.id);
        if (error) throw error;
        toast('ຕໍ່ເວລາ 1 ວັນແລ້ວ');
      } else if (b.dataset.a === 'del') {
        if (!b.classList.contains('sure')) {
          b.classList.add('sure'); b.textContent = 'ຢືນຢັນລຶບ?'; b.disabled = false;
          clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove('sure'); b.textContent = 'ລຶບ'; }, 3000);
          return;
        }
        const { error } = await supabaseClient.from('promotions').delete().eq('id', p.id);
        if (error) throw error;
        toast('ລຶບໂປຣແລ້ວ');
      }
      await loadPromos();
    } catch (err) {
      console.error(err);
      toast('ບໍ່ສຳເລັດ: ' + ((err && err.message) || ''));
      b.disabled = false;
    }
  }

  function tick() {
    document.querySelectorAll('#pmaList [data-end]').forEach((el) => {
      el.textContent = leftText(new Date(el.dataset.end).getTime() - Date.now());
    });
  }

  /* ---------- ผูกอีเวนต์ ---------- */
  function setSeg(id, attr, val) {
    document.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle('on', x.dataset[attr] === val));
  }
  function bind() {
    if (bound || !$('pmaForm')) return;
    bound = true;

    $('pmaMode').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.dataset.m === mode) return;
      mode = b.dataset.m; setSeg('pmaMode', 'm', mode);
      $('pmaPctBox').classList.toggle('u-hidden', mode !== 'percent');
      if (mode === 'fixed') picked.forEach((_, k) => picked.set(k, picked.get(k) === true ? '' : picked.get(k)));
      else picked.forEach((_, k) => picked.set(k, true));
      renderProducts();
    });
    $('pmaScope').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || b.dataset.s === scope) return;
      scope = b.dataset.s; setSeg('pmaScope', 's', scope); renderProducts();
    });
    $('pmaVal').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); setErr(''); upd(); });
    $('pmaSearch').addEventListener('input', renderProducts);

    $('pmaProdList').addEventListener('click', (e) => {
      const row = e.target.closest('.pma-prod'); if (!row) return;
      if (e.target.closest('.pma-amt')) return;
      const id = row.dataset.id;
      if (picked.has(id)) picked.delete(id); else picked.set(id, mode === 'fixed' ? '' : true);
      renderProducts();
      if (mode === 'fixed' && picked.has(id)) {
        const inp = $('pmaProdList').querySelector(`.pma-prod[data-id="${CSS.escape(id)}"] input`);
        if (inp) inp.focus();
      }
    });
    $('pmaProdList').addEventListener('input', (e) => {
      if (e.target.dataset.a !== 'amt') return;
      e.target.value = e.target.value.replace(/\D/g, '');
      picked.set(e.target.closest('.pma-prod').dataset.id, e.target.value);
      setErr(''); upd();
    });
    $('pmaSelAll').addEventListener('click', () => {
      const q = $('pmaSearch').value.trim().toLowerCase();
      products.filter((p) => !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
        .forEach((p) => { if (!picked.has(p.id)) picked.set(p.id, mode === 'fixed' ? '' : true); });
      renderProducts();
    });
    $('pmaClear').addEventListener('click', () => { picked.clear(); renderProducts(); });
    $('pmaBulkBtn').addEventListener('click', () => {
      const v = String($('pmaBulk').value).replace(/\D/g, '');
      if (!v) return;
      picked.forEach((_, k) => picked.set(k, v));
      renderProducts();
    });
    $('pmaBulk').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });

    $('pmaEndChips').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      document.querySelectorAll('#pmaEndChips button').forEach((x) => x.classList.toggle('on', x === b));
      if (b.dataset.h === 'custom') {
        endMs = null; $('pmaEndAt').classList.remove('u-hidden');
        if (!$('pmaEndAt').value) $('pmaEndAt').value = localInputValue(Date.now() + 86400000);
      } else {
        endMs = Number(b.dataset.h) * 3600000; $('pmaEndAt').classList.add('u-hidden');
      }
      setErr(''); upd();
    });
    $('pmaEndAt').addEventListener('input', () => { setErr(''); upd(); });
    $('pmaStartChips').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      document.querySelectorAll('#pmaStartChips button').forEach((x) => x.classList.toggle('on', x === b));
      const later = b.dataset.s === 'later';
      $('pmaStartAt').classList.toggle('u-hidden', !later);
      if (later && !$('pmaStartAt').value) $('pmaStartAt').value = localInputValue(Date.now() + 3600000);
      if (!later) $('pmaStartAt').value = '';
      upd();
    });
    $('pmaStartAt').addEventListener('input', upd);

    $('pmaForm').addEventListener('submit', submitCreate);
    $('pmaList').addEventListener('click', onListClick);
    $('pmaRefresh').addEventListener('click', loadPromos);
    if (!tickTimer) tickTimer = setInterval(tick, 1000);
  }

  window.initPromosPanel = function initPromosPanel() {
    bind();
    upd();
    loadProducts().then(loadPromos);
  };
})();
