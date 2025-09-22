import QUESTION_TYPES from "@/enums/questionTypes";

const defaultConfigMap = {
  [QUESTION_TYPES.CONTACT_EMAIL]: {
    placeholder: "e.g. yourname@example.com",
  },

  [QUESTION_TYPES.CONTACT_PHONE]: {
    placeholder: "e.g. +1 555 123 4567",
    countryCode: "+1", 
  },

  [QUESTION_TYPES.CONTACT_ADDRESS]: {
    placeholder: "Enter your full address",
  },

  [QUESTION_TYPES.CONTACT_WEBSITE]: {
    placeholder: "e.g. https://example.com",
  },

  [QUESTION_TYPES.MULTIPLE_CHOICE]: {
    choices: ["Option 1", "Option 2"],
    allowMultipleSelection: false,
  },

  [QUESTION_TYPES.DROPDOWN]: {
    options: ["Option 1", "Option 2"],
  },

  [QUESTION_TYPES.PICTURE_CHOICE]: {
    images: [], // Each image: { url, label }
    allowMultipleSelection: false,
  },

  [QUESTION_TYPES.YES_NO]: {
    yesLabel: "Yes",
    noLabel: "No",
  },

  [QUESTION_TYPES.LEGAL]: {
    statement: "I agree to the terms and conditions.",
    required: true,
  },

  [QUESTION_TYPES.CHECKBOX]: {
    options: ["Option 1", "Option 2"],
  },

  [QUESTION_TYPES.NPS]: {
    minLabel: "Not at all likely",
    maxLabel: "Extremely likely",
  },

  [QUESTION_TYPES.OPINION_SCALE]: {
    min: 1,
    max: 5,
    step: 1,
    minLabel: "Low",
    maxLabel: "High",
  },

  [QUESTION_TYPES.RATING]: {
    maxStars: 5,
    icon: "⭐",
  },

  [QUESTION_TYPES.RANKING]: {
    items: ["Item 1", "Item 2", "Item 3"],
  },

  [QUESTION_TYPES.MATRIX]: {
    rows: ["Row 1", "Row 2"],
    columns: ["Column 1", "Column 2"],
    type: "radio", // or checkbox
  },

  [QUESTION_TYPES.LONG_TEXT]: {
    placeholder: "Type your full answer here...",
  },

  [QUESTION_TYPES.SHORT_TEXT]: {
    placeholder: "Type your answer...",
  },

  [QUESTION_TYPES.VIDEO]: {
    videoUrl: "",
  },

  [QUESTION_TYPES.AI_CLARIFY]: {
    placeholder: "Ask a question...",
    aiPrompt: "Clarify this answer:",
  },

  [QUESTION_TYPES.NUMBER]: {
    placeholder: "Enter a number",
    min: null,
    max: null,
  },

  [QUESTION_TYPES.DATE]: {
    placeholder: "Select a date",
    dateFormat: "YYYY-MM-DD",
  },

  [QUESTION_TYPES.PAYMENT]: {
    currency: "USD",
    amount: 0,
  },

  [QUESTION_TYPES.FILE_UPLOAD]: {
    allowedTypes: ["pdf", "docx", "jpg"],
    maxSizeMB: 10,
  },

  [QUESTION_TYPES.GOOGLE_DRIVE]: {
    fileId: "",
  },

  [QUESTION_TYPES.CALENDLY]: {
    calendlyUrl: "",
  },

  [QUESTION_TYPES.WELCOME]: {
    title: "Welcome!",
    description: "",
    showStartButton: true,
  },

  [QUESTION_TYPES.PARTIAL_SUBMIT]: {
    showNotice: true,
  },

  [QUESTION_TYPES.STATEMENT]: {
    text: "This is an informational statement.",
  },

  [QUESTION_TYPES.QUESTION_GROUP]: {
    groupTitle: "Group Title",
    questions: [],
  },

  [QUESTION_TYPES.MULTI_QUESTION_PAGE]: {
    questions: [],
  },

  [QUESTION_TYPES.END_SCREEN]: {
    title: "Thank You!",
    description: "Your responses have been recorded.",
    showRestartButton: false,
  },

  [QUESTION_TYPES.REDIRECT]: {
    url: "https://example.com",
    buttonText: "Continue",
  },
};

export default defaultConfigMap;
