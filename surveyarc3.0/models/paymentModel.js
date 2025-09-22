import { db } from "@/firebase/firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";

const paymentModel = {
  async create(paymentData) {
    const paymentId = paymentData.id || paymentData.paymentId;

    const docRef = doc(db, "payments", paymentId);
    await setDoc(docRef, {
      ...paymentData,
      createdAt: Timestamp.now(),
    });

    return docRef;
  },
};

export default paymentModel;
