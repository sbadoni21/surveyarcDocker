export const QUESTION_CATEGORIES = {
  "Contact Information": [
    "CONTACT_EMAIL",
    "CONTACT_PHONE",
    "CONTACT_ADDRESS",
    "CONTACT_WEBSITE",
  ],

  "Choice Questions": [
    "MULTIPLE_CHOICE",
    "DROPDOWN",
    "PICTURE_CHOICE",
    "YES_NO",
    "LEGAL",
    "CHECKBOX",
  ],
  "Advanced Methods": ["MAXDIFF", "CONJOINT", "AUTO_SUM", "PRICE_SENSITIVITY","TURF","BAYES_ACQ",   "WEIGHTED_MULTI", "TABLE_GRID", "MULTI_GRID" ,"SEGMENTATION_SELECTOR" ,  "PERSONA_QUIZ",      // 👈 add here
    "MONADIC_TEST",   // 👈 NEW
    "SEQUENTIAL_MONADIC",   // 👈 NEW
    "FORCED_EXPOSURE",      // 👈 NEW
     // Tabular data input
  // 👈 ADD THIS

 ],

  "Rating & Opinion": [
    "NPS",
    "OPINION_SCALE",
    "RATING",
    "RANKING",
    "MATRIX",
    "OSAT",
        "SEMANTIC_DIFF",   // 👈 NEW
            "SLIDER",          // 👈 add here
"LIKERT",              // e.g., Strongly Disagree → Strongly Agree
"SMILEY_RATING",       // Emoji faces
"IMAGE_CLICK_RATING",  // User clicks image to rate

  ],

  "Text & Media": ["LONG_TEXT", "SHORT_TEXT", "VIDEO"],

  "Data Collection": [
    "NUMBER",
    "DATE",
    "FILE_UPLOAD",
    "GOOGLE_DRIVE",
    "CALENDLY",
  ],"Pricing Research": ["GABOR_GRANGER"],


  "Flow & Structure": ["WELCOME", "END_SCREEN", "REDIRECT"],
};
