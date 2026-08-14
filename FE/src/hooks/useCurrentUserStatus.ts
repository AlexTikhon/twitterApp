import { useMutation, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';

import { GetStatusDocument, UpdateStatusDocument } from '../generated/graphql';

export const useCurrentUserStatus = () => {
  const { data, error, loading } = useQuery(GetStatusDocument);
  const [updateStatus, updateState] = useMutation(UpdateStatusDocument);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (data) {
      setStatus(data.status.status);
    }
  }, [data]);

  const saveStatus = async () => {
    const result = await updateStatus({ variables: { status } });
    if (result.data) {
      setStatus(result.data.updateStatus.status);
    }
  };

  return {
    status,
    setStatus,
    saveStatus,
    loading: loading || updateState.loading,
    error
  };
};
