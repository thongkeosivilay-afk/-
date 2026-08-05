// ============================================
// ຕັ້ງຄ່າ Supabase — ໂປຣເຈັກໃໝ່ (ຕ້ອງແລ່ນ supabase_admin_setup.sql ໃນນີ້ກ່ອນນຳໃຊ້)
// ຫາຄ່າໄດ້ທີ່: Supabase Dashboard > Settings > API
// ============================================
const SUPABASE_URL = "https://ebmambgqghyzrenknkeb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__t5g88mepIjky1Kq-BQUtg_zMjaNHlH";

// ສ້າງ Supabase client ໃຫ້ admin.js ໃຊ້ (ຕົວແປ global ຊື່ supabaseClient)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
