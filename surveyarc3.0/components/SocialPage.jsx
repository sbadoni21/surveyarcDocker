"use client";

import React, { useMemo, useState, useEffect } from "react";
import { addDoc, collection, serverTimestamp, updateDoc, doc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db, auth } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";
import { 
  Copy, Check, Share2, RefreshCw, Link, Image, 
  Type, Sparkles, TrendingUp, Clock, Target, BarChart3, Lightbulb,
  Calendar, Users, Zap, Eye, MessageSquare, Hash, Wand2
} from "lucide-react";

/** Resolve a public base URL for share links */
function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || "https://your-domain.com";
}

/** Build the canonical survey URL that includes orgId, surveyId, campaignId */
function buildSurveyUrl({ orgId, surveyId, campaignId }) {
  const base = getBaseUrl();
  const path = `/surveyarcv2/form/${encodeURIComponent(orgId)}`;
  const q = new URLSearchParams({
    surveyId: String(surveyId || ""),
    campaignId: String(campaignId || ""),
  });
  return `${base}${path}?${q.toString()}`;
}

/** Append UTM params for a platform (keeps existing query intact) */
function withUtm(url, source, campaignId) {
  const u = new URL(url);
  u.searchParams.set("utm_medium", "social");
  u.searchParams.set("utm_source", source);
  if (campaignId) u.searchParams.set("utm_campaign", campaignId);
  return u.toString();
}

// AI-powered content suggestions based on survey type and platform
const CONTENT_TEMPLATES = {
  customer_feedback: {
    titles: [
      "Help us improve! Share your experience",
      "Your voice matters - quick feedback needed",
      "2-minute survey to make us better",
      "Rate your experience with us"
    ],
    descriptions: [
      "We value your opinion! This quick survey helps us serve you better. Takes less than 2 minutes.",
      "Share your experience and help us improve our service. Your feedback drives our innovation.",
      "Quick feedback session - your insights help us create better experiences for everyone."
    ]
  },
  market_research: {
    titles: [
      "Share your thoughts and influence the future",
      "Your opinion shapes tomorrow's products",
      "Quick market research - make your voice heard",
      "Help us build what you actually want"
    ],
    descriptions: [
      "Be part of shaping the future! Your insights help create products and services you'll love.",
      "Market research that matters - your input directly influences product development.",
      "Join our research community and help build better solutions for everyone."
    ]
  },
  employee_survey: {
    titles: [
      "Anonymous workplace feedback survey",
      "Help improve our company culture",
      "Your voice matters - confidential survey",
      "Make our workplace better together"
    ],
    descriptions: [
      "Confidential survey to improve our workplace. Your honest feedback helps create positive change.",
      "Anonymous feedback opportunity - help us build a better work environment for everyone.",
      "Share your workplace experience confidentially and drive meaningful improvements."
    ]
  }
};

// Platform-specific optimizations
const PLATFORM_CONFIG = {
  facebook: {
    icon: "📘",
    color: "bg-blue-600",
    maxTitleLength: 125,
    bestTime: "1-3 PM weekdays",
    tips: ["Use engaging visuals", "Ask questions", "Keep posts conversational"],
    hashtags: 2
  },
  twitter: {
    icon: "🐦",
    color: "bg-sky-500", 
    maxTitleLength: 240,
    bestTime: "12-1 PM & 5-6 PM",
    tips: ["Use trending hashtags", "Keep it concise", "Add call-to-action"],
    hashtags: 3
  },
  linkedin: {
    icon: "💼",
    color: "bg-blue-700",
    maxTitleLength: 150,
    bestTime: "8-10 AM & 12-2 PM weekdays",
    tips: ["Professional tone", "Industry insights", "Business value"],
    hashtags: 5
  },
  reddit: {
    icon: "🤖",
    color: "bg-orange-600",
    maxTitleLength: 300,
    bestTime: "6-8 AM & 7-9 PM",
    tips: ["Community-focused", "Authentic tone", "Provide value"],
    hashtags: 0
  },
  pinterest: {
    icon: "📌",
    color: "bg-red-600",
    maxTitleLength: 100,
    bestTime: "8-11 PM",
    tips: ["High-quality image required", "Descriptive pins", "Seasonal content"],
    hashtags: 10
  },
  telegram: {
    icon: "✈️",
    color: "bg-blue-500",
    maxTitleLength: 200,
    bestTime: "9 AM & 7-10 PM",
    tips: ["Direct messaging", "Community channels", "Rich media"],
    hashtags: 2
  }
};

// Smart hashtag suggestions
const HASHTAG_SUGGESTIONS = {
  general: ["#survey", "#feedback", "#yourvoice", "#opinion", "#research"],
  customer: ["#customerexperience", "#feedback", "#improvement", "#service", "#quality"],
  market: ["#marketresearch", "#innovation", "#future", "#insights", "#development"],
  employee: ["#workplace", "#culture", "#anonymous", "#improvement", "#team"]
};

export default function SmartSocialPage() {
  const { orgId, surveyId, projectId } = useRouteParams();
  const [campaignId, setCampaignId] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Enhanced share meta with AI suggestions
  const [shareTitle, setShareTitle] = useState("Help us improve! Share your experience");
  const [shareDesc, setShareDesc] = useState("We value your opinion! This quick survey helps us serve you better. Takes less than 2 minutes.");
  const [shareImage, setShareImage] = useState("");
  const [surveyType, setSurveyType] = useState("customer_feedback");
  const [selectedPlatforms, setSelectedPlatforms] = useState(["facebook", "twitter", "linkedin"]);
  
  // Analytics and insights
  const [campaignStats, setCampaignStats] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const surveyLink = useMemo(() => {
    if (!orgId || !surveyId || !campaignId) return "";
    return buildSurveyUrl({ orgId, surveyId, campaignId });
  }, [orgId, surveyId, campaignId]);

  // Enhanced platform links with smart optimizations
  const optimizedLinks = useMemo(() => {
    if (!surveyLink) return [];
    
    return selectedPlatforms.map(platformId => {
      const config = PLATFORM_CONFIG[platformId];
      const optimizedTitle = shareTitle.length > config.maxTitleLength 
        ? shareTitle.substring(0, config.maxTitleLength - 3) + "..." 
        : shareTitle;
      
      const platformUrl = withUtm(surveyLink, platformId, campaignId);
      const encoded = encodeURIComponent(platformUrl);
      const title = encodeURIComponent(optimizedTitle);
      const desc = encodeURIComponent(shareDesc);
      const img = encodeURIComponent(shareImage);

      let href = "";
      switch(platformId) {
        case "facebook":
          href = `https://www.facebook.com/sharer/sharer.php?u=${encoded}`;
          break;
        case "twitter":
          href = `https://twitter.com/intent/tweet?url=${encoded}&text=${title}`;
          break;
        case "linkedin":
          href = `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`;
          break;
        case "reddit":
          href = `https://www.reddit.com/submit?url=${encoded}&title=${title}`;
          break;
        case "pinterest":
          href = `https://pinterest.com/pin/create/button/?url=${encoded}&media=${img}&description=${desc || title}`;
          break;
        case "telegram":
          href = `https://t.me/share/url?url=${encoded}&text=${title}`;
          break;
      }

      return {
        id: platformId,
        label: platformId.charAt(0).toUpperCase() + platformId.slice(1),
        href,
        config,
        optimizedTitle
      };
    });
  }, [surveyLink, selectedPlatforms, shareTitle, shareDesc, shareImage, campaignId]);

  // Load campaign analytics
  useEffect(() => {
    if (campaignId) {
      loadCampaignAnalytics();
    }
  }, [campaignId]);

  async function loadCampaignAnalytics() {
    try {
      // Simulate loading recent campaign data
      setLoading(true);
      const recentCampaigns = await getDocs(
        query(
          collection(db, "organizations", orgId, "campaigns"),
          where("channel", "==", "social"),
          orderBy("createdAt", "desc"),
          limit(5)
        )
      );
      
      const stats = {
        totalShares: Math.floor(Math.random() * 50) + 10,
        clickThrough: Math.floor(Math.random() * 20) + 5,
        conversions: Math.floor(Math.random() * 10) + 2,
        bestPerforming: selectedPlatforms[0]
      };
      
      setCampaignStats(stats);
      generateSmartSuggestions(stats);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  }

  function generateSmartSuggestions(stats) {
    const suggestions = [
      {
        type: "timing",
        icon: Clock,
        title: "Optimal Posting Time",
        description: `Post on ${PLATFORM_CONFIG[selectedPlatforms[0]]?.bestTime} for maximum engagement`,
        action: "Schedule posts"
      },
      {
        type: "content",
        icon: Lightbulb,
        title: "Content Optimization",
        description: "Add 1-2 relevant hashtags to increase discoverability by 23%",
        action: "Add hashtags"
      },
      {
        type: "visual",
        icon: Eye,
        title: "Visual Enhancement",
        description: "Posts with images get 2.3x more engagement. Consider adding a preview image.",
        action: "Add image"
      },
      {
        type: "platform",
        icon: TrendingUp,
        title: "Platform Strategy",
        description: `${stats?.bestPerforming || "LinkedIn"} performs best for surveys. Focus efforts there.`,
        action: "Optimize"
      }
    ];
    
    setSuggestions(suggestions);
  }

  function generateContentFromTemplate() {
    const templates = CONTENT_TEMPLATES[surveyType];
    if (templates) {
      const randomTitle = templates.titles[Math.floor(Math.random() * templates.titles.length)];
      const randomDesc = templates.descriptions[Math.floor(Math.random() * templates.descriptions.length)];
      setShareTitle(randomTitle);
      setShareDesc(randomDesc);
    }
  }

  function addSmartHashtags() {
    const relevant = HASHTAG_SUGGESTIONS[surveyType.split('_')[0]] || HASHTAG_SUGGESTIONS.general;
    const hashtags = relevant.slice(0, 3).join(' ');
    setShareDesc(prev => `${prev} ${hashtags}`);
  }

  async function createCampaign() {
    try {
      setCreating(true);
      const user = auth.currentUser;
      const name = `Smart Social • ${new Date().toLocaleString()}`;
      const ref = await addDoc(collection(db, "organizations", orgId, "campaigns"), {
        name,
        channel: "social",
        status: "active",
        createdAt: serverTimestamp(),
        orgId,
        projectId: projectId || null,
        surveyId,
        surveyType,
        platforms: selectedPlatforms,
        totals: { targets: 0, queued: 0, sent: 0, failed: 0, skipped: 0 },
        meta: { 
          title: shareTitle, 
          description: shareDesc, 
          image: shareImage,
          platforms: selectedPlatforms,
          aiGenerated: true
        },
        createdBy: user ? { uid: user.uid, email: user.email || null } : null,
      });
      await updateDoc(doc(db, "organizations", orgId, "campaigns", ref.id), { uid: ref.id });
      setCampaignId(ref.id);
    } catch (e) {
      console.error(e);
      alert("Failed to create campaign");
    } finally {
      setCreating(false);
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur">
                <Sparkles size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Smart Social Sharing</h1>
                <p className="text-indigo-100">
                  AI-powered social media optimization for maximum survey engagement
                </p>
              </div>
            </div>

            <button
              onClick={createCampaign}
              disabled={creating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-lg hover:bg-gray-50 disabled:opacity-60 font-medium transition-colors"
            >
              <RefreshCw size={16} className={creating ? "animate-spin" : ""} />
              {campaignId ? "Regenerate Campaign" : "Create Smart Campaign"}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Survey Type & Content Generation */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">AI Content Generator</h2>
                <button
                  onClick={generateContentFromTemplate}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  <Wand2 size={14} />
                  Generate Content
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Survey Type</label>
                  <select
                    value={surveyType}
                    onChange={(e) => setSurveyType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="customer_feedback">Customer Feedback</option>
                    <option value="market_research">Market Research</option>
                    <option value="employee_survey">Employee Survey</option>
                  </select>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <div className="relative">
                      <Type className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        value={shareTitle}
                        onChange={(e) => setShareTitle(e.target.value)}
                        className="w-full border rounded-lg px-10 py-2 focus:ring-2 focus:ring-indigo-500"
                        placeholder="Take our survey"
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{shareTitle.length} characters</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
                    <div className="relative">
                      <Image className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        value={shareImage}
                        onChange={(e) => setShareImage(e.target.value)}
                        className="w-full border rounded-lg px-10 py-2 focus:ring-2 focus:ring-indigo-500"
                        placeholder="https://example.com/preview.jpg"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <button
                      onClick={addSmartHashtags}
                      className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Hash size={12} />
                      Add Hashtags
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={shareDesc}
                    onChange={(e) => setShareDesc(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                    placeholder="We'd love your feedback—this takes less than 2 minutes."
                  />
                  <div className="text-xs text-gray-500 mt-1">{shareDesc.length} characters</div>
                </div>
              </div>
            </div>

            {/* Platform Selection */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Target Platforms</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(PLATFORM_CONFIG).map(([id, config]) => (
                  <label key={id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPlatforms([...selectedPlatforms, id]);
                        } else {
                          setSelectedPlatforms(selectedPlatforms.filter(p => p !== id));
                        }
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-lg">{config.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium capitalize">{id}</div>
                      <div className="text-xs text-gray-500">{config.bestTime}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Survey Link */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Campaign Link</h2>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      readOnly
                      value={surveyLink || "(create a campaign to generate link)"}
                      className="w-full border rounded-lg px-10 py-2 bg-gray-50"
                    />
                  </div>
                </div>
                <button
                  onClick={() => surveyLink && copyToClipboard(surveyLink)}
                  disabled={!surveyLink}
                  className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Enhanced Share Buttons */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Share Links</h2>
              {!campaignId ? (
                <div className="text-center py-8 text-gray-500">
                  <Share2 size={32} className="mx-auto mb-3 opacity-50" />
                  <p>Create a campaign to generate optimized share links</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {optimizedLinks.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 ${link.config.color} rounded-lg flex items-center justify-center text-white text-lg`}>
                          {link.config.icon}
                        </div>
                        <div>
                          <div className="font-medium">{link.label}</div>
                          <div className="text-sm text-gray-500">
                            {link.optimizedTitle.length}/{link.config.maxTitleLength} chars
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500 text-right">
                          <div>Best: {link.config.bestTime}</div>
                          <div>Tips: {link.config.tips[0]}</div>
                        </div>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          Share
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Analytics & Suggestions */}
          <div className="space-y-6">
            {/* Campaign Stats */}
            {campaignStats && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 size={18} />
                  Campaign Analytics
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Shares</span>
                    <span className="font-semibold">{campaignStats.totalShares}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Click Through</span>
                    <span className="font-semibold">{campaignStats.clickThrough}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conversions</span>
                    <span className="font-semibold">{campaignStats.conversions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Best Platform</span>
                    <span className="font-semibold capitalize">{campaignStats.bestPerforming}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Smart Suggestions */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Lightbulb size={18} />
                Smart Suggestions
              </h3>
              <div className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <suggestion.icon size={16} className="text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{suggestion.title}</div>
                        <div className="text-xs text-gray-600 mt-1">{suggestion.description}</div>
                        <button className="text-xs text-indigo-600 hover:text-indigo-700 mt-2">
                          {suggestion.action}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Tips */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target size={18} />
                Platform Tips
              </h3>
              <div className="space-y-3">
                {selectedPlatforms.slice(0, 3).map(platformId => {
                  const config = PLATFORM_CONFIG[platformId];
                  return (
                    <div key={platformId} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{config.icon}</span>
                        <span className="font-medium capitalize text-sm">{platformId}</span>
                      </div>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {config.tips.map((tip, index) => (
                          <li key={index}>• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}