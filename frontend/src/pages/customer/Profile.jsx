import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import { formatDate, formatLkr } from '../../utils/format';

export default function CustomerProfile() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await apiRequest('/customer/profile');
    setData(res);
    setForm({ name: res.user.name || '', phone: res.user.phone || '' });
  }, []);

  useEffect(() => {
    loadProfile().catch((err) => setError(err.message));
  }, [loadProfile]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await apiRequest('/customer/profile', {
        method: 'POST',
        body: JSON.stringify(form),
        headers: { 'Content-Type': 'application/json' }
      });
      await loadProfile();
      setEditing(false);
      setMessage('Profile updated.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <EmptyState title="Could not load profile" text={error} />;
  if (!data) return <div className="screen-loader">Loading profile...</div>;

  const { user, stats } = data;

  return (
    <>
      <PageHeader title="My Profile" eyebrow="account" />
      <FormMessage type={message.includes('updated') ? 'success' : 'error'}>{message}</FormMessage>

      <div className="profile-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Account details</h2>
            {!editing ? (
              <button className="ghost-button small-inline" onClick={() => setEditing(true)} type="button">
                Edit
              </button>
            ) : null}
          </div>
          {editing ? (
            <form className="form-stack" onSubmit={saveProfile}>
              <label>
                Full name
                <input
                  type="text"
                  value={form.name}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label>
                WhatsApp / phone
                <input
                  type="text"
                  value={form.phone}
                  maxLength={40}
                  placeholder="e.g. +94771234567"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <div className="button-row">
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                <button className="ghost-button" type="button" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <dl className="detail-list">
              <div><dt>Name</dt><dd>{user.name}</dd></div>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Phone</dt><dd>{user.phone || <span style={{ color: 'var(--muted)' }}>Not set</span>}</dd></div>
              <div><dt>Member since</dt><dd>{formatDate(user.created_at)}</dd></div>
            </dl>
          )}
        </section>

        <section className="panel">
          <div className="panel-header"><h2>Account summary</h2></div>
          <dl className="detail-list">
            <div>
              <dt>Total orders</dt>
              <dd><strong>{stats.total_orders}</strong></dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd><strong style={{ color: 'var(--success)' }}>{stats.completed_orders}</strong></dd>
            </div>
            <div>
              <dt>Total spend</dt>
              <dd><strong>{formatLkr(stats.total_spend_lkr)}</strong></dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
