Research Agent — SourceDesk

Overview

The Research Agent automates web research for a user-provided topic. It expands the topic into sub-queries using the configured LLM, runs Brave Search for each sub-query, optionally crawls selected result pages via crawl4ai, summarises pages with the configured LLM, and collates a Markdown research briefing appended to the active project's Working Document.

How it runs

- The modal UI (Research Board) has an "🤖 Agent" button which opens the Agent modal.
- Provide a topic, number of expansion queries, results per query, and enable/disable auto-crawl.
- The agent performs the steps sequentially: query expansion → Brave Search → crawl (optional) → summarisation → synthesis.
- Live log lines are shown in the modal. Items and summaries are saved to the `research` IndexedDB store, and a final Markdown report is appended to the Working Document.

Configuration / prerequisites

- Brave Search API Key: Settings → Brave Search API Key. Required for Brave calls.
- crawl4ai Endpoint: Settings → crawl4ai Endpoint. Required if auto-crawl is enabled.
- LLM provider + API key: A configured LLM provider is required for query expansion and summarisation.

New public functions

The following functions are exposed to HTML and reserved during minification so onclick handlers keep working:

- `openResearchAgent(topic?: string)` — open the agent modal (optional pre-filled topic).
- `runResearchAgent()` — start the agent run with modal parameters.
- `generateResearchReport()` — generate a report from existing research items.

Helpers and internals

- `_agentLlmCollect` — convenience for collecting a streaming LLM response into a single string.
- `_agentBraveSearch` — wrapper around Brave Search API with X-Subscription-Token header.
- `_agentCrawl` — POSTs to the configured crawl4ai endpoint and prefers Markdown output when available.
- `_researchExtractJsonArray` — heuristics for extracting a JSON array from LLM responses (fenced code blocks, prose fallback).

Testing

- Tests were added for `_researchExtractJsonArray` and to verify the new public functions are present. Run `tests/test.html` in a browser (file:// works) to run the test harness.

Build notes

- `build.js` was updated to reserve the newly-exposed function names in Terser's mangle.reserved list to prevent minification removing them.
- A production build was created: `SourceDesk.html` is in the repository root.

How you can QA quickly

1. Open `SourceDesk.html` in a browser.
2. Settings: set Brave API key and, if using auto-crawl, the crawl4ai endpoint. Ensure LLM provider is configured.
3. Open Research Board → click "🤖 Agent" → run a topic end-to-end and confirm logs, items, crawls, summaries, and final report append.
4. Run tests: open `tests/test.html` and confirm all tests pass.

Limitations & future work

- JSON extraction from LLM replies is heuristic; improving the prompt to enforce strict JSON would help.
- Add cancel/abort support and rate-limiting/retries for external calls.
- Add agent run history and more E2E tests that stub external services.
