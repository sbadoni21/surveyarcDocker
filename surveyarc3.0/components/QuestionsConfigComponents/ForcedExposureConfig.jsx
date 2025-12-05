"use client";
import React from "react";

export default function ForcedExposureConfig({ config = {}, updateConfig }) {
  const contentType = config.contentType || "text";
  const minExposureSeconds =
    Number(config.minExposureSeconds) > 0 ? config.minExposureSeconds : 10;

  const requireScrollToEnd = Boolean(config.requireScrollToEnd ?? true);
  const showCountdown = Boolean(config.showCountdown ?? true);
  const showProgressBar = Boolean(config.showProgressBar ?? true);
  const allowEarlyExitWithReason = Boolean(
    config.allowEarlyExitWithReason ?? false
  );
  const earlyExitRequiredReason = Boolean(
    config.earlyExitRequiredReason ?? true
  );
  const scrollBlockingHeight = Number(config.scrollBlockingHeight) || 320;

  const showSystemHint = Boolean(config.showSystemHint ?? true);
  const systemHint =
    config.systemHint ||
    "You’ll be able to continue once you’ve viewed the full content and the timer finishes.";

  const update = (key, value) => updateConfig(key, value);

  return (
    <div className="space-y-6 text-sm dark:text-[#CBC9DE] text-[#111827]">
      {/* Basic text */}
      <section className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium">Title (optional)</span>
          <input
            type="text"
            value={config.title || ""}
            onChange={(e) => update("title", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
            placeholder="Please read this information carefully"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium">Body / instructions</span>
          <textarea
            value={config.body || ""}
            onChange={(e) => update("body", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] min-h-[80px]"
            placeholder="Explain what this content is and why they must read it."
          />
        </label>
      </section>

      {/* Content source */}
      <section className="space-y-3">
        <h3 className="font-medium text-sm">Content source</h3>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Content type</span>
          <select
            value={contentType}
            onChange={(e) => update("contentType", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
          >
            <option value="text">Plain text (scrollable)</option>
            <option value="image">Image</option>
            <option value="video">Video (YouTube / file)</option>
            <option value="embed">Embed URL (PDF, page, etc.)</option>
          </select>
        </label>

        {contentType === "text" && (
          <label className="block space-y-1">
            <span className="text-xs font-medium">Scrollable text</span>
            <textarea
              value={config.longText || ""}
              onChange={(e) => update("longText", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E] min-h-[160px]"
              placeholder="Paste terms & conditions, disclosure, etc."
            />
          </label>
        )}

        {contentType === "image" && (
          <label className="block space-y-1">
            <span className="text-xs font-medium">Image URL</span>
            <input
              type="text"
              value={config.imageUrl || ""}
              onChange={(e) => update("imageUrl", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
              placeholder="https://example.com/image.png"
            />
          </label>
        )}

        {contentType === "video" && (
          <label className="block space-y-1">
            <span className="text-xs font-medium">
              Video URL (YouTube / direct MP4)
            </span>
            <input
              type="text"
              value={config.videoUrl || ""}
              onChange={(e) => update("videoUrl", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
              placeholder="https://youtube.com/watch?v=... or https://.../file.mp4"
            />
          </label>
        )}

        {contentType === "embed" && (
          <label className="block space-y-1">
            <span className="text-xs font-medium">Embed URL (iframe)</span>
            <input
              type="text"
              value={config.embedUrl || ""}
              onChange={(e) => update("embedUrl", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
              placeholder="https://yourdomain.com/terms.html"
            />
          </label>
        )}
      </section>

      {/* Timing + scroll logic */}
      <section className="space-y-3">
        <h3 className="font-medium text-sm">Time & scroll lock</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium">Min exposure (seconds)</span>
            <input
              type="number"
              min={1}
              max={600}
              value={minExposureSeconds}
              onChange={(e) =>
                update(
                  "minExposureSeconds",
                  Number(e.target.value) > 0 ? Number(e.target.value) : 1
                )
              }
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
            />
            <span className="text-[10px] text-gray-500">
              Time user must spend on this content before unlock.
            </span>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium">
              Scroll area height (px)
            </span>
            <input
              type="number"
              min={200}
              max={800}
              value={scrollBlockingHeight}
              onChange={(e) =>
                update(
                  "scrollBlockingHeight",
                  Number(e.target.value) || 320
                )
              }
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
            />
            <span className="text-[10px] text-gray-500">
              Height of content container before scrollbars appear.
            </span>
          </label>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requireScrollToEnd}
                onChange={(e) =>
                  update("requireScrollToEnd", e.target.checked)
                }
                className="h-4 w-4"
              />
              <span className="text-xs">
                Require scroll to bottom (for text/embed)
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showCountdown}
                onChange={(e) => update("showCountdown", e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-xs">Show countdown (seconds left)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showProgressBar}
                onChange={(e) => update("showProgressBar", e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-xs">Show visual time progress bar</span>
            </label>
          </div>
        </div>
      </section>

      {/* Early exit */}
      <section className="space-y-3">
        <h3 className="font-medium text-sm">Early exit (optional)</h3>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allowEarlyExitWithReason}
            onChange={(e) =>
              update("allowEarlyExitWithReason", e.target.checked)
            }
            className="h-4 w-4"
          />
          <span className="text-xs">
            Allow respondent to skip with a reason (e.g. technical issues)
          </span>
        </label>

        {allowEarlyExitWithReason && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium">
                Button label (skip / can&apos;t view)
              </span>
              <input
                type="text"
                value={config.earlyExitLabel || "I cannot view this content"}
                onChange={(e) => update("earlyExitLabel", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
              />
            </label>

            <label className="flex items-center gap-2 mt-5 md:mt-6">
              <input
                type="checkbox"
                checked={earlyExitRequiredReason}
                onChange={(e) =>
                  update("earlyExitRequiredReason", e.target.checked)
                }
                className="h-4 w-4"
              />
              <span className="text-xs">
                Require free-text reason on early exit
              </span>
            </label>
          </div>
        )}
      </section>

      {/* System hint */}
      <section className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showSystemHint}
            onChange={(e) => update("showSystemHint", e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-xs">
            Show hint text about the time-lock behaviour
          </span>
        </label>

        {showSystemHint && (
          <label className="block space-y-1">
            <span className="text-xs font-medium">Hint text</span>
            <input
              type="text"
              value={systemHint}
              onChange={(e) => update("systemHint", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#8C8A97] dark:bg-[#1A1A1E]"
              placeholder="You’ll be able to continue once..."
            />
          </label>
        )}
      </section>
    </div>
  );
}
