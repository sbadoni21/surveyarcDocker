'use client';
import organisationModel from '@/models/organisationModel';
import { getCookie } from 'cookies-next';
import React, { createContext, useContext, useState, useEffect } from 'react';

const OrganisationContext = createContext();

export const OrganisationProvider = ({ children }) => {
  const [organisation, setOrganisation] = useState(null);

  useEffect(() => {
    const fetchOrg = async () => {
  const orgId = getCookie('currentOrgId') || null;
      if (orgId) {
        const doc = await organisationModel.getById(orgId);
        if (doc) setOrganisation(doc);
      }
    };

    fetchOrg();
  }, []);

  const getById = async (orgId) => {
    const doc = await organisationModel.getById(orgId);
    return doc || null;
  };

  const setCurrentOrg = (org) => {
    setOrganisation(org);
  };

  const create = async (data) => {
    console.log(data)
    await organisationModel.create(data);
    const defaultDoc = organisationModel.defaultData(data);
    console.log(defaultDoc)
    
    setOrganisation(defaultDoc);
    return defaultDoc
  };

  const update = async (orgId, updateData) => {
    await organisationModel.update(orgId, updateData);
    const updatedDoc = await organisationModel.getById(orgId);
    setOrganisation(updatedDoc);
  };

  const softDelete = async (orgId) => {
    await organisationModel.softDelete(orgId);
    setOrganisation(null);
  };

  return (
    <OrganisationContext.Provider
      value={{
        organisation,
        setCurrentOrg,
        getById,
        create,
        update,
        softDelete
      }}
    >
      {children}
    </OrganisationContext.Provider>
  );
};

export const useOrganisation = () => useContext(OrganisationContext);
