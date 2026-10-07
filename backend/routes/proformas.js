const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ===== Helper: generate proforma number =====
async function generateProformaNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('proformas')
    .select('*', { count: 'exact', head: true });
  const seq = String((count || 0) + 1).padStart(4, '0');
  return `PRO-${year}-${seq}`;
}

// ===== GET all proformas =====
router.get('/proformas', async (req, res) => {
  try {
    const { status } = req.query;
    let q = supabase.from('proformas').select('*').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ success: true, proformas: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET single =====
router.get('/proformas/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('proformas').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json({ success: true, proforma: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST create =====
router.post('/proformas', async (req, res) => {
  try {
    const {
      customer_name, customer_tin, customer_address, customer_phone,
      date, valid_until, delivery_date,
      items, vat_applied, notes, created_by,
    } = req.body;

    if (!customer_name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Customer name and at least one item are required' });
    }

    const subtotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0), 0);
    const vatAmount = vat_applied ? +(subtotal * 0.15).toFixed(2) : 0;
    const total = +(subtotal + vatAmount).toFixed(2);

    const proforma_number = await generateProformaNumber();

    const { data, error } = await supabase
      .from('proformas')
      .insert([{
        proforma_number,
        customer_name, customer_tin, customer_address, customer_phone,
        date: date || new Date().toISOString().split('T')[0],
        valid_until, delivery_date,
        items,
        subtotal: +subtotal.toFixed(2),
        vat_applied: !!vat_applied,
        vat_amount: vatAmount,
        total,
        notes,
        status: 'draft',
        created_by,
      }])
      .select().single();
    if (error) throw error;

    res.status(201).json({ success: true, message: `✅ Proforma ${proforma_number} created`, proforma: data });
  } catch (err) {
    console.error('Create proforma error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== PUT update =====
router.put('/proformas/:id', async (req, res) => {
  try {
    const {
      customer_name, customer_tin, customer_address, customer_phone,
      date, valid_until, delivery_date,
      items, vat_applied, notes, status,
    } = req.body;

    const subtotal = (items || []).reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseFloat(i.qty) || 0), 0);
    const vatAmount = vat_applied ? +(subtotal * 0.15).toFixed(2) : 0;
    const total = +(subtotal + vatAmount).toFixed(2);

    const updatePayload = {
      customer_name, customer_tin, customer_address, customer_phone,
      date, valid_until, delivery_date,
      items,
      subtotal: +subtotal.toFixed(2),
      vat_applied: !!vat_applied,
      vat_amount: vatAmount,
      total,
      notes,
      status: status || 'draft',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('proformas').update(updatePayload).eq('id', req.params.id).select().single();
    if (error) throw error;

    res.json({ success: true, message: '✅ Proforma updated', proforma: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DELETE =====
router.delete('/proformas/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('proformas').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Proforma deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;