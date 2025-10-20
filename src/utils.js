// utils.js

// -------------------- Timestamp parsing --------------------

/**
 * Parse plaintext (or basic RTF) timestamps into structured items.
 * Accepts lines like:
 *  "(1:23) LABEL"
 *  "- 8:48 : note"
 *  "(1:02:03) Thing"
 *  "00:05 Intro"
 *  "[12:34] Segment"
 *
 * Returns: [{ time: "1:23" | "1:02:03", seconds: 83, label: "Label" }, ...]
 */
export function parseTimestamps(
  timestampsRaw,
  { keepEmoji = false, collapseConsecutiveDuplicateLabels = true } = {}
) {
  let lines;

  // Very light RTF handling: keep only chunks that look like time-bearing tokens.
  // If it’s RTF, we split on backslashes and keep fragments that contain a time.
  if (timestampsRaw.trim().startsWith("{\\rtf")) {
    lines = timestampsRaw
      .split("\\")
      .map((l) => l.replace(/[{}]/g, "").trim())
      .filter((l) => TIME_FINDER.test(l));
  } else {
    lines = timestampsRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  const items = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " "); // normalize whitespace
    const m = line.match(TIME_FINDER);
    if (!m) continue;

    // Map the capturing groups to h/m/s safely
    const { h, m: mm, s } = extractHMS(m);

    const seconds = h * 3600 + mm * 60 + s;
    const time = formatClock(h, mm, s);

    // Label is whatever follows the FIRST matched time token
    const idx = line.indexOf(m[0]);
    let label = line.slice(idx + m[0].length);

    // Trim leading punctuation/separators
    label = label.replace(/^[)\]\-:–—|>.\s]+/g, "");

    if (!keepEmoji) label = stripEmoji(label);
    label = tidyLabel(label);

    items.push({ time, seconds, label });
  }

  // Deduplicate consecutive duplicate labels (common in messy exports)
  const result = collapseConsecutiveDuplicateLabels
    ? items.filter(
        (it, i, arr) =>
          i === 0 || it.label.toLowerCase() !== arr[i - 1].label.toLowerCase()
      )
    : items;

  return result;
}

// Matches times in forms: H:MM:SS, HH:MM:SS, M:SS, MM:SS, [MM:SS], (MM:SS)
const TIME_FINDER =
  /(?:(?<h>\d{1,2}):(?<m>\d{2}):(?<s>\d{2}))|(?:(?<m2>\d{1,2}):(?<s2>\d{2}))/;

/** Turn RegExp match into {h,m,s} integers. */
function extractHMS(match) {
  // Named groups if present
  const g = match.groups || {};
  if (g.h !== undefined) {
    return { h: toInt(g.h), m: toInt(g.m), s: toInt(g.s) };
  }
  // Fallback to positional groups for wider engine compatibility
  // match indices: 0 full, 1 h,2 m,3 s, 4 m2,5 s2
  if (match[1] !== undefined) {
    return { h: toInt(match[1]), m: toInt(match[2]), s: toInt(match[3]) };
  }
  return { h: 0, m: toInt(match[4]), s: toInt(match[5]) };
}

function toInt(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function formatClock(h, m, s) {
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Clean up a label:
 * - collapse spaces
 * - strip trailing stray punctuation
 * - sentence-case while preserving common acronyms
 * - ensure non-empty default
 */
export function tidyLabel(s) {
  if (!s) return "Segment";

  // normalize spacing, remove dangling colon/emdash at end
  s = s.replace(/\s{2,}/g, " ").replace(/\s*[:;,.!?-]+\s*$/g, "");
  s = s.replace(/\s?[—–-]\s*$/g, "");

  s = toSentenceCasePreserveAcronyms(s);

  // final trim
  s = s.trim();
  return s || "Segment";
}

/** Bare-bones emoji strip; sufficient for label cleaning */
export function stripEmoji(s) {
  return s
    .replace(
      /([\u2700-\u27BF]|\uFE0F|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF])/g,
      ""
    )
    .trim();
}

// -------------------- Text helpers --------------------

/** Sentence-case while preserving a small whitelist of acronyms. */
export function toSentenceCasePreserveAcronyms(s) {
  const trimmed = s.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  const sentence = lower.charAt(0).toUpperCase() + lower.slice(1);

  // Respect common sports/tech acronyms (extend as needed)
  return sentence.replace(
    /\b(nbl1|nba|wnbl|afl|mma|ai|phd|api|ui|ux|sql|http|https)\b/gi,
    (m) => m.toUpperCase()
  );
}

/** Simple slugifier for filenames/URLs */
export function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Interpolate {{var}} inside a template string with a vars object. */
export function interpolate(template, vars = {}) {
  return String(template).replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const k = String(key).trim();
    const v = deepGet(vars, k);
    return v == null ? "" : String(v);
  });
}

function deepGet(obj, path) {
  return path.split(".").reduce((acc, k) => (acc && k in acc ? acc[k] : undefined), obj);
}

/**
 * Generate platform-friendly tags/hashtags from core fields.
 * Returns an object with both array and hashtag string variants.
 */
export function generateTags({ title = "", theme = "", guests = [] } = {}) {
  const base = new Set();

  // Primitive extraction: split title into words, pick capitalized tokens as candidates
  title
    .split(/[^A-Za-z0-9+]+/)
    .filter(Boolean)
    .forEach((t) => {
      if (t.length > 2) base.add(t.toLowerCase());
    });

  if (theme) base.add(theme.toLowerCase());
  (Array.isArray(guests) ? guests : String(guests).split(","))
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean)
    .forEach((g) => base.add(g));

  // Add standard podcast/search anchors
  ["podcast", "interview", "australia", "brisbane"].forEach((t) => base.add(t));

  // Normalize to hashtags (no spaces)
  const tags = Array.from(base)
    .slice(0, 15) // keep it tidy
    .map((t) => t.replace(/\s+/g, ""));

  return {
    tags, // ['searchers', 'basketball', 'podcast']
    hashtags: tags.map((t) => `#${t}`).join(" "), // "#searchers #basketball #podcast"
  };
}

/**
 * Append a CTA + links block to a description based on brand profile.
 * - brand: { cta?: string, links?: { key:url } }
 * - options: choose which links to include & their order.
 */
export function appendCTA(description, brand = {}, options = {}) {
  const { cta = "", links = {} } = brand || {};
  const order =
    options.order ||
    ["youtube", "spotify", "apple", "patreon", "instagram", "tiktok", "facebook", "anchor"];

  const linkLines = [];
  for (const key of order) {
    const url = links[key];
    if (url) {
      linkLines.push(`${capitalize(key)}: ${url}`);
    }
  }

  const block = [
    description.trim(),
    "",
    cta ? `🎧 ${cta}` : "",
    linkLines.length ? linkLines.join("\n") : "",
  ]
    .filter(Boolean)
    .join("\n");

  return block;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
