/**
* converter.js — Browser-compatible ES module for .acislove → ACNH conversion.
*/

import LZUTF8 from "lzutf8";

// ── Helpers ─────────────────────────────────────────────────────────────────

export function hsvToRgb(h, s, v) {
	h = ((h % 360) + 360) % 360;
	s /= 100;
	v /= 100;
	const c = v * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = v - c;
	let r, g, b;
	if (h < 60) [r, g, b] = [c, x, 0];
	else if (h < 120) [r, g, b] = [x, c, 0];
	else if (h < 180) [r, g, b] = [0, c, x];
	else if (h < 240) [r, g, b] = [0, x, c];
	else if (h < 300) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	return [
		Math.round((r + m) * 255),
		Math.round((g + m) * 255),
		Math.round((b + m) * 255),
	];
}

function encodeUtf16le(str) {
	const buf = new Uint8Array(str.length * 2);
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		buf[i * 2] = code & 0xff;
		buf[i * 2 + 1] = (code >> 8) & 0xff;
	}
	return buf;
}

// ── Design‑type registry ────────────────────────────────────────────────────

export const ACNH_TYPE = {
	easel: 0x00,
	nh_top_longsleeve_dressshirt: 0x03,
	nh_top_shortsleeve_tshirt: 0x04,
	nh_top_sleeveless_tanktop: 0x05,
	nh_top_longsleeve_sweater: 0x06,
	nh_top_longsleeve_hoodie: 0x07,
	nh_top_longsleeve_coat: 0x08,
	nh_dress_shortsleeve_shortsleeve: 0x09,
	nh_dress_sleeveless_sleeveless: 0x0a,
	nh_dress_longsleeve_long: 0x0b,
	nh_dress_shortsleeve_shortballoon: 0x0c,
	nh_dress_sleeveless_round: 0x0d,
	nh_dress_longsleeve_robe: 0x0e,
	nh_hat_brimmedcap: 0x0f,
	nh_hat_knit: 0x10,
	nh_hat_brimmedhat: 0x11,
	nh_variety_goods_face_panel: 0x1a,
	nh_variety_goods_umbrella: 0x1b,
	nh_variety_goods_handheld_flag: 0x1c,
	nh_variety_goods_uchiwa_fan: 0x1d,
};

export const DESIGN_LABELS = {
	easel: "Simple Pattern",
	nh_top_longsleeve_dressshirt: "Dress Shirt",
	nh_top_shortsleeve_tshirt: "T-Shirt",
	nh_top_sleeveless_tanktop: "Tank Top",
	nh_top_longsleeve_sweater: "Sweater",
	nh_top_longsleeve_hoodie: "Hoodie",
	nh_top_longsleeve_coat: "Coat",
	nh_dress_shortsleeve_shortsleeve: "Short-Sleeve Dress",
	nh_dress_sleeveless_sleeveless: "Sleeveless Dress",
	nh_dress_longsleeve_long: "Long-Sleeve Dress",
	nh_dress_shortsleeve_shortballoon: "Balloon-Hem Dress",
	nh_dress_sleeveless_round: "Round Dress",
	nh_dress_longsleeve_robe: "Robe",
	nh_hat_brimmedcap: "Brimmed Cap",
	nh_hat_knit: "Knit Cap",
	nh_hat_brimmedhat: "Brimmed Hat",
	nh_variety_goods_face_panel: "Standee",
	nh_variety_goods_umbrella: "Umbrella",
	nh_variety_goods_handheld_flag: "Flag",
	nh_variety_goods_uchiwa_fan: "Fan",
};

export const SPLIT_LAYOUT = {
	easel: [{ key: "front", w: 32, h: 32, dx: 0, dy: 0 }],
	
	nh_top_sleeveless_tanktop: [
		{ key: "front", w: 32, h: 32, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 32, dx: 0, dy: 0 },
	],
	nh_top_shortsleeve_tshirt: [
		{ key: "front", w: 32, h: 32, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 32, dx: 0, dy: 0 },
		{ key: "lsleeve", w: 22, h: 13, dx: 0, dy: 32 },
		{ key: "rsleeve", w: 22, h: 13, dx: 32, dy: 32 },
	],
	nh_top_longsleeve_dressshirt: [
		{ key: "front", w: 32, h: 32, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 32, dx: 0, dy: 0 },
		{ key: "lsleeve", w: 22, h: 22, dx: 0, dy: 32 },
		{ key: "rsleeve", w: 22, h: 22, dx: 32, dy: 32 },
	],
	nh_top_longsleeve_sweater: [
		{ key: "front", w: 32, h: 32, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 32, dx: 0, dy: 0 },
		{ key: "lsleeve", w: 22, h: 22, dx: 0, dy: 32 },
		{ key: "rsleeve", w: 22, h: 22, dx: 32, dy: 32 },
	],
	nh_top_longsleeve_hoodie: [
		{ key: "front", w: 32, h: 32, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 32, dx: 0, dy: 0 },
		{ key: "lsleeve", w: 22, h: 22, dx: 0, dy: 32 },
		{ key: "rsleeve", w: 22, h: 22, dx: 32, dy: 32 },
	],
	nh_top_longsleeve_coat: [
		{ key: "front", w: 32, h: 41, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 41, dx: 0, dy: 0 },
		{ key: "lsleeve", w: 22, h: 22, dx: 0, dy: 41 },
		{ key: "rsleeve", w: 22, h: 22, dx: 32, dy: 41 },
	],
	
	nh_dress_sleeveless_sleeveless: [
		{ key: "front", w: 32, h: 41, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 41, dx: 0, dy: 0 },
	],
	nh_dress_sleeveless_round: [
		{ key: "front", w: 32, h: 41, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 41, dx: 0, dy: 0 },
	],
	nh_dress_shortsleeve_shortsleeve: [
		{ key: "front", w: 32, h: 41, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 41, dx: 0, dy: 0 },
		{ key: "lsleeve", w: 22, h: 13, dx: 0, dy: 41 },
		{ key: "rsleeve", w: 22, h: 13, dx: 32, dy: 41 },
	],
	nh_dress_shortsleeve_shortballoon: [
		{ key: "front", w: 32, h: 41, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 41, dx: 0, dy: 0 },
		{ key: "lsleeve", w: 22, h: 13, dx: 0, dy: 41 },
		{ key: "rsleeve", w: 22, h: 13, dx: 32, dy: 41 },
	],
	nh_dress_longsleeve_long: [
		{ key: "front", w: 32, h: 41, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 41, dx: 0, dy: 0 },
		{ key: "lsleeve", w: 22, h: 22, dx: 0, dy: 41 },
		{ key: "rsleeve", w: 22, h: 22, dx: 32, dy: 41 },
	],
	nh_dress_longsleeve_robe: [
		{ key: "front", w: 32, h: 41, dx: 32, dy: 0 },
		{ key: "back", w: 32, h: 41, dx: 0, dy: 0 },
		{ key: "lsleeve", w: 30, h: 22, dx: 0, dy: 41 },
		{ key: "rsleeve", w: 30, h: 22, dx: 32, dy: 41 },
	],
	
	nh_hat_brimmedcap: [
		{ key: "front", w: 44, h: 41, dx: 0, dy: 0 },
		{ key: "back", w: 20, h: 44, dx: 44, dy: 0 },
		{ key: "tongue", w: 44, h: 21, dx: 0, dy: 41 },
	],
	nh_hat_knit: [{ key: "knit", w: 64, h: 53, dx: 0, dy: 0 }],
	nh_hat_brimmedhat: [
		{ key: "top", w: 36, h: 36, dx: 0, dy: 0 },
		{ key: "side", w: 64, h: 19, dx: 0, dy: 36 },
		{ key: "bot", w: 64, h: 9, dx: 0, dy: 55 },
	],
	
	nh_variety_goods_face_panel: [
		{ key: "standee", w: 42, h: 64, dx: 0, dy: 0 },
	],
	nh_variety_goods_handheld_flag: [
		{ key: "front", w: 38, h: 32, dx: 0, dy: 0 },
		{ key: "back", w: 38, h: 32, dx: 0, dy: 32 },
		{ key: "side", w: 3, h: 62, dx: 38, dy: 0 },
	],
	nh_variety_goods_uchiwa_fan: [
		{ key: "front", w: 40, h: 32, dx: 0, dy: 0 },
		{ key: "back", w: 40, h: 32, dx: 0, dy: 32 },
	],
	nh_variety_goods_umbrella: [
		{ key: "umbrella", w: 64, h: 64, dx: 0, dy: 0 },
	],
};

export function isProDesign(designType, patternCount) {
	if (designType === "easel") return false;
	if (ACNH_TYPE[designType] !== undefined) return true;
	// Unknown type — pro designs always have exactly 4 splits (32x32 sheets)
	return patternCount === 4;
}

// ── Parser ──────────────────────────────────────────────────────────────────

export function parseAcislove(bytes) {
	const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let decompressed;
	try {
		decompressed = LZUTF8.decompress(uint8, { inputEncoding: "ByteArray" });
	} catch {
		throw new Error("Failed to decompress — not a valid .acislove file");
	}
	
	let decoded;
	try {
		decoded = new TextDecoder().decode(
			Uint8Array.from(atob(decompressed), (c) => c.charCodeAt(0))
		);
	} catch {
		throw new Error("Failed to decode — file contents are corrupted");
	}
	const lines = decoded.split("\n");
	
	const splits = JSON.parse(lines[0]);
	const widthBlock = parseInt(lines[1], 10);
	const heightBlock = parseInt(lines[2], 10);
	const designType = (lines[5] || "").trim();
	
	const patterns = splits.map(([matrix, palette, index]) => ({
		index,
		matrix,
		palette,
	}));
	
	return { patterns, widthBlock, heightBlock, designType };
}

// ── Binary builders ─────────────────────────────────────────────────────────

const NORMAL_SIZE = 0x2a8; // 680
const PRO_SIZE = 0x8a8; // 2216
const OFFSET_NAME = 0x10;
const OFFSET_OWNERSHIP = 0x70;
const OFFSET_PALETTE = 0x78;
const OFFSET_PIXELS = 0xa5;
const NORMAL_TYPE_OFFSET = 0x2a5;
const PRO_TYPE_OFFSET = 0x8a5;

function writePalette(buf, palette) {
	for (let i = 0; i < 15; i++) {
		const [h, s, v] = palette[i] || [0, 0, 0];
		const [r, g, b] = hsvToRgb(h, s, v);
		buf[OFFSET_PALETTE + i * 3] = r;
		buf[OFFSET_PALETTE + i * 3 + 1] = g;
		buf[OFFSET_PALETTE + i * 3 + 2] = b;
	}
}

function writeHeader(buf, name, isPro) {
	if (name) {
		const nameBuf = encodeUtf16le(name.slice(0, 20));
		buf.set(nameBuf, OFFSET_NAME);
	}
	const dv = new DataView(buf.buffer);
	dv.setUint16(OFFSET_OWNERSHIP, isPro ? 0xee01 : 0xee02, true);
}

export function convertNormal(pattern, name) {
	const buf = new Uint8Array(NORMAL_SIZE);
	writeHeader(buf, name, false);
	writePalette(buf, pattern.palette);
	buf[NORMAL_TYPE_OFFSET] = 0x00;
	
	const matrix = pattern.matrix;
	for (let y = 0; y < 32; y++) {
		for (let x = 0; x < 32; x += 2) {
			const lo = (matrix[y]?.[x] ?? 15) & 0x0f;
			const hi = (matrix[y]?.[x + 1] ?? 15) & 0x0f;
			buf[OFFSET_PIXELS + (y * 32 + x) / 2] = (hi << 4) | lo;
		}
	}
	return buf;
}

export function buildProGrid(patterns, designType) {
	const grid = Array.from({ length: 64 }, () => new Uint8Array(64).fill(15));
	const layout = SPLIT_LAYOUT[designType];
	
	if (layout) {
		for (let i = 0; i < layout.length && i < patterns.length; i++) {
			const { dx, dy } = layout[i];
			const matrix = patterns[i].matrix;
			for (let y = 0; y < matrix.length; y++) {
				for (let x = 0; x < (matrix[0]?.length ?? 0); x++) {
					const gy = dy + y;
					const gx = dx + x;
					if (gy < 64 && gx < 64) grid[gy][gx] = matrix[y][x] & 0x0f;
				}
			}
		}
	} else {
		for (let i = 0; i < Math.min(patterns.length, 4); i++) {
			const qx = (i % 2) * 32;
			const qy = Math.floor(i / 2) * 32;
			const matrix = patterns[i].matrix;
			for (let y = 0; y < matrix.length && y < 32; y++) {
				for (let x = 0; x < (matrix[0]?.length ?? 0) && x < 32; x++) {
					grid[qy + y][qx + x] = matrix[y][x] & 0x0f;
				}
			}
		}
	}
	return grid;
}

export function convertPro(patterns, designType, name) {
	const buf = new Uint8Array(PRO_SIZE);
	writeHeader(buf, name, true);
	writePalette(buf, patterns[0].palette);
	buf[PRO_TYPE_OFFSET] = ACNH_TYPE[designType] ?? 0x00;
	
	const grid = buildProGrid(patterns, designType);
	
	const quadrants = [
		[0, 0],
		[32, 0],
		[0, 32],
		[32, 32],
	];
	for (let s = 0; s < 4; s++) {
		const [qx, qy] = quadrants[s];
		const sheetOff = OFFSET_PIXELS + s * 512;
		for (let y = 0; y < 32; y++) {
			for (let x = 0; x < 32; x += 2) {
				const lo = grid[qy + y][qx + x];
				const hi = grid[qy + y][qx + x + 1];
				buf[sheetOff + (y * 32 + x) / 2] = (hi << 4) | lo;
			}
		}
	}
	return buf;
}
