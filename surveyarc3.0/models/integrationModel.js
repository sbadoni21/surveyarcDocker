// models/IntegrationModel.js
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

export class IntegrationModel {
  constructor(orgId) {
    this.orgId = orgId;
    // Modular SDK: use `collection(db, ...)`
    this.col = collection(db, 'organizations', orgId, 'integrations');
  }

  _ts() {
    return Timestamp.now();
  }

  defaultData({ intId, type, config }) {
    return {
      intId,
      type,
      config: config || {},
      enabled: true,
      installedBy: null,
      installedAt: this._ts(),
      updatedAt: this._ts()
    };
  }

  /** Create or overwrite an integration doc */
  async create({ intId, type, config }) {
    const ref = doc(this.col, intId);
    await setDoc(ref, this.defaultData({ intId, type, config }));
    return ref;
  }

  /** Get one integration */
  async get(intId) {
    const ref = doc(this.col, intId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  /** Update fields on an existing integration */
  async update(intId, data) {
    const ref = doc(this.col, intId);
    await updateDoc(ref, {
      ...data,
      updatedAt: this._ts()
    });
    return ref;
  }

  /** Delete an integration */
  async delete(intId) {
    const ref = doc(this.col, intId);
    await deleteDoc(ref);
  }
}
