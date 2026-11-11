/* =========================================================
   promos-admin.js — แผง "ໂປຣໂມຊັ່ນ" ในห้องแอดมิน (admin.html > #panelPromos)
   - แบบง่าย: แอดมินติ๊กเลือกสินค้า แล้วใส่ยอดที่ลด (₭) เอง
       · สินค้าปกติ        -> ติ๊กทั้งชิ้น ใส่ยอดลด 1 ช่อง
       · สินค้าหลายระยะเวลา -> ติ๊กเลือกเป็นรายระยะ (เช่น 1 เดือน / 3 เดือน) ใส่ยอดลดแยกกันได้
   - ตั้งเวลาเริ่ม (ค่าเริ่มต้น = ตอนนี้) และเวลาหมดอายุ (บังคับ) — หมดเวลาแล้วราคากลับปกติอัตโนมัติ
   - อ่าน/เขียนตาราง promotions + promotion_items (คอลัมน์ duration_id = ผูกกับระยะเวลา) ผ่าน supabaseClient
   - ราคาที่หักจริงตอนลูกค้าซื้อคิดใน SQL get_effective_price / promo_discount(product, price, duration)
   - ถูกเรียกจาก initAdminPanel() ใน admin.js ผ่าน window.initPromosPanel()
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE'); // 15.000
  const kip = (n) => '₭ ' + fmt(n);
  const toast = (t) => { if (typeof showToast === 'function') showToast(t); };
  const pad = (n) => String(n).padStart(2, '0');

  let endMs = 24 * 3600 * 1000; // ระยะเวลา (ms) จาก chip — null = ใช้ช่องวันเวลาเอง
  let products = [];            // สินค้า + durations[]
  const rowInfo = new Map();    // key -> { pid, did, price, name }   key = 'p:<productId>' | 'd:<durationId>'
  const picked = new Map();     // key -> ยอดที่ลด (string)
  let promos = [];
  let bound = false;
  let saving = false;
  let tickTimer = null;

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
  function startMs() {
    const v = $('pmaStartAt').value;
    return v ? new Date(v).getTime() : Date.now();
  }
  function calcEnd() {
    const start = startMs();
    if (endMs != null) return start + endMs;
    const v = $('pmaEndAt').value;
    return v ? new Date(v).getTime() : NaN;
  }

  /* ---------- ตัวเลือกสินค้า / ระยะเวลา ---------- */
  async function loadProducts() {
    const [pr, du] = await Promise.all([
      supabaseClient.from('products').select('id,name,category,price,image_url,duration_enabled,archived').order('name', { ascending: true }).limit(1000),
      supabaseClient.from('product_durations').select('id,product_id,label,price,sort_order').order('sort_order', { ascending: true }).limit(5000),
    ]);
    if (pr.error) { console.error('promos: products load failed', pr.error); $('pmaProdList').innerHTML = '<div class="pma-empty">ໂຫຼດສິນຄ້າບໍ່ສຳເລັດ</div>'; return; }
    const byProduct = new Map();
    ((du && du.data) || []).forEach((d) => {
      if (!byProduct.has(d.product_id)) byProduct.set(d.product_id, []);
      byProduct.get(d.product_id).push(d);
    });
    products = (pr.data || []).filter((p) => !p.archived).map((p) => ({ ...p, durations: byProduct.get(p.id) || [] }));
    rowInfo.clear();
    products.forEach((p) => {
      if (p.duration_enabled && p.durations.length) {
        p.durations.forEach((d) => rowInfo.set('d:' + d.id, { pid: p.id, did: d.id, price: Number(d.price) || 0, name: `${p.name} · ${d.label}` }));
      } else {
        rowInfo.set('p:' + p.id, { pid: p.id, did: null, price: Number(p.price) || 0, name: p.name });
      }
    });
    renderProducts();
  }
  const keysOf = (p) => (p.duration_enabled && p.durations.length ? p.durations.map((d) => 'd:' + d.id) : ['p:' + p.id]);
  const matches = (p, q) => !q || (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);

  function newPriceTxt(key, amt) {
    const info = rowInfo.get(key);
    const off = Math.min(Number(amt) || 0, info ? info.price : 0);
    return off > 0 ? ` → <b>${kip(info.price - off)}</b>` : '';
  }
  function amtInput(key, on, amt) {
    return on ? `<div class="pma-amt"><span>-</span><input inputmode="numeric" data-a="amt" placeholder="5000" value="${amt ? esc(amt) : ''}"></div>` : '';
  }
  function renderProducts() {
    const q = $('pmaSearch').value.trim().toLowerCase();
    const list = products.filter((p) => matches(p, q));
    $('pmaProdList').innerHTML = list.length ? list.map((p) => {
      const img = `<div class="pma-img">${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : esc((p.name || '?').slice(0, 1))}</div>`;
      if (p.duration_enabled && p.durations.length) {
        const keys = keysOf(p);
        const n = keys.filter((k) => picked.has(k)).length;
        const subs = p.durations.map((d) => {
          const key = 'd:' + d.id, on = picked.has(key), amt = picked.get(key);
          return `<div class="pma-prod pma-sub ${on ? 'on' : ''}" data-k="${esc(key)}">
            <button type="button" class="pma-chk" aria-label="ເລືອກ">${on ? '✓' : ''}</button>
            <div class="pma-pn"><b>${esc(d.label)}</b><small>${kip(d.price)}<span class="pma-np">${on ? newPriceTxt(key, amt) : ''}</span></small></div>
            ${amtInput(key, on, amt)}
          </div>`;
        }).join('');
        return `<div class="pma-grp">
          <div class="pma-ph" data-pid="${esc(p.id)}">
            ${img}
            <div class="pma-pn"><b>${esc(p.name)}</b><small>${esc(p.category || '')} · ${p.durations.length} ໄລຍະ${n ? ` · ເລືອກ ${n}` : ''}</small></div>
            <button type="button" class="pma-allbtn" data-a="grp">${n === keys.length ? 'ຍົກເລີກທັງໝົດ' : 'ເລືອກທຸກໄລຍະ'}</button>
          </div>${subs}</div>`;
      }
      const key = 'p:' + p.id, on = picked.has(key), amt = picked.get(key);
      return `<div class="pma-prod ${on ? 'on' : ''}" data-k="${esc(key)}">
        <button type="button" class="pma-chk" aria-label="ເລືອກ">${on ? '✓' : ''}</button>
        ${img}
        <div class="pma-pn"><b>${esc(p.name)}</b><small>${esc(p.category || '')} · ${kip(p.price)}<span class="pma-np">${on ? newPriceTxt(key, amt) : ''}</span></small></div>
        ${amtInput(key, on, amt)}
      </div>`;
    }).join('') : '<div class="pma-empty">ບໍ່ພົບສິນຄ້າ</div>';
    $('pmaPickCount').textContent = picked.size ? `ເລືອກແລ້ວ ${picked.size}` : 'ຍັງບໍ່ເລືອກ';
    upd();
  }
  function refreshNewPrices() {
    document.querySelectorAll('#pmaProdList .pma-prod[data-k]').forEach((row) => {
      const el = row.querySelector('.pma-np');
      if (!el) return;
      const k = row.dataset.k;
      el.innerHTML = picked.has(k) ? newPriceTxt(k, picked.get(k)) : '';
    });
  }

  /* ---------- สรุป + ตัวอย่างป้าย ---------- */
  function badgePreview(pct, off) {
    if (!(pct >= 1) && !(off > 0)) return '';
    const showPct = pct >= 1;
    const big = showPct ? `-${pct}<small>%</small>` : `-${fmt(off)}`;
    const cls = ['prod-promo-badge', showPct ? '' : 'is-amount', pct >= 100 ? 'is-wide' : ''].filter(Boolean).join(' ');
    return `<div class="pma-prev"><div class="${cls}"><span class="ppb-in"><span class="ppb-top">SALE</span><span class="ppb-num">${big}</span></span></div><span class="pma-prev-t">ປ້າຍທີ່ລູກຄ້າຈະເຫັນເທິງການ໌ດສິນຄ້າ</span></div>`;
  }
  function previewFor() {
    for (const [k, amt] of picked) {
      const info = rowInfo.get(k), a = Number(amt) || 0;
      if (!info || !a) continue;
      return badgePreview(info.price ? Math.round(Math.min(a, info.price) / info.price * 100) : 0, a);
    }
    return '';
  }
  function upd() {
    const end = calcEnd();
    const endTxt = Number.isFinite(end) ? fmtDate(end) : '—';
    const n = picked.size;
    const line = n ? `ລົດລາຄາ <b>${n}</b> ລາຍການ (ແຕ່ລະອັນຕາມຍອດທີ່ໃສ່)` : 'ຕິກເລືອກສິນຄ້າ (ຫຼືໄລຍະ) ແລ້ວໃສ່ຍອດທີ່ຈະລົດ';
    $('pmaSum').innerHTML = `${line}<br>ໝົດເວລາ: <b>${esc(endTxt)}</b>${previewFor()}`;
    refreshNewPrices();
  }

  /* ---------- สร้างโปรโมชั่น ---------- */
  async function submitCreate(e) {
    e.preventDefault();
    if (saving) return;
    setErr('');
    const title = $('pmaTitle').value.trim() || 'ໂປຣໂມຊັ່ນ';
    const start = startMs(), end = calcEnd();

    if (!picked.size) return setErr('ກະລຸນາເລືອກສິນຄ້າຢ່າງໜ້ອຍ 1 ອັນ');
    for (const [k, amt] of picked) {
      const info = rowInfo.get(k);
      if (!(Number(amt) > 0)) return setErr(`ໃສ່ຍອດທີ່ຈະລົດຂອງ "${info ? info.name : k}"`);
      if (info && Number(amt) > info.price) return setErr(`ຍອດລົດຂອງ "${info.name}" ຫຼາຍກວ່າລາຄາສິນຄ້າ (${kip(info.price)})`);
    }
    if (!Number.isFinite(end)) return setErr('ກະລຸນາກຳນົດເວລາໝົດໂປຣ');
    if (end <= Date.now()) return setErr('ເວລາໝົດໂປຣຕ້ອງເປັນເວລາໃນອະນາຄົດ');
    if (end <= start) return setErr('ເວລາໝົດຕ້ອງຫຼັງຈາກເວລາເລີ່ມ');

    saving = true;
    const btn = $('pmaCreate');
    btn.disabled = true;
    try {
      const row = {
        title, mode: 'fixed', percent: null, apply_all: false,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
        active: true,
      };
      const ins = await supabaseClient.from('promotions').insert(row).select('id').single();
      if (ins.error) throw ins.error;
      const pid = ins.data.id;
      const items = [...picked.entries()].map(([k, amt]) => {
        const info = rowInfo.get(k);
        return { promotion_id: pid, product_id: info.pid, duration_id: info.did, amount: Number(amt) };
      });
      const it = await supabaseClient.from('promotion_items').insert(items);
      if (it.error) {
        await supabaseClient.from('promotions').delete().eq('id', pid); // ย้อนกลับ ไม่ให้เหลือโปรครึ่งๆ
        throw it.error;
      }
      toast('ສ້າງໂປຣໂມຊັ່ນແລ້ວ');
      $('pmaTitle').value = ''; picked.clear();
      renderProducts();
      await loadPromos();
    } catch (err) {
      console.error('promotions create failed:', err);
      setErr('ສ້າງບໍ່ສຳເລັດ: ' + ((err && err.message) || 'ລອງໃໝ່ພາຍຫຼັງ'));
    } finally {
      saving = false;
      btn.disabled = false;
    }
  }

  /* ---------- รายการโปรโมชั่น ---------- */
  function cardHtml(p) {
    const st = statusOf(p);
    const items = p.promotion_items || [];
    const pids = [...new Set(items.map((i) => i.product_id))];
    const names = pids.slice(0, 3).map((id) => { const pr = products.find((x) => x.id === id); return pr ? pr.name : ''; }).filter(Boolean);
    const durCount = items.filter((i) => i.duration_id).length;
    const scopeTxt = p.mode === 'percent' && p.apply_all
      ? 'ທຸກສິນຄ້າ'
      : `${pids.length} ສິນຄ້າ${durCount ? ` (${durCount} ໄລຍະ)` : ''}${names.length ? ' · ' + names.map(esc).join(', ') + (pids.length > names.length ? '…' : '') : ''}`;
    const what = p.mode === 'percent' ? `ລົດ ${Number(p.percent)}%` : 'ລົດເປັນລາຄາ';
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
    const { data, error } = await supabaseClient.from('promotions').select('*, promotion_items(product_id, duration_id, amount)').order('created_at', { ascending: false }).limit(200);
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
  function toggleKey(k) { if (picked.has(k)) picked.delete(k); else picked.set(k, ''); }
  function bind() {
    if (bound || !$('pmaForm')) return;
    bound = true;

    $('pmaSearch').addEventListener('input', renderProducts);

    $('pmaProdList').addEventListener('click', (e) => {
      if (e.target.closest('.pma-amt')) return;
      const grpBtn = e.target.closest('button[data-a="grp"]');
      if (grpBtn) { // เลือก/ยกเลิกทุกระยะของสินค้านั้น
        const p = products.find((x) => x.id === grpBtn.closest('.pma-ph').dataset.pid);
        if (!p) return;
        const keys = keysOf(p);
        const all = keys.every((k) => picked.has(k));
        keys.forEach((k) => { if (all) picked.delete(k); else if (!picked.has(k)) picked.set(k, ''); });
        renderProducts();
        return;
      }
      const row = e.target.closest('.pma-prod[data-k]'); if (!row) return;
      const k = row.dataset.k;
      toggleKey(k);
      renderProducts();
      if (picked.has(k)) {
        const inp = $('pmaProdList').querySelector(`.pma-prod[data-k="${CSS.escape(k)}"] input`);
        if (inp) inp.focus();
      }
    });
    $('pmaProdList').addEventListener('input', (e) => {
      if (e.target.dataset.a !== 'amt') return;
      e.target.value = e.target.value.replace(/\D/g, '');
      picked.set(e.target.closest('.pma-prod').dataset.k, e.target.value);
      setErr(''); upd();
    });
    $('pmaSelAll').addEventListener('click', () => {
      const q = $('pmaSearch').value.trim().toLowerCase();
      products.filter((p) => matches(p, q)).forEach((p) => keysOf(p).forEach((k) => { if (!picked.has(k)) picked.set(k, ''); }));
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
