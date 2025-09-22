"use client";
import React, { useState, useEffect } from "react";

export default function VideoConfig({ config, updateConfig }) {
  const [url, setUrl] = useState(config.url || "");
  const [caption, setCaption] = useState(config.caption || "");
  const [embedUrl, setEmbedUrl] = useState("");

  useEffect(() => {
    setUrl(config.url || "");
    setCaption(config.caption || "");
    setEmbedUrl(transformToEmbedUrl(config.url || ""));
  }, [config.url, config.caption]);

  const handleUrlChange = (e) => {
    const rawUrl = e.target.value;
    setUrl(rawUrl);
    updateConfig("url", rawUrl);
    setEmbedUrl(transformToEmbedUrl(rawUrl));
  };

  const handleCaptionChange = (e) => {
    const value = e.target.value;
    setCaption(value);
    updateConfig("caption", value);
  };

  const transformToEmbedUrl = (inputUrl) => {
    if (!inputUrl) return "";

    try {
      const url = new URL(inputUrl);

      // YouTube
      if (
        url.hostname.includes("youtube.com") ||
        url.hostname.includes("youtu.be")
      ) {
        const videoId = url.searchParams.get("v") || url.pathname.split("/")[1];
        return `https://www.youtube.com/embed/${videoId}`;
      }

      // Vimeo
      if (url.hostname.includes("vimeo.com")) {
        const videoId = url.pathname.split("/")[1];
        return `https://player.vimeo.com/video/${videoId}`;
      }

      // Direct file (like .mp4)
      if (/\.(mp4|webm|ogg)$/i.test(url.href)) {
        return url.href;
      }

      // Fallback to try to embed any HTTPS iframe-compatible URL
      if (url.protocol === "https:") {
        return url.href;
      }

      return "";
    } catch {
      return "";
    }
  };

  const isDirectFile = (url) => /\.(mp4|webm|ogg)$/i.test(url);

  return (
    <div className="space-y-4 dark:bg-[#1A1A1E] dark:text-[#96949C]">
      <div>
        <label className="block text-sm mb-1">Video URL</label>
        <input
          type="url"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          placeholder="e.g. https://youtu.be/xyz or direct .mp4 URL"
          value={url}
          onChange={handleUrlChange}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Caption (optional)</label>
        <input
          type="text"
          className="border p-2 rounded w-full dark:bg-[#1A1A1E] dark:text-[#CBC9DE]"
          placeholder="Enter a caption for your video"
          value={caption}
          onChange={handleCaptionChange}
        />
      </div>

      {embedUrl && (
        <div className="mt-4">
          <label className="block text-sm mb-1">Preview</label>
          <div className="aspect-video bg-black rounded overflow-hidden border">
            {isDirectFile(embedUrl) ? (
              <video controls className="w-full h-full">
                <source src={embedUrl} />
                Your browser does not support the video tag.
              </video>
            ) : (
              <iframe
                src={embedUrl}
                title="Video preview"
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
          {caption && (
            <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
              {caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
