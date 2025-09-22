// models/userModel.js
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";

const MAX_ORGS = 3;

class UserModel {
  constructor() {
    this.col = collection(db, "users");
  }

  ref(uid) {
    return doc(db, "users", uid);
  }

  // ✅ No arrayUnion here; create with a plain array
  defaultData({ uid, email, displayName, role, initialOrgId }) {
    const now = Timestamp.now();
    return {
      uid,
      email,
      displayName,
      role,
      orgId: initialOrgId ? [String(initialOrgId)] : [], // <- plain array
      status: "active",
      joinedAt: now,
      lastLoginAt: now,
      updatedAt: now,
      metadata: {},
    };
  }

  async create({ uid, email, displayName, role = "member", initialOrgId }) {
    const ref = this.ref(uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, this.defaultData({ uid, email, displayName, role, initialOrgId }));
      return { created: true };
    }
    return { created: false };
  }

  async addOrg(uid, orgId) {
    const ref = this.ref(uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("User not found");

    const data = snap.data() || {};
    const current = Array.isArray(data.orgId) ? data.orgId.map(String) : [];
    const id = String(orgId);

    if (current.includes(id)) return { ok: true, message: "already-in" };
    if (current.length >= MAX_ORGS) return { ok: false, message: "limit" };

    await updateDoc(ref, {
      orgId: arrayUnion(id),       // ✅ arrayUnion only on update
      updatedAt: Timestamp.now(),
    });
    return { ok: true, message: "added" };
  }

  async get(uid) {
    const snap = await getDoc(this.ref(uid));
    return snap.exists() ? snap.data() : null;
  }

  async update(uid, data) {
    await updateDoc(this.ref(uid), { ...data, updatedAt: Timestamp.now() });
  }

  async delete(uid) {
    await deleteDoc(this.ref(uid));
  }

  async activate(uid) {
    return this.update(uid, { status: "active", joinedAt: Timestamp.now() });
  }

  async trackLogin(uid) {
    return this.update(uid, { lastLoginAt: Timestamp.now() });
  }

  async suspend(uid) {
    return this.update(uid, { status: "suspended" });
  }

  // ✅ Query by array-contains since we now use orgId[]
  async listByOrg(orgId) {
    const q = query(this.col, where("orgId", "array-contains", String(orgId)));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data());
  }

  async listActiveByOrg(orgId) {
    const q = query(
      this.col,
      where("orgId", "array-contains", String(orgId)),
      where("status", "==", "active"),
      orderBy("joinedAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data());
  }
}

export default new UserModel();
