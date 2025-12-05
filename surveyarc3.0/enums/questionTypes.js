
const QUESTION_TYPES = {
  // 📌 Contact Information
  CONTACT_EMAIL: 'contact_email',
  CONTACT_PHONE: 'contact_phone',
  CONTACT_ADDRESS: 'contact_address',
  CONTACT_WEBSITE: 'contact_website',
GABOR_GRANGER: "gabor_granger",
  // 📌 Choice Questions
  MULTIPLE_CHOICE: 'multiple_choice',
  DROPDOWN: 'dropdown',
  PICTURE_CHOICE: 'picture_choice',
  YES_NO: 'yes_no',
  LEGAL: 'legal',
  CHECKBOX: 'checkbox',
    PRICE_SENSITIVITY: 'price_sensitivity',
  SEMANTIC_DIFF: 'semantic_diff',   // 👈 NEW
  SLIDER: 'slider',
LIKERT: "likert",
SMILEY_RATING: "smiley_rating",
IMAGE_CLICK_RATING: "image_click_rating",
  SEGMENTATION_SELECTOR: "segmentation_selector",
  PERSONA_QUIZ: "persona_quiz",
  MONADIC_TEST: "monadic_test",
  SEQUENTIAL_MONADIC: "sequential_monadic",  // 👈 NEW
  FORCED_EXPOSURE: "forced_exposure",   // 👈 NEW


  // 📌 Rating & Opinion
  NPS: 'nps',
  OPINION_SCALE: 'opinion_scale',
  RATING: 'rating',
  RANKING: 'ranking',
  MATRIX: 'matrix',
  OSAT: 'osat',

  // 📌 Text & Media
  LONG_TEXT: 'long_text',
  SHORT_TEXT: 'short_text',
  VIDEO: 'video',

  // 📌 Data Collection
  NUMBER: 'number',
  DATE: 'date',
  FILE_UPLOAD: 'file_upload',
  GOOGLE_DRIVE: 'google_drive',
  CALENDLY: 'calendly',
  TURF: "turf",
    BAYES_ACQ: 'bayes_acq',   // 👈 NEW
TABLE_GRID: 'table_grid',
MULTI_GRID: 'multi_grid',
MATRIX_RATING: 'matrix_rating',
 SIDE_BY_SIDE: "side_by_side",        // ✅ double stimulus per row
  COMPARISON_GRID: "comparison_grid",  // ✅ brand vs attribute grid

  // 🎭 Flow / Structure
  WELCOME: 'welcome_screen',
  END_SCREEN: 'end_screen',
  REDIRECT: 'redirect_url',
WEIGHTED_MULTI: "weighted_multi",

  // // 🧪 Experimental / Randomization (NEW)
  // AB_TEST: 'ab_test',
  // QUOTA_SPLIT: 'quota_split',
  // RANDOM_BLOCK: 'random_block',
  // RANDOM_OPTION: 'random_option',

    MAXDIFF: 'maxdiff',           // Best-Worst Scaling
  CONJOINT: 'conjoint',   
};

export default QUESTION_TYPES;
