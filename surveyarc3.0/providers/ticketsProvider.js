"use client";
import React, { createContext, useContext, useMemo, useState } from "react";
import ticketModel from "@/models/postGresModels/ticketModel";

const TicketContext = createContext();

export function TicketProvider({ children }) {
  const [tickets, setTickets] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadByOrg = async (orgId) => {
    setLoading(true);
    try {
      const list = await ticketModel.listByOrg(orgId);
      setTickets(list);
      return list;
    } finally {
      setLoading(false);
    }
  };

  const loadBySurvey = async (surveyId) => {
    setLoading(true);
    try {
      const list = await ticketModel.listBySurvey(surveyId);
      setTickets(list);
      return list;
    } finally {
      setLoading(false);
    }
  };

  const loadByQuestion = async (questionId) => {
    setLoading(true);
    try {
      const list = await ticketModel.listByQuestion(questionId);
      setTickets(list);
      return list;
    } finally {
      setLoading(false);
    }
  };

  const create = async (payload) => {
    const created = await ticketModel.create(payload);
    setTickets((prev) => [created, ...prev]);
    return created;
  };

  const get = async (ticketId) => {
    const t = await ticketModel.get(ticketId);
    setCurrent(t);
    return t;
  };

  const update = async (ticketId, patch) => {
    const updated = await ticketModel.update(ticketId, patch);
    setTickets((prev) => prev.map((t) => (t.ticket_id === ticketId ? updated : t)));
    if (current?.ticket_id === ticketId) setCurrent(updated);
    return updated;
  };

  const remove = async (ticketId) => {
    await ticketModel.remove(ticketId);
    setTickets((prev) => prev.filter((t) => t.ticket_id !== ticketId));
    if (current?.ticket_id === ticketId) setCurrent(null);
  };

  const addComment = async (ticketId, { uid, comment }) => {
    const updated = await ticketModel.addComment(ticketId, { uid, comment });
    setTickets((prev) => prev.map((t) => (t.ticket_id === ticketId ? updated : t)));
    if (current?.ticket_id === ticketId) setCurrent(updated);
    return updated;
  };

  const value = useMemo(
    () => ({
      tickets,
      current,
      loading,
      loadByOrg,
      loadBySurvey,
      loadByQuestion,
      create,
      get,
      update,
      remove,
      addComment,
      setCurrent,
      setTickets,
    }),
    [tickets, current, loading]
  );

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
}

export const useTickets = () => useContext(TicketContext);
