// Void extras: alpha, large palette (always visible), history, tool-options layout
(function () {
	"use strict";
	function whenReady(fn) {
		if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(fn, 50); });
		else setTimeout(fn, 50);
	}
	function parseColor(str) {
		if (!str) return { r: 0, g: 0, b: 0, a: 1 };
		str = String(str).trim();
		if (str[0] === "#") {
			var h = str.slice(1);
			if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
			if (h.length === 8) return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16), a: parseInt(h.slice(6,8),16)/255 };
			return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16), a: 1 };
		}
		var m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
		if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
		return { r: 0, g: 0, b: 0, a: 1 };
	}
	function toCSS(c) {
		if (c.a >= 0.999) {
			var h = function (n) { return Math.max(0, Math.min(255, n|0)).toString(16).padStart(2, "0"); };
			return "#" + h(c.r) + h(c.g) + h(c.b);
		}
		return "rgba(" + (c.r|0) + "," + (c.g|0) + "," + (c.b|0) + "," + (Math.round(c.a*1000)/1000) + ")";
	}
	function getSelectedColors() {
		try { if (typeof window.selected_colors !== "undefined") return window.selected_colors; } catch (e) {}
		return null;
	}
	function applyAlpha(a) {
		var colors = getSelectedColors();
		if (!colors) return;
		["foreground", "background", "ternary"].forEach(function (key) {
			if (!colors[key]) return;
			var c = parseColor(colors[key]);
			c.a = a;
			colors[key] = toCSS(c);
		});
		try { if (window.$G) window.$G.triggerHandler("option-changed"); } catch (e) {}
		var swatch = document.getElementById("void-alpha-swatch");
		if (swatch && colors.foreground) swatch.style.background = colors.foreground;
	}
	function setColorFromEvent(col, e) {
		var colorsObj = getSelectedColors();
		var a = (+(document.getElementById("void-alpha") || {}).value || 100) / 100;
		var parsed = parseColor(col); parsed.a = a;
		var css = toCSS(parsed);
		if (colorsObj) {
			if (e && e.button === 2) colorsObj.background = css; else colorsObj.foreground = css;
			try { window.$G && window.$G.triggerHandler("option-changed"); } catch (err) {}
		}
		var sw = document.getElementById("void-alpha-swatch");
		if (sw) sw.style.background = css;
	}
	function injectLargeSwatches(colors) {
		var row = document.getElementById("void-large-palette");
		if (!row) {
			row = document.createElement("div");
			row.id = "void-large-palette";
			row.style.cssText = "display:flex;flex-wrap:wrap;gap:5px;padding:10px;margin:6px;max-width:480px;";
			(document.getElementById("void-color-extras") || document.body).appendChild(row);
		}
		row.innerHTML = "";
		colors.slice(0, 128).forEach(function (col) {
			var b = document.createElement("button");
			b.type = "button";
			b.style.cssText = "width:28px;height:28px;background:" + col + ";border:none;cursor:pointer;border-radius:10px;box-shadow:0 0 8px rgba(77,140,255,0.25);";
			b.title = col;
			function pick(e) { e.preventDefault(); e.stopPropagation(); setColorFromEvent(col, e); }
			b.addEventListener("pointerdown", pick);
			b.addEventListener("click", pick);
			b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
			row.appendChild(b);
		});
	}
	function applyBuiltInLargePalette() {
		var colors = [], i, v;
		for (i = 0; i < 24; i++) colors.push("hsl(" + ((i / 24) * 360) + ", 85%, 55%)");
		for (i = 0; i < 10; i++) { v = Math.round((i / 9) * 255); colors.push("rgb(" + v + "," + v + "," + v + ")"); }
		for (i = 0; i < 10; i++) colors.push("rgb(" + Math.round(40 + i * 22) + ",8," + Math.round(18 + i * 8) + ")");
		for (i = 0; i < 10; i++) colors.push("rgb(8," + Math.round(18 + i * 10) + "," + Math.round(70 + i * 18) + ")");
		for (i = 0; i < 8; i++) colors.push("rgb(" + Math.round(20 + i * 30) + "," + Math.round(80 + i * 15) + ",40)");
		injectLargeSwatches(colors);
	}
	function openPalettePicker() {
		applyBuiltInLargePalette();
		var input = document.createElement("input");
		input.type = "file";
		input.accept = ".pal,.gpl,.aco,.act,.ase,.txt,.hex,.png,.gif,.bmp";
		input.addEventListener("change", function () {
			var file = input.files && input.files[0];
			if (!file) return;
			try {
				if (window.AnyPalette && AnyPalette.loadPalette) {
					AnyPalette.loadPalette(file, function (err, palette) {
						if (err || !palette) { applyBuiltInLargePalette(); return; }
						var colors = [], list = palette.colors || palette;
						for (var i = 0; i < list.length; i++) {
							var c = list[i];
							if (!c) continue;
							if (typeof c === "string") colors.push(c);
							else if (c.hex) colors.push(c.hex);
							else if (c.r != null) colors.push("rgb(" + (c.r|0) + "," + (c.g|0) + "," + (c.b|0) + ")");
						}
						if (colors.length) injectLargeSwatches(colors); else applyBuiltInLargePalette();
					});
				}
			} catch (e) { applyBuiltInLargePalette(); }
		});
		input.click();
	}
	function openHistory() {
		try { if (typeof window.show_document_history === "function") { window.show_document_history(); return; } } catch (e) {}
		alert("Use Edit → History or Ctrl+Shift+Y for the nonlinear history tree.");
	}
	function bindPress(el, fn) {
		if (!el) return;
		el.addEventListener("pointerdown", function (e) {
			if (e.button != null && e.button !== 0) return;
			e.preventDefault(); e.stopPropagation(); fn(e);
		});
		el.addEventListener("click", function (e) { e.preventDefault(); fn(e); });
	}
	function mountExtras() {
		if (document.getElementById("void-color-extras")) return;
		var host = document.querySelector(".colors-component") || document.querySelector(".component.colors-component") || document.body;
		var box = document.createElement("div");
		box.id = "void-color-extras";
		box.innerHTML = '<label>Opacity (A) <span id="void-alpha-val">100%</span></label><input id="void-alpha" type="range" min="0" max="100" value="100" /><div id="void-alpha-swatch" style="height:28px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:#000;box-shadow:0 0 16px rgba(77,140,255,0.35);"></div><button type="button" id="void-palette-load">Load large palette…</button><button type="button" id="void-history-open">History tree (Ctrl+Shift+Y)</button><p style="font-size:11px;opacity:0.8;margin:0;line-height:1.35;">Nonlinear history: undo, draw again, then jump any branch in History.</p>';
		host.appendChild(box);
		var range = box.querySelector("#void-alpha");
		var val = box.querySelector("#void-alpha-val");
		range.addEventListener("input", function () { val.textContent = range.value + "%"; applyAlpha(+range.value / 100); });
		bindPress(box.querySelector("#void-palette-load"), openPalettePicker);
		bindPress(box.querySelector("#void-history-open"), openHistory);
		applyBuiltInLargePalette();
	}
	function fixToolOptionsLayout() {
		if (document.getElementById("void-tool-options-layout")) return;
		var css = document.createElement("style");
		css.id = "void-tool-options-layout";
		css.textContent = ".tools-component,.component.tools-component{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:flex-start!important;height:auto!important;min-height:280px;width:auto!important;overflow:visible!important}.tools-component .tools,.tools{display:flex!important;flex-flow:column wrap!important;max-height:320px;width:52px!important}.tools-component .tool-options,.tool-options{display:flex!important;flex-direction:column!important;margin-top:0!important;margin-left:10px!important;width:72px!important;min-width:72px!important;height:auto!important;min-height:72px;padding:8px!important;position:relative!important;z-index:5!important;background:linear-gradient(160deg,rgba(255,255,255,0.12),rgba(20,30,60,0.4))!important;backdrop-filter:blur(20px) saturate(160%)!important;border:1px solid rgba(77,140,255,0.35)!important;border-radius:16px!important;box-shadow:0 0 24px rgba(77,140,255,0.25),0 8px 28px rgba(0,0,0,0.45)!important}";
		document.head.appendChild(css);
	}
	whenReady(function () {
		fixToolOptionsLayout(); mountExtras();
		setTimeout(mountExtras, 600); setTimeout(mountExtras, 1800); setTimeout(fixToolOptionsLayout, 600);
	});
	console.info("[void-ui] extras v2");
})();
