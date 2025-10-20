// generator.js
import inquirer from "inquirer";
import {
  parseTimestamps,
  generateTags,
  appendCTA,
  toSentenceCasePreserveAcronyms,
} from "./utils.js";

/**
 * Light SEO prompt (optional, can be skipped with --no-seo in the CLI).
 * Kept simple until you wire in OpenAI later.
 */
export async function promptForSEODetails() {
  const answers = await inquirer.prompt([
    {
      name: "mainKeyword",
      type: "input",
      message: "Main keyword or topic (optional):",
      default: "",
    },
    {
      name: "guestExpertise",
      type: "input",
      message: "Guest expertise/background (optional):",
      default: "",
    },
    {
      name: "targetAudience",
      type: "input",
      message: "Target audience (optional):",
      default: "",
    },
    {
      name: "keyTakeaways",
      type: "input", // <- fixed 'inout' typo
      message: "Key takeaways (3–5 bullets; optional):",
      default: "",
    },
  ]);
  return answers;
}

/**
 * Generate Markdown for an episode description.
 * Keep inputs minimal: title (optional), summary (short), timestampsRaw (file contents), links + brand.
 */
export function generateEpisodeMarkdown({
  title,
  guest = "",
  hosts = "",
  brandName = "The Searchers Podcast",
  cta = "",
  summary,
  timestampsRaw,
  links = {},
  keepEmoji = false,
  seo = {},
}) {
  // 1) Parse timestamps → chapters
  const chapters = parseTimestamps(timestampsRaw, { keepEmoji });

  // 2) Resolve title (stable + sensible without AI)
  const resolvedTitle = title?.trim() || autoTitle({ summary, guest, brandName });

  // 3) Description body (clean, concise, SEO-friendly without being spammy)
  const descriptionBody = buildDescription({ summary, hosts, guest, brandName, seo });

  // 4) Tags + Hashtags (simple, deterministic)
  const { tags, hashtags } = buildTags({
    brandName,
    hosts,
    guest,
    summary,
    seo,
  });

  // 5) Platforms block + CTA
  const platformsBlock = renderPlatforms(links);
  const withCTA = appendCTA(platformsBlock, { cta, links });

  // 6) Final Markdown
  return [
    `## 🎙️ **${escapeMD(resolvedTitle)}**`,

    `## 📝 Episode Description
${descriptionBody}`,

    `## ⏱️ Chapters`,
    renderChapters(chapters),

    `## 🔗 Listen & Subscribe`,
    withCTA,

    `## 🏷️ Tags`,
    tags.join(", "),

    `## 🔖 Hashtags`,
    hashtags,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// --------------------------- helpers ---------------------------

function buildDescription({ summary, hosts, guest, brandName, seo }) {
  const cleanSummary = ensureSentence(summary);
  const hostLine = hosts ? `Hosted by **${hosts}**` : "";
  const guestLine = guest ? (hostLine ? ` with **${guest}**` : `Featuring **${guest}**`) : "";

  const lines = [
    `In this episode of **${brandName}**, ${[hostLine, guestLine].filter(Boolean).join(" ")}`.trim(),
    cleanSummary,
  ].filter(Boolean);

  if (seo?.keyTakeaways) {
    const bullets = normaliseBullets(seo.keyTakeaways);
    if (bullets.length) {
      lines.push(`**Key Takeaways:**\n${bullets.map((b) => `- ${b}`).join("\n")}`);
    }
  }

  return lines.join("\n\n");
}

function ensureSentence(s = "") {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

function normaliseBullets(raw = "") {
  // Accepts comma-, newline-, or dash-separated bites and tidies each one.
  const parts = raw
    .split(/\r?\n|,|·|•|—|-{1,2}/)
    .map((x) => toSentenceCasePreserveAcronyms(x.trim()))
    .filter((x) => x.length > 0);
  // Keep it tight
  return parts.slice(0, 5);
}

function renderChapters(chapters) {
  if (!chapters || chapters.length === 0) return "_No timestamps provided._";
  // Markdown-friendly list; safe for YouTube copy-paste as well.
  // e.g. "- 0:05 — Intro"
  return chapters.map((c) => `- ${c.time} — ${escapeMD(c.label)}`).join("\n");
}

function renderPlatforms(links = {}) {
  const rows = [
    ["YouTube", links.youtube],
    ["Spotify", links.spotify],
    ["Apple Podcasts", links.apple],
    ["RSS", links.anchor],
    ["Instagram", links.instagram],
    ["TikTok", links.tiktok],
    ["Facebook", links.facebook],
    ["Patreon", links.patreon],
  ].filter(([, url]) => !!url);

  if (!rows.length) return "_Links coming soon._";

  return rows.map(([name, url]) => `${name}: ${url}`).join("\n");
}

function buildTags({ brandName, hosts, guest, summary, seo }) {
  // Defaults biased to your brand but not spammy
  const baseGuests = guest
    ? String(guest)
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
    : [];

  const basic = {
    title: `${brandName} ${guest ? `with ${guest}` : ""}`.trim(),
    theme: (seo?.mainKeyword || "").trim(),
    guests: baseGuests,
  };

  const gen = generateTags(basic);
  // Sprinkle a few brand anchors (keep under 15 total in utils)
  const extra = [
    brandName.toLowerCase(),
    ...(hosts ? hosts.split(",").map((h) => h.trim().toLowerCase()) : []),
  ].filter(Boolean);

  const merged = Array.from(new Set([...gen.tags, ...extra.map((t) => t.replace(/\s+/g, ""))]));
  return {
    tags: merged,
    hashtags: merged.map((t) => `#${t}`).join(" "),
  };
}

function autoTitle({ summary, guest, brandName }) {
  // Dead-simple, deterministic title maker:
  // 1) take first 8–12 words from summary,
  // 2) sentence-case,
  // 3) append guest & brand lightly.
  const first = summaryToPhrase(summary, 10);
  const bits = [first];

  if (guest) bits.push(`with ${guest}`);
  bits.push(brandName);

  return bits.filter(Boolean).join(" | ");
}

function summaryToPhrase(s = "", wordLimit = 10) {
  const words = s
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, wordLimit);
  const phrase = words.join(" ");
  return toSentenceCasePreserveAcronyms(phrase);
}

function escapeMD(s = "") {
  // Minimal escaping to avoid accidental MD formatting in labels/titles
  return s.replace(/([*_`])/g, "\\$1");
}
