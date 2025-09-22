// models/InviteModel.js
import {
  Timestamp,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/firebase/firebase';

export class InviteModel {
  constructor(orgId) {
    this.orgId = orgId;
    // Modular SDK collection reference
    this.col = collection(db, 'organizations', orgId, 'invites');
  }

  _ts() {
    return Timestamp.now();
  }

  defaultData({ inviteId, email, role, invitedBy, expiresAt }) {
    return {
      inviteId,
      email,
      role,
      invitedBy,
      status: 'pending',
      sentAt: this._ts(),
      acceptedAt: null,
      expiresAt,     // should be a Firestore Timestamp or Date
      updatedAt: this._ts()
    };
  }

  /** Create a new invite */
  async create({ inviteId, email, role, invitedBy, expiresAt }) {
    const ref = doc(this.col, inviteId);
    const data = this.defaultData({ inviteId, email, role, invitedBy, expiresAt });
    await setDoc(ref, data);
    return ref;
  }

  /** Read one invite */
  async get(inviteId) {
    const ref = doc(this.col, inviteId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  /** Update an existing invite */
  async update(inviteId, updateData) {
    const ref = doc(this.col, inviteId);
    await updateDoc(ref, {
      ...updateData,
      updatedAt: this._ts()
    });
    return ref;
  }

  /** Delete an invite */
  async delete(inviteId) {
    const ref = doc(this.col, inviteId);
    await deleteDoc(ref);
  }
}
