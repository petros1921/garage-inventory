const supabase = require('../config/supabase');

async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });
  const seq = String((count || 0) + 1).padStart(4, '0');
  return `ORD-${year}-${seq}`;
}

async function generateWorkOrderNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('work_orders')
    .select('*', { count: 'exact', head: true });
  const seq = String((count || 0) + 1).padStart(4, '0');
  return `WO-${year}-${seq}`;
}

async function generatePurchaseOrderNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true });
  const seq = String((count || 0) + 1).padStart(4, '0');
  return `PO-${year}-${seq}`;
}

module.exports = {
  generateOrderNumber,
  generateWorkOrderNumber,
  generatePurchaseOrderNumber,
};