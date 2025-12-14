// components/questions/QuestionConfigForm.jsx
"use client";
import React, { useState } from "react";
import QUESTION_TYPES from "@/enums/questionTypes";

import PhoneNumberConfig from "./QuestionsConfigComponents/PhoneNumberConfig";
import DefaultConfig from "./QuestionsConfigComponents/DefaultConfig";
import AddressConfig from "./QuestionsConfigComponents/AddressConfig";
import WebsiteConfig from "./QuestionsConfigComponents/WebsiteConfig";
import PictureChoiceConfig from "./QuestionsConfigComponents/PictureChoiceConfig";
import LegalConfig from "./QuestionsConfigComponents/LegalConfig";
import RatingConfig from "./QuestionsConfigComponents/RatingConfig";
import RankingConfig from "./QuestionsConfigComponents/RankingConfig";
import MatrixConfig from "./QuestionsConfigComponents/MatrixConfig";
import TextConfig from "./QuestionsConfigComponents/TextConfig";
import VideoConfig from "./QuestionsConfigComponents/VideoConfig";
import NumberConfig from "./QuestionsConfigComponents/NumberConfig";
import DateConfig from "./QuestionsConfigComponents/DateConfig";
import PaymentConfig from "./QuestionsConfigComponents/PaymentConfig";
import FileUploadConfig from "./QuestionsConfigComponents/FileUploadConfig";
import GoogleDriveConfig from "./QuestionsConfigComponents/GoogleDriveConfig";
import CalendlyConfig from "./QuestionsConfigComponents/CalendlyConfig";
import WelcomeConfig from "./QuestionsConfigComponents/WelcomeConfig";
import SubmitConfig from "./QuestionsConfigComponents/SubmitConfig";
import StatementConfig from "./QuestionsConfigComponents/StatementConfig";
import EndScreenConfig from "./QuestionsConfigComponents/EndScreenConfig";
import RedirectConfig from "./QuestionsConfigComponents/RedirectConfig";
import EmailConfig from "./QuestionsConfigComponents/EmailConfig";
import OptionsConfig from "./QuestionsConfigComponents/OptionsConfig";
import NpsQuestion from "./QuestionsConfigComponents/NPSQuestion";
import OSATConfig from "./QuestionsConfigComponents/OSATConfig";

import MaxDiffConfig from "./QuestionsConfigComponents/MaxDiffConfig";
import ConjointConfig from "./QuestionsConfigComponents/ConjointConfig";
import PriceSensitivityConfig from "./QuestionsConfigComponents/PriceSensitivityConfig";
import SemanticDiffConfig from "./QuestionsConfigComponents/SemanticDiffConfig";
import GaborGrangerConfig from "./QuestionsConfigComponents/GaborGrangerConfig";
import SliderConfig from "./QuestionsConfigComponents/SliderConfig";
import TurfProConfig from "./QuestionsConfigComponents/TurfConfig";
import BayesAcqConfig from "./QuestionsConfigComponents/BayesAcqConfig";
import WeightedMultiConfig from "./QuestionsConfigComponents/WeightedMultiConfig";
import LikertConfig from "./QuestionsConfigComponents/LikertConfig";
import SmileyRatingConfig from "./QuestionsConfigComponents/SmileyRatingConfig";
import ImageClickRatingConfig from "./QuestionsConfigComponents/ImageClickRatingConfig";
import TableGridConfig from "./QuestionsConfigComponents/TableGridConfig";
import MatrixRatingConfig from "./QuestionsConfigComponents/MatrixRatingConfig";
import SideBySideConfig from "./QuestionsConfigComponents/SideBySideConfig";
import ComparisonGridConfig from "./QuestionsConfigComponents/ComparisonGridConfig";
import MultiGridConfig from "./QuestionsConfigComponents/MultiGridConfig";
import SegmentationSelectorConfig from "./QuestionsConfigComponents/SegmentationSelectorConfig";
import PersonaQuizConfig from "./QuestionsConfigComponents/PersonaQuizConfig";
import MonadicConfig from "./QuestionsConfigComponents/MonadicConfig";
import SequentialMonadicConfig from "./QuestionsConfigComponents/SequentialMonadicConfig";
import ForcedExposureConfig from "./QuestionsConfigComponents/ForcedExposureConfig";

export default function QuestionConfigForm({
  type,
  config = {},
  updateConfig,
  surveyId = null, // pass from QuestionEditorPanel
  orgId = null, // pass from QuestionEditorPanel
  questionId = null, // pass if available
}) {
  const componentsMap = {
    [QUESTION_TYPES.CONTACT_EMAIL]: (
      <EmailConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.CONTACT_PHONE]: (
      <PhoneNumberConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.WEIGHTED_MULTI]: (
      <WeightedMultiConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.LIKERT]: (
      <LikertConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.SMILEY_RATING]: (
      <SmileyRatingConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.IMAGE_CLICK_RATING]: (
      <ImageClickRatingConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.BAYES_ACQ]: (
      <BayesAcqConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.SIDE_BY_SIDE]: (
      <SideBySideConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.COMPARISON_GRID]: (
      <ComparisonGridConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.TABLE_GRID]: (
      <TableGridConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.MATRIX_RATING]: (
      <MatrixRatingConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.TURF]: (
      <TurfProConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.CONTACT_ADDRESS]: (
      <AddressConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.CONTACT_WEBSITE]: (
      <WebsiteConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.MULTIPLE_CHOICE]: (
      <OptionsConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.DROPDOWN]: (
      <OptionsConfig
        config={config}
        updateConfig={updateConfig}
        type="dropdown"
      />
    ),
    [QUESTION_TYPES.SLIDER]: (
      <SliderConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.CHECKBOX]: (
      <OptionsConfig
        config={config}
        updateConfig={updateConfig}
        type="checkbox"
      />
    ),
    [QUESTION_TYPES.YES_NO]: (
      <p className="dark:bg-[#1A1A1E] dark:text-[#96949C]">
        No extra config required (Yes/No).
      </p>
    ),
    [QUESTION_TYPES.SEGMENTATION_SELECTOR]: (
      <SegmentationSelectorConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.MONADIC_TEST]: (
      <MonadicConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.SEQUENTIAL_MONADIC]: (
      <SequentialMonadicConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.FORCED_EXPOSURE]: (
      <ForcedExposureConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.PERSONA_QUIZ]: (
      <PersonaQuizConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.PICTURE_CHOICE]: (
      <PictureChoiceConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.LEGAL]: (
      <LegalConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.NPS]: (
      <NpsQuestion config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.OSAT]: (
      <OSATConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.OPINION_SCALE]: (
      <RatingConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.RATING]: (
      <RatingConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.RANKING]: (
      <RankingConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.MATRIX]: (
      <MatrixConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.SHORT_TEXT]: (
      <TextConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.LONG_TEXT]: (
      <TextConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.VIDEO]: (
      <VideoConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.AI_CLARIFY]: (
      <p className="dark:bg-[#1A1A1E] dark:text-[#96949C]">
        No additional config needed for AI.
      </p>
    ),
    [QUESTION_TYPES.NUMBER]: (
      <NumberConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.DATE]: (
      <DateConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.PAYMENT]: (
      <PaymentConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.FILE_UPLOAD]: (
      <FileUploadConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.GOOGLE_DRIVE]: (
      <GoogleDriveConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.CALENDLY]: (
      <CalendlyConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.WELCOME]: (
      <WelcomeConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.PARTIAL_SUBMIT]: (
      <SubmitConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.STATEMENT]: (
      <StatementConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.END_SCREEN]: (
      <EndScreenConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.REDIRECT]: (
      <RedirectConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.QUESTION_GROUP]: (
      <p className="dark:bg-[#1A1A1E] dark:text-[#96949C]">
        Configure question grouping on survey designer.
      </p>
    ),
    [QUESTION_TYPES.MULTI_QUESTION_PAGE]: (
      <p className="dark:bg-[#1A1A1E] dark:text-[#96949C]">
        Configure question grouping on survey designer.
      </p>
    ),
    [QUESTION_TYPES.MULTI_GRID]: (
      <MultiGridConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.MAXDIFF]: (
      <MaxDiffConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.CONJOINT]: (
      <ConjointConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.PRICE_SENSITIVITY]: (
      <PriceSensitivityConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.SEMANTIC_DIFF]: (
      <SemanticDiffConfig config={config} updateConfig={updateConfig} />
    ),
    [QUESTION_TYPES.GABOR_GRANGER]: (
      <GaborGrangerConfig config={config} updateConfig={updateConfig} />
    ),
  };

  const Specific = componentsMap[type] || <DefaultConfig />;

  return (
    <div className="space-y-4 p-3">
      {/* Global required toggle for ALL question types */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            id="q_required"
            type="checkbox"
            checked={Boolean(config?.required)}
            onChange={(e) => updateConfig("required", e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="q_required" className="text-sm dark:text-[#96949C]">
            Required question
          </label>
        </div>

        <div className="text-xs text-gray-400">
          Prevents next/submit until answered
        </div>
      </div>

      <div>{Specific}</div>
    </div>
  );
}
