// components/NpsQuestion.jsx
'use client';
import React, { useMemo, useRef } from 'react';
const VALUE_KEY = 'value';

export default function NpsQuestion({
  config = {},              // expects { value?: number, disabled?, required?, size?, min?, max? }
  updateConfig = () => {},  // expects (newConfig) => void
  className = '',
}) {
  const {
    [VALUE_KEY]: value = null,
    disabled = false,
    required = false,
    size = 'md',            // 'sm' | 'md' | 'lg'
    min = 0,
    max = 10,
    ariaLabel = 'Net Promoter Score',
  } = config || {};

  const scores = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => i + min),
    [min, max]
  );
  const groupRef = useRef(null);

  const sizeMap = {
    sm: { btn: 'w-9 h-9 text-xs', gap: 'gap-1' },
    md: { btn: 'w-12 h-12 text-sm', gap: 'gap-2' },
    lg: { btn: 'w-14 h-14 text-base', gap: 'gap-3' },
  };
  const SZ = sizeMap[size] || sizeMap.md;

  const isDetractor = (n) => n >= 0 && n <= 5;
  const isPassive   = (n) => n >= 6 && n <= 8;
  const isPromoter  = (n) => n >= 9 && n <= 10;

  const baseShade = (n) =>
    isDetractor(n)
      ? 'bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200'
      : isPassive(n)
      ? 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200'
      : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200';

  const activeShade = (n) =>
    isDetractor(n)
      ? 'bg-red-500 text-white'
      : isPassive(n)
      ? 'bg-yellow-500 text-white'
      : 'bg-emerald-500 text-white';

  const ringShade = (n) =>
    isDetractor(n)
      ? 'focus:ring-red-400/70'
      : isPassive(n)
      ? 'focus:ring-yellow-400/70'
      : 'focus:ring-emerald-400/70';

  const setScore = (score) => {
    if (disabled) return;
    updateConfig({ ...config, [VALUE_KEY]: score });
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = value == null ? min : Math.min(value + 1, max);
      setScore(next);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = value == null ? max : Math.max(value - 1, min);
      setScore(prev);
    }
  };

  return (
    <div className={`text-center space-y-3 ${className}`}>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-disabled={disabled || undefined}
        className={`flex flex-wrap justify-center ${SZ.gap}`}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {scores.map((score) => {
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Score ${score}`}
              disabled={disabled}
              onClick={() => setScore(score)}
              className={[
                'rounded-full font-semibold transition-colors',
                'outline-none focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                ringShade(score),
                SZ.btn,
                selected ? activeShade(score) : baseShade(score),
                disabled ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-105',
              ].join(' ')}
            >
              {score}
            </button>
          );
        })}
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 h-4">
        {value != null ? `Selected: ${value}` : '\u00A0'}
      </div>
    </div>
  );
}
