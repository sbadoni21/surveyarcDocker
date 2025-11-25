// utils/exportToExcel.js
import * as XLSX from 'xlsx';

/**
 * Export survey responses to Excel with two sheets:
 * 1. Responses - All answers with question IDs
 * 2. Questions - Question reference data
 */
export const exportSurveyToExcel = async (responses, questions, surveyName = 'Survey') => {
  try {
    // Create workbook
    const workbook = XLSX.utils.book_new();

    // ==================== SHEET 1: RESPONSES ====================
    const responseRows = [];
    
    responses.forEach((response) => {
      const answersArray = response.answers_blob || response.answers || [];
      
      answersArray.forEach((answer) => {
        const answerValue = Array.isArray(answer.answer) 
          ? answer.answer.join(', ') 
          : answer.answer;

        responseRows.push({
          'Response ID': response.response_id || response.responseId,
          'Respondent ID': response.respondent_id || response.respondentId,
          'Question ID': answer.questionId,
          'Answer': answerValue,
          'Status': response.status,
          'Started At': response.started_at || response.startedAt,
          'Completed At': response.completed_at || response.completedAt,
        });
      });
    });

    const responsesSheet = XLSX.utils.json_to_sheet(responseRows);
    XLSX.utils.book_append_sheet(workbook, responsesSheet, 'Responses');

    // ==================== SHEET 2: QUESTIONS ====================
    const questionRows = questions.map((question) => ({
      'Question ID': question.question_id || question.questionId,
      'Label': question.label,
      'Type': question.type,
      'Description': question.description || '',
      'Required': question.required ? 'Yes' : 'No',
      'Options': question.config?.options 
        ? JSON.stringify(question.config.options) 
        : '',
    }));

    const questionsSheet = XLSX.utils.json_to_sheet(questionRows);
    XLSX.utils.book_append_sheet(workbook, questionsSheet, 'Questions');

    // ==================== EXPORT FILE ====================
    const fileName = `${surveyName}_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    return { success: true, fileName };
  } catch (error) {
    console.error('Export failed:', error);
    return { success: false, error: error.message };
  }
};
