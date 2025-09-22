import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  arrayUnion,
  Timestamp
} from "firebase/firestore";
import { db } from "@/firebase/firebase";

export default class AnswerModel {
  constructor(orgId) {
    this.orgId = orgId;
  }

  // Path to a specific answer document
  answerDoc(surveyId, responseId, answerId) {
    return doc(
      db,
      "organizations",
      this.orgId,
      "surveys",
      surveyId,
      "responses",
      responseId,
      "answers",
      answerId
    );
  }

  // Path to the response document
  responseDoc(surveyId, responseId) {
    return doc(
      db,
      "organizations",
      this.orgId,
      "surveys",
      surveyId,
      "responses",
      responseId
    );
  }

  // Path to the answers collection
  answersCol(surveyId, responseId) {
    return collection(
      db,
      "organizations",
      this.orgId,
      "surveys",
      surveyId,
      "responses",
      responseId,
      "answers"
    );
  }

  // Default structure of each answer document
  defaultData({ questionId, projectId, surveyId, orgId, answer }) {
    return {
      questionId,
      projectId,
      surveyId,
      orgId,
      answerConfig: answer || {},
      answeredAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  // 1. Create a new answer document
  // 2. Store its ID in the response doc under answerIds[]
  async create(surveyId, responseId, { questionId, projectId, answer }) {
    const data = this.defaultData({
      questionId,
      projectId,
      surveyId,
      orgId: this.orgId,
      answer,
    });

    // Add the answer with an auto-generated ID
    const newAnswerRef = await addDoc(this.answersCol(surveyId, responseId), data);

    // Update response doc to include this answer ID
    await updateDoc(this.responseDoc(surveyId, responseId), {
      answerIds: arrayUnion(newAnswerRef.id),
    });

    return newAnswerRef;
  }

  // Get a specific answer
  async get(surveyId, responseId, answerId) {
    const snap = await getDoc(this.answerDoc(surveyId, responseId, answerId));
    return snap.exists() ? snap : null;
  }

  // Update an answer
  async update(surveyId, responseId, answerId, updateData) {
    const ref = this.answerDoc(surveyId, responseId, answerId);
    await updateDoc(ref, {
      ...updateData,
      updatedAt: Timestamp.now(),
    });
    return ref;
  }

  // Delete an answer
  async delete(surveyId, responseId, answerId) {
    const ref = this.answerDoc(surveyId, responseId, answerId);
    await deleteDoc(ref);
    // Optional: remove from response.answerIds[]
  }
}
