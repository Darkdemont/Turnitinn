import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormMessage from '../../components/FormMessage';
import { useAuth } from '../../context/AuthContext';
import { roleHome } from '../../utils/format';

const titleByRole = {
  customer: 'Customer Login',
  wholesaler: 'Wholesaler Login',
  staff: 'Staff Login',
  admin: 'Admin Login'
};

export default function Login({ expectedRole }) {
  const { login, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && (!expectedRole || user.role === expectedRole)) {
      navigate(roleHome(user.role), { replace: true });
    }
  }, [expectedRole, loading, navigate, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    try {
      const user = await login(form.email, form.password, expectedRole);
      const fallback = roleHome(user.role);
      navigate(location.state?.from?.pathname || fallback, { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (user && (!expectedRole || user.role === expectedRole))) {
    return <div className="screen-loader">Loading...</div>;
  }

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark">T</div>
          <div>
            <strong>Turnit</strong>
            <span>Report checking workflow</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">{expectedRole} portal</span>
          <h1>{titleByRole[expectedRole]}</h1>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </label>
          <FormMessage type="error">{message}</FormMessage>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>

        <div className="auth-links">
          {expectedRole === 'customer' ? <Link to="/register">Create customer account</Link> : null}
          {expectedRole === 'customer' ? (
            <span className="auth-forgot">
              Forgot password?{' '}
              <a href="https://wa.me/94000000000" target="_blank" rel="noreferrer">
                Contact support on WhatsApp
              </a>
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
