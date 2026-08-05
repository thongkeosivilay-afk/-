// ============================================
// ຕັ້ງຄ່າ Supabase ຝັ່ງ browser — ຫ້ອງແອດມິນ
//
// 🔒 ອັບເດດຄວາມປອດໄພ: ໄຟລ໌ນີ້ບໍ່ມີ Supabase key ແທ້ຢູ່ອີກຕໍ່ໄປແລ້ວ
// ທຸກຄຳຮ້ອງຂໍຈາກ supabaseClient (ອ່ານ/ຂຽນ/RPC/ອັບໂຫລດຮູບ) ຈະຖືກສົ່ງໄປຫາ
// Worker ຂອງເວັບເຮົາເອງທີ່ path /api/admin/supabase/* ກ່ອນ (ເບິ່ງ src/index.js)
// Worker ຈະເຊັກ session cookie ວ່າ login ດ້ວຍ Discord ແລະເປັນແອດມິນແທ້ (isAdmin: true)
// ກ່ອນ ຈຶ່ງຈະໃສ່ service_role key (ເກັບເປັນ secret ຝັ່ງ Worker ເທົ່ານັ້ນ, ບໍ່ເຄີຍສົ່ງມາຮອດ
// browser) ແລ້ວຄ່ອຍ forward ຄຳຮ້ອງຂໍນັ້ນຕໍ່ໄປຫາ Supabase ຈິງ
//
// ຜົນຄື: ຕໍ່ໃຫ້ມີຄົນອ່ານໄຟລ໌ JS ນີ້ ກໍ່ບໍ່ໄດ້ key ໄປໃຊ້ຢຽບ Supabase ໂດຍກົງ —
// ຕ້ອງມີ session cookie ຂອງແອດມິນທີ່ login ຜ່ານ Discord ແທ້ໆເທົ່ານັ້ນ
// ============================================
const SUPABASE_URL = location.origin + '/api/admin/supabase';
const SUPABASE_ANON_KEY = 'proxied-via-worker'; // ບໍ່ແມ່ນ key ແທ້ — Worker ບໍ່ສົນຄ່ານີ້, ໃສ່ service_role key ທັບໃຫ້ສະເໝີ

// ສ້າງ Supabase client ໃຫ້ admin.js ໃຊ້ (ຕົວແປ global ຊື່ supabaseClient)
// persistSession/autoRefreshToken ປິດໄວ້ ເພາະຫ້ອງແອດມິນບໍ່ໄດ້ໃຊ້ລະບົບ Supabase Auth
// (ໃຊ້ Discord OAuth + session cookie ຂອງ Worker ແທນ)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
