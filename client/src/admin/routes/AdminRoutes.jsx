import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";

import Dashboard from "../pages/Dashboard";
import Products from "../pages/Products";
import BestSellers from "../pages/BestSellers";
import Categories from "../pages/Categories";
import Inventory from "../pages/Inventory";
import Orders from "../pages/Orders";
import OrderDetails from "../pages/OrderDetails";
import Customers from "../pages/Customers";
import CustomerDetails from "../pages/CustomerDetails";
import Coupons from "../pages/Coupons";
import CMS from "../pages/CMS";
import Reviews from "../pages/Reviews";
import Payments from "../pages/Payments";
import Shipping from "../pages/Shipping";
import Analytics from "../pages/Analytics";
import Queries from "../pages/Queries";
import RegisterLogin from "../pages/RegisterLogin";
import AdminLogs from "../pages/AdminLogs";
import AdminUsers from "../pages/AdminUsers";
import Settings from "../pages/Settings";

const AdminRoutes = () => {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="best-sellers" element={<BestSellers />} />
        <Route path="categories" element={<Categories />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="orders" element={<Orders />} />
        <Route path="order-details" element={<OrderDetails />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customer-details" element={<CustomerDetails />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="payments" element={<Payments />} />
        <Route path="shipping" element={<Shipping />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="queries" element={<Queries />} />
        <Route path="register-login" element={<RegisterLogin />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="cms" element={<CMS />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default AdminRoutes;
