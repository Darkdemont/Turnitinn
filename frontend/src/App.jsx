import { Navigate, Route, Routes } from 'react-router-dom';
import { getSavedAuthRole } from './api/client';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminAccounting from './pages/admin/Accounting';
import AdminActivityLogs from './pages/admin/ActivityLogs';
import AdminCustomerDetail from './pages/admin/CustomerDetail';
import AdminCustomers from './pages/admin/Customers';
import AdminDashboard from './pages/admin/Dashboard';
import AdminOrderDetails from './pages/admin/OrderDetails';
import AdminOrders from './pages/admin/Orders';
import AdminRevenue from './pages/admin/Revenue';
import AdminStaff from './pages/admin/Staff';
import AdminStaffEarnings from './pages/admin/StaffEarnings';
import AdminStorage from './pages/admin/Storage';
import AdminWholesalers from './pages/admin/Wholesalers';
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerMyOrders from './pages/customer/MyOrders';
import CustomerNewOrder from './pages/customer/NewOrder';
import CustomerOrderDetails from './pages/customer/OrderDetails';
import PaymentCancel from './pages/customer/PaymentCancel';
import PaymentReturn from './pages/customer/PaymentReturn';
import CustomerProfile from './pages/customer/Profile';
import Home from './pages/Home';
import StaffAvailableOrders from './pages/staff/AvailableOrders';
import StaffDashboard from './pages/staff/Dashboard';
import StaffEarnings from './pages/staff/Earnings';
import StaffOrderDetails from './pages/staff/OrderDetails';
import StaffOrders from './pages/staff/StaffOrders';
import WholesalerDashboard from './pages/wholesaler/Dashboard';
import WholesalerMyOrders from './pages/wholesaler/MyOrders';
import WholesalerOrderDetails from './pages/wholesaler/OrderDetails';
import { roleHome } from './utils/format';

function LandingOrPortal() {
  const savedRole = getSavedAuthRole();
  if (savedRole) return <Navigate to={roleHome(savedRole)} replace />;
  return <Home />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingOrPortal />} />
      <Route path="/login" element={<Login expectedRole="customer" />} />
      <Route path="/wholesaler/login" element={<Login expectedRole="wholesaler" />} />
      <Route path="/staff/login" element={<Login expectedRole="staff" />} />
      <Route path="/admin/login" element={<Login expectedRole="admin" />} />
      <Route path="/register" element={<Register />} />

      <Route path="/customer/payment/return" element={<PaymentReturn />} />
      <Route path="/customer/payment/cancel" element={<PaymentCancel />} />

      <Route element={<ProtectedRoute role="customer" />}>
        <Route element={<Layout />}>
          <Route path="/customer/dashboard" element={<CustomerDashboard />} />
          <Route path="/customer/new-order" element={<CustomerNewOrder />} />
          <Route path="/customer/orders" element={<CustomerMyOrders />} />
          <Route path="/customer/orders/:id" element={<CustomerOrderDetails />} />
          <Route path="/customer/profile" element={<CustomerProfile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="wholesaler" />}>
        <Route element={<Layout />}>
          <Route path="/wholesaler/dashboard" element={<WholesalerDashboard />} />
          <Route path="/wholesaler/orders" element={<WholesalerMyOrders />} />
          <Route path="/wholesaler/orders/:id" element={<WholesalerOrderDetails />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="staff" />}>
        <Route element={<Layout />}>
          <Route path="/staff/dashboard" element={<StaffDashboard />} />
          <Route path="/staff/available-orders" element={<StaffAvailableOrders />} />
          <Route path="/staff/orders" element={<StaffOrders />} />
          <Route path="/staff/orders/:id" element={<StaffOrderDetails />} />
          <Route path="/staff/earnings" element={<StaffEarnings />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="admin" />}>
        <Route element={<Layout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/accounting" element={<AdminAccounting />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/orders/:id" element={<AdminOrderDetails />} />
          <Route path="/admin/customers" element={<AdminCustomers />} />
          <Route path="/admin/customers/:id" element={<AdminCustomerDetail />} />
          <Route path="/admin/staff" element={<AdminStaff />} />
          <Route path="/admin/wholesalers" element={<AdminWholesalers />} />
          <Route path="/admin/staff-earnings" element={<AdminStaffEarnings />} />
          <Route path="/admin/revenue" element={<AdminRevenue />} />
          <Route path="/admin/storage" element={<AdminStorage />} />
          <Route path="/admin/activity-logs" element={<AdminActivityLogs />} />
        </Route>
      </Route>

      <Route path="*" element={<LandingOrPortal />} />
    </Routes>
  );
}
