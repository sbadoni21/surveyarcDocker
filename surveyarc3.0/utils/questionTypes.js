import { CiGlobe } from "react-icons/ci";
import { BiLike } from "react-icons/bi";
import { FiImage, FiMapPin } from "react-icons/fi";
import { MdMailOutline, MdOutlineLocalPhone } from "react-icons/md";
import { Icon } from "@iconify/react";
import { IoCaretDown } from "react-icons/io5";

export const ICONS_MAP = {
  // Contact Information
  CONTACT_EMAIL: <MdMailOutline className="text-[#CD7323]" size={22} />,
  CONTACT_PHONE: <MdOutlineLocalPhone className="text-[#CD7323]" size={22} />,
  CONTACT_ADDRESS: <FiMapPin className="text-[#CD7323]" size={22} />,
  CONTACT_WEBSITE: <CiGlobe className="text-[#CD7323]" size={22} />,

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
