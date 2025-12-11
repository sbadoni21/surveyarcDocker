// utils/exportToSPSS.js

/**
 * Export survey data to SPSS format
 * Creates a CSV file and SPSS syntax file for importing into SPSS
 */
export const exportSurveyToSPSS = async (responses, questions, surveyName = 'Survey') => {
  try {
    // Create question map
    const questionMap = {};
    const questionIds = [];
    
    questions.forEach((q) => {
      const qId = q.question_id || q.questionId;
      questionIds.push(qId);
      questionMap[qId] = {
        label: q.label || qId,
        type: q.type,
        description: q.description || '',
        required: q.required,
        config: q.config || {}
      };
    });

    // ==================== CREATE CSV DATA ====================
    const csvRows = [];
    
    // Header row
    const headers = [
      'response_id',
      'respondent_id', 
      'status',
      'started_at',
      'completed_at',
      ...questionIds
    ];
    csvRows.push(headers.join(','));

    // Data rows
    responses.forEach((response) => {
      const row = [
        escapeCSV(response.response_id || response.responseId || ''),
        escapeCSV(response.respondent_id || response.respondentId || ''),
        escapeCSV(response.status || 'completed'),
        escapeCSV(formatDateTime(response.started_at || response.startedAt)),
        escapeCSV(formatDateTime(response.completed_at || response.completedAt)),
      ];

      // Add answer for each question
      const answersArray = response.answers || response.answers_blob || response.answersBlob || [];
      const answerMap = {};
      
      answersArray.forEach((answer) => {
        const questionId = answer.questionId;
        let answerValue = '';
        
        if (Array.isArray(answer.answer)) {
          answerValue = answer.answer.join('; ');
        } else if (answer.answer !== null && answer.answer !== undefined) {
          answerValue = String(answer.answer);
        }
        
        answerMap[questionId] = answerValue;
      });

      questionIds.forEach(qId => {
        row.push(escapeCSV(answerMap[qId] || ''));
      });

      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    // ==================== CREATE SPSS SYNTAX ====================
    const spsSyntax = generateSPSSSyntax(
      surveyName,
      headers,
      questionMap,
      questionIds
    );

    // ==================== DOWNLOAD FILES ====================
    const timestamp = new Date().toISOString().split('T')[0];
    const baseName = sanitizeFileName(surveyName);
    const csvFileName = `${baseName}_${timestamp}.csv`;
    const spsFileName = `${baseName}_${timestamp}.sps`;
    
    // Download CSV
    downloadFile(csvContent, csvFileName, 'text/csv');
    
    // Download SPSS syntax
    downloadFile(spsSyntax, spsFileName, 'text/plain');

    return {
      success: true,
      csvFileName: csvFileName,
      spsFileName: spsFileName,
      responseCount: responses.length,
      questionCount: questions.length
    };

  } catch (error) {
    console.error('SPSS export failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
};

// ==================== SPSS SYNTAX GENERATOR ====================
function generateSPSSSyntax(surveyName, headers, questionMap, questionIds) {
  const timestamp = new Date().toISOString().split('T')[0];
  const csvFileName = `${sanitizeFileName(surveyName)}_${timestamp}.csv`;
  
  let syntax = `* SPSS Syntax File for ${surveyName}.
* Generated on ${new Date().toLocaleString()}.
* 
* INSTRUCTIONS:
* 1. Save this .sps file and the accompanying .csv file in the same folder
* 2. Update the FILE path below to match your folder location
* 3. Run this syntax in SPSS to import the data
* 4. The syntax will define variable labels, value labels, and measure types.

* Import CSV data.
GET DATA
  /TYPE=TXT
  /FILE="${csvFileName}"
  /ENCODING='UTF8'
  /DELIMITERS=","
  /QUALIFIER='"'
  /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2
  /VARIABLES=
`;

  // Variable definitions
  headers.forEach(header => {
    const varName = cleanVariableName(header);
    
    if (['response_id', 'respondent_id', 'status', 'started_at', 'completed_at'].includes(header)) {
      syntax += `  ${varName} A255\n`;
    } else {
      const question = questionMap[header];
      if (question) {
        // Determine if numeric or string based on question type
        if (isNumericQuestion(question.type)) {
          syntax += `  ${varName} F8.2\n`;
        } else {
          syntax += `  ${varName} A255\n`;
        }
      } else {
        syntax += `  ${varName} A255\n`;
      }
    }
  });

  syntax += `  .
CACHE.
EXECUTE.

* Set variable labels.
VARIABLE LABELS
  response_id 'Response ID'
  respondent_id 'Respondent ID'
  status 'Response Status'
  started_at 'Started At'
  completed_at 'Completed At'
`;

  // Add question labels
  questionIds.forEach(qId => {
    const question = questionMap[qId];
    const varName = cleanVariableName(qId);
    const label = question.label.replace(/'/g, "''"); // Escape single quotes
    syntax += `  ${varName} '${label}'\n`;
  });

  syntax += `  .

* Set variable measurement levels.
VARIABLE LEVEL
  response_id respondent_id status started_at completed_at (NOMINAL)
`;

  // Set measurement levels for questions
  questionIds.forEach(qId => {
    const question = questionMap[qId];
    const varName = cleanVariableName(qId);
    const level = getMeasurementLevel(question.type);
    syntax += `  ${varName} (${level})\n`;
  });

  syntax += `  .

* Add value labels for categorical questions.
`;

  // Add value labels for questions with options
  questionIds.forEach(qId => {
    const question = questionMap[qId];
    if (question.config && question.config.options && Array.isArray(question.config.options)) {
      const varName = cleanVariableName(qId);
      syntax += `VALUE LABELS ${varName}\n`;
      
      question.config.options.forEach((option, index) => {
        const escapedOption = String(option).replace(/'/g, "''");
        syntax += `  '${option}' '${escapedOption}'\n`;
      });
      
      syntax += `  .\n`;
    }
  });

  syntax += `
* Save the dataset.
SAVE OUTFILE='${sanitizeFileName(surveyName)}_${timestamp}.sav'
  /COMPRESSED.

* Display variable information.
DISPLAY DICTIONARY.

* Basic frequency tables.
FREQUENCIES VARIABLES=status.

EXECUTE.
`;

  return syntax;
}

// ==================== HELPER FUNCTIONS ====================

function cleanVariableName(name) {
  // SPSS variable names: max 64 chars, start with letter, alphanumeric + underscore
  let cleaned = name.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // Ensure starts with letter
  if (!/^[a-zA-Z]/.test(cleaned)) {
    cleaned = 'Q_' + cleaned;
  }
  
  // Limit length
  return cleaned.substring(0, 64);
}

function isNumericQuestion(type) {
  const numericTypes = ['number', 'rating', 'scale', 'slider'];
  return numericTypes.includes(type?.toLowerCase());
}

function getMeasurementLevel(type) {
  const typeStr = String(type).toLowerCase();
  
  if (isNumericQuestion(typeStr)) {
    return 'SCALE';
  }
  
  if (['single_choice', 'dropdown', 'radio'].includes(typeStr)) {
    return 'NOMINAL';
  }
  
  if (['ranking', 'likert'].includes(typeStr)) {
    return 'ORDINAL';
  }
  
  return 'NOMINAL';
}

function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

function formatDateTime(dateValue) {
  if (!dateValue) return '';
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue;
    
    return date.toISOString();
  } catch (e) {
    return String(dateValue);
  }
}

function sanitizeFileName(name) {
  return name.replace(/[^a-z0-9_\-]/gi, '_').substring(0, 50);
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default exportSurveyToSPSS;