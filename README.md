# Life in Weeks

Your whole life as a grid: one box per week, 52 per row, one row per year of the lifespan you enter. Boxes behind you are filled, the one you are in right now is marked, the rest are empty.

Click any box and an on-device AI writes a short card about that week: what was happening in the world and in your country, what people were watching and listening to, what is typical development at that age, and a dad joke. Future weeks get what is already scheduled instead.

The model runs inside Chrome. No account, no server, no request leaves the page. Or paste a Gemini or Claude API key and pick a cloud model instead.

## Requirements

The research panel needs Chrome 148 or later on desktop with the Prompt API (Gemini Nano) enabled:

1. Enable `#prompt-api-for-gemini-nano` at `chrome://flags`, then relaunch.
2. Let the "Optimization Guide On Device Model" finish downloading at `chrome://components`.
3. The model wants 16GB RAM and 22GB free storage.

The grid itself works in any browser. Only the research card needs the model.

## Cloud API keys

Open **Model** in the Time Capsule panel, pick a provider, and paste a key. The key is verified against that provider's API; once accepted, the model dropdown lists available models.

- **Gemini**: get a key at [Google AI Studio](https://aistudio.google.com/apikey). Free keys are available. Defaults to `gemini-3.6-flash`.
- **Claude**: get a key at the [Claude Console](https://platform.claude.com/settings/keys). There is no free tier: the account needs prepaid credits, and the key check passes even with a zero balance, so research fails with a billing error until credits are added. Each week costs a few cents on the default `claude-sonnet-5-5`.

The key is held in memory for that tab only and is never written to storage. Closing the panel or reloading clears the key, resets the model selection, and goes back to the on-device model. Requests go straight from the page to `https://generativelanguage.googleapis.com` or `https://api.anthropic.com`, so the week you picked and your country leave the browser while a key is set.

## Development

[mise](https://mise.jdx.dev) pins the toolchain and defines every task; [aube](https://aube.sh) manages npm dependencies.

```sh
mise run setup     # install tools, dependencies and git hooks
mise run dev       # Vite dev server
mise run check     # lint, typecheck, test
mise run build     # static build into dist/ (regenerates the OG image first)
mise tasks         # list every task
```

## Agent tools

The page registers WebMCP tools, so a browser agent can drive it: `generate_life_timeline` fills and submits the form, `select_and_research_week` opens a week, `get_timeline_stats` reads back weeks lived and progress. See [llms-full.txt](public/llms-full.txt).

## Stack

Svelte 5 runes, TypeScript, Vite, plain CSS with cascade layers and container queries. No UI framework, minimal runtime dependencies (`@google/genai`, `@lucide/svelte`, and `@fontsource/open-sans`). Deployed as a static site on GitHub Pages.

## License

[MIT](LICENSE)
