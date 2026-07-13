import { Save, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { formatDate, formatLkr } from '../../utils/format';

const emptyWholesalerForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  status: 'active',
  rate_per_file_lkr: 450
};

export default function AdminWholesalers() {
  const [wholesalers, setWholesalers] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [createForm, setCreateForm] = useState(emptyWholesalerForm);
  const [editForm, setEditForm] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState('');

  const loadWholesalers = useCallback(async () => {
    const data = await apiRequest(`/admin/wholesalers${showDeleted ? '?view=archived' : ''}`);
    setWholesalers(data.wholesalers);
  }, [showDeleted]);

  useEffect(() => {
    setWholesalers(null);
    loadWholesalers().catch((err) => setMessage(err.message));
  }, [loadWholesalers]);
  useAutoRefresh(loadWholesalers);

  async function createWholesaler(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await apiRequest('/admin/wholesalers', {
        method: 'POST',
        body: JSON.stringify(createForm)
      });
      setCreateForm(emptyWholesalerForm);
      await loadWholesalers();
      setMessage('Wholesaler account created.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveWholesaler(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const payload = { ...editForm };
    if (!payload.password) delete payload.password;
    try {
      await apiRequest(`/admin/wholesalers/${editForm.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setEditForm(null);
      await loadWholesalers();
      setMessage('Wholesaler account updated.');
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
      await apiRequest(`/admin/wholesalers/${member.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      await loadWholesalers();
      setMessage(`Wholesaler account ${nextStatus}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function clearPayment(member) {
    const fileCount = Number(member.unpaid_completed_file_count || 0);
    if (!fileCount) return;
    const ok = window.confirm(`Clear payment count for ${fileCount} completed file(s) from ${member.name}?`);
    if (!ok) return;

    setBusy(true);
    setMessage('');
    try {
      await apiRequest(`/admin/wholesalers/${member.id}/clear-payment`, {
        method: 'POST',
        body: JSON.stringify({ note: `Cleared ${fileCount} completed file(s).` })
      });
      await loadWholesalers();
      setMessage('Wholesaler payment count cleared.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function clearWholesalerData(member) {
    const ok = window.confirm(
      `Clear all orders, billing batches, files, reports, and history for ${member.name}? The wholesaler login will stay.`
    );
    if (!ok) return;

    setBusyId(member.id);
    setMessage('');
    try {
      await apiRequest(`/admin/wholesalers/${member.id}/clear-data`, { method: 'POST' });
      await loadWholesalers();
      setMessage(`Wholesaler data cleared for ${member.name}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  }

  async function deleteWholesaler(member) {
    const ok = window.confirm(
      `Delete ${member.name}? Their login is deactivated and they disappear from this list. Order and billing history stay intact, and you can restore the account later.`
    );
    if (!ok) return;

    setBusyId(member.id);
    setMessage('');
    try {
      await apiRequest(`/admin/wholesalers/${member.id}/archive`, { method: 'POST' });
      await loadWholesalers();
      setMessage(`${member.name} deleted. Switch to "Show deleted" to restore.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  }

  async function restoreWholesalerAccount(member) {
    setBusyId(member.id);
    setMessage('');
    try {
      await apiRequest(`/admin/wholesalers/${member.id}/restore`, { method: 'POST' });
      await loadWholesalers();
      setMessage(`${member.name} restored. Reactivate the login when ready.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId('');
    }
  }

  const isError =
    message.includes('Could') ||
    message.includes('exists') ||
    message.includes('No completed') ||
    message.includes('not found');

  return (
    <>
      <PageHeader
        title="Wholesalers"
        eyebrow="postpaid clients"
        actions={
          <button className="ghost-button" type="button" onClick={() => setShowDeleted((value) => !value)}>
            {showDeleted ? 'Show active' : 'Show deleted'}
          </button>
        }
      />
      <FormMessage type={isError ? 'error' : 'success'}>{message}</FormMessage>

      <section className="split-grid">
        <form className="panel form-stack" onSubmit={createWholesaler}>
          <div className="panel-header"><h2>Create wholesaler login</h2></div>
          <label>Name<input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required /></label>
          <label>Email<input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required /></label>
          <label>Phone<input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} /></label>
          <label>Password<input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} minLength={8} required /></label>
          <label>Rate per file (LKR)<input type="number" min="0" value={createForm.rate_per_file_lkr} onChange={(e) => setCreateForm({ ...createForm, rate_per_file_lkr: e.target.value })} required /></label>
          <label>Status
            <select value={createForm.status} onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            <UserPlus size={18} aria-hidden="true" />
            Create wholesaler
          </button>
        </form>

        {editForm ? (
          <form className="panel form-stack" onSubmit={saveWholesaler}>
            <div className="panel-header"><h2>Edit wholesaler</h2></div>
            <label>Name<input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></label>
            <label>Email<input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required /></label>
            <label>Phone<input value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></label>
            <label>New password<input type="password" value={editForm.password || ''} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} minLength={8} /></label>
            <label>Rate per file (LKR)<input type="number" min="0" value={editForm.rate_per_file_lkr} onChange={(e) => setEditForm({ ...editForm, rate_per_file_lkr: e.target.value })} required /></label>
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
            <h2>How billing works</h2>
            <p>Wholesalers submit files without paying online. Completed unpaid files build a running count. After payment, clear the count here and the next batch starts from zero.</p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header"><h2>{showDeleted ? 'Deleted wholesaler accounts' : 'Wholesaler accounts'}</h2></div>
        {!wholesalers ? <div className="screen-loader">Loading wholesalers...</div> : null}
        {wholesalers?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Rate</th>
                  <th>Submitted</th>
                  <th>Completed</th>
                  <th>Unpaid</th>
                  <th>Amount due</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {wholesalers.map((member) => (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>{member.email}</td>
                    <td><StatusBadge value={member.status} /></td>
                    <td>{formatLkr(member.rate_per_file_lkr)}</td>
                    <td>{member.submitted_file_count}</td>
                    <td>{member.completed_file_count}</td>
                    <td>{member.unpaid_completed_file_count}</td>
                    <td>{formatLkr(member.unpaid_amount_lkr)}</td>
                    <td>{formatDate(member.created_at)}</td>
                    <td className="button-row compact">
                      {showDeleted ? (
                        <button
                          className="primary-button small"
                          disabled={busyId === member.id}
                          onClick={() => restoreWholesalerAccount(member)}
                          type="button"
                        >
                          {busyId === member.id ? 'Restoring...' : 'Restore'}
                        </button>
                      ) : (
                        <>
                          <button className="ghost-button" onClick={() => setEditForm({ ...member, password: '' })}>Edit</button>
                          <button className="secondary-button" onClick={() => toggleStatus(member)} disabled={busy}>
                            {member.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="primary-button small"
                            onClick={() => clearPayment(member)}
                            disabled={busy || !Number(member.unpaid_completed_file_count || 0)}
                          >
                            Clear paid
                          </button>
                          <button
                            className="ghost-button small-inline danger"
                            disabled={busyId === member.id || !Number(member.total_orders || 0)}
                            onClick={() => clearWholesalerData(member)}
                            type="button"
                          >
                            {busyId === member.id ? 'Clearing...' : 'Clear data'}
                          </button>
                          <button
                            className="ghost-button small-inline danger"
                            disabled={busyId === member.id}
                            onClick={() => deleteWholesaler(member)}
                            type="button"
                          >
                            {busyId === member.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {wholesalers && !wholesalers.length ? (
          <EmptyState title={showDeleted ? 'No deleted wholesaler accounts' : 'No wholesaler accounts'} />
        ) : null}
      </section>
    </>
  );
}
