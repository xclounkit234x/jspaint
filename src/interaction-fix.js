// Interaction fix — ChromeOS / touch: menus open but items never activate
(function () {
	let openedFromTopMenuButton = false;
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
	function activateMenuItem(item) {
		if (!item || !item.isConnected) return;
		if (item.classList.contains("disabled") || item.getAttribute("aria-disabled") === "true") return;
		if (item.getAttribute("aria-haspopup") === "true") return;
		try {
			item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
		} catch (_) {
			try { item.click(); } catch (__) {}
		}
	}
	document.addEventListener("pointerup", function (e) {
		if (e.button != null && e.button !== 0) return;
		const item = e.target && e.target.closest && e.target.closest(".menu-popup .menu-item");
		if (!item) return;
		activateMenuItem(item);
	}, false);
	document.addEventListener("keydown", function (e) {
		if (e.key !== "Enter" && e.key !== " ") return;
		const item = document.querySelector(".menu-popup .menu-item.highlight, .menu-popup .menu-item[aria-selected='true']");
		if (item) { e.preventDefault(); activateMenuItem(item); }
	}, true);
	console.info("[void-ui] interaction-fix v2 (touch menu items)");
})();
