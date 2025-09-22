// models/MetricModel.js
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

export class MetricModel {
  constructor(orgId) {
    this.orgId = orgId;
    // Modular SDK: point at organizations/{orgId}/metrics
    this.col = collection(db, 'organizations', orgId, 'metrics');
  }

  _ts() {
    return Timestamp.now();
  }

  defaultData({ metricId, name, interval, timestamp, values }) {
    return {
      metricId,
      name,
      interval,    // e.g. "hourly" | "daily"
      timestamp,   // should be a Firestore Timestamp
      values       // object of key:value pairs for metrics
    };
  }

  /** Create or overwrite a metric document */
  async create({ metricId, name, interval, timestamp, values }) {
    const ref = doc(this.col, metricId);
    await setDoc(ref, this.defaultData({ metricId, name, interval, timestamp, values }));
    return ref;
  }

  /** Read a single metric document */
  async get(metricId) {
    const ref = doc(this.col, metricId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  /** Update fields on an existing metric document */
  async update(metricId, data) {
    const ref = doc(this.col, metricId);
    // Ensure timestamp is current if not provided
    const updatePayload = {
      ...data,
      timestamp: data.timestamp || this._ts()
    };
    await updateDoc(ref, updatePayload);
    return ref;
  }

  /** Delete a metric document */
  async delete(metricId) {
    const ref = doc(this.col, metricId);
    await deleteDoc(ref);
  }
}
