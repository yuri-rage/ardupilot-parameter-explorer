/**
 * ArduPilot Parameter Explorer - Main Application Controller
 */

import {
	fetchGitHubTags,
	getVehicleLogMessages,
	getVehicleParameters,
	PRESET_VERSIONS,
	VEHICLES,
} from "./api.js";
import {
	downloadFile,
	generateCsvFile,
	generateJsonFile,
	generateLogCsvFile,
	generateLogJsonFile,
	generateParamFile,
} from "./exporter.js";

// Global Application State
const state = {
	activeMode: "params", // "params" or "logs"
	currentVehicle: VEHICLES[0],
	currentVersion: "master",
	parameters: [],
	filteredParameters: [],
	logMessages: [],
	filteredLogMessages: [],
	activeCategory: "ALL",
	searchQuery: "",
	currentPage: 1,
	pageSize: 50,
	availableTags: [],
};

// DOM Elements Cache (Dynamic Getters to prevent null elements on script init)
const elements = {
	get appHeaderTitle() {
		return document.getElementById("app-header-title");
	},
	get appSubtitle() {
		return document.getElementById("app-subtitle");
	},
	get modeBtnParams() {
		return document.getElementById("mode-btn-params");
	},
	get modeBtnLogs() {
		return document.getElementById("mode-btn-logs");
	},

	get vehicleRow() {
		return document.getElementById("vehicle-card-row");
	},
	get versionSelectGroup() {
		return document.getElementById("version-select-group");
	},
	get versionSelect() {
		return document.getElementById("version-select");
	},
	get searchLabel() {
		return document.getElementById("search-label");
	},
	get searchInput() {
		return document.getElementById("search-input");
	},
	get searchClear() {
		return document.getElementById("search-clear");
	},
	get categoryBar() {
		return document.getElementById("category-bar");
	},
	get tableHead() {
		return document.getElementById("table-head");
	},
	get tableBody() {
		return document.getElementById("param-table-body");
	},
	get statsCount() {
		return document.getElementById("stats-count");
	},
	get loadingSpinner() {
		return document.getElementById("loading-spinner");
	},
	get emptyState() {
		return document.getElementById("empty-state");
	},
	get errorState() {
		return document.getElementById("error-state");
	},
	get tagStatus() {
		return document.getElementById("tag-status");
	},
	get pageIndicator() {
		return document.getElementById("page-indicator");
	},
	get btnPrevPage() {
		return document.getElementById("btn-prev-page");
	},
	get btnNextPage() {
		return document.getElementById("btn-next-page");
	},
	get pageSizeSelect() {
		return document.getElementById("page-size-select");
	},

	// Exporters & Actions
	get btnExportParam() {
		return document.getElementById("btn-export-param");
	},
	get btnExportCsv() {
		return document.getElementById("btn-export-csv");
	},
	get btnExportJson() {
		return document.getElementById("btn-export-json");
	},
	get btnShareLink() {
		return document.getElementById("btn-share-link");
	},
	get btnCompare() {
		return document.getElementById("btn-compare");
	},

	// Detail Drawer
	get drawerOverlay() {
		return document.getElementById("drawer-overlay");
	},
	get drawer() {
		return document.getElementById("drawer");
	},
	get drawerTitle() {
		return document.getElementById("drawer-title");
	},
	get drawerSubtitle() {
		return document.getElementById("drawer-subtitle");
	},
	get drawerBody() {
		return document.getElementById("drawer-body");
	},
	get drawerClose() {
		return document.getElementById("drawer-close");
	},

	// Compare Modal
	get compareModalOverlay() {
		return document.getElementById("compare-modal-overlay");
	},
	get compareClose() {
		return document.getElementById("compare-close");
	},
	get compareVer1() {
		return document.getElementById("compare-ver-1");
	},
	get compareVer2() {
		return document.getElementById("compare-ver-2");
	},
	get compareFilter() {
		return document.getElementById("compare-filter");
	},
	get btnRunCompare() {
		return document.getElementById("btn-run-compare");
	},
	get compareResults() {
		return document.getElementById("compare-results");
	},

	get toastContainer() {
		return document.getElementById("toast-container");
	},
};

// Application Initialization
document.addEventListener("DOMContentLoaded", async () => {
	// Parse URL parameters FIRST so state matches URL before initial render
	setupUrlParams();

	renderVehicleCards();
	populateVersionSelect();
	setupEventListeners();

	// Global Event Delegation for Mode Switcher Buttons
	document.addEventListener("click", (e) => {
		const modeBtn = e.target.closest(".mode-btn");
		if (modeBtn) {
			const targetMode = modeBtn.getAttribute("data-mode");
			if (targetMode) switchMode(targetMode);
		}
	});

	// Load GitHub Tags asynchronously
	loadTags();

	// Initial Data Fetch
	if (state.activeMode === "logs") {
		await loadLogMessages();
	} else {
		await loadParameters();
	}
});

/**
 * Switch Active Mode (Parameters vs Log Messages)
 */
function switchMode(newMode) {
	state.activeMode = newMode;
	state.activeCategory = "ALL";
	state.searchQuery = "";
	state.currentPage = 1;
	if (elements.searchInput) elements.searchInput.value = "";
	if (elements.searchClear) elements.searchClear.style.display = "none";

	if (newMode === "logs") {
		if (elements.modeBtnParams)
			elements.modeBtnParams.classList.remove("active");
		if (elements.modeBtnLogs) elements.modeBtnLogs.classList.add("active");
		if (elements.appHeaderTitle)
			elements.appHeaderTitle.textContent = "Log Message Explorer";
		if (elements.appSubtitle) {
			elements.appSubtitle.innerHTML =
				'Explore on-board DataFlash log message formats, data types, measurement units, and field definitions across all ArduPilot vehicles. <span class="subtitle-note"><i class="fa-solid fa-circle-info"></i> Reflects official log message documentation compiled from source.</span>';
		}

		if (elements.versionSelectGroup)
			elements.versionSelectGroup.style.display = "flex";
		if (elements.btnCompare) elements.btnCompare.style.display = "none";
		if (elements.btnExportParam) elements.btnExportParam.style.display = "none";

		if (elements.searchLabel)
			elements.searchLabel.textContent = "Search Log Messages";
		if (elements.searchInput) {
			elements.searchInput.placeholder =
				"Search by message (e.g. ACC, ATT, GPS), field name (e.g. TimeUS), description...";
		}
		const label = document.querySelector('label[for="page-size-select"]');
		if (label) label.textContent = "Log Messages per page:";

		// Table Header for Log Messages
		if (elements.tableHead) {
			elements.tableHead.innerHTML = `
				<tr>
					<th style="width: 150px">Log Message</th>
					<th style="width: 120px">Fields</th>
					<th style="width: 260px">Field Names</th>
					<th>Description</th>
					<th style="width: 80px; text-align: center">Details</th>
				</tr>
			`;
		}

		loadLogMessages();
	} else {
		if (elements.modeBtnParams) elements.modeBtnParams.classList.add("active");
		if (elements.modeBtnLogs) elements.modeBtnLogs.classList.remove("active");
		if (elements.appHeaderTitle)
			elements.appHeaderTitle.textContent = "Parameter Explorer";
		if (elements.appSubtitle) {
			elements.appSubtitle.innerHTML =
				'Search, inspect, compare, and export default parameter configurations across all ArduPilot vehicles and firmware releases. <span class="subtitle-note"><i class="fa-solid fa-circle-info"></i> Reflects base firmware defaults (board-specific hardware defaults may vary).</span>';
		}

		if (elements.versionSelectGroup)
			elements.versionSelectGroup.style.display = "flex";
		if (elements.btnCompare) elements.btnCompare.style.display = "inline-flex";
		if (elements.btnExportParam)
			elements.btnExportParam.style.display = "inline-flex";

		if (elements.searchLabel)
			elements.searchLabel.textContent = "Search Parameters";
		if (elements.searchInput) {
			elements.searchInput.placeholder =
				"Search by parameter name (e.g. ANGLE_MAX), description, or unit...";
		}
		const label = document.querySelector('label[for="page-size-select"]');
		if (label) label.textContent = "Parameters per page:";

		// Table Header for Parameters
		if (elements.tableHead) {
			elements.tableHead.innerHTML = `
				<tr>
					<th style="width: 220px">Parameter Name</th>
					<th style="width: 130px">Default Value</th>
					<th style="width: 160px">Range</th>
					<th style="width: 90px">Units</th>
					<th>Description & Details</th>
					<th style="width: 80px; text-align: center">Details</th>
				</tr>
			`;
		}

		loadParameters();
	}
}

/**
 * Load dynamic GitHub tags
 */

async function loadTags() {
	try {
		const tags = await fetchGitHubTags();
		state.availableTags = tags;
		elements.tagStatus.textContent = tags.length
			? `${tags.length} Release Tags Loaded`
			: "Using Preset Version Tags";
		populateVersionSelect();
	} catch {
		elements.tagStatus.textContent = "Using Preset Release Tags";
	}
}

// FontAwesome has no blimp/airship glyph; hand-drawn flat silhouette as a stand-in.
// Flipped vertically, the same envelope + fin + strut-mounted pod also reads as a submarine hull & conning tower.
const CUSTOM_VEHICLE_ICONS = {
	Blimp: `<svg viewBox="40 75 560 290" width="1em" height="1em" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <ellipse cx="290" cy="190" rx="230" ry="95"/>
    <polygon points="480,130 480,250 590,190"/>
    <line x1="255" y1="283" x2="248" y2="302" stroke="currentColor" stroke-width="14" stroke-linecap="round"/>
    <line x1="325" y1="283" x2="332" y2="302" stroke="currentColor" stroke-width="14" stroke-linecap="round"/>
    <rect x="228" y="300" width="124" height="42" rx="14"/>
  </svg>`,
	ArduSub: `<svg viewBox="40 75 560 290" width="1em" height="1em" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <g transform="translate(0,440) scale(1,-1)">
      <ellipse cx="290" cy="190" rx="230" ry="95"/>
      <polygon points="480,130 480,250 590,190"/>
      <line x1="255" y1="283" x2="248" y2="302" stroke="currentColor" stroke-width="14" stroke-linecap="round"/>
      <line x1="325" y1="283" x2="332" y2="302" stroke="currentColor" stroke-width="14" stroke-linecap="round"/>
      <rect x="228" y="300" width="124" height="42" rx="14"/>
    </g>
  </svg>`,
};

/**
 * Render Vehicle Selection Buttons (Rover & Tracker separated)
 */
function renderVehicleCards() {
	elements.vehicleRow.innerHTML = VEHICLES.map((v) => {
		const safeName = escapeHtml(v.name);
		const iconMarkup = CUSTOM_VEHICLE_ICONS[v.id]
			? `<i class="vehicle-icon-custom">${CUSTOM_VEHICLE_ICONS[v.id]}</i>`
			: `<i class="fa-solid fa-${escapeHtml(v.icon)}"></i>`;
		return `
    <button class="vehicle-btn ${v.id === state.currentVehicle.id ? "active" : ""}" data-id="${v.id}">
      ${iconMarkup} ${safeName}
    </button>
  `;
	}).join("");

	elements.vehicleRow.querySelectorAll(".vehicle-btn").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const id = e.currentTarget.getAttribute("data-id");
			const v = VEHICLES.find((item) => item.id === id);
			if (v && v.id !== state.currentVehicle.id) {
				state.currentVehicle = v;
				state.activeCategory = "ALL";
				state.currentPage = 1;
				renderVehicleCards();
				populateVersionSelect();
				if (state.activeMode === "logs") {
					loadLogMessages();
				} else {
					loadParameters();
				}
			}
		});
	});
}

/**
 * SemVer Tag Sorter (Newest -> Oldest)
 */
function sortVersionTags(tags) {
	const hasMaster = tags.includes("master");
	const otherTags = tags.filter((t) => t !== "master");

	otherTags.sort((a, b) => {
		const parseVer = (tagStr) => {
			const match = tagStr.match(/(\d+)\.(\d+)\.(\d+)/);
			if (match) {
				return [
					parseInt(match[1], 10),
					parseInt(match[2], 10),
					parseInt(match[3], 10),
				];
			}
			return [0, 0, 0];
		};

		const vA = parseVer(a);
		const vB = parseVer(b);

		if (vA[0] !== vB[0]) return vB[0] - vA[0];
		if (vA[1] !== vB[1]) return vB[1] - vA[1];
		if (vA[2] !== vB[2]) return vB[2] - vA[2];

		return b.localeCompare(a);
	});

	return hasMaster ? ["master", ...otherTags] : otherTags;
}

/**
 * Populate Version Dropdown using exact vehicle tag prefixes
 */
function populateVersionSelect() {
	const presets = PRESET_VERSIONS[state.currentVehicle.id] || ["master"];
	const prefixes = state.currentVehicle.tagPrefixes || [];

	// Filter GitHub tags matching vehicle prefixes
	const matchedTags = state.availableTags.filter((tag) =>
		prefixes.some((prefix) =>
			tag.toLowerCase().startsWith(prefix.toLowerCase()),
		),
	);

	const combined = sortVersionTags(
		Array.from(new Set([...presets, ...matchedTags])),
	);

	elements.versionSelect.innerHTML = combined
		.map((ver) => {
			const safeVer = escapeHtml(ver);
			return `
    <option value="${safeVer}" ${ver === state.currentVersion ? "selected" : ""}>
      ${ver === "master" ? "master (Latest Dev Branch)" : safeVer}
    </option>
  `;
		})
		.join("");

	// Populate comparison dropdowns
	elements.compareVer1.innerHTML = elements.versionSelect.innerHTML;
	elements.compareVer2.innerHTML = elements.versionSelect.innerHTML;

	if (combined.length > 1) {
		elements.compareVer2.selectedIndex = 1;
	}
}

/**
 * Main Parameter Fetcher & Renderer
 */
async function loadParameters() {
	elements.loadingSpinner.style.display = "block";
	elements.tableBody.innerHTML = "";
	elements.emptyState.style.display = "none";
	if (elements.errorState) elements.errorState.style.display = "none";
	elements.statsCount.textContent = "Loading parameters...";

	try {
		state.parameters = await getVehicleParameters(
			state.currentVehicle.id,
			state.currentVersion,
		);
		applyFilters();
		syncUrl();
	} catch (err) {
		console.error("Error loading parameters:", err);
		showToast("Failed to load parameter data. Check connection.", "error");
		if (elements.errorState) elements.errorState.style.display = "block";
	} finally {
		elements.loadingSpinner.style.display = "none";
	}
}

/**
 * Log Message Fetcher & Renderer
 */
async function loadLogMessages() {
	elements.loadingSpinner.style.display = "block";
	elements.tableBody.innerHTML = "";
	elements.emptyState.style.display = "none";
	if (elements.errorState) elements.errorState.style.display = "none";
	elements.statsCount.textContent = "Loading log messages...";

	try {
		state.logMessages = await getVehicleLogMessages(
			state.currentVehicle.id,
			state.currentVersion,
		);
		applyFilters();
		syncUrl();
	} catch (err) {
		console.error("Error loading log messages:", err);
		showToast(
			"Failed to load log message metadata. Check connection.",
			"error",
		);
		if (elements.errorState) elements.errorState.style.display = "block";
	} finally {
		elements.loadingSpinner.style.display = "none";
	}
}

/**
 * Filter Items based on search query & active category
 */
function applyFilters() {
	const query = state.searchQuery.toLowerCase().trim();
	const category = state.activeCategory;

	if (state.activeMode === "logs") {
		state.filteredLogMessages = state.logMessages.filter((m) => {
			const matchesCategory = category === "ALL" || m.category === category;
			const matchesSearch =
				!query ||
				m.name.toLowerCase().includes(query) ||
				m.description.toLowerCase().includes(query) ||
				m.fields.some(
					(f) =>
						f.name.toLowerCase().includes(query) ||
						f.type.toLowerCase().includes(query) ||
						f.units.toLowerCase().includes(query) ||
						f.description.toLowerCase().includes(query),
				);
			return matchesCategory && matchesSearch;
		});
	} else {
		state.filteredParameters = state.parameters.filter((p) => {
			const matchesCategory = category === "ALL" || p.category === category;
			const matchesSearch =
				!query ||
				p.name.toLowerCase().includes(query) ||
				p.displayName.toLowerCase().includes(query) ||
				p.description.toLowerCase().includes(query) ||
				p.units.toLowerCase().includes(query);

			return matchesCategory && matchesSearch;
		});
	}

	state.currentPage = 1;
	renderCategoriesBar();
	renderTable();
}

/**
 * Render Category Filter Pills
 */
function renderCategoriesBar() {
	const source =
		state.activeMode === "logs" ? state.logMessages : state.parameters;
	const categories = ["ALL", ...new Set(source.map((item) => item.category))];

	elements.categoryBar.innerHTML = categories
		.map((cat) => {
			const safeCat = escapeHtml(cat);
			return `
    <button class="cat-pill ${cat === state.activeCategory ? "active" : ""}" data-cat="${safeCat}">
      ${safeCat}
    </button>
  `;
		})
		.join("");

	elements.categoryBar.querySelectorAll(".cat-pill").forEach((pill) => {
		pill.addEventListener("click", (e) => {
			state.activeCategory = e.currentTarget.getAttribute("data-cat");
			applyFilters();
		});
	});
}

/**
 * Render Paginated Table Rows
 */
function renderTable() {
	if (state.activeMode === "logs") {
		renderLogMessagesTable();
	} else {
		renderParametersTable();
	}
}

/**
 * Render Log Messages Table
 */
function renderLogMessagesTable() {
	const total = state.filteredLogMessages.length;
	elements.statsCount.innerHTML = `Showing <strong>${total}</strong> log message formats for ${escapeHtml(state.currentVehicle.name)} (<code>${escapeHtml(state.currentVersion)}</code>)`;

	if (total === 0) {
		elements.tableBody.innerHTML = "";
		elements.emptyState.style.display = "block";
		elements.pageIndicator.textContent = "Page 0 of 0";
		elements.btnPrevPage.disabled = true;
		elements.btnNextPage.disabled = true;
		return;
	}

	elements.emptyState.style.display = "none";

	const totalPages = Math.ceil(total / state.pageSize);
	if (state.currentPage > totalPages) state.currentPage = totalPages;
	const startIdx = (state.currentPage - 1) * state.pageSize;
	const pageItems = state.filteredLogMessages.slice(
		startIdx,
		startIdx + state.pageSize,
	);

	if (state.pageSize >= 100000) {
		elements.pageIndicator.textContent = `Showing all ${total} log messages`;
		elements.btnPrevPage.disabled = true;
		elements.btnNextPage.disabled = true;
	} else {
		elements.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages}`;
		elements.btnPrevPage.disabled = state.currentPage === 1;
		elements.btnNextPage.disabled = state.currentPage === totalPages;
	}

	elements.tableBody.innerHTML = pageItems
		.map((m) => {
			const safeName = escapeHtml(m.name);
			const fieldPills = m.fields
				.slice(0, 6)
				.map(
					(f) =>
						`<span class="field-pill" title="${escapeHtml(f.description || f.name)}">${escapeHtml(f.name)}</span>`,
				)
				.join("");
			const moreTag =
				m.fields.length > 6
					? `<span class="field-pill-more">+${m.fields.length - 6} more</span>`
					: "";

			return `
      <tr>
        <td>
          <span class="param-name" data-log-name="${safeName}" role="button" tabindex="0" aria-label="View log message ${safeName}">
            <i class="fa-solid fa-receipt" style="color: var(--accent-cyan); font-size: 0.85rem; margin-right: 4px;"></i> ${highlightText(m.name, state.searchQuery)}
          </span>
        </td>
        <td>
          <span class="val-pill">${m.fieldsCount} fields</span>
        </td>
        <td>
          <div class="field-pill-list">
            ${fieldPills} ${moreTag}
          </div>
        </td>
        <td>
          <div class="param-desc">
            <div class="param-desc-title">${highlightText(m.name, state.searchQuery)}</div>
            <div class="param-desc-text">${highlightText(m.description, state.searchQuery)}</div>
          </div>
        </td>
        <td style="text-align: center;">
          <button class="btn btn-secondary btn-log-detail" data-name="${safeName}" style="padding: 4px 10px; font-size: 0.8rem;">
            <i class="fa-solid fa-circle-info"></i> View
          </button>
        </td>
      </tr>
    `;
		})
		.join("");

	// Event Listeners for Log Message Rows
	elements.tableBody
		.querySelectorAll(".param-name[data-log-name]")
		.forEach((el) => {
			const openLog = () => {
				const name = el.getAttribute("data-log-name");
				if (name) openLogDetailDrawer(name);
			};
			el.addEventListener("click", openLog);
			el.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					openLog();
				}
			});
		});

	elements.tableBody.querySelectorAll(".btn-log-detail").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const name = e.currentTarget.getAttribute("data-name");
			openLogDetailDrawer(name);
		});
	});
}

/**
 * Render Parameters Table
 */
function renderParametersTable() {
	const total = state.filteredParameters.length;
	elements.statsCount.innerHTML = `Showing <strong>${total}</strong> parameters for ${escapeHtml(state.currentVehicle.name)} (<code>${escapeHtml(state.currentVersion)}</code>)`;

	if (total === 0) {
		elements.tableBody.innerHTML = "";
		elements.emptyState.style.display = "block";
		elements.pageIndicator.textContent = "Page 0 of 0";
		elements.btnPrevPage.disabled = true;
		elements.btnNextPage.disabled = true;
		return;
	}

	elements.emptyState.style.display = "none";

	// Pagination calculation
	const totalPages = Math.ceil(total / state.pageSize);
	if (state.currentPage > totalPages) state.currentPage = totalPages;
	const startIdx = (state.currentPage - 1) * state.pageSize;
	const pageParams = state.filteredParameters.slice(
		startIdx,
		startIdx + state.pageSize,
	);

	if (state.pageSize >= 100000) {
		elements.pageIndicator.textContent = `Showing all ${total} parameters`;
		elements.btnPrevPage.disabled = true;
		elements.btnNextPage.disabled = true;
	} else {
		elements.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages}`;
		elements.btnPrevPage.disabled = state.currentPage === 1;
		elements.btnNextPage.disabled = state.currentPage === totalPages;
	}

	elements.tableBody.innerHTML = pageParams
		.map((p) => {
			const rebootBadge = p.rebootRequired
				? `<span class="badge-reboot" title="Reboot required after changing">REBOOT</span>`
				: "";
			const readOnlyBadge = p.readOnly
				? `<span class="badge-reboot" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3);">READ ONLY</span>`
				: "";

			const safeName = escapeHtml(p.name);
			return `
      <tr>
        <td>
          <span class="param-name" data-name="${safeName}" role="button" tabindex="0" aria-label="Copy parameter name ${safeName}">${highlightText(p.name, state.searchQuery)} <i class="fa-regular fa-copy" style="font-size: 0.75rem; opacity: 0.5;" title="Copy parameter name"></i></span>
          ${rebootBadge} ${readOnlyBadge}
        </td>
        <td>
          <span class="range-tag">${escapeHtml(p.defaultValue)}</span>
        </td>
        <td>
          ${p.range ? `<span class="range-tag">${escapeHtml(p.range.min)} &ndash; ${escapeHtml(p.range.max)}</span>` : '<span style="color: var(--text-muted);">-</span>'}
        </td>
        <td>
          ${p.units ? `<span class="unit-tag">${escapeHtml(p.units)}</span>` : '<span style="color: var(--text-muted);">-</span>'}
        </td>
        <td>
          <div class="param-desc">
            <div class="param-desc-title">${highlightText(p.displayName, state.searchQuery)}</div>
            <div class="param-desc-text">${highlightText(p.description, state.searchQuery)}</div>
          </div>
        </td>
        <td style="text-align: center;">
          <button class="btn btn-secondary btn-detail" data-name="${safeName}" style="padding: 4px 10px; font-size: 0.8rem;">
            <i class="fa-solid fa-circle-info"></i> View
          </button>
        </td>
      </tr>
    `;
		})
		.join("");

	// Attach Table Event Listeners
	elements.tableBody
		.querySelectorAll(".param-name[data-name]")
		.forEach((el) => {
			const copyName = () => {
				const name = el.getAttribute("data-name");
				if (name) {
					navigator.clipboard.writeText(name);
					showToast(`Copied "${name}" to clipboard`);
				}
			};

			el.addEventListener("click", copyName);
			el.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					copyName();
				}
			});
		});

	elements.tableBody.querySelectorAll(".btn-detail").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const name = e.currentTarget.getAttribute("data-name");
			openDetailDrawer(name);
		});
	});
}

/**
 * Highlight matched search text
 */
function highlightText(text, query) {
	if (!query || !text) return escapeHtml(text || "");
	const q = String(query).trim();
	if (!q) return escapeHtml(text);
	const regex = new RegExp(`(${escapeRegex(q)})`, "gi");
	const parts = String(text).split(regex);
	return parts
		.map((part) =>
			part.toLowerCase() === q.toLowerCase()
				? `<mark class="search-highlight">${escapeHtml(part)}</mark>`
				: escapeHtml(part),
		)
		.join("");
}

function escapeRegex(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(str) {
	if (str === null || str === undefined) return "";
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Open Log Message Detail Drawer
 */
function openLogDetailDrawer(logName) {
	const m = state.logMessages.find((item) => item.name === logName);
	if (!m) return;

	elements.drawerTitle.textContent = m.name;
	elements.drawerSubtitle.textContent = m.description || m.name;

	const fieldsHtml = m.fields
		.map((f) => {
			const safeFName = escapeHtml(f.name);
			const safeFType = escapeHtml(f.type);
			const safeFUnits = escapeHtml(f.units);
			const safeFDesc = escapeHtml(f.description);

			let extraDetails = "";
			if (f.values) {
				extraDetails += `
          <div style="margin-top: 6px;">
            <table class="enum-table" style="margin-top: 4px; font-size: 0.78rem;">
              <tbody>
                ${Object.entries(f.values)
									.map(
										([code, label]) =>
											`<tr><td style="font-family: var(--font-mono); font-weight:700; color:#fbbf24; width: 40px;">${escapeHtml(code)}</td><td>${escapeHtml(label)}</td></tr>`,
									)
									.join("")}
              </tbody>
            </table>
          </div>
        `;
			}
			if (f.bitmask) {
				extraDetails += `
          <div style="margin-top: 6px;">
            <table class="bitmask-table" style="margin-top: 4px; font-size: 0.78rem;">
              <tbody>
                ${Object.entries(f.bitmask)
									.map(
										([flag, bit]) =>
											`<tr><td style="font-family: var(--font-mono); font-weight:700; color:var(--accent-green-bright); width: 80px;">${escapeHtml(flag)}</td><td>Bit ${escapeHtml(bit)}</td></tr>`,
									)
									.join("")}
              </tbody>
            </table>
          </div>
        `;
			}

			return `
        <tr>
          <td style="font-family: var(--font-mono); font-weight: 700; color: var(--text-primary);">${safeFName}</td>
          <td><span class="type-tag">${safeFType}</span></td>
          <td>${f.units ? `<span class="unit-tag">${safeFUnits}</span>` : '<span style="color: var(--text-muted);">-</span>'}</td>
          <td>
            <div style="color: var(--text-secondary);">${safeFDesc || "-"}</div>
            ${extraDetails}
          </td>
        </tr>
      `;
		})
		.join("");

	let bodyHtml = `
    <div class="detail-section">
      <h4>Log Format Overview</h4>
      <div class="detail-val-box">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">MESSAGE TYPE</div>
          <div class="val-pill" style="font-size: 1.1rem; padding: 6px 14px; margin-top: 4px;">${safeName}</div>
        </div>
        <div style="margin-left: 16px;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">FIELDS COUNT</div>
          <div class="unit-tag" style="font-size: 0.95rem; margin-top: 4px;">${m.fieldsCount} fields</div>
        </div>
        <div style="margin-left: auto;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">CATEGORY</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); margin-top: 4px;">${safeCategory}</div>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h4>Description</h4>
      <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        ${safeDesc}
      </p>
    </div>

    <div class="detail-section">
      <h4>Fields Specification (${m.fieldsCount})</h4>
      <div style="background: var(--bg-primary); border-radius: var(--radius-md); border: 1px solid var(--border-color); overflow: hidden;">
        <table class="log-fields-table">
          <thead>
            <tr>
              <th style="width: 110px;">Field</th>
              <th style="width: 90px;">Type</th>
              <th style="width: 80px;">Units</th>
              <th>Description & Values</th>
            </tr>
          </thead>
          <tbody>
            ${fieldsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;

	if (m.docUrl) {
		bodyHtml += `
      <div class="detail-section" style="margin-top: 30px;">
        <a href="${escapeHtml(m.docUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="width: 100%; justify-content: center;">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Official ArduPilot Documentation
        </a>
      </div>
    `;
	}

	elements.drawerBody.innerHTML = bodyHtml;
	elements.drawerOverlay.classList.add("active");
	elements.drawer.classList.add("active");
}

/**
 * Open Parameter Detail Drawer
 */
function openDetailDrawer(paramName) {
	const p = state.parameters.find((item) => item.name === paramName);
	if (!p) return;

	elements.drawerTitle.textContent = p.name;
	elements.drawerSubtitle.textContent = p.displayName || p.name;

	let bodyHtml = `
    <div class="detail-section">
      <h4>Default Value</h4>
      <div class="detail-val-box">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">DEFAULT VALUE</div>
          <div class="val-pill" style="font-size: 1.1rem; padding: 6px 14px; margin-top: 4px;">${escapeHtml(p.defaultValue)}</div>
        </div>
        ${
					p.units
						? `
        <div style="margin-left: 16px;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">UNITS</div>
          <div class="unit-tag" style="font-size: 0.95rem; margin-top: 4px;">${escapeHtml(p.units)}</div>
        </div>`
						: ""
				}
        <div style="margin-left: auto;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">GROUP / CATEGORY</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); margin-top: 4px;">${safeCategory}</div>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h4>Full Description</h4>
      <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        ${safeDesc}
      </p>
    </div>
  `;

	// Range meter
	if (p.range) {
		const safeMin = escapeHtml(p.range.min);
		const safeMax = escapeHtml(p.range.max);
		bodyHtml += `
      <div class="detail-section">
        <h4>Valid Value Range</h4>
        <div style="background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
            <span>MIN: ${safeMin}</span>
            <span>MAX: ${safeMax}</span>
          </div>
          <div style="height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden; position: relative;">
            <div style="position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: linear-gradient(90deg, var(--accent-green-bright), var(--accent-blue)); border-radius: 4px;"></div>
          </div>
        </div>
      </div>
    `;
	}

	// Bitmask Breakdown
	if (p.bitmask) {
		bodyHtml += `
      <div class="detail-section">
        <h4>Bitmask Field Definitions</h4>
        <table class="bitmask-table">
          <thead>
            <tr><th>Bit</th><th>Bitmask Flag Name</th></tr>
          </thead>
          <tbody>
            ${Object.entries(p.bitmask)
							.map(([bit, desc]) => {
								const bitNum = parseInt(bit, 10);
								const bitVal =
									!Number.isNaN(bitNum) && bitNum >= 0 && bitNum < 31
										? `(${1 << bitNum})`
										: "";
								return `
              <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-green-bright);">Bit ${escapeHtml(bit)} ${bitVal}</td>
                <td>${escapeHtml(desc)}</td>
              </tr>
            `;
							})
							.join("")}
          </tbody>
        </table>
      </div>
    `;
	}

	// Options / Enum values
	if (p.options) {
		bodyHtml += `
      <div class="detail-section">
        <h4>Value Options / Enum Meanings</h4>
        <table class="enum-table">
          <thead>
            <tr><th>Value</th><th>Meaning / Mode</th></tr>
          </thead>
          <tbody>
            ${Object.entries(p.options)
							.map(
								([val, desc]) => `
              <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: #fbbf24;">${escapeHtml(val)}</td>
                <td>${escapeHtml(desc)}</td>
              </tr>
            `,
							)
							.join("")}
          </tbody>
        </table>
      </div>
    `;
	}

	// External Docs Link
	const docVehicleMap = {
		ArduCopter: "copter",
		ArduPlane: "plane",
		APMrover2: "rover",
		AntennaTracker: "antennatracker",
		ArduSub: "sub",
		Blimp: "blimp",
	};
	const docVehicle = docVehicleMap[state.currentVehicle.id] || "copter";
	const docAnchor = encodeURIComponent(p.name.toLowerCase());
	bodyHtml += `
    <div class="detail-section" style="margin-top: 30px;">
      <a href="https://ardupilot.org/${docVehicle}/docs/parameters.html#${docAnchor}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="width: 100%; justify-content: center;">
        <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Official ArduPilot Documentation
      </a>
    </div>
  `;

	elements.drawerBody.innerHTML = bodyHtml;
	elements.drawerOverlay.classList.add("active");
	elements.drawer.classList.add("active");
}

function closeDetailDrawer() {
	elements.drawerOverlay.classList.remove("active");
	elements.drawer.classList.remove("active");
}

/**
 * Build an export filename. Release tags are descriptive on their own;
 * "master" isn't, so only that gets prefixed with the vehicle name.
 */
function buildExportFilename(suffix) {
	const versionPart =
		state.currentVersion === "master"
			? `${state.currentVehicle.vehicleDir}_master`
			: state.currentVersion;
	return `${versionPart}_${suffix}`;
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
	// Mode Toggle Buttons
	if (elements.modeBtnParams) {
		elements.modeBtnParams.addEventListener("click", () =>
			switchMode("params"),
		);
	}
	if (elements.modeBtnLogs) {
		elements.modeBtnLogs.addEventListener("click", () => switchMode("logs"));
	}

	// Version Select Change
	elements.versionSelect.addEventListener("change", (e) => {
		state.currentVersion = e.target.value;
		if (state.activeMode === "logs") {
			loadLogMessages();
		} else {
			loadParameters();
		}
	});

	// Search Input with Debounce
	let debounceTimer;
	elements.searchInput.addEventListener("input", (e) => {
		state.searchQuery = e.target.value;
		elements.searchClear.style.display = state.searchQuery ? "block" : "none";
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => applyFilters(), 250);
	});

	elements.searchClear.addEventListener("click", () => {
		elements.searchInput.value = "";
		state.searchQuery = "";
		elements.searchClear.style.display = "none";
		applyFilters();
	});

	// Pagination
	elements.btnPrevPage.addEventListener("click", () => {
		if (state.currentPage > 1) {
			state.currentPage--;
			renderTable();
		}
	});

	elements.btnNextPage.addEventListener("click", () => {
		const total =
			state.activeMode === "logs"
				? state.filteredLogMessages.length
				: state.filteredParameters.length;
		const totalPages = Math.ceil(total / state.pageSize);
		if (state.currentPage < totalPages) {
			state.currentPage++;
			renderTable();
		}
	});

	// Page Size Select Change
	if (elements.pageSizeSelect) {
		elements.pageSizeSelect.addEventListener("change", (e) => {
			const val = e.target.value;
			state.pageSize = val === "all" ? 1000000 : parseInt(val, 10);
			state.currentPage = 1;
			renderTable();
			syncUrl();
		});
	}

	// Drawer Close
	elements.drawerClose.addEventListener("click", closeDetailDrawer);
	elements.drawerOverlay.addEventListener("click", closeDetailDrawer);

	// Exporters
	elements.btnExportParam.addEventListener("click", () => {
		const content = generateParamFile(
			state.filteredParameters,
			state.currentVehicle.name,
			state.currentVersion,
		);
		const filename = buildExportFilename("defaults.param");
		downloadFile(content, filename, "text/plain");
		showToast(
			`Exported ${state.filteredParameters.length} parameters to ${filename}`,
		);
	});

	elements.btnExportCsv.addEventListener("click", () => {
		if (state.activeMode === "logs") {
			const content = generateLogCsvFile(state.filteredLogMessages);
			const filename = `${state.currentVehicle.vehicleDir}_log_messages.csv`;
			downloadFile(content, filename, "text/csv");
			showToast(
				`Exported ${state.filteredLogMessages.length} log messages to ${filename}`,
			);
		} else {
			const content = generateCsvFile(state.filteredParameters);
			const filename = buildExportFilename("parameters.csv");
			downloadFile(content, filename, "text/csv");
			showToast(`Exported CSV to ${filename}`);
		}
	});

	if (elements.btnExportJson) {
		elements.btnExportJson.addEventListener("click", () => {
			if (state.activeMode === "logs") {
				const content = generateLogJsonFile(
					state.filteredLogMessages,
					state.currentVehicle.name,
				);
				const filename = `${state.currentVehicle.vehicleDir}_log_messages.json`;
				downloadFile(content, filename, "application/json");
				showToast(
					`Exported ${state.filteredLogMessages.length} log messages to ${filename}`,
				);
			} else {
				const content = generateJsonFile(
					state.filteredParameters,
					state.currentVehicle.name,
					state.currentVersion,
				);
				const filename = buildExportFilename("parameters.json");
				downloadFile(content, filename, "application/json");
				showToast(`Exported JSON to ${filename}`);
			}
		});
	}

	// Share Link
	elements.btnShareLink.addEventListener("click", () => {
		syncUrl();
		navigator.clipboard.writeText(window.location.href);
		showToast("Shareable link copied to clipboard!");
	});

	// Compare Modal Triggers
	elements.btnCompare.addEventListener("click", () => {
		elements.compareModalOverlay.classList.add("active");
	});

	elements.compareClose.addEventListener("click", closeCompareModal);

	// Close compare modal on overlay click
	elements.compareModalOverlay.addEventListener("click", (e) => {
		if (e.target === elements.compareModalOverlay) closeCompareModal();
	});

	elements.btnRunCompare.addEventListener("click", runVersionComparison);

	// Escape key closes whichever overlay is open
	document.addEventListener("keydown", (e) => {
		if (e.key !== "Escape") return;
		if (elements.compareModalOverlay.classList.contains("active")) {
			closeCompareModal();
		} else if (elements.drawer.classList.contains("active")) {
			closeDetailDrawer();
		}
	});
}

function closeCompareModal() {
	elements.compareModalOverlay.classList.remove("active");
}

/**
 * Version Comparison Diff Logic
 */
async function runVersionComparison() {
	const ver1 = elements.compareVer1.value;
	const ver2 = elements.compareVer2.value;
	const filter = elements.compareFilter.value;
	const safeVer1 = escapeHtml(ver1);
	const safeVer2 = escapeHtml(ver2);

	elements.compareResults.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Comparing parameters between ${safeVer1} and ${safeVer2}...</p>
    </div>
  `;

	try {
		const [params1, params2] = await Promise.all([
			getVehicleParameters(state.currentVehicle.id, ver1),
			getVehicleParameters(state.currentVehicle.id, ver2),
		]);

		const map1 = new Map(params1.map((p) => [p.name, p]));
		const map2 = new Map(params2.map((p) => [p.name, p]));

		const allKeys = new Set([...map1.keys(), ...map2.keys()]);
		const diffs = [];

		for (const key of allKeys) {
			const p1 = map1.get(key);
			const p2 = map2.get(key);

			if (!p1 && p2) {
				diffs.push({
					type: "added",
					name: key,
					val1: "-",
					val2: p2.defaultValue,
					desc: p2.description,
				});
			} else if (p1 && !p2) {
				diffs.push({
					type: "removed",
					name: key,
					val1: p1.defaultValue,
					val2: "-",
					desc: p1.description,
				});
			} else if (p1.defaultValue !== p2.defaultValue) {
				diffs.push({
					type: "changed",
					name: key,
					val1: p1.defaultValue,
					val2: p2.defaultValue,
					desc: p2.description,
				});
			} else if (filter === "all") {
				diffs.push({
					type: "same",
					name: key,
					val1: p1.defaultValue,
					val2: p2.defaultValue,
					desc: p1.description,
				});
			}
		}

		let filteredDiffs = diffs;
		if (filter === "changed")
			filteredDiffs = diffs.filter(
				(d) =>
					d.type === "changed" || d.type === "added" || d.type === "removed",
			);
		if (filter === "added")
			filteredDiffs = diffs.filter((d) => d.type === "added");

		if (filteredDiffs.length === 0) {
			elements.compareResults.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 40px;">No parameter differences found between ${safeVer1} and ${safeVer2}.</p>`;
			return;
		}

		elements.compareResults.innerHTML = `
      <div style="margin-bottom: 12px; font-size: 0.9rem; color: var(--text-secondary);">
        Found <strong>${filteredDiffs.length}</strong> parameter differences between <code>${safeVer1}</code> and <code>${safeVer2}</code>
      </div>
      <table class="param-table">
        <thead>
          <tr>
            <th>Parameter Name</th>
            <th>Value in ${safeVer1}</th>
            <th>Value in ${safeVer2}</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${filteredDiffs
						.map(
							(d) => `
            <tr class="diff-${d.type}">
              <td style="font-family: var(--font-mono); font-weight: 700;">${escapeHtml(d.name)}</td>
              <td><span class="val-pill">${escapeHtml(d.val1)}</span></td>
              <td><span class="val-pill">${escapeHtml(d.val2)}</span></td>
              <td style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(d.desc)}</td>
            </tr>
          `,
						)
						.join("")}
        </tbody>
      </table>
    `;
	} catch (err) {
		elements.compareResults.innerHTML = `<p style="color: var(--accent-rose); text-align: center;">Error running comparison: ${escapeHtml(err.message)}</p>`;
	}
}

/**
 * URL State Synchronization & Browser Tab Title Update
 */
function syncUrl() {
	const url = new URL(window.location);
	if (state.activeMode && state.activeMode !== "params") {
		url.searchParams.set("mode", state.activeMode);
	} else {
		url.searchParams.delete("mode");
	}
	url.searchParams.set("vehicle", state.currentVehicle.id);
	url.searchParams.set("version", state.currentVersion);
	if (state.searchQuery) url.searchParams.set("search", state.searchQuery);
	else url.searchParams.delete("search");
	if (state.activeCategory && state.activeCategory !== "ALL")
		url.searchParams.set("category", state.activeCategory);
	else url.searchParams.delete("category");
	if (state.pageSize < 100000 && state.pageSize !== 50)
		url.searchParams.set("pageSize", state.pageSize);
	else if (state.pageSize >= 100000) url.searchParams.set("pageSize", "all");
	else url.searchParams.delete("pageSize");
	window.history.replaceState({}, "", url);

	// Dynamic Browser Tab Title: <version> - Parameters or <version> - Log Messages
	// When "master" is selected, preface with vehicle type (e.g. "Copter master - Parameters")
	const modeLabel = state.activeMode === "logs" ? "Log Messages" : "Parameters";
	const vDir = state.currentVehicle.vehicleDir || "Copter";
	const verStr =
		state.currentVersion === "master" || !state.currentVersion
			? `${vDir} master`
			: state.currentVersion;
	document.title = `${verStr} - ${modeLabel}`;
}

// ArduPilot release tags & "master" only ever contain this restricted charset
const VERSION_TAG_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const CATEGORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

function setupUrlParams() {
	const params = new URLSearchParams(window.location.search);
	const mode = params.get("mode");
	const vehicleId = params.get("vehicle");
	const version = params.get("version");
	const search = params.get("search");
	const pageSizeParam = params.get("pageSize") || params.get("limit");

	if (mode === "logs") {
		state.activeMode = "logs";
		switchMode("logs");
	}

	if (vehicleId) {
		const v = VEHICLES.find(
			(item) =>
				item.id.toLowerCase() === vehicleId.toLowerCase() ||
				item.vehicleDir.toLowerCase() === vehicleId.toLowerCase() ||
				item.name.toLowerCase().includes(vehicleId.toLowerCase()),
		);
		if (v) state.currentVehicle = v;
	}
	if (version && VERSION_TAG_PATTERN.test(version))
		state.currentVersion = version;
	if (search) {
		state.searchQuery = search;
		elements.searchInput.value = search;
		elements.searchClear.style.display = "block";
	}
	const category = params.get("category");
	if (category && CATEGORY_PATTERN.test(category))
		state.activeCategory = category;
	if (pageSizeParam) {
		if (pageSizeParam === "all") {
			state.pageSize = 1000000;
			if (elements.pageSizeSelect) elements.pageSizeSelect.value = "all";
		} else {
			const parsed = parseInt(pageSizeParam, 10);
			if (!Number.isNaN(parsed) && parsed > 0) {
				state.pageSize = parsed;
				if (elements.pageSizeSelect)
					elements.pageSizeSelect.value = parsed.toString();
			}
		}
	}
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = "info") {
	const toast = document.createElement("div");
	toast.className = "toast";
	const icon = type === "error" ? "fa-triangle-exclamation" : "fa-circle-check";
	const iconColor =
		type === "error" ? "var(--accent-rose)" : "var(--accent-green-bright)";
	toast.innerHTML = `<i class="fa-solid ${icon}" style="color: ${iconColor};"></i> <span>${escapeHtml(message)}</span>`;
	elements.toastContainer.appendChild(toast);

	setTimeout(() => {
		toast.style.opacity = "0";
		toast.style.transform = "translateY(10px)";
		toast.style.transition = "all 0.3s ease";
		setTimeout(() => toast.remove(), 300);
	}, 3000);
}
