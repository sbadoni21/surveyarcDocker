import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/firebase';

export class WebhookModel {
  constructor(orgId) {
    this.orgId = orgId;
    this.col = collection(db, 'organizations', this.orgId, 'webhooks'); // fixed typo 'weebhooks' => 'webhooks'
  }

  // Returns default webhook data with Firestore server timestamps
  defaultData({ hookId, name, url, events }) {
    const now = serverTimestamp();
    return {
      hookId,
      name,
      url,
      secret: null,
      events,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
  }

  // Create a new webhook document
  async create(data) {
    const docRef = doc(this.col, data.hookId);
    await setDoc(docRef, this.defaultData(data));
  }

  // Get webhook document data by ID
  async get(hookId) {
    const docRef = doc(this.col, hookId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data();
  }

  // Update webhook document data
  async update(hookId, data) {
    const docRef = doc(this.col, hookId);
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
  }

  // Delete webhook document
  async delete(hookId) {
    const docRef = doc(this.col, hookId);
    await deleteDoc(docRef);
  }
}
