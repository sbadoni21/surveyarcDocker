// ============================================
// FILE 1: utils/createSurveyFromTemplate.js
// ============================================

import QuestionModel from "@/models/questionModel";
import SurveyModel from "@/models/surveyModel";

/**
 * Create a survey from a template
 */
export async function createSurveyFromTemplate(
  template,
  orgId,
  projectId,
  createdBy,
  surveyModel,
  questionModel,
  surveyNameForTemplate,
) {
  try {

    // 1. Create the survey
    const surveyData = {
      orgId,
      projectId,
      name: surveyNameForTemplate,
      title: surveyNameForTemplate,
      description: template.description || '',
      status: 'test',
      time: new Date().toISOString(),
      createdBy,
      question_order: [],
      blocks: [
        {
          blockId: 'default_block',
          name: 'Main Block',
          questionOrder: [],
          randomization: { type: 'none', subsetCount: null }
        }
      ],
      blockOrder: ['default_block']
    };

    const createdSurvey = await SurveyModel.create(orgId,surveyData);
    console.log(createdSurvey)
    // 2. Create all questions
    const questionIds = [];
    const createdQuestions = [];

    for (const questionTemplate of template.questions) {
      const questionId = `Q${Math.floor(100000 + Math.random() * 900000)}`;
      
      const questionData = {
        questionId,
        projectId,
        type: questionTemplate.type,
        label: questionTemplate.label,
        required: questionTemplate.required ?? true,
        description: questionTemplate.description || '',
        config: questionTemplate.config || {},
        logic: questionTemplate.logic || [],
      };

      const createdQuestion = await QuestionModel.create(
        orgId,
        createdSurvey.survey_id,
        questionData
      );

      questionIds.push(questionId);
      createdQuestions.push(createdQuestion);
    }

    // 3. Update survey with question order
    const updatedSurveyData = {
      question_order: questionIds,
      blocks: [
        {
          blockId: 'default_block',
          name: 'Main Block',
          questionOrder: questionIds,
          randomization: { type: 'none', subsetCount: null }
        }
      ],
      blockOrder: ['default_block']
    };

    await SurveyModel.update?.(createdSurvey.survey_id, updatedSurveyData);

    return {
      survey_id : createdSurvey.survey_id,
      survey: { 
        ...createdSurvey, 
        ...updatedSurveyData
      },
      questions: createdQuestions,
    };
  } catch (error) {
    console.error('Error creating survey from template:', error);
    throw error;
  }
}
