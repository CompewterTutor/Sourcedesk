# SourceDesk Design Artifacts

This folder contains lightweight UX and iconography artifacts for SourceDesk.

## Files

- `sourcedesk-ux-icon-system.html` - self-contained mockup, UX notes, SVG symbol library, and semantic icon inventory.

## Usage Notes

- Open the HTML file directly in a browser. No server or build step is required.
- Treat `sd-icon-*` names in the inventory as semantic icon ids for future app integration.
- The mockup intentionally follows the current app structure in `src/index.html` and the Chrome extension side panel in `SourceDesk_chrome_extension/side-panel.html`.
- For production app integration, inline the SVG symbols into `src/index.html` or expose a tiny helper such as `sdIcon(name)` so the final `SourceDesk.html` remains self-contained.
