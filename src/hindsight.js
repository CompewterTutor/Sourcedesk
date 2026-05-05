// ─── HINDSIGHT CLIENT HELPERS ─────────────────────────────────────────────────
// Shared fire-and-forget retain helper used by chat, notes, SQ, versioning,
// and research modules.  Never throws — HTTP/network errors are silently ignored.
//
// documentId  A stable, per-record id for upsert semantics.
//             Convention: "<type>:<id>" e.g. "note:abc123", "sq:xyz",
//             "wdoc:<projectId>:latest", "research:<id>", "email-summary:<projectId>"
// content     The text to retain (truncated to 4 000 chars).
// tags        Array of strings; caller should include "project:<id>" and "type:<kind>".
// context     Optional context string passed to the bank (default: "project:<id>").
function _hindsightRetainItem(documentId, content, tags, context) {
  const serverUrl = state.settings.serverUrl;
  const serverToken = state.settings.serverToken;
  if (!serverUrl || !serverToken || !state.settings.hindsightEnabled) return;
  const projectId = state.activeProject && state.activeProject.id;
  if (!projectId) return;
  fetch(serverUrl.replace(/\/$/, "") + "/api/hindsight/retain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: serverToken,
      documentId: documentId || undefined,
      content: (content || "").slice(0, 4000),
      context: context || ("project:" + projectId),
      tags: Array.isArray(tags) ? tags : ["project:" + projectId],
    }),
  }).catch(() => {});
}
