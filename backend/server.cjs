require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// =============================================
// APP SETUP
// =============================================
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// =============================================
// SUPABASE CLIENT
// =============================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);
app.locals.supabase = supabase;

// =============================================
// HEALTH CHECK
// =============================================
app.get('/api/health', async (req, res) => {
  try {
    const { count } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true });
    res.json({ status: '✅ OK', categoriesCount: count || 0 });
  } catch (err) {
    res.status(500).json({ status: '❌ ERROR', message: err.message });
  }
});

// =============================================
// PARTS CRUD
// =============================================
app.get('/api/parts', async (req, res) => {
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

app.post('/api/parts', async (req, res) => {
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

    // Generate code
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

app.put('/api/parts/:id/set-selling-price', async (req, res) => {
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

app.put('/api/parts/:id/restock', async (req, res) => {
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

app.get('/api/parts/search', async (req, res) => {
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

app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) throw error;
    res.json({ success: true, categories: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/locations', async (req, res) => {
  try {
    const { data, error } = await supabase.from('locations').select('*').order('row_number');
    if (error) throw error;
    res.json({ success: true, locations: data.map(l => ({ ...l, display: `${l.row_number}-${l.shelf_number}-${l.bin_number}` })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// PART ORDER SYSTEM (External Buyers)
// =============================================
async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });
  const seq = String((count || 0) + 1).padStart(4, '0');
  return `ORD-${year}-${seq}`;
}

app.post('/api/orders', async (req, res) => {
  try {
    const {
      customer_name,
      customer_type,
      requested_by,
      frontdesk_user_id,
      items,
      notes
    } = req.body;

    if (!customer_name) {
      return res.status(400).json({ error: 'customer_name is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }
    if (!requested_by) {
      return res.status(400).json({ error: 'requested_by is required' });
    }

    const itemsWithPrice = [];
    for (const item of items) {
      const { data: part, error: partErr } = await supabase
        .from('parts')
        .select('id, quantity, selling_price, item_name')
        .eq('id', item.part_id)
        .single();

      if (partErr || !part) {
        console.error('Part not found:', item.part_id, partErr);
        return res.status(404).json({ error: `Part not found: ${item.part_id}` });
      }
      if (part.quantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${part.item_name}. Available: ${part.quantity}`
        });
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

    if (orderErr) {
      console.error('Order insert error:', orderErr);
      return res.status(500).json({
        error: 'Failed to create order',
        details: orderErr.message,
        hint: 'Check if orders table exists'
      });
    }

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
      console.error('Order items insert error:', itemsErr);
      await supabase.from('orders').delete().eq('id', order.id);
      return res.status(500).json({
        error: 'Failed to create order items',
        details: itemsErr.message,
        hint: 'Check if order_items table exists'
      });
    }

    res.status(201).json({
      success: true,
      message: `✅ Order ${orderNumber} sent to Cashier`,
      order: {
        ...order,
        items: createdItems
      }
    });

  } catch (error) {
    console.error('🔥 Order creation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.put('/api/orders/:id/fill-cashier', async (req, res) => {
  try {
    const { fs_number, cashier_user_id } = req.body;
    if (!fs_number) return res.status(400).json({ error: 'FS number is required' });

    const { data: order, error } = await supabase
      .from('orders')
      .update({
        fs_number,
        cashier_user_id,
        status: 'pending_manager'
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: '✅ Order sent to Manager', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/orders/:id/approve-manager', async (req, res) => {
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

app.put('/api/orders/:id/deny-manager', async (req, res) => {
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

app.put('/api/orders/:id/issue-storekeeper', async (req, res) => {
  try {
    const { id } = req.params;
    const { storekeeper_user_id } = req.body;

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          part_id,
          quantity,
          selling_price_at_time,
          parts:part_id (id, item_name, item_code, quantity)
        )
      `)
      .eq('id', id)
      .single();

    if (orderErr || !order) return res.status(404).json({ error: 'Order not found' });

    // Prevent double issuance
    if (order.status === 'completed' || order.status === 'paid') {
      return res.status(400).json({ error: 'This order has already been issued' });
    }
    if (order.status !== 'pending_storekeeper') {
      return res.status(400).json({ error: 'Order not ready for issuance' });
    }

    for (const item of order.order_items || []) {
      const partId = item.part_id;
      const qty = item.quantity;

      const { data: part, error: partErr } = await supabase
        .from('parts')
        .select('quantity')
        .eq('id', partId)
        .single();
      if (partErr) throw partErr;

      const newQty = part.quantity - qty;
      if (newQty < 0) {
        return res.status(400).json({
          error: `Insufficient stock for ${item.parts?.item_name || 'part'}`
        });
      }

      await supabase
        .from('parts')
        .update({ quantity: newQty })
        .eq('id', partId);

      await supabase.from('stock_movements').insert([{
        part_id: partId,
        quantity_change: -qty,
        reason: 'Sale',
        ordered_by_name: order.customer_name,
        approved_by_name: 'Store Keeper',
        created_at: new Date().toISOString()
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

    res.json({
      success: true,
      message: '✅ All items issued, stock updated',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Issue part order error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          parts:part_id (id, item_name, item_code, car_brand, car_model, selling_price)
        )
      `)
      .eq('status', status)
      .order('requested_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
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

app.get('/api/orders/all', async (req, res) => {
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

// =============================================
// MOVEMENTS HISTORY
// =============================================
app.get('/api/movements', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        parts:part_id (id, item_name, item_code, car_brand, car_model)
      `)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json({ success: true, movements: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// STATS
// =============================================
app.get('/api/stats', async (req, res) => {
  try {
    const { count: totalParts } = await supabase
      .from('parts')
      .select('*', { count: 'exact', head: true });

    const { data: qData } = await supabase
      .from('parts')
      .select('quantity');
    const totalQty = qData ? qData.reduce((s, p) => s + (p.quantity || 0), 0) : 0;

    const { data: newParts } = await supabase
      .from('parts')
      .select('quantity')
      .eq('condition', 'New');
    const totalNewQty = newParts ? newParts.reduce((s, p) => s + (p.quantity || 0), 0) : 0;

    const { data: usedParts } = await supabase
      .from('parts')
      .select('quantity')
      .eq('condition', 'Used');
    const totalUsedQty = usedParts ? usedParts.reduce((s, p) => s + (p.quantity || 0), 0) : 0;

    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_manager');

    const { count: completedOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { data: allParts } = await supabase
      .from('parts')
      .select('id, item_name, item_code, quantity, min_stock');
    const lowStock = allParts ? allParts.filter(p => p.quantity <= p.min_stock) : [];

    const { data: noPrice } = await supabase
      .from('parts')
      .select('id, item_name, item_code, purchase_price')
      .eq('is_selling_price_set', false)
      .limit(10);

    const { data: partsWithCat } = await supabase
      .from('parts')
      .select('categories:category_id (name)');
    const catMap = {};
    partsWithCat?.forEach(p => {
      const name = p.categories?.name || 'Uncategorized';
      catMap[name] = (catMap[name] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    const { data: partsWithCatQty } = await supabase
      .from('parts')
      .select('categories:category_id (name), quantity');
    const catQtyMap = {};
    partsWithCatQty?.forEach(p => {
      const name = p.categories?.name || 'Uncategorized';
      catQtyMap[name] = (catQtyMap[name] || 0) + (p.quantity || 0);
    });
    const categoryQuantityBreakdown = Object.entries(catQtyMap).map(([name, totalQuantity]) => ({ name, totalQuantity }));

    const stats = {
      total_parts: totalParts || 0,
      total_quantity: totalQty,
      total_new_quantity: totalNewQty,
      total_used_quantity: totalUsedQty,
      pending_manager_orders: pendingOrders || 0,
      low_stock_items: lowStock,
      low_stock_count: lowStock.length,
      no_selling_price_items: noPrice || [],
      category_breakdown: categoryBreakdown,
      category_quantity_breakdown: categoryQuantityBreakdown,
      total_orders: totalOrders || 0,
      completed_orders: completedOrders || 0
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

// =============================================
// WORK ORDERS API (Technician)
// =============================================
async function generateWorkOrderNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('work_orders')
    .select('*', { count: 'exact', head: true });
  const seq = String((count || 0) + 1).padStart(4, '0');
  return `WO-${year}-${seq}`;
}

// 1. Create work order (Front Desk) - NO inventory parts required
app.post('/api/work-orders', async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      part_received,
      customer_part_number,
      assigned_technician,
      diagnosis_notes,
      created_by
    } = req.body;

    if (!customer_name || !assigned_technician) {
      return res.status(400).json({ error: 'customer_name and assigned_technician are required' });
    }

    const workOrderNumber = await generateWorkOrderNumber();
    const sanitizedCreatedBy = created_by && created_by.trim() !== '' ? created_by : null;

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .insert([{
        work_order_number: workOrderNumber,
        customer_name,
        customer_phone,
        part_received,
        customer_part_number,
        technician_name: assigned_technician,
        assigned_technician: assigned_technician,
        diagnosis_notes,
        labor_charge: 0,
        total_parts_cost: 0,
        total_amount: 0,
        frontdesk_user_id: sanitizedCreatedBy,
        status: 'pending_manager',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({
      success: true,
      message: `✅ Work order ${workOrderNumber} sent to Manager for approval`,
      workOrder
    });
  } catch (error) {
    console.error('Work order creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Get work orders with parts – MAPPED FIELDS
app.get('/api/work-orders/with-parts', async (req, res) => {
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

    // Map raw columns to friendly names
    const mapped = data.map(wo => ({
      ...wo,
      work_price: wo.labor_charge || 0,
      part_price: wo.total_parts_cost || 0,
      total_price: wo.total_amount || 0,
    }));

    res.json({ success: true, workOrders: mapped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Get single work order with mapping
app.get('/api/work-orders/:id', async (req, res) => {
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
      part_price: data.total_parts_cost || 0,
      total_price: data.total_amount || 0,
    };

    res.json({ success: true, workOrder: mapped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update work order – with mapping and timestamps
app.put('/api/work-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;
    delete updates.created_at;
    delete updates.work_order_number;

    // Map friendly names to actual DB columns
    const mappedUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'work_price') mappedUpdates.labor_charge = value;
      else if (key === 'part_price') mappedUpdates.total_parts_cost = value;
      else if (key === 'total_price') mappedUpdates.total_amount = value;
      else mappedUpdates[key] = value;
    }

    // Auto timestamps for status changes
    if (mappedUpdates.status === 'pending_storekeeper') mappedUpdates.approved_at = new Date().toISOString();
    if (mappedUpdates.status === 'denied') mappedUpdates.denied_at = new Date().toISOString();
    if (mappedUpdates.status === 'completed') mappedUpdates.issued_at = new Date().toISOString();
    if (mappedUpdates.status === 'paid') mappedUpdates.paid_at = new Date().toISOString();

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

// 5. Add parts to work order (after diagnosis) – WITH selling_price_at_time
app.post('/api/work-orders/:id/parts', async (req, res) => {
  try {
    const { id } = req.params;
    const { parts } = req.body; // array of { part_id, quantity }

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'At least one part is required' });
    }

    const { data: order, error: orderCheck } = await supabase
      .from('work_orders')
      .select('status')
      .eq('id', id)
      .single();
    if (orderCheck || !order) return res.status(404).json({ error: 'Work order not found' });
    if (order.status === 'completed' || order.status === 'paid') {
      return res.status(400).json({ error: 'Cannot add parts to a completed/paid work order' });
    }

    // Fetch selling prices for each part
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
      selling_price_at_time: priceMap[p.part_id] || 0
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('work_order_parts')
      .insert(workOrderParts)
      .select();

    if (insertErr) throw insertErr;

    // Recalculate total_parts_cost
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

    await supabase
      .from('work_orders')
      .update({ total_parts_cost: totalPartsCost })
      .eq('id', id);

    // Fetch updated order with parts
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

// 6. Manager approves work order (kept for backward compatibility)
app.put('/api/work-orders/:id/approve-manager', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: 'pending_storekeeper',
        approved_at: new Date().toISOString()
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

// 7. Manager denies work order
app.put('/api/work-orders/:id/deny-manager', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        status: 'denied',
        denied_at: new Date().toISOString()
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

// 8. Store Keeper issues work order – safe with status check
app.put('/api/work-orders/:id/issue-storekeeper', async (req, res) => {
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

    // Prevent double issuance
    if (order.status === 'completed' || order.status === 'paid') {
      return res.status(400).json({ error: 'This order has already been issued' });
    }
    if (order.status !== 'pending_storekeeper') {
      return res.status(400).json({ error: 'Order is not ready for issuance' });
    }

    for (const wp of order.work_order_parts || []) {
      const partId = wp.part_id;
      const qty = wp.quantity;

      const { data: part, error: partErr } = await supabase
        .from('parts')
        .select('quantity')
        .eq('id', partId)
        .single();
      if (partErr) throw partErr;

      const newQty = part.quantity - qty;
      if (newQty < 0) {
        return res.status(400).json({ error: `Insufficient stock for ${wp.part?.item_name}` });
      }

      await supabase
        .from('parts')
        .update({ quantity: newQty })
        .eq('id', partId);

      await supabase.from('stock_movements').insert([{
        part_id: partId,
        quantity_change: -qty,
        reason: 'Work Order Sale',
        ordered_by_name: order.customer_name,
        approved_by_name: 'Store Keeper',
        created_at: new Date().toISOString()
      }]);
    }

    const { data: updated, error: updateErr } = await supabase
      .from('work_orders')
      .update({
        status: 'completed',
        storekeeper_user_id,
        issued_at: new Date().toISOString()
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

// 9. Cashier pays work order
app.put('/api/work-orders/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { fs_number } = req.body;
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        fs_number: fs_number || null,
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, message: 'Work order paid', workOrder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Get work orders by status
// Get work orders by status – WITH parts and mapped prices
app.get('/api/work-orders/status/:status', async (req, res) => {
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

    // Map columns and add selling_price to each part
    const mapped = data.map(wo => ({
      ...wo,
      work_price: wo.labor_charge || 0,
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

// 11. Work history (Manager)
app.get('/api/work-history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .in('status', ['paid', 'completed'])
      .order('paid_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json({ success: true, workHistory: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// MONTHLY SUMMARY
// =============================================
app.get('/api/monthly-summary', async (req, res) => {
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const { data: movements, error: movErr } = await supabase
      .from('stock_movements')
      .select('quantity_change')
      .eq('reason', 'Sale')
      .gte('created_at', firstDay)
      .lte('created_at', lastDay);
    if (movErr) throw movErr;
    const totalSold = movements ? movements.reduce((sum, m) => sum + Math.abs(m.quantity_change), 0) : 0;

    const { count: completedCount, error: compErr } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', firstDay)
      .lte('created_at', lastDay);
    if (compErr) throw compErr;

    const { data: paidOrders, error: paidErr } = await supabase
      .from('work_orders')
      .select('total_amount')
      .eq('status', 'paid')
      .gte('created_at', firstDay)
      .lte('created_at', lastDay);
    if (paidErr) throw paidErr;

    const totalRevenue = paidOrders ? paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) : 0;
    const paidCount = paidOrders ? paidOrders.length : 0;
    const avgRevenue = paidCount > 0 ? (totalRevenue / paidCount) : 0;

    res.json({
      success: true,
      summary: {
        items_sold: totalSold,
        work_orders_completed: completedCount || 0,
        work_orders_paid: paidCount,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        avg_revenue: Math.round(avgRevenue * 100) / 100
      }
    });
  } catch (error) {
    console.error('Monthly summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// UPDATE PART (Manager)
// =============================================
app.put('/api/parts/:id', async (req, res) => {
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

// =============================================
// DELETE PART (Manager)
// =============================================
app.delete('/api/parts/:id', async (req, res) => {
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

app.put('/api/work-orders/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { fs_number } = req.body;
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        fs_number: fs_number || null,
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, message: 'Work order paid', workOrder: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ROOT
// =============================================
app.get('/', (req, res) => res.send('🚗 Garage Inventory API running'));

// =============================================
// START
// =============================================
app.listen(PORT, () => {
  console.log(`🚀 Server on http://localhost:${PORT}`);
});