const API = "";
const PAGE_SIZE = 50;
const STATUS_CLASSES = ["status-live", "status-watch", "status-error"];

const CATEGORY_META = {
  secret: { label: "Secrets", className: "cat-secret" },
  "sensitive-file": { label: "Sensitive File", className: "cat-sensitive-file" },
  "dangerous-command": { label: "Dangerous Command", className: "cat-dangerous-command" },
};

const SEVERITY_META = {
  critical: { label: "Critical", color: "var(--critical)" },
  high: { label: "High", color: "var(--high)" },
  medium: { label: "Medium", color: "var(--medium)" },
  low: { label: "Low", color: "var(--low)" },
};

let currentPage = 0;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const details =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(details);
  }

  return payload;
}

function setHeaderStatus(message, tone = "live") {
  const node = document.getElementById("header-status");
  if (!node) return;
  node.classList.remove(...STATUS_CLASSES);
  node.classList.add(`status-${tone}`);
  node.textContent = message;
}

function activateTab(tabId) {
  const targetButton = document.querySelector(`.tab[data-tab="${tabId}"]`);
  const targetPanel = document.getElementById(tabId);
  if (!targetButton || !targetPanel) return;

  document.querySelectorAll(".tab").forEach((button) => button.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((section) => section.classList.remove("active"));

  targetButton.classList.add("active");
  targetPanel.classList.add("active");

  if (tabId === "overview") loadOverview();
  if (tabId === "events") loadEvents();
  if (tabId === "rules") loadRules();
}

function renderSkeletonRows(targetId, count) {
  const node = document.getElementById(targetId);
  if (!node) return;
  node.innerHTML = Array.from({ length: count })
    .map(() => '<div class="skeleton skeleton-row"></div>')
    .join("");
}

function renderEmptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function setOverviewLoading() {
  document.getElementById("stat-total").textContent = "...";
  document.getElementById("stat-blocked").textContent = "...";
  document.getElementById("stat-secrets").textContent = "...";
  document.getElementById("stat-commands").textContent = "...";
  renderSkeletonRows("daily-chart", 16);
  renderSkeletonRows("severity-bars", 4);
}

async function loadOverview() {
  setOverviewLoading();
  try {
    const stats = await fetchJson(`${API}/api/stats`);

    document.getElementById("stat-total").textContent = formatCount(stats.total_events ?? 0);
    document.getElementById("stat-blocked").textContent = formatCount(stats.blocked_count ?? 0);
    document.getElementById("stat-secrets").textContent = formatCount(stats.by_category?.secret ?? 0);
    document.getElementById("stat-commands").textContent = formatCount(stats.by_category?.["dangerous-command"] ?? 0);

    renderDailyChart(stats.recent_daily ?? []);
    renderSeverityBars(stats.by_severity ?? {});

    if ((stats.blocked_count ?? 0) > 0) {
      setHeaderStatus(`Watch: ${formatCount(stats.blocked_count)} blocked`, "watch");
    } else {
      setHeaderStatus(`Live: ${formatCount(stats.total_events ?? 0)} events monitored`, "live");
    }
  } catch (err) {
    console.error("Failed to load stats:", err);
    document.getElementById("daily-chart").innerHTML = renderEmptyState("Unable to load trend data.");
    document.getElementById("severity-bars").innerHTML = renderEmptyState("Unable to load severity data.");
    setHeaderStatus("Dashboard sync failed", "error");
  }
}

function renderDailyChart(daily) {
  const container = document.getElementById("daily-chart");
  if (!daily || daily.length === 0) {
    container.innerHTML = renderEmptyState("No event activity in the selected period.");
    return;
  }

  const maxCount = Math.max(...daily.map((entry) => entry.count), 1);
  container.innerHTML = daily
    .slice()
    .reverse()
    .map((entry) => {
      const height = Math.max((entry.count / maxCount) * 100, 2);
      const label = `${entry.date}: ${entry.count} event${entry.count === 1 ? "" : "s"}`;
      return `
        <div class="chart-bar" style="height:${height}%" aria-label="${escapeHtml(label)}">
          <div class="tooltip">${escapeHtml(label)}</div>
        </div>`;
    })
    .join("");
}

function renderSeverityBars(bySeverity) {
  const container = document.getElementById("severity-bars");
  const severityOrder = ["critical", "high", "medium", "low"];
  const total = severityOrder.reduce((sum, severity) => sum + (bySeverity[severity] ?? 0), 0);

  if (total === 0) {
    container.innerHTML = renderEmptyState("No severity distribution available yet.");
    return;
  }

  container.innerHTML = severityOrder
    .map((severity) => {
      const meta = SEVERITY_META[severity];
      const count = bySeverity[severity] ?? 0;
      const width = (count / total) * 100;
      return `
        <div class="severity-bar-row">
          <div class="severity-bar-label" style="color:${meta.color}">${meta.label}</div>
          <div class="severity-bar-track">
            <div class="severity-bar-fill" style="width:${width}%; background:${meta.color}"></div>
          </div>
          <div class="severity-bar-count">${count}</div>
        </div>`;
    })
    .join("");
}

function setEventsLoading() {
  const tbody = document.getElementById("events-body");
  tbody.innerHTML = `
    <tr>
      <td colspan="7">
        <div class="skeleton skeleton-row"></div>
        <div class="skeleton skeleton-row"></div>
        <div class="skeleton skeleton-row"></div>
      </td>
    </tr>`;
}

async function loadEvents() {
  const category = document.getElementById("filter-category").value;
  const severity = document.getElementById("filter-severity").value;
  const blocked = document.getElementById("filter-blocked").value;

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(currentPage * PAGE_SIZE),
  });

  if (category) params.set("category", category);
  if (severity) params.set("severity", severity);
  if (blocked) params.set("blocked", blocked);

  setEventsLoading();

  try {
    const events = await fetchJson(`${API}/api/events?${params}`);
    renderEventsTable(events);

    document.getElementById("page-info").textContent = `Page ${currentPage + 1}`;
    document.getElementById("btn-prev").disabled = currentPage === 0;
    document.getElementById("btn-next").disabled = events.length < PAGE_SIZE;
  } catch (err) {
    console.error("Failed to load events:", err);
    document.getElementById("events-body").innerHTML = `
      <tr>
        <td colspan="7">
          ${renderEmptyState("Failed to load events. Try refreshing.")}
        </td>
      </tr>`;
    setHeaderStatus("Event query failed", "error");
  }
}

function renderEventsTable(events) {
  const tbody = document.getElementById("events-body");
  if (!events || events.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">${renderEmptyState("No matching events found.")}</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = events
    .map((event) => {
      const category = renderCategoryBadge(event.category);
      const severity = renderSeverityBadge(event.severity);
      const status = renderStatusTag(event.blocked);
      const detail = truncate(event.file_path || event.match_redacted || event.description, 52);
      const detailTitle = escapeHtml(event.match_redacted || event.description || "");
      return `
        <tr>
          <td>${formatTime(event.timestamp)}</td>
          <td><code>${escapeHtml(event.tool_name || "-")}</code></td>
          <td>${category}</td>
          <td><code>${escapeHtml(event.rule_id || "-")}</code></td>
          <td>${severity}</td>
          <td>${status}</td>
          <td class="detail-cell" title="${detailTitle}">${escapeHtml(detail)}</td>
        </tr>`;
    })
    .join("");
}

function setRulesLoading() {
  renderSkeletonRows("rules-list", 6);
}

async function loadRules() {
  setRulesLoading();
  try {
    const rules = await fetchJson(`${API}/api/rules`);
    renderRules(rules);
  } catch (err) {
    console.error("Failed to load rules:", err);
    document.getElementById("rules-list").innerHTML = renderEmptyState("Failed to load rules.");
    setHeaderStatus("Rule load failed", "error");
  }
}

function renderRules(rules) {
  const container = document.getElementById("rules-list");
  const filterCategory = document.getElementById("rules-filter-category").value;
  const filtered = filterCategory ? rules.filter((rule) => rule.category === filterCategory) : rules;

  if (filtered.length === 0) {
    container.innerHTML = renderEmptyState("No rules match this filter.");
    return;
  }

  container.innerHTML = filtered
    .map((rule) => {
      return `
        <div class="rule-item">
          <label class="rule-toggle">
            <input type="checkbox" ${rule.enabled ? "checked" : ""} data-rule-id="${escapeHtml(rule.id)}" data-rule-builtin="${rule.builtin ? "true" : "false"}">
            <span class="slider"></span>
          </label>
          <div class="rule-info">
            <div class="rule-id">${escapeHtml(rule.id)}</div>
            <div class="rule-desc">${escapeHtml(rule.description)}</div>
          </div>
          <div class="rule-meta">
            ${renderCategoryBadge(rule.category)}
            ${renderSeverityBadge(rule.severity)}
            ${!rule.builtin ? `<button class="rule-delete" data-rule-id="${escapeHtml(rule.id)}" title="Delete rule">&times;</button>` : ""}
          </div>
        </div>`;
    })
    .join("");

  container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
      const ruleId = event.target.dataset.ruleId;
      const builtin = event.target.dataset.ruleBuiltin === "true";
      try {
        await fetch(`${API}/api/rules/${ruleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: event.target.checked, builtin }),
        });
      } catch (err) {
        console.error("Failed to update rule:", err);
        setHeaderStatus("Rule update failed", "error");
      }
    });
  });

  container.querySelectorAll(".rule-delete").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const ruleId = event.target.dataset.ruleId;
      if (!confirm(`Delete custom rule "${ruleId}"?`)) return;

      try {
        await fetch(`${API}/api/rules/custom/${ruleId}`, { method: "DELETE" });
        loadRules();
      } catch (err) {
        console.error("Failed to delete custom rule:", err);
        setHeaderStatus("Rule deletion failed", "error");
      }
    });
  });
}

function renderCategoryBadge(category) {
  const meta = CATEGORY_META[category] ?? { label: category || "Unknown", className: "" };
  return `<span class="cat-badge ${meta.className}">${escapeHtml(meta.label)}</span>`;
}

function renderSeverityBadge(severity) {
  const normalized = String(severity || "low").toLowerCase();
  const meta = SEVERITY_META[normalized] ?? { label: normalized, color: "var(--text-muted)" };
  return `<span class="badge badge-${escapeHtml(normalized)}">${escapeHtml(meta.label)}</span>`;
}

function renderStatusTag(blocked) {
  return blocked
    ? '<span class="status-tag status-tag-blocked">Blocked</span>'
    : '<span class="status-tag status-tag-allowed">Allowed</span>';
}

function formatTime(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(`${timestamp}Z`);
  return date.toLocaleString();
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function truncate(value, maxLength) {
  if (!value) return "-";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

document.querySelector(".btn-ghost[href=\"#events\"]")?.addEventListener("click", (event) => {
  event.preventDefault();
  activateTab("events");
  document.getElementById("events")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("btn-refresh").addEventListener("click", () => loadEvents());
document.getElementById("filter-category").addEventListener("change", () => {
  currentPage = 0;
  loadEvents();
});
document.getElementById("filter-severity").addEventListener("change", () => {
  currentPage = 0;
  loadEvents();
});
document.getElementById("filter-blocked").addEventListener("change", () => {
  currentPage = 0;
  loadEvents();
});

document.getElementById("btn-prev").addEventListener("click", () => {
  currentPage = Math.max(0, currentPage - 1);
  loadEvents();
});

document.getElementById("btn-next").addEventListener("click", () => {
  currentPage += 1;
  loadEvents();
});

document.getElementById("rules-filter-category").addEventListener("change", () => loadRules());

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

  try {
    await fetchJson(`${API}/api/rules/custom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, description, category, regex, severity }),
    });

    document.getElementById("add-rule-form").classList.add("hidden");
    document.getElementById("rule-id").value = "";
    document.getElementById("rule-desc").value = "";
    document.getElementById("rule-regex").value = "";
    setHeaderStatus("Custom rule added", "live");
    loadRules();
  } catch (err) {
    console.error("Failed to save custom rule:", err);
    setHeaderStatus("Rule creation failed", "error");
  }
});

setHeaderStatus("Syncing dashboard", "live");
loadOverview();
