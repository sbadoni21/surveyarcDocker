// models/InvoiceModel.js
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

export class InvoiceModel {
  constructor(orgId) {
    this.orgId = orgId;
    this.col = collection(db, 'organizations', orgId, 'invoices');
  }

  _ts() {
    return Timestamp.now();
  }

  defaultData({ invoiceId, orderId, amount, currency, urlPdf }) {
    return {
      invoiceId,
      orderId,
      issuedAt: this._ts(),
      dueDate: this._ts(),  // replace with a computed Timestamp if needed
      amount,
      currency,
      urlPdf,
      status: 'draft',
      updatedAt: this._ts()
    };
  }

  /** Create or overwrite an invoice */
  async create({ invoiceId, orderId, amount, currency, urlPdf }) {
    const ref = doc(this.col, invoiceId);
    await setDoc(ref, this.defaultData({ invoiceId, orderId, amount, currency, urlPdf }));
    return ref;
  }

  /** Read a single invoice */
  async get(invoiceId) {
    const ref = doc(this.col, invoiceId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  /** Update fields on an existing invoice */
  async update(invoiceId, data) {
    const ref = doc(this.col, invoiceId);
    await updateDoc(ref, {
      ...data,
      updatedAt: this._ts()
    });
    return ref;
  }

  /** Delete an invoice */
  async delete(invoiceId) {
    const ref = doc(this.col, invoiceId);
    await deleteDoc(ref);
  }
}
