/* =========================================================
   maintenance-admin.js — ปุ่มปิด/เปิดเว็บ (โหมดปิดปรับปรุง) ในห้องแอดมิน
   คุยกับ Worker ที่ GET/POST /api/admin/maintenance (เฉพาะแอดมิน)
   แก้จากเดิม: โหลดสถานะพลาดแล้วเงียบ (ปุ่มโชว์ผิดสถานะ), request ค้างแล้วปุ่มตายถาวร,
   แอดมิน 2 คนเปิดหน้าพร้อมกันแล้วสถานะไม่ตรงกัน -> ตอนนี้เช็คซ้ำอัตโนมัติ + บอกสถานะ error ชัดเจน
   ========================================================= */
(function () {
  const $ = (id) => document.getElementById(id);
  const card = $('mtCard'), btn = $('mtBtn'), status = $('mtStatus'), sub = $('mtSub');
  if (!card || !btn) return;

  const API = '/api/admin/maintenance';
  const DEFAULT_SUB = sub ? sub.textContent : '';
  let isClosed = null;   // null = ยังไม่รู้สถานะจริง (โหลดไม่สำเร็จ)
  let busy = false;      // กำลังบันทึกอยู่ — ระหว่างนี้ไม่ให้การเช็คอัตโนมัติมาทับ
  let loadSeq = 0;       // ตัวนับ ใช้ทิ้งผลของ request เก่าที่ตอบกลับมาช้ากว่า

  function notify(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else alert(msg);
  }

  function request(url, opts, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 12000);
    return fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store', signal: ctl.signal }, opts))
      .finally(() => clearTimeout(t));
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function render(d) {
    isClosed = d.on === true;
    card.classList.toggle('is-closed', isClosed);
    card.classList.toggle('is-open', !isClosed);
    card.classList.remove('is-error');
    status.textContent = isClosed ? 'ເວັບປິດປັບປຸງຢູ່ (ມີແຕ່ແອດມິນເຂົ້າໄດ້)' : 'ເວັບເປີດໃຊ້ງານປົກກະຕິ';
    btn.textContent = isClosed ? 'ເປີດເວັບ' : 'ປິດເວັບ';
    btn.classList.toggle('is-open-action', isClosed);
    btn.disabled = false;
    if (sub) {
      const parts = [];
      if (d.at && fmtTime(d.at)) parts.push('ອັບເດດຫຼ້າສຸດ ' + fmtTime(d.at) + (d.by ? ' ໂດຍ ' + d.by : ''));
      if (d.consistency === 'eventual') parts.push('ອາດໃຊ້ເວລາເຖິງ 1 ນາທີ ກວ່າຈະມີຜົນທົ່ວທຸກບ່ອນ');
      sub.textContent = parts.length ? parts.join(' · ') : DEFAULT_SUB;
    }
  }

  function renderError(msg) {
    isClosed = null;
    card.classList.remove('is-closed', 'is-open');
    card.classList.add('is-error');
    status.textContent = msg;
    btn.textContent = 'ລອງໃໝ່';
    btn.classList.remove('is-open-action');
    btn.disabled = false;
  }

  // silent = เช็คอัตโนมัติเบื้องหลัง: ถ้าพลาดแต่เรารู้สถานะเดิมอยู่แล้ว ก็คงสถานะเดิมไว้ ไม่กระพริบเป็น error
  async function load(silent) {
    if (busy) return;
    const seq = ++loadSeq;
    try {
      const res = await request(API);
      if (seq !== loadSeq || busy) return;
      if (res.status === 401 || res.status === 403) {
        renderError('ເຊດຊັນໝົດອາຍຸ — ກະລຸນາລ໋ອກອິນແອດມິນໃໝ່');
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      render(await res.json());
    } catch (e) {
      if (seq !== loadSeq || busy) return;
      if (isClosed === null || !silent) renderError('ກວດສະຖານະບໍ່ໄດ້ — ກົດລອງໃໝ່');
    }
  }

  btn.addEventListener('click', async () => {
    if (busy) return;
    if (isClosed === null) { // ยังไม่รู้สถานะ -> ปุ่มนี้ทำหน้าที่ "ลองใหม่"
      btn.disabled = true;
      status.textContent = 'ກຳລັງກວດສະຖານະ...';
      load(false);
      return;
    }
    const next = !isClosed;
    const msg = next
      ? 'ປິດເວັບດຽວນີ້? ລູກຄ້າທຸກຄົນຈະເຂົ້າເວັບບໍ່ໄດ້ ແລະ ເຫັນໜ້າປິດປັບປຸງ (ແອດມິນຍັງເຂົ້າໄດ້)'
      : 'ເປີດເວັບໃຫ້ລູກຄ້າເຂົ້າໃຊ້ງານປົກກະຕິ?';
    if (!confirm(msg)) return;

    busy = true;
    loadSeq++;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    try {
      const res = await request(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: next }),
      }, 15000);
      let d = null;
      try { d = await res.json(); } catch (e) { /* ตอบกลับไม่ใช่ JSON */ }
      if (!res.ok || !d) throw new Error((d && d.error) || ('HTTP ' + res.status));
      busy = false;
      render(d);
      notify(d.on ? 'ປິດເວັບແລ້ວ' : 'ເປີດເວັບແລ້ວ');
    } catch (e) {
      busy = false;
      btn.textContent = label;
      btn.disabled = false;
      notify('ບັນທຶກບໍ່ສຳເລັດ: ' + (e.name === 'AbortError' ? 'ການເຊື່ອມຕໍ່ຊ້າເກີນໄປ' : e.message));
      load(true); // บันทึกอาจสำเร็จไปแล้วแต่ตอบกลับไม่ทัน -> อ่านสถานะจริงจากเซิร์ฟเวอร์มาโชว์ ไม่เดาเอง
    }
  });

  // แอดมินหลายคน/หลายแท็บ: เช็คซ้ำเป็นระยะ และตอนสลับกลับมาที่แท็บนี้
  setInterval(() => { if (!document.hidden) load(true); }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(true); });
  load(false);
})();
