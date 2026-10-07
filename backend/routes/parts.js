const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ===== GET all parts =====
router.get('/parts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('parts')
      .select(`
        *,
        categories:category_id (id, name, prefix),
        locations:location_id (row_number, shelf_number, bin_number)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const formatted = data.map(p => ({
      ...p,
      category_name: p.categories?.name,
      category_prefix: p.categories?.prefix,
      location: p.locations ? `${p.locations.row_number}-${p.locations.shelf_number}-${p.locations.bin_number}` : null,
      purchase_price: p.purchase_price || 0,
      selling_price: p.selling_price || 0,
      is_selling_price_set: p.is_selling_price_set || false
    }));
    res.json({ success: true, count: data.length, parts: formatted });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch parts', details: error.message });
  }
});

// ===== POST new part =====
router.post('/parts', async (req, res) => {
  try {
    const {
      item_name, category_prefix, car_brand, car_model, item_type,
      condition, quantity, min_stock, row_number, shelf_number, bin_number,
      supplier_name, supplier_type, purchase_price
    } = req.body;

    if (!item_name || !category_prefix || quantity === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: category, error: catErr } = await supabase
      .from('categories')
      .select('id, prefix')
      .eq('prefix', category_prefix)
      .single();
    if (catErr || !category) {
      return res.status(400).json({ error: `Category with prefix '${category_prefix}' not found` });
    }

    let locationId = null;
    if (row_number && shelf_number && bin_number) {
      let { data: loc } = await supabase
        .from('locations')
        .select('id')
        .eq('row_number', row_number)
        .eq('shelf_number', shelf_number)
        .eq('bin_number', bin_number)
        .single();
      if (!loc) {
        const { data: newLoc } = await supabase
          .from('locations')
          .insert([{ row_number, shelf_number, bin_number, description: `Row ${row_number}, Shelf ${shelf_number}, Bin ${bin_number}` }])
          .select('id')
          .single();
        if (newLoc) locationId = newLoc.id;
      } else {
        locationId = loc.id;
      }
    }

    const { data: existing } = await supabase
      .from('parts')
      .select('item_code')
      .ilike('item_code', `${category_prefix}-%`);
    let next = 1;
    if (existing && existing.length > 0) {
      const nums = existing.map(p => parseInt(p.item_code.split('-')[1])).filter(n => !isNaN(n));
      if (nums.length) next = Math.max(...nums) + 1;
    }
    const itemCode = `${category_prefix}-${String(next).padStart(3, '0')}`;

    const { data: newPart, error: insertErr } = await supabase
      .from('parts')
      .insert([{
        item_name, category_id: category.id, car_brand, car_model,
        item_type: item_type || 'Other', condition: condition || 'New',
        item_code: itemCode,
        quantity: parseInt(quantity) || 0,
        min_stock: parseInt(min_stock) || 5,
        location_id: locationId,
        supplier_name, supplier_type,
        purchase_price: parseFloat(purchase_price) || 0,
        selling_price: 0,
        is_selling_price_set: false
      }])
      .select()
      .single();

    if (insertErr) throw insertErr;

    res.status(201).json({
      success: true,
      message: 'Part added!',
      part: newPart,
      item_code: itemCode
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add part', details: error.message });
  }
});

// ===== PUT set selling price =====
router.put('/parts/:id/set-selling-price', async (req, res) => {
  try {
    const { selling_price } = req.body;
    if (selling_price === undefined || selling_price < 0) {
      return res.status(400).json({ error: 'Valid selling price required' });
    }
    const { data, error } = await supabase
      .from('parts')
      .update({ selling_price: parseFloat(selling_price), is_selling_price_set: true })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, message: 'Selling price updated', part: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT restock =====
router.put('/parts/:id/restock', async (req, res) => {
  try {
    const { quantity_to_add, restock_by } = req.body;
    if (!quantity_to_add || quantity_to_add < 1) {
      return res.status(400).json({ error: 'quantity_to_add must be positive' });
    }
    const { data: part, error: getErr } = await supabase
      .from('parts')
      .select('id, quantity')
      .eq('id', req.params.id)
      .single();
    if (getErr) throw getErr;
    const newQty = part.quantity + quantity_to_add;
    const { data: updated, error: updErr } = await supabase
      .from('parts')
      .update({ quantity: newQty })
      .eq('id', req.params.id)
      .select()
      .single();
    if (updErr) throw updErr;
    await supabase.from('stock_movements').insert([{
      part_id: req.params.id,
      quantity_change: quantity_to_add,
      reason: 'Restock',
      ordered_by_name: restock_by || 'Store Keeper',
      approved_by_name: 'System'
    }]);
    res.json({ success: true, message: `Restocked ${quantity_to_add} units`, part: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET search parts =====
router.get('/parts/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (q.length < 2) return res.json({ success: true, count: 0, parts: [] });
    const { data, error } = await supabase
      .from('parts')
      .select(`
        *,
        categories:category_id (id, name, prefix),
        locations:location_id (row_number, shelf_number, bin_number)
      `)
      .or(`item_name.ilike.%${q}%,car_brand.ilike.%${q}%,car_model.ilike.%${q}%,item_code.ilike.%${q}%`)
      .order('item_name');
    if (error) throw error;
    const formatted = data.map(p => ({
      ...p,
      category_name: p.categories?.name,
      category_prefix: p.categories?.prefix,
      location: p.locations ? `${p.locations.row_number}-${p.locations.shelf_number}-${p.locations.bin_number}` : null,
      purchase_price: p.purchase_price || 0,
      selling_price: p.selling_price || 0,
      is_selling_price_set: p.is_selling_price_set || false
    }));
    res.json({ success: true, count: data.length, parts: formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET categories =====
router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) throw error;
    res.json({ success: true, categories: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GET locations =====
router.get('/locations', async (req, res) => {
  try {
    const { data, error } = await supabase.from('locations').select('*').order('row_number');
    if (error) throw error;
    res.json({ success: true, locations: data.map(l => ({ ...l, display: `${l.row_number}-${l.shelf_number}-${l.bin_number}` })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PUT update part =====
router.put('/parts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      item_name, category_prefix, car_brand, car_model, item_type,
      condition, quantity, min_stock, row_number, shelf_number, bin_number,
      supplier_name, supplier_type, purchase_price, selling_price
    } = req.body;

    const updateData = {};
    if (item_name !== undefined) updateData.item_name = item_name;
    if (car_brand !== undefined) updateData.car_brand = car_brand;
    if (car_model !== undefined) updateData.car_model = car_model;
    if (item_type !== undefined) updateData.item_type = item_type;
    if (condition !== undefined) updateData.condition = condition;
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (min_stock !== undefined) updateData.min_stock = parseInt(min_stock);
    if (supplier_name !== undefined) updateData.supplier_name = supplier_name;
    if (supplier_type !== undefined) updateData.supplier_type = supplier_type;
    if (purchase_price !== undefined) updateData.purchase_price = parseFloat(purchase_price);
    if (selling_price !== undefined) {
      updateData.selling_price = parseFloat(selling_price);
      updateData.is_selling_price_set = true;
    }

    if (category_prefix !== undefined) {
      const { data: cat, error: catErr } = await supabase
        .from('categories')
        .select('id')
        .eq('prefix', category_prefix)
        .single();
      if (catErr || !cat) {
        return res.status(400).json({ error: `Category with prefix '${category_prefix}' not found` });
      }
      updateData.category_id = cat.id;
    }

    if (row_number !== undefined || shelf_number !== undefined || bin_number !== undefined) {
      if (row_number && shelf_number && bin_number) {
        let { data: loc } = await supabase
          .from('locations')
          .select('id')
          .eq('row_number', row_number)
          .eq('shelf_number', shelf_number)
          .eq('bin_number', bin_number)
          .single();
        if (!loc) {
          const { data: newLoc } = await supabase
            .from('locations')
            .insert([{ row_number, shelf_number, bin_number, description: `Row ${row_number}, Shelf ${shelf_number}, Bin ${bin_number}` }])
            .select('id')
            .single();
          if (newLoc) loc = newLoc;
        }
        if (loc) updateData.location_id = loc.id;
      }
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('parts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Part updated', part: data });
  } catch (error) {
    console.error('Update part error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== DELETE part =====
router.delete('/parts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: part, error: findErr } = await supabase
      .from('parts')
      .select('id')
      .eq('id', id)
      .single();
    if (findErr || !part) {
      return res.status(404).json({ error: 'Part not found' });
    }
    const { error } = await supabase
      .from('parts')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Part deleted successfully' });
  } catch (error) {
    console.error('Delete part error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;