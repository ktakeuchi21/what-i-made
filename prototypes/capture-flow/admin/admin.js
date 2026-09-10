(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const config = window.WIM_AUTH_CONFIG || { enabled: false };
  const auth = window.WhatIMadeAuth?.createAuthClient?.(config);
  const endpoint = document.querySelector('meta[name="wim-service-api-endpoint"]')?.content.trim().replace(/\/$/, "") || "";
  const localFake = ["127.0.0.1", "localhost"].includes(location.hostname) && new URLSearchParams(location.search).get("admin") === "fake";
  const screens = ["loading", "signed-out", "denied", "dashboard"];
  let session = null;
  let openAccountId = "";
  let eventCursor = null;

  function show(id) { screens.forEach((name) => { $(`#${name}`).hidden = name !== id; }); }
  function formatDate(value, includeTime = false) { if (!value) return "Not yet"; return new Intl.DateTimeFormat(undefined, includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value)); }
  function number(value) { return Number(value || 0).toLocaleString(); }
  function reportError(error, selector = "#dashboard-error") { const target = $(selector); target.textContent = error?.message || "Analytics are temporarily unavailable."; target.hidden = false; target.focus(); }
  function hasAdmin(token) {
    if (localFake) return true;
    try { const groups = window.WhatIMadeAuth.decodeJwtPayload(token)["cognito:groups"] || []; return Array.isArray(groups) && groups.includes("what-i-made-admins"); } catch { return false; }
  }
  function hasAdminScope(token) {
    if (localFake) return true;
    try { return String(window.WhatIMadeAuth.decodeJwtPayload(token).scope || "").split(/\s+/).includes("what-i-made/admin"); } catch { return false; }
  }
  async function token() { session = await auth.getSessionForNetwork(); return session.accessToken; }
  async function request(path, options = {}) {
    if (localFake) return fixture(path, options);
    const response = await fetch(`${endpoint}${path}`, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${await token()}` }, cache: "no-store", credentials: "omit" });
    if (response.status === 403) { show("denied"); throw new Error("forbidden"); }
    if (!response.ok) throw new Error("Analytics are temporarily unavailable.");
    return response.json();
  }
  function fixture(path, options) {
    if (options?.method === "DELETE") return Promise.resolve({ status: "clearing", trackedSince: "2026-09-10" });
    const events = [{ date: "2026-09-04", signIns: 1, cooks: 2, ideas: 0 }, { date: "2026-09-06", signIns: 2, cooks: 1, ideas: 1 }, { date: "2026-09-09", signIns: 1, cooks: 3, ideas: 1 }];
    const users = [{ accountId: "a".repeat(64), email: "kai@example.test", status: "CONFIRMED", enabled: true, createdAt: "2026-09-01T12:00:00Z", firstSignInAt: "2026-09-01T12:00:00Z", lastSignInAt: "2026-09-09T18:00:00Z", lastActivityAt: "2026-09-09T18:20:00Z", signIns: 4, cooks: 6, ideas: 2, activeAccounts: 1, partial: false }];
    if (path.includes(`/users/${"a".repeat(64)}`)) return Promise.resolve({ trackedSince: "2026-09-10", user: users[0], events: [{ type: "cook_created", label: "Recorded a cook", occurredAt: "2026-09-09T18:20:00Z" }, { type: "sign_in_succeeded", label: "Signed in", occurredAt: "2026-09-09T18:00:00Z" }] });
    if (path.includes("/users")) return Promise.resolve({ trackedSince: "2026-09-10", users });
    return Promise.resolve({ trackedSince: "2026-09-10", purgeStatus: "complete", invitedAccounts: 1, activeAccounts: 1, accountsSignedIn: 1, signIns: 4, cooks: 6, ideas: 2, partial: false, series: events });
  }
  function renderTrend(series) {
    const trend = $("#trend"); const body = $("#trend-table"); trend.replaceChildren(); body.replaceChildren();
    const maximum = Math.max(1, ...series.map((item) => item.signIns + item.cooks + item.ideas));
    series.forEach((item) => { const bar = document.createElement("div"); bar.className = "trend-bar"; const total = item.signIns + item.cooks + item.ideas; bar.style.height = `${Math.max(4, total / maximum * 100)}%`; bar.title = `${item.date}: ${total} activities`; const row = document.createElement("tr"); [formatDate(`${item.date}T12:00:00`), item.signIns, item.cooks, item.ideas].forEach((value) => { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); }); trend.append(bar); body.append(row); });
    $("#trend-empty").hidden = series.length > 0; trend.hidden = series.length === 0; $(".table-wrap").hidden = series.length === 0;
  }
  function renderUsers(users) {
    const list = $("#people"); list.replaceChildren(); $("#people-count").textContent = `${users.length} account${users.length === 1 ? "" : "s"}`;
    users.forEach((user) => { const button = document.createElement("button"); button.type = "button"; button.className = "person-row"; button.innerHTML = `<strong></strong><span><small>First sign-in</small></span><span><small>Last sign-in</small></span><span><small>Sign-ins</small></span><span><small>Last activity</small></span><span><small>Cooks</small></span><span><small>Ideas</small></span><span><small>Status</small></span>`; button.querySelector("strong").textContent = user.email; const values = [formatDate(user.firstSignInAt, true), formatDate(user.lastSignInAt, true), number(user.signIns), formatDate(user.lastActivityAt, true), number(user.cooks), number(user.ideas), user.enabled ? user.status : "Disabled"]; [...button.querySelectorAll("span")].forEach((node, index) => node.append(document.createTextNode(values[index] || "—"))); button.addEventListener("click", () => void openPerson(user.accountId, button).catch(reportError)); list.append(button); });
  }
  async function loadPeople(range) {
    const users = [];
    let cursor = null;
    do {
      const payload = await request(`/v1/admin/analytics/users?range=${range}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      users.push(...(payload.users || []));
      cursor = payload.nextCursor || null;
    } while (cursor && users.length < 1000);
    if (cursor) throw new Error("The invited-account list is larger than this dashboard supports.");
    return { users };
  }
  async function load() {
    const error = $("#dashboard-error"); error.hidden = true; $("#dashboard").setAttribute("aria-busy", "true"); $("#refresh").disabled = true; $("#refresh").setAttribute("aria-busy", "true");
    try {
      const range = $("#range").value;
      const [summary, people] = await Promise.all([request(`/v1/admin/analytics/summary?range=${range}`), loadPeople(range)]);
      $("#tracked-since").textContent = `Tracked since ${formatDate(`${summary.trackedSince}T12:00:00`)}. Earlier activity is not reconstructed.`;
      [["invited", summary.invitedAccounts], ["signed-accounts", summary.accountsSignedIn], ["active", summary.activeAccounts], ["signins", summary.signIns], ["cooks", summary.cooks], ["ideas", summary.ideas]].forEach(([id, value]) => { $(`#metric-${id}`).textContent = number(value); });
      $("#partial-notice").hidden = !summary.partial && !(people.users || []).some((user) => user.partial);
      renderTrend(summary.series || []); renderUsers(people.users || []); show("dashboard"); $("#sign-out").hidden = false;
    } catch (errorValue) { if (errorValue.message !== "forbidden") reportError(errorValue); }
    finally { $("#dashboard").removeAttribute("aria-busy"); $("#refresh").disabled = false; $("#refresh").removeAttribute("aria-busy"); }
  }
  async function openPerson(accountId, trigger) {
    $("#person-error").hidden = true;
    const payload = await request(`/v1/admin/analytics/users/${accountId}?range=${$("#range").value}`);
    const user = payload.user; $("#person-title").textContent = user.email; const summary = $("#person-summary"); summary.replaceChildren(); [["First sign-in", formatDate(user.firstSignInAt, true)], ["Last sign-in", formatDate(user.lastSignInAt, true)], ["Sign-ins", number(user.signIns)], ["Last activity", formatDate(user.lastActivityAt, true)], ["Cooks", number(user.cooks)], ["Ideas", number(user.ideas)]].forEach(([label, value]) => { const wrap = document.createElement("div"); const dt = document.createElement("dt"); const dd = document.createElement("dd"); dt.textContent = label; dd.textContent = value; wrap.append(dt, dd); summary.append(wrap); });
    openAccountId = accountId; eventCursor = payload.nextCursor || null; renderTimeline(payload.events || [], false); const dialog = $("#person-dialog"); dialog.showModal(); dialog._returnFocus = trigger; $("#close-person").focus();
  }
  function renderTimeline(events, append) {
    const timeline = $("#person-timeline"); if (!append) timeline.replaceChildren(); events.forEach((event) => { const item = document.createElement("li"); const label = document.createElement("strong"); const time = document.createElement("time"); label.textContent = event.label; time.dateTime = event.occurredAt; time.textContent = formatDate(event.occurredAt, true); item.append(label, time); timeline.append(item); }); $("#person-empty").hidden = timeline.children.length > 0; $("#load-older-events").hidden = !eventCursor;
  }
  async function initialize() {
    if (!auth || !config.enabled || (!endpoint && !localFake)) { show("signed-out"); $("#auth-error").textContent = "Owner analytics are not configured."; $("#auth-error").hidden = false; return; }
    try { session = await auth.restore(); if (!["signedIn", "offlineGrace"].includes(session.kind)) { show("signed-out"); return; } if (session.kind !== "signedIn" || !hasAdmin(session.accessToken)) { show("denied"); return; } if (!hasAdminScope(session.accessToken)) { show("signed-out"); $("#auth-error").textContent = "Sign in again once to enable owner analytics."; $("#auth-error").hidden = false; return; } await load(); }
    catch (error) { show("signed-out"); $("#auth-error").textContent = error.message || "Sign-in could not be completed."; $("#auth-error").hidden = false; }
  }
  $("#sign-in").addEventListener("click", async () => { try { const destination = await auth.startSignIn(); if (typeof destination === "string") location.assign(destination); else { session = destination; await initialize(); } } catch (error) { $("#auth-error").textContent = error.message; $("#auth-error").hidden = false; } });
  $("#sign-out").addEventListener("click", async () => { const destination = await auth.signOut(); if (destination) location.assign(destination); else { session = null; show("signed-out"); } });
  $("#refresh").addEventListener("click", () => void load()); $("#range").addEventListener("change", () => void load());
  $("#close-person").addEventListener("click", () => $("#person-dialog").close()); $("#person-dialog").addEventListener("close", (event) => event.currentTarget._returnFocus?.focus());
  $("#load-older-events").addEventListener("click", async (event) => { if (!openAccountId || !eventCursor) return; const button = event.currentTarget; button.disabled = true; try { const payload = await request(`/v1/admin/analytics/users/${openAccountId}?range=${$("#range").value}&cursor=${encodeURIComponent(eventCursor)}`); eventCursor = payload.nextCursor || null; renderTimeline(payload.events || [], true); } catch (error) { reportError(error, "#person-error"); } finally { button.disabled = false; } });
  $("#open-erase").addEventListener("click", (event) => { $("#erase-confirmation").value = ""; $("#confirm-erase").disabled = true; $("#erase-dialog")._returnFocus = event.currentTarget; $("#erase-dialog").showModal(); $("#erase-confirmation").focus(); });
  $("#close-erase").addEventListener("click", () => $("#erase-dialog").close()); $("#erase-confirmation").addEventListener("input", (event) => { $("#confirm-erase").disabled = event.target.value !== "ERASE ANALYTICS"; });
  $("#erase-dialog").addEventListener("close", (event) => event.currentTarget._returnFocus?.focus());
  $("#erase-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const error = $("#erase-error"); const status = $("#erase-status"); error.hidden = true; $("#confirm-erase").disabled = true;
    try {
      await request("/v1/admin/analytics", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "ERASE ANALYTICS" }) });
      $("#erase-dialog").close(); status.textContent = "Analytics reset. Finishing removal of the previous history…"; status.hidden = false; await load();
      let complete = false;
      for (let attempt = 0; attempt < 20 && !complete; attempt += 1) {
        const summary = await request(`/v1/admin/analytics/summary?range=${$("#range").value}`);
        complete = summary.purgeStatus === "complete";
        if (!complete) await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      status.textContent = complete ? "All analytics were erased." : "Analytics are reset. Secure removal is still finishing in the background.";
    } catch (caught) { error.textContent = caught.message; error.hidden = false; $("#confirm-erase").disabled = false; }
  });
  void initialize();
})();
