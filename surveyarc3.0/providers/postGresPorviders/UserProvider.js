// providers/postGresPorviders/UserProvider.js
'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import UserModel from '@/models/postGresModels/userModel';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [uid, setUid] = useState(null);   
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false); // Registration state

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

  const loginUser = async (targetUid) => {
    try {
      const loginResult = await UserModel.login(targetUid);
      return loginResult;
    } catch (err) {
      console.error('loginUser failed:', err);
      return null;
    }
  };

  const setCurrentUser = (userData) => {
    setUser(userData);
  };

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
      setIsRegistering(true); // Set registration flag
      
      const created = await UserModel.create(data);
      
      setUser(created);
      setIsRegistering(false); // Clear registration flag
      
      return created;
    } catch (e) {
      setIsRegistering(false); // Clear registration flag on error
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

  const logoutUser = async (targetUid) => {
    try {
      await UserModel.logout(targetUid);
    } catch (e) {
      console.error('logout failed:', e);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const pathname = window.location.pathname;
    const isRegistrationRoute = pathname.includes('/register') || pathname.includes('/postgres-register');

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      try {
        if (authUser) {
          setUid(authUser.uid);
          
          // Skip auto-fetch on registration routes
          if (!isRegistrationRoute) {
            const userData = await getUser(authUser.uid);
            
            if (userData) {
              await loginUser(authUser.uid);
            } else {
              console.log('User not found in backend, may need registration');
            }
          } else {
            console.log('On registration route - skipping auto-fetch');
          }
        } else {
          // ... rest of sign-out logic
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [uid]);
  return (
    <UserContext.Provider
      value={{
        user,
        uid,
        loading,
        isRegistering,
        setCurrentUser,
        getUser,
        loginUser,
        logoutUser,
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

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};