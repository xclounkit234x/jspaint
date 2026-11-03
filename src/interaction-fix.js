// Interaction fix — ChromeOS / broken click synthesis
(function () {
	let openedFromTopMenuButton = false;
	let lastBtnActivate = 0;

	document.addEventListener("pointerdown", function (e) {
		const t = e.target;
		if (!t || !t.closest) return;
		openedFromTopMenuButton = !!(t.closest(".menus > .menu-button, .menus .menu-button"));
	}, true);

	// Prevent MenuBar from closing the menu on the pointerup that followed open
	window.addEventListener("pointerup", function (e) {
		if (!openedFromTopMenuButton) return;
		openedFromTopMenuButton = false;
		if (document.querySelector('.menu-button[aria-expanded="true"], .menu-button.active')) {
			e.stopImmediatePropagation();
		}
	}, true);

	// Menu items: activate on pointerup (safety net when click is not synthesized)
	document.addEventListener("pointerup", function (e) {
		if (e.button != null && e.button !== 0) return;
		const item = e.target && e.target.closest && e.target.closest(".menu-popup .menu-item");
		if (!item) return;
		if (item.classList.contains("disabled") || item.getAttribute("aria-disabled") === "true") return;
		if (item.querySelector(".menu-item-submenu-area") && item.getAttribute("aria-haspopup") === "true") {
			return;
		}
		const now = performance.now();
		if (now - lastBtnActivate < 120) return;
		lastBtnActivate = now;
		requestAnimationFrame(function () {
			try { item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); } catch (_) {}
		});
	}, false);

	console.info("[void-ui] interaction-fix ready");
})();
