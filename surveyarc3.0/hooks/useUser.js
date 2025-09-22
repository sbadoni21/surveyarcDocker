'use client';

import { useEffect, useState } from 'react';
import userProvider from '@/providers/postGresPorviders/UserProvider';
import { onAuthStateChanged, getAuth } from 'firebase/auth';

export function useUser() {
  const [user, setUser] = useState(null);
  const [uid, setUid] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        setUid(authUser.uid); // ✅ Get current UID
      } else {
        setUid(null); // ✅ Handle logout
        setUser(null);
      }
    });

    return () => unsubscribeAuth(); // ✅ Clean up auth listener
  }, []);

  useEffect(() => {
    if (!uid) return;

    let isActive = true;

    async function fetchData() {
      const data = await userProvider.getUser(uid);
      if (isActive) setUser(data);
    }

    fetchData();

    const handleUpdate = (data) => {
      if (isActive) setUser(data);
    };

    userProvider.subscribe(uid, handleUpdate);

    return () => {
      isActive = false;
      userProvider.unsubscribe(uid, handleUpdate);
    };
  }, [uid]);

  return user;
}
