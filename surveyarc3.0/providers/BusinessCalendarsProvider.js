// providers/postGresPorviders/BusinessCalendarsProvider.jsx
"use client";
import { createContext, useContext, useState, useCallback } from "react";
import BizCalendarModel from "@/models/postGresModels/bizCalendarModel";

const BusinessCalendarsContext = createContext();

export const useBusinessCalendars = () => {
  const context = useContext(BusinessCalendarsContext);
  if (!context) {
    throw new Error("useBusinessCalendars must be used within a BusinessCalendarsProvider");
  }
  return context;
};

export default function BusinessCalendarsProvider({ children }) {
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendar, setSelectedCalendar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearError = () => setError(null);

  const list = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      clearError();
      const result = await BizCalendarModel.list(filters);
      setCalendars(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(async (calendarId) => {
    try {
      clearError();
      const result = await BizCalendarModel.get(calendarId);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const create = useCallback(async (payload) => {
    try {
      clearError();
      const result = await BizCalendarModel.create(payload);
      setCalendars(prev => [result, ...prev]);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const update = useCallback(async (calendarId, patch) => {
    try {
      clearError();
      const result = await BizCalendarModel.update(calendarId, patch);
      setCalendars(prev => prev.map(cal => cal.calendar_id === calendarId ? result : cal));
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const remove = useCallback(async (calendarId) => {
    try {
      clearError();
      await BizCalendarModel.remove(calendarId);
      setCalendars(prev => prev.filter(cal => cal.calendar_id !== calendarId));
      if (selectedCalendar?.calendar_id === calendarId) {
        setSelectedCalendar(null);
      }
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [selectedCalendar]);

  const setHours = useCallback(async (calendarId, hoursPayload) => {
    try {
      clearError();
      const result = await BizCalendarModel.setHours(calendarId, hoursPayload);
      if (selectedCalendar?.calendar_id === calendarId) {
        const updated = await get(calendarId);
        setSelectedCalendar(updated);
      }
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [selectedCalendar, get]);

  const setHolidays = useCallback(async (calendarId, holidaysPayload) => {
    try {
      clearError();
      const result = await BizCalendarModel.setHolidays(calendarId, holidaysPayload);
      // Refresh the selected calendar if it's the one we're updating
      if (selectedCalendar?.calendar_id === calendarId) {
        const updated = await get(calendarId);
        setSelectedCalendar(updated);
      }
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [selectedCalendar, get]);

  const count = useCallback(async (filters = {}) => {
    try {
      const result = await BizCalendarModel.list(filters);
      return { count: result.length };
    } catch (err) {
      return { count: 0 };
    }
  }, []);

  const value = {
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    loading,
    error,
    clearError,
    list,
    get,
    create,
    update,
    remove,
    setHours,
    setHolidays,
    count,
  };

  return (
    <BusinessCalendarsContext.Provider value={value}>
      {children}
    </BusinessCalendarsContext.Provider>
  );
}