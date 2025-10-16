import { parseTimestamps } from "./utils.js";
import inquirer from "inquirer";

export async function promptForSEODetails() {
  const answers = await inquirer.prompt([
    {
      name: "mainKeyword",
      type: "input",
      message: "What is the main keyword or topic for this episode?",
    },
    {
      name: "guestExpertise",
      type: "input",
      message: "What is the guest's expertise or background?",
    },
    {
      name: "targetAudience",
      type: "input",
      message: "Who is the target audience for this episode?",
    },
    {
      name: "keyTakeaways",
      type: "inout",
      message: "What are the key takeaways for this episode? (3-5 bullet points)",
    },
  ]);
  return answers;
}

const DEFAULT_PRIMARY_TAGS = [
  "the searchers podcast", "atem bior", "kirron byrne",
  "australian podcast", "self improvement podcast", "motivation podcast",
  "basketball podcast", "leadership podcast"
];

const DEFAULT_SECONDARY_TAGS = [
  "growth mindset", "athlete mindset", "coaching", "culture",
  "personal stories", "life lessons", "australia", "south sudan"
];

const DEFAULT_HASHTAGS = [
  "#TheSearchersPodcast", "#AtemBior", "#KirronByrne",
  "#PodcastAustralia", "#SelfImprovement", "#MotivationPodcast"
];

export function generateEpisodeMarkdown({
  title,
  guest,
  hosts,
  brandName,
  summary,
  timestampsRaw,
  links,
  keepEmoji = false,
  seo = {},
}) {
  const chapters = parseTimestamps(timestampsRaw, { keepEmoji });
  const resolvedTitle = title || autoTitle({ summary, guest, brandName });

  const primaryTags = dedupe([
    ...DEFAULT_PRIMARY_TAGS,
    ...autoPrimaryTags(summary, guest),
    seo.mainKeyword,
    seo.guestExpertise,
  ]);
  const secondaryTags = dedupe([
    ...DEFAULT_SECONDARY_TAGS,
    ...autoSecondaryTags(summary),
  ]);
  const hashtags = dedupe([...DEFAULT_HASHTAGS, ...autoHashtags(summary)]);

  const description = [
    normalizeSummary(summary, { hosts, guest, brandName }),
    seo.keyTakeaways ? `\n**Key Takeaways:**\n${seo.keyTakeaways}` : "",
  ].join("\n");

  return [
`## 🎙️ **Episode Title**
**${resolvedTitle}**

## 📝 **Episode Description**
${description}

## 💬 **Timestamps**`,
renderChapters(chapters),
`## 🎧 **Listen on Spotify, Apple & More**
Spotify → ${links.spotify}
Apple Podcasts → ${links.apple}
Anchor (RSS) → ${links.anchor}

## 🏷️ **Primary Tags**
${primaryTags.join(", ")}

## 🔖 **Secondary Tags**
${secondaryTags.join(", ")}

## 🏷️ **Hashtags**
${hashtags.join(" ")}

## 🪙 **Support ${brandName} on Patreon**
We’re building this from the ground up — real convos, real energy. Your support helps us drop more episodes, upgrade our setup, and bring in guests who elevate the conversation.

🪙 **Join the movement for just $10/month:**  
${links.patreon}

You’ll get:
* Early episode access
* Behind-the-scenes clips
* Your name shouted out on the show
* A front-row seat in our journey 💯

## 📲 **Follow ${brandName} @THESEARCHERSPODCAST**
Anchor - ${links.anchor}
Spotify - ${links.spotify}
Apple - ${links.apple}
TikTok - ${links.tiktok}
Facebook - ${links.facebook}
Instagram - ${links.instagram}
MBK Digital (clips) - ${links.mbk}
`
  ].join("\n\n");
}

function renderChapters(chapters) {
  if (!chapters.length) return "_No timestamps provided._";
  return chapters.map(c => `${c.time} – ${c.label}`).join("\n");
}

function normalizeSummary(summary, { hosts, guest, brandName }) {
  // Ensure we mention hosts + guest for SEO
  const hostLine = hosts ? `**${hosts}**` : "**Atem Bior**";
  const guestLine = guest ? ` with **${guest}**` : "";
  const base = summary.trim().replace(/\s+/g, " ");
  return `In this episode of **${brandName}**, ${hostLine}${guestLine} ${ensurePeriod(base)}`;
}

function ensurePeriod(s) {
  return /[.!?]$/.test(s) ? s : s + ".";
}

function autoTitle({ summary, guest, brandName }) {
  const core = pickKeywords(summary, ["basketball","parent","athlete","leadership","culture","faith","love","career","motivation","coaching"]);
  const parts = [];
  if (core.length) parts.push(core.slice(0,3).map(cap).join(", "));
  if (guest) parts.push(`With ${guest}`);
  parts.push(`${brandName}`);
  return `${parts.join(" | ")}`;
}

function autoPrimaryTags(summary, guest) {
  const kws = pickKeywords(summary, ["athlete","parenting","basketball","coaching","leadership","women in sport","performance","mindset","australian institute of sport","wnbl","nbl1"]);
  const out = [...kws];
  if (guest) out.push(`${guest.toLowerCase()} interview`);
  return out;
}

function autoSecondaryTags(summary) {
  return pickKeywords(summary, ["youth sport","junior development","mental skills","injury and recovery","habits","team culture","motivation tips","work life balance"])
}

function autoHashtags(summary) {
  const base = [];
  if (/basketball/i.test(summary)) base.push("#BasketballPodcast", "#NBL1", "#WNBL");
  if (/parent/i.test(summary)) base.push("#SportsParenting");
  if (/athlete|performance/i.test(summary)) base.push("#AthleteMindset");
  if (/leadership/i.test(summary)) base.push("#LeadershipPodcast");
  return base;
}

function pickKeywords(text, candidates) {
  const t = (text || "").toLowerCase();
  return candidates.filter(k => t.includes(k.split(" ")[0]));
}

function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function dedupe(arr){
  const seen = new Set();
  return arr.filter(x => {
    const k = x.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
