import "./style.css";
import {
	parseAcislove,
	isProDesign,
	convertNormal,
	convertPro,
	DESIGN_LABELS,
	SPLIT_LAYOUT,
} from "./converter.js";
import { renderPattern, renderProComposite } from "./renderer.js";
import { downloadBlob, downloadAllAsZip } from "./downloader.js";

// ── DOM refs ────────────────────────────────────────────────────────────────

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const errorEl = document.getElementById("error");
const resultsEl = document.getElementById("results");
const resultsMeta = document.getElementById("results-meta");
const resultsActions = document.getElementById("results-actions");
const resultsContent = document.getElementById("results-content");

// Accumulated output files across all loaded .acislove files
let allFiles = [];

// Smoothing toggle state (persisted in localStorage)
let smoothing = localStorage.getItem("acislove-smooth") === "true";

// Pending render jobs — each canvas stores its render params so we can re-render on toggle
const renderJobs = [];

// ── Drag & drop / file input ────────────────────────────────────────────────

dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
	if (fileInput.files.length) handleFiles(fileInput.files);
});

dropZone.addEventListener("dragover", (e) => {
	e.preventDefault();
	dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
	dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
	e.preventDefault();
	dropZone.classList.remove("drag-over");
	if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});

// ── Main handler ────────────────────────────────────────────────────────────

async function handleFiles(fileList) {
	hideError();

	const errors = [];

	for (const file of fileList) {
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const parsed = parseAcislove(bytes);
			const baseName = file.name.replace(/\.acislove$/i, "");
			processFile(parsed, baseName);
		} catch (err) {
			errors.push(`${file.name}: ${err.message}`);
		}
	}

	if (errors.length) {
		showError(errors.join("\n"));
	}

	finalizeResults();
}

function processFile(parsed, baseName) {
	const { patterns, designType } = parsed;
	const isPro = isProDesign(designType, patterns.length);
	const label = DESIGN_LABELS[designType] || designType;

	// Build output files for this input
	const files = [];

	if (isPro) {
		const data = convertPro(patterns, designType, baseName);
		files.push({ name: `${baseName}.nhpd`, data });
	} else {
		if (patterns.length === 1) {
			files.push({
				name: `${baseName}.nhd`,
				data: convertNormal(patterns[0], baseName),
			});
		} else {
			for (const pat of patterns) {
				const name = `${baseName}_${pat.index}`;
				files.push({ name: `${name}.nhd`, data: convertNormal(pat, name) });
			}
		}
	}

	allFiles.push(...files);

	// Render this file's section
	renderFileSection(parsed, isPro, baseName, label, files);
}

// ── UI rendering ────────────────────────────────────────────────────────────

function finalizeResults() {
	if (allFiles.length === 0) return;

	// Update meta summary
	const totalFiles = allFiles.length;
	resultsMeta.textContent = `${totalFiles} file${totalFiles !== 1 ? "s" : ""} ready`;

	// Download All button (always show when there's more than one output file)
	resultsActions.innerHTML = "";
	if (allFiles.length > 1) {
		const zipBtn = makeButton(
			"\u2B07 Download All (.zip)",
			"btn btn-primary",
			() => downloadAllAsZip(allFiles, "patterns.zip")
		);
		resultsActions.appendChild(zipBtn);
	} else if (allFiles.length === 1) {
		const dlBtn = makeButton(
			`\u2B07 Download ${allFiles[0].name}`,
			"btn btn-primary",
			() => downloadBlob(new Blob([allFiles[0].data]), allFiles[0].name)
		);
		resultsActions.appendChild(dlBtn);
	}

	resultsEl.classList.add("visible");
}

function renderFileSection(parsed, isPro, baseName, label, files) {
	const { patterns, designType } = parsed;

	// Section wrapper with heading
	const section = document.createElement("div");
	section.className = "file-section";

	const heading = document.createElement("div");
	heading.className = "file-section-header";
	heading.innerHTML =
		`<span class="file-section-name">${escapeHtml(baseName)}</span>` +
		`<span class="type-badge">${escapeHtml(label)}</span>`;
	section.appendChild(heading);

	if (isPro) {
		section.appendChild(buildProContent(patterns, designType, files));
	} else {
		section.appendChild(buildNormalContent(patterns, files));
	}

	resultsContent.prepend(section);
}

function buildProContent(patterns, designType, files) {
	const frag = document.createDocumentFragment();

	const proSection = document.createElement("div");
	proSection.className = "pro-section";

	// Composite preview
	const wrap = document.createElement("div");
	wrap.className = "pro-composite-wrap";

	const compositeCanvas = document.createElement("canvas");
	renderProComposite(compositeCanvas, patterns, designType, 4, smoothing);
	registerRender(compositeCanvas, { type: "pro", patterns, designType, scale: 4 });
	wrap.appendChild(compositeCanvas);

	if (files.length === 1) {
		const btn = makeButton(
			`\u2B07 ${files[0].name}`,
			"btn btn-sm btn-outline",
			() => downloadBlob(new Blob([files[0].data]), files[0].name)
		);
		wrap.appendChild(btn);
	}
	proSection.appendChild(wrap);

	// Individual split thumbnails
	const layout = SPLIT_LAYOUT[designType] || [];
	const splitsRow = document.createElement("div");
	splitsRow.className = "pro-splits";

	for (let i = 0; i < patterns.length; i++) {
		const thumb = document.createElement("div");
		thumb.className = "pro-split-thumb";

		const canvas = document.createElement("canvas");
		renderPattern(canvas, patterns[i].matrix, patterns[i].palette, 3, smoothing);
		registerRender(canvas, { type: "pattern", matrix: patterns[i].matrix, palette: patterns[i].palette, scale: 3 });
		thumb.appendChild(canvas);

		const lbl = document.createElement("div");
		lbl.className = "split-label";
		lbl.textContent = layout[i]?.key || `Part ${i}`;
		thumb.appendChild(lbl);

		splitsRow.appendChild(thumb);
	}
	proSection.appendChild(splitsRow);

	frag.appendChild(proSection);
	return frag;
}

function buildNormalContent(patterns, files) {
	const grid = document.createElement("div");
	grid.className = "pattern-grid";

	for (let i = 0; i < patterns.length; i++) {
		const pat = patterns[i];
		const file = files[i];

		const card = document.createElement("div");
		card.className = "pattern-card";

		const canvas = document.createElement("canvas");
		renderPattern(canvas, pat.matrix, pat.palette, 4, smoothing);
		registerRender(canvas, { type: "pattern", matrix: pat.matrix, palette: pat.palette, scale: 4 });
		card.appendChild(canvas);

		const label = document.createElement("div");
		label.className = "card-label";
		label.textContent = file.name;
		card.appendChild(label);

		const btn = makeButton("\u2B07 Download", "btn btn-sm btn-outline", () =>
			downloadBlob(new Blob([file.data]), file.name)
		);
		card.appendChild(btn);

		grid.appendChild(card);
	}

	return grid;
}

// ── Smoothing toggle ─────────────────────────────────────────────────────────

function registerRender(canvas, job) {
	renderJobs.push({ canvas, job });
}

function rerenderAll() {
	for (const { canvas, job } of renderJobs) {
		if (!canvas.isConnected) continue;
		if (job.type === "pro") {
			renderProComposite(canvas, job.patterns, job.designType, job.scale, smoothing);
		} else {
			renderPattern(canvas, job.matrix, job.palette, job.scale, smoothing);
		}
	}
}

function toggleSmoothing() {
	smoothing = !smoothing;
	localStorage.setItem("acislove-smooth", smoothing);
	updateSmoothBtn();
	rerenderAll();
}

const smoothBtn = document.getElementById("smooth-toggle");
function updateSmoothBtn() {
	smoothBtn.textContent = smoothing ? "Smoothing: On" : "Smoothing: Off";
	smoothBtn.classList.toggle("active", smoothing);
}
updateSmoothBtn();
smoothBtn.addEventListener("click", toggleSmoothing);

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeButton(text, className, onClick) {
	const btn = document.createElement("button");
	btn.className = className;
	btn.textContent = text;
	btn.addEventListener("click", onClick);
	return btn;
}

function escapeHtml(str) {
	const el = document.createElement("span");
	el.textContent = str;
	return el.innerHTML;
}

function showError(msg) {
	errorEl.textContent = msg;
	errorEl.classList.add("visible");
}

function hideError() {
	errorEl.classList.remove("visible");
	errorEl.textContent = "";
}
