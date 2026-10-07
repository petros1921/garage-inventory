const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { generateWorkOrderNumber } = require('../utils/generators');

// ===== POST create work order =====
router.post('/work-orders', async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      part_received,
      customer_part_number,
      assigned_technician,
      diagnosis_notes,
      created_by,
      machine_cost,
      received_image_url,
    } = req.body;

    if (!customer_name || !assigned_technician) {
      return res.status(400).json({ error: 'customer_name and assigned_technician are required' });
    }

    const workOrderNumber = await generateWorkOrderNumber();
    const sanitizedCreatedBy = created_by && created_by.trim() !== '' ? created_by : null;
    const initialMachineCost = parseFloat(machine_cost) || 0;

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .insert([{
        work_order_number: workOrderNumber,
        customer_name,
        customer_phone,
        part_received,
        customer_part_number,
        technician_name: assigned_technician,
        assigned_technician,
        diagnosis_notes,
        labor_charge: 0,
        machine_cost: initialMachineCost,
        total_parts_cost: 0,
        total_amount: initialMachineCost,
        received_image_url: received_image_url || null,
        frontdesk_user_id: sanitizedCreatedBy,
        status: 'pending_manager',
        payment_type: 'cash',
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({
      success: true,
      message: `✅ Work order ${workOrderNumber} sent to Manager`,
      workOrder,
    });
  } catch (error) {
    console.error('Work order creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GET with parts =====
router.get('/work-orders/with-parts', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('work_orders')
      .select(`
        *,
        work_order_parts (
          *,
          part:part_id (id, item_name, item_code, car_brand, car_model, selling_price)
        )
      `)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;

    const mapped = data.map(wo => ({
      ...wo,
      work_price: wo.labor_charge || 0,
      machine_price: wo.machine_cost || 0,
      part_price: wo.total_parts_cost || 0,
      total_price: wo.total_amount || 0,
    }));

    res.json({ success: true, workOrders: mapped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GET single =====
router.get('/work-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        work_order_parts (
          *,
          part:part_id (id, item_name, item_code, car_brand, car_model, selling_price)
        )
      `)
      .eq('id', id)
      .single();
    if (error) throw error;

    const mapped = {
      ...data,
      work_price: data.labor_charge || 0,
      machine_price: data.machine_cost || 0,
      part_price: data.total_parts_cost || 0,
      total_price: data.total_amount || 0,
    };
    res.json({ success: true, workOrder: mapped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT update work order =====
router.put('/work-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;
    delete updates.created_at;
    delete updates.work_order_number;

    const mappedUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'work_price') mappedUpdates.labor_charge = value;
      else if (key === 'machine_price') mappedUpdates.machine_cost = value;
      else if (key === 'part_price') mappedUpdates.total_parts_cost = value;
      else if (key === 'total_price') mappedUpdates.total_amount = value;
      else mappedUpdates[key] = value;
    }

    // Auto timestamps
    if (mappedUpdates.status === 'pending_storekeeper') mappedUpdates.approved_at = new Date().toISOString();
    if (mappedUpdates.status === 'denied') mappedUpdates.denied_at = new Date().toISOString();
    if (mappedUpdates.status === 'completed') mappedUpdates.issued_at = new Date().toISOString();
    if (mappedUpdates.status === 'paid') mappedUpdates.paid_at = new Date().toISOString();

    // Recalc total_amount from current + updates
    const { data: current } = await supabase
      .from('work_orders')
      .select('labor_charge, machine_cost, total_parts_cost')
      .eq('id', id)
      .single();

    const labor = mappedUpdates.labor_charge ?? current?.labor_charge ?? 0;
    const machine = mappedUpdates.machine_cost ?? current?.machine_cost ?? 0;
    const parts = mappedUpdates.total_parts_cost ?? current?.total_parts_cost ?? 0;
    mappedUpdates.total_amount = +(
      (parseFloat(labor) || 0) +
      (parseFloat(machine) || 0) +
      (parseFloat(parts) || 0)
    ).toFixed(2);

    const { data, error } = await supabase
      .from('work_orders')
      .update(mappedUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, workOrder: data });
  } catch (error) {
    console.error('Update work order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== POST add parts =====
router.post('/work-orders/:id/parts', async (req, res) => {
  try {
    const { id } = req.params;
    const { parts } = req.body;

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'At least one part is required' });
    }

    const { data: order, error: orderCheck } = await supabase
      .from('work_orders')
      .select('status, labor_charge, machine_cost')
      .eq('id', id)
      .single();
    if (orderCheck || !order) return res.status(404).json({ error: 'Work order not found' });
    if (order.status === 'completed' || order.status === 'paid') {
      return res.status(400).json({ error: 'Cannot add parts to completed/paid order' });
    }

    const partIds = parts.map(p => p.part_id);
    const { data: priceData, error: priceErr } = await supabase
      .from('parts')
      .select('id, selling_price')
      .in('id', partIds);
    if (priceErr) throw priceErr;
    const priceMap = {};
    priceData?.forEach(p => { priceMap[p.id] = p.selling_price || 0; });

    const workOrderParts = parts.map(p => ({
      work_order_id: id,
      part_id: p.part_id,
      quantity: p.quantity || 1,
      selling_price_at_time: priceMap[p.part_id] || 0,
    }));

    const { error: insertErr } = await supabase
      .from('work_order_parts')
      .insert(workOrderParts);
    if (insertErr) throw insertErr;

    // Recalc total parts cost
    const { data: existingParts } = await supabase
      .from('work_order_parts')
      .select('part_id, quantity')
      .eq('work_order_id', id);
    const allPartIds = existingParts?.map(p => p.part_id) || [];
    let totalPartsCost = 0;
    if (allPartIds.length > 0) {
      const { data: partPrices } = await supabase
        .from('parts')
        .select('id, selling_price')
        .in('id', allPartIds);
      const priceMapAll = {};
      partPrices?.forEach(p => { priceMapAll[p.id] = p.selling_price || 0; });
      existingParts?.forEach(p => {
        totalPartsCost += (priceMapAll[p.part_id] || 0) * p.quantity;
      });
    }

    // Recalc total including machine cost
    const totalAmount = +(
      (parseFloat(order.labor_charge) || 0) +
      (parseFloat(order.machine_cost) || 0) +
      totalPartsCost
    ).toFixed(2);

    await supabase
      .from('work_orders')
      .update({ total_parts_cost: totalPartsCost, total_amount: totalAmount })
      .eq('id', id);

    const { data: updatedOrder } = await supabase
      .from('work_orders')
      .select(`
        *,
        work_order_parts (
          *,
          part:part_id (id, item_name, item_code, car_brand, car_model, selling_price)
        )
      `)
      .eq('id', id)
      .single();

    res.json({ success: true, message: 'Parts added to work order', workOrder: updatedOrder });
  } catch (error) {
    console.error('Add parts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT approve-manager =====
router.put('/work-orders/:id/approve-manager', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: 'pending_storekeeper',
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, message: 'Work order approved', workOrder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT deny-manager =====
router.put('/work-orders/:id/deny-manager', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: 'denied',
        denied_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, message: 'Work order denied', workOrder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT issue-storekeeper =====
router.put('/work-orders/:id/issue-storekeeper', async (req, res) => {
  try {
    const { id } = req.params;
    const { storekeeper_user_id } = req.body;

    const { data: order, error: orderErr } = await supabase
      .from('work_orders')
      .select(`
        *,
        work_order_parts (
          *,
          part:part_id (id, quantity, item_name, item_code)
        )
      `)
      .eq('id', id)
      .single();
    if (orderErr || !order) return res.status(404).json({ error: 'Work order not found' });
    if (order.status === 'completed' || order.status === 'paid') {
      return res.status(400).json({ error: 'Already issued' });
    }
    if (order.status !== 'pending_storekeeper') {
      return res.status(400).json({ error: 'Not ready for issuance' });
    }

    for (const wp of order.work_order_parts || []) {
      const { data: part, error: partErr } = await supabase
        .from('parts')
        .select('quantity')
        .eq('id', wp.part_id)
        .single();
      if (partErr) throw partErr;
      const newQty = part.quantity - wp.quantity;
      if (newQty < 0) {
        return res.status(400).json({ error: `Insufficient stock for ${wp.part?.item_name}` });
      }

      await supabase.from('parts').update({ quantity: newQty }).eq('id', wp.part_id);
      await supabase.from('stock_movements').insert([{
        part_id: wp.part_id,
        quantity_change: -wp.quantity,
        reason: 'Work Order Sale',
        ordered_by_name: order.customer_name,
        approved_by_name: 'Store Keeper',
      }]);
    }

    const { data: updated, error: updateErr } = await supabase
      .from('work_orders')
      .update({
        status: 'completed',
        storekeeper_user_id,
        issued_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    res.json({ success: true, message: 'Work order issued', workOrder: updated });
  } catch (error) {
    console.error('Issue work order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT pay (with VAT + customer_tin + machine_cost) =====
router.put('/work-orders/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fs_number,
      payment_type,
      due_date,
      vat_applied,
      customer_tin,
    } = req.body;

    const type = payment_type === 'credit' ? 'credit' : 'cash';
    const applyVat = !!vat_applied;

    if (applyVat && !fs_number) {
      return res.status(400).json({ error: 'FS number is required when VAT is applied' });
    }

    const { data: wo, error: fetchErr } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !wo) return res.status(404).json({ error: 'Work order not found' });

    // Subtotal now includes machine_cost
    const subtotal =
      (parseFloat(wo.labor_charge) || 0) +
      (parseFloat(wo.machine_cost) || 0) +
      (parseFloat(wo.total_parts_cost) || 0);
    const vatAmount = applyVat ? +(subtotal * 0.15).toFixed(2) : 0;
    const finalTotal = +(subtotal + vatAmount).toFixed(2);

    const updatePayload = {
      fs_number: fs_number || null,
      payment_type: type,
      vat_applied: applyVat,
      vat_amount: vatAmount,
      subtotal: +subtotal.toFixed(2),
      total_amount: finalTotal,
      customer_tin: customer_tin || null,
    };

    if (type === 'credit') {
      if (!due_date) {
        return res.status(400).json({ error: 'due_date is required when payment_type is credit' });
      }
      updatePayload.status = 'credited';
      updatePayload.due_date = due_date;
    } else {
      updatePayload.status = 'paid';
      updatePayload.paid_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('work_orders')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    res.json({
      success: true,
      message: type === 'credit' ? '✅ Work order credited' : 'Work order paid',
      workOrder: data,
    });
  } catch (error) {
    console.error('work-order pay error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT settle-credit =====
router.put('/work-orders/:id/settle-credit', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const { data: order, error: getErr } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', id)
      .single();
    if (getErr || !order) return res.status(404).json({ error: 'Work order not found' });
    if (order.payment_type !== 'credit') return res.status(400).json({ error: 'Not a credit order' });
    if (order.credit_settled_at) return res.status(400).json({ error: 'Already settled' });

    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        credit_settled_at: new Date().toISOString(),
        credit_settled_amount: parseFloat(amount) || order.total_amount || 0,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    res.json({ success: true, message: '✅ Credit settled', workOrder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET by status =====
router.get('/work-orders/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        work_order_parts (
          *,
          part:part_id (id, item_name, item_code, car_brand, car_model, selling_price)
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const mapped = data.map(wo => ({
      ...wo,
      work_price: wo.labor_charge || 0,
      machine_price: wo.machine_cost || 0,
      part_price: wo.total_parts_cost || 0,
      total_price: wo.total_amount || 0,
      work_order_parts: wo.work_order_parts?.map(wp => ({
        ...wp,
        selling_price: wp.part?.selling_price || 0,
        part_name: wp.part?.item_name,
        part_code: wp.part?.item_code,
        car_brand: wp.part?.car_brand,
        car_model: wp.part?.car_model,
      })) || [],
    }));

    res.json({ success: true, workOrders: mapped });
  } catch (error) {
    console.error('Error fetching work orders by status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GET work history =====
router.get('/work-history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .in('status', ['paid', 'completed', 'credited'])
      .order('paid_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json({ success: true, workHistory: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;