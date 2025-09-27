// providers/slaProvider.jsx
"use client";
import SLAModel from "@/models/slaModel";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const SLAContext = createContext(null);

export const SLAProvider = ({ children }) => {
  const [slasByOrg, setSlasByOrg] = useState({});   // { [orgId]: SLA[] }
  const [calByOrg, setCalByOrg] = useState({});     // { [orgId]: calendars[] }
  const [ticketSLA, setTicketSLA] = useState({});   // { [ticketId]: TicketOut }

  const listSLAs = useCallback(async (orgId, { force } = {}) => {
    if (!force && slasByOrg[orgId]) return slasByOrg[orgId];
    const arr = await SLAModel.list(orgId);
    setSlasByOrg((m) => ({ ...m, [orgId]: arr }));
    return arr;
  }, [slasByOrg]);

  const refreshTicketSLA = useCallback(async (ticketId) => {
    const t = await SLAModel.getTicketWithSLA(ticketId);
    setTicketSLA((m) => ({ ...m, [ticketId]: t }));
    return t;
  }, []);

  const markFirstResponse = useCallback(async (ticketId, payload) => {
    await SLAModel.markFirstResponse(ticketId, payload);
    return refreshTicketSLA(ticketId);
  }, [refreshTicketSLA]);

  const pauseSLA = useCallback(async (ticketId, payload) => {
    await SLAModel.pause(ticketId, payload);
    return refreshTicketSLA(ticketId);
  }, [refreshTicketSLA]);

  const resumeSLA = useCallback(async (ticketId, payload) => {
    await SLAModel.resume(ticketId, payload);
    return refreshTicketSLA(ticketId);
  }, [refreshTicketSLA]);

  const listCalendars = useCallback(async (orgId, { force } = {}) => {
    if (!force && calByOrg[orgId]) return calByOrg[orgId];
    const arr = await SLAModel.listCalendars(orgId);
    setCalByOrg((m) => ({ ...m, [orgId]: arr }));
    return arr;
  }, [calByOrg]);

  const value = useMemo(
    () => ({
      slasByOrg,
      ticketSLA,
      listSLAs,
      markFirstResponse,
      pauseSLA,
      resumeSLA,
      refreshTicketSLA,
      listCalendars
    }),
    [slasByOrg, ticketSLA, listSLAs, markFirstResponse, pauseSLA, resumeSLA, refreshTicketSLA, listCalendars]
  );

  return <SLAContext.Provider value={value}>{children}</SLAContext.Provider>;
};

export const useSLA = () => {
  const ctx = useContext(SLAContext);
  if (!ctx) throw new Error("useSLA must be used within SLAProvider");
  return ctx;
};
