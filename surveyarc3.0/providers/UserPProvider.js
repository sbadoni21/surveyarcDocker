'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import UserModel from '@/models/userModel';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [uid, setUid] = useState(null); 

  const getUser = async (uid) => {
    const doc = await UserModel.get(uid);
    setUser(doc || null);
    return doc;
  };

  const setCurrentUser = (userData) => {
    setUser(userData);
  };

  const getUsersByOrg = async (orgId) => {
    return await UserModel.listByOrg(orgId);
  };

  const getActiveUsersByOrg = async (orgId) => {
    return await UserModel.listActiveByOrg(orgId);
  };

  const createUser = async (data) => {
    await UserModel.create(data);
  };

  const updateUser = async (uid, data) => {
    await UserModel.update(uid, data);
  };

  const deleteUser = async (uid) => {
    await UserModel.delete(uid);
    if (user?.uid === uid) {
      setUser(null);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUid(authUser.uid);
        getUser(authUser.uid);
      } else {
        setUid(null);
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        uid,
        setCurrentUser,
        getUser,
        getUsersByOrg,
        getActiveUsersByOrg,
        createUser,
        updateUser,
        deleteUser
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
