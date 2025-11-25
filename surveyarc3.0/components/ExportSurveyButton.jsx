// components/ExportSurveyButton.jsx
'use client';

import React, { useState } from 'react';

import { exportSurveyToExcel } from '@/utils/exportToExcel';

const ExportSurveyButton = ({ surveyName, responses, questions }) => {
  const [exporting, setExporting] = useState(false);


  const handleExport = async () => {
    // Validate data
    if (!responses || responses.length === 0) {
      alert('No responses to export');
      return;
    }

    if (!questions || questions.length === 0) {
      alert('No questions found');
      return;
    }

    setExporting(true);

    try {
      // Debug: Log the raw data
      console.log('Raw responses:', responses);
      console.log('First response structure:', responses[0]);
      
      // Transform responses to match expected format
      const transformedResponses = responses.map(response => {
        // Get answers from any possible field
        const answers = response.answers || response.answersBlob || response.answers_blob || [];
        
        console.log('Response ID:', response.responseId || response.response_id);
        console.log('Answers found:', answers.length);
        
        return {
          response_id: response.responseId || response.response_id,
          respondent_id: response.respondentId || response.respondent_id,
          status: response.status,
          started_at: response.startedAt || response.started_at,
          completed_at: response.completedAt || response.completed_at,
          // Important: use the correct field name
          answers: answers
        };
      });

      // Transform questions to match expected format
      const transformedQuestions = questions.map(question => ({
        question_id: question.questionId || question.question_id,
        label: question.label,
        type: question.type,
        description: question.description || '',
        required: question.required,
        config: question.config || {}
      }));

      console.log('Transformed responses:', transformedResponses);
      console.log('Transformed questions:', transformedQuestions);

      const result = await exportSurveyToExcel(
        transformedResponses,
        transformedQuestions,
        surveyName || 'Survey'
      );

      if (result.success) {
        console.log(`✅ Exported: ${result.fileName}`);
        alert(`Successfully exported ${result.fileName}`);
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const responseCount = responses?.length || 0;

  return (
    <button
      onClick={handleExport}
      disabled={exporting || responseCount === 0}
      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 
                 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors
                 flex items-center gap-2 font-medium shadow-sm"
      title={responseCount === 0 ? 'No responses to export' : `Export ${responseCount} responses`}
    >
      {exporting ? (
        <>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4" 
              fill="none"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Exporting...
        </>
      ) : (
        <>
          <svg 
            className="h-5 w-5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
            />
          </svg>
          Export to Excel
          {responseCount > 0 && (
            <span className="text-xs bg-green-800 px-2 py-0.5 rounded-full">
              {responseCount}
            </span>
          )}
        </>
      )}
    </button>
  );
};

export default ExportSurveyButton;