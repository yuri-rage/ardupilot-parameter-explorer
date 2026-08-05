/**
 * ArduPilot Parameter Explorer - Main Application Controller
 */

import {
	PRESET_VERSIONS,
	VEHICLES,
	fetchGitHubTags,
	getVehicleParameters,
} from "./api.js";
import {
	downloadFile,
	generateCsvFile,
	generateJsonFile,
	generateParamFile,
} from "./exporter.js";

// Global Application State
const state = {
	currentVehicle: VEHICLES[0],
	currentVersion: "master",
	parameters: [],
	filteredParameters: [],
	activeCategory: "ALL",
	searchQuery: "",
	currentPage: 1,
	pageSize: 50,
	availableTags: [],
};

// DOM Elements Cache
const elements = {
	vehicleRow: document.getElementById("vehicle-card-row"),
	versionSelect: document.getElementById("version-select"),
	searchInput: document.getElementById("search-input"),
	searchClear: document.getElementById("search-clear"),
	categoryBar: document.getElementById("category-bar"),
	tableBody: document.getElementById("param-table-body"),
	statsCount: document.getElementById("stats-count"),
	loadingSpinner: document.getElementById("loading-spinner"),
	emptyState: document.getElementById("empty-state"),
	errorState: document.getElementById("error-state"),
	tagStatus: document.getElementById("tag-status"),
	pageIndicator: document.getElementById("page-indicator"),
	btnPrevPage: document.getElementById("btn-prev-page"),
	btnNextPage: document.getElementById("btn-next-page"),
	pageSizeSelect: document.getElementById("page-size-select"),

	// Exporters & Actions
	btnExportParam: document.getElementById("btn-export-param"),
	btnExportCsv: document.getElementById("btn-export-csv"),
	btnExportJson: document.getElementById("btn-export-json"),
	btnShareLink: document.getElementById("btn-share-link"),
	btnCompare: document.getElementById("btn-compare"),

	// Detail Drawer
	drawerOverlay: document.getElementById("drawer-overlay"),
	drawer: document.getElementById("drawer"),
	drawerTitle: document.getElementById("drawer-title"),
	drawerSubtitle: document.getElementById("drawer-subtitle"),
	drawerBody: document.getElementById("drawer-body"),
	drawerClose: document.getElementById("drawer-close"),

	// Compare Modal
	compareModalOverlay: document.getElementById("compare-modal-overlay"),
	compareClose: document.getElementById("compare-close"),
	compareVer1: document.getElementById("compare-ver-1"),
	compareVer2: document.getElementById("compare-ver-2"),
	compareFilter: document.getElementById("compare-filter"),
	btnRunCompare: document.getElementById("btn-run-compare"),
	compareResults: document.getElementById("compare-results"),

	toastContainer: document.getElementById("toast-container"),
};

// Application Initialization
document.addEventListener("DOMContentLoaded", async () => {
	// Parse URL parameters FIRST so state matches URL before initial render
	setupUrlParams();

	renderVehicleCards();
	populateVersionSelect();
	setupEventListeners();

	// Load GitHub Tags asynchronously
	loadTags();

	// Initial Data Fetch
	await loadParameters();
});

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
		const iconMarkup = CUSTOM_VEHICLE_ICONS[v.id]
			? `<i class="vehicle-icon-custom">${CUSTOM_VEHICLE_ICONS[v.id]}</i>`
			: `<i class="fa-solid fa-${v.icon}"></i>`;
		return `
    <button class="vehicle-btn ${v.id === state.currentVehicle.id ? "active" : ""}" data-id="${v.id}">
      ${iconMarkup} ${v.name}
    </button>
  `;
	}).join("");

	elements.vehicleRow.querySelectorAll(".vehicle-btn").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const vId = e.currentTarget.getAttribute("data-id");
			const targetVehicle = VEHICLES.find((v) => v.id === vId);
			if (targetVehicle && targetVehicle.id !== state.currentVehicle.id) {
				state.currentVehicle = targetVehicle;
				state.currentVersion = "master"; // Reset to master on vehicle change
				renderVehicleCards();
				populateVersionSelect();
				loadParameters();
			}
		});
	});
}

/**
 * Sort Version Tags (master first, then SemVer newest to oldest)
 */
function sortVersionTags(tags) {
	const hasMaster = tags.includes("master");
	const otherTags = tags.filter((t) => t !== "master");

	otherTags.sort((a, b) => {
		const parseVersion = (str) => {
			const match = str.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
			if (!match) return [0, 0, 0];
			return [
				parseInt(match[1], 10) || 0,
				parseInt(match[2], 10) || 0,
				parseInt(match[3], 10) || 0,
			];
		};

		const vA = parseVersion(a);
		const vB = parseVersion(b);

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
 * Filter Parameters based on search query & active category
 */
function applyFilters() {
	const query = state.searchQuery.toLowerCase().trim();
	const category = state.activeCategory;

	state.filteredParameters = state.parameters.filter((p) => {
		// Category match
		const matchesCategory = category === "ALL" || p.category === category;

		// Search query match across Name, DisplayName, Description, Units
		const matchesSearch =
			!query ||
			p.name.toLowerCase().includes(query) ||
			p.displayName.toLowerCase().includes(query) ||
			p.description.toLowerCase().includes(query) ||
			p.units.toLowerCase().includes(query);

		return matchesCategory && matchesSearch;
	});

	state.currentPage = 1;
	renderCategoriesBar();
	renderTable();
}

/**
 * Render Category Filter Pills
 */
function renderCategoriesBar() {
	const categories = [
		"ALL",
		...new Set(state.parameters.map((p) => p.category)),
	];

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
	elements.tableBody.querySelectorAll(".param-name").forEach((el) => {
		const copyName = (e) => {
			const name = e.currentTarget.getAttribute("data-name");
			navigator.clipboard.writeText(name);
			showToast(`Copied "${name}" to clipboard`);
		};
		el.addEventListener("click", copyName);
		el.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				copyName(e);
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
 * Escape a value for safe insertion into HTML markup
 */
function escapeHtml(value) {
	const escapeChars = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	};
	return String(value ?? "").replace(/[&<>"']/g, (ch) => escapeChars[ch]);
}

/**
 * Highlight matched search text (escapes text first, then wraps matches)
 */
function highlightText(text, query) {
	const safeText = escapeHtml(text);
	if (!query || !safeText) return safeText;
	const q = String(query).trim();
	if (!q) return safeText;
	const regex = new RegExp(`(${escapeRegex(q)})`, "gi");
	return safeText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function escapeRegex(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      <h4 class="detail-section-title">Default Value</h4>
      <div class="detail-val-box">
        <div>
          <div class="val-pill" style="font-size: 1.1rem; padding: 4px 14px;">${escapeHtml(p.defaultValue)}</div>
        </div>
        ${
					p.units
						? `
        <div>
          <div class="detail-field-label">Units</div>
          <div class="unit-tag" style="font-size: 0.95rem;">${escapeHtml(p.units)}</div>
        </div>`
						: ""
				}
        <div style="margin-left: auto;">
          <div class="detail-field-label">Group / Category</div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(p.category)}</div>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h4 class="detail-section-title">Full Description</h4>
      <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        ${escapeHtml(p.description)}
      </p>
    </div>
  `;

	// Range meter
	if (p.range) {
		bodyHtml += `
      <div class="detail-section">
        <h4 class="detail-section-title">Valid Value Range</h4>
        <div style="background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">
            <span>MIN: ${escapeHtml(p.range.min)}</span>
            <span>MAX: ${escapeHtml(p.range.max)}</span>
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
        <h4 class="detail-section-title">Bitmask Field Definitions</h4>
        <table class="bitmask-table">
          <thead>
            <tr><th>Bit</th><th>Bitmask Flag Name</th></tr>
          </thead>
          <tbody>
            ${Object.entries(p.bitmask)
							.map(
								([bit, desc]) => `
              <tr>
                <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-green-bright);">Bit ${escapeHtml(bit)} (${1 << bit})</td>
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

	// Options / Enum values
	if (p.options) {
		bodyHtml += `
      <div class="detail-section">
        <h4 class="detail-section-title">Value Options / Enum Meanings</h4>
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
      <a href="https://ardupilot.org/${docVehicle}/docs/parameters.html#${docAnchor}" target="_blank" class="btn btn-primary" style="width: 100%; justify-content: center;">
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
 * Setup Event Listeners
 */
function setupEventListeners() {
	// Version Select Change
	elements.versionSelect.addEventListener("change", (e) => {
		state.currentVersion = e.target.value;
		loadParameters();
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
		const totalPages = Math.ceil(
			state.filteredParameters.length / state.pageSize,
		);
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
		const filename = `${state.currentVehicle.id}_${state.currentVersion}_defaults.param`;
		downloadFile(content, filename, "text/plain");
		showToast(
			`Exported ${state.filteredParameters.length} parameters to ${filename}`,
		);
	});

	elements.btnExportCsv.addEventListener("click", () => {
		const content = generateCsvFile(state.filteredParameters);
		const filename = `${state.currentVehicle.id}_${state.currentVersion}_parameters.csv`;
		downloadFile(content, filename, "text/csv");
		showToast(`Exported CSV to ${filename}`);
	});

	if (elements.btnExportJson) {
		elements.btnExportJson.addEventListener("click", () => {
			const content = generateJsonFile(
				state.filteredParameters,
				state.currentVehicle.name,
				state.currentVersion,
			);
			const filename = `${state.currentVehicle.id}_${state.currentVersion}_parameters.json`;
			downloadFile(content, filename, "application/json");
			showToast(`Exported JSON to ${filename}`);
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
 * URL State Synchronization
 */
function syncUrl() {
	const url = new URL(window.location);
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
}

// ArduPilot release tags & "master" only ever contain this restricted charset
const VERSION_TAG_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const CATEGORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

function setupUrlParams() {
	const params = new URLSearchParams(window.location.search);
	const vehicleId = params.get("vehicle");
	const version = params.get("version");
	const search = params.get("search");
	const pageSizeParam = params.get("pageSize") || params.get("limit");

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
