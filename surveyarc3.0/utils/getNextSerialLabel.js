export function getNextSerialLabel(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return "Q1";
  }

  // Extract serial labels
  const serials = questions
    .map(q => q.serial_label)
    .filter(Boolean);

  if (serials.length === 0) {
    return "Q1";
  }

  // Match prefix + number (Q12, A9, xyz123)
  const parsed = serials
    .map(s => {
      const m = String(s).match(/^(.*?)(\d+)$/);
      if (!m) return null;
      return {
        prefix: m[1],
        num: parseInt(m[2], 10),
      };
    })
    .filter(Boolean);

  if (parsed.length === 0) {
    return "Q1";
  }

  // Use the most common prefix, fallback to last one
  const prefix =
    parsed[parsed.length - 1].prefix || "Q";

  const maxNum = Math.max(...parsed.map(p => p.num));

  return `${prefix}${maxNum + 1}`;
}
