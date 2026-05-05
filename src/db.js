// ─── IndexedDB ────────────────────────────────────────────────────────────────
const DB_NAME = "sourcedesk",
  DB_VERSION = 13;
let db;

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onblocked = () => {
      rej(
        new Error(
          "IndexedDB upgrade blocked — please close other tabs running SourceDesk and reload.",
        ),
      );
    };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      d.onerror = (ev) => rej(ev.target.error);
      if (!d.objectStoreNames.contains("templates"))
        d.createObjectStore("templates", { keyPath: "id" });
      if (!d.objectStoreNames.contains("projects"))
        d.createObjectStore("projects", { keyPath: "id" });
      if (!d.objectStoreNames.contains("docs")) {
        const s = d.createObjectStore("docs", { keyPath: "id" });
        s.createIndex("projectId", "projectId", { unique: false });
      }
      if (!d.objectStoreNames.contains("chats")) {
        const s = d.createObjectStore("chats", { keyPath: "id" });
        s.createIndex("projectId", "projectId", { unique: false });
      }
      if (e.oldVersion < 4) {
        const tx = e.target.transaction;
        // chats store may have been just created above (oldVersion=0)
        // or may already exist (oldVersion=1,2,3) — either way it's
        // accessible via the upgrade transaction.
        try {
          const chatsStore = tx.objectStore("chats");
          if (!chatsStore.indexNames.contains("sessionId")) {
            chatsStore.createIndex("sessionId", "sessionId", {
              unique: false,
            });
          }
        } catch (err) {
          // store not yet in transaction scope — index will be
          // created via the createObjectStore path above
        }
      }
      if (!d.objectStoreNames.contains("settings"))
        d.createObjectStore("settings", { keyPath: "key" });
      if (!d.objectStoreNames.contains("notes")) {
        const sn = d.createObjectStore("notes", { keyPath: "id" });
        sn.createIndex("projectId", "projectId", { unique: false });
      }
      if (!d.objectStoreNames.contains("supplierQuestions")) {
        const sq = d.createObjectStore("supplierQuestions", {
          keyPath: "id",
        });
        sq.createIndex("projectId", "projectId", { unique: false });
      }
      if (!d.objectStoreNames.contains("promptLibrary"))
        d.createObjectStore("promptLibrary", { keyPath: "id" });
      if (!d.objectStoreNames.contains("docVersions")) {
        const dv = d.createObjectStore("docVersions", {
          keyPath: "id",
        });
        dv.createIndex("projectId", "projectId", { unique: false });
      }
      if (!d.objectStoreNames.contains("tasks")) {
        const ts = d.createObjectStore("tasks", { keyPath: "id" });
        ts.createIndex("projectId", "projectId", { unique: false });
      }
      // embeddings store for semantic retrieval vectors
      // NOTE: export/import/clearAllData stores arrays should also include
      // "embeddings" in a future session to fully persist vectors.
      if (!d.objectStoreNames.contains("embeddings")) {
        const emb = d.createObjectStore("embeddings", {
          keyPath: "id",
        });
        emb.createIndex("docId", "docId", { unique: false });
      }
      // contacts store — per-project contacts and resource links (DB v8)
      if (!d.objectStoreNames.contains("contacts")) {
        const co = d.createObjectStore("contacts", {
          keyPath: "id",
        });
        co.createIndex("projectId", "projectId", { unique: false });
      }
      // suggestions store — user feature suggestions (DB v9)
      if (!d.objectStoreNames.contains("suggestions")) {
        d.createObjectStore("suggestions", { keyPath: "id" });
      }
      // research store — per-project research items (DB v10)
      if (!d.objectStoreNames.contains("research")) {
        const rs = d.createObjectStore("research", {
          keyPath: "id",
        });
        rs.createIndex("projectId", "projectId", { unique: false });
      }
      // proposal evaluation stores (DB v11)
      if (!d.objectStoreNames.contains("evalCriteria")) {
        const ec = d.createObjectStore("evalCriteria", { keyPath: "id" });
        ec.createIndex("projectId", "projectId", { unique: false });
      }
      if (!d.objectStoreNames.contains("evalCandidates")) {
        const eca = d.createObjectStore("evalCandidates", { keyPath: "id" });
        eca.createIndex("projectId", "projectId", { unique: false });
      }
      if (!d.objectStoreNames.contains("evalScores")) {
        const es = d.createObjectStore("evalScores", { keyPath: "id" });
        es.createIndex("projectId", "projectId", { unique: false });
        es.createIndex("candidateId", "candidateId", { unique: false });
      }
      // guideline analyses store — persists AI analysis runs per project (DB v12)
      if (!d.objectStoreNames.contains("guidelineAnalyses")) {
        const ga = d.createObjectStore("guidelineAnalyses", { keyPath: "id" });
        ga.createIndex("projectId", "projectId", { unique: false });
      }
      // workingDocs store — multiple named working documents per project (DB v13)
      if (!d.objectStoreNames.contains("workingDocs")) {
        const wd = d.createObjectStore("workingDocs", { keyPath: "id" });
        wd.createIndex("projectId", "projectId", { unique: false });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      db.onerror = (ev) => console.error("IndexedDB error:", ev.target.error);
      res(db);
    };
    req.onerror = (e) => rej(e.target.error || req.error);
  });
}

function dbGet(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbPut(store, val) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(val);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

function dbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function dbGetByIndex(store, index, val) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).index(index).getAll(val);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function parseConstants(text) {
  const obj = {};
  (text || "").split("\n").forEach((line) => {
    const eq = line.indexOf("=");
    if (eq > 0) {
      const k = line.slice(0, eq).trim().toUpperCase();
      const v = line.slice(eq + 1).trim();
      if (k) obj[k] = v;
    }
  });
  return obj;
}

function resolveTemplateVars(content) {
  const proj = state.activeProject;
  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const builtIn = {
    PROJECT_NAME: proj ? proj.name : "",
    PROJECT_CATEGORY: proj ? proj.category : "",
    PROJECT_NOTES: proj ? proj.notes || "" : "",
    PROJECT_INSTRUCTIONS: proj ? proj.instructions || "" : "",
    TODAY: today,
    TIMESTAMP: now.toLocaleString(),
  };
  const constants = parseConstants(state.settings.constants || "");
  // builtIn takes priority over user-defined constants
  const vars = Object.assign({}, constants, builtIn);
  let out = content;
  for (const k in vars) {
    out = out.split("{{" + k + "}}").join(vars[k]);
  }
  // Date arithmetic: {{TODAY+N}}, {{TODAY-N}}, {{TODAY+Nw}}, {{TODAY+Nm}}, {{TODAY+Nd}}
  // d = days (default), w = weeks, m = months
  out = out.replace(
    /\{\{TODAY([+-])(\d+)([dwmDWM]?)\}\}/g,
    function (_, sign, num, unit) {
      const n = parseInt(num, 10);
      const d = new Date(now);
      const u = (unit || "d").toLowerCase();
      if (u === "m") {
        d.setMonth(d.getMonth() + (sign === "+" ? n : -n));
      } else if (u === "w") {
        d.setDate(d.getDate() + (sign === "+" ? n * 7 : -n * 7));
      } else {
        d.setDate(d.getDate() + (sign === "+" ? n : -n));
      }
      return d.toISOString().slice(0, 10);
    },
  );
  return out;
}

function extractVarsFromText(text) {
  // Returns array of { value, type, suggestedKey } sorted by type order: date, money, percent, kv
  const seenValues = new Set();
  const results = [];

  // ── Dates ────────────────────────────────────────────────────────────────
  const datePatterns = [
    /\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g,
    /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/\d{4}\b/g,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
  ];
  var dateItems = [];
  datePatterns.forEach(function (re) {
    re.lastIndex = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
      var v = m[0].trim();
      if (!seenValues.has(v)) {
        seenValues.add(v);
        dateItems.push(v);
      }
    }
  });
  dateItems.forEach(function (v, i) {
    results.push({
      value: v,
      type: "date",
      suggestedKey: "DATE_" + (i + 1),
    });
  });

  // ── Money ────────────────────────────────────────────────────────────────
  var moneyRe = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\d+(?:\.\d{2})?/g;
  var moneyItems = [];
  moneyRe.lastIndex = 0;
  var m;
  while ((m = moneyRe.exec(text)) !== null) {
    var v = m[0].trim();
    if (!seenValues.has(v)) {
      seenValues.add(v);
      moneyItems.push(v);
    }
  }
  moneyItems.forEach(function (v, i) {
    results.push({
      value: v,
      type: "money",
      suggestedKey: "AMOUNT_" + (i + 1),
    });
  });

  // ── Percent ──────────────────────────────────────────────────────────────
  var pctRe = /\b\d+(?:\.\d+)?%/g;
  var pctItems = [];
  pctRe.lastIndex = 0;
  while ((m = pctRe.exec(text)) !== null) {
    var v = m[0].trim();
    if (!seenValues.has(v)) {
      seenValues.add(v);
      pctItems.push(v);
    }
  }
  pctItems.forEach(function (v, i) {
    results.push({
      value: v,
      type: "percent",
      suggestedKey: "PCT_" + (i + 1),
    });
  });

  // ── Key-Value pairs ──────────────────────────────────────────────────────
  var lines = text.split("\n");
  var kvItems = [];
  lines.forEach(function (line) {
    var kvMatch = /^([A-Z][A-Za-z\s]{1,30}):\s*(.{1,80})$/.exec(line.trim());
    if (!kvMatch) return;
    var label = kvMatch[1].trim();
    var val = kvMatch[2].trim();
    // Skip if value looks like a plain sentence (has mid-value period not at end)
    if (/\.\s+\S/.test(val)) return;
    if (val.length > 80) return;
    if (seenValues.has(val)) return;
    seenValues.add(val);
    var key = label.toUpperCase().replace(/\s+/g, "_");
    kvItems.push({ value: val, suggestedKey: key });
  });
  kvItems.forEach(function (item) {
    results.push({
      value: item.value,
      type: "kv",
      suggestedKey: item.suggestedKey,
    });
  });

  return results;
}

function extractDatesFromText(text) {
  return extractVarsFromText(text)
    .filter(function (i) {
      return i.type === "date";
    })
    .map(function (i) {
      return i.value;
    });
}
