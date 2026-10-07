const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ===== GET /items-sold =====
// Returns every order_item with full context (order number, buyer, part, VAT, etc.)
router.get('/items-sold', async (req, res) => {
  try {
    const { from, to, search, vat } = req.query;

    // Fetch all completed/paid orders (these are the sales)
    let orderQuery = supabase
      .from('orders')
      .select(`
        id, order_number, customer_name, customer_type, fs_number,
        vat_applied, vat_amount, subtotal, status,
        requested_at, approved_at, issued_at,
        order_items (
          id, quantity, selling_price_at_time,
          parts:part_id (id, item_name, item_code, car_brand, car_model, condition)
        )
      `)
      .in('status', ['completed', 'paid']);

    if (from) orderQuery = orderQuery.gte('issued_at', from);
    if (to) orderQuery = orderQuery.lte('issued_at', to + 'T23:59:59');

    const { data: partOrders, error: poErr } = await orderQuery;
    if (poErr) throw poErr;

    // Fetch work order parts from paid/completed work orders
    let workQuery = supabase
      .from('work_orders')
      .select(`
        id, work_order_number, customer_name, fs_number,
        vat_applied, vat_amount, status, paid_at, issued_at,
        work_order_parts (
          id, quantity, selling_price_at_time,
          parts:part_id (id, item_name, item_code, car_brand, car_model)
        )
      `)
      .in('status', ['paid', 'completed']);

    if (from) workQuery = workQuery.gte('issued_at', from);
    if (to) workQuery = workQuery.lte('issued_at', to + 'T23:59:59');

    const { data: workOrders, error: woErr } = await workQuery;
    if (woErr) throw woErr;

    // Flatten into sold items
    const items = [];

    (partOrders || []).forEach(order => {
      (order.order_items || []).forEach(item => {
        items.push({
          id: item.id,
          source_type: 'part_order',
          source_id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          customer_type: order.customer_type,
          fs_number: order.fs_number,
          vat_applied: order.vat_applied,
          vat_amount: order.vat_amount,
          part_name: item.parts?.item_name,
          part_code: item.parts?.item_code,
          brand: item.parts?.car_brand,
          model: item.parts?.car_model,
          condition: item.parts?.condition,
          quantity: item.quantity,
          unit_price: item.selling_price_at_time || 0,
          line_total: (item.selling_price_at_time || 0) * (item.quantity || 0),
          sold_at: order.issued_at || order.requested_at,
        });
      });
    });

    (workOrders || []).forEach(wo => {
      (wo.work_order_parts || []).forEach(wp => {
        items.push({
          id: wp.id,
          source_type: 'work_order',
          source_id: wo.id,
          order_number: wo.work_order_number,
          customer_name: wo.customer_name,
          customer_type: 'Work Order',
          fs_number: wo.fs_number,
          vat_applied: wo.vat_applied,
          vat_amount: wo.vat_amount,
          part_name: wp.parts?.item_name,
          part_code: wp.parts?.item_code,
          brand: wp.parts?.car_brand,
          model: wp.parts?.car_model,
          condition: null,
          quantity: wp.quantity,
          unit_price: wp.selling_price_at_time || 0,
          line_total: (wp.selling_price_at_time || 0) * (wp.quantity || 0),
          sold_at: wo.issued_at || wo.paid_at,
        });
      });
    });

    // Sort by date desc
    items.sort((a, b) => new Date(b.sold_at || 0) - new Date(a.sold_at || 0));

    // Client-side filters for search and vat
    let filtered = items;
    if (search && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(i =>
        (i.order_number || '').toLowerCase().includes(q) ||
        (i.customer_name || '').toLowerCase().includes(q) ||
        (i.part_name || '').toLowerCase().includes(q) ||
        (i.part_code || '').toLowerCase().includes(q) ||
        (i.brand || '').toLowerCase().includes(q)
      );
    }
    if (vat === 'yes') filtered = filtered.filter(i => i.vat_applied);
    else if (vat === 'no') filtered = filtered.filter(i => !i.vat_applied);

    // Summary
    const summary = {
      total_items: filtered.length,
      total_quantity: filtered.reduce((s, i) => s + (i.quantity || 0), 0),
      total_revenue: filtered.reduce((s, i) => s + (i.line_total || 0), 0),
      total_vat: filtered.filter(i => i.vat_applied).reduce((s, i) => s + (i.vat_amount || 0), 0),
      unique_orders: new Set(filtered.map(i => i.order_number)).size,
    };

    res.json({ success: true, items: filtered, summary });
  } catch (error) {
    console.error('items-sold error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;