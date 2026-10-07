const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { generatePurchaseOrderNumber } = require('../utils/generators');

// ===== POST create =====
router.post('/purchase-orders', async (req, res) => {
  try {
    const {
      seller_name, seller_type, item_description, brand, model,
      condition, quantity, purchase_price, total_amount, notes,
      created_by, image_url,
    } = req.body;

    if (!item_description || !purchase_price || !quantity || !created_by) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const orderNumber = await generatePurchaseOrderNumber();

    const { data: order, error } = await supabase
      .from('purchase_orders')
      .insert([{
        order_number: orderNumber,
        seller_name,
        seller_type: seller_type || 'Other',
        item_description, brand, model,
        condition: condition || 'New',
        quantity: parseInt(quantity),
        purchase_price: parseFloat(purchase_price),
        total_amount: parseFloat(total_amount) || parseFloat(purchase_price) * parseInt(quantity),
        status: 'pending_manager',
        payment_type: 'cash',
        created_by, notes,
        image_url: image_url || null,
      }])
      .select()
      .single();
    if (error) throw error;

    res.status(201).json({
      success: true,
      message: `✅ Purchase order ${orderNumber} created`,
      order,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET all =====
router.get('/purchase-orders', async (req, res) => {
  try {
    const { status, created_by, limit = 50 } = req.query;
    let query = supabase.from('purchase_orders').select('*');
    if (status) query = query.eq('status', status);
    if (created_by) query = query.eq('created_by', created_by);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    if (error) throw error;
    res.json({ success: true, orders: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET single =====
router.get('/purchase-orders/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json({ success: true, order: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT approve-manager =====
router.put('/purchase-orders/:id/approve-manager', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;

    const { data: order, error: getErr } = await supabase
      .from('purchase_orders').select('*').eq('id', id).single();
    if (getErr || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending_manager') return res.status(400).json({ error: 'Not pending approval' });

    const threshold = 50000;
    const nextStatus = order.total_amount <= threshold ? 'pending_payment' : 'pending_manager_payment';

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status: nextStatus, approved_by, approved_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;

    res.json({ success: true, message: `Order approved → ${nextStatus}`, order: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT deny-manager =====
router.put('/purchase-orders/:id/deny-manager', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders').update({ status: 'denied' })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'Order denied', order: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT pay-manager (with VAT) =====
router.put('/purchase-orders/:id/pay-manager', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, receipt_no, paid_by, payment_type, due_date, vat_applied } = req.body;

    if (!payment_method || !receipt_no) {
      return res.status(400).json({ error: 'Payment method and receipt number required' });
    }

    const type = payment_type === 'credit' ? 'credit' : 'cash';
    const applyVat = !!vat_applied;

    const { data: existing } = await supabase
      .from('purchase_orders').select('total_amount').eq('id', id).single();
    const subtotal = existing?.total_amount || 0;
    const vatAmount = applyVat ? +(subtotal * 0.15).toFixed(2) : 0;

    const updatePayload = {
      payment_method, receipt_no, paid_by,
      payment_type: type,
      vat_applied: applyVat,
      vat_amount: vatAmount,
      subtotal: +subtotal.toFixed(2),
    };

    if (type === 'credit') {
      if (!due_date) return res.status(400).json({ error: 'due_date required for credit' });
      updatePayload.status = 'credited';
      updatePayload.due_date = due_date;
    } else {
      updatePayload.status = 'paid';
      updatePayload.paid_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('purchase_orders').update(updatePayload).eq('id', id).select().single();
    if (error) throw error;

    res.json({
      success: true,
      message: type === 'credit' ? '✅ Purchase credited' : 'Payment recorded',
      order: data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT pay-cashier (with VAT) =====
router.put('/purchase-orders/:id/pay-cashier', async (req, res) => {
  try {
    const { id } = req.params;
    const { paid_by, payment_type, due_date, vat_applied } = req.body;
    const type = payment_type === 'credit' ? 'credit' : 'cash';
    const applyVat = !!vat_applied;

    const { data: order, error: getErr } = await supabase
      .from('purchase_orders').select('*').eq('id', id).single();
    if (getErr || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending_payment') return res.status(400).json({ error: 'Not ready for cashier payment' });

    const subtotal = order.total_amount || 0;
    const vatAmount = applyVat ? +(subtotal * 0.15).toFixed(2) : 0;
    const finalAmount = +(subtotal + vatAmount).toFixed(2);

    if (type === 'cash') {
      const { data: alloc } = await supabase
        .from('petty_cash_allocations').select('amount')
        .order('week_start', { ascending: false }).limit(1).single();
      const currentBalance = alloc?.amount || 0;
      const { data: transactions } = await supabase
        .from('petty_cash_transactions').select('amount').eq('type', 'payment');
      const totalDeducted = transactions ? transactions.reduce((s, t) => s + t.amount, 0) : 0;
      const remaining = currentBalance - totalDeducted;

      if (finalAmount > remaining) {
        return res.status(400).json({ error: `Insufficient petty cash. Available: ${remaining}, Required: ${finalAmount}` });
      }

      await supabase.from('petty_cash_transactions').insert([{
        purchase_order_id: id,
        amount: finalAmount,
        type: 'payment',
        created_by: paid_by,
      }]);
    }

    const updatePayload = {
      paid_by,
      payment_type: type,
      vat_applied: applyVat,
      vat_amount: vatAmount,
      subtotal: +subtotal.toFixed(2),
    };

    if (type === 'credit') {
      if (!due_date) return res.status(400).json({ error: 'due_date required for credit' });
      updatePayload.status = 'credited';
      updatePayload.due_date = due_date;
    } else {
      updatePayload.status = 'paid';
      updatePayload.paid_at = new Date().toISOString();
    }

    const { data: updated, error: updErr } = await supabase
      .from('purchase_orders').update(updatePayload).eq('id', id).select().single();
    if (updErr) throw updErr;

    res.json({
      success: true,
      message: type === 'credit' ? '✅ Purchase credited' : 'Payment successful',
      order: updated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT settle-credit =====
router.put('/purchase-orders/:id/settle-credit', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const { data: order, error: getErr } = await supabase
      .from('purchase_orders').select('*').eq('id', id).single();
    if (getErr || !order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment_type !== 'credit') return res.status(400).json({ error: 'Not a credit order' });
    if (order.credit_settled_at) return res.status(400).json({ error: 'Already settled' });

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        credit_settled_at: new Date().toISOString(),
        credit_settled_amount: parseFloat(amount) || order.total_amount || 0,
      })
      .eq('id', id).select().single();
    if (error) throw error;

    res.json({ success: true, message: '✅ Credit settled', order: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT acknowledge-frontdesk =====
router.put('/purchase-orders/:id/acknowledge-frontdesk', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ frontdesk_acknowledged: true })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, order: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT add-to-inventory =====
router.put('/purchase-orders/:id/add-to-inventory', async (req, res) => {
  try {
    const { id } = req.params;
    const { part_id } = req.body;
    if (!part_id) return res.status(400).json({ error: 'part_id is required' });

    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status: 'completed', part_id, storekeeper_added: true })
      .eq('id', id).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'Item added to inventory', order: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;