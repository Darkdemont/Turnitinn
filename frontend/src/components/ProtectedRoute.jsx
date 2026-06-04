import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../utils/format';

function loginPathForRole(role) {
  if (role === 'staff') return '/staff/login';
  if (role === 'admin') return '/admin/login';
  return '/login';
}

export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="screen-loader">Loading...</div>;
  }

  if (!user) {
    return <Navigate to={loginPathForRole(role)} state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <Outlet />;
}
