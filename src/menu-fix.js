// ChromeOS menu click fix — loaded after MenuBar.js
// Problem: MenuBar closes menus on window pointerup. After pointerdown opens a menu,
// the matching pointerup was treated as outside and closed it immediately (hold/drag only worked).
(function () {
	function patchMenus() {
		let openedFromMenuButton = false;

		document.addEventListener(
			"pointerdown",
			(e) => {
				openedFromMenuButton = !!(e.target && e.target.closest && e.target.closest(".menus .menu-button"));
			},
			true
		);

		// Capture phase runs before MenuBar's bubble-phase window pointerup closer
		window.addEventListener(
			"pointerup",
			(e) => {
				if (!openedFromMenuButton) return;
				openedFromMenuButton = false;
				const open = document.querySelector('.menu-button[aria-expanded="true"], .menu-button.active');
				if (open) {
					e.stopImmediatePropagation();
				}
			},
			true
		);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", patchMenus);
	} else {
		patchMenus();
	}
})();
