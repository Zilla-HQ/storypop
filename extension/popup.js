/* eslint-disable no-undef */

const SITEBEAT_BASE = "https://sitebeat.tech";
const REF_CODE = "chrome_ext"; // baseline attribution; can be overridden via storage in v2

const urlEl = document.getElementById("url");
const runBtn = document.getElementById("run");
const errEl = document.getElementById("err");

let activeUrl = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    urlEl.textContent = "No active tab.";
    runBtn.disabled = true;
    return;
  }
  try {
    const u = new URL(tab.url);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      urlEl.textContent = "Only http(s) pages can be audited.";
      runBtn.disabled = true;
      return;
    }
    activeUrl = u.origin;
    urlEl.textContent = activeUrl;
  } catch {
    urlEl.textContent = tab.url;
    activeUrl = tab.url;
  }
}

async function runAudit() {
  if (!activeUrl) return;
  errEl.hidden = true;
  runBtn.disabled = true;
  runBtn.textContent = "Starting…";
  try {
    const res = await fetch(`${SITEBEAT_BASE}/api/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: activeUrl,
        attribution: {
          utmSource: "chrome_extension",
          utmMedium: "extension",
          utmCampaign: REF_CODE,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.auditId) {
      throw new Error(json.error || "Audit failed to start");
    }
    chrome.tabs.create({ url: `${SITEBEAT_BASE}/audit/${json.auditId}` });
    window.close();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.hidden = false;
    runBtn.disabled = false;
    runBtn.textContent = "Try again";
  }
}

runBtn.addEventListener("click", runAudit);
init();
