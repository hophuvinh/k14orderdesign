// ============================================================
//  db.js — Supabase database layer
// ============================================================
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ── ORDERS ────────────────────────────────────────────────────
async function createOrder(data) {
  const { data: row, error } = await supabase
    .from('orders')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return row;
}

async function getOrder(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id', orderId)
    .single();
  if (error) return null;
  return data;
}

async function updateOrder(orderId, fields) {
  const { error } = await supabase
    .from('orders')
    .update(fields)
    .eq('order_id', orderId);
  if (error) throw error;
}

async function getOrdersByDesigner(designerId) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['ĐANG LÀM', 'CHỜ DUYỆT', 'NGHIỆM THU'])
    .order('created_at', { ascending: false });

  if (!data) return [];
  return data.filter(o => {
    try {
      const contributors = JSON.parse(o.contributors || '[]');
      return contributors.some(c => c.id === designerId);
    } catch { return false; }
  });
}

async function getMonthlySummary(year, month) {
  const from = `${year}-${String(month).padStart(2,'0')}-01`;
  const to   = `${year}-${String(month).padStart(2,'0')}-31`;
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'HOÀN THÀNH')
    .gte('created_at', from)
    .lte('created_at', to);

  const summary = {};
  (data || []).forEach(o => {
    let breakdown = {};
    try { breakdown = JSON.parse(o.products_breakdown || '{}'); } catch {}
    Object.entries(breakdown).forEach(([designerId, d]) => {
      if (!summary[designerId]) summary[designerId] = { name: d.name, orders: [], total: 0 };
      const orderTotal = d.items.reduce((s, i) => s + i.amount, 0);
      summary[designerId].orders.push({
        order_id: o.order_id, content: o.content,
        items: d.items, order_total: orderTotal,
      });
      summary[designerId].total += orderTotal;
    });
  });
  return summary;
}

// ── PRODUCTS ──────────────────────────────────────────────────
async function getProducts() {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('name');
  return data || [];
}

async function getProductById(id) {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  return data;
}

async function addProduct(name, price) {
  const { data, error } = await supabase
    .from('products')
    .insert([{ name, price, active: true }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateProductPrice(name, price) {
  const { data, error } = await supabase
    .from('products')
    .update({ price })
    .ilike('name', name)
    .eq('active', true)
    .select();
  if (error) throw error;
  return data && data.length > 0;
}

async function deleteProduct(name) {
  const { data, error } = await supabase
    .from('products')
    .update({ active: false })
    .ilike('name', name)
    .eq('active', true)
    .select();
  if (error) throw error;
  return data && data.length > 0;
}

// ── ORDER ID SEQUENCE ─────────────────────────────────────────
async function getNextSeq() {
  const { data, error } = await supabase.rpc('increment_order_seq');
  if (error) {
    // Fallback: dùng timestamp
    return Date.now() % 1000;
  }
  return data;
}

// ── PENDING STATE (lưu tạm flow nhập số lượng) ───────────────
// Dùng bảng pending_states trong Supabase
async function setPendingState(userId, state) {
  await supabase
    .from('pending_states')
    .upsert([{ user_id: userId, state: JSON.stringify(state), updated_at: new Date().toISOString() }]);
}

async function getPendingState(userId) {
  const { data } = await supabase
    .from('pending_states')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (!data) return null;
  // Expire sau 30 phút
  const age = Date.now() - new Date(data.updated_at).getTime();
  if (age > 30 * 60 * 1000) { await clearPendingState(userId); return null; }
  try { return JSON.parse(data.state); } catch { return null; }
}

async function clearPendingState(userId) {
  await supabase.from('pending_states').delete().eq('user_id', userId);
}

// ── ORDER PERMISSIONS ─────────────────────────────────────────
async function isAllowedToOrder(userId) {
  const { data } = await supabase
    .from('order_permissions')
    .select('user_id')
    .eq('user_id', userId.toString())
    .single();
  return !!data;
}

async function getOrderPermissions() {
  const { data } = await supabase
    .from('order_permissions')
    .select('*')
    .order('added_at');
  return data || [];
}

async function addOrderPermission(userId, userName) {
  await supabase
    .from('order_permissions')
    .upsert([{ user_id: userId.toString(), user_name: userName }]);
}

async function removeOrderPermission(userId) {
  const { data } = await supabase
    .from('order_permissions')
    .delete()
    .eq('user_id', userId.toString())
    .select();
  return data && data.length > 0;
}

module.exports = {
  createOrder, getOrder, updateOrder, getOrdersByDesigner, getMonthlySummary,
  getProducts, getProductById, addProduct, updateProductPrice, deleteProduct,
  getNextSeq, setPendingState, getPendingState, clearPendingState,
  isAllowedToOrder, getOrderPermissions, addOrderPermission, removeOrderPermission,
};
