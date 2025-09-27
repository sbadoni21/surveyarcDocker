"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import BizCalendarModel from "@/models/postGresModels/bizCalendarModel";
import SlaMakingModel from "@/models/postGresModels/slaMakingModel";

const SLAMakingContext = createContext(null);

export const SLAMakingProvider = ({ children }) => {
  const [slas, setSlas] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(false);

  const listSlas = useCallback(async ({ orgId, active } = {}) => {
    setLoading(true);
    try {
      const arr = await SlaMakingModel.list({ orgId, active });
      setSlas(Array.isArray(arr) ? arr : []);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const listCalendars = useCallback(async ({ orgId } = {}) => {
    setLoading(true);
    try {
      // Prefer the slas router helper if you haven't built /calendars router yet:
      const arr = await SlaMakingModel.listCalendars({ orgId });
      setCalendars(Array.isArray(arr) ? arr : []);
      return arr;
    } finally {
      setLoading(false);
    }
  }, []);

  const createSla = useCallback(async (payload) => {
    const created = await SlaMakingModel.create(payload);
    setSlas((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateSla = useCallback(async (slaId, patch) => {
    const updated = await SlaMakingModel.update(slaId, patch);
    setSlas((prev) => prev.map((s) => (s.sla_id === slaId ? updated : s)));
    return updated;
  }, []);

  const removeSla = useCallback(async (slaId) => {
    await SlaMakingModel.remove(slaId);
    setSlas((prev) => prev.filter((s) => s.sla_id !== slaId));
  }, []);

  // optional helpers if you wire calendar CRUD endpoints
  const createCalendar = useCallback(async (payload) => {
    const created = await BizCalendarModel.create(payload);
    setCalendars((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateCalendar = useCallback(async (calendarId, patch) => {
    const updated = await BizCalendarModel.update(calendarId, patch);
    setCalendars((prev) => prev.map((c) => (c.calendar_id === calendarId ? updated : c)));
    return updated;
  }, []);

  const removeCalendar = useCallback(async (calendarId) => {
    await BizCalendarModel.remove(calendarId);
    setCalendars((prev) => prev.filter((c) => c.calendar_id !== calendarId));
  }, []);

  const value = useMemo(
    () => ({
      slas,
      calendars,
      loading,
      listSlas,
      listCalendars,
      createSla,
      updateSla,
      removeSla,
      createCalendar,
      updateCalendar,
      removeCalendar,
    }),
    [
      slas, calendars, loading,
      listSlas, listCalendars,
      createSla, updateSla, removeSla,
      createCalendar, updateCalendar, removeCalendar
    ]
  );

  return <SLAMakingContext.Provider value={value}>{children}</SLAMakingContext.Provider>;
};

export const useMakingSLA = () => {
  const ctx = useContext(SLAMakingContext);
  if (!ctx) throw new Error("useSLA must be used within SLAMakingProvider");
  return ctx;
};
