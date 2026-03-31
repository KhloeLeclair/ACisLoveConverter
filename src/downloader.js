/**
 * downloader.js — File download helpers.
 */

import JSZip from "jszip";

export function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @param {{ name: string, data: Uint8Array }[]} files
 * @param {string} zipName
 */
export async function downloadAllAsZip(files, zipName) {
	const zip = new JSZip();
	for (const f of files) {
		zip.file(f.name, f.data);
	}
	const blob = await zip.generateAsync({ type: "blob" });
	downloadBlob(blob, zipName);
}
