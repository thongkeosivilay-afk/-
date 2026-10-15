/* =========================================================
   customers-admin.js v2 — แผง "ຈັດການລູກຄ້າ" ในห้องแอดมิน (admin.html > #panelCustomers)
   - โหลดลูกค้าทุกคน -> เรียงจากเงินมากไปน้อย -> แยกกลุ่ม: เงินหลาย / เงินกลาง / เงินน้อย / แอดมิน
   - การ์ดสรุป "เงินทั้งหมดในทุกบัญชี" อัปเดตสด (โพลทุก 20 วิ ตอนเปิดแผง + อัปเดตทันทีเมื่อปรับยอด)
   - แอนิเมชันใช้ transform/opacity/grid-rows เท่านั้น (ลื่น ไม่กระตุก) และเคารพ prefers-reduced-motion
   - เรียก /api/admin/customers/* ของ Worker เท่านั้น (Worker ตรวจสิทธิ์แอดมิน + ทำงานกับฐานข้อมูลแบบ atomic)
   - ถูกเรียกจาก initAdminPanel() ใน admin.js ผ่าน window.initCustomersPanel
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escapeHtmlAdmin === 'function'
    ? escapeHtmlAdmin(s)
    : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US').replace(/,/g, '.');
  const kip = (n) => '₭ ' + fmt(n);
  const toast = (t) => { if (typeof showToast === 'function') showToast(t); };
  const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const EASE = 'cubic-bezier(.22,1,.36,1)';
  const STATUS = { approved: 'ອະນຸມັດ', rejected: 'ປະຕິເສດ', pending: 'ລໍຖ້າ', completed: 'ສຳເລັດ' };

  /* ---- ตั้งค่า (ปรับตัวเลขตรงนี้ได้) ---- */
  const PAGE = 100;          // ดึงทีละกี่คน (Worker จำกัดสูงสุด 100)
  const SHOW_STEP = 25;      // แสดงต่อกลุ่มทีละกี่การ์ด (กดปุ่ม "ສະແດງເພີ່ມ" เพื่อดูต่อ)
  const POLL_MS = 20000;     // รีเฟรชยอดสดทุกกี่ ms ตอนเปิดแผงอยู่
  const TH_RICH = 500000;    // ตั้งแต่เท่านี้ = เงินหลาย
  const TH_MID = 50000;      // ตั้งแต่เท่านี้ = เงินกลาง (ต่ำกว่านี้ = เงินน้อย)
  const JUMP = 1000000;      // ยอดเพิ่มพรวดตั้งแต่เท่านี้ระหว่างรอบรีเฟรช = เตือน "ຍອດພຸ່ງ"
  const STALE_DAYS = 30;     // เงินหลายแต่ไม่ใช้งานเกินกี่วัน = เตือน "ບໍ່ໃຊ້ງານ"
  const GROUPS = [
    { k: 'rich', name: 'ເງິນຫຼາຍ', rule: '≥ ' + fmt(TH_RICH) },
    { k: 'mid', name: 'ເງິນກາງ', rule: fmt(TH_MID) + ' – ' + fmt(TH_RICH - 1) },
    { k: 'low', name: 'ເງິນໜ້ອຍ', rule: '< ' + fmt(TH_MID) },
    { k: 'admin', name: 'ແອດມິນ', rule: 'ບັນຊີຜູ້ດູແລ' },
  ];
  const groupOf = (u) => (u.is_admin ? 'admin' : u.balance >= TH_RICH ? 'rich' : u.balance >= TH_MID ? 'mid' : 'low');

  let all = [], map = new Map(), q = '', foundCount = 0;
  let loading = false, bound = false, loadedOnce = false, dirtyOrder = false, acting = 0;
  let lastLoad = 0, searchTimer = null;
  const els = new Map();
  const shown = {}; GROUPS.forEach((g) => { shown[g.k] = SHOW_STEP; });
  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem('cuCollapsed') || '{}') || {}; } catch { collapsed = {}; }
  const saveCollapsed = () => { try { localStorage.setItem('cuCollapsed', JSON.stringify(collapsed)); } catch { /* ข้าม */ } };
  let filter = 'all', sortKey = 'balance', selMode = false;
  const sel = new Set();
  try { const pf = JSON.parse(localStorage.getItem('cuPrefs') || '{}') || {}; q = String(pf.q || ''); filter = pf.filter || 'all'; sortKey = pf.sort || 'balance'; } catch { /* ข้าม */ }
  const savePrefs = () => { try { localStorage.setItem('cuPrefs', JSON.stringify({ q, filter, sort: sortKey })); } catch { /* ข้าม */ } };

  async function api(path, body) {
    const opt = { credentials: 'same-origin', cache: 'no-store' };
    if (body) { opt.method = 'POST'; opt.headers = { 'content-type': 'application/json' }; opt.body = JSON.stringify(body); }
    let res;
    try { res = await fetch('/api/admin/customers' + path, opt); } catch { throw new Error('ເຊື່ອມຕໍ່ບໍ່ໄດ້ — ກວດເນັດແລ້ວລອງໃໝ່'); }
    let d = null;
    try { d = await res.json(); } catch { /* ignore */ }
    if (!res.ok || !d || d.ok === false) throw new Error((d && d.error) || ('ຜິດພາດ ' + res.status));
    return d;
  }

  const dateTxt = (iso) => {
    const t = Date.parse(iso); if (!Number.isFinite(t)) return '-';
    const d = new Date(t + 7 * 3600 * 1000), p = (n) => String(n).padStart(2, '0');
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  };

  /* ---------- ตัวเลขนับขึ้น/ลงแบบลื่น ---------- */
  function animateNum(node, to, f) {
    if (!node) return;
    const from = node._v == null ? to : node._v;
    node._v = to;
    if (node._raf) cancelAnimationFrame(node._raf);
    if (RM || from === to || !node.isConnected) { node.textContent = f(to); return; }
    const t0 = performance.now(), dur = 700;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      node.textContent = f(Math.round(from + (to - from) * e));
      if (p < 1) node._raf = requestAnimationFrame(step);
    };
    node._raf = requestAnimationFrame(step);
  }

  /* ---------- โครงหน้า: การ์ดยอดรวม + 4 กลุ่ม ---------- */
  function ensureShell() {
    const host = $('cuSum');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    host.className = 'cu-sum cu-tot';
    host.innerHTML = `
      <div class="cu-tot-top"><span class="cu-live"><i></i>ສົດ</span><span class="cu-upd" id="cuUpd">—</span></div>
      <div class="cu-tot-lbl">ເງິນທັງໝົດໃນທຸກບັນຊີ</div>
      <div class="cu-tot-val" id="cuTotVal">₭ 0</div>
      <div class="cu-tot-sub" id="cuTotSub"></div>
      <div class="cu-found" id="cuFound"></div>`;
    $('cuTotVal')._v = 0;
    const tools = document.createElement('div');
    tools.className = 'cu-tools'; tools.id = 'cuTools';
    tools.innerHTML = `
      <div class="cu-fchips" role="group">
        <button type="button" data-f="all">ທັງໝົດ</button><button type="button" data-f="banned">ຖືກແບນ</button><button type="button" data-f="never">ບໍ່ເຄີຍເຕີມ</button><button type="button" data-f="flag">ຕ້ອງກວດ<em id="cuFlagN"></em></button>
      </div>
      <div class="cu-trow">
        <label class="cu-sort"><span>ຮຽງ</span><select id="cuSort"><option value="balance">ຍອດເງິນ</option><option value="topup">ເຕີມສະສົມ</option><option value="orders">ຈຳນວນອໍເດີ</option><option value="active">ໃຊ້ງານຫຼ້າສຸດ</option></select></label>
        <button type="button" id="cuSelBtn" class="cu-tbtn">ເລືອກຫຼາຍຄົນ</button>
        <button type="button" id="cuCsv" class="cu-tbtn">CSV</button>
      </div>`;
    host.parentNode.insertBefore(tools, host.nextSibling);
    const help = document.createElement('div');
    help.className = 'cu-help'; help.id = 'cuHelp';
    const HELP = [
      ['ເງິນທັງໝົດ', 'ການ໌ດດ້ານເທິງສະແດງເງິນລວມຂອງທຸກບັນຊີ ອັບເດດສົດທຸກ 20 ວິນາທີຕອນເປີດແຜງນີ້ ແລະ ທັນທີເມື່ອທ່ານເພີ່ມ/ຫັກເງິນ ຈຸດສີຂຽວກະພິບ = ກຳລັງອັບເດດສົດ'],
      ['ກຸ່ມລູກຄ້າ', `ແຍກຕາມຍອດເງິນ: ເງິນຫຼາຍ (≥ ${fmt(TH_RICH)}) · ເງິນກາງ (${fmt(TH_MID)} – ${fmt(TH_RICH - 1)}) · ເງິນໜ້ອຍ (< ${fmt(TH_MID)}) ແອດມິນແຍກຕ່າງຫາກ ແຕ່ລະກຸ່ມຮຽງຈາກຫຼາຍໄປໜ້ອຍ ກົດຫົວກຸ່ມເພື່ອຫຸບ/ເປີດ ກົດ "ສະແດງເພີ່ມ" ເພື່ອເບິ່ງຕໍ່ (ເທື່ອລະ ${SHOW_STEP} ຄົນ)`],
      ['ຄົ້ນຫາ ແລະ ຕົວກອງ', 'ພິມອີເມວ/ຊື່/ID ເພື່ອຄົ້ນຫາທັນທີ ປຸ່ມ ຖືກແບນ / ບໍ່ເຄີຍເຕີມ / ຕ້ອງກວດ ກອງລາຍຊື່ ເມນູ "ຮຽງ" ປ່ຽນເກນຮຽງ (ຍອດເງິນ, ເຕີມສະສົມ, ອໍເດີ, ໃຊ້ງານຫຼ້າສຸດ) ລະບົບຈື່ຄ່າທີ່ຕັ້ງໄວ້ໃຫ້'],
      ['ເປີດບັນຊີລູກຄ້າ', 'ກົດທີ່ລູກຄ້າເພື່ອເປີດ: ເພີ່ມ/ຫັກເງິນ ເລືອກຈຳນວນດ່ວນ ຫຼື ພິມເອງ ເລືອກເຫດຜົນສຳເລັດຮູບ ແລ້ວກົດປຸ່ມຢືນຢັນ "ສອງຄັ້ງ" (ຄັ້ງທຳອິດປຸ່ມຈະເປັນສີເຫຼືອງ ຄັ້ງທີສອງຈຶ່ງບັນທຶກຈິງ) ຫຼັງສຳເລັດມີປຸ່ມ "ຍ້ອນກັບ" ໃຫ້ກົດໄດ້ພາຍໃນ 10 ວິນາທີ ທຸກການປັບຍອດບັນທຶກໃນປະຫວັດ'],
      ['ແບນ ແລະ ລຶບບັນຊີ', 'ແບນບັນຊີໄດ້ ແລະ ປົດແບນໄດ້ພາຍຫຼັງ ການລຶບເປັນແບບຖາວອນ ກູ້ຄືນບໍ່ໄດ້ ບັນຊີແອດມິນແບນ/ລຶບບໍ່ໄດ້'],
      ['ປ້າຍເຕືອນ', `"ຍອດພຸ່ງ" ຂຶ້ນເມື່ອຍອດເພີ່ມຕັ້ງແຕ່ ${fmt(JUMP)} ໃນຮອບອັບເດດດຽວ · "ບໍ່ໃຊ້ງານ" ຂຶ້ນເມື່ອເງິນຫຼາຍແຕ່ບໍ່ໄດ້ໃຊ້ເກີນ ${STALE_DAYS} ວັນ ປຸ່ມ "ຕ້ອງກວດ" ຮວມທັງສອງປ້າຍ`],
      ['ເລືອກຫຼາຍຄົນ', 'ກົດ "ເລືອກຫຼາຍຄົນ" ແລ້ວຕິກເລືອກລູກຄ້າ ແຖບດ້ານລຸ່ມໃຊ້ເພີ່ມເງິນເທົ່າກັນ ຫຼື ແບນພ້ອມກັນ (ຕ້ອງກົດຢືນຢັນສອງຄັ້ງ) ປຸ່ມ "ເລືອກທັງໝົດ" ເລືອກສະເພາະຄົນທີ່ສະແດງຢູ່'],
      ['ສົ່ງອອກ CSV', 'ປຸ່ມ CSV ດາວໂຫຼດລາຍຊື່ລູກຄ້າທຸກບັນຊີ ພ້ອມຍອດເງິນ ເປີດໃນ Excel ໄດ້'],
      ['ລູກຄ້າເຕີມເງິນ', 'ເມື່ອອະນຸມັດຄຳຂໍເຕີມເງິນໃນແທັບ "ເຕີມເງິນ" ແລ້ວ ຍອດຢູ່ທີ່ນີ້ຈະອັບເດດເອງພາຍໃນ 20 ວິນາທີ ຫຼື ກົດປຸ່ມຣີເຟຣຊເພື່ອເບິ່ງທັນທີ'],
    ];
    help.innerHTML = `<button type="button" class="cu-help-h" id="cuHelpBtn" aria-expanded="false"><span class="cu-help-i">?</span><span>ວິທີໃຊ້ / ອະທິບາຍການເຮັດວຽກ</span><svg class="cu-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg></button>
      <div class="cu-help-b"><div><ol class="cu-help-l">${HELP.map((h) => `<li><b>${h[0]}</b><span>${h[1]}</span></li>`).join('')}</ol></div></div>`;
    tools.parentNode.insertBefore(help, tools.nextSibling);
    const bar = document.createElement('div');
    bar.className = 'cu-bulk'; bar.id = 'cuBulk'; bar.hidden = true;
    bar.innerHTML = `<div class="cu-bulk-in">
      <div class="cu-bulk-top"><b id="cuBulkN">0</b><span>ຄົນທີ່ເລືອກ</span><button type="button" data-b="all">ເລືອກທັງໝົດ</button><button type="button" data-b="none">ລ້າງ</button><button type="button" data-b="close">ປິດ</button></div>
      <div class="cu-bulk-form"><input id="cuBulkAmt" inputmode="numeric" autocomplete="off" placeholder="ເງິນຕໍ່ຄົນ (ກີບ)"><input id="cuBulkReason" maxlength="300" placeholder="ເຫດຜົນ"></div>
      <div class="cu-bulk-btns"><button type="button" data-b="add" class="topup-btn approve">+ ເພີ່ມເງິນ</button><button type="button" data-b="ban" class="topup-btn reject">ແບນ</button></div>
      <div class="cu-bulk-msg" id="cuBulkMsg"></div></div>`;
    document.body.appendChild(bar);
    syncTools();
  }

  function syncTools() {
    document.querySelectorAll('#cuTools [data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === filter));
    const s = $('cuSort'); if (s) s.value = sortKey;
  }

  function ensureGroups() {
    const list = $('cuList');
    if (!list || list.dataset.ready) return;
    list.dataset.ready = '1';
    list.innerHTML = '<div class="cu-empty empty-note" id="cuEmpty">ກຳລັງໂຫຼດ...</div>' + GROUPS.map((g) => `
      <section class="cu-grp is-empty" data-g="${g.k}">
        <button type="button" class="cu-gh">
          <i class="cu-dot"></i>
          <span class="cu-gt"><b>${g.name}</b><small>${g.rule}</small></span>
          <span class="cu-gn">0</span><span class="cu-gs">₭ 0</span>
          <svg class="cu-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="cu-gbody"><div class="cu-gin"><div class="cu-gcards"></div><button type="button" class="cu-gmore topup-btn" hidden></button></div></div>
      </section>`).join('');
    GROUPS.forEach((g) => { if (collapsed[g.k]) list.querySelector(`.cu-grp[data-g="${g.k}"]`).classList.add('collapsed'); });
  }
  const sec = (k) => $('cuList').querySelector(`.cu-grp[data-g="${k}"]`);

  /* ---------- การ์ดลูกค้า ---------- */
  function makeCard(u) {
    const el = document.createElement('div');
    el.className = 'cu-card';
    el.dataset.id = u.user_id;
    el.innerHTML = `
      <button type="button" class="cu-top" data-act="toggle">
        <span class="cu-ck" aria-hidden="true"></span>
        <span class="cu-who"><b></b><small></small></span>
        <span class="cu-bal"></span>
      </button>
      <div class="cu-chips"><span class="cu-c-top"></span><span class="cu-c-ord"></span><em class="cu-tags"></em></div>
      <div class="cu-dwrap"><div class="cu-detail"></div></div>`;
    patchCard(el, u);
    return el;
  }

  function flash(el, cls) {
    if (RM) return;
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el._ft);
    el._ft = setTimeout(() => el.classList.remove('flash-up', 'flash-down'), 1100);
  }

  function patchCard(el, u) {
    const name = u.email || u.username || u.user_id;
    const b = el.querySelector('.cu-who b'), s = el.querySelector('.cu-who small');
    if (b.textContent !== name) b.textContent = name;
    if (s.textContent !== String(u.user_id)) s.textContent = u.user_id;
    const prev = el._bal;
    el._bal = u.balance;
    if (prev !== undefined && prev !== u.balance) flash(el, u.balance > prev ? 'flash-up' : 'flash-down');
    animateNum(el.querySelector('.cu-bal'), u.balance, kip);
    el.querySelector('.cu-c-top').textContent = 'ເຕີມສະສົມ ' + kip(u.total_topup);
    el.querySelector('.cu-c-ord').textContent = 'ອໍເດີ ' + fmt(u.orders_count);
    const tags = (u.banned ? '<span class="cu-tag bad">ຖືກແບນ</span>' : '') + (u.is_admin ? '<span class="cu-tag adm">ແອດມິນ</span>' : '') +
      (u._jump ? `<span class="cu-tag warn">ຍອດພຸ່ງ +${fmt(u._jump)}</span>` : '') + (isStale(u) ? `<span class="cu-tag warn">ບໍ່ໃຊ້ງານ ${STALE_DAYS}+ ວັນ</span>` : '');
    el.classList.toggle('selected', sel.has(u.user_id));
    const te = el.querySelector('.cu-tags');
    if (te._h !== tags) { te._h = tags; te.innerHTML = tags; }
    el.classList.toggle('is-banned', !!u.banned);
  }

  /* ---------- จัดกลุ่ม + เรียง ---------- */
  const isStale = (u) => u.balance >= TH_RICH && !!u.last_activity && (Date.now() - Date.parse(u.last_activity)) > STALE_DAYS * 864e5;
  const flagged = (u) => !!u._jump || isStale(u);
  const passFilter = (u) => filter === 'all' || (filter === 'banned' && u.banned) || (filter === 'never' && !(u.total_topup > 0)) || (filter === 'flag' && flagged(u));
  const matches = (u) => {
    if (!passFilter(u)) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return String(u.email || '').toLowerCase().includes(s) || String(u.username || '').toLowerCase().includes(s) || String(u.user_id).toLowerCase().includes(s);
  };
  const keyVal = (u) => (sortKey === 'topup' ? u.total_topup : sortKey === 'orders' ? u.orders_count : sortKey === 'active' ? (Date.parse(u.last_activity) || 0) : u.balance);
  const cmp = (a, b) => (keyVal(b) - keyVal(a)) || (b.balance - a.balance) || String(a.email || a.username || a.user_id).localeCompare(String(b.email || b.username || b.user_id));

  function bucketize() {
    const buckets = { rich: [], mid: [], low: [], admin: [] };
    foundCount = 0;
    for (const u of all) if (matches(u)) { buckets[groupOf(u)].push(u); foundCount++; }
    for (const k in buckets) buckets[k].sort(cmp);
    return buckets;
  }

  function updateHeads(buckets) {
    GROUPS.forEach((g) => {
      const s = sec(g.k); if (!s) return;
      const arr = buckets[g.k];
      s.querySelector('.cu-gn').textContent = fmt(arr.length);
      animateNum(s.querySelector('.cu-gs'), arr.reduce((a, u) => a + u.balance, 0), kip);
    });
  }

  function renderTotals() {
    ensureShell();
    let sum = 0, adm = 0;
    for (const u of all) { sum += u.balance; if (u.is_admin) adm += u.balance; }
    animateNum($('cuTotVal'), sum, kip);
    $('cuTotSub').innerHTML = `<span>${fmt(all.length)} ບັນຊີ</span><span>ລູກຄ້າ ${kip(sum - adm)}</span><span>ແອດມິນ ${kip(adm)}</span>`;
    $('cuFound').textContent = (q || filter !== 'all') ? `${q ? `ຄົ້ນຫາ "${q}" — ` : 'ຕົວກອງ — '}ພົບ ${fmt(foundCount)} ບັນຊີ` : '';
    const nf = all.filter(flagged).length, fe = $('cuFlagN'); if (fe) fe.textContent = nf ? ' ' + nf : '';
    const bd = $('d2BadgeCustomers'); if (bd && all.length) bd.textContent = fmt(all.length);
  }

  const openCardEl = () => $('cuList').querySelector('.cu-card.open');
  const busyUI = () => !!openCardEl() || selMode; // กำลังเปิดฟอร์ม/เลือกหลายคน -> ไม่สลับลำดับการ์ด

  function render() {
    ensureShell(); ensureGroups();
    dirtyOrder = false;
    const list = $('cuList');
    const buckets = bucketize();

    /* FLIP: จำตำแหน่งเดิมของการ์ดก่อนสลับลำดับ */
    const first = new Map();
    if (!RM && loadedOnce && els.size <= 150) els.forEach((el, id) => { if (el.isConnected) first.set(id, el.getBoundingClientRect().top); });

    const want = new Set();
    let enterIdx = 0;
    GROUPS.forEach((g) => {
      const s = sec(g.k), arr = buckets[g.k], cards = s.querySelector('.cu-gcards');
      s.classList.toggle('is-empty', !arr.length);
      const vis = arr.slice(0, shown[g.k]);
      vis.forEach((u, i) => {
        want.add(u.user_id);
        let el = els.get(u.user_id);
        if (!el) {
          el = makeCard(u); els.set(u.user_id, el);
          if (!RM) {
            el.classList.add('enter'); el.style.animationDelay = (Math.min(enterIdx++, 10) * 28) + 'ms';
            el.addEventListener('animationend', function h(ev) {
              if (ev.target !== el || ev.animationName !== 'cuIn') return;
              el.classList.remove('enter'); el.style.animationDelay = ''; el.removeEventListener('animationend', h);
            });
          }
        } else patchCard(el, u);
        if (cards.children[i] !== el) cards.insertBefore(el, cards.children[i] || null);
      });
      const more = s.querySelector('.cu-gmore'), rest = arr.length - vis.length;
      more.hidden = rest <= 0;
      more.textContent = `ສະແດງເພີ່ມ (${fmt(rest)})`;
    });
    /* เก็บกวาดการ์ดที่ไม่ต้องแสดงแล้ว */
    els.forEach((el, id) => { if (!want.has(id)) { el.remove(); els.delete(id); } });

    updateHeads(buckets);
    renderTotals();
    const empty = $('cuEmpty');
    empty.hidden = foundCount > 0;
    empty.textContent = loadedOnce ? 'ບໍ່ພົບລູກຄ້າ' : 'ກຳລັງໂຫຼດ...';

    if (first.size) {
      const vh = window.innerHeight || 800;
      els.forEach((el, id) => {
        const t0 = first.get(id); if (t0 == null || !el.isConnected || !el.animate) return;
        const dy = t0 - el.getBoundingClientRect().top;
        if (Math.abs(dy) < 2 || t0 < -250 || t0 > vh + 250) return;
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 450, easing: EASE });
      });
    }
  }

  /* อัปเดตเฉพาะตัวเลข (ไม่ขยับลำดับ) — ใช้ตอนมีการ์ดเปิดฟอร์มอยู่ กันการ์ดหนีนิ้ว */
  function patchOnly() {
    els.forEach((el, id) => { const u = map.get(id); if (u) patchCard(el, u); });
    updateHeads(bucketize());
    renderTotals();
  }
  const touch = () => { patchOnly(); dirtyOrder = true; };

  /* ---------- โหลดข้อมูลทั้งหมด + อัปเดตสด ---------- */
  async function fetchAll() {
    const firstPage = await api(`?limit=${PAGE}&offset=0`);
    const out = firstPage.items.slice();
    const total = Math.min(Number(firstPage.total) || out.length, 20000);
    const offs = [];
    for (let o = PAGE; o < total; o += PAGE) offs.push(o);
    for (let i = 0; i < offs.length; i += 4) {
      const parts = await Promise.all(offs.slice(i, i + 4).map((o) => api(`?limit=${PAGE}&offset=${o}`)));
      parts.forEach((p) => out.push(...p.items));
    }
    return out;
  }

  function merge(items, startedAt) {
    const next = new Map(), jumps = [];
    for (const it of items) {
      const old = map.get(it.user_id);
      if (old) {
        const keepBal = old._adj && old._adj > startedAt ? old.balance : it.balance; // ไม่ให้ข้อมูลเก่าทับยอดที่เพิ่งปรับ
        const prev = old.balance;
        Object.assign(old, it, { balance: keepBal });
        if (!(old._adj && old._adj > startedAt) && keepBal - prev >= JUMP) { old._jump = keepBal - prev; jumps.push(old); }
        next.set(it.user_id, old);
      } else next.set(it.user_id, it);
    }
    map = next; all = [...map.values()];
    sel.forEach((id) => { if (!map.has(id)) sel.delete(id); });
    return jumps;
  }

  async function refresh(manual) {
    if (loading) return;
    loading = true;
    const btn = $('cuRefresh'); if (btn) btn.classList.add('spin');
    const startedAt = Date.now();
    try {
      const jumps = merge(await fetchAll(), startedAt);
      lastLoad = Date.now();
      ensureShell();
      $('cuUpd').textContent = 'ອັບເດດ ' + new Date().toTimeString().slice(0, 8);
      if (busyUI()) { loadedOnce = true; patchOnly(); dirtyOrder = true; } else { render(); loadedOnce = true; if (!all.length) { $('cuEmpty').textContent = 'ບໍ່ພົບລູກຄ້າ'; } }
      jumps.slice(0, 3).forEach((u) => toast(`⚠ ${u.email || u.user_id} ຍອດເຂົ້າ +${kip(u._jump)}`));
    } catch (e) {
      if (!loadedOnce) { ensureGroups(); const em = $('cuEmpty'); em.hidden = false; em.textContent = e.message; }
      else if (manual) toast(e.message);
    } finally {
      loading = false;
      if (btn) btn.classList.remove('spin');
    }
  }

  function panelOpen() {
    const p = $('panelCustomers'), sw = p && p.closest('.switch');
    return !!sw && sw.classList.contains('open') && !document.hidden && sw.offsetParent !== null;
  }
  const maybeRefresh = (minAge) => { if (!loading && !acting && panelOpen() && Date.now() - lastLoad > minAge) refresh(false); };

  /* ---------- รายละเอียด + ฟอร์ม ---------- */
  function detailShell(u) {
    return `<div class="cu-di">
      <div class="cu-sec">
        <div class="cu-seg" data-mode="add">
          <button type="button" class="on" data-mode="add">+ ເພີ່ມເງິນ</button>
          <button type="button" data-mode="sub">− ຫັກເງິນ</button>
        </div>
        <div class="gx-input-wrap"><input class="cu-amt" inputmode="numeric" autocomplete="off" placeholder="ຈຳນວນເງິນ (ກີບ)"></div>
        <div class="cu-quick">${[10000, 50000, 100000, 500000, 1000000].map((v) => `<button type="button" data-q="${v}">${fmt(v)}</button>`).join('')}<button type="button" data-q="clear" class="cu-clr">ລ້າງ</button></div>
        <div class="gx-input-wrap"><input class="cu-reason" maxlength="300" placeholder="ເຫດຜົນ (ບັນທຶກໄວ້ໃນປະຫວັດ)"></div>
        <div class="cu-quick cu-reasons">${['ເຕີມບໍ່ເຂົ້າ', 'ຄືນເງິນ', 'ໂບນັດ', 'ແກ້ໄຂຍອດ'].map((r) => `<button type="button" data-r="${r}">${r}</button>`).join('')}</div>
        <button type="button" class="topup-btn approve cu-go" data-act="adjust">ຢືນຢັນເພີ່ມເງິນ</button>
        <div class="cu-msg"></div>
      </div>
      <div class="cu-sec cu-actions">
        <button type="button" class="topup-btn ${u.banned ? 'approve' : 'reject'}" data-act="ban">${u.banned ? 'ປົດແບນ' : 'ແບນບັນຊີ'}</button>
        ${u.is_admin ? '' : '<button type="button" class="topup-btn reject" data-act="del-ask">ລຶບບັນຊີ</button>'}
      </div>
      <div class="cu-delw"><div><div class="cu-del">
        <p>ລຶບບັນຊີນີ້ຖາວອນ — ກູ້ຄືນບໍ່ໄດ້</p>
        <label><input type="checkbox" class="cu-del-hist"> ລຶບປະຫວັດອໍເດີ ແລະ ເຕີມເງິນນຳ</label>
        <label><input type="checkbox" class="cu-del-ban" checked> ແບນບໍ່ໃຫ້ກັບມາໃຊ້ໄດ້ອີກ</label>
        <div class="cu-actions">
          <button type="button" class="topup-btn reject" data-act="del-go">ຢືນຢັນລຶບ</button>
          <button type="button" class="topup-btn" data-act="del-cancel">ຍົກເລີກ</button>
        </div>
      </div></div></div>
      <div class="cu-hist"><div class="empty-note">ກຳລັງໂຫຼດປະຫວັດ...</div></div></div>`;
  }

  function histHtml(d) {
    const sec2 = (title, rows, fn) => `<details class="cu-h"><summary>${title} (${rows.length})</summary>${rows.length ? rows.map(fn).join('') : '<div class="empty-note">ບໍ່ມີ</div>'}</details>`;
    return (d.ban ? `<div class="cu-banbox">ຖືກແບນ${d.ban.reason ? ': ' + esc(d.ban.reason) : ''} <small>(${esc(d.ban.banned_by || '')} · ${dateTxt(d.ban.created_at)})</small></div>` : '') +
      sec2('ປະຫວັດປັບຍອດໂດຍແອດມິນ', d.adjustments, (r) => `<div class="cu-row"><span class="${Number(r.delta) > 0 ? 'pos' : 'neg'}">${Number(r.delta) > 0 ? '+' : '−'}${kip(Math.abs(r.delta))}</span><small>${fmt(r.balance_before)} → ${fmt(r.balance_after)} · ${esc(r.reason || '-')} · ${esc(r.admin_email || '')} · ${dateTxt(r.created_at)}</small></div>`) +
      sec2('ປະຫວັດເຕີມເງິນ', d.topups, (r) => `<div class="cu-row"><span>${kip(r.amount)}</span><small>${esc(STATUS[r.status] || r.status)} · ${esc(r.ref_no || '')} · ${dateTxt(r.created_at)}</small></div>`) +
      sec2('ອໍເດີຫຼ້າສຸດ', d.orders, (r) => `<div class="cu-row"><span>${esc(r.product_name)}${r.duration_label ? ' · ' + esc(r.duration_label) : ''}</span><small>${kip(r.price)} · ${esc(STATUS[r.status] || r.status)} · ${dateTxt(r.created_at)}</small></div>`);
  }

  async function loadDetail(card) {
    const id = card.dataset.id, box = card.querySelector('.cu-hist');
    if (!box) return;
    try {
      const d = await api('/detail?user_id=' + encodeURIComponent(id));
      box.innerHTML = histHtml(d);
      const u = map.get(id);
      if (u && u.balance !== d.balance) { u.balance = d.balance; u._adj = Date.now(); touch(); }
    } catch (e) { box.innerHTML = `<div class="empty-note">${esc(e.message)}</div>`; }
  }

  function setMsg(card, text, ok) {
    const m = card.querySelector('.cu-msg'); m.textContent = text || ''; m.className = 'cu-msg' + (text ? (ok ? ' ok' : ' err') : '');
  }

  async function doAdjust(card, btn) {
    const u = map.get(card.dataset.id); if (!u || btn.disabled) return;
    const mode = card.querySelector('.cu-seg').dataset.mode;
    const amount = parseInt(card.querySelector('.cu-amt').value.replace(/\D/g, ''), 10) || 0;
    const reason = card.querySelector('.cu-reason').value.trim();
    if (amount <= 0) { setMsg(card, 'ໃສ່ຈຳນວນເງິນກ່ອນ', false); return; }
    const key = mode + amount;
    if (btn._armed !== key) { arm(btn, key, `ກົດອີກຄັ້ງເພື່ອຢືນຢັນ ${mode === 'sub' ? '−' : '+'}${kip(amount)}`); return; }
    disarm(btn);
    btn.disabled = true; acting++; setMsg(card, 'ກຳລັງບັນທຶກ...', true);
    try {
      const d = await api('/adjust', { user_id: u.user_id, email: u.email, amount, mode, reason });
      u.balance = d.balance_after; u._adj = Date.now();
      touch(); // ยอดการ์ด + ยอดรวม + หัวกลุ่ม อัปเดตทันที
      card.querySelector('.cu-amt').value = ''; card.querySelector('.cu-reason').value = '';
      setMsg(card, `ສຳເລັດ: ${kip(d.balance_before)} → ${kip(d.balance_after)} `, true);
      card._undo = { amount, mode, exp: Date.now() + 10000 };
      const um = card.querySelector('.cu-msg'); um.insertAdjacentHTML('beforeend', '<button type="button" class="cu-undo" data-act="undo">ຍ້ອນກັບ</button>');
      setTimeout(() => { const x = um.querySelector('.cu-undo'); if (x && Date.now() >= (card._undo ? card._undo.exp : 0)) x.remove(); }, 10200);
      toast('ປັບຍອດເງິນສຳເລັດ');
      loadDetail(card);
    } catch (e) { setMsg(card, e.message, false); }
    acting--; btn.disabled = false;
  }

  async function doUndo(card, btn) {
    const u = map.get(card.dataset.id), un = card._undo;
    if (!u || !un || Date.now() > un.exp) { btn.remove(); return; }
    card._undo = null; btn.disabled = true; acting++;
    try {
      const d = await api('/adjust', { user_id: u.user_id, email: u.email, amount: un.amount, mode: un.mode === 'sub' ? 'add' : 'sub', reason: 'ຍ້ອນກັບ' });
      u.balance = d.balance_after; u._adj = Date.now(); touch();
      setMsg(card, `ຍ້ອນກັບແລ້ວ: ${kip(d.balance_before)} → ${kip(d.balance_after)}`, true);
      toast('ຍ້ອນກັບສຳເລັດ'); loadDetail(card);
    } catch (e) { setMsg(card, e.message, false); }
    acting--;
  }

  /* ປຸ່ມກົດສອງຄັ້ງເພື່ອຢືນຢັນ (ແທນກ່ອງ confirm ຂອງເບຣາວເຊີ) */
  function arm(btn, key, text) {
    btn._armed = key; if (btn._t0 == null) btn._t0 = btn.textContent;
    btn.textContent = text; btn.classList.add('armed');
    clearTimeout(btn._at); btn._at = setTimeout(() => disarm(btn), 4000);
  }
  function disarm(btn) {
    clearTimeout(btn._at); btn._armed = null;
    if (btn._t0 != null) { btn.textContent = btn._t0; btn._t0 = null; }
    btn.classList.remove('armed');
  }

  /* ---------- เลือกหลายคน + ทำพร้อมกัน ---------- */
  function updateBulk() {
    const bar = $('cuBulk'); if (!bar) return;
    bar.hidden = !(selMode && panelOpen());
    $('cuBulkN').textContent = fmt(sel.size);
    $('cuList').classList.toggle('sel-mode', selMode);
    const sb = $('cuSelBtn'); sb.classList.toggle('on', selMode); sb.textContent = selMode ? 'ຍົກເລີກເລືອກ' : 'ເລືອກຫຼາຍຄົນ';
  }
  function toggleSel(card) {
    const id = card.dataset.id;
    if (sel.has(id)) sel.delete(id); else sel.add(id);
    card.classList.toggle('selected', sel.has(id)); updateBulk();
  }
  function setSelMode(on) {
    selMode = on;
    if (on) document.querySelectorAll('#cuList .cu-card.open').forEach(closeCard);
    else { sel.clear(); els.forEach((el) => el.classList.remove('selected')); }
    updateBulk();
    if (!on && dirtyOrder) setTimeout(() => { if (dirtyOrder && !busyUI()) render(); }, 50);
  }
  function bulkMsg(t, ok) { const m = $('cuBulkMsg'); m.textContent = t; m.className = 'cu-bulk-msg' + (ok ? ' ok' : ' err'); }
  async function bulk(kind, btn) {
    const ids = [...sel].filter((id) => map.has(id));
    if (!ids.length) { bulkMsg('ເລືອກລູກຄ້າກ່ອນ', false); return; }
    const reason = $('cuBulkReason').value.trim();
    let amount = 0, targets = ids;
    if (kind === 'add') {
      amount = parseInt($('cuBulkAmt').value.replace(/\D/g, ''), 10) || 0;
      if (amount <= 0) { bulkMsg('ໃສ່ຈຳນວນເງິນກ່ອນ', false); return; }
    } else targets = ids.filter((id) => { const u = map.get(id); return !u.is_admin && !u.banned; });
    if (!targets.length) { bulkMsg('ບໍ່ມີບັນຊີທີ່ແບນໄດ້ (ແອດມິນ/ຖືກແບນແລ້ວ)', false); return; }
    const key = kind + targets.length + ':' + amount;
    if (btn._armed !== key) { arm(btn, key, kind === 'add' ? `ກົດອີກຄັ້ງ: +${kip(amount)} × ${fmt(targets.length)} ຄົນ` : `ກົດອີກຄັ້ງ: ແບນ ${fmt(targets.length)} ຄົນ`); return; }
    disarm(btn); acting++;
    const bar = $('cuBulk'); bar.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    let ok = 0, fail = 0, last = '';
    for (let i = 0; i < targets.length; i++) {
      bulkMsg(`ກຳລັງເຮັດ ${i + 1}/${targets.length}...`, true);
      const u = map.get(targets[i]);
      try {
        if (kind === 'add') { const d = await api('/adjust', { user_id: u.user_id, email: u.email, amount, mode: 'add', reason }); u.balance = d.balance_after; u._adj = Date.now(); }
        else { await api('/ban', { user_id: u.user_id, email: u.email, banned: true, reason }); u.banned = true; }
        ok++;
      } catch (e) { fail++; last = e.message; }
    }
    patchOnly(); dirtyOrder = true;
    bulkMsg(`ສຳເລັດ ${fmt(ok)} ຄົນ` + (fail ? ` · ຜິດພາດ ${fmt(fail)}: ${last}` : ''), !fail);
    toast(fail ? `ສຳເລັດ ${ok} · ຜິດພາດ ${fail}` : `ສຳເລັດ ${ok} ຄົນ`);
    bar.querySelectorAll('button').forEach((x) => { x.disabled = false; });
    acting--;
  }

  /* ---------- ส่งออก CSV ---------- */
  function exportCsv() {
    if (!all.length) { toast('ຍັງບໍ່ມີຂໍ້ມູນ'); return; }
    const cell = (v) => { let t = String(v == null ? '' : v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
    const rows = [['user_id', 'email', 'username', 'balance', 'total_topup', 'orders_count', 'banned', 'is_admin', 'last_activity']];
    [...all].sort(cmp).forEach((u) => rows.push([u.user_id, u.email || '', u.username || '', u.balance, u.total_topup, u.orders_count, u.banned ? 1 : 0, u.is_admin ? 1 : 0, u.last_activity || '']));
    const blob = new Blob(['\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `customers-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`ສົ່ງອອກ ${fmt(all.length)} ບັນຊີ`);
  }

  async function doBan(card, btn) {
    const u = map.get(card.dataset.id); if (!u) return;
    const ban = !u.banned;
    let reason = '';
    if (ban) {
      reason = window.prompt(`ແບນ ${u.email || u.user_id}\nເຫດຜົນ (ບໍ່ບັງຄັບ):`, '');
      if (reason === null) return;
    } else if (!window.confirm('ປົດແບນບັນຊີນີ້?')) return;
    btn.disabled = true; acting++;
    try {
      await api('/ban', { user_id: u.user_id, email: u.email, banned: ban, reason });
      u.banned = ban; toast(ban ? 'ແບນບັນຊີແລ້ວ' : 'ປົດແບນແລ້ວ');
      patchCard(card, u);
      btn.textContent = ban ? 'ປົດແບນ' : 'ແບນບັນຊີ'; btn.className = 'topup-btn ' + (ban ? 'approve' : 'reject');
      loadDetail(card);
    } catch (e) { setMsg(card, e.message, false); toast(e.message); }
    acting--; btn.disabled = false;
  }

  async function doDelete(card, btn) {
    const u = map.get(card.dataset.id); if (!u) return;
    btn.disabled = true; acting++;
    try {
      await api('/delete', {
        user_id: u.user_id, email: u.email,
        delete_history: card.querySelector('.cu-del-hist').checked,
        also_ban: card.querySelector('.cu-del-ban').checked,
      });
      toast('ລຶບບັນຊີແລ້ວ');
      const finish = () => {
        map.delete(u.user_id); all = all.filter((x) => x.user_id !== u.user_id);
        card.classList.remove('open'); render();
      };
      if (!RM && card.animate) card.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 240, easing: EASE, fill: 'forwards' }).onfinish = finish;
      else finish();
    } catch (e) { setMsg(card, e.message, false); toast(e.message); btn.disabled = false; }
    acting--;
  }

  /* ---------- เปิด/ปิดการ์ด ---------- */
  function closeCard(c) {
    c.classList.remove('open');
    if (dirtyOrder) setTimeout(() => { if (dirtyOrder && !busyUI()) render(); }, 420);
  }

  function openCard(card) {
    document.querySelectorAll('#cuList .cu-card.open').forEach((c) => { if (c !== card) closeCard(c); });
    const det = card.querySelector('.cu-detail');
    if (!det.dataset.ready) { det.dataset.ready = '1'; det.innerHTML = detailShell(map.get(card.dataset.id)); }
    void card.offsetHeight;
    card.classList.add('open');
    loadDetail(card);
    setTimeout(() => {
      const r = card.getBoundingClientRect(), vh = window.innerHeight || 800;
      if (card.classList.contains('open') && (r.top < 70 || r.bottom > vh - 10)) card.scrollIntoView({ block: 'center', behavior: RM ? 'auto' : 'smooth' });
    }, 430);
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const gh = e.target.closest('.cu-gh');
    if (gh) {
      const s = gh.closest('.cu-grp'), c = !s.classList.contains('collapsed');
      s.classList.toggle('collapsed', c); collapsed[s.dataset.g] = c; saveCollapsed();
      return;
    }
    const gm = e.target.closest('.cu-gmore');
    if (gm) { shown[gm.closest('.cu-grp').dataset.g] += SHOW_STEP; render(); return; }

    const card = e.target.closest('.cu-card'); if (!card) return;
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'toggle') {
      if (selMode) { toggleSel(card); return; }
      if (card.classList.contains('open')) closeCard(card); else openCard(card);
      return;
    }
    if (b.dataset.mode) {
      const seg = card.querySelector('.cu-seg'); seg.dataset.mode = b.dataset.mode;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      const go = card.querySelector('.cu-go'); disarm(go); go.textContent = b.dataset.mode === 'sub' ? 'ຢືນຢັນຫັກເງິນ' : 'ຢືນຢັນເພີ່ມເງິນ';
      go.classList.toggle('approve', b.dataset.mode !== 'sub'); go.classList.toggle('reject', b.dataset.mode === 'sub');
      return;
    }
    if (b.dataset.r) { card.querySelector('.cu-reason').value = b.dataset.r; return; }
    if (b.dataset.act === 'undo') return doUndo(card, b);
    if (b.dataset.q) {
      const i = card.querySelector('.cu-amt');
      if (b.dataset.q === 'clear') i.value = '';
      else i.value = fmt((parseInt(i.value.replace(/\D/g, ''), 10) || 0) + Number(b.dataset.q));
      return;
    }
    if (b.dataset.act === 'adjust') return doAdjust(card, b);
    if (b.dataset.act === 'ban') return doBan(card, b);
    if (b.dataset.act === 'del-ask') { card.querySelector('.cu-delw').classList.add('on'); return; }
    if (b.dataset.act === 'del-cancel') { card.querySelector('.cu-delw').classList.remove('on'); return; }
    if (b.dataset.act === 'del-go') return doDelete(card, b);
  }

  function bind() {
    if (bound || !$('cuList')) return; bound = true;
    const list = $('cuList');
    list.addEventListener('click', onClick);
    list.addEventListener('input', (e) => {
      if (e.target.classList.contains('cu-amt')) { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); e.target.value = n ? fmt(n) : ''; }
    });
    list.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const t = e.target, card = t.closest && t.closest('.cu-card'); if (!card) return;
      if (t.classList.contains('cu-amt')) { e.preventDefault(); card.querySelector('.cu-reason').focus(); }
      else if (t.classList.contains('cu-reason')) { e.preventDefault(); doAdjust(card, card.querySelector('.cu-go')); }
    });
    $('cuSearch').value = q;
    const resetShown = () => GROUPS.forEach((g) => { shown[g.k] = SHOW_STEP; });
    $('cuSearch').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { q = $('cuSearch').value.trim(); savePrefs(); resetShown(); if (loadedOnce) render(); }, 140);
    });
    $('cuHelpBtn').addEventListener('click', () => {
      const h = $('cuHelp'), on = !h.classList.contains('open');
      h.classList.toggle('open', on); $('cuHelpBtn').setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    $('cuTools').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.f) { filter = b.dataset.f; savePrefs(); syncTools(); resetShown(); if (loadedOnce) render(); return; }
      if (b.id === 'cuSelBtn') { setSelMode(!selMode); return; }
      if (b.id === 'cuCsv') exportCsv();
    });
    $('cuSort').addEventListener('change', () => { sortKey = $('cuSort').value; savePrefs(); if (loadedOnce) render(); });
    $('cuBulk').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !b.dataset.b) return;
      const a = b.dataset.b;
      if (a === 'close') return setSelMode(false);
      if (a === 'none') { sel.clear(); els.forEach((el) => el.classList.remove('selected')); return updateBulk(); }
      if (a === 'all') { els.forEach((el, id) => { sel.add(id); el.classList.add('selected'); }); return updateBulk(); }
      if (a === 'add' || a === 'ban') bulk(a, b);
    });
    $('cuBulkAmt').addEventListener('input', (e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); e.target.value = n ? fmt(n) : ''; });
    $('cuRefresh').addEventListener('click', () => refresh(true));

    /* อัปเดตสด: โพลตามรอบ + รีเฟรชทันทีเมื่อเปิดแผง/กลับมาที่แท็บ */
    setInterval(() => { updateBulk(); maybeRefresh(POLL_MS - 1000); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { updateBulk(); maybeRefresh(8000); });
    const p = $('panelCustomers'), sw = p && p.closest('.switch');
    if (sw && window.MutationObserver) new MutationObserver(() => { updateBulk(); maybeRefresh(8000); }).observe(sw, { attributes: true, attributeFilter: ['class'] });
  }

  window.initCustomersPanel = function initCustomersPanel() { ensureShell(); ensureGroups(); bind(); refresh(true); };
})();
