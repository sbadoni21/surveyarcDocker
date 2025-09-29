"use client";
import { useEffect, useMemo, useState } from "react";
import UserModel from "@/models/postGresModels/userModel";
import {
  Avatar, Box, CircularProgress, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import SupportGroupModel from "@/models/postGresModels/supportGroupModel";

export default function AssigneeSelect({
  orgId,
  groupId,
  value,
  onChange,
  label = "Assignee",
  placeholder = "Select assignee",
  onlyAgents = false,
}) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [options, setOptions] = useState([]);
  const normalizedValue = value ? String(value) : "";


useEffect(() => {
  let mounted = true;
  (async () => {
    if (groupId) {
      const members = await SupportGroupModel.listMembers(groupId);
           const teamLeads = members.filter(u => 
        u.role === 'lead' || 
        u.permissions?.includes('lead') ||
        u.is_team_lead === true
      );
      const users = await Promise.all(
        (teamLeads || []).map(async (m) => {
          try { return await UserModel.get(m.user_id); } catch { return { uid: m.user_id, display_name: m.user_id }; }
        })
      );
 
      if (mounted) setOptions(users.map(u => ({
        uid: u.uid,
        displayName: u.display_name || u.displayName || u.email || u.uid,
      })));
      console.log(teamLeads)
    } else if (orgId) {
      const users = await UserModel.listActiveByOrg({ orgId });
      const teamLeads = users.filter(u => 
        u.role === 'lead' || 
        u.permissions?.includes('lead') ||
        u.is_team_lead === true
      );
      if (mounted) setOptions(teamLeads.map(u => ({
        uid: u.uid,
        displayName: u.display_name || u.displayName || u.email || u.uid,
      })));
    } else {
      if (mounted) setOptions([]);
    }
  })();
  return () => { mounted = false; };
}, [orgId, groupId]);
  const v = useMemo(() => value || "", [value]);

  return (
    <>    <TextField
      select
      fullWidth
      label={label}
      value={v}
      onChange={(e) => onChange?.(e.target.value || "")}
      placeholder={placeholder}
    >
      <MenuItem value="">{placeholder}</MenuItem>
      {options.map((u) => (
        <MenuItem key={u.uid} value={u.uid}>{u.displayName}</MenuItem>
      ))}
 

    </TextField></>
 
  );
}
