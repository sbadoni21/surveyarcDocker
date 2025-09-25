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

  const remove = useCallback(async (ticketId) => {
    await TicketModel.remove(ticketId);
    setTickets((prev) => prev.filter((t) => t.ticketId !== ticketId));
    setSelectedTicket((prev) => (prev && prev.ticketId === ticketId ? null : prev));
  }, []);

  const count = useCallback(async (params) => {
    return TicketModel.count(params); // { count }
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
      setSelectedTicket,
      setTickets,
    }),
    [tickets, selectedTicket, loading, list, get, create, update, remove, count]
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
};

export const useTickets = () => {
  const ctx = useContext(TicketContext);
  if (!ctx) throw new Error("useTickets must be used within TicketProvider");
  return ctx;
};
