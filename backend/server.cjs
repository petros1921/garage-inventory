require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// =============================================
// ROUTES
// =============================================
app.use('/api', require('./routes/health'));
app.use('/api', require('./routes/parts'));
app.use('/api', require('./routes/orders'));
app.use('/api', require('./routes/workOrders'));
app.use('/api', require('./routes/purchaseOrders'));
app.use('/api', require('./routes/pettyCash'));
app.use('/api', require('./routes/credits'));
app.use('/api', require('./routes/stats'));
app.use('/api', require('./routes/movements'));
app.use('/api', require('./routes/itemsSold'));
app.use('/api', require('./routes/proformas'));
app.use('/api', require('./routes/oldWorkOrders'));
app.use('/api', require('./routes/financial'));
app.use('/api', require('./routes/uploads'));

// =============================================
// ROOT
// =============================================
app.get('/', (req, res) => res.send('🚗 Mekbeb Denamo API running'));

// =============================================
// START
// =============================================
app.listen(PORT, () => {
  console.log(`🚀 Server on http://localhost:${PORT}`);
});