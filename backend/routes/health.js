const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/health', async (req, res) => {
  try {
    const { count } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true });
    res.json({ status: '✅ OK', categoriesCount: count || 0 });
  } catch (err) {
    res.status(500).json({ status: '❌ ERROR', message: err.message });
  }
});

module.exports = router;