// Void extras: alpha control, large palette loader, history boost
(function () {
	function whenReady(fn) {
		if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(fn, 50));
		else setTimeout(fn, 50);
	}
	function parseColor(str) {
		if (!str) return { r: 0, g: 0, b: 0, a: 1 };
		str = String(str).trim();
		if (str[0] === "#") {
			let h = str.slice(1);
			if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
			if (h.length === 8) return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16), a: parseInt(h.slice(6,8),16)/255 };
			return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16), a: 1 };
		}
		const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
		if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
		return { r: 0, g: 0, b: 0, a: 1 };
	}
	function toCSS(c) {
		if (c.a >= 0.999) {
			const h = (n) => Math.max(0, Math.min(255, n|0)).toString(16).padStart(2, "0");
			return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
		}
		return `rgba(${c.r|0},${c.g|0},${c.b|0},${Math.round(c.a*1000)/1000})`;
	}
	function getSelectedColors() {
		try { if (typeof window.selected_colors !== "undefined") return window.selected_colors; } catch (_) {}
		return null;
	}
	function applyAlpha(a) {
		const colors = getSelectedColors();
		if (!colors) return;
		["foreground", "background", "ternary"].forEach((key) => {
			if (!colors[key]) return;
			const c = parseColor(colors[key]);
			c.a = a;
			colors[key] = toCSS(c);
		});
		try { if (window.$G) window.$G.triggerHandler("option-changed"); } catch (_) {}
		const swatch = document.getElementById("void-alpha-swatch");
		if (swatch && colors.foreground) swatch.style.background = colors.foreground;
	}
	function mountExtras() {
		if (document.getElementById("void-color-extras")) return;
		const host = document.querySelector(".colors-component") || document.querySelector(".component.colors-component") || document.body;
		const box = document.createElement("div");
		box.id = "void-color-extras";
		box.className = "lg";
		box.innerHTML = `<label>Opacity (A) <span id="void-alpha-val">100%</span></label>
			<input id="void-alpha" type="range" min="0" max="100" value="100" />
			<div id="void-alpha-swatch" style="height:28px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:#000;"></div>
			<button type="button" id="void-palette-load">Load large palette…</button>
			<button type="button" id="void-history-open">History tree (Ctrl+Shift+Y)</button>
			<p style="font-size:11px;opacity:0.75;margin:0;line-height:1.35;">MoPaint-style nonlinear history is built in: undo, draw something else, then open History to jump any branch.</p>`;
		host.appendChild(box);
		const range = box.querySelector("#void-alpha");
		const val = box.querySelector("#void-alpha-val");
		range.addEventListener("input", () => { val.textContent = range.value + "%"; applyAlpha(+range.value / 100); });
		box.querySelector("#void-palette-load").addEventListener("click", openPalettePicker);
		box.querySelector("#void-history-open").addEventListener("click", () => {
			try {
				if (typeof window.show_document_history === "function") window.show_document_history();
				else alert("Open Edit → History (Ctrl+Shift+Y)");
			} catch (err) { alert("Open Edit → History (Ctrl+Shift+Y)"); }
		});
	}
	function openPalettePicker() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".pal,.gpl,.aco,.act,.ase,.txt,.hex,.png,.gif,.bmp";
		input.addEventListener("change", async () => {
			const file = input.files && input.files[0];
			if (!file) return;
			try {
				if (window.AnyPalette && AnyPalette.loadPalette) {
					AnyPalette.loadPalette(file, (err, palette) => {
						if (err) { applyBuiltInLargePalette(); return; }
						applyPaletteColors(palette);
					});
				} else applyBuiltInLargePalette();
			} catch (e) { applyBuiltInLargePalette(); }
		});
		input.click();
	}
	function applyPaletteColors(palette) {
		const colors = [];
		const list = palette.colors || palette;
		for (let i = 0; i < list.length; i++) {
			const c = list[i];
			if (!c) continue;
			if (typeof c === "string") colors.push(c);
			else if (c.hex) colors.push(c.hex);
			else if (c.r != null) colors.push(`rgb(${c.r|0},${c.g|0},${c.b|0})`);
		}
		if (colors.length) injectLargeSwatches(colors);
	}
	function applyBuiltInLargePalette() {
		const colors = [];
		for (let i = 0; i < 24; i++) colors.push(`hsl(${(i/24)*360}, 85%, 55%)`);
		for (let i = 0; i < 8; i++) { const v = Math.round((i/7)*255); colors.push(`rgb(${v},${v},${v})`); }
		for (let i = 0; i < 8; i++) colors.push(`rgb(${Math.round(40+i*28)},10,${Math.round(20+i*10)})`);
		for (let i = 0; i < 8; i++) colors.push(`rgb(10,${Math.round(20+i*12)},${Math.round(80+i*22)})`);
		injectLargeSwatches(colors);
	}
	function injectLargeSwatches(colors) {
		let row = document.getElementById("void-large-palette");
		if (!row) {
			row = document.createElement("div");
			row.id = "void-large-palette";
			row.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;padding:8px;margin:6px;max-width:420px;";
			(document.getElementById("void-color-extras") || document.body).appendChild(row);
		}
		row.innerHTML = "";
		colors.slice(0, 96).forEach((col) => {
			const b = document.createElement("button");
			b.type = "button";
			b.style.cssText = `width:26px;height:26px;background:${col};border:none;cursor:pointer;border-radius:8px;`;
			b.title = col;
			b.addEventListener("pointerdown", (e) => {
				e.preventDefault(); e.stopPropagation();
				const colorsObj = getSelectedColors();
				const a = (+(document.getElementById("void-alpha") || {}).value || 100) / 100;
				const parsed = parseColor(col); parsed.a = a;
				const css = toCSS(parsed);
				if (colorsObj) {
					if (e.button === 2) colorsObj.background = css; else colorsObj.foreground = css;
					try { window.$G && window.$G.triggerHandler("option-changed"); } catch (_) {}
				}
				const sw = document.getElementById("void-alpha-swatch");
				if (sw) sw.style.background = css;
			});
			b.addEventListener("contextmenu", (e) => e.preventDefault());
			row.appendChild(b);
		});
	}
	whenReady(() => { mountExtras(); setTimeout(mountExtras, 800); setTimeout(mountExtras, 2000); });
	console.info("[void-ui] extras: alpha + palette + history");
})();
