import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormMessage from '../../components/FormMessage';
import { useAuth } from '../../context/AuthContext';

const COUNTRY_CODES = [
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+1', flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    countryCode: '+94',
    phoneNumber: '',
    password: ''
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    const rawNumber = form.phoneNumber.replace(/^0+/, '').replace(/\s+/g, '');
    if (!rawNumber) {
      setMessage('Enter your WhatsApp number.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        phone: form.countryCode + rawNumber,
        password: form.password
      });
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
            Full name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="name"
              placeholder="Your full name"
              required
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            WhatsApp number
            <div className="phone-input-group">
              <select
                value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                aria-label="Country code"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                autoComplete="tel-national"
                placeholder="77 123 4567"
                required
              />
            </div>
            <span className="field-hint">We use this to send order updates via WhatsApp</span>
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              minLength={8}
              required
            />
          </label>
          <FormMessage type="error">{message}</FormMessage>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Already have an account? Sign in</Link>
        </div>
      </section>
    </div>
  );
}
