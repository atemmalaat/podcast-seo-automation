#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateEpisodeMarkdown, promptForSEODetails } from "../src/generator.js";

async function main() {
  const program = new Command();

  program
    .name("searchers-episode")
    .description("Generate SEO-ready episode content for The Searchers Podcast.")
    .option("-t, --title <string>", "Episode title (optional, auto-suggested if omitted)")
    .option("-g, --guest <string>", "Guest name(s), e.g., 'Mikhaela Cann' (optional)")
    .option("--hosts <string>", "Hosts list, default 'Atem Bior, Kirron Byrne'", "Atem Bior, Kirron Byrne")
    .option("-s, --summary <string>", "1–3 sentence episode blurb (required)")
    .option("-f, --timestamps-file <path>", "Path to plaintext timestamps file (required)")
    .option("-o, --out <path>", "Output file path (defaults to stdout)")
    .option("--keep-emoji", "Keep emojis in labels (default: remove)", false)
    .option("--brand-name <string>", "Podcast brand name", "The Searchers Podcast")
    .option("--patreon <string>", "Patreon URL", "https://patreon.com/u15047571?utm_medium=unknown&utm_source=join_link&utm_campaign=creatorshare_creator&utm_content=copyLink")
    .option("--spotify <string>", "Spotify URL", "https://open.spotify.com/show/2GRrhtrHF5zjPTmvEriXpT")
    .option("--apple <string>", "Apple Podcasts URL", "https://podcasts.apple.com/au/podcast/the-searchers-podcast/id1656166965")
    .option("--anchor <string>", "Anchor RSS URL", "https://anchor.fm/s/cd2722d4/podcast/rss")
    .option("--tiktok <string>", "TikTok URL", "http://tiktok.com/@thesearcherspodcast")
    .option("--facebook <string>", "Facebook URL", "https://www.facebook.com/profile.php?id=100090537573686&mibextid=LQQJ4d")
    .option("--instagram <string>", "Instagram handle/URL", "https://www.instagram.com/thesearcherspodcast/")
    .option("--no-seo", "Skip SEO prompts", false)
    .parse(process.argv);

  const opts = program.opts();

  function exitWith(msg) {
    console.error(msg);
    process.exit(1);
  }

  if (!opts.summary) exitWith("Error: --summary is required.");
  if (!opts.timestampsFile) exitWith("Error: --timestamps-file is required.");
  if (!fs.existsSync(opts.timestampsFile)) exitWith(`Error: timestamps file not found: ${opts.timestampsFile}`);

  const timestampsRaw = fs.readFileSync(opts.timestampsFile, "utf8");
  const seoDetails = opts.seo ? {} : await promptForSEODetails();

  const md = generateEpisodeMarkdown({
    title: opts.title || null,
    guest: opts.guest || "",
    hosts: opts.hosts,
    brandName: opts.brandName,
    summary: opts.summary,
    timestampsRaw,
    links: {
      patreon: opts.patreon,
      spotify: opts.spotify,
      apple: opts.apple,
      anchor: opts.anchor,
      tiktok: opts.tiktok,
      facebook: opts.facebook,
      instagram: opts.instagram,
      mbk: opts.mbk
    },
    keepEmoji: !!opts.keepEmoji,
    seo: seoDetails,
  });

  if (opts.out) {
    fs.writeFileSync(opts.out, md, "utf8");
    console.log(`✅ Wrote ${path.resolve(opts.out)}`);
  } else {
    console.log(md);
  }
}

main();

