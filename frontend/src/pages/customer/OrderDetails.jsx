import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest, downloadProtectedFile } from '../../api/client';
import EmptyState from '../../components/EmptyState';
import FormMessage from '../../components/FormMessage';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { formatBytes, formatDate, formatLkr, serviceLabel } from '../../utils/format';

export default function CustomerOrderDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiRequest(`/customer/orders/${id}`)
      .then(setData)
      .catch((err) => setMessage(err.message));
  }, [id]);

  async function downloadReport(report) {
    setMessage('');
    try {
      await downloadProtectedFile(`/download/report-files/${report.id}`, report.original_file_name);
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (message && !data) return <EmptyState title="Could not load order" text={message} />;
  if (!data) return <div className="screen-loader">Loading order...</div>;

  const { order, files, reports } = data;

  return (
    <>
      <PageHeader title={order.order_number} eyebrow="order details" />
      <FormMessage type="error">{message}</FormMessage>

      <section className="detail-grid">
        <div className="panel">
          <div className="panel-header"><h2>Order</h2></div>
          <dl className="detail-list">
            <div><dt>Service</dt><dd>{serviceLabel(order.service_type)}</dd></div>
            <div><dt>Files</dt><dd>{order.file_count}</dd></div>
            <div><dt>Price per file</dt><dd>{formatLkr(order.price_per_file_lkr)}</dd></div>
            <div><dt>Total</dt><dd>{formatLkr(order.total_amount_lkr)}</dd></div>
            <div><dt>Payment</dt><dd><StatusBadge value={order.payment_status} /></dd></div>
            <div><dt>Status</dt><dd><StatusBadge value={order.order_status} /></dd></div>
            <div><dt>Staff</dt><dd>{order.staff_name || '-'}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(order.created_at)}</dd></div>
          </dl>
        </div>

        <div className="panel">
          <div className="panel-header"><h2>Reports</h2></div>
          {reports.length ? (
            <div className="file-list">
              {reports.map((report) => (
                <div className="file-row" key={report.id}>
                  <div>
                    <span>{report.original_file_name}</span>
                    <small>{formatBytes(report.file_size)} · {formatDate(report.uploaded_at)}</small>
                  </div>
                  <button className="ghost-button" onClick={() => downloadReport(report)}>
                    <Download size={18} aria-hidden="true" />
                    Download
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No final report yet" text="The report will appear here after staff upload." />
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Uploaded assignment files</h2></div>
        <div className="file-list">
          {files.map((file) => (
            <div className="file-row" key={file.id}>
              <span>{file.original_file_name}</span>
              <small>{formatBytes(file.file_size)} · {formatDate(file.uploaded_at)}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
