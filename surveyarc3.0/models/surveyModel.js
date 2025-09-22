import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  where,
  collection,
  getDocs,
  query,
  increment,
} from "firebase/firestore";
import { firebaseApp } from "@/firebase/firebase";

const db = getFirestore(firebaseApp);

class SurveyModel {
  ref(orgId, surveyId) {
    return doc(db, "organizations", orgId, "surveys", surveyId);
  }

  orgRef(orgId) {
    return doc(db, "organizations", orgId);
  }

  defaultData({ surveyId, name, projectId, createdBy, time, orgId }) {
    const now = Timestamp.now();
    return {
      surveyId,
      orgId,
      name,
      projectId,
      slug: surveyId,
      version: 1,
      status: "draft",
      createdBy,
      time,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
      settings: {
        anonymous: false,
      },
      questionOrder: [],
      metadata: {},
    };
  }

  async create(orgId, data) {
    try {
      const surveysRef = collection(db, "organizations", orgId, "surveys");
      let surveyId;
      let surveyDocRef;
      let docExists = true;

      while (docExists) {
        surveyId = "survey_" + Math.random().toString(36).substr(2, 9);
        surveyDocRef = doc(surveysRef, surveyId);
        const docSnap = await getDoc(surveyDocRef);
        docExists = docSnap.exists();
      }

      const fullData = this.defaultData({
        ...data,
        surveyId,
      });

      await setDoc(surveyDocRef, fullData);

      await updateDoc(this.orgRef(orgId), {
        "subscription.currentUsage.surveys": increment(1),
      });

      return {
        surveyId,
        ...data,
      };
    } catch (error) {
      console.error("Error creating survey:", error);
      throw error;
    }
  }

  async get(orgId, surveyId) {
    const ref = this.ref(orgId, surveyId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  async getAllSurveys(orgId, projectId) {
    try {
      const collectionRef = collection(db, "organizations", orgId, "surveys");
      const q = query(collectionRef, where("projectId", "==", projectId));
      const snapshot = await getDocs(q);
      const surveys = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        surveys.push({
          ...data,
          id: docSnap.id,
        });
      });
      return surveys;
    } catch (error) {
      console.error("Error fetching surveys from Firestore:", error);
      throw error;
    }
  }

  async update(orgId, surveyId, data) {
    const ref = this.ref(orgId, surveyId);
    await updateDoc(ref, {
      ...data,
      updatedAt: Timestamp.now(),
    });
    return ref;
  }

  async delete(orgId, surveyId) {
    const ref = this.ref(orgId, surveyId);
    await deleteDoc(ref);

    await updateDoc(this.orgRef(orgId), {
      "subscription.currentUsage.surveys": increment(-1),
    });

    return ref;
  }
}

export default new SurveyModel();
