// ============================================
// FILE: utils/surveyTemplates.js
// ============================================

import QUESTION_TYPES from "@/enums/questionTypes";

export const SURVEY_TEMPLATES = {
  CUSTOMER_SATISFACTION: {
    id: 'customer_satisfaction',
    name: 'Customer Satisfaction Survey',
    description: 'Measure customer satisfaction with NPS, ratings, and feedback',
    category: 'feedback',
    questions: [
      {
        type: QUESTION_TYPES.WELCOME,
        label: 'Welcome',
        required: false,
        description: '',
        config: {
          title: 'Customer Satisfaction Survey',
          description: 'Help us improve by sharing your experience',
          showStartButton: true,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.NPS,
        label: 'How likely are you to recommend us to a friend or colleague?',
        required: true,
        description: '',
        config: {
          minLabel: 'Not at all likely',
          maxLabel: 'Extremely likely',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.RATING,
        label: 'Rate your overall satisfaction',
        required: true,
        description: '',
        config: {
          maxStars: 5,
          icon: '⭐',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.LONG_TEXT,
        label: 'What do you like most about our product/service?',
        required: false,
        description: '',
        config: {
          placeholder: 'Share your thoughts...',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.LONG_TEXT,
        label: 'What could we improve?',
        required: false,
        description: '',
        config: {
          placeholder: 'Your suggestions...',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.END_SCREEN,
        label: 'Thank You',
        required: false,
        description: '',
        config: {
          title: 'Thank You!',
          description: 'Your feedback helps us serve you better.',
          showRestartButton: false,
        },
        logic: [],
      },
    ],
  },

  PRODUCT_FEEDBACK: {
    id: 'product_feedback',
    name: 'Product Feedback Survey',
    description: 'Gather detailed feedback on product features and usability',
    category: 'product',
    questions: [
      {
        type: QUESTION_TYPES.WELCOME,
        label: 'Welcome',
        required: false,
        config: {
          title: 'Product Feedback',
          description: 'Share your experience with our product',
          showStartButton: true,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.LIKERT,
        label: 'The product is easy to use',
        required: true,
        config: {
          labels: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          scale: 5,
          randomize: false,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.LIKERT,
        label: 'The product meets my needs',
        required: true,
        config: {
          labels: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          scale: 5,
          randomize: false,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.RANKING,
        label: 'Rank these features by importance to you',
        required: true,
        config: {
          items: ['Performance', 'Design', 'Features', 'Price', 'Support'],
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.CHECKBOX,
        label: 'Which features do you use regularly?',
        required: false,
        config: {
          options: ['Dashboard', 'Reports', 'Analytics', 'Integrations', 'Mobile App'],
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.LONG_TEXT,
        label: 'What features would you like to see added?',
        required: false,
        config: {
          placeholder: 'Describe new features...',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.END_SCREEN,
        label: 'Thank You',
        required: false,
        config: {
          title: 'Thank You!',
          description: 'Your feedback is valuable to us.',
          showRestartButton: false,
        },
        logic: [],
      },
    ],
  },

  MARKET_RESEARCH: {
    id: 'market_research',
    name: 'Market Research Survey',
    description: 'Conduct comprehensive market research with segmentation',
    category: 'research',
    questions: [
      {
        type: QUESTION_TYPES.WELCOME,
        label: 'Welcome',
        required: false,
        config: {
          title: 'Market Research Survey',
          description: 'Help us understand the market better',
          showStartButton: true,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.SEGMENTATION_SELECTOR,
        label: 'Which segment best describes you?',
        required: true,
        config: {
          mode: 'single',
          minSelect: 1,
          maxSelect: 1,
          randomizeOrder: false,
          showDescriptions: true,
          showIcons: true,
          segments: [
            {
              id: 'SEG_VALUE',
              label: 'Value Seekers',
              description: 'Highly price-sensitive, always hunting for deals',
              icon: '💸',
              colorTag: '#F97316',
            },
            {
              id: 'SEG_PREMIUM',
              label: 'Premium Enthusiasts',
              description: 'Pay more for quality, design and experience',
              icon: '👑',
              colorTag: '#6366F1',
            },
            {
              id: 'SEG_CONVENIENCE',
              label: 'Convenience First',
              description: 'Want fastest, easiest solution',
              icon: '⚡',
              colorTag: '#22C55E',
            },
          ],
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.MULTIPLE_CHOICE,
        label: 'How often do you purchase in this category?',
        required: true,
        config: {
          choices: ['Daily', 'Weekly', 'Monthly', 'Rarely', 'Never'],
          allowMultipleSelection: false,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.PRICE_SENSITIVITY,
        label: 'At what price points would you consider this product?',
        required: true,
        config: {
          currency: '$',
          tooCheapLabel: 'Too cheap',
          cheapLabel: 'Cheap / good value',
          expensiveLabel: 'Expensive but still acceptable',
          tooExpensiveLabel: 'Too expensive',
          min: 0,
          step: 1,
          showHelperText: true,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.MAXDIFF,
        label: 'Which features are most and least important?',
        required: true,
        config: {
          items: ['Price', 'Quality', 'Brand', 'Convenience'],
          setSize: 4,
          numSets: 2,
          randomize: true,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.END_SCREEN,
        label: 'Thank You',
        required: false,
        config: {
          title: 'Thank You!',
          description: 'Your insights are invaluable.',
          showRestartButton: false,
        },
        logic: [],
      },
    ],
  },

  EVENT_FEEDBACK: {
    id: 'event_feedback',
    name: 'Event Feedback Survey',
    description: 'Collect feedback from event attendees',
    category: 'feedback',
    questions: [
      {
        type: QUESTION_TYPES.WELCOME,
        label: 'Welcome',
        required: false,
        config: {
          title: 'Event Feedback',
          description: 'Tell us about your event experience',
          showStartButton: true,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.SMILEY_RATING,
        label: 'How would you rate your overall event experience?',
        required: true,
        config: {
          emojis: ['😡', '☹️', '😐', '🙂', '😍'],
          labels: ['Terrible', 'Bad', 'Okay', 'Good', 'Excellent'],
          highlightColor: '#ff9800',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.TABLE_GRID,
        label: 'Rate different aspects of the event',
        required: true,
        config: {
          rows: ['Venue', 'Content quality', 'Speakers', 'Organization', 'Networking opportunities'],
          columns: ['Very poor', 'Poor', 'Average', 'Good', 'Excellent'],
          randomizeRows: false,
          layout: 'comfortable',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.YES_NO,
        label: 'Would you attend this event again?',
        required: true,
        config: {
          yesLabel: 'Yes',
          noLabel: 'No',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.LONG_TEXT,
        label: 'What was the highlight of the event?',
        required: false,
        config: {
          placeholder: 'Share your favorite moment...',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.END_SCREEN,
        label: 'Thank You',
        required: false,
        config: {
          title: 'Thank You!',
          description: 'See you at the next event!',
          showRestartButton: false,
        },
        logic: [],
      },
    ],
  },

  EMPLOYEE_ENGAGEMENT: {
    id: 'employee_engagement',
    name: 'Employee Engagement Survey',
    description: 'Measure employee satisfaction and engagement',
    category: 'hr',
    questions: [
      {
        type: QUESTION_TYPES.WELCOME,
        label: 'Welcome',
        required: false,
        config: {
          title: 'Employee Engagement Survey',
          description: 'Your feedback matters. All responses are anonymous.',
          showStartButton: true,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.NPS,
        label: 'How likely are you to recommend this company as a great place to work?',
        required: true,
        config: {
          minLabel: 'Not at all likely',
          maxLabel: 'Extremely likely',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.LIKERT,
        label: 'I feel valued at work',
        required: true,
        config: {
          labels: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          scale: 5,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.LIKERT,
        label: 'I have opportunities for growth',
        required: true,
        config: {
          labels: ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'],
          scale: 5,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.OPINION_SCALE,
        label: 'Rate your work-life balance',
        required: true,
        config: {
          min: 1,
          max: 10,
          step: 1,
          minLabel: 'Poor',
          maxLabel: 'Excellent',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.LONG_TEXT,
        label: 'What could we do to improve your experience?',
        required: false,
        config: {
          placeholder: 'Your suggestions...',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.END_SCREEN,
        label: 'Thank You',
        required: false,
        config: {
          title: 'Thank You!',
          description: 'Your feedback helps create a better workplace.',
          showRestartButton: false,
        },
        logic: [],
      },
    ],
  },

  CONCEPT_TESTING: {
    id: 'concept_testing',
    name: 'Concept Testing Survey',
    description: 'Test new product concepts with monadic testing',
    category: 'research',
    questions: [
      {
        type: QUESTION_TYPES.WELCOME,
        label: 'Welcome',
        required: false,
        config: {
          title: 'New Concept Testing',
          description: 'Help us evaluate a new product concept',
          showStartButton: true,
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.FORCED_EXPOSURE,
        label: 'Review Concept',
        required: true,
        config: {
          title: 'Please review this concept carefully',
          body: 'Take your time to understand the product concept below.',
          contentType: 'text',
          minExposureSeconds: 10,
          showCountdown: true,
          requireScrollToEnd: true,
          systemHint: "You'll be able to continue once you've viewed the full content.",
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.MONADIC_TEST,
        label: 'Rate this concept',
        required: true,
        config: {
          allocationMode: 'simple_random',
          concepts: [
            {
              id: 'c1',
              name: 'Concept A',
              description: 'Product concept description',
              tag: 'Base',
              weight: 1,
            },
          ],
          metrics: [
            {
              id: 'pi',
              label: 'Purchase intent',
              type: 'likert',
              min: 1,
              max: 5,
              leftLabel: 'Definitely would not buy',
              rightLabel: 'Definitely would buy',
            },
          ],
          showOpenEnded: true,
          openEndedLabel: 'What did you like or dislike about this concept?',
        },
        logic: [],
      },
      {
        type: QUESTION_TYPES.END_SCREEN,
        label: 'Thank You',
        required: false,
        config: {
          title: 'Thank You!',
          description: 'Your input helps shape our products.',
          showRestartButton: false,
        },
        logic: [],
      },
    ],
  },
};