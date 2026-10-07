const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ===== GET /stats =====
router.get('/stats', async (req, res) => {
  try {
    const { count: totalParts } = await supabase.from('parts').select('*', { count: 'exact', head: true });

    const { data: qData } = await supabase.from('parts').select('quantity');
    const totalQty = qData ? qData.reduce((s, p) => s + (p.quantity || 0), 0) : 0;

    const { data: newParts } = await supabase.from('parts').select('quantity').eq('condition', 'New');
    const totalNewQty = newParts ? newParts.reduce((s, p) => s + (p.quantity || 0), 0) : 0;

    const { data: usedParts } = await supabase.from('parts').select('quantity').eq('condition', 'Used');
    const totalUsedQty = usedParts ? usedParts.reduce((s, p) => s + (p.quantity || 0), 0) : 0;

    const { count: pendingOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending_manager');
    const { count: completedOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed');
    const { count: totalOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true });

    const { data: allParts } = await supabase.from('parts').select('id, item_name, item_code, quantity, min_stock');
    const lowStock = allParts ? allParts.filter(p => p.quantity <= p.min_stock) : [];

    const { data: noPrice } = await supabase
      .from('parts').select('id, item_name, item_code, purchase_price')
      .eq('is_selling_price_set', false).limit(10);

    const { data: partsWithCat } = await supabase.from('parts').select('categories:category_id (name)');
    const catMap = {};
    partsWithCat?.forEach(p => {
      const name = p.categories?.name || 'Uncategorized';
      catMap[name] = (catMap[name] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    const { data: partsWithCatQty } = await supabase.from('parts').select('categories:category_id (name), quantity');
    const catQtyMap = {};
    partsWithCatQty?.forEach(p => {
      const name = p.categories?.name || 'Uncategorized';
      catQtyMap[name] = (catQtyMap[name] || 0) + (p.quantity || 0);
    });
    const categoryQuantityBreakdown = Object.entries(catQtyMap).map(([name, totalQuantity]) => ({ name, totalQuantity }));

    res.json({
      success: true,
      stats: {
        total_parts: totalParts || 0,
        total_quantity: totalQty,
        total_new_quantity: totalNewQty,
        total_used_quantity: totalUsedQty,
        pending_manager_orders: pendingOrders || 0,
        low_stock_items: lowStock,
        low_stock_count: lowStock.length,
        no_selling_price_items: noPrice || [],
        category_breakdown: categoryBreakdown,
        category_quantity_breakdown: categoryQuantityBreakdown,
        total_orders: totalOrders || 0,
        completed_orders: completedOrders || 0
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

// ===== GET /monthly-summary =====
router.get('/monthly-summary', async (req, res) => {
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const { data: movements } = await supabase
      .from('stock_movements').select('quantity_change')
      .eq('reason', 'Sale').gte('created_at', firstDay).lte('created_at', lastDay);
    const totalSold = movements ? movements.reduce((sum, m) => sum + Math.abs(m.quantity_change), 0) : 0;

    const { count: completedCount } = await supabase
      .from('work_orders').select('*', { count: 'exact', head: true })
      .eq('status', 'completed').gte('created_at', firstDay).lte('created_at', lastDay);

    const { data: paidOrders } = await supabase
      .from('work_orders').select('total_amount')
      .eq('status', 'paid').gte('created_at', firstDay).lte('created_at', lastDay);

    const totalRevenue = paidOrders ? paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) : 0;
    const paidCount = paidOrders ? paidOrders.length : 0;
    const avgRevenue = paidCount > 0 ? (totalRevenue / paidCount) : 0;

    res.json({
      success: true,
      summary: {
        items_sold: totalSold,
        work_orders_completed: completedCount || 0,
        work_orders_paid: paidCount,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        avg_revenue: Math.round(avgRevenue * 100) / 100
      }
    });
  } catch (error) {
    console.error('Monthly summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;