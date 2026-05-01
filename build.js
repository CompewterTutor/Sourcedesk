#!/usr/bin/env node
// ─── SourceDesk build script ─────────────────────────────────────────────────
// Usage:
//   node build.js           → minified production build → SourceDesk.html
//   node build.js --dev     → unminified dev build       → SourceDesk.html
//   node build.js --watch   → watch src/ and rebuild on change (dev mode)

"use strict";

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const isDev = args.includes("--dev") || args.includes("--watch");
const isWatch = args.includes("--watch");

const SRC_HTML = path.join(__dirname, "src", "index.html");
const SRC_FILES = [
  "src/flags.js",
  "src/db.js",
  "src/state.js",
  "src/autosave.js",
  "src/diff.js",
  "src/help.js",
  "src/boot.js",
  "src/messages.js",
  "src/retrieval.js",
  "src/api.js",
  "src/chat.js",
  "src/panel.js",
  "src/templates.js",
  "src/projects.js",
  "src/fill.js",
  "src/settings.js",
  "src/versioning.js",
  "src/tasks.js",
  "src/contacts.js",
  "src/drive.js",
  "src/notes.js",
  "src/supplierQuestions.js",
  "src/attachments.js",
  "src/promptLibrary.js",
  "src/suggestions.js",
  "src/research.js",
  "src/editor.js",
  "src/ui.js",
].map((f) => path.join(__dirname, f));
const OUT_HTML = path.join(__dirname, "SourceDesk.html");
const PLACEHOLDER = "  <!-- BUILD:JS -->";

// ─── Core build ──────────────────────────────────────────────────────────────
async function build() {
  const start = Date.now();

  if (!fs.existsSync(SRC_HTML)) {
    throw new Error(`Template not found: ${SRC_HTML}`);
  }
  for (const f of SRC_FILES) {
    if (!fs.existsSync(f)) {
      throw new Error(`Source JS not found: ${f}`);
    }
  }

  const html = fs.readFileSync(SRC_HTML, "utf8");
  const js = SRC_FILES.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  if (!html.includes(PLACEHOLDER)) {
    throw new Error(`Placeholder "${PLACEHOLDER}" not found in src/index.html`);
  }

  let finalJs = js;

  if (!isDev) {
    // Lazy-require terser so the script still works for --dev without it installed
    let terser;
    try {
      terser = require("terser");
    } catch {
      console.error(
        "⚠  terser not found — run `npm install` first, or use --dev for an unminified build.",
      );
      process.exit(1);
    }

    const result = await terser.minify(js, {
      compress: {
        passes: 2,
        drop_debugger: true,
        // Keep console.log calls — they're guarded by the DEBUG flag at runtime
        drop_console: false,
        pure_funcs: [],
      },
      mangle: {
        // Preserve names used from HTML onclick attributes
        reserved: [
          "showView",
          "openNewProject",
          "saveProject",
          "openNewTemplate",
          "openEditTemplate",
          "saveTemplate",
          "deleteTemplate",
          "openFillTemplate",
          "applyFill",
          "viewTemplateContent",
          "promptAttachTemplate",
          "openSettings",
          "saveSettings",
          "clearAllData",
          "loadProject",
          "sendMessage",
          "stopStreaming",
          "toggleRightPanel",
          "toggleDoc",
          "toggleOtherProject",
          "deleteDoc",
          "handleDocUpload",
          "selectPill",
          "selectPillByVal",
          "closeModal",
          "closeModalOnOverlay",
          "onProviderChange",
          "boot",
          "exportDatabase",
          "triggerImportDialog",
          "importDatabase",
          "exportProject",
          "openNewNote",
          "openNewProject",
          "openNewTemplate",
          "openEditTemplate",
          "openEditProject",
          "openSettings",
          "selectNote",
          "saveCurrentNote",
          "saveProject",
          "saveTemplate",
          "saveSettings",
          "deleteCurrentNote",
          "loadNotes",
          "renderNotesList",
          "validateImportShape",
          "filterNotes",
          "toggleNoteInContext",
          "deleteProject",
          "duplicateTemplate",
          "openWorkingDoc",
          "saveWorkingDoc",
          "previewTemplateVars",
          "openExtractVars",
          "saveExtractedVars",
          "createTemplateFromDoc",
          "clearChatHistory",
          "clearAllData",
          "sendMessage",
          "showView",
          "applyFill",
          "toggleRightPanel",
          "openDriveModal",
          "verifyDriveToken",
          "listDriveFiles",
          "backupToDrive",
          "disconnectDrive",
          "fetchLocalModels",
          "togglePreviewPanel",
          "searchNotes",
          "searchAllNotes",
          "toggleNotePin",
          "loadSupplierQuestions",
          "renderSQList",
          "selectQuestion",
          "openAddQuestionsModal",
          "saveAddedQuestions",
          "generateAnswerForQuestion",
          "generateSelectedAnswers",
          "saveCurrentSQAnswer",
          "deleteQuestion",
          "copyQuestionToClipboard",
          "copyAnswerToClipboard",
          "exportSelectedQuestions",
          "exportAllQuestions",
          "exportTasksMarkdown",
          "exportTasksCSV",
          "filterSQList",
          "toggleAllSQCheckboxes",
          "scheduleSQAutoSave",
          "topbarModelChange",
          "refreshTopbarModels",
          "syncTopbarModelSelect",
          "setModelContextLimit",
          "getContextLimit",
          "openAttachMenu",
          "handleAttachFiles",
          "removeAttachment",
          "clearPendingAttachments",
          "renderAttachBar",
          "getPendingAttachments",
          "updateContextMeter",
          "showStreamingIndicator",
          "hideStreamingIndicator",
          "newChat",
          "renderChatSessionList",
          "loadChatSession",
          "openVersionHistory",
          "restoreDocVersion",
          "deleteDocVersion",
          "saveDocVersion",
          "_vhStartLabelEdit",
          "_vhSaveLabel",
          "openVersionDiff",
          "diffLines",
          "diffStats",
          "renderInlineDiffHtml",
          "scheduleAutosave",
          "cancelAutosave",
          "flushAutosave",
          "setAutosaveStatus",
          "scheduleWorkingDocAutosave",
          "scheduleNoteAutosave",
          "scheduleTaskAutosave",
          "openHelpModal",
          "helpSwitchTab",
          "openSuggestionBox",
          "submitSuggestion",
          "openManageSuggestions",
          "deleteSuggestion",
          "exportSuggestions",
          "scheduleTemplateAutosave",
          "testBraveKey",
          "testCrawl4aiEndpoint",
          "testMarkitdownServer",
          "openResearchSearch",
          "runResearchSearch",
          "addResearchFromBrave",
          "openAddResearchManual",
          "submitResearchManual",
          "loadResearchBoard",
          "crawlResearchItem",
          "summariseResearchItem",
          "deleteResearchItem",
          "toggleResearchInContext",
          "openResearchAgent",
          "runResearchAgent",
          "generateResearchReport",
          "_researchExtractJsonArray",
          "mountRichEditor",
          "destroyRichEditor",
          "setRichEditorMode",
          "refreshRichEditor",
          "_rteMarkdownToHtml",
          "_rteHtmlToMarkdown",
          "loadTasks",
          "renderTaskList",
          "selectTask",
          "openNewTask",
          "saveCurrentTask",
          "deleteCurrentTask",
          "filterTaskList",
          "toggleTaskStatus",
          "toggleTaskInContext",
          "loadContacts",
          "renderContactList",
          "selectContact",
          "openNewContact",
          "saveCurrentContact",
          "deleteCurrentContact",
          "filterContactList",
          "toggleContactInContext",
          "selectContactTypePill",
          "openPromptLibrary",
          "closePromptLibrary",
          "renderPromptLibraryDropdown",
          "insertPrompt",
          "openSavePromptModal",
          "openManagePromptLibrary",
          "savePromptEntry",
          "deletePromptEntry",
          "togglePromptFavorite",
          "filterChatSessions",
          "getOrCreateAppFolder",
          "getOrCreateVisibleRootFolder",
          "getOrCreateProjectFolder",
          "importSheetsQuestions",
          "importSheetsQuestionsFromInput",
          "exportQuestionsToSheets",
          "exportQuestionsToCSV",
          "importQuestionsFromCSV",
          "parseBidNetHtml",
          "openBidNetImportModal",
          "handleBidNetImportFile",
          "executeBidNetImport",
          "generateBatch",
          "setSQStatus",
          "setSQConfidence",
          "exportSQSummary",
          "_sqEffectiveStatus",
          "exportToGoogleDoc",
          "exportQuestionsToDoc",
          "exportWorkingDocToDoc",
          "parseSpreadsheetId",
          "convertFileToDriveText",
          "testEmbeddingModel",
          "getEmbedding",
          "cosineSimilarity",
          "indexDocEmbeddings",
          "getDocEmbeddings",
        ],
      },
      format: {
        comments: false,
      },
    });

    if (result.error) throw result.error;
    finalJs = result.code;
  }

  const injectTag = `<script>\n${finalJs}\n</script>`;
  const output = html.replace(PLACEHOLDER, injectTag);

  fs.writeFileSync(OUT_HTML, output, "utf8");

  const elapsed = Date.now() - start;
  const sizeKB = (Buffer.byteLength(output, "utf8") / 1024).toFixed(1);
  const mode = isDev ? "dev (unminified)" : "production (minified)";
  const jsKB = (Buffer.byteLength(finalJs, "utf8") / 1024).toFixed(1);

  console.log(`✓  SourceDesk.html  [${mode}]`);
  console.log(`   total ${sizeKB} KB  |  JS ${jsKB} KB  |  ${elapsed} ms`);
}

// ─── Watch mode ───────────────────────────────────────────────────────────────
function watch() {
  console.log(
    "SourceDesk build — watching src/ for changes (Ctrl+C to stop)\n",
  );

  build().catch((e) => console.error("✗  Build failed:", e.message));

  // fs.watch is recursive on macOS/Windows; on Linux you may need chokidar
  try {
    fs.watch(
      path.join(__dirname, "src"),
      { recursive: true },
      (_event, filename) => {
        if (!filename) return;
        // Debounce rapid successive events (e.g. editor saving multiple temp files)
        clearTimeout(watch._timer);
        watch._timer = setTimeout(() => {
          process.stdout.write(`\n→ ${filename} changed — rebuilding…\n`);
          build().catch((e) => console.error("✗  Build failed:", e.message));
        }, 80);
      },
    );
  } catch (e) {
    // fs.watch with recursive: true is not supported on all Linux kernels
    console.warn("⚠  recursive fs.watch failed:", e.message);
    console.warn(
      "   Install chokidar and wrap this script if you need watch on Linux.",
    );
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────
if (isWatch) {
  watch();
} else {
  build().catch((e) => {
    console.error("✗  Build failed:", e.message);
    process.exit(1);
  });
}
