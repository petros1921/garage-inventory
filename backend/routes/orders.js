const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { generateOrderNumber } = require('../utils/generators');

// ===== POST create order =====
router.post('/orders', async (req, res) => {
  try {
    const { customer_name, customer_type, requested_by, frontdesk_user_id, items, notes } = req.body;

    if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }
    if (!requested_by) return res.status(400).json({ error: 'requested_by is required' });

    const itemsWithPrice = [];
    for (const item of items) {
      const { data: part, error: partErr } = await supabase
        .from('parts')
        .select('id, quantity, selling_price, item_name')
        .eq('id', item.part_id)
        .single();
      if (partErr || !part) return res.status(404).json({ error: `Part not found: ${item.part_id}` });
      if (part.quantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${part.item_name}. Available: ${part.quantity}` });
      }
      itemsWithPrice.push({
        part_id: item.part_id,
        quantity: item.quantity,
        selling_price_at_time: part.selling_price || 0
      });
    }

    const orderNumber = await generateOrderNumber();
    const orderPayload = {
      order_number: orderNumber,
      customer_name,
      customer_type: customer_type || 'Buyer',
      requested_by,
      frontdesk_user_id,
      status: 'pending_cashier',
      notes,
      requested_at: new Date().toISOString()
    };

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert([orderPayload])
      .select()
      .single();
    if (orderErr) return res.status(500).json({ error: 'Failed to create order', details: orderErr.message });

    const orderItems = itemsWithPrice.map(item => ({
      order_id: order.id,
      part_id: item.part_id,
      quantity: item.quantity,
      selling_price_at_time: item.selling_price_at_time || 0
    }));

    const { data: createdItems, error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select();
    if (itemsErr) {
      await supabase.from('orders').delete().eq('id', order.id);
      return res.status(500).json({ error: 'Failed to create order items', details: itemsErr.message });
    }

    res.status(201).json({
      success: true,
      message: `✅ Order ${orderNumber} sent to Cashier`,
      order: { ...order, items: createdItems }
    });
  } catch (error) {
    console.error('🔥 Order creation error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ===== PUT fill-cashier (with VAT + customer_tin) =====
router.put('/orders/:id/fill-cashier', async (req, res) => {
  try {
    const {
      fs_number,
      cashier_user_id,
      payment_type,
      due_date,
      vat_applied,
      customer_tin
    } = req.body;

    const type = payment_type === 'credit' ? 'credit' : 'cash';
    const applyVat = !!vat_applied;

    if (applyVat && !fs_number) {
      return res.status(400).json({ error: 'FS number is required when VAT is applied' });
    }

    const { data: orderData, error: fetchErr } = await supabase
      .from('orders')
      .select(`*, order_items ( quantity, selling_price_at_time )`)
      .eq('id', req.params.id)
      .single();
    if (fetchErr || !orderData) return res.status(404).json({ error: 'Order not found' });

    const subtotal = (orderData.order_items || []).reduce(
      (sum, i) => sum + (i.selling_price_at_time || 0) * (i.quantity || 0),
      0
    );
    const vatAmount = applyVat ? +(subtotal * 0.15).toFixed(2) : 0;

    const updatePayload = {
      fs_number: fs_number || null,
      cashier_user_id,
      payment_type: type,
      status: 'pending_manager',
      vat_applied: applyVat,
      vat_amount: vatAmount,
      subtotal: +subtotal.toFixed(2),
      customer_tin: customer_tin || null
    };

    if (type === 'credit') {
      if (!due_date) {
        return res.status(400).json({ error: 'due_date is required when payment_type is credit' });
      }
      updatePayload.due_date = due_date;
    }

    const { data: order, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    res.json({
      success: true,
      message: type === 'credit'
        ? '✅ Credited order sent to Manager'
        : '✅ Order sent to Manager',
      order
    });
  } catch (error) {
    console.error('fill-cashier error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT settle-credit =====
router.put('/orders/:id/settle-credit', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const { data: order, error: getErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    if (getErr || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment_type !== 'credit') return res.status(400).json({ error: 'Not a credit order' });
    if (order.credit_settled_at) return res.status(400).json({ error: 'Already settled' });

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        credit_settled_at: new Date().toISOString(),
        credit_settled_amount: parseFloat(amount) || 0
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    res.json({ success: true, message: '✅ Credit settled', order: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT approve-manager =====
router.put('/orders/:id/approve-manager', async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status: 'pending_storekeeper',
        approved_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, message: '✅ Approved, awaiting Store Keeper', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT deny-manager =====
router.put('/orders/:id/deny-manager', async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .update({ status: 'denied' })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, message: '❌ Order denied', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT issue-storekeeper =====
router.put('/orders/:id/issue-storekeeper', async (req, res) => {
  try {
    const { id } = req.params;
    const { storekeeper_user_id } = req.body;

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id, part_id, quantity, selling_price_at_time,
          parts:part_id (id, item_name, item_code, quantity)
        )
      `)
      .eq('id', id)
      .single();
    if (orderErr || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'completed' || order.status === 'paid') {
      return res.status(400).json({ error: 'Already issued' });
    }
    if (order.status !== 'pending_storekeeper') {
      return res.status(400).json({ error: 'Not ready for issuance' });
    }

    for (const item of order.order_items || []) {
      const { data: part, error: partErr } = await supabase
        .from('parts')
        .select('quantity')
        .eq('id', item.part_id)
        .single();
      if (partErr) throw partErr;
      const newQty = part.quantity - item.quantity;
      if (newQty < 0) {
        return res.status(400).json({ error: `Insufficient stock for ${item.parts?.item_name}` });
      }

      await supabase.from('parts').update({ quantity: newQty }).eq('id', item.part_id);
      await supabase.from('stock_movements').insert([{
        part_id: item.part_id,
        quantity_change: -item.quantity,
        reason: 'Sale',
        ordered_by_name: order.customer_name,
        approved_by_name: 'Store Keeper'
      }]);
    }

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        storekeeper_user_id,
        issued_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    res.json({ success: true, message: '✅ All items issued', order: updatedOrder });
  } catch (error) {
    console.error('Issue part order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ⚠️ IMPORTANT: Order matters below!
// Specific routes (/orders/all, /orders/status/:status) MUST come BEFORE /orders/:id

// ===== GET by status =====
router.get('/orders/status/:status', async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          parts:part_id (id, item_name, item_code, car_brand, car_model, selling_price)
        )
      `)
      .eq('status', req.params.status)
      .order('requested_at', { ascending: true });
    if (error) throw error;
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET all (limited) — MUST be before /orders/:id =====
router.get('/orders/all', async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          parts:part_id (item_name, item_code)
        )
      `)
      .order('requested_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET single — MUST be LAST =====
router.get('/orders/:id', async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          parts:part_id (id, item_name, item_code, car_brand, car_model, selling_price)
        )
      `)
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;