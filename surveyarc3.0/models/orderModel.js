// models/OrderModel.js
import {
  Timestamp,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/firebase/firebase';  // your initialized Firestore instance

export class OrderModel {
  constructor(orgId) {
    this.orgId = orgId;
    // Modular SDK collection reference
    this.col = collection(db, 'organizations', orgId, 'orders');
  }

  _ts() {
    return Timestamp.now();
  }

  defaultData({
    orderId,
    userId,
    amount,
    currency,
    items
  }) {
    return {
      orderId,
      createdAt: this._ts(),
      updatedAt: this._ts(),
      userId,
      amount,
      currency,
      items,          // e.g. [{ productId, name, qty, unitPrice }]
      status: 'pending',         // "pending" | "paid" | "failed" | "refunded"
      paymentMethod: null,       // e.g. "razorpay", "stripe"
      transactionId: null,
      couponCode: null,
      discountAmount: 0,
      gstAmount: 0,
      subscriptionInfo: null     // optional { plan, startDate: Timestamp, endDate: Timestamp }
    };
  }

  /** Create or overwrite an order document */
  async create({
    orderId,
    userId,
    amount,
    currency,
    items
  }) {
    const ref = doc(this.col, orderId);
    await setDoc(
      ref,
      this.defaultData({ orderId, userId, amount, currency, items })
    );
    return ref;
  }

  /** Read a single order document */
  async get(orderId) {
    const ref = doc(this.col, orderId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  /** Update fields on an existing order document */
  async update(orderId, data) {
    const ref = doc(this.col, orderId);
    await updateDoc(ref, {
      ...data,
      updatedAt: this._ts()
    });
    return ref;
  }

  /** Delete an order document */
  async delete(orderId) {
    const ref = doc(this.col, orderId);
    await deleteDoc(ref);
  }
}
