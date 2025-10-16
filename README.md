# The Searchers Podcast Episode Generator

This is a command-line tool to help automate the creation of SEO-ready episode descriptions for The Searchers Podcast.

## How to Use

1.  **Install dependencies:**

    ```bash
    npm install
    ```

2.  **Run the script:**

    ```bash
    ./bin/searchers-episode.js --summary "Your episode summary" --timestamps-file /path/to/your/timestamps.txt
    ```

    The script will then prompt you for additional information to help with SEO, such as the main keyword for the episode, the guest's expertise, the target audience, and the key takeaways.

### Options

*   `-t, --title <string>`: Episode title (optional, auto-suggested if omitted)
*   `-g, --guest <string>`: Guest name(s), e.g., 'Mikhaela Cann' (optional)
*   `--hosts <string>`: Hosts list, default 'Atem Bior, Kirron Byrne'
*   `-s, --summary <string>`: 1–3 sentence episode blurb (required)
*   `-f, --timestamps-file <path>`: Path to plaintext timestamps file (required)
*   `-o, --out <path>`: Output file path (defaults to stdout)
*   `--keep-emoji`: Keep emojis in labels (default: remove)
*   `--brand-name <string>`: Podcast brand name
*   `--patreon <string>`: Patreon URL
*   `--spotify <string>`: Spotify URL
*   `--apple <string>`: Apple Podcasts URL
*   `--anchor <string>`: Anchor RSS URL
*   `--tiktok <string>`: TikTok URL
*   `--facebook <string>`: Facebook URL
*   `--instagram <string>`: Instagram handle/URL
*   `--no-seo`: Skip SEO prompts
