const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ===== POST allocate =====
router.post('/petty-cash/allocate', async (req, res) => {
  try {
    const { amount, week_start, week_end, created_by } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const start = new Date(week_start);
    const end = new Date(week_end);
    if (end < start) return res.status(400).json({ error: 'End date must be after start date' });

    const { data, error } = await supabase
      .from('petty_cash_allocations')
      .insert([{ amount, week_start: start.toISOString(), week_end: end.toISOString(), created_by }])
      .select().single();
    if (error) throw error;

    res.json({ success: true, message: 'Petty cash allocated', allocation: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET balance =====
router.get('/petty-cash/balance', async (req, res) => {
  try {
    const { data: alloc, error: allocErr } = await supabase
      .from('petty_cash_allocations').select('amount')
      .order('week_start', { ascending: false }).limit(1).single();
    if (allocErr && allocErr.code !== 'PGRST116') throw allocErr;
    const totalAllocated = alloc?.amount || 0;

    const { data: transactions, error: txErr } = await supabase
      .from('petty_cash_transactions').select('amount').eq('type', 'payment');
    if (txErr) throw txErr;
    const totalDeducted = transactions ? transactions.reduce((s, t) => s + t.amount, 0) : 0;

    res.json({
      success: true,
      balance: totalAllocated - totalDeducted,
      total_allocated: totalAllocated,
      total_deducted: totalDeducted
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;