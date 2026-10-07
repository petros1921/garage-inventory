const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ===== GET all old work orders =====
router.get('/old-work-orders', async (req, res) => {
  try {
    const { search } = req.query;
    let q = supabase.from('old_work_orders').select('*').order('original_date', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;

    let filtered = data || [];
    if (search && search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(o =>
        (o.customer_name || '').toLowerCase().includes(s) ||
        (o.wo_number || '').toLowerCase().includes(s) ||
        (o.part_received || '').toLowerCase().includes(s) ||
        (o.technician_name || '').toLowerCase().includes(s) ||
        (o.customer_phone || '').toLowerCase().includes(s)
      );
    }
    res.json({ success: true, oldWorkOrders: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST create =====
router.post('/old-work-orders', async (req, res) => {
  try {
    const {
      wo_number, customer_name, customer_phone, part_received, technician_name,
      work_description, parts_used, total_amount, status, original_date, notes, created_by,
    } = req.body;

    if (!customer_name) return res.status(400).json({ error: 'Customer name is required' });

    const { data, error } = await supabase
      .from('old_work_orders')
      .insert([{
        wo_number, customer_name, customer_phone, part_received, technician_name,
        work_description, parts_used,
        total_amount: parseFloat(total_amount) || 0,
        status: status || 'paid',
        original_date: original_date || null,
        notes, created_by,
      }])
      .select().single();
    if (error) throw error;
    res.status(201).json({ success: true, message: '✅ Old work order added', oldWorkOrder: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PUT update =====
router.put('/old-work-orders/:id', async (req, res) => {
  try {
    const {
      wo_number, customer_name, customer_phone, part_received, technician_name,
      work_description, parts_used, total_amount, status, original_date, notes,
    } = req.body;

    const { data, error } = await supabase
      .from('old_work_orders')
      .update({
        wo_number, customer_name, customer_phone, part_received, technician_name,
        work_description, parts_used,
        total_amount: parseFloat(total_amount) || 0,
        status, original_date, notes,
      })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, message: 'Updated', oldWorkOrder: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DELETE =====
router.delete('/old-work-orders/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('old_work_orders').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;