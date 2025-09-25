"use client";
import React, { createContext, useContext, useState } from "react";
import WorklogModel from "@/models/postGresModels/worklogModel";

const WorklogContext = createContext();

export const WorklogProvider = ({ children }) => {
  const [worklogs, setWorklogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const listWorklogs = async (ticketId) => {
    setLoading(true);
    try {
      const arr = await WorklogModel.list(ticketId);
      setWorklogs(Array.isArray(arr) ? arr : []);
      return arr;
    } finally {
      setLoading(false);
    }
  };

  const createWorklog = async (ticketId, payload) => {
    const created = await WorklogModel.create(ticketId, payload);
    setWorklogs((prev) => [created, ...prev]);
    return created;
  };

  return (
    <WorklogContext.Provider value={{ worklogs, loading, listWorklogs, createWorklog }}>
      {children}
    </WorklogContext.Provider>
  );
};

export const useWorklogs = () => useContext(WorklogContext);
