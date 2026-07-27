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
    const questionPayloads = template.questions.map((questionTemplate, index) => {
      const serialLabel = questionTemplate.serial_label || `Q${index + 1}`;

      return {
        projectId,
        type: questionTemplate.type,
        label: questionTemplate.label,
        serial_label: serialLabel,
        required: questionTemplate.required ?? true,
        description: questionTemplate.description || '',
        config: questionTemplate.config || {},
        logic: questionTemplate.logic || [],
      };
    });

    const createdQuestions = await QuestionModel.createBulk(
      orgId,
      createdSurvey.survey_id,
      questionPayloads
    );
    const questionIds = createdQuestions.map((q) => q.questionId);

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
