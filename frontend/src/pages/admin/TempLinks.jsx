import { Copy, Link2, PlusCircle, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { formatDate, serviceLabel } from '../../utils/format';

const BASE_URL = window.location.origin;

function copyToClipboard(text, setCopied) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}

function LinkRow({ link, onRevoke }) {
  const [copied, setCopied] = useState(false);
  const url = `${BASE_URL}/g/${link.token}`;
  const canRevoke = ['pending', 'uploaded'].includes(link.status);

  return (
    <tr>
      <td>
        <span className="temp-link-note">{link.note || <em className="muted-label">—</em>}</span>
      </td>
      <td>{serviceLabel(link.service_type)}</td>
      <td style={{ textAlign: 'center' }}>{link.file_slots}</td>
      <td><StatusBadge value={link.status} /></td>
      <td>{link.order_number ? <span className="text-mono">{link.order_number}</span> : '—'}</td>
      <td>{formatDate(link.created_at)}</td>
      <td>{formatDate(link.expires_at)}</td>
      <td className="button-row compact">
        <button
          className="ghost-button small-inline"
          onClick={() => copyToClipboard(url, setCopied)}
          type="button"
          title={url}
        >
          <Copy size={14} />
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        {canRevoke && (
          <button
            className="ghost-button small-inline danger"
            onClick={() => onRevoke(link.token)}
            type="button"
          >
            <XCircle size={14} />
            Revoke
          </button>
        )}
      </td>
    </tr>
  );
}

export default function AdminTempLinks() {
  const [links, setLinks] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ service_type: 'ai_similarity', file_slots: '1', note: '' });
  const [newLink, setNewLink] = useState(null);
  const [newCopied, setNewCopied] = useState(false);

  const loadLinks = useCallback(async () => {
    const data = await apiRequest('/admin/temp-links');
    setLinks(data.links);
  }, []);

  useEffect(() => {
    loadLinks().catch((err) => setError(err.message));
  }, [loadLinks]);
  useAutoRefresh(loadLinks);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setMessage('');
    setNewLink(null);
    try {
      const data = await apiRequest('/admin/temp-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type: form.service_type,
          file_slots: Number(form.file_slots),
          note: form.note.trim() || undefined
        })
      });
      setNewLink(data.link);
      setForm({ service_type: 'ai_similarity', file_slots: '1', note: '' });
      await loadLinks();
    } catch (err) {
      setMessage(err.message);
      setMessageType('error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(token) {
    if (!window.confirm('Revoke this link? The customer will no longer be able to use it.')) return;
    try {
      await apiRequest(`/admin/temp-links/${token}/revoke`, { method: 'POST' });
      setMessage('Link revoked.');
      setMessageType('success');
      await loadLinks();
    } catch (err) {
      setMessage(err.message);
      setMessageType('error');
    }
  }

  return (
    <>
      <PageHeader title="WhatsApp Temp Links" eyebrow="customers" />
      <FormMessage type={messageType}>{message}</FormMessage>

      <section className="panel">
        <div className="panel-header">
          <h2>Create new link</h2>
        </div>
        <form className="temp-link-create-form" onSubmit={handleCreate}>
          <label>
            Service type
            <select value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}>
              <option value="ai_similarity">Similarity + AI detection</option>
              <option value="similarity_only">Similarity only</option>
            </select>
          </label>
          <label>
            File slots
            <select value={form.file_slots} onChange={(e) => setForm({ ...form, file_slots: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n} file{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </label>
          <label>
            Customer note (optional)
            <input
              type="text"
              maxLength={200}
              placeholder="e.g. Kasun via WhatsApp"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <button className="primary-button" type="submit" disabled={creating}>
            <PlusCircle size={16} />
            {creating ? 'Creating...' : 'Create link'}
          </button>
        </form>

        {newLink && (
          <div className="temp-link-result">
            <Link2 size={16} className="customer-link-icon" />
            <span className="temp-link-result-url">{BASE_URL}/g/{newLink.token}</span>
            <button
              className="ghost-button small-inline"
              onClick={() => copyToClipboard(`${BASE_URL}/g/${newLink.token}`, setNewCopied)}
              type="button"
            >
              <Copy size={14} />
              {newCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header"><h2>All links</h2></div>
        {error ? <EmptyState title="Could not load links" text={error} /> : null}
        {!links && !error ? <div className="screen-loader">Loading...</div> : null}
        {links?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Service</th>
                  <th>Files</th>
                  <th>Status</th>
                  <th>Order</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <LinkRow key={link.id} link={link} onRevoke={handleRevoke} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {links && !links.length ? <EmptyState title="No temp links yet" text="Create a link above and send it to a customer via WhatsApp." /> : null}
      </section>
    </>
  );
}
