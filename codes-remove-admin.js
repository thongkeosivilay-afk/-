/* =========================================================
   codes-remove-admin.js — แผง "ເອົາລະຫັດອອກ" ในห้องแอดมิน (admin.html > #panelRemoveCodes)
   เอารหัสที่เติมเข้าสินค้าแล้ว "ยังไม่ถูกขาย" ออกมาคืน แทนที่จะต้องไปซื้อเอง
   - เลือกสินค้า (+ระยะเวลา) -> แสดงเฉพาะรหัสที่ยังไม่ถูกใช้ (used_by IS NULL และ is_used = false)
   - ติ๊กเลือกได้หลายรหัส / เลือกทั้งหมด / เลือก N อันล่าสุด-เก่าสุด / ค้นหา
   - "ເອົາອອກ": ลบรหัสที่เลือก แล้วโชว์รหัสที่ลบ ให้คัดลอก/ดาวน์โหลดเก็บไว้
   - "ຍ້າຍ": ย้ายรหัสที่เลือกไปสินค้า/ระยะเวลาอื่น (เติมผิดสินค้า) โดยไม่ต้องลบแล้วเติมใหม่
   - ทุกคำสั่งกรองซ้ำที่ฝั่งฐานข้อมูลว่า "ยังไม่ถูกขาย" รหัสที่ขายไปแล้วลบ/ย้ายไม่ได้แน่นอน
   - อ่าน/เขียนตาราง product_codes ผ่าน supabaseClient (-> Worker proxy ที่เช็คสิทธิ์แอดมิน)
   - ถูกเรียกจาก initAdminPanel() ใน admin.js; รายการสินค้ามาจาก currentProducts (global ของ admin.js)
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escapeHtmlAdmin === 'function'
    ? escapeHtmlAdmin(s)
    : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const toast = (t) => { if (typeof showToast === 'function') showToast(t); };

  // คัดลอกข้อความ: ลอง Clipboard API ก่อน ถ้าถูกบล็อก (เช่น http/บางเบราว์เซอร์) ใช้ textarea + execCommand สำรอง
  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(okMsg);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
      toast(ok ? okMsg : 'ຄັດລອກບໍ່ໄດ້ — ລອງໃໝ່ອີກຄັ້ງ');
      return ok;
    }
  }

  const PAGE_LIMIT = 1000;   // PostgREST ส่งกลับได้สูงสุด ~1000 แถวต่อครั้ง
  const CHUNK = 100;         // แบ่งส่งทีละ 100 id กัน URL ยาวเกิน

  let rows = [];             // [{ id, code, created_at }] ของสินค้า/ระยะเวลาที่เลือกอยู่ (ใหม่สุดก่อน)
  let total = 0;             // จำนวนรหัสที่ยังไม่ถูกขายทั้งหมด (อาจมากกว่า rows ถ้าเกิน PAGE_LIMIT)
  const selected = new Set();
  let loadedOnce = false;
  let bound = false;
  let busy = false;
  let loadSeq = 0;           // กันผลโหลดเก่ามาทับผลใหม่ เมื่อผู้ใช้สลับสินค้าเร็วๆ

  /* ---------- helpers ---------- */
  function product() {
    const sel = $('rcProduct');
    return plist().find((p) => p.id === sel.value);
  }
  function durationId() {
    const p = product();
    return p && p.duration_enabled ? ($('rcDuration').value || null) : null;
  }
  function preview(code) {
    const one = String(code || '').replace(/\s+/g, ' ').trim();
    return one.length > 70 ? one.slice(0, 70) + '…' : one;
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const p2 = (n) => String(n).padStart(2, '0');
    return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }
  function chunks(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }
  function msg(text, kind) {
    const el = $('rcMsg');
    if (typeof setMsg === 'function') setMsg(el, text, kind);
    else el.textContent = text || '';
  }
  function setBusy(v) {
    busy = v;
    ['rcRemoveBtn', 'rcMoveBtn', 'rcMoveConfirm'].forEach((id) => {
      const b = $(id);
      if (b) { b.disabled = v; b.classList.toggle('loading', v); }
    });
  }
  // ตัวกรอง "รหัสที่ยังไม่ถูกขาย" ของสินค้า/ระยะเวลาที่เลือก — ใช้ซ้ำทั้งตอนอ่าน ลบ และย้าย
  function scopeUnused(q, pid, did, durationEnabled) {
    q = q.eq('product_id', pid).is('used_by', null).eq('is_used', false);
    return durationEnabled ? q.eq('duration_id', did) : q.is('duration_id', null);
  }

  /* ---------- รายการสินค้า (ดึงจริงจาก Supabase) ---------- */
  // ปกติใช้ currentProducts จาก admin.js; ถ้าว่าง (โหลดไม่สำเร็จ/ยังไม่มา) ดึง products + product_durations เองตรงๆ
  let localProducts = [];
  let prodErr = '';
  let fetching = false;
  function plist() {
    const c = typeof currentProducts !== 'undefined' ? currentProducts : [];
    return c && c.length ? c : localProducts;
  }
  async function fetchProductsDirect() {
    if (fetching) return;
    fetching = true;
    try {
      const { data: ps, error } = await supabaseClient.from('products').select('*').order('created_at', { ascending: false });
      if (error) { prodErr = error.message || 'ດຶງສິນຄ້າບໍ່ສຳເລັດ'; return; }
      const { data: ds } = await supabaseClient.from('product_durations').select('*').order('sort_order', { ascending: true });
      localProducts = (ps || []).map((p) => ({
        ...p,
        durations: (ds || []).filter((d) => d.product_id === p.id).sort((a, b) => durationToHours(a.label) - durationToHours(b.label)).map((d) => ({ ...d, stock: d.stock != null ? d.stock : 0 })),
      }));
      prodErr = '';
    } catch (e) {
      prodErr = String((e && e.message) || e);
    } finally {
      fetching = false;
    }
  }
  async function ensureProducts() {
    if (plist().filter((p) => !p.archived).length) return;
    await fetchProductsDirect();
    fillProducts();
    if (!loadedOnce && plist().filter((p) => !p.archived).length) loadCodes();
  }

  /* ---------- เลือกสินค้า / ระยะเวลา ---------- */
  function fillProducts() {
    const sel = $('rcProduct');
    if (!sel) return;
    const prev = sel.value;
    const list = plist().filter((p) => !p.archived);
    sel.innerHTML = list.length
      ? list.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')
      : `<option value="">${prodErr ? 'ໂຫຼດສິນຄ້າບໍ່ສຳເລັດ — ກົດ “ໂຫຼດໃໝ່”' : 'ຍັງບໍ່ມີສິນຄ້າ — ເພີ່ມສິນຄ້າກ່ອນ'}</option>`;
    if (!list.length && prodErr) msg('ດຶງສິນຄ້າບໍ່ສຳເລັດ: ' + prodErr, 'error');
    if (prev && list.some((p) => p.id === prev)) sel.value = prev;
    fillDurations();
    fillMoveTargets();
  }
  function fillDurations() {
    const p = product();
    const wrap = $('rcDurationWrap');
    const sel = $('rcDuration');
    if (!p || !p.duration_enabled) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    const prev = sel.value;
    sel.innerHTML = (p.durations || [])
      .map((d) => `<option value="${d.id}">${esc(d.label)} • ຄົງເຫຼືອ ${d.stock}</option>`)
      .join('') || '<option value="">ຍັງບໍ່ມີຕົວເລືອກໄລຍະເວລາ</option>';
    if (prev && (p.durations || []).some((d) => d.id === prev)) sel.value = prev;
  }
  function fillMoveTargets() {
    const sel = $('rcMoveProduct');
    if (!sel) return;
    const prev = sel.value;
    const list = plist().filter((p) => !p.archived);
    sel.innerHTML = list.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if (prev && list.some((p) => p.id === prev)) sel.value = prev;
    fillMoveDurations();
  }
  function fillMoveDurations() {
    const p = plist().find((x) => x.id === $('rcMoveProduct').value);
    const wrap = $('rcMoveDurationWrap');
    const sel = $('rcMoveDuration');
    if (!p || !p.duration_enabled) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    const prev = sel.value;
    sel.innerHTML = (p.durations || [])
      .map((d) => `<option value="${d.id}">${esc(d.label)} • ຄົງເຫຼືອ ${d.stock}</option>`)
      .join('') || '<option value="">ຍັງບໍ່ມີຕົວເລືອກໄລຍະເວລາ</option>';
    if (prev && (p.durations || []).some((d) => d.id === prev)) sel.value = prev;
  }

  /* ---------- โหลด/แสดงรายการรหัส ---------- */
  async function loadCodes() {
    const p = product();
    const list = $('rcList');
    selected.clear();
    rows = [];
    total = 0;
    if (!p) { list.innerHTML = '<div class="rc-empty">ຍັງບໍ່ມີສິນຄ້າ</div>'; renderBar(); return; }
    const did = durationId();
    if (p.duration_enabled && !did) { list.innerHTML = '<div class="rc-empty">ກະລຸນາເລືອກໄລຍະເວລາ</div>'; renderBar(); return; }

    const seq = ++loadSeq;
    list.innerHTML = '<div class="rc-empty">ກຳລັງໂຫຼດ...</div>';
    const { data, error, count } = await scopeUnused(
      supabaseClient.from('product_codes').select('id, code, created_at', { count: 'exact' }),
      p.id, did, !!p.duration_enabled
    ).order('created_at', { ascending: false }).range(0, PAGE_LIMIT - 1);
    if (seq !== loadSeq) return; // ผู้ใช้เปลี่ยนสินค้าไปแล้ว ทิ้งผลเก่า

    if (error) {
      console.error(error);
      list.innerHTML = '<div class="rc-empty">ໂຫຼດບໍ່ສຳເລັດ: ' + esc(error.message) + '</div>';
      renderBar();
      return;
    }
    rows = data || [];
    total = typeof count === 'number' ? count : rows.length;
    loadedOnce = true;
    renderList();
  }

  function visibleRows() {
    const q = ($('rcSearch').value || '').trim().toLowerCase();
    return q ? rows.filter((r) => String(r.code).toLowerCase().includes(q)) : rows;
  }

  function renderList() {
    const list = $('rcList');
    const vis = visibleRows();
    if (!rows.length) {
      list.innerHTML = '<div class="rc-empty">ບໍ່ມີລະຫັດທີ່ຍັງບໍ່ຖືກຂາຍໃນລາຍການນີ້</div>';
    } else if (!vis.length) {
      list.innerHTML = '<div class="rc-empty">ບໍ່ພົບລະຫັດທີ່ຄົ້ນຫາ</div>';
    } else {
      list.innerHTML = vis.map((r, i) => `
        <label class="rc-row${selected.has(r.id) ? ' on' : ''}" data-id="${r.id}">
          <input type="checkbox" class="rc-chk" value="${r.id}"${selected.has(r.id) ? ' checked' : ''}>
          <span class="rc-idx">${i + 1}</span>
          <span class="rc-code" title="${esc(r.code)}">${esc(preview(r.code))}</span>
          <span class="rc-date">${esc(fmtDate(r.created_at))}</span>
          <button type="button" class="rc-cpy" data-id="${r.id}">ຄັດລອກ</button>
        </label>`).join('');
    }
    $('rcCount').textContent = total.toLocaleString('en-US');
    const note = $('rcLimitNote');
    note.style.display = total > rows.length ? 'block' : 'none';
    note.textContent = total > rows.length ? `ສະແດງ ${rows.length} ລະຫັດລ່າສຸດ ຈາກທັງໝົດ ${total} — ເອົາອອກແລ້ວຈະເຫັນອັນທີ່ເຫຼືອ` : '';
    renderBar();
  }

  function renderBar() {
    const n = selected.size;
    $('rcSelCount').textContent = n.toLocaleString('en-US');
    $('rcRemoveBtn').disabled = busy || n === 0;
    $('rcMoveBtn').disabled = busy || n === 0;
    $('rcCopySel').disabled = n === 0;
    if (n === 0) $('rcMovePanel').style.display = 'none';
  }

  function selectedCodes() {
    return rows.filter((r) => selected.has(r.id));
  }

  function copySelected() {
    const codes = selectedCodes().slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map((r) => r.code);
    if (!codes.length) return;
    copyText(codes.join('\n'), `ຄັດລອກ ${codes.length} ລະຫັດທີ່ເລືອກແລ້ວ`);
  }

  /* ---------- ເອົາອອກ (ลบ) ---------- */
  async function removeSelected() {
    if (busy) return;
    const p = product();
    const did = durationId();
    const picks = selectedCodes();
    if (!p || !picks.length) return;
    if (!confirm(`ເອົາລະຫັດອອກ ${picks.length} ລາຍການ ຈາກ "${p.name}"?\n\nລະຫັດຈະຖືກລຶບອອກຈາກສະຕັອກ (ລູກຄ້າຈະຊື້ບໍ່ໄດ້ອີກ). ຫຼັງລຶບຈະມີປຸ່ມຄັດລອກລະຫັດໃຫ້ເກັບໄວ້.`)) return;

    setBusy(true);
    msg('ກຳລັງເອົາລະຫັດອອກ...', 'pending');
    const removed = [];
    let failed = null;
    try {
      for (const part of chunks(picks.map((r) => r.id), CHUNK)) {
        // ลบเฉพาะที่ "ยังไม่ถูกขาย" จริงๆ ณ ตอนนี้ (กันกรณีมีลูกค้าซื้อตัดหน้าระหว่างที่แอดมินเลือกอยู่)
        const { data, error } = await scopeUnused(
          supabaseClient.from('product_codes').delete().in('id', part),
          p.id, did, !!p.duration_enabled
        ).select('id, code, created_at');
        if (error) { failed = error; break; }
        (data || []).forEach((r) => removed.push(r));
      }
    } catch (err) {
      failed = err;
    }
    setBusy(false);

    if (failed) console.error(failed);
    const skipped = picks.length - removed.length;
    if (failed) {
      msg(`ເກີດຂໍ້ຜິດພາດ: ${failed.message || 'ລອງໃໝ່'} — ເອົາອອກໄດ້ ${removed.length}/${picks.length}`, 'error');
    } else if (skipped > 0) {
      msg(`ເອົາອອກສຳເລັດ ${removed.length} ລາຍການ — ຂ້າມ ${skipped} ລາຍການ (ຖືກຂາຍໄປແລ້ວ ຫຼືຖືກລຶບກ່ອນໜ້າ)`, 'success');
    } else {
      msg(`ເອົາລະຫັດອອກສຳເລັດ ${removed.length} ລາຍການ`, 'success');
    }
    if (removed.length) showResult(removed, p.name);
    if (typeof loadProducts === 'function') await loadProducts();
    await loadCodes();
  }

  /* ---------- ຜົນລັບ: ໃຫ້ຄັດລອກ/ດາວໂຫຼດລະຫັດທີ່ເອົາອອກ ---------- */
  function showResult(removed, productName) {
    // เรียงเก่า->ใหม่ ตามลำดับที่เติมเข้ามา เพื่อเอาไปเติมกลับที่อื่นได้ตรงลำดับเดิม
    const sorted = removed.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const text = sorted.map((r) => r.code).join('\n');
    $('rcResultTitle').textContent = `ລະຫັດທີ່ເອົາອອກ (${sorted.length}) — ${productName}`;
    $('rcResultText').value = text;
    $('rcResult').style.display = 'block';
    $('rcResult').dataset.name = productName;
    $('rcResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  async function copyResult() {
    const t = $('rcResultText').value;
    if (!t) return;
    await copyText(t, 'ຄັດລອກລະຫັດທີ່ເອົາອອກທັງໝົດແລ້ວ');
  }
  function downloadResult() {
    const t = $('rcResultText').value;
    if (!t) return;
    const name = ($('rcResult').dataset.name || 'codes').replace(/[^\w\u0E80-\u0EFF-]+/g, '_');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const blob = new Blob([t + '\n'], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `removed-codes_${name}_${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- ຍ້າຍໄປສິນຄ້າອື່ນ ---------- */
  async function moveSelected() {
    if (busy) return;
    const p = product();
    const did = durationId();
    const picks = selectedCodes();
    const allProducts = typeof currentProducts !== 'undefined' ? currentProducts : [];
    const target = allProducts.find((x) => x.id === $('rcMoveProduct').value);
    if (!p || !target || !picks.length) return;
    const targetDid = target.duration_enabled ? ($('rcMoveDuration').value || null) : null;
    if (target.duration_enabled && !targetDid) { msg('ກະລຸນາເລືອກໄລຍະເວລາປາຍທາງ', 'error'); return; }
    if (target.id === p.id && (targetDid || null) === (did || null)) { msg('ປາຍທາງຄືອັນເດີມ — ເລືອກສິນຄ້າ/ໄລຍະເວລາອື່ນ', 'error'); return; }

    const tLabel = target.duration_enabled
      ? `${target.name} (${((target.durations || []).find((d) => d.id === targetDid) || {}).label || ''})`
      : target.name;
    if (!confirm(`ຍ້າຍ ${picks.length} ລະຫັດ ໄປທີ່ "${tLabel}"?`)) return;

    setBusy(true);
    msg('ກຳລັງຍ້າຍລະຫັດ...', 'pending');
    let moved = 0;
    let failed = null;
    try {
      for (const part of chunks(picks.map((r) => r.id), CHUNK)) {
        const { data, error } = await scopeUnused(
          supabaseClient.from('product_codes').update({ product_id: target.id, duration_id: targetDid }).in('id', part),
          p.id, did, !!p.duration_enabled
        ).select('id');
        if (error) { failed = error; break; }
        moved += (data || []).length;
      }
    } catch (err) {
      failed = err;
    }
    setBusy(false);

    if (failed) {
      console.error(failed);
      msg(`ເກີດຂໍ້ຜິດພາດ: ${failed.message || 'ລອງໃໝ່'} — ຍ້າຍໄດ້ ${moved}/${picks.length}`, 'error');
    } else if (moved < picks.length) {
      msg(`ຍ້າຍສຳເລັດ ${moved} ລາຍການ — ຂ້າມ ${picks.length - moved} ລາຍການ (ຖືກຂາຍໄປແລ້ວ ຫຼືຖືກລຶບກ່ອນໜ້າ)`, 'success');
    } else {
      msg(`ຍ້າຍລະຫັດສຳເລັດ ${moved} ລາຍການ ໄປທີ່ "${tLabel}"`, 'success');
    }
    $('rcMovePanel').style.display = 'none';
    if (typeof loadProducts === 'function') await loadProducts();
    await loadCodes();
  }

  /* ---------- เลือกด่วน ---------- */
  function selectAllVisible() {
    visibleRows().forEach((r) => selected.add(r.id));
    renderList();
  }
  function clearSelection() {
    selected.clear();
    renderList();
  }
  function selectN() {
    const n = parseInt(String($('rcPickN').value).replace(/\D/g, ''), 10) || 0;
    if (n <= 0) { msg('ໃສ່ຈຳນວນທີ່ຕ້ອງການເລືອກ', 'error'); return; }
    msg('', '');
    const order = $('rcPickOrder').value; // 'new' | 'old'
    const vis = visibleRows();
    const pool = order === 'old' ? vis.slice().reverse() : vis; // rows เรียงใหม่สุดก่อนอยู่แล้ว
    selected.clear();
    pool.slice(0, n).forEach((r) => selected.add(r.id));
    renderList();
  }

  /* ---------- bind ---------- */
  function bind() {
    if (bound) return;
    bound = true;

    $('rcProduct').addEventListener('change', () => { fillDurations(); $('rcResult').style.display = 'none'; msg('', ''); loadCodes(); });
    $('rcDuration').addEventListener('change', () => { $('rcResult').style.display = 'none'; msg('', ''); loadCodes(); });
    $('rcRefresh').addEventListener('click', loadCodes);
    $('rcSearch').addEventListener('input', renderList);
    $('rcSelectAll').addEventListener('click', selectAllVisible);
    $('rcClear').addEventListener('click', clearSelection);
    $('rcPickBtn').addEventListener('click', selectN);
    $('rcRemoveBtn').addEventListener('click', removeSelected);
    $('rcMoveBtn').addEventListener('click', () => {
      const pn = $('rcMovePanel');
      pn.style.display = pn.style.display === 'block' ? 'none' : 'block';
      if (pn.style.display === 'block') fillMoveTargets();
    });
    $('rcMoveProduct').addEventListener('change', fillMoveDurations);
    $('rcMoveConfirm').addEventListener('click', moveSelected);
    $('rcCopySel').addEventListener('click', copySelected);
    // ปุ่มคัดลอกรายตัวในแต่ละแถว (กดแล้วไม่ติ๊กเลือกแถว)
    $('rcList').addEventListener('click', (e) => {
      const btn = e.target.closest('.rc-cpy');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const r = rows.find((x) => x.id === btn.dataset.id);
      if (!r) return;
      copyText(r.code, 'ຄັດລອກລະຫັດແລ້ວ');
      btn.classList.add('done');
      btn.textContent = 'ແລ້ວ ✓';
      setTimeout(() => { btn.classList.remove('done'); btn.textContent = 'ຄັດລອກ'; }, 1000);
    });
    $('rcCopy').addEventListener('click', copyResult);
    $('rcDownload').addEventListener('click', downloadResult);
    $('rcResultClose').addEventListener('click', () => { $('rcResult').style.display = 'none'; });

    $('rcList').addEventListener('change', (e) => {
      const cb = e.target.closest('.rc-chk');
      if (!cb) return;
      if (cb.checked) selected.add(cb.value); else selected.delete(cb.value);
      const row = cb.closest('.rc-row');
      if (row) row.classList.toggle('on', cb.checked);
      renderBar();
    });

    // โหลดรายการครั้งแรกตอนแอดมินเปิดแผงนี้ (ไม่ยิงฐานข้อมูลตั้งแต่เปิดหน้า)
    const openers = document.querySelectorAll('.d2-fn-card[data-goto="panelRemoveCodes"], .switch[data-target="panelRemoveCodes"] .switch-head');
    openers.forEach((el) => el.addEventListener('click', () => {
      fillProducts();
      ensureProducts();
      if (!loadedOnce && plist().length) loadCodes();
    }));
  }

  /* ---------- public ---------- */
  // admin.js เรียกทุกครั้งที่ loadProducts() เสร็จ: อัปเดตรายการสินค้าในตัวเลือก โดยคงค่าที่เลือกไว้ ไม่แตะรายการรหัส
  window.refreshRemoveCodesProducts = function () {
    if (!$('rcProduct')) return;
    fillProducts();
  };
  window.initRemoveCodesPanel = function () {
    if (!$('rcProduct')) return;
    bind();
    fillProducts();
    ensureProducts();
  };
})();
