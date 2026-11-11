/* XK Paint tabs + VFS browser UI */
(function () {
	"use strict";

	const tabs = [];
	let activeId = null;
	const memory = {};
	let booted = false;

	function el(tag, cls, html) {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (html != null) n.innerHTML = html;
		return n;
	}

	function appReady() {
		return !!(window.__xkpaint_app_ready && window.main_canvas && window.main_ctx && window.$canvas_area);
	}

	function canvasReady() {
		return !!(window.main_canvas && window.main_ctx);
	}

	function captureBlob() {
		return new Promise(function (resolve) {
			try {
				window.main_canvas.toBlob(function (b) { resolve(b); }, "image/png");
			} catch (e) {
				resolve(null);
			}
		});
	}

	async function applyBlob(blob) {
		if (!blob || !canvasReady()) return;
		try {
			const bmp = await createImageBitmap(blob);
			const w = bmp.width, h = bmp.height;
			try {
				if (typeof window.resize_canvas_without_saving_dimensions === "function") {
					window.resize_canvas_without_saving_dimensions(w, h);
				} else if (typeof window.resize_canvas_and_save_dimensions === "function") {
					window.resize_canvas_and_save_dimensions(w, h);
				} else {
					window.main_canvas.width = w;
					window.main_canvas.height = h;
				}
			} catch (_) {
				window.main_canvas.width = w;
				window.main_canvas.height = h;
			}
			window.main_ctx.imageSmoothingEnabled = true;
			window.main_ctx.drawImage(bmp, 0, 0);
			if (bmp.close) bmp.close();
			try {
				if (window.$canvas_area) window.$canvas_area.trigger("resize");
				if (window.$G) window.$G.triggerHandler("resize");
			} catch (_) {}
		} catch (err) {
			console.warn("[xkpaint] applyBlob failed", err);
		}
	}

	async function snapshotActive() {
		if (!activeId || !canvasReady()) return;
		const blob = await captureBlob();
		if (!blob) return;
		const t = tabs.find(function (x) { return x.id === activeId; });
		memory[activeId] = {
			blob: blob,
			name: t ? t.name : "untitled",
			width: window.main_canvas.width,
			height: window.main_canvas.height,
			dirty: t ? t.dirty : true,
		};
	}

	function renderTabs() {
		const bar = document.getElementById("xk-tab-bar");
		if (!bar) return;
		const list = bar.querySelector(".xk-tabs");
		if (!list) return;
		list.innerHTML = "";
		tabs.forEach(function (t) {
			const btn = el("button", "xk-tab" + (t.id === activeId ? " active" : ""));
			btn.type = "button";
			btn.title = t.name;
			const label = el("span", "xk-tab-label", (t.dirty ? "• " : "") + t.name);
			btn.appendChild(label);
			const close = el("span", "xk-tab-close", "×");
			close.title = "Close";
			close.addEventListener("click", function (e) {
				e.stopPropagation();
				closeTab(t.id);
			});
			btn.appendChild(close);
			btn.addEventListener("click", function () { switchTab(t.id); });
			list.appendChild(btn);
		});
	}

	async function switchTab(id) {
		if (id === activeId || !appReady()) return;
		await snapshotActive();
		activeId = id;
		const mem = memory[id];
		if (mem && mem.blob) await applyBlob(mem.blob);
		renderTabs();
	}

	function newTab(name, blob) {
		const id = "tab_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
		const t = { id: id, name: name || "Untitled", dirty: !blob, vfsId: null };
		tabs.push(t);
		if (blob) memory[id] = { blob: blob, name: t.name, dirty: false };
		return t;
	}

	async function closeTab(id) {
		if (tabs.length <= 1) return;
		const idx = tabs.findIndex(function (t) { return t.id === id; });
		if (idx < 0) return;
		if (id === activeId) await snapshotActive();
		tabs.splice(idx, 1);
		delete memory[id];
		if (id === activeId) {
			const next = tabs[Math.max(0, idx - 1)];
			activeId = next.id;
			if (memory[activeId] && memory[activeId].blob) await applyBlob(memory[activeId].blob);
		}
		renderTabs();
	}

	async function addBlankTab() {
		if (!appReady()) return;
		await snapshotActive();
		const t = newTab("Untitled");
		activeId = t.id;
		if (canvasReady()) {
			try {
				const w = window.main_canvas.width, h = window.main_canvas.height;
				window.main_ctx.fillStyle = "#ffffff";
				window.main_ctx.fillRect(0, 0, w, h);
			} catch (_) {}
		}
		renderTabs();
	}

	function markDirty() {
		const t = tabs.find(function (x) { return x.id === activeId; });
		if (t && !t.dirty) {
			t.dirty = true;
			renderTabs();
		}
	}

	async function saveActiveToVFS(name) {
		if (!window.XKPaintVFS || !canvasReady()) {
			alert("App not ready yet — try again in a moment.");
			return null;
		}
		await snapshotActive();
		const t = tabs.find(function (x) { return x.id === activeId; });
		let n = name || (t && t.name) || "drawing.png";
		if (!/\.png$/i.test(n)) n = n + ".png";
		const row = await window.XKPaintVFS.saveCanvas(window.main_canvas, {
			id: t && t.vfsId,
			name: n,
		});
		if (t) {
			t.name = row.name;
			t.vfsId = row.id;
			t.dirty = false;
		}
		renderTabs();
		return row;
	}

	async function openFromVFS(id) {
		if (!window.XKPaintVFS || !appReady()) return;
		const file = await window.XKPaintVFS.get(id);
		if (!file || !file.blob) return;
		await snapshotActive();
		const t = newTab(file.name, file.blob);
		t.vfsId = file.id;
		t.dirty = false;
		activeId = t.id;
		await applyBlob(file.blob);
		renderTabs();
	}

	function openVFSPanel() {
		let panel = document.getElementById("xk-vfs-panel");
		if (panel) {
			panel.classList.toggle("open");
			if (panel.classList.contains("open")) refreshVFSList();
			return;
		}
		panel = el("div", "xk-vfs-panel open");
		panel.id = "xk-vfs-panel";
		panel.innerHTML =
			'<div class="xk-vfs-head">' +
			'<strong>Virtual Filesystem</strong>' +
			'<button type="button" class="xk-vfs-close" title="Close">×</button>' +
			"</div>" +
			'<div class="xk-vfs-actions">' +
			'<button type="button" id="xk-vfs-save">Save current</button>' +
			'<button type="button" id="xk-vfs-refresh">Refresh</button>' +
			"</div>" +
			'<div class="xk-vfs-usage" id="xk-vfs-usage"></div>' +
			'<div class="xk-vfs-list" id="xk-vfs-list"></div>';
		document.body.appendChild(panel);
		panel.querySelector(".xk-vfs-close").onclick = function () { panel.classList.remove("open"); };
		panel.querySelector("#xk-vfs-save").onclick = async function () {
			const name = prompt("File name", (tabs.find(function (t) { return t.id === activeId; }) || {}).name || "drawing.png");
			if (!name) return;
			await saveActiveToVFS(name);
			refreshVFSList();
		};
		panel.querySelector("#xk-vfs-refresh").onclick = refreshVFSList;
		refreshVFSList();
	}

	async function refreshVFSList() {
		const list = document.getElementById("xk-vfs-list");
		const usageEl = document.getElementById("xk-vfs-usage");
		if (!list) return;
		if (!window.XKPaintVFS) {
			list.innerHTML = "<div class='xk-vfs-empty'>VFS not loaded.</div>";
			return;
		}
		list.innerHTML = "<div class='xk-vfs-empty'>Loading…</div>";
		try {
			const files = await window.XKPaintVFS.listAll();
			const usage = await window.XKPaintVFS.usage();
			if (usageEl) {
				const mb = (usage.bytes / (1024 * 1024)).toFixed(2);
				usageEl.textContent = files.length + " files · " + mb + " MB" +
					(usage.quota && usage.quota.quota ? " / " + (usage.quota.quota / (1024 * 1024)).toFixed(0) + " MB quota" : "");
			}
			if (!files.length) {
				list.innerHTML = "<div class='xk-vfs-empty'>No saved drawings yet. Click Save current.</div>";
				return;
			}
			list.innerHTML = "";
			files.forEach(function (f) {
				const row = el("div", "xk-vfs-row");
				const thumb = el("div", "xk-vfs-thumb");
				if (f.thumb) {
					const img = document.createElement("img");
					img.src = URL.createObjectURL(f.thumb);
					img.onload = function () { try { URL.revokeObjectURL(img.src); } catch (_) {} };
					thumb.appendChild(img);
				}
				const meta = el("div", "xk-vfs-meta");
				meta.innerHTML = "<div class='xk-vfs-name'></div><div class='xk-vfs-sub'></div>";
				meta.querySelector(".xk-vfs-name").textContent = f.name;
				meta.querySelector(".xk-vfs-sub").textContent =
					(f.width || "?") + "×" + (f.height || "?") + " · " +
					new Date(f.updated || 0).toLocaleString();
				const actions = el("div", "xk-vfs-row-actions");
				const openBtn = el("button", "", "Open");
				openBtn.type = "button";
				openBtn.onclick = function () { openFromVFS(f.id); };
				const delBtn = el("button", "danger", "Del");
				delBtn.type = "button";
				delBtn.onclick = async function () {
					if (!confirm("Delete " + f.name + "?")) return;
					await window.XKPaintVFS.remove(f.id);
					refreshVFSList();
				};
				actions.appendChild(openBtn);
				actions.appendChild(delBtn);
				row.appendChild(thumb);
				row.appendChild(meta);
				row.appendChild(actions);
				list.appendChild(row);
			});
		} catch (e) {
			list.innerHTML = "<div class='xk-vfs-empty'>VFS error: " + (e && e.message) + "</div>";
		}
	}

	function buildChrome() {
		if (document.getElementById("xk-tab-bar")) return;
		const bar = el("div", "xk-tab-bar");
		bar.id = "xk-tab-bar";
		bar.innerHTML =
			'<div class="xk-tabs"></div>' +
			'<div class="xk-tab-tools">' +
			'<button type="button" id="xk-tab-new" title="New tab">+</button>' +
			'<button type="button" id="xk-vfs-toggle" title="Virtual Filesystem">Files</button>' +
			'<span id="xk-offline-badge" class="xk-offline-badge" title="Offline status">…</span>' +
			"</div>";
		const menus = document.querySelector(".menus");
		const app = document.querySelector(".jspaint") || document.body;
		if (menus && menus.parentNode) {
			menus.parentNode.insertBefore(bar, menus.nextSibling);
		} else if (app.firstChild) {
			app.insertBefore(bar, app.firstChild);
		} else {
			document.body.prepend(bar);
		}
		bar.querySelector("#xk-tab-new").onclick = function () { addBlankTab(); };
		bar.querySelector("#xk-vfs-toggle").onclick = openVFSPanel;
		updateOfflineBadge();
	}

	function updateOfflineBadge() {
		const b = document.getElementById("xk-offline-badge");
		if (!b) return;
		const on = navigator.onLine;
		b.textContent = on ? "Online" : "Offline";
		b.classList.toggle("offline", !on);
	}

	function boot() {
		if (booted) return;
		if (!appReady()) return;
		booted = true;
		buildChrome();
		if (!tabs.length) {
			const t = newTab("Untitled");
			activeId = t.id;
		}
		renderTabs();

		document.addEventListener("pointerup", function (e) {
			if (e.target && e.target.closest && e.target.closest(".canvas-area, canvas")) markDirty();
		}, true);

		window.addEventListener("online", updateOfflineBadge);
		window.addEventListener("offline", updateOfflineBadge);

		window.addEventListener("keydown", function (e) {
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
				e.preventDefault();
				const name = prompt("Save to Virtual Filesystem as", (tabs.find(function (t) { return t.id === activeId; }) || {}).name || "drawing.png");
				if (name) saveActiveToVFS(name);
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") {
				e.preventDefault();
				addBlankTab();
			}
		});

		console.info("[xkpaint] tabs + VFS UI ready — official https://xkpaint.pages.dev");
	}

	function waitBoot() {
		if (appReady()) {
			boot();
			return;
		}
		// Fallback: if app set $canvas_area but not the ready flag yet
		if (window.$canvas_area && window.main_canvas && window.main_ctx) {
			window.__xkpaint_app_ready = true;
			boot();
			return;
		}
		setTimeout(waitBoot, 150);
	}

	window.addEventListener("xkpaint-ready", function () { boot(); });
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () { setTimeout(waitBoot, 200); });
	} else {
		setTimeout(waitBoot, 200);
	}

	if ("serviceWorker" in navigator) {
		window.addEventListener("load", function () {
			navigator.serviceWorker.register("./sw.js").then(function (reg) {
				console.info("[xkpaint] SW registered", reg.scope);
			}).catch(function (err) {
				console.warn("[xkpaint] SW failed", err);
			});
		});
	}

	window.XKPaintTabs = {
		newTab: addBlankTab,
		saveToVFS: saveActiveToVFS,
		openVFS: openVFSPanel,
		switchTab: switchTab,
	};
})();
