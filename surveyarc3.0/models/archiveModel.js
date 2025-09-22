// models/ArchiveModel.js
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from "firebase/firestore";
import { firebaseApp } from "@/firebase/firebase"; // your initialized Firebase App

const db = getFirestore(firebaseApp);

export default class ArchiveModel {
  constructor(orgId) {
    this.orgId = orgId;
    this.archivesCol = collection(
      db,
      "organizations",
      orgId,
      "archives"
    );
  }

  _ts() {
    return Timestamp.now();
  }

  defaultData({ archiveId, type, url, format, recordCount, sizeBytes }) {
    return {
      archiveId,
      type,
      url,
      format,
      generatedAt: this._ts(),
      recordCount,
      sizeBytes
    };
  }

  /** Create or overwrite an archive document */
  async create({ archiveId, type, url, format, recordCount, sizeBytes }) {
    const archiveRef = doc(this.archivesCol, archiveId);
    await setDoc(archiveRef, this.defaultData({ archiveId, type, url, format, recordCount, sizeBytes }));
    return archiveRef;
  }

  /** Read a single archive */
  async get(archiveId) {
    const archiveRef = doc(this.archivesCol, archiveId);
    const snap = await getDoc(archiveRef);
    return snap.exists() ? snap.data() : null;
  }

  /** Update an existing archive */
  async update(archiveId, data) {
    const archiveRef = doc(this.archivesCol, archiveId);
    await updateDoc(archiveRef, {
      ...data,
      generatedAt: this._ts()
    });
    return archiveRef;
  }

  /** Delete an archive */
  async delete(archiveId) {
    const archiveRef = doc(this.archivesCol, archiveId);
    await deleteDoc(archiveRef);
  }
}
