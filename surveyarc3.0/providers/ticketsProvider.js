// providers/TicketProvider.jsx
"use client";
import TicketModel from "@/models/ticketModel";
import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

const TicketContext = createContext(null);

export const TicketProvider = ({ children }) => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(false);

  const list = useCallback(async (params) => {
    setLoading(true);
    try {
      const arr = await TicketModel.list(params);
      setTickets(arr);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(async (ticketId) => {
    const t = await TicketModel.get(ticketId);
    setSelectedTicket(t);
    return t;
  }, []);

  const create = useCallback(async (data) => {
    const created = await TicketModel.create(data);
    setTickets((prev) => [created, ...prev]);
    return created;
  }, []);

  const update = useCallback(async (ticketId, patch) => {
    const updated = await TicketModel.update(ticketId, patch);
    setTickets((prev) => prev.map((t) => (t.ticketId === ticketId ? updated : t)));
    setSelectedTicket((prev) => (prev && prev.ticketId === ticketId ? updated : prev));
    return updated;
  }, []);
// ...inside TicketProvider component, after assignAgent/getParticipants:

const setFeature = useCallback(async (ticketId, featureId) => {
  const updated = await TicketModel.update(ticketId, { featureId });
  setTickets(prev => prev.map(t => (t.ticketId === ticketId ? updated : t)));
  setSelectedTicket(prev => (prev && prev.ticketId === ticketId ? updated : prev));
  return updated;
}, []);

const setImpactArea = useCallback(async (ticketId, impactId) => {
  const updated = await TicketModel.update(ticketId, { impactId });
  setTickets(prev => prev.map(t => (t.ticketId === ticketId ? updated : t)));
  setSelectedTicket(prev => (prev && prev.ticketId === ticketId ? updated : prev));
  return updated;
}, []);
const setFollowup = useCallback(async (ticketId, followup) => {
  const updated = await TicketModel.update(ticketId, { followup });
  setTickets(prev => prev.map(t => (t.ticketId === ticketId ? updated : t)));
  setSelectedTicket(prev => (prev && prev.ticketId === ticketId ? updated : prev));
  return updated;
}, []);
const setRootCause = useCallback(async (ticketId, { rcaId, rcaNote } = {}) => {
  const updated = await TicketModel.update(ticketId, { rcaId, rcaNote });
  setTickets(prev => prev.map(t => (t.ticketId === ticketId ? updated : t)));
  setSelectedTicket(prev => (prev && prev.ticketId === ticketId ? updated : prev));
  return updated;
}, []);

// Optional: direct queue listing passthrough
const listGroupQueue = useCallback(async (params) => {
  setLoading(true);
  try {
    const arr = await TicketModel.listGroupQueue(params);
    setTickets(arr);
    return arr;
  } finally {
    setLoading(false);
  }
}, []);

  const remove = useCallback(async (ticketId) => {
    await TicketModel.remove(ticketId);
    setTickets((prev) => prev.filter((t) => t.ticketId !== ticketId));
    setSelectedTicket((prev) => (prev && prev.ticketId === ticketId ? null : prev));
  }, []);

  const count = useCallback(async (params) => {
    return TicketModel.count(params); // { count }
  }, []);

  // ---------- Assignment actions (single team/agent) ----------

  const assignGroup = useCallback(async (ticketId, groupId) => {
    const updated = await TicketModel.assignGroup(ticketId, groupId);
    setTickets((prev) => prev.map((t) => (t.ticketId === ticketId ? updated : t)));
    setSelectedTicket((prev) => (prev && prev.ticketId === ticketId ? updated : prev));
    return updated;
  }, []);

  const assignTeam = useCallback(async (ticketId, teamId) => {
    const updated = await TicketModel.assignTeam(ticketId, teamId);
    setTickets((prev) => prev.map((t) => (t.ticketId === ticketId ? updated : t)));
    setSelectedTicket((prev) => (prev && prev.ticketId === ticketId ? updated : prev));
    return updated;
  }, []);

  const assignAgent = useCallback(async (ticketId, agentId) => {
    const updated = await TicketModel.assignAgent(ticketId, agentId);
    setTickets((prev) => prev.map((t) => (t.ticketId === ticketId ? updated : t)));
    setSelectedTicket((prev) => (prev && prev.ticketId === ticketId ? updated : prev));
    return updated;
  }, []);

  const getParticipants = useCallback(async (ticketId) => {
    return TicketModel.getParticipants(ticketId);
  }, []);

  const value = useMemo(
    () => ({
      tickets,
      selectedTicket,
      loading,
      list,
      get,
      create,
      update,
      remove,
      count,

      // Assignment methods
      assignGroup,
      assignTeam,
      assignAgent,
      getParticipants,

  // 🔵 New taxonomy helpers
  setFeature,
  setImpactArea,
  setRootCause,

  // Optional queue helper
  listGroupQueue,
      setFollowup,

      setSelectedTicket,
      setTickets,
    }),
    [
  tickets, selectedTicket, loading,      setFollowup,

  list, get, create, update, remove, count,
  assignGroup, assignTeam, assignAgent, getParticipants,
  setFeature, setImpactArea, setRootCause,
  listGroupQueue]
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
};

export const useTickets = () => {
  const ctx = useContext(TicketContext);
  if (!ctx) throw new Error("useTickets must be used within TicketProvider");
  return ctx;
};