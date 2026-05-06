// SourceDesk — background.js (Manifest V3 service worker)

// Open the side panel when the toolbar icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Keep a Set of side-panel port connections so we can forward messages to them
const sidePanelPorts = new Set();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'side-panel') {
    sidePanelPorts.add(port);
    port.onDisconnect.addListener(() => sidePanelPorts.delete(port));
  }
});

// Message relay: content scripts → background → side panel (and vice versa)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward to all connected side panel ports first (port-based)
  sidePanelPorts.forEach((port) => {
    try { port.postMessage(message); } catch (_) { /* port closed */ }
  });

  // Also try broadcasting via runtime.sendMessage so the side panel's
  // chrome.runtime.onMessage listener receives it when it's not using ports
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may not be open — silently ignore
  });

  sendResponse({ ok: true });
  return true; // keep channel open for async sendResponse callers
});
