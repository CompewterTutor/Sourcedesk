// ─── GENERIC AUTOSAVE ────────────────────────────────────────────────────────
// Provides a debounced save scheduler keyed by an arbitrary id, plus a small
// shared "● Saving… / ✓ Saved" status indicator helper.
//
// Usage:
//   scheduleAutosave("workingDoc", () => saveWorkingDoc({silent:true}));
//   setAutosaveStatus("workingDoc", "saving");
//   setAutosaveStatus("workingDoc", "saved");

const _autosaveTimers = {};
const _autosaveDelay = 1500;

function scheduleAutosave(key, fn, delay) {
    const ms = typeof delay === "number" ? delay : _autosaveDelay;
    if (_autosaveTimers[key]) clearTimeout(_autosaveTimers[key]);
    setAutosaveStatus(key, "pending");
    _autosaveTimers[key] = setTimeout(async function () {
        _autosaveTimers[key] = null;
        try {
            setAutosaveStatus(key, "saving");
            await fn();
            setAutosaveStatus(key, "saved");
        } catch (err) {
            setAutosaveStatus(key, "error", err && err.message);
            log("autosave[" + key + "] failed:", err && err.message);
        }
    }, ms);
}

function cancelAutosave(key) {
    if (_autosaveTimers[key]) {
        clearTimeout(_autosaveTimers[key]);
        _autosaveTimers[key] = null;
    }
}

// flushAutosave runs the scheduled save immediately if one is pending.
async function flushAutosave(key, fn) {
    if (_autosaveTimers[key]) {
        clearTimeout(_autosaveTimers[key]);
        _autosaveTimers[key] = null;
        if (typeof fn === "function") {
            try {
                setAutosaveStatus(key, "saving");
                await fn();
                setAutosaveStatus(key, "saved");
            } catch (err) {
                setAutosaveStatus(key, "error", err && err.message);
            }
        }
    }
}

function _autosaveStatusEl(key) {
    return document.getElementById("autosave-status-" + key);
}

function setAutosaveStatus(key, state, msg) {
    const el = _autosaveStatusEl(key);
    if (!el) return;
    el.classList.remove(
        "as-pending",
        "as-saving",
        "as-saved",
        "as-error",
        "as-idle",
    );
    if (state === "pending") {
        el.classList.add("as-pending");
        el.textContent = "● Unsaved";
        el.title = "Pending changes — autosaving soon";
    } else if (state === "saving") {
        el.classList.add("as-saving");
        el.textContent = "● Saving…";
        el.title = "Saving";
    } else if (state === "saved") {
        el.classList.add("as-saved");
        el.textContent = "✓ Saved";
        el.title = "All changes saved";
        // Fade to idle after a couple seconds
        clearTimeout(el._fadeTimer);
        el._fadeTimer = setTimeout(function () {
            const cur = _autosaveStatusEl(key);
            if (cur && cur.classList.contains("as-saved")) {
                cur.classList.remove("as-saved");
                cur.classList.add("as-idle");
                cur.textContent = "";
            }
        }, 2200);
    } else if (state === "error") {
        el.classList.add("as-error");
        el.textContent = "✗ Save failed";
        el.title = msg || "Save failed";
    } else {
        el.classList.add("as-idle");
        el.textContent = "";
        el.title = "";
    }
}
