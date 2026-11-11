/* XK Paint Virtual Filesystem — IndexedDB drawings library */
(function (global) {
	"use strict";
	const DB_NAME = "xkpaint-vfs";
	const DB_VER = 1;
	const STORE = "files";

	function openDB() {
		return new Promise(function (resolve, reject) {
			const req = indexedDB.open(DB_NAME, DB_VER);
			req.onupgradeneeded = function () {
				const db = req.result;
				if (!db.objectStoreNames.contains(STORE)) {
					const s = db.createObjectStore(STORE, { keyPath: "id" });
					s.createIndex("path", "path", { unique: false });
					s.createIndex("updated", "updated", { unique: false });
				}
			};
			req.onsuccess = function () { resolve(req.result); };
			req.onerror = function () { reject(req.error); };
		});
	}

	function txStore(mode) {
		return openDB().then(function (db) {
			const tx = db.transaction(STORE, mode);
			return { db: db, tx: tx, store: tx.objectStore(STORE) };
		});
	}

	function idbReq(req) {
		return new Promise(function (resolve, reject) {
			req.onsuccess = function () { resolve(req.result); };
			req.onerror = function () { reject(req.error); };
		});
	}

	function uid() {
		return "f_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
	}

	async function list(folder) {
		folder = folder || "/";
		const { store } = await txStore("readonly");
		const all = await idbReq(store.getAll());
		return (all || [])
			.filter(function (f) {
				const p = f.path || "/";
				if (folder === "/") return !p.includes("/") || p === "/" || p.split("/").filter(Boolean).length <= 1;
				return p === folder || p.startsWith(folder.replace(/\/$/, "") + "/");
			})
			.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
	}

	async function listAll() {
		const { store } = await txStore("readonly");
		const all = await idbReq(store.getAll());
		return (all || []).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
	}

	async function get(id) {
		const { store } = await txStore("readonly");
		return idbReq(store.get(id));
	}

	async function save(entry) {
		const row = {
			id: entry.id || uid(),
			name: entry.name || "untitled.png",
			path: entry.path || "/",
			type: entry.type || "image/png",
			blob: entry.blob,
			thumb: entry.thumb || null,
			width: entry.width || 0,
			height: entry.height || 0,
			size: entry.blob ? entry.blob.size : 0,
			updated: Date.now(),
			created: entry.created || Date.now(),
		};
		const { store, tx } = await txStore("readwrite");
		store.put(row);
		await new Promise(function (resolve, reject) {
			tx.oncomplete = resolve;
			tx.onerror = function () { reject(tx.error); };
		});
		return row;
	}

	async function remove(id) {
		const { store, tx } = await txStore("readwrite");
		store.delete(id);
		await new Promise(function (resolve, reject) {
			tx.oncomplete = resolve;
			tx.onerror = function () { reject(tx.error); };
		});
	}

	async function rename(id, name) {
		const file = await get(id);
		if (!file) throw new Error("Not found");
		file.name = name;
		file.updated = Date.now();
		return save(file);
	}

	async function makeThumb(blob, max) {
		max = max || 96;
		try {
			const bmp = await createImageBitmap(blob);
			const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
			const w = Math.max(1, Math.round(bmp.width * scale));
			const h = Math.max(1, Math.round(bmp.height * scale));
			const c = document.createElement("canvas");
			c.width = w; c.height = h;
			const ctx = c.getContext("2d");
			ctx.drawImage(bmp, 0, 0, w, h);
			bmp.close && bmp.close();
			return await new Promise(function (resolve) { c.toBlob(resolve, "image/png"); });
		} catch (_) {
			return null;
		}
	}

	async function saveCanvas(canvas, meta) {
		meta = meta || {};
		const blob = await new Promise(function (resolve) {
			canvas.toBlob(resolve, "image/png");
		});
		const thumb = await makeThumb(blob);
		return save({
			id: meta.id,
			name: meta.name || "drawing.png",
			path: meta.path || "/",
			blob: blob,
			thumb: thumb,
			width: canvas.width,
			height: canvas.height,
			created: meta.created,
		});
	}

	async function usage() {
		const all = await listAll();
		const bytes = all.reduce(function (s, f) { return s + (f.size || 0); }, 0);
		let quota = null;
		try {
			if (navigator.storage && navigator.storage.estimate) {
				quota = await navigator.storage.estimate();
			}
		} catch (_) {}
		return { files: all.length, bytes: bytes, quota: quota };
	}

	try {
		if (navigator.storage && navigator.storage.persist) {
			navigator.storage.persist().catch(function () {});
		}
	} catch (_) {}

	global.XKPaintVFS = {
		list: list,
		listAll: listAll,
		get: get,
		save: save,
		remove: remove,
		rename: rename,
		saveCanvas: saveCanvas,
		makeThumb: makeThumb,
		usage: usage,
		uid: uid,
	};
	console.info("[xkpaint] VFS ready");
})(window);
