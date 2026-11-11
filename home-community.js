/* =====================================================================
   home-community.js — หน้าแรก (index.html)
   1) แถบประกาศ "ປະກາດ" (#homeAnnounce): ข้อความวิ่งวนต่อเนื่อง
      ข้อความมาจาก ห้องแอดมิน > ຕັ້ງຄ່າຮ້ານ > ຂໍ້ຄວາມປະກາດ (site_settings.announcement_text)
      ผ่าน GET /api/public/storefront (data.store.announcement) — ปล่อยว่าง = ซ่อนแถบ
   2) การ์ด Discord (#homeDiscord): ชื่อเซิร์ฟเวอร์ + คนออนไลน์จริง + รูปสมาชิก
      + ปุ่ม "ເບິ່ງສະມາຊິກ" (กางรายชื่อ) + ปุ่ม "ເຂົ້າຮ່ວມ Discord"
      ข้อมูลจาก Discord widget.json ของเซิร์ฟเวอร์ (ต้องเปิด Server Widget ใน Discord)
      ดึงไม่ได้ = ไม่แสดงการ์ด ไม่กระทบส่วนอื่นของเว็บ
   ===================================================================== */
(function () {
  'use strict';

  const SERVER_ID = '1515277611155325030';
  const REFRESH_MS = 60000;
  const MARQUEE_SPEED = 45; // px ต่อวินาที
  const T = {
    announce: 'ປະກາດ',
    online: 'ອອນລາຍ',
    people: 'ຄົນ',
    members: 'ເບິ່ງສະມາຊິກ',
    join: 'ເຂົ້າຮ່ວມ Discord',
    empty: 'ຍັງບໍ່ມີສະມາຊິກອອນລາຍ',
  };

  const ICON_MEGA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>';
  const ICON_CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const ICON_DC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const safeUrl = (u) => (/^https:\/\//.test(u || '') ? String(u) : '');

  /* ------------------------------------------------------------------
     1) แถบประกาศ
     ------------------------------------------------------------------ */
  const annEl = document.getElementById('homeAnnounce');
  let annText = '';

  function buildMarquee() {
    if (!annEl || !annText) return;
    const win = annEl.querySelector('.hc-ann-win');
    const track = annEl.querySelector('.hc-ann-track');
    if (!win || !track) return;
    const group = (n) => '<div class="hc-ann-grp">' + '<span></span>'.repeat(n) + '</div>';
    const fill = () => track.querySelectorAll('span').forEach((s) => { s.textContent = annText; });

    // วัดความกว้างข้อความ 1 ชุด แล้วทำซ้ำให้ยาวกว่าช่องแสดงผล (ข้อความสั้นก็วิ่งต่อเนื่องไม่มีช่องว่าง)
    track.innerHTML = group(1);
    fill();
    const w = track.querySelector('span').getBoundingClientRect().width || 1;
    const k = Math.max(1, Math.ceil((win.clientWidth || 1) / w));
    track.innerHTML = group(k) + group(k); // 2 ชุด -> translateX(-50%) วนต่อเนื่องพอดี
    fill();
    track.style.setProperty('--hc-dur', Math.max(8, (w * k) / MARQUEE_SPEED).toFixed(1) + 's');
  }

  function renderAnnounce(raw) {
    if (!annEl) return;
    const text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!text) { annEl.hidden = true; annEl.innerHTML = ''; annText = ''; return; }
    if (text === annText && !annEl.hidden) return;
    annText = text;
    annEl.className = 'hc-ann';
    annEl.setAttribute('role', 'region');
    annEl.setAttribute('aria-label', T.announce);
    annEl.innerHTML =
      '<div class="hc-ann-lab">' + ICON_MEGA + '<span>' + T.announce + '</span></div>' +
      '<div class="hc-ann-win"><div class="hc-ann-track"></div></div>';
    annEl.hidden = false;
    buildMarquee();
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildMarquee, 200);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildMarquee).catch(() => {});

  /* ------------------------------------------------------------------
     2) การ์ด Discord
     ------------------------------------------------------------------ */
  const dcEl = document.getElementById('homeDiscord');
  let fallbackInvite = ''; // ลิงก์ Discord จาก ตັ້ງຄ່າຮ້ານ (ใช้เมื่อ widget ไม่มีลิงก์เชิญ)
  let rendered = false;

  function renderDiscord(d) {
    if (!dcEl) return;
    const members = Array.isArray(d.members) ? d.members : [];
    const invite = safeUrl(d.instant_invite) || fallbackInvite;
    const online = Number(d.presence_count || members.length || 0);

    const stack = members.slice(0, 3)
      .map((m) => `<img src="${esc(safeUrl(m.avatar_url))}" alt="" loading="lazy" referrerpolicy="no-referrer">`)
      .join('') + `<span class="hc-dc-more">${ICON_DC}</span>`;

    const list = members.length
      ? members.map((m) => `
          <div class="hc-dc-m">
            <div class="hc-dc-av"><img src="${esc(safeUrl(m.avatar_url))}" alt="" loading="lazy" referrerpolicy="no-referrer"><em class="${esc(m.status || 'online')}"></em></div>
            <div class="hc-dc-mname">${esc(m.username || '')}</div>
          </div>`).join('')
      : `<div class="hc-dc-empty">${T.empty}</div>`;

    const wasOpen = dcEl.classList.contains('open');
    dcEl.className = 'hc-dc' + (wasOpen ? ' open' : '');
    dcEl.innerHTML = `
      <div class="hc-dc-top">
        <div class="hc-dc-ico">${ICON_DC}</div>
        <div class="hc-dc-info">
          <div class="hc-dc-name">${esc(d.name || 'Discord')}</div>
          <div class="hc-dc-on"><i></i><span>${T.online} ${online.toLocaleString('en-US')} ${T.people}</span></div>
        </div>
        <div class="hc-dc-stack">${stack}</div>
      </div>
      <div class="hc-dc-act">
        <button class="hc-dc-mem" type="button" aria-expanded="${wasOpen}">${T.members}${ICON_CHEV}</button>
        ${invite ? `<a class="hc-dc-join" href="${esc(invite)}" target="_blank" rel="noopener">${ICON_DC}${T.join}</a>` : ''}
      </div>
      <div class="hc-dc-list"><div class="hc-dc-list-w"><div class="hc-dc-list-in">${list}</div></div></div>`;
    rendered = true;
  }

  if (dcEl) {
    dcEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.hc-dc-mem');
      if (!btn) return;
      const open = dcEl.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  async function loadDiscord() {
    if (!dcEl) return;
    try {
      const res = await fetch('https://discord.com/api/guilds/' + SERVER_ID + '/widget.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('widget ' + res.status);
      renderDiscord(await res.json());
    } catch (err) {
      console.warn('Discord card:', err);
      // ดึงไม่ได้ครั้งแรก = ไม่แสดงการ์ด ; เคยแสดงแล้ว = คงข้อมูลล่าสุดไว้ (กันการ์ดกระพริบหายตอนเน็ตสะดุด)
      if (!rendered) dcEl.innerHTML = '';
    }
  }

  /* ------------------------------------------------------------------
     เริ่มทำงาน
     ------------------------------------------------------------------ */
  if (window.StorefrontData && typeof window.StorefrontData.fetchData === 'function') {
    window.StorefrontData.fetchData()
      .then((data) => {
        const store = (data && data.store) || {};
        fallbackInvite = safeUrl(store.social && store.social.discord);
        renderAnnounce(store.announcement);
      })
      .catch(() => {})
      .then(() => { loadDiscord(); setInterval(loadDiscord, REFRESH_MS); });
  } else {
    loadDiscord();
    setInterval(loadDiscord, REFRESH_MS);
  }
})();
