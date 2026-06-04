import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormMessage from '../../components/FormMessage';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/customer/dashboard', { replace: true });
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
            <span>Customer registration</span>
          </div>
        </div>
        <div>
          <span className="eyebrow">customer portal</span>
          <h1>Create Account</h1>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              autoComplete="name"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
              required
            />
          </label>
          <label>
            WhatsApp number
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              autoComplete="tel"
              placeholder="+94..."
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <FormMessage type="error">{message}</FormMessage>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create account'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Already have an account?</Link>
        </div>
      </section>
    </div>
  );
}
