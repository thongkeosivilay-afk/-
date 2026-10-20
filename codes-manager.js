/* codes-manager.js — แผง "ຄັງລະຫັດ" (#panelCodeVault) ในห้องแอดมิน: ดู/ซ่อน/คัดลอก/ดึงคืนรหัสที่ยังไม่ขาย
   อ่าน/ลบตาราง product_codes ผ่าน supabaseClient (-> Worker proxy เช็คสิทธิ์แอดมิน); กรอง "ยังไม่ถูกขาย" ทุกคำสั่ง */
(function () {
  const CSS = `#cmRoot .rc-note{ font-size:12.5px; color:var(--ink-300,#aaadc8); line-height:1.55; margin:0 0 14px; } #cmRoot .rc-head-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin:14px 0 8px; } #cmRoot .rc-total{ font-size:13px; color:var(--ink-300,#aaadc8); } #cmRoot .rc-total b{ color:#fff; font-size:15px; } #cmRoot .rc-refresh{ border:1px solid var(--navy-700,#222); background:transparent; color:var(--ink-100,#edeefc); border-radius:10px; padding:7px 12px; font:inherit; font-size:12.5px; cursor:pointer; } #cmRoot .rc-tools{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; } #cmRoot .rc-btn{ border:1px solid var(--navy-700,#222); background:var(--navy-800,#141414); color:var(--ink-100,#edeefc); border-radius:10px; padding:8px 12px; font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; } #cmRoot .rc-btn:active{ transform:scale(.97); } #cmRoot .rc-pick{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; border:1px solid var(--navy-700,#222); border-radius:10px; padding:4px 6px; background:var(--navy-900,#0a0a0a); } #cmRoot .rc-pick input, #cmRoot .rc-pick select{ background:var(--navy-800,#141414); color:#fff; border:1px solid var(--navy-700,#222); border-radius:8px; padding:6px 8px; font:inherit; font-size:12.5px; width:64px; } #cmRoot .rc-pick select{ width:auto; } #cmRoot .rc-search{ margin-bottom:10px; } #cmRoot .rc-list{ max-height:340px; overflow-y:auto; border:1px solid var(--navy-700,#222); border-radius:14px; background:var(--navy-900,#0a0a0a); -webkit-overflow-scrolling:touch; } #cmRoot .rc-row{ display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,.05); } #cmRoot .rc-row:last-child{ border-bottom:none; } #cmRoot .rc-row.on{ background:rgba(45,65,255,.14); } #cmRoot .rc-chk{ width:18px; height:18px; flex:none; accent-color:#2d41ff; } #cmRoot .rc-idx{ width:30px; flex:none; font-size:11.5px; color:var(--ink-500,#78839b); text-align:right; } #cmRoot .rc-code{ flex:1; min-width:0; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12.5px; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } #cmRoot .rc-date{ flex:none; font-size:11px; color:var(--ink-500,#78839b); } #cmRoot .rc-empty{ padding:26px 14px; text-align:center; font-size:13px; color:var(--ink-500,#78839b); } #cmRoot .rc-limit{ display:none; font-size:12px; color:#e8b34a; margin-top:8px; } #cmRoot .rc-bar{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:12px; padding:10px 12px; border:1px solid var(--navy-700,#222); border-radius:14px; background:var(--navy-800,#141414); } #cmRoot .rc-sel{ font-size:13px; color:var(--ink-300,#aaadc8); } #cmRoot .rc-sel b{ color:#fff; font-size:16px; } #cmRoot .rc-actions{ display:flex; gap:8px; } #cmRoot .rc-act{ border:1px solid var(--navy-700,#222); border-radius:10px; padding:9px 14px; font:inherit; font-size:13px; font-weight:700; cursor:pointer; background:transparent; color:#fff; } #cmRoot .rc-act.danger{ background:#a11d2b; border-color:rgba(255,59,59,.5); } #cmRoot .rc-act:disabled{ opacity:.4; cursor:default; } #cmRoot .rc-move{ display:none; margin-top:10px; padding:12px; border:1px dashed var(--navy-700,#222); border-radius:14px; } #cmRoot .rc-move .gx-field:last-of-type{ margin-bottom:8px; } #cmRoot .rc-result{ display:none; margin-top:14px; padding:12px; border:1px solid rgba(46,204,113,.35); border-radius:14px; background:rgba(46,204,113,.06); } #cmRoot .rc-result-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; } #cmRoot .rc-result-title{ font-size:13px; font-weight:700; color:#fff; } #cmRoot .rc-result textarea{ width:100%; min-height:110px; resize:vertical; box-sizing:border-box; background:var(--navy-900,#0a0a0a); color:#fff; border:1px solid var(--navy-700,#222); border-radius:10px; padding:10px; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12px; line-height:1.5; } #cmRoot .rc-result-btns{ display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; } #cmRoot .rc-cpy{ flex:none; border:1px solid var(--navy-700,#222); background:var(--navy-800,#141414); color:var(--ink-300,#aaadc8); border-radius:8px; padding:4px 9px; font:inherit; font-size:11.5px; font-weight:600; cursor:pointer; } #cmRoot .rc-cpy.done{ background:rgba(46,204,113,.15); border-color:rgba(46,204,113,.5); color:#2ecc71; } #cmRoot .cm-title{margin:0 0 4px;font-size:16px;color:#fff}#cmRoot .rc-dup{flex:none;font-size:11px;background:#f2a516;color:#000;border-radius:6px;padding:1px 6px;font-weight:700}#cmRoot .rc-btn:disabled,#cmRoot .rc-refresh:disabled{opacity:.4;cursor:default}#cmRoot .rc-search input{width:100%;box-sizing:border-box}#cmRoot .rc-code{white-space:pre-wrap;word-break:break-all;overflow:visible}#cmRoot .rc-pre{font-size:12.5px;color:var(--ink-300,#aaadc8);margin:0 0 12px}`;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escapeHtmlAdmin === 'function' ? escapeHtmlAdmin(s) : String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'));
  const toast = (m) => (typeof showToast === 'function' ? showToast(m) : alert(m));
  const prods = () => (typeof currentProducts !== 'undefined' ? currentProducts : []);
  const PAGE = 1000, CHUNK = 100;
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select(); let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      t.remove(); return ok;
    }
  }
  const joinCodes = (arr) => arr.join(arr.some((c) => c.includes('\n')) ? '\n\n' : '\n');
  const mask = (c) => (c.length <= 6 ? '••••••' : c.slice(0, 3) + '•'.repeat(Math.min(c.length - 5, 14)) + c.slice(-2));
  const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const scope = (q, pid, did, dur) => { q = q.eq('product_id', pid).is('used_by', null).eq('is_used', false); return dur ? q.eq('duration_id', did) : q.is('duration_id', null); };

  let rows = [], total = 0, selected = new Set(), revealed = false, q = '', bound = false, loadedOnce = false, seq = 0;
  const product = () => prods().find((p) => p.id === $('cmProduct').value);
  const durId = () => { const p = product(); return p && p.duration_enabled ? ($('cmDuration').value || null) : null; };

  function fillProducts() {
    const s = $('cmProduct'); if (!s) return;
    const prev = s.value, list = prods().filter((p) => !p.archived);
    s.innerHTML = list.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if (prev && list.some((p) => p.id === prev)) s.value = prev;
    fillDurations();
  }
  function fillDurations() {
    const p = product(), w = $('cmDurationWrap'), s = $('cmDuration');
    if (!p || !p.duration_enabled) { w.style.display = 'none'; return; }
    w.style.display = 'block';
    const prev = s.value;
    s.innerHTML = (p.durations || []).map((d) => `<option value="${d.id}">${esc(d.label)} • ຄົງເຫຼືອ ${d.stock}</option>`).join('') || '<option value="">ຍັງບໍ່ມີຕົວເລືອກໄລຍະເວລາ</option>';
    if (prev && (p.durations || []).some((d) => d.id === prev)) s.value = prev;
  }
  const keyOf = (r) => String(r.id);
  const dupCount = () => { const m = {}; rows.forEach((r) => (m[r.code] = (m[r.code] || 0) + 1)); return m; };
  const chosen = () => rows.filter((r) => selected.has(keyOf(r)));

  function render() {
    const dups = dupCount();
    const view = rows.map((r, i) => ({ r, i })).filter((x) => !q || x.r.code.toLowerCase().includes(q));
    $('cmList').innerHTML = view.length ? view.map((x) => `<div class="rc-row${selected.has(keyOf(x.r)) ? ' on' : ''}" data-k="${keyOf(x.r)}">
<input type="checkbox" class="rc-chk" ${selected.has(keyOf(x.r)) ? 'checked' : ''}/><span class="rc-idx">${x.i + 1}</span>
<span class="rc-code">${esc(revealed ? x.r.code : mask(x.r.code))}</span>${dups[x.r.code] > 1 ? '<span class="rc-dup">ຊ້ຳ</span>' : ''}
<button class="rc-cpy" data-copy="${keyOf(x.r)}" type="button">ຄັດລອກ</button></div>`).join('') : `<div class="rc-empty">${rows.length ? 'ບໍ່ພົບລະຫັດທີ່ຄົ້ນຫາ' : 'ບໍ່ມີລະຫັດທີ່ຍັງບໍ່ຖືກຂາຍ'}</div>`;
    const nd = Object.values(dups).filter((n) => n > 1).length;
    $('cmCount').textContent = total.toLocaleString('en-US');
    $('cmSel').textContent = selected.size.toLocaleString('en-US');
    $('cmLimit').style.display = total > rows.length ? 'block' : 'none';
    $('cmLimit').textContent = total > rows.length ? `ສະແດງ ${rows.length} ຈາກທັງໝົດ ${total} ລະຫັດ (ຄັດລອກ/ດາວໂຫຼດທັງໝົດ ຈະດຶງຄົບທຸກລະຫັດ)` : '';
    $('cmCopySel').disabled = !selected.size;
    $('cmMore').style.display = total > rows.length ? 'inline-block' : 'none';
    $('cmCopyAll').disabled = $('cmDl').disabled = !rows.length;
    $('cmDupe').disabled = !rows.length;
    $('cmReveal').textContent = revealed ? 'ເຊື່ອງລະຫັດ' : 'ສະແດງລະຫັດ';
  }

  const fetchPage = (p, did, from) => scope(supabaseClient.from('product_codes').select('id, code, created_at', { count: 'exact' }), p.id, did, !!p.duration_enabled)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + PAGE - 1);
  const clean = (data) => (data || []).filter((r) => r.code != null).map((r) => ({ ...r, code: String(r.code) }));

  async function load(more) {
    const p = product(), did = durId(), list = $('cmList');
    if (!more) { selected = new Set(); rows = []; total = 0; }
    if (!p) { list.innerHTML = '<div class="rc-empty">ຍັງບໍ່ມີສິນຄ້າ</div>'; return; }
    if (p.duration_enabled && !did) { list.innerHTML = '<div class="rc-empty">ກະລຸນາເລືອກໄລຍະເວລາ</div>'; return; }
    const my = ++seq; if (!more) list.innerHTML = '<div class="rc-empty">ກຳລັງໂຫຼດ...</div>';
    const { data, error, count } = await fetchPage(p, did, more ? rows.length : 0);
    if (my !== seq) return;
    if (error) { if (!more) list.innerHTML = '<div class="rc-empty">ໂຫຼດບໍ່ສຳເລັດ: ' + esc(error.message) + '</div>'; else toast('ໂຫຼດບໍ່ສຳເລັດ: ' + error.message); return; }
    const got = clean(data), have = new Set(rows.map((r) => r.id));
    rows = rows.concat(got.filter((r) => !have.has(r.id)));
    total = typeof count === 'number' ? count : rows.length;
    loadedOnce = true; render();
  }

  // ດຶງລະຫັດຄົບທຸກອັນ (ບໍ່ຈຳກັດສະເພາະທີ່ສະແດງ) ສຳລັບ ຄັດລອກທັງໝົດ / ດາວໂຫຼດ / ກວດລະຫັດຊ້ຳ
  async function fetchAll() {
    if (rows.length >= total) return rows.slice();
    const p = product(), did = durId(); let all = [], from = 0;
    toast('ກຳລັງດຶງລະຫັດທັງໝົດ...');
    for (;;) {
      const { data, error } = await fetchPage(p, did, from);
      if (error) { toast('ໂຫຼດບໍ່ສຳເລັດ: ' + error.message); return null; }
      const got = clean(data); all = all.concat(got); from += PAGE;
      if (got.length < PAGE) break;
    }
    return all;
  }

  async function remove(list, label) {
    const p = product(), did = durId(); let n = 0, failed = null;
    for (const part of chunks(list.map((r) => r.id), CHUNK)) {
      const { data, error } = await scope(supabaseClient.from('product_codes').delete().in('id', part), p.id, did, !!p.duration_enabled).select('id');
      if (error) { failed = error; break; } n += (data || []).length;
    }
    if (failed) toast('ຜິດພາດ: ' + failed.message + ` — ລຶບໄດ້ ${n}/${list.length}`);
    else toast(n < list.length ? `${label} ${n} ລາຍການ — ຂ້າມ ${list.length - n} (ຖືກຂາຍໄປແລ້ວ)` : `${label} ${n} ລະຫັດແລ້ວ`);
    if (typeof loadProducts === 'function') await loadProducts();
    await load();
  }

  function bind() {
    if (bound) return; bound = true;
    $('cmProduct').onchange = () => { fillDurations(); load(); };
    $('cmDuration').onchange = () => load();
    $('cmLoad').onclick = () => load();
    $('cmMore').onclick = () => load(true);
    $('cmSearch').oninput = (e) => { q = e.target.value.trim().toLowerCase(); render(); };
    $('cmReveal').onclick = () => { revealed = !revealed; render(); };
    $('cmAll').onclick = () => { const all = rows.map(keyOf); selected = selected.size === all.length ? new Set() : new Set(all); render(); };
    $('cmList').onclick = async (e) => {
      const cp = e.target.closest('[data-copy]');
      if (cp) {
        const r = rows.find((x) => keyOf(x) === cp.dataset.copy);
        const ok = await copyText(r.code); toast(ok ? 'ຄັດລອກແລ້ວ ✓' : 'ຄັດລອກບໍ່ໄດ້');
        cp.classList.add('done'); cp.textContent = 'ແລ້ວ ✓'; setTimeout(() => { cp.classList.remove('done'); cp.textContent = 'ຄັດລອກ'; }, 1000); return;
      }
      const row = e.target.closest('.rc-row'); if (!row) return;
      const k = row.dataset.k; selected.has(k) ? selected.delete(k) : selected.add(k); render();
    };
    $('cmCopySel').onclick = async () => toast((await copyText(joinCodes(chosen().map((r) => r.code)))) ? `ຄັດລອກ ${selected.size} ລະຫັດແລ້ວ ✓` : 'ຄັດລອກບໍ່ໄດ້');
    $('cmCopyAll').onclick = async () => {
      const all = await fetchAll(); if (!all) return;
      toast((await copyText(joinCodes(all.map((r) => r.code)))) ? `ຄັດລອກທັງໝົດ ${all.length} ລະຫັດແລ້ວ ✓` : 'ຄັດລອກບໍ່ໄດ້');
    };
    $('cmDl').onclick = async () => {
      const all = await fetchAll(); if (!all) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([joinCodes(all.map((r) => r.code))], { type: 'text/plain;charset=utf-8' }));
      a.download = 'codes-' + new Date().toISOString().slice(0, 10) + '.txt'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
    $('cmDupe').onclick = async () => {
      const all = await fetchAll(); if (!all) return;
      const seen = new Set(), extra = [];
      all.forEach((r) => (seen.has(r.code) ? extra.push(r) : seen.add(r.code)));
      if (!extra.length) return toast('ບໍ່ພົບລະຫັດຊ້ຳ');
      if (confirm(`ພົບລະຫັດຊ້ຳ ${extra.length} ລາຍການ — ລຶບອອກ (ເກັບໄວ້ອັນລະ 1)?`)) await remove(extra, 'ລຶບຊ້ຳ');
    };
    const msg = $('codesMsg');
    if (msg) new MutationObserver(() => { if (msg.classList.contains('success') && loadedOnce) load(); }).observe(msg, { attributes: true, attributeFilter: ['class'] });
    document.querySelectorAll('.d2-fn-card[data-goto="panelCodeVault"], .switch[data-target="panelCodeVault"] .switch-head')
      .forEach((el) => el.addEventListener('click', () => { if (!loadedOnce) { fillProducts(); load(); } }));
  }
  if (!document.getElementById('cmStyle')) { const s = document.createElement('style'); s.id = 'cmStyle'; s.textContent = CSS; document.head.appendChild(s); }
  window.refreshCodeVaultProducts = function () { if ($('cmProduct')) fillProducts(); };
  window.initCodeVaultPanel = function () { if (!$('cmProduct')) return; bind(); fillProducts(); };
})();
