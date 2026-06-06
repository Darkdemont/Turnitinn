import {
  Calculator,
  ClipboardList,
  DollarSign,
  FileCheck2,
  FileText,
  HardDrive,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Receipt,
  ScrollText,
  Users
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const navItems = {
  customer: [
    { label: 'Dashboard', path: '/customer/dashboard', icon: LayoutDashboard },
    { label: 'New Order', path: '/customer/new-order', icon: PlusCircle },
    { label: 'My Orders', path: '/customer/orders', icon: ClipboardList }
  ],
  wholesaler: [
    { label: 'Dashboard', path: '/wholesaler/dashboard', icon: LayoutDashboard },
    { label: 'My Orders', path: '/wholesaler/orders', icon: ClipboardList }
  ],
  staff: [
    { label: 'Dashboard', path: '/staff/dashboard', icon: LayoutDashboard },
    { label: 'Available', path: '/staff/available-orders', icon: FileText },
    { label: 'My Orders', path: '/staff/orders', icon: FileCheck2 },
    { label: 'Earnings', path: '/staff/earnings', icon: DollarSign }
  ],
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Accounts', path: '/admin/accounting', icon: Calculator },
    { label: 'Orders', path: '/admin/orders', icon: ClipboardList },
    { label: 'Customers', path: '/admin/customers', icon: Users },
    { label: 'Staff', path: '/admin/staff', icon: FileCheck2 },
    { label: 'Wholesalers', path: '/admin/wholesalers', icon: Users },
    { label: 'Earnings', path: '/admin/staff-earnings', icon: DollarSign },
    { label: 'Revenue', path: '/admin/revenue', icon: Receipt },
    { label: 'Storage', path: '/admin/storage', icon: HardDrive },
    { label: 'Logs', path: '/admin/activity-logs', icon: ScrollText }
  ]
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems[user?.role] || [];

  function handleLogout() {
    logout();
    navigate(
      user?.role === 'admin'
        ? '/admin/login'
        : user?.role === 'staff'
          ? '/staff/login'
          : user?.role === 'wholesaler'
            ? '/wholesaler/login'
            : '/login'
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <div>
            <strong>Turnit</strong>
            <span>Phase 1</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className="nav-link">
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <strong>{user?.name}</strong>
            <span>{user?.role}</span>
          </div>
          <button className="ghost-button full-width" onClick={handleLogout}>
            <LogOut size={18} aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-actions">
            {user?.role === 'customer' || user?.role === 'staff' || user?.role === 'wholesaler' ? (
              <NotificationBell role={user.role} />
            ) : null}
            <div>
              <span className="muted-label">Signed in as</span>
              <strong>{user?.email}</strong>
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
