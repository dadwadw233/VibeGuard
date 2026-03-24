// VibeGuard Dashboard App

const API = "";
let currentPage = 0;
const PAGE_SIZE = 50;

// --- Tab Navigation ---
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");

    if (btn.dataset.tab === "overview") loadOverview();
    if (btn.dataset.tab === "events") loadEvents();
    if (btn.dataset.tab === "rules") loadRules();
  });
});

// --- Overview ---
async function loadOverview() {
  try {
    const stats = await fetch(`${API}/api/stats`).then((r) => r.json());

    document.getElementById("stat-total").textContent = stats.total_events;
    document.getElementById("stat-blocked").textContent = stats.blocked_count;
    document.getElementById("stat-secrets").textContent = stats.by_category.secret ?? 0;
    document.getElementById("stat-commands").textContent = stats.by_category["dangerous-command"] ?? 0;

    renderDailyChart(stats.recent_daily);
    renderSeverityBars(stats.by_severity);
  } catch (err) {
    console.error("Failed to load stats:", err);
  }
}

function renderDailyChart(daily) {
  const container = document.getElementById("daily-chart");
  if (!daily || daily.length === 0) {
    container.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 40px;">No data yet</div>';
    return;
  }

  const maxCount = Math.max(...daily.map((d) => d.count), 1);
  container.innerHTML = daily
    .reverse()
    .map(
      (d) =>
        `<div class="chart-bar" style="height: ${Math.max((d.count / maxCount) * 100, 2)}%">
          <div class="tooltip">${d.date}: ${d.count} events</div>
        </div>`
    )
    .join("");
}

function renderSeverityBars(bySeverity) {
  const container = document.getElementById("severity-bars");
  const severities = ["critical", "high", "medium", "low"];
  const colors = {
    critical: "var(--red)",
    high: "var(--orange)",
    medium: "var(--yellow)",
    low: "var(--green)",
  };
  const total = Object.values(bySeverity).reduce((a, b) => a + b, 0) || 1;

  container.innerHTML = severities
    .map((sev) => {
      const count = bySeverity[sev] ?? 0;
      const pct = (count / total) * 100;
      return `
        <div class="severity-bar-row">
          <div class="severity-bar-label" style="color: ${colors[sev]}">${sev}</div>
          <div class="severity-bar-track">
            <div class="severity-bar-fill" style="width: ${pct}%; background: ${colors[sev]}"></div>
          </div>
          <div class="severity-bar-count">${count}</div>
        </div>`;
    })
    .join("");
}

// --- Events ---
async function loadEvents() {
  const category = document.getElementById("filter-category").value;
  const severity = document.getElementById("filter-severity").value;
  const blocked = document.getElementById("filter-blocked").value;

  const params = new URLSearchParams({
    limit: PAGE_SIZE.toString(),
    offset: (currentPage * PAGE_SIZE).toString(),
  });
  if (category) params.set("category", category);
  if (severity) params.set("severity", severity);
  if (blocked) params.set("blocked", blocked);

  try {
    const events = await fetch(`${API}/api/events?${params}`).then((r) => r.json());
    renderEventsTable(events);
    document.getElementById("page-info").textContent = `Page ${currentPage + 1}`;
    document.getElementById("btn-prev").disabled = currentPage === 0;
    document.getElementById("btn-next").disabled = events.length < PAGE_SIZE;
  } catch (err) {
    console.error("Failed to load events:", err);
  }
}

function renderEventsTable(events) {
  const tbody = document.getElementById("events-body");
  if (events.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 40px;">No events found</td></tr>';
    return;
  }

  tbody.innerHTML = events
    .map(
      (e) => `
    <tr>
      <td>${formatTime(e.timestamp)}</td>
      <td><code>${e.tool_name}</code></td>
      <td><span class="cat-badge">${e.category}</span></td>
      <td><code>${e.rule_id}</code></td>
      <td><span class="badge badge-${e.severity}">${e.severity}</span></td>
      <td><span class="${e.blocked ? "status-blocked" : "status-allowed"}">${e.blocked ? "BLOCKED" : "ALLOWED"}</span></td>
      <td title="${escapeHtml(e.match_redacted || e.description)}">${truncate(e.file_path || e.match_redacted || e.description, 40)}</td>
    </tr>`
    )
    .join("");
}

function formatTime(ts) {
  if (!ts) return "-";
  const d = new Date(ts + "Z");
  return d.toLocaleString();
}

function truncate(str, max) {
  if (!str) return "-";
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

document.getElementById("btn-refresh").addEventListener("click", () => loadEvents());
document.getElementById("filter-category").addEventListener("change", () => { currentPage = 0; loadEvents(); });
document.getElementById("filter-severity").addEventListener("change", () => { currentPage = 0; loadEvents(); });
document.getElementById("filter-blocked").addEventListener("change", () => { currentPage = 0; loadEvents(); });
document.getElementById("btn-prev").addEventListener("click", () => { currentPage--; loadEvents(); });
document.getElementById("btn-next").addEventListener("click", () => { currentPage++; loadEvents(); });

// --- Rules ---
async function loadRules() {
  try {
    const rules = await fetch(`${API}/api/rules`).then((r) => r.json());
    renderRules(rules);
  } catch (err) {
    console.error("Failed to load rules:", err);
  }
}

function renderRules(rules) {
  const container = document.getElementById("rules-list");
  const filterCategory = document.getElementById("rules-filter-category").value;

  const filtered = filterCategory ? rules.filter((r) => r.category === filterCategory) : rules;

  container.innerHTML = filtered
    .map(
      (r) => `
    <div class="rule-item">
      <label class="rule-toggle">
        <input type="checkbox" ${r.enabled ? "checked" : ""} data-rule-id="${r.id}" data-builtin="${r.builtin}">
        <span class="slider"></span>
      </label>
      <div class="rule-info">
        <div class="rule-id">${r.id}</div>
        <div class="rule-desc">${escapeHtml(r.description)}</div>
      </div>
      <div class="rule-meta">
        <span class="cat-badge">${r.category}</span>
        <span class="badge badge-${r.severity}">${r.severity}</span>
        ${!r.builtin ? `<button class="rule-delete" data-rule-id="${r.id}" title="Delete">&times;</button>` : ""}
      </div>
    </div>`
    )
    .join("");

  // Toggle handlers
  container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", async (e) => {
      const ruleId = e.target.dataset.ruleId;
      await fetch(`${API}/api/rules/${ruleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: e.target.checked }),
      });
    });
  });

  // Delete handlers
  container.querySelectorAll(".rule-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const ruleId = e.target.dataset.ruleId;
      if (confirm(`Delete custom rule "${ruleId}"?`)) {
        await fetch(`${API}/api/rules/custom/${ruleId}`, { method: "DELETE" });
        loadRules();
      }
    });
  });
}

document.getElementById("rules-filter-category").addEventListener("change", () => loadRules());

// Add Custom Rule
document.getElementById("btn-add-rule").addEventListener("click", () => {
  document.getElementById("add-rule-form").classList.remove("hidden");
});

document.getElementById("btn-cancel-rule").addEventListener("click", () => {
  document.getElementById("add-rule-form").classList.add("hidden");
});

document.getElementById("btn-save-rule").addEventListener("click", async () => {
  const id = document.getElementById("rule-id").value.trim();
  const description = document.getElementById("rule-desc").value.trim();
  const category = document.getElementById("rule-category").value;
  const regex = document.getElementById("rule-regex").value.trim();
  const severity = document.getElementById("rule-severity").value;

  if (!id || !description || !regex) {
    alert("Please fill in all required fields.");
    return;
  }

  try {
    new RegExp(regex);
  } catch {
    alert("Invalid regex pattern.");
    return;
  }

  const res = await fetch(`${API}/api/rules/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, description, category, regex, severity }),
  });

  if (res.ok) {
    document.getElementById("add-rule-form").classList.add("hidden");
    document.getElementById("rule-id").value = "";
    document.getElementById("rule-desc").value = "";
    document.getElementById("rule-regex").value = "";
    loadRules();
  } else {
    const err = await res.json();
    alert(err.error || "Failed to save rule.");
  }
});

// --- Init ---
loadOverview();
