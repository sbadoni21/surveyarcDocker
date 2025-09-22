import { QuestionProvider } from '@/providers/questionPProvider';
import { SurveyProvider } from '@/providers/surveyPProvider';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { doc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firebase';


/**
 * POST /api/questions
 * Request body: {
 *   orgId: string,
 *   surveyId: string,
 *   label: string,
 *   type: string,
 *   config?: object,
 *   logic?: array
 * }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { orgId, surveyId, label, type, config = {}, logic = [], projectId } = body;
    if (!orgId || !surveyId || !label || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const questionId = uuidv4();

    const question = {
      questionId,
      label,
      type,
      config,
      logic,
      projectId,
        surveyId,
        orgId,
      order: Date.now(),
    };

    await QuestionProvider.create(orgId, surveyId, question);
    const survey = await SurveyProvider.getSurvey(orgId, surveyId);
    const prevOrder = survey?.questionOrder || [];
    await SurveyProvider.updateSurvey(orgId,surveyId, {
      questionOrder: [...prevOrder, questionId],
    });

    return NextResponse.json({ message: 'Question created successfully', questionId }, { status: 201 });
  } catch (error) {
    console.error('[API: Create Question]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const surveyId = url.searchParams.get('surveyId');
    const orgId = url.searchParams.get('orgId');

    if (!surveyId) {
      return new Response(JSON.stringify({ error: 'Missing orgId' }), { status: 400 });
    }
    const projects = await QuestionProvider.getAll(orgId,surveyId);

    return new Response(JSON.stringify(projects), { status: 200 });

  } catch (e) {
    console.error('Error fetching projects:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}



export async function DELETE(request) {
  try {
    const body = await request.json();
    const { orgId, surveyId, questionId } = body;

    if (!orgId || !surveyId || !questionId) {
      return NextResponse.json({ error: 'Missing orgId, surveyId or questionId' }, { status: 400 });
    }
    const surveyRef = doc(db, 'organizations', orgId, 'surveys', surveyId);
    const surveySnap = await getDoc(surveyRef);

    if (!surveySnap.exists()) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }
    const surveyData = surveySnap.data();

    const questionRef = doc(db, 'organizations', orgId, 'surveys', surveyId, 'questions', questionId);
    await deleteDoc(questionRef);

    const updatedOrder = (surveyData.questionOrder || []).filter(qid => qid !== questionId);
    await updateDoc(surveyRef, { questionOrder: updatedOrder });

    return NextResponse.json({ message: 'Question deleted and questionOrder updated' });
  } catch (error) {
    console.error('[API: Delete Question]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { orgId, surveyId, questionId, updatedQuestion } = body;

    if (!orgId || !surveyId || !questionId || !updatedQuestion) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const surveyRef = doc(db, 'organizations', orgId, 'questions', surveyId);
    const surveySnap = await getDoc(surveyRef);

    if (!surveySnap.exists()) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    const data = surveySnap.data();
    const questions = data.questions || [];

    const updatedQuestions = questions.map((q) =>
      q.questionId === questionId ? updatedQuestion : q
    );

    await updateDoc(surveyRef, {
      questions: updatedQuestions,
    });

    return NextResponse.json({ message: 'Question updated successfully' });
  } catch (error) {
    console.error('[PUT Question]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

