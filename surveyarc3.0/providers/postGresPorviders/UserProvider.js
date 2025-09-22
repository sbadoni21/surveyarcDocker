'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import UserModel from '@/models/postGresModels/userModel';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); // your app user doc (from backend)
  const [uid, setUid] = useState(null);   // firebase auth uid (session identity)
  const [loading, setLoading] = useState(true);

  const getUser = async (targetUid) => {
    try {
      const doc = await UserModel.get(targetUid);
      setUser(doc || null);
      return doc;
    } catch (err) {
      console.error('getUser failed:', err);
      setUser(null);
      return null;
    }
  };

  const setCurrentUser = (userData) => setUser(userData);

  const getUsersByOrg = async (orgId) => {
    try {
      return await UserModel.listByOrg(orgId);
    } catch (e) {
      console.error('listByOrg failed:', e);
      return [];
    }
  };

  const getActiveUsersByOrg = async (orgId) => {
    try {
      return await UserModel.listActiveByOrg(orgId);
    } catch (e) {
      console.error('listActiveByOrg failed:', e);
      return [];
    }
  };

  const createUser = async (data) => {
    try {
      console.log(data)
      const created = await UserModel.create(data);
    setUser(created);
      return created;
    } catch (e) {
      console.error('createUser failed:', e);
      throw e;
    }
  };

  const updateUser = async (targetUid, data) => {
    try {
      const updated = await UserModel.update(targetUid, data);
      if (user?.uid === targetUid) setUser(updated);
      return updated;
    } catch (e) {
      console.error('updateUser failed:', e);
      throw e;
    }
  };

  const deleteUser = async (targetUid) => {
    try {
      await UserModel.delete(targetUid);
      if (user?.uid === targetUid) setUser(null);
    } catch (e) {
      console.error('deleteUser failed:', e);
      throw e;
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      try {
        if (authUser) {
          setUid(authUser.uid);
          await getUser(authUser.uid); // hydrate app-level user from backend
        } else {
          setUid(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        uid,
        loading,
        setCurrentUser,
        getUser,
        getUsersByOrg,
        getActiveUsersByOrg,
        createUser,
        updateUser,
        deleteUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
