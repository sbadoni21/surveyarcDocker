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
 [QUESTION_TYPES.SEMANTIC_DIFF]: {
    scaleMin: 1,
    scaleMax: 7,
    showNumbers: true,
    items: [
      { id: "sd1", left: "Unreliable", right: "Very reliable" },
      { id: "sd2", left: "Difficult to use", right: "Easy to use" },
      { id: "sd3", left: "Low value", right: "High value" },
    ],
  },  [QUESTION_TYPES.GABOR_GRANGER]: {
    currencySymbol: "₹",
    productName: "",
    pricePoints: [99, 149, 199, 249],
    scaleMode: "likert", // 'likert' | 'binary'
    likertOptions: [
      "Definitely would buy",
      "Probably would buy",
      "Might or might not buy",
      "Probably would not buy",
      "Definitely would not buy",
    ],
    yesLabel: "Yes",
    noLabel: "No",
  },

  [QUESTION_TYPES.SLIDER]: {
    min: 0,
    max: 100,
    step: 1,
    prefix: "",          // e.g. "₹"
    suffix: "",          // e.g. "%"
    startValue: 50,
    showValue: true,
    showTicks: true,
    snapToAnchors: true,
    anchors: [
      { value: 0, label: "Very unlikely" },
      { value: 25, label: "Unlikely" },
      { value: 50, label: "Neutral" },
      { value: 75, label: "Likely" },
      { value: 100, label: "Very likely" },
    ],
  },[QUESTION_TYPES.WEIGHTED_MULTI]: {
  // Each option can have its own min/max + lock
  options: [
    { id: "opt_1", label: "Feature A", description: "", min: 0, max: 10, locked: false },
    { id: "opt_2", label: "Feature B", description: "", min: 0, max: 10, locked: false },
    { id: "opt_3", label: "Feature C", description: "", min: 0, max: 10, locked: false },
  ],

  weightType: "slider",          // slider | textbox | scale
  minWeight: 0,
  maxWeight: 10,

  // Global total cap
  totalLimitEnabled: true,
  totalMax: 100,

  showRemainingBar: true,
  showTotal: true,

  allowZero: true,

  // Validation-ish
  requireMinAssigned: 1,         // at least N options with > 0 weight
  requireNonZeroTotal: false,    // total must be > 0

  // Optional normalization (e.g., normalize to 100 at submit time – you can use it in submit handler)
  normalizeToTotal: false,
},
[QUESTION_TYPES.LIKERT]: {
  labels: [
    "Strongly Disagree",
    "Disagree",
    "Neutral",
    "Agree",
    "Strongly Agree"
  ],
  scale: 5,
  randomize: false,
},

[QUESTION_TYPES.SMILEY_RATING]: {
  emojis: ["😡", "☹️", "😐", "🙂", "😍"],
  labels: ["Terrible", "Bad", "Okay", "Good", "Excellent"],
  highlightColor: "#ff9800",
},
  [QUESTION_TYPES.TABLE_GRID]: {
    rows: [
      "Ease of use",
      "Speed of the tool",
      "Quality of insights",
      "Customer support",
    ],
    columns: [
      "Very poor",
      "Poor",
      "Average",
      "Good",
      "Excellent",
    ],
    randomizeRows: false,
    randomizeColumns: false,
    showRowNumbers: false,
    layout: "comfortable", // "comfortable" | "compact"
  },

  [QUESTION_TYPES.MULTI_GRID]: {
    rows: ["Feature A", "Feature B", "Feature C"],
    columns: ["Very important", "Important", "Neutral", "Not important"],
    randomizeRows: false,
    randomizeColumns: false,
    minSelectionsPerRow: 0,
    maxSelectionsPerRow: null, // no limit
    requireAllRows: false,     // if true, user must answer each row
    showRowNumbers: false,
    layout: "comfortable",     // "comfortable" | "compact"
  }, [QUESTION_TYPES.MATRIX_RATING]: {
    rows: ["Service Quality", "Product Quality", "Price", "Support"],
    columns: ["Brand A", "Brand B", "Brand C"],
    scaleMin: 1,
    scaleMax: 5,
    lowLabel: "Very Poor",
    highLabel: "Excellent",
    neutralLabel: "Average",
    colorMode: "diverging", // "mono" | "diverging"
    showNumbers: true,      // show numeric value inside circles
    randomizeRows: false,
    randomizeColumns: false,
    requireAllCells: false, // every cell must be rated
    requireAllRows: false,  // at least one rating per row
    layout: "comfortable",  // "comfortable" | "compact"
  },
  [QUESTION_TYPES.SIDE_BY_SIDE]: {
    leftLabel: "Concept A",
    rightLabel: "Concept B",

    attributes: [
      "Overall appeal",
      "Clarity of message",
      "Uniqueness",
      "Fit with brand",
    ],

    mode: "preference_and_rate", // "preference_only" | "rate_both" | "preference_and_rate"

    scaleMin: 1,
    scaleMax: 5,
    leftBiasLabel: "Much better for left",
    rightBiasLabel: "Much better for right",
    neutralLabel: "About the same",

    showTieOption: true,
    randomizeRowOrder: false,
    randomizeLeftRight: false, // flip A/B per respondent

    showAttributeCodes: false,
  },

  [QUESTION_TYPES.COMPARISON_GRID]: {
    attributes: [
      "Ease of use",
      "Features",
      "Value for money",
      "Customer support",
    ],
    brands: ["Brand A", "Brand B", "Brand C"],

    maxSelectionsPerRow: 1, // 1 = winner-per-row; >1 = allow ties
    allowTies: false,
    includeNone: true,
    noneLabel: "None of these",

    randomizeAttributes: false,
    randomizeBrands: false,

    requireSelectionEachRow: true,
    layout: "comfortable", // "comfortable" | "compact"
  },[QUESTION_TYPES.PERSONA_QUIZ]: {
    personas: [
      {
        id: "analytical_achiever",
        label: "Analytical Achiever",
        description: "Data-driven, detail-focused and goal oriented.",
        color: "#2563eb",
      },
      {
        id: "creative_explorer",
        label: "Creative Explorer",
        description: "Loves new ideas, aesthetics and experimentation.",
        color: "#f97316",
      },
      {
        id: "value_seeker",
        label: "Value Seeker",
        description: "Pragmatic, budget-conscious and ROI focused.",
        color: "#16a34a",
      },
    ],
    items: [
      {
        id: "decision_style",
        text: "When choosing a product like this, what matters most to you?",
        options: [
          {
            id: "opt_data",
            label: "In-depth specs and performance data",
            weights: {
              analytical_achiever: 3,
              creative_explorer: 0,
              value_seeker: 1,
            },
          },
          {
            id: "opt_design",
            label: "Design, aesthetics and how it feels",
            weights: {
              analytical_achiever: 0,
              creative_explorer: 3,
              value_seeker: 1,
            },
          },
          {
            id: "opt_price",
            label: "Price vs benefits – best value",
            weights: {
              analytical_achiever: 1,
              creative_explorer: 0,
              value_seeker: 3,
            },
          },
        ],
      },
    ],
    resultSettings: {
      showTopN: 1,            // top persona only
      tieBreak: "first",      // "first" | "random" | "multi"
      showScores: true,       // show persona score bars
      resultTitle: "Your persona",
      resultSubtitle: "Based on your answers, you most closely match:",
    },
  }, [QUESTION_TYPES.SEQUENTIAL_MONADIC]: {
    sequenceMode: "random_subset", // "fixed" | "random" | "random_subset"
    maxConceptsPerRespondent: 3,
    showProgressBar: true,
    showConceptIndex: true,
    persistSequenceInSession: true, // for future backend usage

    concepts: [
      {
        id: "c1",
        name: "Concept A",
        description: "Base concept description.",
        imageUrl: "",
        price: "",
        tag: "Base",
      },
      {
        id: "c2",
        name: "Concept B",
        description: "Variant concept description.",
        imageUrl: "",
        price: "",
        tag: "Variant",
      },
      {
        id: "c3",
        name: "Concept C",
        description: "",
        imageUrl: "",
        price: "",
        tag: "",
      },
    ],

    metrics: [
      {
        id: "pi",
        label: "Purchase intent",
        type: "likert", // "likert" | "star" | "slider"
        min: 1,
        max: 5,
        leftLabel: "Definitely would not buy",
        rightLabel: "Definitely would buy",
      },
      {
        id: "appeal",
        label: "Overall appeal",
        type: "star",
        min: 1,
        max: 5,
        leftLabel: "",
        rightLabel: "",
      },
    ],

    showOpenEndedPerConcept: true,
    openEndedLabel: "What did you like or dislike about this concept?",

    showSummaryScreen: true,
    summaryQuestionLabel:
      "Now that you’ve seen all concepts, which one do you prefer overall?",
    summaryMetricId: "overall_choice",
  },
[QUESTION_TYPES.FORCED_EXPOSURE]: {
    title: "Please read this information carefully",
    body: "You must review the following information before continuing.",
    contentType: "text", // "text" | "video" | "embed" | "image"
    imageUrl: "",
    videoUrl: "",
    embedUrl: "",

    minExposureSeconds: 10,
    showCountdown: true,
    showProgressBar: true,

    requireScrollToEnd: true,
    scrollBlockingHeight: 320, // px for the scrollable area

    allowEarlyExitWithReason: false,
    earlyExitLabel: "I cannot view this content",
    earlyExitRequiredReason: true,

    showSystemHint: true,
    systemHint:
      "You’ll be able to continue once you’ve viewed the full content and the timer finishes.",

    analyticsTag: "forced_exposure_1",
  },
[QUESTION_TYPES.MONADIC_TEST]: {
    allocationMode: "simple_random", // "simple_random" | "weighted" | "quota"
    persistConceptInSession: true,
    concepts: [
      {
        id: "c1",
        name: "Concept A",
        description: "Short concept description.",
        imageUrl: "",
        price: "",
        tag: "Base",
        weight: 1,
        isControl: false,
      },
      {
        id: "c2",
        name: "Concept B",
        description: "Another concept description.",
        imageUrl: "",
        price: "",
        tag: "Variant",
        weight: 1,
        isControl: false,
      },
    ],
    metrics: [
      {
        id: "pi",
        label: "Purchase intent",
        type: "likert", // "likert" | "star" | "slider"
        min: 1,
        max: 5,
        leftLabel: "Definitely would not buy",
        rightLabel: "Definitely would buy",
      },
      {
        id: "uniq",
        label: "Uniqueness",
        type: "likert",
        min: 1,
        max: 5,
        leftLabel: "Not at all unique",
        rightLabel: "Very unique",
      },
    ],
    showOpenEnded: true,
    openEndedLabel: "What did you like or dislike about this concept?",
  },
  [QUESTION_TYPES.SEGMENTATION_SELECTOR]: {
    mode: "single", // 'single' | 'multi'
    minSelect: 1,
    maxSelect: 1,
    randomizeOrder: false,
    showDescriptions: true,
    showIcons: true,
    showCodes: false,
    segments: [
      {
        id: "SEG_VALUE",
        code: "VAL",
        label: "Value Seekers",
        description: "Highly price-sensitive, always hunting for deals.",
        icon: "💸",
        colorTag: "#F97316",
      },
      {
        id: "SEG_PREMIUM",
        code: "PRM",
        label: "Premium Enthusiasts",
        description: "Pay more for quality, design and experience.",
        icon: "👑",
        colorTag: "#6366F1",
      },
      {
        id: "SEG_CONVENIENCE",
        code: "CNV",
        label: "Convenience First",
        description: "Want fastest, easiest solution, minimal effort.",
        icon: "⚡",
        colorTag: "#22C55E",
      },
    ],
  },
[QUESTION_TYPES.IMAGE_CLICK_RATING]: {
  images: [], // [{url:"", label:"", score: 1-5}]
  showScoreBar: true,
  maxScore: 5,
},

 [QUESTION_TYPES.BAYES_ACQ]: {
    items: [
      { id: "feat_long_battery", label: "Long battery life" },
      { id: "feat_fast_charging", label: "Fast charging" },
      { id: "feat_lightweight", label: "Lightweight design" },
      { id: "feat_durable", label: "Strong durability" },
    ],
    choiceSetSize: 3,
    rounds: 5,
    algorithm: "bayesian_thompson", // placeholder; actual math can live backend
  },

  [QUESTION_TYPES.CALENDLY]: {
    calendlyUrl: "",
  },
  [QUESTION_TYPES.MAXDIFF]: {
    items: ["Option 1", "Option 2", "Option 3", "Option 4"],
    setSize: 4,        // how many options per screen
    numSets: 4,        // how many screens
    randomize: true,
  },  [QUESTION_TYPES.PRICE_SENSITIVITY]: {
    currency: "₹",
    tooCheapLabel: "Too cheap",
    cheapLabel: "Cheap / good value",
    expensiveLabel: "Expensive but still acceptable",
    tooExpensiveLabel: "Too expensive",
    min: 0,
    max: null,  // no hard max by default
    step: 1,
    showHelperText: true,
  },


  [QUESTION_TYPES.CONJOINT]: {
    attributes: [
      { name: "Attribute 1", levels: ["Level 1", "Level 2"] },
      { name: "Attribute 2", levels: ["Level 1", "Level 2"] },
    ],
    cardsPerTask: 3,   // A/B/C choice comparison
    tasksCount: 4,     // how many screens
    randomize: true,
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
