/**
* renderer.js — Canvas rendering for ACNH pattern previews.
*/

import { hsvToRgb, buildProGrid } from "./converter.js";
import { xbr2x, xbr4x } from "xbr-js";

function paletteToRgb(palette) {
	return palette.map(([h, s, v]) => hsvToRgb(h, s, v));
}

/**
 * Build a 1:1 RGBA ImageData from a pattern matrix + palette.
 */
function buildImageData(matrix, palette) {
	const rows = matrix.length;
	const cols = matrix[0]?.length ?? 0;
	const rgb = paletteToRgb(palette);
	const img = new ImageData(cols, rows);
	const d = img.data;

	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const idx = matrix[y][x];
			const off = (y * cols + x) * 4;
			if (idx === 15) {
				d[off] = 0;
				d[off + 1] = 0;
				d[off + 2] = 0;
				d[off + 3] = 0;
			} else {
				const [r, g, b] = rgb[idx] || [0, 0, 0];
				d[off] = r;
				d[off + 1] = g;
				d[off + 2] = b;
				d[off + 3] = 255;
			}
		}
	}
	return img;
}

/**
 * Apply xBR upscaling to an ImageData, returning a new ImageData at 4x size.
 * Uses xbr4x for small patterns, xbr2x twice would also work but 4x is direct.
 */
function applyXbr(img) {
	const w = img.width;
	const h = img.height;
	const src = new Uint32Array(img.data.buffer);
	const scaled = xbr4x(src, w, h);
	const out = new ImageData(w * 4, h * 4);
	new Uint8Array(out.data.buffer).set(new Uint8Array(scaled.buffer));
	return out;
}

/**
* Render a single pattern matrix onto a canvas with true alpha transparency.
* Palette index 15 becomes fully transparent; the checkerboard is handled
* via a CSS background on the canvas element.
*/
export function renderPattern(canvas, matrix, palette, scale = 5, smooth = false) {
	const rows = matrix.length;
	const cols = matrix[0]?.length ?? 0;
	const img = buildImageData(matrix, palette);

	if (smooth) {
		// xBR produces a 4x image; then nearest-neighbor scale to final size
		const xbrImg = applyXbr(img);
		const xbrW = cols * 4;
		const xbrH = rows * 4;
		const finalScale = Math.max(1, Math.round(scale / 4));
		canvas.width = xbrW * finalScale;
		canvas.height = xbrH * finalScale;
		const ctx = canvas.getContext("2d");
		ctx.imageSmoothingEnabled = false;
		const tmp = new OffscreenCanvas(xbrW, xbrH);
		tmp.getContext("2d").putImageData(xbrImg, 0, 0);
		ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
	} else {
		canvas.width = cols * scale;
		canvas.height = rows * scale;
		const ctx = canvas.getContext("2d");
		ctx.imageSmoothingEnabled = false;
		const tmp = new OffscreenCanvas(cols, rows);
		tmp.getContext("2d").putImageData(img, 0, 0);
		ctx.drawImage(tmp, 0, 0, cols * scale, rows * scale);
	}
}

/**
* Render the composited 64×64 pro pattern grid onto a canvas.
*/
export function renderProComposite(canvas, patterns, designType, scale = 4, smooth = false) {
	const grid = buildProGrid(patterns, designType);
	renderPattern(canvas, grid, patterns[0].palette, scale, smooth);
}
