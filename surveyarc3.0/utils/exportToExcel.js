// utils/exportToExcel.js
import * as XLSX from 'xlsx';

/**
 * Export survey responses to Excel with complete question columns
 * Format: Response ID | Respondent ID | Q732493 | Q647510 | Q339200 | ...
 * Each row = one respondent, each column = one question ID
 */
export const exportSurveyToExcel = async (responses, questions, surveyName = 'Survey') => {
  try {
    const workbook = XLSX.utils.book_new();

    // Create question map for reference
    const questionMap = {};
    const questionIds = [];
    
    questions.forEach((q) => {
      const qId = q.question_id || q.questionId;
      questionIds.push(qId);
      questionMap[qId] = {
        label: q.label || qId,
        type: q.type,
        description: q.description || '',
        required: q.required
      };
    });

    // ==================== SHEET 1: RESPONSES ====================
    const responseRows = [];
    
    responses.forEach((response) => {
      // Start with metadata columns
      const row = {
        'Response ID': response.response_id || response.responseId || '',
        'Respondent ID': response.respondent_id || response.respondentId || '',
        'Status': response.status || 'completed',
        'Started At': formatDateTime(response.started_at || response.startedAt),
        'Completed At': formatDateTime(response.completed_at || response.completedAt),
      };

      // Initialize all question columns with empty values
      questionIds.forEach(qId => {
        row[qId] = '';
      });

      // Fill in the answers - check multiple possible locations
      const answersArray = response.answers || response.answers_blob || response.answersBlob || [];
      
      // Debug log to see what we're getting
      if (answersArray.length === 0) {
        console.warn('No answers found for response:', response.response_id || response.responseId);
      } else {
        console.log(`Processing ${answersArray.length} answers for response:`, response.response_id || response.responseId);
      }
      
      answersArray.forEach((answer) => {
        const questionId = answer.questionId;
        
        if (!questionId) {
          console.warn('Answer missing questionId:', answer);
          return;
        }
        
        // Convert array answers to comma-separated string
        let answerValue = '';
        if (Array.isArray(answer.answer)) {
          answerValue = answer.answer.join(', ');
        } else if (answer.answer !== null && answer.answer !== undefined) {
          answerValue = String(answer.answer);
        }

        // Set the answer value using question ID as column
        if (questionId) {
          row[questionId] = answerValue;
        }
      });

      responseRows.push(row);
    });

    const responsesSheet = XLSX.utils.json_to_sheet(responseRows);
    
    // Auto-size columns
    const responseCols = [
      { wch: 20 },  // Response ID
      { wch: 20 },  // Respondent ID
      { wch: 12 },  // Status
      { wch: 20 },  // Started At
      { wch: 20 },  // Completed At
      ...questionIds.map(() => ({ wch: 25 })) // Question columns
    ];
    responsesSheet['!cols'] = responseCols;
    
    XLSX.utils.book_append_sheet(workbook, responsesSheet, 'Responses');

    // ==================== SHEET 2: QUESTION REFERENCE ====================
    const questionRows = questions.map((question, index) => ({
      'No.': index + 1,
      'Question ID': question.question_id || question.questionId,
      'Label': question.label,
      'Type': question.type,
      'Description': question.description || '',
      'Required': question.required ? 'Yes' : 'No',
      'Options': question.config?.options 
        ? formatOptions(question.config.options) 
        : '',
    }));

    const questionsSheet = XLSX.utils.json_to_sheet(questionRows);
    questionsSheet['!cols'] = [
      { wch: 5 },   // No.
      { wch: 15 },  // Question ID
      { wch: 40 },  // Label
      { wch: 15 },  // Type
      { wch: 50 },  // Description
      { wch: 10 },  // Required
      { wch: 50 },  // Options
    ];
    
    XLSX.utils.book_append_sheet(workbook, questionsSheet, 'Question Reference');

    // ==================== SHEET 3: SUMMARY ====================
    const completedCount = responses.filter(r => r.status === 'completed').length;
    const startedCount = responses.filter(r => r.status === 'started').length;
    const completionRate = responses.length > 0 
      ? Math.round((completedCount / responses.length) * 100) 
      : 0;

    const summaryData = [
      { Field: 'Survey Name', Value: surveyName },
      { Field: 'Export Date', Value: new Date().toLocaleString() },
      { Field: '', Value: '' },
      { Field: 'Total Responses', Value: responses.length },
      { Field: 'Completed Responses', Value: completedCount },
      { Field: 'Started (Incomplete)', Value: startedCount },
      { Field: 'Completion Rate', Value: `${completionRate}%` },
      { Field: '', Value: '' },
      { Field: 'Total Questions', Value: questions.length },
      { Field: 'Required Questions', Value: questions.filter(q => q.required).length },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // ==================== SHEET 4: DATA DICTIONARY ====================
    const dictionaryData = [
      { Column: 'Response ID', Description: 'Unique identifier for each response' },
      { Column: 'Respondent ID', Description: 'Unique identifier for each respondent' },
      { Column: 'Status', Description: 'Response status (completed/started)' },
      { Column: 'Started At', Description: 'Timestamp when response was started' },
      { Column: 'Completed At', Description: 'Timestamp when response was completed' },
      { Column: '', Description: '' },
      ...questionIds.map(qId => ({
        Column: qId,
        Description: questionMap[qId].label
      }))
    ];

    const dictionarySheet = XLSX.utils.json_to_sheet(dictionaryData);
    dictionarySheet['!cols'] = [{ wch: 20 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, dictionarySheet, 'Data Dictionary');

    // ==================== EXPORT FILE ====================
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `${sanitizeFileName(surveyName)}_Export_${timestamp}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);

    return { 
      success: true, 
      fileName,
      responseCount: responses.length,
      questionCount: questions.length
    };
    
  } catch (error) {
    console.error('Export failed:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred'
    };
  }
};

// ==================== HELPER FUNCTIONS ====================

function formatDateTime(dateValue) {
  if (!dateValue) return '';
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue;
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    return String(dateValue);
  }
}

function formatOptions(options) {
  if (Array.isArray(options)) {
    return options.map((opt, i) => `${i + 1}. ${opt}`).join('; ');
  }
  if (typeof options === 'object') {
    return JSON.stringify(options);
  }
  return String(options);
}

function sanitizeFileName(name) {
  return name.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 50);
}

export default exportSurveyToExcel;