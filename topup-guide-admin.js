/* topup-guide-admin.js — ตั้งค่าร้าน > ຄລິບສອນເຕີມເງິນ
   ใส่ชื่อ + ลิ้ง (หรือกดอัปโหลดคลิป) แล้วบันทึก -> โชว์ในหน้า topup.html
   อัปโหลดคลิปไปที่ Supabase storage bucket "site-assets" (เหมือนรูปในตั้งค่าร้าน) */
(function () {
  'use strict';
  function init() {
    var list = document.getElementById('tgRows');
    var addBtn = document.getElementById('tgAddBtn');
    var saveBtn = document.getElementById('tgSaveBtn');
    var msg = document.getElementById('tgMsg');
    if (!list || !addBtn || !saveBtn) return;

    function say(text, kind) {
      if (typeof setMsg === 'function' && msg) setMsg(msg, text, kind);
      else if (msg) msg.textContent = text;
    }

    function addRow(label, url) {
      var row = document.createElement('div');
      row.className = 'link-row';
      row.style.flexWrap = 'wrap';
      row.innerHTML =
        '<input type="text" class="tg-label" placeholder="ຊື່ຄລິບ ເຊັ່ນ: ຄລິບສອນເຕີມເງິນ BCEL One">' +
        '<input type="url" class="tg-url" placeholder="ວາງລິ້ງທີ່ນີ້ (https://...)">' +
        '<button type="button" class="link-row-remove tg-up" title="ອັບໂຫຼດຄລິບ" style="width:auto;padding:0 10px;font-size:12px;color:var(--gx-signal,#ff0001)">ອັບໂຫຼດຄລິບ</button>' +
        '<input type="file" class="tg-file" accept="video/*" hidden>' +
        '<button type="button" class="link-row-remove tg-del" title="ລຶບ">×</button>';
      row.querySelector('.tg-label').value = label || '';
      row.querySelector('.tg-url').value = url || '';
      row.querySelector('.tg-del').addEventListener('click', function () { row.remove(); });
      var file = row.querySelector('.tg-file');
      var up = row.querySelector('.tg-up');
      up.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', async function () {
        var f = file.files[0];
        if (!f) return;
        if (typeof supabaseClient === 'undefined') { say('ອັບໂຫຼດບໍ່ໄດ້: ຍັງບໍ່ເຊື່ອມຕໍ່ Supabase', 'error'); return; }
        up.disabled = true; var old = up.textContent; up.textContent = 'ກຳລັງອັບໂຫຼດ...';
        say('ກຳລັງອັບໂຫຼດຄລິບ... (ໄຟລ໌ໃຫຍ່ອາດໃຊ້ເວລາຈັກໜ້ອຍ)', 'pending');
        try {
          var ext = (f.name.split('.').pop() || 'mp4').toLowerCase();
          var path = 'topup-guide/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
          var r = await supabaseClient.storage.from('site-assets').upload(path, f, { contentType: f.type || undefined });
          if (r.error) throw r.error;
          var pub = supabaseClient.storage.from('site-assets').getPublicUrl(path);
          row.querySelector('.tg-url').value = pub.data.publicUrl;
          if (!row.querySelector('.tg-label').value.trim()) row.querySelector('.tg-label').value = f.name.replace(/\.[^.]+$/, '');
          say('ອັບໂຫຼດຄລິບສຳເລັດ — ກົດ "ບັນທຶກ" ເພື່ອໃຊ້ງານ', 'success');
        } catch (e) {
          console.error(e);
          say('ອັບໂຫຼດຄລິບບໍ່ສຳເລັດ: ' + ((e && e.message) || e) + ' (ຖ້າໄຟລ໌ໃຫຍ່ເກີນ ໃຫ້ໃສ່ເປັນລິ້ງ YouTube/Drive ແທນ)', 'error');
        } finally {
          up.disabled = false; up.textContent = old; file.value = '';
        }
      });
      list.appendChild(row);
    }

    addBtn.addEventListener('click', function () { addRow('', ''); });

    saveBtn.addEventListener('click', async function () {
      var links = [];
      var bad = false;
      list.querySelectorAll('.link-row').forEach(function (row) {
        var label = row.querySelector('.tg-label').value.trim();
        var url = row.querySelector('.tg-url').value.trim();
        if (!label && !url) return;
        if (!label || !url) { bad = true; return; }
        if (!/^https?:\/\//i.test(url)) { bad = true; return; }
        links.push({ label: label, url: url });
      });
      if (bad) { say('ກະລຸນາໃສ່ຊື່ ແລະ ລິ້ງ (ຂຶ້ນຕົ້ນດ້ວຍ https://) ໃຫ້ຄົບທຸກແຖວ', 'error'); return; }
      saveBtn.disabled = true; saveBtn.classList.add('loading');
      say('ກຳລັງບັນທຶກ...', 'pending');
      try {
        var res = await fetch('/api/topup-links', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links: links }),
        });
        var d = await res.json().catch(function () { return {}; });
        if (!res.ok || !d.ok) throw new Error(d.error || ('HTTP ' + res.status));
        say('ບັນທຶກສຳເລັດ ✅', 'success');
      } catch (e) {
        say('ບັນທຶກບໍ່ສຳເລັດ: ' + (e.message || e), 'error');
      } finally {
        saveBtn.disabled = false; saveBtn.classList.remove('loading');
      }
    });

    fetch('/api/topup-links', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var links = (d && d.links) || [];
        if (!links.length) addRow('', '');
        links.forEach(function (l) { addRow(l.label, l.url); });
      })
      .catch(function () { addRow('', ''); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
