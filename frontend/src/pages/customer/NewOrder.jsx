import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import OrderUploadForm from '../../components/OrderUploadForm';
import PageHeader from '../../components/PageHeader';

export default function CustomerNewOrder() {
  const [packages, setPackages] = useState([]);

  const loadPackages = useCallback(async () => {
    const data = await apiRequest('/customer/dashboard');
    setPackages(data.packages || []);
  }, []);

  useEffect(() => {
    loadPackages().catch(() => setPackages([]));
  }, [loadPackages]);

  return (
    <>
      <PageHeader title="Upload Files" eyebrow="AI + Similarity report" />
      <OrderUploadForm availablePackages={packages} onSubmitted={loadPackages} />
    </>
  );
}
