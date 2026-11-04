// Interaction fix v3 — activate on pointerdown (ChromeOS often never synthesizes click)
(function () {
	"use strict";

	const style = document.createElement("style");
	style.textContent = `
		body.void-neon::before, body.void-neon::after,
		body::before, body::after {
			pointer-events: none !important;
			touch-action: none !important;
		}
		.menu-popup, .menu-item, .menu-button, button, [role="button"] {
			touch-action: manipulation !important;
			cursor: pointer !important;
		}
		.menu-popup { pointer-events: auto !important; z-index: 100000 !important; }
		.menu-item { pointer-events: auto !important; position: relative; z-index: 1; }
	`;
	document.head.appendChild(style);

	let openedFromTopMenuButton = false;
	let lastActivate = 0;

	document.addEventListener("pointerdown", function (e) {
		const t = e.target;
		if (!t || !t.closest) return;
		openedFromTopMenuButton = !!(t.closest(".menus .menu-button"));
	}, true);

	window.addEventListener("pointerup", function (e) {
		if (!openedFromTopMenuButton) return;
		openedFromTopMenuButton = false;
		if (document.querySelector('.menu-button[aria-expanded="true"], .menu-button.active')) {
			e.stopImmediatePropagation();
		}
	}, true);

	function isDisabled(el) {
		return !el || el.classList.contains("disabled") || el.getAttribute("aria-disabled") === "true" || el.disabled;
	}

	function forceClick(el) {
		if (!el || !el.isConnected) return;
		const now = performance.now();
		if (now - lastActivate < 100) return;
		lastActivate = now;
		try {
			el.dispatchEvent(new PointerEvent("click", { bubbles: true, cancelable: true, view: window, button: 0, pointerType: "mouse" }));
		} catch (_) {}
		try {
			el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
		} catch (_) {}
		try { el.click(); } catch (_) {}
	}

	// MENU ITEMS: activate on pointerdown (capture)
	document.addEventListener("pointerdown", function (e) {
		if (e.button != null && e.button !== 0) return;
		const item = e.target && e.target.closest && e.target.closest(".menu-popup .menu-item");
		if (!item || isDisabled(item)) return;
		if (item.getAttribute("aria-haspopup") === "true") return;
		setTimeout(function () { forceClick(item); }, 0);
	}, true);

	document.addEventListener("pointerup", function (e) {
		if (e.button != null && e.button !== 0) return;
		const item = e.target && e.target.closest && e.target.closest(".menu-popup .menu-item");
		if (!item || isDisabled(item)) return;
		if (item.getAttribute("aria-haspopup") === "true") return;
		forceClick(item);
	}, true);

	// GENERIC BUTTONS
	document.addEventListener("pointerdown", function (e) {
		if (e.button != null && e.button !== 0) return;
		const t = e.target;
		if (!t || !t.closest) return;
		if (t.closest(".menu-popup, .menus, .tool, .color-button, canvas, .canvas-area")) return;
		const btn = t.closest("button, [role='button'], input[type='button'], input[type='submit']");
		if (!btn || isDisabled(btn)) return;
		if (btn.tagName === "INPUT" && btn.type === "range") return;
		setTimeout(function () { forceClick(btn); }, 0);
	}, true);

	console.info("[void-ui] interaction-fix v3");
})();
