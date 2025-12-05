import { CiGlobe } from "react-icons/ci";
import { BiLike } from "react-icons/bi";
import { FiImage, FiMapPin } from "react-icons/fi";
import { MdMailOutline, MdOutlineLocalPhone } from "react-icons/md";
import { Icon } from "@iconify/react";
import { IoCaretDown } from "react-icons/io5";

export const ICONS_MAP = {
  // Contact Information
    MONADIC_TEST: (
    <Icon
      color="#4B4187"
      icon="mdi:test-tube"
      width="22"
      height="22"
    />
  ),
  FORCED_EXPOSURE: (
    <Icon
      color="#4B4187"
      icon="mdi:exposure-plus-1"
      width="22"
      height="22"
    />
  ),
  SEQUENTIAL_MONADIC: (
    <Icon
      color="#4B4187"
      icon="mdi:test-tube-empty"
      width="22"
      height="22"
    />
  ),
    BAYES_ACQ: (
    <Icon color="#35667D" icon="mdi:chart-bell-curve-cumulative" width="22" height="22" />
  ),LIKERT: (
  <Icon color="#9F2929" icon="mdi:format-list-bulleted" width="22" height="22" />
),
SEGMENTATION_SELECTOR: (
  <Icon color="#9F2929" icon="mdi:shape-plus" width="22" height="22" />
),
PERSONA_QUIZ: (
  <Icon
    color="#4B4187"
    icon="mdi:account-star-outline"
    width="22"
    height="22"
  />
),

SMILEY_RATING: (
  <Icon color="#FFA000" icon="mdi:emoticon-happy-outline" width="22" height="22" />
),
IMAGE_CLICK_RATING: (
  <Icon color="#4B4187" icon="mdi:image-filter-center-focus" width="22" height="22" />
),
TABLE_GRID:(
  <Icon color="#4B4187" icon="mdi:table" width="22" height="22" />
),
MULTI_GRID:(
  <Icon color="#4B4187" icon="mdi:table-multiple" width="22" height="22" />
),
MATRIX_RATING:(
  <Icon color="#4B4187" icon="mdi:table-multiple" width="22" height="22" />
),
  SIDE_BY_SIDE: (
    <Icon color="#9F2929" icon="mdi:table-merge-cells" width="22" height="22" />
  ),
  COMPARISON_GRID: (
    <Icon color="#9F2929" icon="mdi:table-eye" width="22" height="22" />
  ),
  CONTACT_EMAIL: <MdMailOutline className="text-[#CD7323]" size={22} />,
  CONTACT_PHONE: <MdOutlineLocalPhone className="text-[#CD7323]" size={22} />,
  CONTACT_ADDRESS: <FiMapPin className="text-[#CD7323]" size={22} />,
  CONTACT_WEBSITE: <CiGlobe className="text-[#CD7323]" size={22} />,
  GABOR_GRANGER: (
  <Icon color="#9F2929" icon="mdi:cash-check" width="22" height="22" />
),
WEIGHTED_MULTI: (
  <Icon
    color="#9F2929"
    icon="mdi:weight"
    width="22"
    height="22"
  />
),

  PRICE_SENSITIVITY: (
    <Icon
      color="#9F2929"
      icon="mdi:currency-inr"
      width="22"
      height="22"
    />
  ),

  MULTIPLE_CHOICE: (
    <Icon color="#35667D" icon="bi:list-ol" width="22" height="22" />
  ),
  DROPDOWN: <IoCaretDown color="#35667D" size={22} />,
  PICTURE_CHOICE: <FiImage color="#35667D" size={22} />,
  YES_NO: <BiLike color="#35667D" size={22} />,
  LEGAL: (
    <Icon color="#35667D" icon="hugeicons:legal-01" width="22" height="22" />
  ),
  CHECKBOX: (
    <Icon color="#35667D" icon="ic:outline-check-box" width="22" height="22" />
  ),

  NPS: (
    <Icon
      color="#9F2929"
      icon="material-symbols:timer-10-rounded"
      width="22"
      height="22"
    />
  ),
  OSAT: (
    <Icon
      color="#9F2929"
      icon="material-symbols:star-outline-rounded"
      width="22"
      height="22"
    />
  ),  MAXDIFF: (
    <Icon
      color="#9F2929"
      icon="mdi:compare-horizontal"
      width="22"
      height="22"
    />
  ),
    SEMANTIC_DIFF: (
    <Icon
      color="#9F2929"
      icon="material-symbols:align-horizontal-center"
      width="22"
      height="22"
    />
  ),

  CONJOINT: (
    <Icon
      color="#9F2929"
      icon="mdi:view-grid-plus-outline"
      width="22"
      height="22"
    />
  ),
  OPINION_SCALE: (
    <Icon
      color="#9F2929"
      icon="material-symbols-light:scale-outline-rounded"
      width="22"
      height="22"
    />
  ),
  RATING: (
    <Icon
      color="#9F2929"
      icon="material-symbols:star-outline-rounded"
      width="22"
      height="22"
    />
  ),
  RANKING: <Icon color="#9F2929" icon="ph:ranking" width="22" height="22" />,
  MATRIX: <Icon color="#9F2929" icon="tabler:matrix" width="22" height="22" />,

  LONG_TEXT: (
    <Icon color="#378456" icon="majesticons:text-line" width="22" height="22" />
  ),
  SHORT_TEXT: (
    <Icon color="#378456" icon="uim:paragraph" width="22" height="22" />
  ),
  VIDEO: (
    <Icon color="#378456" icon="mdi:video-outline" width="22" height="22" />
  ),
  AI_CLARIFY: (
    <Icon color="#378456" icon="mingcute:ai-line" width="22" height="22" />
  ),

  NUMBER: <Icon color="#71843F" icon="tabler:hash" width="22" height="22" />,
  DATE: (
    <Icon color="#71843F" icon="proicons:calendar" width="22" height="22" />
  ),
  GABOR_GRANGER: (
    <Icon color="#9F2929" icon="mdi:cash-check" width="22" height="22" />
  ),

  FILE_UPLOAD: (
    <Icon
      color="#71843F"
      icon="material-symbols:upload"
      width="22"
      height="22"
    />
  ),
  GOOGLE_DRIVE: (
    <Icon color="#71843F" icon="mingcute:drive-line" width="22" height="22" />
  ),
  CALENDLY: (
    <Icon color="#71843F" icon="simple-icons:calendly" width="22" height="22" />
  ),

  WELCOME_SCREEN: (
    <Icon color="#4B4187" icon="mingcute:hand-line" width="22" height="22" />
  ),
  END_SCREEN: (
    <Icon
      color="#4B4187"
      icon="lucide:gallery-horizontal-end"
      width="22"
      height="22"
    />
  ),
  REDIRECT_URL: (
    <Icon
      color="#4B4187"
      icon="streamline-sharp:link-share-2-remix"
      width="20"
      height="20"
    />
  ),
};
