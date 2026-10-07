const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/movements', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stock_movements')
      .select(`*, parts:part_id (id, item_name, item_code, car_brand, car_model)`)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json({ success: true, movements: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;