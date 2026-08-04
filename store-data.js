/* =========================================================
   store-data.js
   -------------------------------------------------------
   ຄັງຂໍ້ມູນສິນຄ້າ + ສະຕັອກລະຫັດ ຂອງ DEK MASH SHOP
   ໃຊ້ຮ່ວມກັນລະຫວ່າງ index.html (ໜ້າຮ້ານ) ແລະ admin.html (ຫ້ອງແອດມິນ)

   ⚠️ ໝາຍເຫດສຳຄັນ: ນີ້ເປັນເວັບ static (ບໍ່ມີ backend/database ແທ້),
   ຂໍ້ມູນທັງໝົດຈຶ່ງເກັບໄວ້ໃນ localStorage ຂອງ browser ເທົ່ານັ້ນ —
   ໃຊ້ໄດ້ຈິງເພື່ອທົດລອງ/demo ແຕ່ບໍ່ sync ຂ້າມເຄື່ອງ/browser ແລະ
   ບໍ່ປອດໄພພຽງພໍສຳລັບຮ້ານທີ່ໃຊ້ງານຈິງ (ລູກຄ້າສາມາດເປີດ devtools
   ເບິ່ງລະຫັດທີ່ຍັງບໍ່ຖືກຂາຍໄດ້). ຖ້າຈະໃຊ້ງານຈິງຄວນມີ backend
   ແລະ ຖານຂໍ້ມູນຝັ່ງເຊີບເວີ.
   ========================================================= */

(function (global) {
  const STORAGE_KEY = 'dms_store_v1';

  // ID ສິນຄ້າຖືກສ້າງໃຫ້ກົງກັບກາຕູນ (article.prod-card) ທີ່ມີຢູ່ໃນ index.html
  // ຕາມລຳດັບ: ໝວດ pc (3 ໃບ), ໝວດ android (15 ໃບ), ໝວດ gear (2 ໃບ)
  function buildDefaultProducts() {
    const products = [];
    const counts = { pc: 3, android: 15, ios: 4, gear: 2 };
    Object.keys(counts).forEach((cat) => {
      for (let i = 1; i <= counts[cat]; i++) {
        products.push({
          id: `${cat}-${i}`,
          category: cat,
          name: '',
          price: 0,
          status: 'not_ready', // 'ready' | 'not_ready' — ຄຳນວນອັດຕະໂນມັດຈາກ codes ທີ່ເຫຼືອ
          codes: [],           // ລະຫັດທີ່ຍັງບໍ່ຂາຍ (stock)
          sold: []              // { code, at } ລາຍການທີ່ຂາຍໄປແລ້ວ
        });
      }
    });
    return products;
  }

  function defaultData() {
    return {
      products: buildDefaultProducts()
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = defaultData();
        save(fresh);
        return fresh;
      }
      const parsed = JSON.parse(raw);
      // ກັນກໍລະນີໂຄງສ້າງເກົ່າຂາດຫາຍ (ອັບເດດໂຄງສ້າງໃນອະນາຄົດ)
      if (!parsed.products) return defaultData();
      return parsed;
    } catch (e) {
      console.error('store-data: load failed', e);
      return defaultData();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('store-data: save failed', e);
    }
  }

  function getProduct(data, id) {
    return data.products.find((p) => p.id === id) || null;
  }

  function recomputeStatus(product) {
    product.status = product.codes.length > 0 ? 'ready' : 'not_ready';
  }

  function updateProduct(id, fields) {
    const data = load();
    const p = getProduct(data, id);
    if (!p) return null;
    Object.assign(p, fields);
    recomputeStatus(p);
    save(data);
    return p;
  }

  // ເພີ່ມລະຫັດເຂົ້າສະຕັອກ — ຮັບ array ຂອງ string, ຕັດຊ້ຳ ແລະ ຕັດແຖວຫວ່າງອອກ
  function addCodes(id, codeLines) {
    const data = load();
    const p = getProduct(data, id);
    if (!p) return null;
    const clean = codeLines
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    const existing = new Set(p.codes);
    let added = 0;
    clean.forEach((c) => {
      if (!existing.has(c)) {
        p.codes.push(c);
        existing.add(c);
        added++;
      }
    });
    recomputeStatus(p);
    save(data);
    return { product: p, added, skipped: clean.length - added };
  }

  function removeCode(id, code) {
    const data = load();
    const p = getProduct(data, id);
    if (!p) return null;
    p.codes = p.codes.filter((c) => c !== code);
    recomputeStatus(p);
    save(data);
    return p;
  }

  // ດຶງລະຫັດ 1 ອັນອອກຈາກສະຕັອກ (ໃຊ້ຕອນລູກຄ້າກົດຊື້) — ຄືນຄ່າ code ຫຼື null ຖ້າໝົດ
  function consumeCode(id) {
    const data = load();
    const p = getProduct(data, id);
    if (!p || p.codes.length === 0) return null;
    const code = p.codes.shift();
    p.sold.push({ code, at: new Date().toISOString() });
    recomputeStatus(p);
    save(data);
    return code;
  }

  function resetAll() {
    const fresh = defaultData();
    save(fresh);
    return fresh;
  }

  global.StoreData = {
    load, save,
    getProduct, updateProduct,
    addCodes, removeCode, consumeCode,
    resetAll
  };
})(window);
