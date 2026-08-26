# 🚗 Garage Inventory Management System

A full‑featured garage inventory and work order management system designed for automotive workshops. It handles part inventory, customer work orders, technician assignments, manager approvals, and cashier payments – all in one place.

---

## 📖 Overview

This system replaces manual spreadsheets and paper logs with a modern web application tailored for garage operations. It supports:

- **Inventory management** – add, edit, restock, and set selling prices for parts.
- **External buyer orders** – quick part sales with cashier and manager approval.
- **Technician work orders** – full lifecycle from diagnosis to completion and payment.
- **Role-based access** – Front Desk, Technician, Store Keeper, Cashier, and Manager each have tailored views and permissions.
- **Audit trails** – every stock movement, price change, and order status is logged.

---

## ✨ Features

### 🔧 Inventory
- Add/Edit/Delete parts with categories, brands, models, and conditions.
- Auto‑generated item codes (e.g., `STR-001`).
- Set purchase and selling prices.
- Restock parts with a simple modal.
- Low stock alerts and out‑of‑stock indicators.

### 🛒 External Buyer Orders
- Front Desk searches parts and builds a cart.
- Order sent to Cashier → Manager → Store Keeper for issuance.
- Supports FS (receipt) numbers.

### 🛠️ Technician Work Orders
- Front Desk creates a work order (customer, part received, assigned technician).
- Technician adds diagnosis notes and selects inventory parts after diagnosis.
- Work order goes through:
  1. Manager approval
  2. Store Keeper issuance (stock deducted)
  3. Cashier payment (FS number added)
- Head Technician engagement flag.

### 📊 Manager Dashboard
- Overview stats: unique parts, total items, new/used quantities, pending orders.
- Charts: order status, category quantity breakdown.
- Quick actions: approve/deny orders, set selling prices.
- View work history and stock movements.

### 💰 Cashier Dashboard
- Part orders pending cashier (FS number assignment).
- Work orders pending payment (FS number assignment and payment completion).
- Detailed item views.

### 👥 Role‑Based Access
| Role          | Permissions |
|---------------|-------------|
| Front Desk    | Create part orders, create work orders, search inventory, send to cashier/manager. |
| Technician    | (No direct login – work is handled via Front Desk) |
| Store Keeper  | Issue parts and work orders, restock inventory. |
| Cashier       | Assign FS numbers, complete payments. |
| Manager       | Approve/deny orders, set prices, view all dashboards and history. |



## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite, Tailwind CSS, Recharts (charts), Lucide Icons
- **Backend**: Node.js + Express (CommonJS modules)
- **Database**: PostgreSQL via Supabase (Auth, Realtime, Storage)
- **Authentication**: Supabase Auth (email/password)
- **HTTP Client**: Axios
- **Deployment**: Optional – Vercel/Netlify for frontend, Supabase Cloud for backend.
