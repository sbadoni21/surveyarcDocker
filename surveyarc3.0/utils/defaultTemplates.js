// utils/defaultTemplates.js — Survey-only WhatsApp Business templates

export const DEFAULT_TEMPLATES = {
  UTILITY: [
    {
      id: 'nps_survey_invite',
      name: 'NPS Survey Invite',
      description: 'Ask customers how likely they are to recommend you (NPS).',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'Quick feedback ✨' },
        body: {
          text:
            'Hi {{1}}, could you spare 15 seconds to rate {{2}}?\n\nOn a scale of 0–10, how likely are you to recommend us to a friend?'
        },
        footer: { text: 'Your feedback helps us improve' },
        buttons: [
          { type: 'URL', text: 'Take Survey', url: 'https://surveyarc.com/form?campaignID={{3}}&userKey={{4}}' },
          { type: 'QUICK_REPLY', text: 'Remind me later' }
        ]
      },
      variables: ['Customer Name', 'Brand Name', 'Campaign ID', 'Contact Key'],
      industry: 'General',
      useCase: 'NPS Survey'
    },

    {
      id: 'post_purchase_feedback',
      name: 'Post-Purchase Feedback',
      description: 'Collect feedback after an order is delivered.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'How was your order? 📦' },
        body: {
          text:
            'Hi {{1}}, your order *#{{2}}* from {{3}} was delivered.\nWe’d love to hear about your experience.'
        },
        footer: { text: 'Takes less than 1 minute' },
        buttons: [
          { type: 'URL', text: 'Share Feedback', url: 'https://surveyarc.com/form?campaignID={{4}}&userKey={{5}}' },
          { type: 'QUICK_REPLY', text: 'Not now' }
        ]
      },
      variables: ['Customer Name', 'Order ID', 'Store Name', 'Campaign ID', 'Contact Key'],
      industry: 'E-commerce',
      useCase: 'Post-Purchase Survey'
    },

    {
      id: 'support_csat_followup',
      name: 'Support CSAT Follow-up',
      description: 'Measure satisfaction after a support interaction.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'Rate our support 🛠️' },
        body: {
          text:
            'Hi {{1}}, your support ticket *#{{2}}* with {{3}} was recently resolved.\nHow satisfied are you with the help you received?'
        },
        footer: { text: 'Your response guides our training' },
        buttons: [
          { type: 'URL', text: 'Rate Support', url: 'https://surveyarc.com/form?campaignID={{4}}&userKey={{5}}' },
          { type: 'QUICK_REPLY', text: 'All good' }
        ]
      },
      variables: ['Customer Name', 'Ticket ID', 'Company', 'Campaign ID', 'Contact Key'],
      industry: 'Customer Service',
      useCase: 'CSAT Survey'
    },

    {
      id: 'appointment_feedback',
      name: 'Appointment Feedback',
      description: 'Collect feedback after an appointment or visit.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'Your visit with {{2}}' },
        body: {
          text:
            'Hi {{1}}, thanks for your appointment on {{3}}.\nCould you rate your experience with {{2}}?'
        },
        footer: { text: 'It really helps!' },
        buttons: [
          { type: 'URL', text: 'Give Feedback', url: 'https://surveyarc.com/form?campaignID={{4}}&userKey={{5}}' },
          { type: 'QUICK_REPLY', text: 'Later' }
        ]
      },
      variables: ['Customer Name', 'Provider/Clinic', 'Date', 'Campaign ID', 'Contact Key'],
      industry: 'Healthcare',
      useCase: 'Post-Appointment Survey'
    },

    {
      id: 'delivery_experience_feedback',
      name: 'Delivery Experience Survey',
      description: 'Rate last-mile delivery quality and timing.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'Delivery feedback 🚚' },
        body: {
          text:
            'Hi {{1}}, your package *#{{2}}* was delivered by {{3}}.\nHow was the delivery experience?'
        },
        footer: { text: 'Thanks for helping us improve' },
        buttons: [
          { type: 'URL', text: 'Start Survey', url: 'https://surveyarc.com/form?campaignID={{4}}&userKey={{5}}' },
          { type: 'QUICK_REPLY', text: 'All good' }
        ]
      },
      variables: ['Customer Name', 'Order ID', 'Carrier', 'Campaign ID', 'Contact Key'],
      industry: 'E-commerce',
      useCase: 'Delivery Feedback'
    },

    {
      id: 'event_feedback',
      name: 'Event / Webinar Feedback',
      description: 'Collect feedback after events or webinars.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'Thanks for joining 🎤' },
        body: {
          text:
            'Hi {{1}}, thanks for attending *{{2}}*.\nCould you share quick feedback to help us improve the next one?'
        },
        footer: { text: 'Under 1 minute' },
        buttons: [
          { type: 'URL', text: 'Share Feedback', url: 'https://surveyarc.com/form?campaignID={{3}}&userKey={{4}}' },
          { type: 'QUICK_REPLY', text: 'Later' }
        ]
      },
      variables: ['Attendee Name', 'Event/Webinar Name', 'Campaign ID', 'Contact Key'],
      industry: 'General',
      useCase: 'Event Feedback'
    },

    {
      id: 'onboarding_feedback',
      name: 'Onboarding Feedback',
      description: 'Ask new users about their onboarding experience.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'Welcome to {{2}}' },
        body: {
          text:
            'Hi {{1}}, you recently got started with {{2}}.\nHow easy was your onboarding so far?'
        },
        footer: { text: 'We’re here to help' },
        buttons: [
          { type: 'URL', text: 'Give Feedback', url: 'https://surveyarc.com/form?campaignID={{3}}&userKey={{4}}' },
          { type: 'QUICK_REPLY', text: 'Need help' }
        ]
      },
      variables: ['User Name', 'Product/Service', 'Campaign ID', 'Contact Key'],
      industry: 'SaaS',
      useCase: 'Onboarding Survey'
    },

    {
      id: 'churn_feedback',
      name: 'Cancellation / Churn Feedback',
      description: 'Understand why a user canceled or stopped using the service.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'We’re sorry to see you go' },
        body: {
          text:
            'Hi {{1}}, we noticed your subscription with {{2}} was canceled.\nCould you tell us why so we can improve?'
        },
        footer: { text: 'Your input matters' },
        buttons: [
          { type: 'URL', text: 'Share Reason', url: 'https://surveyarc.com/form?campaignID={{3}}&userKey={{4}}' },
          { type: 'QUICK_REPLY', text: 'No thanks' }
        ]
      },
      variables: ['Customer Name', 'Brand/Plan', 'Campaign ID', 'Contact Key'],
      industry: 'SaaS',
      useCase: 'Churn Survey'
    },

    {
      id: 'product_research_invite',
      name: 'Product Research Invite',
      description: 'Invite customers to a short product discovery survey.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'Help us build better ✍️' },
        body: {
          text:
            'Hi {{1}}, we’re researching improvements to {{2}}.\nCould you answer a few quick questions?'
        },
        footer: { text: 'Takes ~60 seconds' },
        buttons: [
          { type: 'URL', text: 'Start Survey', url: 'https://surveyarc.com/form?campaignID={{3}}&userKey={{4}}' },
          { type: 'QUICK_REPLY', text: 'Later' }
        ]
      },
      variables: ['Customer Name', 'Product/Feature', 'Campaign ID', 'Contact Key'],
      industry: 'General',
      useCase: 'Product Research'
    },

    {
      id: 'store_visit_feedback',
      name: 'In-store/Restaurant Visit Feedback',
      description: 'Collect feedback after a physical visit.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'How was your visit? 🍽️' },
        body: {
          text:
            'Hi {{1}}, thanks for visiting {{2}} on {{3}}.\nWe’d love your quick feedback on the experience.'
        },
        footer: { text: 'Thank you for helping us improve' },
        buttons: [
          { type: 'URL', text: 'Give Feedback', url: 'https://surveyarc.com/form?campaignID={{4}}&userKey={{5}}' },
          { type: 'QUICK_REPLY', text: 'Later' }
        ]
      },
      variables: ['Guest Name', 'Location/Brand', 'Visit Date', 'Campaign ID', 'Contact Key'],
      industry: 'Hospitality',
      useCase: 'Visit Feedback'
    },

    {
      id: 'education_course_feedback',
      name: 'Course / Class Feedback',
      description: 'Gather feedback after a course/class/module.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'Tell us about {{2}}' },
        body: {
          text:
            'Hi {{1}}, we hope you enjoyed *{{2}}*.\nWould you share quick feedback to help us improve our curriculum?'
        },
        footer: { text: 'We appreciate your time' },
        buttons: [
          { type: 'URL', text: 'Start Survey', url: 'https://surveyarc.com/form?campaignID={{3}}&userKey={{4}}' },
          { type: 'QUICK_REPLY', text: 'Later' }
        ]
      },
      variables: ['Student Name', 'Course/Class Name', 'Campaign ID', 'Contact Key'],
      industry: 'Education',
      useCase: 'Course Feedback'
    },

    {
      id: 'lead_qualification_survey',
      name: 'Lead Qualification Survey',
      description: 'Light survey to qualify inbound leads.',
      category: 'UTILITY',
      language: 'en_US',
      components: {
        header: { type: 'TEXT', text: 'A few quick questions' },
        body: {
          text:
            'Hi {{1}}, thanks for your interest in {{2}}.\nCould you answer a few questions so we can recommend the best fit?'
        },
        footer: { text: '~60 seconds' },
        buttons: [
          { type: 'URL', text: 'Begin', url: 'https://surveyarc.com/form?campaignID={{3}}&userKey={{4}}' },
          { type: 'QUICK_REPLY', text: 'Later' }
        ]
      },
      variables: ['Name', 'Product/Service', 'Campaign ID', 'Contact Key'],
      industry: 'General',
      useCase: 'Lead Qualification'
    }
  ],

  // Keep empty categories to avoid breaking UI logic that expects these keys.
  MARKETING: [],
  AUTHENTICATION: []
};

// Categories shown in the library sidebar
export const TEMPLATE_CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: '📱' },
  { id: 'UTILITY', name: 'Surveys (Utility)', icon: '📝' }
];

// Industries (trimmed to relevant ones for surveys)
export const INDUSTRY_FILTERS = [
  { id: 'all', name: 'All Industries' },
  { id: 'General', name: 'General Business' },
  { id: 'E-commerce', name: 'E-commerce' },
  { id: 'Customer Service', name: 'Customer Service' },
  { id: 'Healthcare', name: 'Healthcare' },
  { id: 'Hospitality', name: 'Hospitality' },
  { id: 'Education', name: 'Education' },
  { id: 'SaaS', name: 'SaaS' }
];

// Use cases focused on surveys only
export const USE_CASE_FILTERS = [
  { id: 'all', name: 'All Survey Types' },
  { id: 'NPS Survey', name: 'NPS' },
  { id: 'CSAT Survey', name: 'CSAT / Support' },
  { id: 'Post-Purchase Survey', name: 'Post-Purchase' },
  { id: 'Delivery Feedback', name: 'Delivery' },
  { id: 'Post-Appointment Survey', name: 'Appointments' },
  { id: 'Event Feedback', name: 'Events/Webinars' },
  { id: 'Onboarding Survey', name: 'Onboarding' },
  { id: 'Churn Survey', name: 'Cancellation / Churn' },
  { id: 'Product Research', name: 'Product Research' },
  { id: 'Visit Feedback', name: 'In-store/Restaurant' },
  { id: 'Course Feedback', name: 'Education' },
  { id: 'Lead Qualification', name: 'Lead Qualification' }
];

// Helper: flatten all
export const getAllTemplates = () => [
  ...DEFAULT_TEMPLATES.UTILITY // survey-only
];

// By category (kept for compatibility)
export const getTemplatesByCategory = (category) => {
  if (category === 'all') return getAllTemplates();
  return DEFAULT_TEMPLATES[category] || [];
};

// Filtering
export const filterTemplates = (
  category = 'all',
  industry = 'all',
  useCase = 'all',
  searchTerm = ''
) => {
  let templates = getTemplatesByCategory(category);

  if (industry !== 'all') {
    templates = templates.filter((t) => t.industry === industry);
  }
  if (useCase !== 'all') {
    templates = templates.filter((t) => t.useCase === useCase);
  }
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    templates = templates.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.components.body.text.toLowerCase().includes(term)
    );
  }
  return templates;
};
