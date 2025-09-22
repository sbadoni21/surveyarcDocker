// models/DomainModel.js
import {
  Timestamp,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/firebase/firebase';

export class DomainModel {
  constructor(orgId) {
    this.orgId = orgId;
    this.col = collection(db, 'organizations', orgId, 'domains');
  }

  _ts() {
    return Timestamp.now();
  }

  defaultData({ domainId, domain }) {
    return {
      domainId,
      domain,
      sslStatus: 'pending',
      verificationToken: null,
      isPrimary: false,
      addedAt: this._ts(),
      updatedAt: this._ts(),
    };
  }

  create(data) {
    const ref = doc(this.col, data.domainId);
    return setDoc(ref, this.defaultData(data));
  }

  get(domainId) {
    const ref = doc(this.col, domainId);
    return getDoc(ref);
  }

  update(domainId, data) {
    const ref = doc(this.col, domainId);
    return updateDoc(ref, {
      ...data,
      updatedAt: this._ts(),
    });
  }

  delete(domainId) {
    const ref = doc(this.col, domainId);
    return deleteDoc(ref);
  }
}
