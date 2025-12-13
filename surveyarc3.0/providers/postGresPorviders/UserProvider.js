// providers/postGresPorviders/UserProvider.jsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getCookie, deleteCookie } from "cookies-next";
import UserModel from "@/models/postGresModels/userModel"; // <-- Postgres UserModel

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ------------------ CORE LOADER ------------------
  const getUser = useCallback(
    async (uidToLoad) => {
      if (!uidToLoad) {
        setUser(null);
        setUid(null);
        setLoading(false);
        return null;
      }

      try {
        setLoading(true);
        const u = await UserModel.get(String(uidToLoad));
        setUser(u || null);
        setUid(u?.uid || null);
        setError(null);
        return u;
      } catch (err) {
        console.error("[UserProvider] getUser error:", err);
        setUser(null);
        setUid(null);
        setError(err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ------------------ BOOTSTRAP FROM COOKIE ------------------
  useEffect(() => {
    const cookieUid = getCookie("currentUserId");
    if (!cookieUid) {
      setLoading(false);
      return;
    }
    getUser(cookieUid);
  }, [getUser]);

  // ------------------ PUBLIC HELPERS (NAMES PRESERVED) ------------------

  const setCurrentUser = (userData) => {
    setUser(userData || null);
    setUid(userData?.uid || null);
  };

  const getUsersByOrg = async (orgId) => {
    // keep signature same as before; pass through to model
    return await UserModel.listByOrg(orgId);
  };

  const getActiveUsersByOrg = async (orgId) => {
    return await UserModel.listActiveByOrg(orgId);
  };

  const createUser = async (data) => {
    // same name, now uses Postgres model
    const created = await UserModel.create(data);
    return created;
  };

  const updateUser = async (userId, data) => {
    const updated = await UserModel.update(userId, data);

    // If updating current user, also update context
    if (user && user.uid === userId) {
      setUser((prev) => ({
        ...(prev || {}),
        ...updated,
        ...data,
      }));
    }

    return updated;
  };

  const deleteUser = async (userId) => {
    await UserModel.delete(userId);

    // If deleting self, clear context + cookies
    if (user?.uid === userId) {
      setUser(null);
      setUid(null);
      deleteCookie("currentUserId");
      deleteCookie("currentOrgId");
    }
  };

  const activate = async (userId) => {
    const res = await UserModel.activate(userId);
    if (user?.uid === userId) {
      setUser((prev) => ({
        ...(prev || {}),
        status: "active",
        ...res,
      }));
    }
    return res;
  };

  const suspend = async (userId) => {
    const res = await UserModel.suspend(userId);
    if (user?.uid === userId) {
      setUser((prev) => ({
        ...(prev || {}),
        status: "suspended",
        ...res,
      }));
    }
    return res;
  };

  // keep function name "trackLogin" but use Postgres /login endpoint
  const trackLogin = async (userId) => {
    const res = await UserModel.login(userId);
    // Optionally refresh user from backend after login
    await getUser(userId);
    return res;
  };

  // If you already call adminCreateUser somewhere, keep the name:
  const adminCreateUser = async (data) => {
    // at the moment same as createUser, but you can later point to /auth/admin-create
    return await UserModel.adminCreate(data);
  };
  const getUsersByIds = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) {
      return [];
    }
    
    try {
      const users = await UserModel.getUsersByIds(userIds);
      return users || [];
    } catch (err) {
      console.error("[UserProvider] getUsersByIds error:", err);
      return [];
    }
  }, []);
  const logout = () => {
    setUser(null);
    setUid(null);
    deleteCookie("currentUserId");
    deleteCookie("currentOrgId");
  };

  return (
    <UserContext.Provider
      value={{
        user,
        uid,
        loading,
        error,
        // function names preserved:
        setCurrentUser,
        getUser,
        getUsersByOrg,
        getActiveUsersByOrg,
        createUser,
        updateUser,getUsersByIds,
        deleteUser,
        activate,
        suspend,
        trackLogin,
        adminCreateUser,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
