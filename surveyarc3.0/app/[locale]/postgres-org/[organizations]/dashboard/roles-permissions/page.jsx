"use client"
import RBACManagement from '@/components/rbac/RBACManagement'
import { useOrganisation } from '@/providers/postGresPorviders/organisationProvider';
import React from 'react'

const page = () => {
    const {organisation} = useOrganisation();
  return (
    <div><RBACManagement orgId={organisation?.org_id} /></div>
  )
}

export default page