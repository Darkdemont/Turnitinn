import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import FormMessage from '../../components/FormMessage';
import { useAuth } from '../../context/AuthContext';
import { roleHome } from '../../utils/format';

const titleByRole = {
  customer: 'Customer Login',
  staff: 'Staff Login',
  admin: 'Admin Login'
};

export default function Login({ expectedRole }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        </div>
      </section>
    </div>
  );
}
