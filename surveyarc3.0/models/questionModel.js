import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { firebaseApp } from "@/firebase/firebase";

const db = getFirestore(firebaseApp);

class QuestionModel {
  ref(orgId, surveyId, questionId) {
    return doc(
      db,
      "organizations",
      orgId,

      "questions",
      questionId
    );
  }

  defaultData({ questionId, type, label, projectId, orgId, surveyId, config }) {
    const now = Timestamp.now();
    return {
      questionId,
      type,
      label,
      required: true,
      description: "",
      projectId,
      config: config || {},
      logic: [],
      orgId,
      surveyId,
      createdAt: now,
      updatedAt: now,
    };
  }

  async create(orgId, surveyId, data) {
    const questionRef = this.ref(orgId, surveyId, data.questionId);
    await setDoc(questionRef, this.defaultData(data));
    return questionRef;
  }

  async getAll(orgId, surveyId) {
    const surveyDocRef = doc(db, "organizations", orgId, "surveys", surveyId);
    const surveySnap = await getDoc(surveyDocRef);
    if (!surveySnap.exists()) return [];

    const surveyData = surveySnap.data();
    const questionOrder = surveyData.questionOrder || [];
    if (questionOrder.length === 0) return [];

    const questionsDocRef = doc(
      db,
      "organizations",
      orgId,
      "questions",
      surveyId
    );
    const questionsSnap = await getDoc(questionsDocRef);
    if (!questionsSnap.exists()) return [];

    const questionsArray = questionsSnap.data().questions || [];

    const questionsMap = {};
    for (const q of questionsArray) {
      questionsMap[q.questionId] = q;
    }

    const orderedQuestions = questionOrder
      .map((id) => questionsMap[id])
      .filter(Boolean);

    return orderedQuestions;
  }

  async update(orgId, surveyId, questionId, data) {
    const questionRef = this.ref(orgId, surveyId, questionId);
    await updateDoc(questionRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
    return questionRef;
  }

  async delete(orgId, surveyId, questionId) {
    const questionRef = this.ref(orgId, surveyId, questionId);

    const surveyRef = doc(db, "organizations", orgId, "surveys", surveyId);

    try {
      await deleteDoc(questionRef);

      await updateDoc(surveyRef, {
        questionOrder: arrayRemove(questionId),
        updatedAt: Timestamp.now(),
      });

      return questionRef;
    } catch (error) {
      console.error("Error deleting question and updating survey:", error);
      throw error;
    }
  }
}

export default new QuestionModel();
