'use client';

import { useEffect, useState } from 'react';
import organisationProvider from '@/providers/organisationProvider';

export function useOrganisation(orgId) {
  const [org, setOrg] = useState(null);
  useEffect(() => {
    let isMounted = true;
      console.log("first")

    async function fetchData() {
      const data = await organisationProvider.getById(orgId);
      if (isMounted) setOrg(data);
    }

    fetchData();

    const handleUpdate = (data) => {
      if (isMounted) setOrg(data);
    };

    organisationProvider.subscribe(orgId, handleUpdate);

    return () => {
      isMounted = false;
      organisationProvider.unsubscribe(orgId, handleUpdate);
    };
  }, [orgId]);

  return org;
}
