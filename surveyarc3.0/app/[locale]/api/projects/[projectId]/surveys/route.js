import { NextResponse } from 'next/server';
import SurveyModel from '@/models/surveyModel';
import { v4 as uuidv4 } from 'uuid';
import { SurveyProvider } from '@/providers/surveyPProvider';

export async function GET(request, { params }) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  const projectId = url.searchParams.get('projectId');

  if (!orgId || !projectId) {
    return NextResponse.json({ error: 'Missing orgId or projectId' }, { status: 400 });
  }

  try {
    const allSurveys = await SurveyProvider.getAllSurveys(orgId, projectId);
    return NextResponse.json({ surveys: allSurveys }, { status: 200 });
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { projectId } = params;
  const body = await request.json();
  const { name, time, createdBy, orgId } = body;

  if (!orgId || !projectId) {
    return NextResponse.json({ error: 'Missing orgId or projectId' }, { status: 400 });
  }

  if (!name || !time) {
    return NextResponse.json({ error: 'Missing name or time' }, { status: 400 });
  }

  const surveyId = uuidv4();

  const surveyData = SurveyModel.defaultData({
    surveyId,
    name,
    projectId,
    createdBy: createdBy || 'system',
    time,
    orgId,
  });

  try {
    await SurveyProvider.saveSurvey(surveyData);
    return NextResponse.json({ success: true, survey: surveyData }, { status: 201 });
  } catch (error) {
    console.error('Error adding survey:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const { orgId, projectId, surveyId } = params;
  if (!orgId || !projectId || !surveyId) {
    return NextResponse.json({ error: 'Missing orgId, projectId, or surveyId' }, { status: 400 });
  }

  try {
    await SurveyProvider.deleteSurvey(surveyId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error deleting survey:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
