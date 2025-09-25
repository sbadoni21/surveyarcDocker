"use client";
import React, { createContext, useContext, useState } from "react";
import CollaboratorModel from "@/models/postGresModels/collaboratorModel";

const CollaboratorContext = createContext();

export const CollaboratorProvider = ({ children }) => {
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(false);

  const listCollaborators = async (ticketId) => {
    setLoading(true);
    try {
      const arr = await CollaboratorModel.list(ticketId);
      setCollaborators(Array.isArray(arr) ? arr : []);
      return arr;
    } finally {
      setLoading(false);
    }
  };

  const addCollaborator = async (ticketId, payload) => {
    const added = await CollaboratorModel.add(ticketId, payload);
    setCollaborators((prev) => {
      const exists = prev.find((c) => c.user_id === payload.userId);
      return exists ? prev.map((c) => (c.user_id === payload.userId ? added : c)) : [added, ...prev];
    });
    return added;
  };

  const removeCollaborator = async (ticketId, userId) => {
    await CollaboratorModel.remove(ticketId, userId);
    setCollaborators((prev) => prev.filter((c) => c.user_id !== userId));
  };

  return (
    <CollaboratorContext.Provider value={{ collaborators, loading, listCollaborators, addCollaborator, removeCollaborator }}>
      {children}
    </CollaboratorContext.Provider>
  );
};

export const useCollaborators = () => useContext(CollaboratorContext);
