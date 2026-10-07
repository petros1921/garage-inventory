const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ===== GET /credit-alerts (unsettled only) =====
router.get('/credit-alerts', async (req, res) => {
  try {
    const now = new Date();

    const [ordersRes, workOrdersRes, purchasesRes] = await Promise.all([
      supabase.from('orders').select('*').eq('payment_type', 'credit').is('credit_settled_at', null),
      supabase.from('work_orders').select('*').eq('payment_type', 'credit').is('credit_settled_at', null),
      supabase.from('purchase_orders').select('*').eq('payment_type', 'credit').is('credit_settled_at', null),
    ]);
    if (ordersRes.error) throw ordersRes.error;
    if (workOrdersRes.error) throw workOrdersRes.error;
    if (purchasesRes.error) throw purchasesRes.error;

    const computeUrgency = (dueDate) => {
      if (!dueDate) return { days_until_due: null, urgency: 'normal' };
      const days = Math.ceil((new Date(dueDate) - now) / (1000 * 60 * 60 * 24));
      let urgency = 'normal';
      if (days < 0) urgency = 'overdue';
      else if (days <= 1) urgency = 'critical';
      else if (days <= 3) urgency = 'urgent';
      else if (days <= 5) urgency = 'warning';
      return { days_until_due: days, urgency };
    };

    // Part orders — fetch items to compute totals
    const partOrderIds = (ordersRes.data || []).map(o => o.id);
    let partItemsMap = {};
    if (partOrderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, quantity, selling_price_at_time')
        .in('order_id', partOrderIds);
      (items || []).forEach(item => {
        if (!partItemsMap[item.order_id]) partItemsMap[item.order_id] = 0;
        partItemsMap[item.order_id] += (item.selling_price_at_time || 0) * (item.quantity || 0);
      });
    }

    const partAlerts = (ordersRes.data || []).map(o => {
      const { days_until_due, urgency } = computeUrgency(o.due_date);
      return {
        id: o.id, type: 'part_order',
        order_number: o.order_number,
        customer_name: o.customer_name,
        customer_type: o.customer_type,
        total_amount: partItemsMap[o.id] || 0,
        due_date: o.due_date, days_until_due, urgency,
        created_at: o.requested_at
      };
    });

    const workAlerts = (workOrdersRes.data || []).map(w => {
      const { days_until_due, urgency } = computeUrgency(w.due_date);
      return {
        id: w.id, type: 'work_order',
        order_number: w.work_order_number,
        customer_name: w.customer_name,
        total_amount: w.total_amount || 0,
        due_date: w.due_date, days_until_due, urgency,
        created_at: w.created_at
      };
    });

    const purchaseAlerts = (purchasesRes.data || []).map(p => {
      const { days_until_due, urgency } = computeUrgency(p.due_date);
      return {
        id: p.id, type: 'purchase_order',
        order_number: p.order_number,
        customer_name: p.seller_name,
        total_amount: p.total_amount || 0,
        due_date: p.due_date, days_until_due, urgency,
        created_at: p.created_at
      };
    });

    const allAlerts = [...partAlerts, ...workAlerts, ...purchaseAlerts];
    allAlerts.sort((a, b) => {
      if (a.urgency === 'overdue' && b.urgency !== 'overdue') return -1;
      if (b.urgency === 'overdue' && a.urgency !== 'overdue') return 1;
      return new Date(a.due_date) - new Date(b.due_date);
    });

    const counts = {
      total: allAlerts.length,
      overdue: allAlerts.filter(a => a.urgency === 'overdue').length,
      critical: allAlerts.filter(a => a.urgency === 'critical').length,
      urgent: allAlerts.filter(a => a.urgency === 'urgent').length,
      warning: allAlerts.filter(a => a.urgency === 'warning').length,
    };

    res.json({ success: true, alerts: allAlerts, counts });
  } catch (error) {
    console.error('Credit alerts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GET /credits/all (including settled) =====
router.get('/credits/all', async (req, res) => {
  try {
    const { status = 'all', type = 'all' } = req.query;
    const now = new Date();

    const [ordersRes, workOrdersRes, purchasesRes] = await Promise.all([
      supabase.from('orders').select('*').eq('payment_type', 'credit'),
      supabase.from('work_orders').select('*').eq('payment_type', 'credit'),
      supabase.from('purchase_orders').select('*').eq('payment_type', 'credit'),
    ]);
    if (ordersRes.error) throw ordersRes.error;
    if (workOrdersRes.error) throw workOrdersRes.error;
    if (purchasesRes.error) throw purchasesRes.error;

    const computeDays = (dueDate) => dueDate ? Math.ceil((new Date(dueDate) - now) / (1000 * 60 * 60 * 24)) : null;
    const computeUrgency = (dueDate, settledAt) => {
      if (settledAt) return 'settled';
      if (!dueDate) return 'normal';
      const days = computeDays(dueDate);
      if (days < 0) return 'overdue';
      if (days <= 1) return 'critical';
      if (days <= 3) return 'urgent';
      if (days <= 5) return 'warning';
      return 'normal';
    };

    const partOrderIds = (ordersRes.data || []).map(o => o.id);
    let partItemsMap = {};
    if (partOrderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, quantity, selling_price_at_time')
        .in('order_id', partOrderIds);
      (items || []).forEach(item => {
        if (!partItemsMap[item.order_id]) partItemsMap[item.order_id] = 0;
        partItemsMap[item.order_id] += (item.selling_price_at_time || 0) * (item.quantity || 0);
      });
    }

    const partOrders = (ordersRes.data || []).map(o => ({
      id: o.id, type: 'part_order',
      order_number: o.order_number,
      customer_name: o.customer_name,
      customer_type: o.customer_type,
      total_amount: partItemsMap[o.id] || 0,
      due_date: o.due_date,
      days_until_due: computeDays(o.due_date),
      urgency: computeUrgency(o.due_date, o.credit_settled_at),
      created_at: o.requested_at,
      credit_settled_at: o.credit_settled_at,
      credit_settled_amount: o.credit_settled_amount,
    }));

    const workOrders = (workOrdersRes.data || []).map(w => ({
      id: w.id, type: 'work_order',
      order_number: w.work_order_number,
      customer_name: w.customer_name,
      total_amount: w.total_amount || 0,
      due_date: w.due_date,
      days_until_due: computeDays(w.due_date),
      urgency: computeUrgency(w.due_date, w.credit_settled_at),
      created_at: w.created_at,
      credit_settled_at: w.credit_settled_at,
      credit_settled_amount: w.credit_settled_amount,
    }));

    const purchases = (purchasesRes.data || []).map(p => ({
      id: p.id, type: 'purchase_order',
      order_number: p.order_number,
      customer_name: p.seller_name,
      total_amount: p.total_amount || 0,
      due_date: p.due_date,
      days_until_due: computeDays(p.due_date),
      urgency: computeUrgency(p.due_date, p.credit_settled_at),
      created_at: p.created_at,
      credit_settled_at: p.credit_settled_at,
      credit_settled_amount: p.credit_settled_amount,
    }));

    let all = [...partOrders, ...workOrders, ...purchases];
    if (type !== 'all') all = all.filter(c => c.type === type);

    if (status === 'active') all = all.filter(c => !c.credit_settled_at && c.urgency !== 'overdue');
    else if (status === 'overdue') all = all.filter(c => !c.credit_settled_at && c.urgency === 'overdue');
    else if (status === 'settled') all = all.filter(c => c.credit_settled_at);

    all.sort((a, b) => {
      if (a.urgency === 'settled' && b.urgency !== 'settled') return 1;
      if (b.urgency === 'settled' && a.urgency !== 'settled') return -1;
      if (a.urgency === 'overdue' && b.urgency !== 'overdue') return -1;
      if (b.urgency === 'overdue' && a.urgency !== 'overdue') return 1;
      if (a.credit_settled_at && b.credit_settled_at) return new Date(b.credit_settled_at) - new Date(a.credit_settled_at);
      return new Date(a.due_date || 0) - new Date(b.due_date || 0);
    });

    const combined = [...partOrders, ...workOrders, ...purchases];
    const counts = {
      total: combined.length,
      active: combined.filter(c => !c.credit_settled_at && c.urgency !== 'overdue').length,
      overdue: combined.filter(c => !c.credit_settled_at && c.urgency === 'overdue').length,
      settled: combined.filter(c => c.credit_settled_at).length,
      total_owed: combined.filter(c => !c.credit_settled_at).reduce((s, c) => s + (parseFloat(c.total_amount) || 0), 0),
      total_collected: combined.filter(c => c.credit_settled_at).reduce((s, c) => s + (parseFloat(c.credit_settled_amount) || 0), 0),
    };

    res.json({ success: true, credits: all, counts });
  } catch (error) {
    console.error('All credits error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;