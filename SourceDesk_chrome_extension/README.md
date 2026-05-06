# SourceDesk Chrome Extension

A companion Chrome extension that provides utility tools for strategic sourcing professionals working alongside SourceDesk. Each feature is packaged as a **module** — new modules can be added without touching existing ones.

---

## Installation

### 1. Generate the extension icons

Open `generate-icons.html` in any Chrome tab (a `file://` URL is fine):

```
File > Open File… > generate-icons.html
```

Click each of the four **Download** buttons and save the files into the `images/` folder with these exact names:

| Button | Filename |
|---|---|
| Download 16×16 | `images/icon-16.png` |
| Download 32×32 | `images/icon-32.png` |
| Download 48×48 | `images/icon-48.png` |
| Download 128×128 | `images/icon-128.png` |

### 2. Load the extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `SourceDesk_chrome_extension/` folder

The SourceDesk icon will appear in your Chrome toolbar. Pin it for easy access.

### 3. Open the sidebar

Navigate to a BidNet Direct page, then click the **SourceDesk** toolbar icon. The sidebar will open on the right side of the browser window.

> **Note:** The sidebar can be opened on any page, but the Bidnet module only functions on `https://www.bidnetdirect.com/*` pages where the content script is active.

---

## Modules

### 📋 Bidnet

Bulk Q&A management for [BidNet Direct](https://www.bidnetdirect.com). Designed to work on the Q&A list page of a solicitation:

```
https://www.bidnetdirect.com/private/buyer/solicitations/{id}/questions-answers
```

#### Page Controls

| Button | What it does |
|---|---|
| **🔍 Load All Questions** | Rewrites the page URL to `?searchCriteria.pageSize=9999&searchCriteria.pageNumber=1`, bypassing BidNet's 100-per-page UI limit so all questions load at once |
| **📥 Extract Q&A to CSV** | Scrapes the visible Q&A table and downloads a CSV with columns: `question_id, question_number, vendor, question, answer, visibility, answer_status, question_date, answer_date` |

A timestamped, colour-coded **Status Log** shows success/error/info messages for all actions.

#### Load Data (CSV Import)

Drag and drop a CSV file onto the drop zone, or click to browse. Expected columns (header row required):

| Column | Required | Notes |
|---|---|---|
| `question_number` | ✅ | Must match BidNet's Q-number (e.g. `Q1`, `Q42`) |
| `answer` | ✅ | Answer text |
| `visibility` | Optional | `public` or `private` (case-insensitive) |
| `comment` | Optional | Internal comment for the answer form |

After loading, a preview of the first 5 rows is shown along with a row count badge.

#### Batch Actions — Fill Answers from CSV

Iterates through every row in the loaded CSV, navigates to that question's answer form, fills in the fields, and saves.

| Setting | Default | Notes |
|---|---|---|
| **Submit via UI clicks** | ✅ On | Clicks the "Save & Quit" button; recommended. Uncheck to use programmatic `form.submit()` instead |
| **Override visibility from CSV** | ✅ On | Uses the `visibility` column per row. Uncheck to apply the Default Visibility to all rows |
| **Default Visibility** | Public | Used when Override is off, or when the CSV `visibility` cell is blank |
| **Delay between actions (ms)** | 800 | Increase if your connection or BidNet's server is slow |

Click **▶ Start Filling Answers** to begin. A progress bar shows `X / Y — Q#NNN`. Click **⏹ Stop** to halt after the current row finishes.

#### Batch Actions — Batch Visibility Change

1. Use the **Questions** table (below) to select questions via checkboxes
2. Choose **Public** or **Private**
3. Click **Apply to Selected**

The extension will visit each selected question's answer form, change the visibility dropdown, and click Save & Quit in sequence.

#### Questions Table

Click **🔄 Refresh from Page** to scrape the current page's Q&A table and populate the table in the sidebar.

| Column | Notes |
|---|---|
| ☐ | Checkbox for batch selection |
| # | Question number (Q1, Q2, …) |
| Question | Truncated question text |
| Status | Answer status from BidNet (Draft, Published, etc.) |
| Vis | 🔓 Public / 🔒 Private |
| CSV | ✓ if this question has a matching row in the loaded CSV |
| Go | Navigates directly to this question's answer form |

Use the **search box** to filter rows by question text. **Select All** / **Deselect** buttons for quick selection management.

---

### 🏢 SourceDesk *(coming soon)*

Future module: import solicitation data, project context, and AI-generated answers directly from a SourceDesk instance.

### ⚙️ Settings *(coming soon)*

Future module: extension-wide settings (SourceDesk server URL, API token, default delay, etc.).

---

## File Structure

```
SourceDesk_chrome_extension/
├── manifest.json           ← MV3 manifest
├── background.js           ← Service worker; opens side panel, relays messages
├── side-panel.html         ← Full sidebar UI (self-contained HTML + CSS + JS)
├── content-bidnet.js       ← Content script for bidnetdirect.com
├── generate-icons.html     ← Canvas-based icon generator
├── images/
│   ├── icon-16.png         ← (generate with generate-icons.html)
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
└── docs/
    ├── bidnet_research.md  ← Feature research and URL notes
    └── bidnet_src/         ← Captured live HTML/JS from BidNet pages (selector reference)
```

---

## Adding a New Module

1. **Add a new content script** (e.g. `content-mymodule.js`) and register it in `manifest.json` under `content_scripts` with the appropriate `matches` URL pattern.
2. **Add a new view div** in `side-panel.html` (e.g. `<div id="view-mymodule" class="view">`) with your module's UI inside a card layout.
3. **Add a tab button** in the `#bottom-tabs` nav pointing to the new view (`data-view="mymodule"`).
4. Update the `MODULE_BADGES` object in the side panel `<script>` block to include a badge label for the new view.
5. Handle the new message actions in both `side-panel.html` (send) and your new content script (receive).

All communication between the sidebar and content scripts goes through `chrome.tabs.sendMessage` (sidebar → page) and `chrome.runtime.sendMessage` (page → sidebar, relayed by `background.js`).

---

## Known Limitations

- **Page navigation during fill/batch**: each answer form requires a full page navigation. The content script context resets on each navigation — this is expected Chrome extension behaviour. The side panel maintains state across navigations.
- **CKEditor**: if BidNet ever enables a rich-text editor (CKEditor) on the answer textarea, programmatic value-setting may not work reliably. UI-click mode (`Submit via UI clicks` ✅) is the safer default.
- **Rate limiting**: BidNet may throttle rapid sequential requests. Increase the delay (e.g. 1500–2000 ms) if you see errors or blank form loads.
