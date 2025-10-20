#!/usr/bin/env node
// ESM-friendly, async, brand-aware CLI
import { Command } from "commander";
import fs from "fs/promises";
import fssync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateEpisodeMarkdown, promptForSEODetails } from "../src/generator.js";

// ---------- helpers ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readMaybe = async (p) => {
  try { return await fs.readFile(p, "utf8"); } catch { return null; }
};

const loadBrands = async (explicitPath) => {
  const candidatePaths = explicitPath
    ? [explicitPath]
    : [
        path.join(__dirname, "../config/brands.json"),
        path.join(process.cwd(), "config/brands.json"),
      ];
  for (const p of candidatePaths) {
    try {
      const data = await fs.readFile(p, "utf8");
      return { json: JSON.parse(data), path: p };
    } catch { /* keep trying */ }
  }
  return { json: null, path: null };
};

const coerceCSV = (val) =>
  (val ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const nowDate = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// ---------- main ----------
async function main() {
  const program = new Command();

  program
    .name("searchers-episode")
    .description("Generate SEO-ready episode content from timestamps + metadata.")
    // identity & brand
    .option("--brand <name>", "Brand key in brands.json (e.g., 'searchers')", "searchers")
    .option("--brands-file <path>", "Path to brands.json (override auto-discovery)")
    // content inputs
    .option("-t, --title <string>", "Episode title (optional, will be auto-suggested if omitted)")
    .option("-g, --guests <string>", "Guest name(s) comma-separated, e.g., 'Mikhaela Cann, Jane Doe'")
    .option("--hosts <string>", "Hosts list (comma-separated). Defaults from brand if omitted")
    .option("-s, --summary <string>", "1–3 sentence episode blurb (required)")
    .option("-f, --timestamps-file <path>", "Path to plaintext timestamps file, or '-' for stdin (required)")
    .option("--keep-emoji", "Keep emojis in labels (default: remove)", false)
    // seo
    .option("--seo", "Prompt for SEO details", true)       // <-- default true
    .option("--no-seo", "Skip SEO prompts")                // Commander toggles .seo = false
    // output
    .option("-o, --out <path>", "Output file path (if omitted, prints to stdout)")
    .option("--out-dir <dir>", "Output directory (used when --auto-name is on)")
    .option("--auto-name", "Auto file name: YYYY-MM-DD_<slug>.md", false)
    .option("--format <fmt>", "Output format: md|json|both", "md")
    .option("--dry-run", "Print result but do not write files", false)
    .parse(process.argv);

  const opts = program.opts();

  // --- load brand config ---
  const { json: brands, path: brandsPath } = await loadBrands(opts.brandsFile);
  if (!brands) {
    console.error("⚠️  No brands.json found. Provide --brands-file or create config/brands.json.");
    process.exit(1);
  }
  const brand = brands[opts.brand];
  if (!brand) {
    console.error(`⚠️  Brand '${opts.brand}' not found in ${brandsPath}.`);
    process.exit(1);
  }

  // --- validate required inputs ---
  const exitWith = (msg) => { console.error(msg); process.exit(1); };
  if (!opts.summary) exitWith("Error: --summary is required.");
  if (!opts.timestampsFile) exitWith("Error: --timestamps-file is required.");

  // --- collect timestamps (file or stdin) ---
  let timestampsRaw = "";
  if (opts.timestampsFile === "-" || opts.timestampsFile === "/dev/stdin") {
    // read from stdin
    timestampsRaw = await new Promise((resolve, reject) => {
      let buf = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => (buf += chunk));
      process.stdin.on("end", () => resolve(buf));
      process.stdin.on("error", reject);
    });
  } else {
    if (!fssync.existsSync(opts.timestampsFile)) {
      exitWith(`Error: timestamps file not found: ${opts.timestampsFile}`);
    }
    timestampsRaw = await fs.readFile(opts.timestampsFile, "utf8");
  }

  // --- SEO details ---
  const seoDetails = opts.seo ? await promptForSEODetails() : {};

  // --- assemble links from brand but allow CLI overrides ---
  const links = {
    patreon: brand.links?.patreon,
    spotify: brand.links?.spotify,
    apple: brand.links?.apple,
    anchor: brand.links?.anchor,
    youtube: brand.links?.youtube,
    tiktok: brand.links?.tiktok,
    facebook: brand.links?.facebook,
    instagram: brand.links?.instagram,
    // allow explicit overrides from CLI if you want:
    ...["patreon", "spotify", "apple", "anchor", "tiktok", "facebook", "instagram", "youtube"]
      .reduce((acc, k) => (opts[k] ? (acc[k] = opts[k], acc) : acc), {})
  };

  // --- guests & hosts ---
  const guestsArr = coerceCSV(opts.guests);
  const hostsArr = opts.hosts ? coerceCSV(opts.hosts) : (brand.hosts || []);

  // --- choose title & slug ---
  const title = opts.title || (guestsArr.length ? `${guestsArr[0]} — Conversation` : "New Episode");
  const slug = slugify(title);

  // --- build request for generator ---
  const payload = {
    title,
    guest: guestsArr.join(", "),
    hosts: hostsArr.join(", "),
    brandName: brand.brandName || opts.brand, // fallback to key
    summary: opts.summary,
    timestampsRaw,
    links,
    keepEmoji: !!opts.keepEmoji,
    cta: brand.cta || "",
    seo: seoDetails
  };

  // --- generate content ---
  const md = (opts.format === "md" || opts.format === "both")
    ? generateEpisodeMarkdown(payload)
    : null;

  const jsonOut = (opts.format === "json" || opts.format === "both")
    ? JSON.stringify({ ...payload, rendered: { md } }, null, 2)
    : null;

  // --- output selection ---
  if (opts.dry_run || (!opts.out && !opts.autoName && !opts.outDir)) {
    // default to stdout in dry-run or when no destination is provided
    if (md) process.stdout.write(md + "\n");
    if (jsonOut) process.stdout.write(jsonOut + "\n");
    return;
  }

  // compute destination(s)
  const baseName = `${nowDate()}_${slug}`;
  if (opts.autoName && !opts.out) {
    const outDir = opts.outDir || path.join(process.cwd(), "output");
    await ensureDir(outDir);
    const fileTargets = [];
    if (md) fileTargets.push(path.join(outDir, `${baseName}.md`));
    if (jsonOut) fileTargets.push(path.join(outDir, `${baseName}.json`));
    for (const p of fileTargets) {
      await fs.writeFile(p, p.endsWith(".md") ? md : jsonOut, "utf8");
      console.log(`✅ Wrote ${path.resolve(p)}`);
    }
  } else if (opts.out) {
    const outPath = path.resolve(opts.out);
    const isDir =
      outPath.endsWith(path.sep) || // trailing slash
      (fssync.existsSync(outPath) && fssync.lstatSync(outPath).isDirectory());

    if (isDir) {
      await ensureDir(outPath);
      if (md) {
        const p = path.join(outPath, `${baseName}.md`);
        await fs.writeFile(p, md, "utf8");
        console.log(`✅ Wrote ${path.resolve(p)}`);
      }
      if (jsonOut) {
        const p = path.join(outPath, `${baseName}.json`);
        await fs.writeFile(p, jsonOut, "utf8");
        console.log(`✅ Wrote ${path.resolve(p)}`);
      }
    } else {
      // single explicit file path (assume correct extension for chosen format)
      const content = md ?? jsonOut ?? "";
      await fs.writeFile(outPath, content, "utf8");
      console.log(`✅ Wrote ${outPath}`);
    }
  } else {
    // outDir only
    const outDir = opts.outDir || path.join(process.cwd(), "output");
    await ensureDir(outDir);
    if (md) {
      const p = path.join(outDir, `${baseName}.md`);
      await fs.writeFile(p, md, "utf8");
      console.log(`✅ Wrote ${path.resolve(p)}`);
    }
    if (jsonOut) {
      const p = path.join(outDir, `${baseName}.json`);
      await fs.writeFile(p, jsonOut, "utf8");
      console.log(`✅ Wrote ${path.resolve(p)}`);
    }
  }
}

main().catch((err) => {
  console.error("❌ Unhandled error:", err?.stack || err);
  process.exit(1);
});
