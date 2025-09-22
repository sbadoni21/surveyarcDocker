// models/AuditLogModel.js
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  getFirestore
} from "firebase/firestore";
import { firebaseApp } from "@/firebase/firebase"; // your initialized Firebase App

const db = getFirestore(firebaseApp);

export default class AuditLogModel {
  constructor(orgId) {
    this.orgId = orgId;
    this.auditLogsCol = collection(
      db,
      "organizations",
      orgId,
      "auditLogs"
    );
  }

  _ts() {
    return Timestamp.now();
  }

  defaultData({ logId, action, performedBy, target, details }) {
    return {
      logId,
      action,
      performedBy,
      timestamp: this._ts(),
      ipAddress: null,
      userAgent: null,
      target,
      details: details || {}
    };
  }

  /** Create a new audit log entry */
  async create({ logId, action, performedBy, target, details }) {
    const logRef = doc(this.auditLogsCol, logId);
    await setDoc(logRef, this.defaultData({ logId, action, performedBy, target, details }));
    return logRef;
  }

  /** Get a single audit log by ID */
  async get(logId) {
    const logRef = doc(this.auditLogsCol, logId);
    const snap = await getDoc(logRef);
    return snap.exists() ? snap.data() : null;
  }

  /** Update an existing audit log entry */
  async update(logId, data) {
    const logRef = doc(this.auditLogsCol, logId);
    await updateDoc(logRef, { ...data, timestamp: this._ts() });
    return logRef;
  }

  /** Delete an audit log entry */
  async delete(logId) {
    const logRef = doc(this.auditLogsCol, logId);
    await deleteDoc(logRef);
  }
}
