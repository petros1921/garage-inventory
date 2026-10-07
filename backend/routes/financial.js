const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ===== GET /financial-summary =====
router.get('/financial-summary', async (req, res) => {
  try {
    const { from, to } = req.query;

    const applyDate = (query, field) => {
      if (from) query = query.gte(field, from);
      if (to) query = query.lte(field, to + 'T23:59:59');
      return query;
    };

    // Part orders (item sales) — income
    let partQuery = supabase
      .from('orders')
      .select(`id, order_number, customer_name, subtotal, vat_amount, issued_at, created_at, order_items (quantity, selling_price_at_time)`)
      .in('status', ['paid', 'completed']);
    partQuery = applyDate(partQuery, 'issued_at');
    const { data: partOrders } = await partQuery;

    // Work orders — income
    let workQuery = supabase
      .from('work_orders')
      .select('id, work_order_number, customer_name, total_amount, subtotal, vat_amount, issued_at, paid_at, created_at')
      .in('status', ['paid', 'completed']);
    workQuery = applyDate(workQuery, 'issued_at');
    const { data: workOrders } = await workQuery;

    // Purchase orders — expense
    let purchaseQuery = supabase
      .from('purchase_orders')
      .select('id, order_number, seller_name, item_description, total_amount, paid_at, created_at')
      .in('status', ['paid', 'completed']);
    purchaseQuery = applyDate(purchaseQuery, 'paid_at');
    const { data: purchases } = await purchaseQuery;

    // Totals
    let itemSalesRevenue = 0;
    (partOrders || []).forEach(o => {
      (o.order_items || []).forEach(i => {
        itemSalesRevenue += (i.selling_price_at_time || 0) * (i.quantity || 0);
      });
    });
    const workOrderRevenue = (workOrders || []).reduce((s, w) => s + (parseFloat(w.total_amount) || 0), 0);
    const purchaseExpense = (purchases || []).reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0);
    const totalIncome = itemSalesRevenue + workOrderRevenue;

    // Group by month
    const monthlyMap = {};
    const monthKey = (d) => {
      if (!d) return null;
      const dt = new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    };
    const ensure = (k) => {
      if (!monthlyMap[k]) monthlyMap[k] = { month: k, itemSales: 0, workOrders: 0, expenses: 0 };
      return monthlyMap[k];
    };

    (partOrders || []).forEach(o => {
      const k = monthKey(o.issued_at || o.created_at);
      if (!k) return;
      const total = (o.order_items || []).reduce((s, i) => s + (i.selling_price_at_time || 0) * (i.quantity || 0), 0);
      ensure(k).itemSales += total;
    });
    (workOrders || []).forEach(w => {
      const k = monthKey(w.issued_at || w.paid_at || w.created_at);
      if (!k) return;
      ensure(k).workOrders += parseFloat(w.total_amount) || 0;
    });
    (purchases || []).forEach(p => {
      const k = monthKey(p.paid_at || p.created_at);
      if (!k) return;
      ensure(k).expenses += parseFloat(p.total_amount) || 0;
    });

    const monthly = Object.values(monthlyMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        month: m.month,
        label: new Date(m.month + '-01').toLocaleString('default', { month: 'short', year: 'numeric' }),
        itemSales: +m.itemSales.toFixed(2),
        workOrders: +m.workOrders.toFixed(2),
        totalIncome: +(m.itemSales + m.workOrders).toFixed(2),
        expenses: +m.expenses.toFixed(2),
        netProfit: +(m.itemSales + m.workOrders - m.expenses).toFixed(2),
      }));

    res.json({
      success: true,
      summary: {
        itemSalesRevenue: +itemSalesRevenue.toFixed(2),
        workOrderRevenue: +workOrderRevenue.toFixed(2),
        totalIncome: +totalIncome.toFixed(2),
        totalExpenses: +purchaseExpense.toFixed(2),
        netProfit: +(totalIncome - purchaseExpense).toFixed(2),
        counts: {
          partOrders: (partOrders || []).length,
          workOrders: (workOrders || []).length,
          purchases: (purchases || []).length,
        },
      },
      monthly,
    });
  } catch (err) {
    console.error('financial-summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== GET /petty-cash/report =====
router.get('/petty-cash/report', async (req, res) => {
  try {
    const { from, to } = req.query;

    let allocQ = supabase.from('petty_cash_allocations').select('*').order('week_start', { ascending: false });
    if (from) allocQ = allocQ.gte('week_start', from);
    if (to) allocQ = allocQ.lte('week_start', to);
    const { data: allocations } = await allocQ;

    let txQ = supabase
      .from('petty_cash_transactions')
      .select('*, purchase_orders: purchase_order_id (order_number, item_description, seller_name)')
      .order('created_at', { ascending: false });
    if (from) txQ = txQ.gte('created_at', from);
    if (to) txQ = txQ.lte('created_at', to + 'T23:59:59');
    const { data: transactions } = await txQ;

    const totalAllocated = (allocations || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    const totalSpent = (transactions || []).filter(t => t.type === 'payment').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    res.json({
      success: true,
      summary: {
        totalAllocated: +totalAllocated.toFixed(2),
        totalSpent: +totalSpent.toFixed(2),
        balance: +(totalAllocated - totalSpent).toFixed(2),
      },
      allocations: allocations || [],
      transactions: transactions || [],
    });
  } catch (err) {
    console.error('petty-cash/report error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;