// SourceDesk — content-bidnet.js
// Runs on https://www.bidnetdirect.com/* pages.
// Handles messages from the side panel and executes DOM operations.
//
// Key selectors confirmed from live BidNet HTML source:
//
// Q&A TABLE (questions-answers page):
//   Rows:          tbody tr[id]                        — each row has id = questionId (numeric)
//   Question link: td.questionNo a.mets-command-link   — text = "Q1", "Q2", …
//   Question text: #questionContainer_{questionId}     — inner text
//   Answer text:   #answerContainer_{questionId}       — inner text
//   Visibility:    .questionAnswerTitle strong          — "Public Answer:" or "Private Answer:"
//   Answer status: td.answerDate .statusCell            — "Draft", "Published", etc.
//   Vendor:        td.vendorName
//
// ANSWER FORM (answer-question/{questionId} page):
//   Form:          #answerQuestionForm
//   Visibility:    #answerTypeDropdown   values: "" | "PUBLIC" | "PRIVATE"
//   Answer text:   #answerQuestion_answer_input_EN
//   Comment:       #answer\.workingRevision\.internalComment
//   Save & Quit:   button[data-href*="target=save"]
//   Publish:       button#topPublishButton  (or button[data-href*="target=init-publish"])
//
// NAVIGATION:
//   Answer page URL:  /private/buyer/solicitations/{solId}/answer-question/{questionId}
//   Q&A list URL:     /private/buyer/solicitations/{solId}/questions-answers
//   Show all:         append ?searchCriteria.pageSize=9999&searchCriteria.pageNumber=1

"use strict";

/* ═══════════════════════════════════════════════════════════════════════
   MESSAGE ROUTER
════════════════════════════════════════════════════════════════════════ */
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (!message || !message.action) return false;

  switch (message.action) {
    case "loadAllQuestions":
      handleLoadAllQuestions(sendResponse);
      return true;

    case "extractQA":
      handleExtractQA(sendResponse);
      return true;

    case "getPageQuestions":
      handleGetPageQuestions(sendResponse);
      return true;

    case "fillAnswer":
      handleFillAnswer(message.payload || {}, sendResponse);
      return true;

    case "navigateToQuestion":
      handleNavigateToQuestion(message.payload || {}, sendResponse);
      return true;

    case "testFillAnswer":
      handleTestFillAnswer(message.payload || {}, sendResponse);
      return true;

    case "batchVisibility":
      handleBatchVisibility(message.payload || {}, sendResponse);
      return true;

    default:
      return false;
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════════════════════════════ */

/** Wait for a CSS selector to appear (MutationObserver). */
function waitForElement(selector, timeout) {
  var ms = timeout !== undefined ? timeout : 10000;
  return new Promise(function (resolve, reject) {
    var el = document.querySelector(selector);
    if (el) return resolve(el);
    var obs = new MutationObserver(function () {
      var found = document.querySelector(selector);
      if (found) {
        obs.disconnect();
        resolve(found);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () {
      obs.disconnect();
      reject(new Error("Timeout waiting for: " + selector));
    }, ms);
  });
}

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function sendLog(text, level) {
  chrome.runtime.sendMessage({
    action: "log",
    text: String(text),
    level: level || "info",
  });
}

function sendProgress(current, total, label) {
  chrome.runtime.sendMessage({
    action: "progress",
    current: current,
    total: total,
    label: label || "",
  });
}

/** Extract solicitation ID from current URL path. */
function getSolicitationId() {
  var m = window.location.pathname.match(/\/solicitations\/(\d+)/);
  return m ? m[1] : null;
}

/** Build the base Q&A listing URL for this solicitation. */
function getQABaseUrl() {
  var solId = getSolicitationId();
  return solId
    ? "/private/buyer/solicitations/" + solId + "/questions-answers"
    : null;
}

/** Build the answer/edit URL for a specific question. */
function getAnswerUrl(questionId) {
  var solId = getSolicitationId();
  return solId
    ? "/private/buyer/solicitations/" + solId + "/answer-question/" + questionId
    : null;
}

/* ═══════════════════════════════════════════════════════════════════════
   CSV DOWNLOAD HELPER
════════════════════════════════════════════════════════════════════════ */

function csvCell(val) {
  if (val === null || val === undefined) return "";
  var s = String(val).replace(/"/g, '""');
  return s.indexOf(",") !== -1 ||
    s.indexOf('"') !== -1 ||
    s.indexOf("\n") !== -1
    ? '"' + s + '"'
    : s;
}

function downloadCSV(rows, filename) {
  var header = [
    "question_id",
    "question_number",
    "vendor",
    "question",
    "answer",
    "visibility",
    "answer_status",
    "question_date",
    "answer_date",
  ];
  var lines = [header.join(",")];
  rows.forEach(function (r) {
    lines.push(
      [
        csvCell(r.question_id),
        csvCell(r.question_number),
        csvCell(r.vendor),
        csvCell(r.question),
        csvCell(r.answer),
        csvCell(r.visibility),
        csvCell(r.answer_status),
        csvCell(r.question_date),
        csvCell(r.answer_date),
      ].join(","),
    );
  });
  var blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename || "bidnet-qa-export.csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/* ═══════════════════════════════════════════════════════════════════════
   HANDLER: LOAD ALL QUESTIONS (manipulate pageSize querystring)
════════════════════════════════════════════════════════════════════════ */

function handleLoadAllQuestions(sendResponse) {
  try {
    var base = getQABaseUrl();
    if (!base) {
      sendResponse({
        ok: false,
        error: "Could not determine solicitation ID from URL.",
      });
      return;
    }
    // Preserve any existing query params except pageSize / pageNumber
    var params = new URLSearchParams(window.location.search);
    params.set("searchCriteria.pageSize", "9999");
    params.set("searchCriteria.pageNumber", "1");
    // Remove target= if present (can interfere)
    params.delete("target");
    var newUrl = base + "?" + params.toString();
    sendLog("Navigating to show all questions…", "info");
    sendResponse({ ok: true });
    window.location.href = newUrl;
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   HANDLER: EXTRACT Q&A TO CSV
════════════════════════════════════════════════════════════════════════ */

function handleExtractQA(sendResponse) {
  try {
    var rows = scrapeQATable();
    if (rows.length === 0) {
      sendResponse({
        ok: false,
        error:
          "No question rows found on this page. Make sure you are on the Q&A list page.",
      });
      return;
    }
    downloadCSV(rows, "bidnet-qa-export.csv");
    sendLog("Extracted " + rows.length + " rows to CSV.", "success");
    sendResponse({ ok: true, data: rows });
  } catch (e) {
    sendLog("Extract error: " + e.message, "error");
    sendResponse({ ok: false, error: e.message });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   HANDLER: GET PAGE QUESTIONS (lightweight scrape for sidebar table)
════════════════════════════════════════════════════════════════════════ */

function handleGetPageQuestions(sendResponse) {
  try {
    var rows = scrapeQATable();
    var questions = rows.map(function (r) {
      return {
        id: r.question_id,
        number: r.question_number,
        text: r.question,
        answered: r.answer.trim().length > 0,
        visibility: r.visibility, // 'public' | 'private' | 'unknown'
        answer_status: r.answer_status,
      };
    });
    sendResponse({ ok: true, questions: questions });
  } catch (e) {
    sendResponse({ ok: false, error: e.message, questions: [] });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Q&A TABLE SCRAPER
   Row structure (confirmed from live HTML):
     <tr id="{questionId}" class="mets-table-row ...">
       <td class="questionNo">  <a class="mets-command-link">Q1</a>  </td>
       <td class="vendorName">  ...  </td>
       <td class="questionAnswer">
         <div id="questionContainer_{questionId}">…question text…</div>
         <div class="answerContainer">
           <div class="questionAnswerTitle"><strong>Public Answer:</strong> …</div>
           <div id="answerContainer_{questionId}">…answer text…</div>
         </div>
       </td>
       <td class="questionDate">  04/17/2026 05:42 PM MDT  </td>
       <td class="answerDate">
         <span class="statusCell DRAFT">Draft</span>
       </td>
       <td class="actions"> … </td>
     </tr>
════════════════════════════════════════════════════════════════════════ */

function scrapeQATable() {
  // Rows: tbody tr elements that have a numeric id attribute (the question ID)
  var rows = document.querySelectorAll("tbody tr[id]");
  var results = [];

  rows.forEach(function (tr) {
    var questionId = tr.id;
    if (!questionId || !/^\d+$/.test(questionId)) return; // skip non-question rows

    // Question number (Q1, Q2, …)
    var qnoLink = tr.querySelector("td.questionNo a.mets-command-link");
    var questionNumber = qnoLink ? qnoLink.textContent.trim() : "";

    // Vendor
    var vendorCell = tr.querySelector("td.vendorName");
    var vendor = vendorCell ? vendorCell.textContent.trim() : "";

    // Question text — lives in #questionContainer_{id}
    var qContainer = tr.querySelector("#questionContainer_" + questionId);
    var questionText = qContainer ? qContainer.innerText.trim() : "";

    // Answer text — lives in #answerContainer_{id}
    var aContainer = tr.querySelector("#answerContainer_" + questionId);
    var answerText = aContainer ? aContainer.innerText.trim() : "";

    // Visibility — determined by the strong tag inside .questionAnswerTitle for the answer
    var answerTitle = tr.querySelector(
      ".answerContainer .questionAnswerTitle strong",
    );
    var titleText = answerTitle
      ? answerTitle.textContent.trim().toLowerCase()
      : "";
    var visibility = "unknown";
    if (titleText.indexOf("public") !== -1) visibility = "public";
    else if (titleText.indexOf("private") !== -1) visibility = "private";

    // Answer status — .statusCell inside td.answerDate
    var statusCell = tr.querySelector("td.answerDate .statusCell");
    var answerStatus = statusCell ? statusCell.textContent.trim() : "";

    // Dates
    var qDateCell = tr.querySelector("td.questionDate");
    var questionDate = qDateCell ? qDateCell.textContent.trim() : "";

    results.push({
      question_id: questionId,
      question_number: questionNumber,
      vendor: vendor,
      question: questionText,
      answer: answerText,
      visibility: visibility,
      answer_status: answerStatus,
      question_date: questionDate,
      answer_date: answerStatus, // answerDate col shows status, not a raw date
    });
  });

  return results;
}

/* ═══════════════════════════════════════════════════════════════════════
   HANDLER: FILL ANSWER
   Navigates to the answer form for a question, fills it out, and saves.

   Answer form selectors (confirmed from live HTML):
     Form:        #answerQuestionForm
     Visibility:  #answerTypeDropdown   (values: "PUBLIC" | "PRIVATE")
     Answer:      #answerQuestion_answer_input_EN   (textarea)
     Comment:     #answer\.workingRevision\.internalComment  (textarea, id has dots)
     Save & Quit: button[data-href*="target=save"]
════════════════════════════════════════════════════════════════════════ */

async function handleFillAnswer(payload, sendResponse) {
  var questionId = payload.questionId;
  var answer = payload.answer || "";
  var visibility = payload.visibility || "public"; // 'public' | 'private'
  var comment = payload.comment || "";
  var useUI = payload.useUI !== false; // default true

  if (!questionId) {
    sendResponse({ ok: false, error: "No questionId provided." });
    return;
  }

  var answerUrl = getAnswerUrl(questionId);
  if (!answerUrl) {
    sendResponse({
      ok: false,
      error: "Could not build answer URL — is this a BidNet solicitation page?",
    });
    return;
  }

  try {
    sendLog("Navigating to answer form for " + questionId + "…", "info");

    // Navigate to the answer page
    window.location.href = answerUrl;

    // Wait for the form to load
    await waitForElement("#answerQuestionForm", 15000);
    await sleep(500); // let any JS initialisation settle

    // ── Visibility dropdown ──────────────────────────────────────────
    var visSel = document.querySelector("#answerTypeDropdown");
    if (visSel) {
      var visVal = visibility.toUpperCase(); // "PUBLIC" or "PRIVATE"
      visSel.value = visVal;
      visSel.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      sendLog(
        "Warning: visibility dropdown (#answerTypeDropdown) not found.",
        "info",
      );
    }

    await sleep(200);

    // ── Answer textarea ──────────────────────────────────────────────
    var answerTA = document.querySelector("#answerQuestion_answer_input_EN");
    if (answerTA) {
      answerTA.value = answer;
      answerTA.dispatchEvent(new Event("input", { bubbles: true }));
      answerTA.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      sendResponse({
        ok: false,
        error:
          "Answer textarea (#answerQuestion_answer_input_EN) not found on page.",
      });
      return;
    }

    // ── Comment textarea (optional) ──────────────────────────────────
    if (comment) {
      // The id literally contains dots: "answer.workingRevision.internalComment"
      var commentTA = document.getElementById(
        "answer.workingRevision.internalComment",
      );
      if (commentTA) {
        commentTA.value = comment;
        commentTA.dispatchEvent(new Event("input", { bubbles: true }));
        commentTA.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    await sleep(300);

    if (useUI) {
      // ── Click the "Save & Quit" button ──────────────────────────────
      var saveBtn = findSaveButton();
      if (!saveBtn) {
        sendResponse({
          ok: false,
          error: '"Save & Quit" button not found.',
        });
        return;
      }
      saveBtn.click();
      sendLog("Saved Q#" + questionId + " via UI click.", "success");
    } else {
      // ── Programmatic form submit ─────────────────────────────────────
      var form = document.querySelector("#answerQuestionForm");
      if (!form) {
        sendResponse({
          ok: false,
          error: "#answerQuestionForm not found.",
        });
        return;
      }
      // Set target=save on the form action if not already there
      var action = form.getAttribute("action") || "";
      if (action.indexOf("target=save") === -1) {
        form.setAttribute(
          "action",
          action + (action.indexOf("?") !== -1 ? "&" : "?") + "target=save",
        );
      }
      form.submit();
      sendLog("Saved Q#" + questionId + " via form submit.", "success");
    }

    sendResponse({ ok: true });
  } catch (e) {
    sendLog("fillAnswer error: " + e.message, "error");
    sendResponse({ ok: false, error: e.message });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   HANDLER: TEST FILL ANSWER (no save — for verifying selectors)
   Clicks the "Edit Answer" or "Answer" action button if on the Q&A list
   page, or navigates directly to the answer URL.  Sets the visibility
   dropdown and pastes the answer text, then STOPS (no save/submit).
   Highlights the Save button in orange so the user can verify targeting.
════════════════════════════════════════════════════════════════════════ */
async function handleTestFillAnswer(payload, sendResponse) {
  var questionId = payload.questionId;
  var answer = payload.answer || "";
  var visibility = payload.visibility || "public";
  var comment = payload.comment || "";

  if (!questionId) {
    sendResponse({ ok: false, error: "No questionId provided." });
    return;
  }

  var findings = {
    buttonFound: null, // 'editAnswer' | 'answer' | null
    buttonText: null, // actual trimmed text of the button clicked
    navigated: false,
    formFound: false,
    visDropdownFound: false,
    visValueSet: false,
    answerFieldFound: false,
    answerFilled: false,
    saveBtnFound: false,
  };

  try {
    // ── Step 1: find the per-row action button if we're on the list ───
    // Answered questions: id="qnaAction_editAnswer_{id}"
    // Unanswered questions: id="qnaAction_answer_{id}" (fallback)
    var editBtn = document.getElementById("qnaAction_editAnswer_" + questionId);
    var answerBtn = document.getElementById("qnaAction_answer_" + questionId);
    var actionBtn = editBtn || answerBtn;

    if (actionBtn) {
      findings.buttonFound = editBtn ? "editAnswer" : "answer";
      findings.buttonText = actionBtn.textContent.trim();
      sendLog(
        '[TEST] Found "' +
          findings.buttonText +
          '" button for Q#' +
          questionId +
          " — clicking…",
        "info",
      );
      actionBtn.click();
      findings.navigated = true;
    } else {
      // Not on the Q&A list, or question not visible — navigate directly
      var answerUrl = getAnswerUrl(questionId);
      if (!answerUrl) {
        sendResponse({
          ok: false,
          error: "Could not build answer URL.",
          findings: findings,
        });
        return;
      }
      sendLog(
        "[TEST] Action button not found for Q#" +
          questionId +
          " — navigating directly…",
        "info",
      );
      window.location.href = answerUrl;
      findings.navigated = true;
    }

    // ── Step 2: wait for the answer form ──────────────────────────────
    sendLog("[TEST] Waiting for #answerQuestionForm…", "info");
    await waitForElement("#answerQuestionForm", 15000);
    await sleep(500);
    findings.formFound = true;
    sendLog("[TEST] Form loaded ✓", "success");

    // ── Step 3: visibility dropdown ───────────────────────────────────
    var visSel = document.querySelector("#answerTypeDropdown");
    if (visSel) {
      findings.visDropdownFound = true;
      var visVal = visibility.toUpperCase();
      visSel.value = visVal;
      visSel.dispatchEvent(new Event("change", { bubbles: true }));
      findings.visValueSet = true;
      sendLog("[TEST] Visibility set to " + visVal + " ✓", "success");
    } else {
      sendLog("[TEST] WARNING: #answerTypeDropdown not found!", "error");
    }

    await sleep(200);

    // ── Step 4: answer textarea ────────────────────────────────────────
    var answerTA = document.querySelector("#answerQuestion_answer_input_EN");
    if (answerTA) {
      findings.answerFieldFound = true;
      answerTA.value = answer;
      answerTA.dispatchEvent(new Event("input", { bubbles: true }));
      answerTA.dispatchEvent(new Event("change", { bubbles: true }));
      findings.answerFilled = true;
      sendLog(
        "[TEST] Answer pasted into #answerQuestion_answer_input_EN ✓",
        "success",
      );
    } else {
      sendLog(
        "[TEST] WARNING: #answerQuestion_answer_input_EN not found!",
        "error",
      );
    }

    // ── Step 5: comment textarea (optional) ───────────────────────────
    if (comment) {
      var commentTA = document.getElementById(
        "answer.workingRevision.internalComment",
      );
      if (commentTA) {
        commentTA.value = comment;
        commentTA.dispatchEvent(new Event("input", { bubbles: true }));
        commentTA.dispatchEvent(new Event("change", { bubbles: true }));
        sendLog("[TEST] Comment pasted ✓", "success");
      }
    }

    // ── Step 6: highlight Save button — but DO NOT click ──────────────
    var saveBtn = findSaveButton();
    if (saveBtn) {
      findings.saveBtnFound = true;
      saveBtn.style.outline = "3px solid orange";
      saveBtn.style.outlineOffset = "2px";
      saveBtn.title = "SourceDesk TEST MODE — not saving";
      sendLog(
        "[TEST] Save button found and highlighted in orange (NOT clicking) ✓",
        "success",
      );
    } else {
      sendLog("[TEST] WARNING: Save & Quit button not found on form!", "error");
    }

    sendLog(
      "[TEST] Q#" +
        questionId +
        " ready — inspect the page, then click Test Next to continue.",
      "success",
    );
    sendResponse({ ok: true, findings: findings });
  } catch (e) {
    sendLog("[TEST] Error: " + e.message, "error");
    sendResponse({ ok: false, error: e.message, findings: findings });
  }
}

/** Find the "Save & Quit" submit button on the answer form. */
function findSaveButton() {
  // Primary: button with data-href containing target=save
  var btn = document.querySelector('button[data-href*="target=save"]');
  if (btn) return btn;
  // Fallback: any submit button in the form whose text includes "Save"
  var allBtns = document.querySelectorAll(
    '#answerQuestionForm button[type="submit"], #answerQuestionForm button.mets-command-button',
  );
  for (var i = 0; i < allBtns.length; i++) {
    if (allBtns[i].textContent.toLowerCase().indexOf("save") !== -1)
      return allBtns[i];
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════
   HANDLER: NAVIGATE TO QUESTION (open answer/edit page for one question)
════════════════════════════════════════════════════════════════════════ */

function handleNavigateToQuestion(payload, sendResponse) {
  var questionId = payload.questionId;
  if (!questionId) {
    sendResponse({ ok: false, error: "No questionId provided." });
    return;
  }
  var url = getAnswerUrl(questionId);
  if (!url) {
    sendResponse({ ok: false, error: "Could not build answer URL." });
    return;
  }
  sendResponse({ ok: true });
  window.location.href = url;
}

/* ═══════════════════════════════════════════════════════════════════════
   HANDLER: BATCH VISIBILITY CHANGE
   For each questionId, navigate to its answer form, change the visibility
   dropdown, and click Save & Quit.  Sends progress messages back.
════════════════════════════════════════════════════════════════════════ */

async function handleBatchVisibility(payload, sendResponse) {
  var questionIds = payload.questionIds || [];
  var visibility = payload.visibility || "public";

  if (questionIds.length === 0) {
    sendResponse({ ok: false, error: "No question IDs provided." });
    return;
  }

  sendResponse({ ok: true, started: true }); // ack immediately, progress via messages

  var total = questionIds.length;

  for (var i = 0; i < total; i++) {
    var qid = questionIds[i];
    sendProgress(i + 1, total, "Q" + qid);
    sendLog(
      "Batch vis: setting Q#" +
        qid +
        " to " +
        visibility +
        " (" +
        (i + 1) +
        "/" +
        total +
        ")…",
      "info",
    );

    var answerUrl = getAnswerUrl(qid);
    if (!answerUrl) {
      sendLog("Could not build URL for Q#" + qid + ", skipping.", "error");
      continue;
    }

    try {
      window.location.href = answerUrl;
      await waitForElement("#answerQuestionForm", 15000);
      await sleep(600);

      // Set visibility
      var visSel = document.querySelector("#answerTypeDropdown");
      if (visSel) {
        visSel.value = visibility.toUpperCase();
        visSel.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(300);
      } else {
        sendLog("Visibility dropdown not found for Q#" + qid + ".", "error");
        continue;
      }

      // Save
      var saveBtn = findSaveButton();
      if (saveBtn) {
        saveBtn.click();
        sendLog("Q#" + qid + " set to " + visibility + " ✓", "success");
        // Wait for navigation back to Q&A list before continuing
        await sleep(1500);
      } else {
        sendLog('"Save & Quit" not found for Q#' + qid + ".", "error");
      }
    } catch (e) {
      sendLog("Error on Q#" + qid + ": " + e.message, "error");
    }
  }

  sendProgress(total, total, "Done");
  sendLog("Batch visibility change complete.", "success");
}
