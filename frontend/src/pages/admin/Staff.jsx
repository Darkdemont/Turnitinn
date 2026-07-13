import { Save, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { formatDate, formatUsd } from '../../utils/format';

const emptyStaffForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  status: 'active',
  rate_per_file_usd: 0.55
};

export default function AdminStaff() {
  const [staff, setStaff] = useState(null);
  const [createForm, setCreateForm] = useState(emptyStaffForm);
  const [editForm, setEditForm] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState('');

  const loadStaff = useCallback(async () => {
    const data = await apiRequest('/admin/staff');
    setStaff(data.staff);
  }, []);

  useEffect(() => {
    loadStaff().catch((err) => setMessage(err.message));
  }, [loadStaff]);
  useAutoRefresh(loadStaff);

  async function createStaff(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await apiRequest('/admin/staff', {
        method: 'POST',
        body: JSON.stringify(createForm)
      });
      setCreateForm(emptyStaffForm);
      await loadStaff();
      setMessage('Staff account created.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveStaff(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const payload = { ...editForm };
    if (!payload.password) delete payload.password;
    try {
      await apiRequest(`/admin/staff/${editForm.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setEditForm(null);
      await loadStaff();
      setMessage('Staff account updated.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(member) {
    setBusy(true);
    setMessage('');
    const nextStatus = member.status === 'active' ? 'inactive' : 'active';
    try {
      await apiRequest(`/admin/staff/${member.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      await loadStaff();
      setMessage(`Staff account ${nextStatus}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function clearStaffData(member) {
    const ok = window.confirm(
      `Clear staff work data for ${member.name}? Unstarted accepted orders return to the available queue, and this staff member's earnings/counts reset. Orders with reports already uploaded are left untouched for any owner (customer or wholesaler).`
    );
    if (!ok) return;

    setBusyId(member.id);
    setMessage('');
    try {
      const { result } = await apiRequest(`/admin/staff/${member.id}/clear-data`, { method: 'POST' });
      await loadStaff();
      const retainedNote = result.orders_with_reports_retained
        ? ` ${result.orders_with_reports_retained} order(s) with reports already uploaded were left untouched.`
        : '';
      setMessage(`Staff data cleared for ${member.name}.${retainedNote}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  }

  const isError =
    message.includes('Could') ||
    message.includes('exists') ||
    message.includes('not found');

  return (
    <>
      <PageHeader title="Staff" eyebrow="manage staff" />
      <FormMessage type={isError ? 'error' : 'success'}>
        {message}
      </FormMessage>

      <section className="split-grid">
        <form className="panel form-stack" onSubmit={createStaff}>
          <div className="panel-header"><h2>Create staff</h2></div>
          <label>Name<input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required /></label>
          <label>Email<input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required /></label>
          <label>Phone<input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} /></label>
          <label>Password<input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} minLength={8} required /></label>
          <label>Rate per file (USD)<input type="number" min="0" step="0.01" value={createForm.rate_per_file_usd} onChange={(e) => setCreateForm({ ...createForm, rate_per_file_usd: e.target.value })} required /></label>
          <label>Status
            <select value={createForm.status} onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            <UserPlus size={18} aria-hidden="true" />
            Create staff
          </button>
        </form>

        {editForm ? (
          <form className="panel form-stack" onSubmit={saveStaff}>
            <div className="panel-header"><h2>Edit staff</h2></div>
            <label>Name<input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></label>
            <label>Email<input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required /></label>
            <label>Phone<input value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></label>
            <label>New password<input type="password" value={editForm.password || ''} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} minLength={8} /></label>
            <label>Rate per file (USD)<input type="number" min="0" step="0.01" value={editForm.rate_per_file_usd ?? 0.55} onChange={(e) => setEditForm({ ...editForm, rate_per_file_usd: e.target.value })} required /></label>
            <label>Status
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={busy}>
                <Save size={18} aria-hidden="true" />
                Save changes
              </button>
              <button className="ghost-button" type="button" onClick={() => setEditForm(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="panel subtle-panel">
            <h2>Select a staff member</h2>
            <p>Edit profile details, pay rate, or active status from the table.</p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Staff accounts</h2></div>
        {!staff ? <div className="screen-loader">Loading staff...</div> : null}
        {staff?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Rate</th>
                  <th>Completed files</th>
                  <th>Earnings</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>{member.email}</td>
                    <td><StatusBadge value={member.status} /></td>
                    <td>{formatUsd(member.rate_per_file_usd ?? 0.55)}</td>
                    <td>{member.completed_file_count}</td>
                    <td>{formatUsd(member.total_earning_usd)}</td>
                    <td>{formatDate(member.created_at)}</td>
                    <td className="button-row compact">
                      <button className="ghost-button" onClick={() => setEditForm({ ...member, password: '' })}>Edit</button>
                      <button className="secondary-button" onClick={() => toggleStatus(member)} disabled={busy}>
                        {member.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="ghost-button small-inline danger"
                        disabled={busyId === member.id}
                        onClick={() => clearStaffData(member)}
                        type="button"
                      >
                        {busyId === member.id ? 'Clearing...' : 'Clear data'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {staff && !staff.length ? <EmptyState title="No staff accounts" /> : null}
      </section>
    </>
  );
}
