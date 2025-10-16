// Normalize " (1:23) LABEL ", "- 8:48 : note", "(1:02:03) Thing" → { time: "1:23", label: "Label" }
export function parseTimestamps(timestampsRaw, { keepEmoji = false } = {}) {
  const lines = timestampsRaw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const items = [];

  for (const line of lines) {
    // Pull time like (H:MM:SS) or (M:SS) or H:MM:SS etc.
    const match = line.match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})|(\d{1,2}):(\d{2})/);
    if (!match) continue;

    let h = 0, m = 0, s = 0;
    if (match[1] !== undefined) { // H:MM:SS
      h = Number(match[1]);
      m = Number(match[2]);
      s = Number(match[3]);
    } else if (match[4] !== undefined) { // M:SS
      m = Number(match[4]);
      s = Number(match[5]);
    }

    const t = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;

    // Label: everything after the matched time
    const idx = line.indexOf(match[0]);
    let label = line.slice(idx + match[0].length).replace(/^[)\]\-\:\–\s]+/g, "");
    if (!keepEmoji) label = stripEmoji(label);
    label = tidyLabel(label);

    items.push({ time: t, label });
  }

  // Deduplicate consecutive dupes
  return items.filter((it, i, arr) => i === 0 || it.label.toLowerCase() !== arr[i - 1].label.toLowerCase());
}

function tidyLabel(s) {
  if (!s) return "Segment";
  // normalize spacing and punctuation quirks
  s = s.replace(/\s{2,}/g, " ").replace(/\s*[:;]\s*$/g, "");
  s = s.replace(/\s?—\s?$/g, "");

  // sentence case (preserve acronyms)
  const lower = s.toLowerCase();
  const sentence = lower.charAt(0).toUpperCase() + lower.slice(1);
  // Respect known acronyms
  return sentence.replace(/\b(nbl1|nba|wnbl|afl|mma|ai|phd)\b/gi, m => m.toUpperCase());
}

function stripEmoji(s) {
  // Bare-bones emoji strip; good enough for our labels
  return s.replace(
    /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF])/g,
    ""
  ).trim();
}
