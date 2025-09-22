// models/MarketplaceModel.js
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

export class MarketplaceModel {
  constructor(orgId) {
    this.orgId = orgId;
    // Modular SDK: point at organizations/{orgId}/marketplace
    this.col = collection(db, 'organizations', orgId, 'marketplace');
  }

  _ts() {
    return Timestamp.now();
  }

  defaultData({ appId, name }) {
    return {
      appId,
      name,
      description: null,
      installedAt: this._ts(),
      enabled: true,
      config: {},
      updatedAt: this._ts()
    };
  }

  /** Create or overwrite a marketplace entry */
  async create({ appId, name }) {
    const ref = doc(this.col, appId);
    await setDoc(ref, this.defaultData({ appId, name }));
    return ref;
  }

  /** Read a single marketplace entry */
  async get(appId) {
    const ref = doc(this.col, appId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  /** Update fields on an existing marketplace entry */
  async update(appId, data) {
    const ref = doc(this.col, appId);
    await updateDoc(ref, {
      ...data,
      updatedAt: this._ts()
    });
    return ref;
  }

  /** Delete a marketplace entry */
  async delete(appId) {
    const ref = doc(this.col, appId);
    await deleteDoc(ref);
  }
}
