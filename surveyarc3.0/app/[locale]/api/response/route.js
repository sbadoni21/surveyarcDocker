import { NextResponse } from "next/server";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";

export async function POST(req) {
  try {
    const body = await req.json();
    const { orgId, projectId, surveyId, answers, uid } = body;

    console.log(answers);

    if (!orgId || !projectId || !surveyId || !answers ) {
      return NextResponse.json(
        { message: "Missing required fields." },
        { status: 400 }
      );
    }
    const answerDocIds = [];

    await Promise.all(
      answers.map(async (answer) => {
        const answerRef = await addDoc(
          collection(
            db,
            "organizations",
            orgId,
            "surveys",
            surveyId,
            "answers"
          ),
          {
            answer: answer.answer,
            uid: uid,
            questionID: answer.questionID,
            type: answer.type,
            createdAt: serverTimestamp(),
          }
        );
        answerDocIds.push(answerRef.id);
      })
    );
    const responseRef = doc(
      collection(db, "organizations", orgId, "surveys", surveyId, "responses")
    );
    await setDoc(responseRef, {
      uid,
      answers: answerDocIds,
      submittedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: responseRef.id });
  } catch (error) {
    console.error("API /api/response error:", error);
    return NextResponse.json(
      { message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}
