// models/ResponseModel.js
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from "firebase/firestore";
import { firebaseApp } from "@/firebase/firebase";

const db = getFirestore(firebaseApp);

class ResponseModel {
  /**
   * Returns the Firestore document reference for a response
   */
  ref(orgId, surveyId, responseId) {
    return doc(
      db,
      "organizations",
      orgId,
      "surveys",
      surveyId,
      "responses",
      responseId
    );
  }

  /**
   * Default data structure for a response
   */
  defaultData({ responseId, respondentId }) {
    const now = Timestamp.now();
    return {
      responseId,
      respondentId,
      status: "started",
      startedAt: now,
      completedAt: null,
      metadata: {},
    };
  }

  /**
   * Create a new response
   */
  async create(orgId, surveyId, { responseId, respondentId }) {
    const responseRef = this.ref(orgId, surveyId, responseId);
    await setDoc(responseRef, this.defaultData({ responseId, respondentId }));
    return responseRef;
  }

  /**
   * Get a specific response
   */
  async get(orgId, surveyId, responseId) {
    const responseRef = this.ref(orgId, surveyId, responseId);
    const snap = await getDoc(responseRef);
    return snap.exists() ? snap.data() : null;
  }

  /**
   * Update a response
   */
  async update(orgId, surveyId, responseId, data) {
    const responseRef = this.ref(orgId, surveyId, responseId);
    await updateDoc(responseRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
    return responseRef;
  }

  /**
   * Delete a response
   */
  async delete(orgId, surveyId, responseId) {
    const responseRef = this.ref(orgId, surveyId, responseId);
    await deleteDoc(responseRef);
    return responseRef;
  }
}

export default new ResponseModel();
