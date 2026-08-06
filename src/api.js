/**
 * ArduPilot Parameter Explorer - 100% Dynamic Client-Side Engine
 * Operates 100% dynamically on the client side for any present, past, or future ArduPilot release tag.
 * Auto-discovers C++ libraries, header defines, and PID constructor initializers directly from source.
 */

// Supported Vehicle Definitions
export const VEHICLES = [
	{
		id: "ArduCopter",
		name: "ArduCopter",
		icon: "helicopter",
		vehicleDir: "ArduCopter",
		mainHeader: "ArduCopter/Copter.h",
		defaultParm: "copter.parm",
		tagPrefixes: ["Copter-", "ArduCopter-"],
	},
	{
		id: "ArduPlane",
		name: "ArduPlane",
		icon: "plane",
		vehicleDir: "ArduPlane",
		mainHeader: "ArduPlane/Plane.h",
		defaultParm: "plane.parm",
		tagPrefixes: ["Plane-", "ArduPlane-"],
	},
	{
		id: "APMrover2",
		name: "Rover / Boat",
		icon: "car",
		vehicleDir: "Rover",
		mainHeader: "Rover/Rover.h",
		defaultParm: "rover.parm",
		tagPrefixes: ["Rover-", "APMrover2-"],
	},
	{
		id: "AntennaTracker",
		name: "Antenna Tracker",
		icon: "satellite-dish",
		vehicleDir: "AntennaTracker",
		mainHeader: "AntennaTracker/Tracker.h",
		defaultParm: "tracker.parm",
		tagPrefixes: ["Tracker-", "AntennaTracker-"],
	},
	{
		id: "ArduSub",
		name: "ArduSub",
		icon: "water",
		vehicleDir: "ArduSub",
		mainHeader: "ArduSub/Sub.h",
		defaultParm: "sub.parm",
		tagPrefixes: ["Sub-", "ArduSub-"],
	},
	{
		id: "Blimp",
		name: "Blimp",
		icon: "cloud",
		vehicleDir: "Blimp",
		mainHeader: "Blimp/Blimp.h",
		defaultParm: "blimp.parm",
		tagPrefixes: ["Blimp-"],
	},
];

// Preset Release Tags supporting 4.5, 4.6, 4.7+, and historical releases matching official GitHub tags
export const PRESET_VERSIONS = {
	ArduCopter: [
		"master",
		"Copter-4.6.3",
		"Copter-4.6.0",
		"Copter-4.5.7",
		"Copter-4.5.4",
		"Copter-4.5.1",
		"Copter-4.5.0",
		"Copter-4.4.4",
		"Copter-4.4.0",
		"Copter-4.3.8",
		"Copter-4.2.3",
		"Copter-4.1.5",
		"Copter-4.0.7",
	],
	ArduPlane: [
		"master",
		"Plane-4.6.3",
		"Plane-4.6.0",
		"Plane-4.5.7",
		"Plane-4.5.4",
		"Plane-4.5.1",
		"Plane-4.5.0",
		"Plane-4.4.4",
		"Plane-4.4.0",
		"Plane-4.3.8",
		"Plane-4.2.3",
		"Plane-4.1.5",
		"Plane-4.0.9",
	],
	APMrover2: [
		"master",
		"Rover-4.7.0",
		"Rover-4.6.3",
		"Rover-4.6.2",
		"Rover-4.6.1",
		"Rover-4.6.0",
		"Rover-4.5.7",
		"Rover-4.5.4",
		"Rover-4.5.1",
		"Rover-4.5.0",
		"Rover-4.4.0",
		"Rover-4.2.3",
		"Rover-4.1.5",
		"Rover-4.0.0",
	],
	AntennaTracker: [
		"master",
		"Tracker-4.7.0",
		"Tracker-4.6.3",
		"Tracker-4.6.2",
		"Tracker-4.6.1",
		"Tracker-4.6.0",
		"Tracker-4.5.7",
		"Tracker-4.5.4",
		"Tracker-4.5.1",
		"Tracker-4.5.0",
		"Tracker-4.1.0",
	],
	ArduSub: [
		"master",
		"Sub-4.7.0",
		"Sub-4.5.4",
		"Sub-4.5.0",
		"ArduSub-4.0.3",
		"ArduSub-4.0.0",
	],
	Blimp: ["master", "Blimp-4.5.0", "Blimp-4.3.0"],
};

const CACHE_PREFIX = "ap_dyn_v39_";

/**
 * Maps our vehicle ID + GitHub tag to the autotest versioned URL path.
 * autotest uses: versioned/{Vehicle}/stable-{X.Y.Z}/apm.pdef.xml
 */
const VERSIONED_VEHICLE_MAP = {
	ArduCopter: "Copter",
	ArduPlane: "Plane",
	APMrover2: "Rover",
	AntennaTracker: "Tracker",
	ArduSub: "Sub",
	Blimp: null, // not in versioned directory
};

// Extracts the semver portion from a GitHub tag like "Rover-4.2.3" -> "4.2.3"
function extractSemver(tag) {
	const m = tag.match(/(\d+\.\d+\.\d+)/);
	return m ? m[1] : null;
}

/**
 * Parse an apm.pdef.xml string into the same flat metadata shape used by
 * the JSON path: { PARAM_NAME: { DisplayName, Description, Units, Range: {low,high},
 *   Values: {code: label}, Bitmask: {bit: name}, Default, User } }
 */
function parseVersionedXml(xmlText) {
	if (!xmlText || typeof DOMParser === "undefined") return null;
	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(xmlText, "application/xml");
		if (doc.querySelector("parsererror")) return null;

		const result = {};
		doc.querySelectorAll("param").forEach((param) => {
			// name attribute is "VehicleName:PARAM_NAME" or just "PARAM_NAME"
			const rawName = param.getAttribute("name") || "";
			const name = rawName.includes(":")
				? rawName.split(":").slice(1).join(":")
				: rawName;
			if (!name || !/^[A-Z0-9_]+$/.test(name)) return;

			const entry = {
				DisplayName: param.getAttribute("humanName") || name,
				Description: param.getAttribute("documentation") || "",
				User: param.getAttribute("user") || "Standard",
			};

			// <field> elements
			param.querySelectorAll("field").forEach((field) => {
				const fn = field.getAttribute("name");
				const fv = field.textContent.trim();
				if (fn === "Range") {
					const parts = fv.split(/\s+/);
					if (parts.length === 2)
						entry.Range = { low: parts[0], high: parts[1] };
				} else if (fn === "Units") {
					entry.Units = fv;
				} else if (fn === "Increment") {
					entry.Increment = fv;
				} else if (fn === "Default") {
					entry.Default = fv;
				} else if (fn === "Bitmask") {
					const bitmask = {};
					fv.split(",").forEach((pair) => {
						const [bit, ...rest] = pair.split(":");
						if (bit !== undefined) bitmask[bit.trim()] = rest.join(":").trim();
					});
					entry.Bitmask = bitmask;
				} else if (fn === "RebootRequired") {
					entry.RebootRequired = fv;
				} else if (fn === "ReadOnly") {
					entry.ReadOnly = fv;
				}
			});

			// <values> element -> Values map
			const valuesEl = param.querySelector("values");
			if (valuesEl) {
				const values = {};
				valuesEl.querySelectorAll("value").forEach((v) => {
					values[v.getAttribute("code")] = v.textContent.trim();
				});
				entry.Values = values;
			}

			result[name] = entry;
		});
		return result;
	} catch (e) {
		console.warn("XML parse error:", e);
		return null;
	}
}

/**
 * Fetch per-version metadata from autotest versioned directory (XML).
 * Falls back to null if unavailable (e.g. master, Blimp, version not archived).
 */
async function fetchVersionedMetadata(vehicleId, versionTag) {
	if (versionTag === "master") return null;
	const vehicleFolder = VERSIONED_VEHICLE_MAP[vehicleId];
	if (!vehicleFolder) return null;
	const semver = extractSemver(versionTag);
	if (!semver) return null;

	const url = `https://autotest.ardupilot.org/Parameters/versioned/${vehicleFolder}/stable-${semver}/apm.pdef.xml`;
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const text = await res.text();
		return parseVersionedXml(text);
	} catch {
		return null;
	}
}

function isStorageAvailable() {
	return typeof localStorage !== "undefined" && localStorage !== null;
}

/**
 * Smart Prefix Normalizer to align indexed parameter instances (BATT2_, SERVO16_, MAV12_, BATTA_, RNGFNDA_) with C++ base class prefixes
 */
function normalizePrefixSmart(pref) {
	if (!pref) return "";
	let clean = pref.endsWith("_") ? pref.slice(0, -1) : pref;
	clean = clean.replace(/\d+$/, "");
	if (clean.length > 3 && /[A-Z]/.test(clean[clean.length - 1])) {
		const knownBases = [
			"BATT",
			"RNGFND",
			"SERVO",
			"MOT",
			"RC",
			"COMPASS",
			"INS",
			"GPS",
			"BARO",
			"CAN",
			"SERIAL",
			"MAV",
			"ARSPD",
			"FILT",
			"TEMP",
			"TRQ",
		];
		const candidate = clean.slice(0, -1);
		if (knownBases.includes(candidate)) {
			clean = candidate;
		}
	}
	return clean + "_";
}

/**
 * Fetch GitHub tags across multiple pages to dynamically support any new ArduPilot release
 */
export async function fetchGitHubTags() {
	try {
		if (isStorageAvailable()) {
			const cached = localStorage.getItem(`${CACHE_PREFIX}gh_tags`);
			if (cached) {
				const { data, timestamp } = JSON.parse(cached);
				if (Date.now() - timestamp < 3600000) return data;
			}
		}

		const allTags = [];
		for (let page = 1; page <= 3; page++) {
			const res = await fetch(
				`https://api.github.com/repos/ArduPilot/ardupilot/tags?per_page=100&page=${page}`,
			);
			if (!res.ok) break;
			const tagsData = await res.json();
			if (!Array.isArray(tagsData)) break;
			allTags.push(...tagsData.map((t) => t.name));
		}

		if (allTags.length > 0 && isStorageAvailable()) {
			localStorage.setItem(
				`${CACHE_PREFIX}gh_tags`,
				JSON.stringify({ data: allTags, timestamp: Date.now() }),
			);
		}
		return allTags;
	} catch (err) {
		console.warn(
			"GitHub API rate limited or offline, using preset tag definitions:",
			err,
		);
	}
	return [];
}

/**
 * Parse `#define` macros in C++ files with vehicle preprocessor evaluation (`#if APM_BUILD_TYPE(...)`)
 */
function parseHeaderDefines(text, vehicleId, defines = {}) {
	if (!text) return defines;

	const vBuildNameMap = {
		APMrover2: "APM_BUILD_Rover",
		ArduSub: "APM_BUILD_ArduSub",
		ArduCopter: "APM_BUILD_ArduCopter",
		ArduPlane: "APM_BUILD_ArduPlane",
		AntennaTracker: "APM_BUILD_AntennaTracker",
		Blimp: "APM_BUILD_Blimp",
	};
	const targetMacro = vBuildNameMap[vehicleId] || "";

	const lines = text.split("\n");
	const stack = [];

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.startsWith("#if")) {
			let isMatch = true;
			if (trimmed.includes("APM_BUILD_TYPE")) {
				isMatch = trimmed.includes(targetMacro);
			}
			const parentActive =
				stack.length > 0 ? stack[stack.length - 1].currentActive : true;
			stack.push({
				anyMatched: isMatch && parentActive,
				currentActive: isMatch && parentActive,
			});
		} else if (trimmed.startsWith("#elif")) {
			if (stack.length > 0) {
				const top = stack[stack.length - 1];
				let isMatch = false;
				if (trimmed.includes("APM_BUILD_TYPE")) {
					isMatch = trimmed.includes(targetMacro);
				}
				const parentActive =
					stack.length > 1 ? stack[stack.length - 2].currentActive : true;
				const active = !top.anyMatched && isMatch && parentActive;
				if (active) top.anyMatched = true;
				top.currentActive = active;
			}
		} else if (trimmed.startsWith("#else")) {
			if (stack.length > 0) {
				const top = stack[stack.length - 1];
				const parentActive =
					stack.length > 1 ? stack[stack.length - 2].currentActive : true;
				const active = !top.anyMatched && parentActive;
				top.currentActive = active;
			}
		} else if (trimmed.startsWith("#endif")) {
			if (stack.length > 0) stack.pop();
		} else {
			const active =
				stack.length > 0 ? stack[stack.length - 1].currentActive : true;
			if (active) {
				const match = line.match(
					/^\s*#\s*define\s+([A-Z0-9_]+)\s+([0-9.fA-Z_]+)/,
				);
				if (match) {
					defines[match[1]] = match[2].replace(/f$/i, "").trim();
				}
			}
		}
	}

	return defines;
}

/**
 * Parse C++ PID struct initializers in headers (e.g. `_pid_rate_roll { AC_PID::Defaults { .p = 0.135f, ... } }`)
 */
function parsePidStructInitializers(text, defines = {}, defaults = {}) {
	if (!text) return defaults;
	const pidBlockRegex =
		/_pid_([a-z0-9_]+)\s*\{\s*AC_PID::Defaults\s*\{([^}]+)\}/g;
	let match = pidBlockRegex.exec(text);
	while (match !== null) {
		const pidName = match[1];
		const blockContent = match[2];

		const prefixMap = {
			rate_roll: "ATC_RAT_RLL_",
			rate_pitch: "ATC_RAT_PIT_",
			rate_yaw: "ATC_RAT_YAW_",
			steer_rate: "ATC_STR_RAT_",
			speed: "ATC_SPEED_",
			bal: "ATC_BAL_",
			sail: "ATC_SAIL_",
		};
		const prefix = prefixMap[pidName] || `ATC_${pidName.toUpperCase()}_`;

		const fieldRegex = /\.(\w+)\s*=\s*([^,;}\s]+)/g;
		let fMatch = fieldRegex.exec(blockContent);
		while (fMatch !== null) {
			const field = fMatch[1].toUpperCase();
			let val = fMatch[2].replace(/f$/i, "").trim();
			if (defines[val]) val = defines[val];

			let paramSuffix = field;
			if (field === "FILT_D_HZ") paramSuffix = "FLTD";
			if (field === "FILT_E_HZ") paramSuffix = "FLTE";
			if (field === "FILT_T_HZ") paramSuffix = "FLTT";

			defaults[`${prefix}${paramSuffix}`] = val;
			fMatch = fieldRegex.exec(blockContent);
		}
		match = pidBlockRegex.exec(text);
	}
	return defaults;
}

/**
 * Parse C++ AC_PID Constructor Initializers matching AC_PID constructor parameter order
 * AC_PID::AC_PID(p, i, d, ff, imax, filt_T_hz, filt_E_hz, filt_D_hz, srmax, srtau, dff)
 */
function parseCtorSubgroupInitializers(
	text,
	topPrefix,
	defines = {},
	defaults = {},
) {
	if (!text) return defaults;

	const subgroupMap = {};
	const subGroupRegex =
		/AP_SUBGROUPINFO\s*\(\s*([_a-zA-Z0-9]+)\s*,\s*"([^"]+)"/g;
	let sgMatch = subGroupRegex.exec(text);
	while (sgMatch !== null) {
		const memberVar = sgMatch[1];
		let subPrefix = sgMatch[2];
		if (!subPrefix.endsWith("_")) subPrefix += "_";
		subgroupMap[memberVar] = subPrefix;
		sgMatch = subGroupRegex.exec(text);
	}

	for (const [memberVar, subPrefix] of Object.entries(subgroupMap)) {
		const escapedVar = memberVar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const ctorRegex = new RegExp(`${escapedVar}\\s*\\(([^)]+)\\)`, "g");
		let cMatch = ctorRegex.exec(text);
		while (cMatch !== null) {
			const argsStr = cMatch[1];
			const args = argsStr.split(",").map((a) => a.trim().replace(/f$/i, ""));
			const resolvedArgs = args.map((a) =>
				defines[a] !== undefined
					? defines[a]
					: Number.isNaN(Number(a))
						? "0"
						: a,
			);

			let fullPrefix = (topPrefix + subPrefix).replace(/__+/g, "_");
			if (!fullPrefix.endsWith("_")) fullPrefix += "_";

			if (args.length === 1) {
				if (resolvedArgs[0] && resolvedArgs[0] !== "0")
					defaults[`${fullPrefix}P`] = resolvedArgs[0];
			} else {
				if (resolvedArgs[0] !== undefined && resolvedArgs[0] !== "0")
					defaults[`${fullPrefix}P`] = resolvedArgs[0];
				if (resolvedArgs[1] !== undefined && resolvedArgs[1] !== "0")
					defaults[`${fullPrefix}I`] = resolvedArgs[1];
				if (resolvedArgs[2] !== undefined)
					defaults[`${fullPrefix}D`] = resolvedArgs[2];
				if (resolvedArgs[3] !== undefined)
					defaults[`${fullPrefix}FF`] = resolvedArgs[3];
				if (resolvedArgs[4] !== undefined && resolvedArgs[4] !== "0")
					defaults[`${fullPrefix}IMAX`] = resolvedArgs[4];
				if (resolvedArgs[5] !== undefined)
					defaults[`${fullPrefix}FLTT`] = resolvedArgs[5];
				if (resolvedArgs[6] !== undefined)
					defaults[`${fullPrefix}FLTE`] = resolvedArgs[6];
				if (resolvedArgs[7] !== undefined)
					defaults[`${fullPrefix}FLTD`] = resolvedArgs[7];
			}
			cMatch = ctorRegex.exec(text);
		}
	}

	return defaults;
}

/**
 * Clean & Expand C++ value expressions & MAVLink Enums
 */
function resolveValueExpression(rawVal, defines = {}) {
	if (!rawVal) return "0";
	let val = String(rawVal).trim();
	val = val.replace(/^\([^)]+\)/g, "").trim();
	val = val.replace(/^[a-zA-Z0-9_]+\(([^)]+)\)$/g, "$1").trim();
	val = val.replace(/f$/i, "").trim();

	if (
		val === "DISABLED" ||
		val === "DISABLE" ||
		val === "OFF" ||
		val === "FALSE" ||
		val === "NO"
	)
		return "0";
	if (
		val === "ENABLED" ||
		val === "ENABLE" ||
		val === "ON" ||
		val === "TRUE" ||
		val === "YES"
	)
		return "1";

	// Standard MAVLink & ArduPilot Enum Constant Definitions
	const enumMap = {
		ADSB_EMITTER_TYPE_UAV: "14",
		ADSB_EMITTER_TYPE_NO_INFO: "0",
		ADSB_EMITTER_TYPE_LIGHT: "1",
		ADSB_EMITTER_TYPE_SMALL: "2",
		ADSB_EMITTER_TYPE_LARGE: "3",
		ADSB_EMITTER_TYPE_HIGH_VORTEX_LARGE: "4",
		ADSB_EMITTER_TYPE_HEAVY: "5",
		ADSB_EMITTER_TYPE_HIGHLY_MANUVERABLE: "6",
		ADSB_EMITTER_TYPE_ROTOCRAFT: "7",
		ADSB_EMITTER_TYPE_GLIDER: "9",
		ADSB_EMITTER_TYPE_LIGHTER_THAN_AIR: "10",
		ADSB_EMITTER_TYPE_PARACHUTE: "11",
		ADSB_EMITTER_TYPE_ULTRA_LIGHT: "12",
		ADSB_EMITTER_TYPE_SPACE: "15",
	};

	if (enumMap[val]) return enumMap[val];
	if (defines[val]) return defines[val];

	if (val.includes("::")) {
		const parts = val.split("::");
		val = parts[parts.length - 1];
		if (enumMap[val]) return enumMap[val];
		if (defines[val]) return defines[val];
	}

	if (Number.isNaN(Number(val)) && !/^-?\d+(\.\d+)?$/.test(val)) {
		return "0";
	}

	return val;
}

/**
 * Parse C++ code with balanced parenthesis tracking and inline comment stripping
 */
export function parseCppDefaults(cppCode, defines = {}, defaults = {}) {
	if (!cppCode) return defaults;
	const lines = cppCode.split("\n");
	for (let line of lines) {
		line = line.split("//")[0].trim();
		if (!line.includes("AP_GROUPINFO") && !line.includes("GSCALAR")) continue;

		let match = line.match(/AP_GROUPINFO(?:_FLAGS)?\s*\(\s*"([A-Z0-9_]+)"\s*,/);
		if (!match) {
			match = line.match(/GSCALAR\s*\(\s*[^,]+\s*,\s*"([A-Z0-9_]+)"\s*,/);
		}

		if (match) {
			const name = match[1];
			const firstParen = line.indexOf("(");
			const lastParen = line.lastIndexOf(")");

			if (firstParen !== -1 && lastParen > firstParen) {
				const argsStr = line.substring(firstParen + 1, lastParen);
				const args = [];
				let current = "";
				let depth = 0;

				for (const char of argsStr) {
					if (char === "(") depth++;
					else if (char === ")") depth--;
					if (char === "," && depth === 0) {
						args.push(current.trim());
						current = "";
					} else {
						current += char;
					}
				}
				if (current.trim()) args.push(current.trim());

				if (args.length >= 3) {
					let rawVal = args[args.length - 1];
					rawVal = resolveValueExpression(rawVal, defines);
					if (!defaults[name]) defaults[name] = rawVal;
				}
			}
		}
	}
	return defaults;
}

/**
 * Parse .parm file text
 */
export function parseParmFile(parmText, defines = {}) {
	const defaults = {};
	if (!parmText) return defaults;
	const lines = parmText.split("\n");
	for (let line of lines) {
		line = line.split("//")[0].trim();
		if (!line || line.startsWith("#")) continue;
		const parts = line.split(/[\s,]+/);
		if (parts.length >= 2) {
			const paramName = parts[0].trim();
			let value = parts[1].trim();
			value = resolveValueExpression(value, defines);
			if (paramName && /^[A-Z0-9_]+$/.test(paramName)) {
				defaults[paramName] = value;
			}
		}
	}
	return defaults;
}

/**
 * Generate candidate library C++, header, and _config.h file paths from C++ class names
 */
function getCandidateFilePaths(className) {
	const paths = [
		{
			cpp: `libraries/APM_Control/${className}.cpp`,
			h: `libraries/APM_Control/${className}.h`,
			configH: `libraries/APM_Control/${className}_config.h`,
		},
		{
			cpp: `libraries/AC_AttitudeControl/${className}.cpp`,
			h: `libraries/AC_AttitudeControl/${className}.h`,
			configH: `libraries/AC_AttitudeControl/${className}_config.h`,
		},
		{
			cpp: `libraries/AC_AttitudeControl/${className}_Multi.cpp`,
			h: `libraries/AC_AttitudeControl/${className}_Multi.h`,
			configH: `libraries/AC_AttitudeControl/${className}_config.h`,
		},
		{
			cpp: `libraries/AP_Motors/${className}.cpp`,
			h: `libraries/AP_Motors/${className}.h`,
			configH: `libraries/AP_Motors/${className}_config.h`,
		},
		{
			cpp: `libraries/AR_Motors/${className}.cpp`,
			h: `libraries/AR_Motors/${className}.h`,
			configH: `libraries/AR_Motors/${className}_config.h`,
		},
		{
			cpp: `libraries/AP_BLHeli/${className}.cpp`,
			h: `libraries/AP_BLHeli/${className}.h`,
			configH: `libraries/AP_BLHeli/${className}_config.h`,
		},
		{
			cpp: `libraries/SRV_Channel/${className}.cpp`,
			h: `libraries/SRV_Channel/${className}.h`,
			configH: `libraries/SRV_Channel/${className}_config.h`,
		},
		{
			cpp: `libraries/${className}/${className}.cpp`,
			h: `libraries/${className}/${className}.h`,
			configH: `libraries/${className}/${className}_config.h`,
		},
	];
	if (className.includes("_")) {
		const parts = className.split("_");
		const baseName = parts[0] + "_" + parts[1];
		paths.push({
			cpp: `libraries/${baseName}/${baseName}.cpp`,
			h: `libraries/${baseName}/${baseName}.h`,
			configH: `libraries/${baseName}/${baseName}_config.h`,
		});
		paths.push({
			cpp: `libraries/${baseName}/${className}.cpp`,
			h: `libraries/${baseName}/${baseName}.h`,
			configH: `libraries/${baseName}/${className}_config.h`,
		});
	}
	return paths;
}

/**
 * Main 100% Dynamic Parameter Fetcher & Engine
 * Auto-discovers libraries & header defines directly from ArduPilot source files for any version
 */
export async function getVehicleParameters(vehicleId, versionTag = "master") {
	const cacheKey = `${CACHE_PREFIX}${vehicleId}_${versionTag}`;
	if (isStorageAvailable()) {
		const cached = localStorage.getItem(cacheKey);
		if (cached) {
			try {
				return JSON.parse(cached);
			} catch {
				localStorage.removeItem(cacheKey);
			}
		}
	}

	const vehicleObj = VEHICLES.find((v) => v.id === vehicleId) || VEHICLES[0];
	const tag = versionTag === "master" ? "master" : versionTag;

	// 1. Fetch metadata: versioned XML first for non-master, fall back to master JSON
	const versionedMetaPromise = fetchVersionedMetadata(vehicleId, versionTag);
	const masterMetaUrl = `https://autotest.ardupilot.org/Parameters/${vehicleId}/apm.pdef.json`;
	const masterMetaPromise = fetch(masterMetaUrl)
		.then((r) => (r.ok ? r.json() : {}))
		.catch(() => ({}));

	// 2. Fetch C++ Parameters.cpp & config.h for top-level parameters & defines (supports both Rover/ and APMrover2/ directory structures)
	const cppUrls = [
		`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/${vehicleObj.vehicleDir}/Parameters.cpp`,
		`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/APMrover2/Parameters.cpp`,
	];
	const configUrls = [
		`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/${vehicleObj.vehicleDir}/config.h`,
		`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/APMrover2/config.h`,
	];
	const definesUrls = [
		`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/${vehicleObj.vehicleDir}/defines.h`,
		`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/APMrover2/defines.h`,
	];

	const fetchFirstOkText = async (urls) => {
		for (const url of urls) {
			try {
				const r = await fetch(url);
				if (r.ok) return await r.text();
			} catch {}
		}
		return "";
	};

	const cppPromise = fetchFirstOkText(cppUrls);
	const configPromise = fetchFirstOkText(configUrls);
	const definesPromise = fetchFirstOkText(definesUrls);

	// 3. Fetch default .parm file
	const parmUrl = `https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/Tools/autotest/default_params/${vehicleObj.defaultParm}`;
	const parmPromise = fetch(parmUrl)
		.then((r) => (r.ok ? r.text() : ""))
		.catch(() => "");

	const [
		versionedMeta,
		masterMeta,
		cppText,
		configText,
		vehicleDefinesText,
		parmText,
	] = await Promise.all([
		versionedMetaPromise,
		masterMetaPromise,
		cppPromise,
		configPromise,
		definesPromise,
		parmPromise,
	]);

	// Merge: versioned XML is authoritative for the loaded version; master JSON fills in any gaps
	// (e.g. params that exist in current master but not versioned, for fallback enrichment)
	let metadata;
	if (versionedMeta && Object.keys(versionedMeta).length > 0) {
		// Start with master as a baseline for anything only in current master, then overlay versioned
		// Convert master JSON groups -> flat map first
		const masterFlat = {};
		if (typeof masterMeta === "object" && masterMeta !== null) {
			for (const [, groupContent] of Object.entries(masterMeta)) {
				if (typeof groupContent === "object" && groupContent !== null) {
					for (const [pName, pMeta] of Object.entries(groupContent)) {
						if (pName && /^[A-Z0-9_]+$/.test(pName)) masterFlat[pName] = pMeta;
					}
				}
			}
		}
		// Versioned XML wins for any param it contains; master fills gaps
		metadata = { ...masterFlat, ...versionedMeta };
	} else {
		// Flatten master JSON normally (groups -> flat)
		metadata = {};
		if (typeof masterMeta === "object" && masterMeta !== null) {
			for (const [, groupContent] of Object.entries(masterMeta)) {
				if (typeof groupContent === "object" && groupContent !== null) {
					for (const [pName, pMeta] of Object.entries(groupContent)) {
						if (pName && /^[A-Z0-9_]+$/.test(pName)) metadata[pName] = pMeta;
					}
				}
			}
		}
	}
	// Track all prefixes and parameter names explicitly registered in Parameters.cpp for this version tag
	const registeredPrefixes = new Set();
	const directCppNames = new Set();

	const groupInfoRegex = /AP_GROUPINFO(?:_FLAGS)?\s*\(\s*"([A-Z0-9_]+)"\s*,/g;
	let gMatch = groupInfoRegex.exec(cppText);
	while (gMatch !== null) {
		directCppNames.add(gMatch[1]);
		gMatch = groupInfoRegex.exec(cppText);
	}
	const gScalarRegex = /GSCALAR\s*\(\s*[^,]+\s*,\s*"([A-Z0-9_]+)"\s*,/g;
	gMatch = gScalarRegex.exec(cppText);
	while (gMatch !== null) {
		directCppNames.add(gMatch[1]);
		gMatch = gScalarRegex.exec(cppText);
	}

	const lines = cppText.split("\n");
	let currentGroup = null;

	const classFetchMap = [];

	lines.forEach((line) => {
		line = line.trim();
		if (line.startsWith("// @Group:")) {
			currentGroup = line.replace("// @Group:", "").trim();
			if (!currentGroup.endsWith("_")) currentGroup += "_";
			registeredPrefixes.add(currentGroup);
			registeredPrefixes.add(normalizePrefixSmart(currentGroup));
		} else if (line.startsWith("// @Path:") && currentGroup) {
			const pathsStr = line.replace("// @Path:", "").trim();
			pathsStr.split(",").forEach((p) => {
				const cleanPath = p.trim().replace(/^\.\.\//, "");
				const hPath = cleanPath.replace(/\.cpp$/, ".h");
				const configHPath = cleanPath.replace(/\.cpp$/, "_config.h");
				classFetchMap.push({
					prefix: currentGroup,
					cppPath: cleanPath,
					hPath: hPath,
					configHPath: configHPath,
				});
			});
		}
	});

	// Also parse AP_SUBGROUPINFO declarations in Parameters.cpp
	const subGroupRegex =
		/AP_SUBGROUPINFO\s*\(\s*([_a-zA-Z0-9]+)\s*,\s*"([^"]+)"/g;
	let match = subGroupRegex.exec(cppText);
	while (match !== null) {
		let pref = match[2];
		if (!pref.endsWith("_")) pref += "_";
		registeredPrefixes.add(pref);
		registeredPrefixes.add(normalizePrefixSmart(pref));
		const className = match[1];
		const candidates = getCandidateFilePaths(className);
		candidates.forEach((cand) => {
			classFetchMap.push({
				prefix: pref,
				cppPath: cand.cpp,
				hPath: cand.h,
				configHPath: cand.configH,
			});
		});
		match = subGroupRegex.exec(cppText);
	}

	classFetchMap.forEach((item) => {
		if (item.prefix) {
			registeredPrefixes.add(item.prefix);
			registeredPrefixes.add(normalizePrefixSmart(item.prefix));
		}
	});

	// Fetch all discovered library C++, .h, and _config.h files in parallel
	const fetchPromises = classFetchMap.map((item) =>
		Promise.all([
			fetch(
				`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/${item.cppPath}`,
			)
				.then((r) => (r.ok ? r.text() : ""))
				.catch(() => ""),
			fetch(
				`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/${item.hPath}`,
			)
				.then((r) => (r.ok ? r.text() : ""))
				.catch(() => ""),
			fetch(
				`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/${item.configHPath}`,
			)
				.then((r) => (r.ok ? r.text() : ""))
				.catch(() => ""),
		]),
	);

	const libResults = await Promise.all(fetchPromises);

	// Discover nested subgroups recursively inside library files (e.g. SRV_Channels -> AP_BLHeli)
	const nestedFetchMap = [];
	libResults.forEach(([cppContent], idx) => {
		if (cppContent) {
			const parentPrefix = classFetchMap[idx].prefix;
			let sgMatch = subGroupRegex.exec(cppContent);
			while (sgMatch !== null) {
				let subPrefix = sgMatch[2];
				if (!subPrefix.endsWith("_")) subPrefix += "_";
				const className = sgMatch[1];
				const fullPrefix = (parentPrefix + subPrefix).replace(/__+/g, "_");
				registeredPrefixes.add(fullPrefix);
				registeredPrefixes.add(normalizePrefixSmart(fullPrefix));
				const candidates = getCandidateFilePaths(className);
				candidates.forEach((cand) => {
					nestedFetchMap.push({
						prefix: fullPrefix,
						cppPath: cand.cpp,
						hPath: cand.h,
						configHPath: cand.configH,
					});
				});
				sgMatch = subGroupRegex.exec(cppContent);
			}
		}
	});

	if (nestedFetchMap.length > 0) {
		const nestedPromises = nestedFetchMap.map((item) =>
			Promise.all([
				fetch(
					`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/${item.cppPath}`,
				)
					.then((r) => (r.ok ? r.text() : ""))
					.catch(() => ""),
				fetch(
					`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/${item.hPath}`,
				)
					.then((r) => (r.ok ? r.text() : ""))
					.catch(() => ""),
				fetch(
					`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/${item.configHPath}`,
				)
					.then((r) => (r.ok ? r.text() : ""))
					.catch(() => ""),
			]),
		);
		const nestedResults = await Promise.all(nestedPromises);
		classFetchMap.push(...nestedFetchMap);
		libResults.push(...nestedResults);
	}

	// Pass 1: Accumulate ALL #define macros across vehicle config.h, defines.h, Parameters.cpp, and library files
	let dynamicDefines = parseHeaderDefines(cppText, vehicleId, {});
	dynamicDefines = parseHeaderDefines(configText, vehicleId, dynamicDefines);
	dynamicDefines = parseHeaderDefines(
		vehicleDefinesText,
		vehicleId,
		dynamicDefines,
	);

	libResults.forEach(([cppContent, hContent, configHContent]) => {
		if (configHContent)
			dynamicDefines = parseHeaderDefines(
				configHContent,
				vehicleId,
				dynamicDefines,
			);
		if (hContent)
			dynamicDefines = parseHeaderDefines(hContent, vehicleId, dynamicDefines);
		if (cppContent)
			dynamicDefines = parseHeaderDefines(
				cppContent,
				vehicleId,
				dynamicDefines,
			);
	});

	// Pass 2: Parse PID struct initializers, constructor initializers, and AP_GROUPINFO / GSCALAR lines using accumulated defines
	let ctorDefaults = {};
	const resolvedLibDefaults = {};

	libResults.forEach(([cppContent, hContent], index) => {
		const { prefix } = classFetchMap[index];
		if (hContent) {
			ctorDefaults = parsePidStructInitializers(
				hContent,
				dynamicDefines,
				ctorDefaults,
			);
		}
		if (cppContent) {
			ctorDefaults = parsePidStructInitializers(
				cppContent,
				dynamicDefines,
				ctorDefaults,
			);
			ctorDefaults = parseCtorSubgroupInitializers(
				cppContent,
				prefix,
				dynamicDefines,
				ctorDefaults,
			);

			const parsedLib = parseCppDefaults(cppContent, dynamicDefines);
			for (const [rawName, rawVal] of Object.entries(parsedLib)) {
				const fullKey = (prefix + rawName).replace(/__+/g, "_");
				resolvedLibDefaults[fullKey] = rawVal;
				resolvedLibDefaults[rawName] = rawVal;
			}
		}
	});

	const topLevelCppDefaults = parseCppDefaults(cppText, dynamicDefines);
	const parmDefaults = parseParmFile(parmText, dynamicDefines);

	const isAfsDisabled =
		dynamicDefines["ADVANCED_FAILSAFE"] === "DISABLED" ||
		dynamicDefines["ADVANCED_FAILSAFE"] === "0" ||
		(configText.includes("ADVANCED_FAILSAFE") &&
			configText.includes("DISABLED"));
	const isRadioDisabled =
		dynamicDefines["AP_RADIO_ENABLED"] === "0" ||
		dynamicDefines["AP_RADIO_ENABLED"] === undefined;

	// Flatten metadata (already flat if versioned; groups if master-only path)
	const flattenedMetadata = {};
	if (typeof metadata === "object" && metadata !== null) {
		for (const [pName, pMeta] of Object.entries(metadata)) {
			if (!pName || !/^[A-Z0-9_]+$/.test(pName)) continue;
			if (pName === "Title" || pName === "Source" || pName === "Description")
				continue;

			// FILTER 1: Omit Plane-only orphan parameters from other vehicles
			if (pName.startsWith("ALAND_") || pName.startsWith("AUTOLAND_")) {
				if (vehicleId !== "ArduPlane") continue;
			}

			// FILTER 2: Omit AFS_ params for vehicles where it's disabled
			if (
				pName.startsWith("AFS_") &&
				(isAfsDisabled ||
					vehicleId === "APMrover2" ||
					vehicleId === "ArduCopter" ||
					vehicleId === "ArduSub" ||
					vehicleId === "AntennaTracker" ||
					vehicleId === "Blimp")
			)
				continue;

			// FILTER 3: Omit BRD_RADIO_ if disabled
			if (pName.startsWith("BRD_RADIO_") && isRadioDisabled) continue;

			// FILTER 4: PER-VERSION REGISTRATION CHECK (skip for versioned metadata which is already version-correct)
			if (!versionedMeta || Object.keys(versionedMeta).length === 0) {
				// Only apply registration filter when using master JSON metadata
				const pPrefix = pName.includes("_") ? pName.split("_")[0] + "_" : pName;
				const normPrefix = normalizePrefixSmart(pPrefix);
				// (groupKey not available in flat form; use prefix-based check only)
				const isRegisteredInTag =
					directCppNames.has(pName) ||
					registeredPrefixes.has(pPrefix) ||
					registeredPrefixes.has(normPrefix) ||
					topLevelCppDefaults[pName] !== undefined ||
					resolvedLibDefaults[pName] !== undefined ||
					ctorDefaults[pName] !== undefined ||
					parmDefaults[pName] !== undefined;
				if (!isRegisteredInTag && versionTag !== "master") continue;
			}

			flattenedMetadata[pName] = pMeta;
		}
	}

	const validFullNamesSet = new Set([
		...Object.keys(flattenedMetadata),
		...Object.keys(topLevelCppDefaults),
		...Object.keys(parmDefaults),
	]);

	// Combine: Library C++ Defaults < Top-level C++ < Constructor Defaults < .parm Defaults
	const finalDefaults = { ...resolvedLibDefaults, ...topLevelCppDefaults };

	for (const [k, v] of Object.entries(ctorDefaults)) {
		if (v && v !== "0" && v !== "0.0") {
			finalDefaults[k] = v;
		} else if (!finalDefaults[k]) {
			finalDefaults[k] = v;
		}
	}

	Object.assign(finalDefaults, parmDefaults);

	const resultList = [];

	for (const name of validFullNamesSet) {
		if (
			!name ||
			name === "Title" ||
			name === "Source" ||
			name === "Description"
		)
			continue;
		if (name.startsWith("AEROM_") && !finalDefaults[name]) continue;
		if (name.startsWith("AFS_") && (vehicleId !== "ArduPlane" || isAfsDisabled))
			continue;
		if (
			(name.startsWith("ALAND_") || name.startsWith("AUTOLAND_")) &&
			vehicleId !== "ArduPlane"
		)
			continue;
		if (name.startsWith("BRD_RADIO_") && isRadioDisabled) continue;
		if (name === "ATC_BAL_FILT") continue; // Omit non-existent legacy FILT parameter for AC_PID

		const meta = flattenedMetadata[name] || {};

		let defaultValue = finalDefaults[name];
		if (
			defaultValue === undefined ||
			defaultValue === null ||
			defaultValue === ""
		) {
			defaultValue =
				meta.Default !== undefined
					? resolveValueExpression(meta.Default, dynamicDefines)
					: "0";
		} else {
			defaultValue = resolveValueExpression(defaultValue, dynamicDefines);
		}

		resultList.push({
			name: name,
			displayName: meta.DisplayName || name,
			description: meta.Description || "Standard ArduPilot vehicle parameter.",
			defaultValue: defaultValue,
			units: meta.Units || "",
			range: meta.Range
				? {
						min: meta.Range.low || meta.Range.min,
						max: meta.Range.high || meta.Range.max,
					}
				: null,
			options: meta.Values || meta.Options || null,
			bitmask: meta.Bitmask || null,
			readOnly: meta.ReadOnly === "True" || meta.ReadOnly === true,
			rebootRequired:
				meta.RebootRequired === "True" || meta.RebootRequired === true,
			userLevel: meta.User || "Standard",
			category: getParameterCategory(name),
		});
	}

	resultList.sort((a, b) => a.name.localeCompare(b.name));

	if (isStorageAvailable()) {
		try {
			localStorage.setItem(cacheKey, JSON.stringify(resultList));
		} catch {
			console.warn("LocalStorage full, skipping cache save");
		}
	}

	return resultList;
}

/**
 * Categorize parameter based on naming prefix
 */
export function getParameterCategory(paramName) {
	const prefix = paramName.split("_")[0] || paramName;
	const categoryMap = {
		ARMING: "Arming & Failsafe",
		FS: "Arming & Failsafe",
		BATT: "Battery & Power",
		MOT: "Motors & Actuators",
		SERVO: "Motors & Actuators",
		EKF: "EKF & Navigation",
		EK2: "EKF & Navigation",
		EK3: "EKF & Navigation",
		AHRS: "EKF & Navigation",
		PSC: "EKF & Navigation",
		POS: "EKF & Navigation",
		COMPASS: "Sensors & Compass",
		MAG: "Sensors & Compass",
		GPS: "GPS & Telemetry",
		SERIAL: "GPS & Telemetry",
		TELE: "GPS & Telemetry",
		RC: "Radio & Controls",
		RCMAP: "Radio & Controls",
		FLTMODE: "Flight Modes",
		MODE: "Flight Modes",
		ATC: "Attitude Control",
		WPNAV: "EKF & Navigation",
		STEER: "Attitude Control",
		RLL2SRV: "Attitude Control",
		PTCH2SRV: "Attitude Control",
		YAW2SRV: "Attitude Control",
	};

	return categoryMap[prefix] || "General System";
}

/**
 * Categorize Log Message based on message name
 */
export function getLogCategory(messageName) {
	if (!messageName) return "General System";
	const name = messageName.toUpperCase();

	if (
		/^(ACC|GYR|BARO|BAR\d|MAG|MAG\d|IMU|IMU\d|RNGFND|RFND|OF|ARSP|AERS|AERG|BARD|GRAW|SENS|OVT)$/.test(
			name,
		) ||
		name.includes("BARO") ||
		name.includes("IMU") ||
		name.includes("MAG")
	) {
		return "IMU & Sensors";
	}
	if (
		/^(ATT|POS|PSC|XKF\d|NKF\d|AHR2|SIM|AERN|TERR|RALY|WP|NTUN|DMS|ORGN|GPD|POSZ|POSX)$/.test(
			name,
		) ||
		name.startsWith("EKF") ||
		name.startsWith("XKF") ||
		name.startsWith("NKF")
	) {
		return "EKF & Navigation";
	}
	if (
		/^(BAT|BATT|POWR|MOTB|BCL|BCL2|MCU|PWR|PM|BAT2)$/.test(name) ||
		name.startsWith("BAT") ||
		name.startsWith("POWR")
	) {
		return "Battery & Power";
	}
	if (
		/^(RCIN|RCOUT|RCI2|RAD|AUXF|SWT|RCO2|RCO3|MAV|MAVC|RADIO)$/.test(name) ||
		name.startsWith("RC") ||
		name.startsWith("MAV")
	) {
		return "Radio & Controls";
	}
	if (/^(MODE|CMD|MIS|AUTO|SRTL|EV)$/.test(name)) {
		return "Flight Modes & Missions";
	}
	if (
		/^(ARM|ERR|EV|PM|VER|MSG|STAK|FILE|DSF|FMT|UNIT|MULT|RTC|FTN|PCOU)$/.test(
			name,
		)
	) {
		return "System & Events";
	}
	if (
		/^(MOT|SRVO|ESC|ESCS|SPOL|WENC|WINC)$/.test(name) ||
		name.startsWith("MOT") ||
		name.startsWith("ESC")
	) {
		return "Motors & Actuators";
	}

	return "General System";
}

/**
 * Parse LogMessages.xml string using DOMParser with regex fallback
 */
function parseLogMessagesXml(xmlText) {
	if (!xmlText) return [];

	if (typeof DOMParser !== "undefined") {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(xmlText, "application/xml");
			if (!doc.querySelector("parsererror")) {
				const resultList = [];
				doc.querySelectorAll("logformat").forEach((format) => {
					const name = format.getAttribute("name");
					if (!name) return;

					const descEl = format.querySelector(":scope > description");
					const description = descEl
						? descEl.textContent.trim()
						: "ArduPilot on-board dataflash log message.";

					const urlEl = format.querySelector(":scope > url");
					const docUrl = urlEl ? urlEl.textContent.trim() : "";

					const fields = [];
					const fieldsEl = format.querySelector("fields");
					if (fieldsEl) {
						fieldsEl.querySelectorAll("field").forEach((field) => {
							const fName = field.getAttribute("name") || "";
							const fUnits = field.getAttribute("units") || "";
							const fType = field.getAttribute("type") || "";

							const fDescEl = field.querySelector("description");
							const fDesc = fDescEl ? fDescEl.textContent.trim() : "";

							const bitmask = {};
							field.querySelectorAll("bit").forEach((bit) => {
								bitmask[bit.getAttribute("name") || bit.textContent.trim()] =
									bit.textContent.trim();
							});

							const values = {};
							field.querySelectorAll("value").forEach((val) => {
								values[val.getAttribute("code")] = val.textContent.trim();
							});

							fields.push({
								name: fName,
								units: fUnits,
								type: fType,
								description: fDesc,
								bitmask: Object.keys(bitmask).length ? bitmask : null,
								values: Object.keys(values).length ? values : null,
							});
						});
					}

					resultList.push({
						name,
						description,
						docUrl,
						category: getLogCategory(name),
						fields,
						fieldsCount: fields.length,
					});
				});
				return resultList;
			}
		} catch (e) {
			console.warn("DOMParser failed, falling back to regex parser:", e);
		}
	}

	// Regex fallback parser (works in Node & edge environments)
	const resultList = [];
	const logformatRegex = /<logformat name="([^"]+)">([\s\S]*?)<\/logformat>/g;
	for (const match of xmlText.matchAll(logformatRegex)) {
		const name = match[1];
		const body = match[2];

		const descMatch = body.match(/<description>([\s\S]*?)<\/description>/);
		const description = descMatch
			? descMatch[1].trim()
			: "ArduPilot on-board dataflash log message.";

		const urlMatch = body.match(/<url>([\s\S]*?)<\/url>/);
		const docUrl = urlMatch ? urlMatch[1].trim() : "";

		const fields = [];
		const fieldRegex =
			/<field name="([^"]+)" units="([^"]*)" type="([^"]*)">([\s\S]*?)<\/field>/g;
		for (const fMatch of body.matchAll(fieldRegex)) {
			const fName = fMatch[1];
			const fUnits = fMatch[2];
			const fType = fMatch[3];
			const fBody = fMatch[4];

			const fDescMatch = fBody.match(/<description>([\s\S]*?)<\/description>/);
			const fDesc = fDescMatch ? fDescMatch[1].trim() : "";

			const bitmask = {};
			const bitRegex = /<bit name="([^"]+)">(\d+)<\/bit>/g;
			for (const bMatch of fBody.matchAll(bitRegex)) {
				bitmask[bMatch[2]] = bMatch[1];
			}

			const values = {};
			const valRegex = /<value code="([^"]+)">([\s\S]*?)<\/value>/g;
			for (const vMatch of fBody.matchAll(valRegex)) {
				values[vMatch[1]] = vMatch[2].trim();
			}

			fields.push({
				name: fName,
				units: fUnits,
				type: fType,
				description: fDesc,
				bitmask: Object.keys(bitmask).length ? bitmask : null,
				values: Object.keys(values).length ? values : null,
			});
		}

		resultList.push({
			name,
			description,
			docUrl,
			category: getLogCategory(name),
			fields,
			fieldsCount: fields.length,
		});
	}
	return resultList;
}

/**
 * Generic C++ Source Log Scraper:
 * Scrapes inline Log_Write / Write calls and struct LogStructure declarations
 * from GitHub C++ files for a specific version tag without hardcoded handlers.
 */
async function scrapeLogMessagesFromSource(vehicleId, versionTag) {
	const vehicleObj = VEHICLES.find((v) => v.id === vehicleId) || VEHICLES[0];
	const vDir = vehicleObj.vehicleDir;
	const tag = versionTag;

	const formatTypeMap = {
		a: { type: "int16_t[32]", units: "" },
		b: { type: "int8_t", units: "" },
		B: { type: "uint8_t", units: "" },
		h: { type: "int16_t", units: "" },
		H: { type: "uint16_t", units: "" },
		i: { type: "int32_t", units: "" },
		I: { type: "uint32_t", units: "" },
		f: { type: "float", units: "" },
		d: { type: "double", units: "" },
		q: { type: "int64_t", units: "" },
		Q: { type: "uint64_t", units: "μs" },
		c: { type: "int16_t", units: "c" },
		C: { type: "uint16_t", units: "c" },
		e: { type: "int32_t", units: "c" },
		E: { type: "uint32_t", units: "c" },
		L: { type: "int32_t", units: "deg * 1e7" },
		n: { type: "char[4]", units: "" },
		N: { type: "char[16]", units: "" },
		Z: { type: "char[64]", units: "" },
		M: { type: "uint8_t", units: "" },
	};
	const paths = [
		`${vDir}/Log.cpp`,
		`APMrover2/Log.cpp`,
		`${vDir}/${vDir}.cpp`,
		`${vDir}/Attitude.cpp`,
		`${vDir}/sensors.cpp`,
		`libraries/AP_Logger/LogStructure.h`,
		`libraries/DataFlash/LogStructure.h`,
		`libraries/DataFlash/DataFlash.cpp`,
		`libraries/AC_AttitudeControl/ControlMonitor.cpp`,
		`libraries/AC_AttitudeControl/AC_AttitudeControl_Logging.cpp`,
		`libraries/AC_AttitudeControl/AC_AttitudeControl.cpp`,
		`libraries/AC_AttitudeControl/AC_PosControl.cpp`,
		`libraries/AP_Tuning/AP_Tuning.cpp`,
		`libraries/AP_NavEKF3/AP_NavEKF3_Logging.cpp`,
		`libraries/AP_Compass/AP_Compass_Logging.cpp`,
	];

	const fetchText = async (path) => {
		try {
			const res = await fetch(
				`https://raw.githubusercontent.com/ArduPilot/ardupilot/${tag}/${path}`,
			);
			return res.ok ? await res.text() : "";
		} catch {
			return "";
		}
	};

	const texts = await Promise.all(paths.map(fetchText));
	const scrapedMap = new Map();

	const parseFields = (fieldNamesStr, fmtStr) => {
		const names = fieldNamesStr
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		const fmts = (fmtStr || "").split("");
		return names.map((fName, idx) => {
			const char = fmts[idx] || "f";
			const info = formatTypeMap[char] || { type: "float", units: "" };
			const isTime = fName.toLowerCase().includes("time");
			return {
				name: fName,
				units: isTime ? "μs" : info.units,
				type: info.type,
				description: isTime
					? "Time since system startup"
					: `${fName} field (${info.type})`,
			};
		});
	};

	texts.forEach((text) => {
		if (!text) return;

		// Pattern 1: Inline Log_Write / Write / WriteStreaming calls
		const logWriteRegex =
			/(?:Log_Write|\.Write|\.WriteStreaming)\s*\(\s*"([A-Z0-9_]{2,8})"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/gs;
		for (const m of text.matchAll(logWriteRegex)) {
			const name = m[1];
			const fieldNamesStr = m[2];
			const fmtStr = m[3];
			const fields = parseFields(fieldNamesStr, fmtStr);

			scrapedMap.set(name, {
				name,
				description: `On-board DataFlash log message format ${name} compiled from C++ source.`,
				docUrl: "",
				category: getLogCategory(name),
				fields,
				fieldsCount: fields.length,
			});
		}

		// Pattern 2: struct LogStructure declarations { LOG_..._MSG, sizeof(...), "NAME", "FmtStr", "Labels", ... }
		const logStructRegex =
			/{\s*LOG_[A-Z0-9_]+\s*,\s*(?:sizeof\([^)]+\)|[0-9]+)\s*,\s*"([A-Z0-9_]{2,8})"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
		for (const m of text.matchAll(logStructRegex)) {
			const name = m[1];
			const fmtStr = m[2];
			const fieldNamesStr = m[3];
			const fields = parseFields(fieldNamesStr, fmtStr);

			if (!scrapedMap.has(name)) {
				scrapedMap.set(name, {
					name,
					description: `On-board DataFlash log message format ${name} compiled from C++ source structure.`,
					docUrl: "",
					category: getLogCategory(name),
					fields,
					fieldsCount: fields.length,
				});
			}
		}

		// Pattern 3: @LoggerMessage: NAME C++ doc comments
		const docBlockRegex =
			/\/\/\s*@LoggerMessage\s*:\s*([A-Z0-9_,]+)([\s\S]*?)(?=\/\/\s*@LoggerMessage|struct|\n\s*\n|$)/g;
		for (const m of text.matchAll(docBlockRegex)) {
			const names = m[1].split(",").map((s) => s.trim());
			const block = m[2];

			const descMatch = block.match(/\/\/\s*@Description\s*:\s*(.*)/);
			const description = descMatch ? descMatch[1].trim() : "";

			const urlMatch = block.match(/\/\/\s*@URL\s*:\s*(.*)/);
			const docUrl = urlMatch ? urlMatch[1].trim() : "";

			const fieldDescs = {};
			const fieldRegex = /\/\/\s*@Field\s*:\s*([A-Z0-9_]+)\s*:\s*(.*)/g;
			for (const fMatch of block.matchAll(fieldRegex)) {
				fieldDescs[fMatch[1]] = fMatch[2].trim();
			}

			names.forEach((name) => {
				if (scrapedMap.has(name)) {
					const existing = scrapedMap.get(name);
					if (description) existing.description = description;
					if (docUrl) existing.docUrl = docUrl;
					existing.fields.forEach((f) => {
						if (fieldDescs[f.name]) f.description = fieldDescs[f.name];
					});
				}
			});
		}
	});

	return Array.from(scrapedMap.values());
}

/**
 * Fetch and Parse Log Messages Metadata for a vehicle type and version tag
 */
export async function getVehicleLogMessages(vehicleId, versionTag = "master") {
	const vehicleFolderMap = {
		ArduCopter: "Copter",
		ArduPlane: "Plane",
		APMrover2: "Rover",
		AntennaTracker: "Tracker",
		ArduSub: "Sub",
		Blimp: "Blimp",
	};

	const folder = vehicleFolderMap[vehicleId] || "Copter";
	const cacheKey = `${CACHE_PREFIX}log_messages_${folder}_${versionTag}`;

	if (isStorageAvailable()) {
		const cached = localStorage.getItem(cacheKey);
		if (cached) {
			try {
				return JSON.parse(cached);
			} catch {
				localStorage.removeItem(cacheKey);
			}
		}
	}

	const url = `https://autotest.ardupilot.org/LogMessages/${folder}/LogMessages.xml`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch LogMessages.xml for ${folder} (${res.status})`,
		);
	}

	const xmlText = await res.text();
	const baseLogs = parseLogMessagesXml(xmlText);
	const scrapedLogs = await scrapeLogMessagesFromSource(vehicleId, versionTag);

	const logMap = new Map(baseLogs.map((l) => [l.name, l]));
	scrapedLogs.forEach((sLog) => {
		if (!logMap.has(sLog.name)) {
			logMap.set(sLog.name, sLog);
		}
	});

	const resultList = Array.from(logMap.values());
	resultList.sort((a, b) => a.name.localeCompare(b.name));

	if (isStorageAvailable()) {
		try {
			localStorage.setItem(cacheKey, JSON.stringify(resultList));
		} catch {
			console.warn("LocalStorage full, skipping log cache save");
		}
	}

	return resultList;
}
