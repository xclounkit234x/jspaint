// MoPaint-style smooth canvas (anti-aliased, not pixel-crisp)
(function () {
	"use strict";
	function forceSmoothCtx(ctx) {
		if (!ctx) return;
		try {
			ctx.imageSmoothingEnabled = true;
			if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
			ctx.disable_image_smoothing = function () {
				this.imageSmoothingEnabled = true;
				if ("imageSmoothingQuality" in this) this.imageSmoothingQuality = "high";
			};
			ctx.enable_image_smoothing = function () {
				this.imageSmoothingEnabled = true;
				if ("imageSmoothingQuality" in this) this.imageSmoothingQuality = "high";
			};
		} catch (e) {}
	}
	function applyAll() {
		try {
			if (window.main_ctx) forceSmoothCtx(window.main_ctx);
			document.querySelectorAll("canvas").forEach(function (c) {
				try {
					forceSmoothCtx(c.getContext("2d"));
					c.style.imageRendering = "auto";
				} catch (e) {}
			});
			document.querySelectorAll(".disable-aa-for-things-at-main-canvas-scale").forEach(function (el) {
				el.classList.remove("disable-aa-for-things-at-main-canvas-scale");
			});
		} catch (e) {}
	}
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () {
			setTimeout(applyAll, 100);
			setTimeout(applyAll, 500);
			setTimeout(applyAll, 2000);
		});
	} else {
		setTimeout(applyAll, 100);
		setTimeout(applyAll, 500);
		setTimeout(applyAll, 2000);
	}
	setInterval(applyAll, 4000);
	console.info("[void-ui] MoPaint-style smooth canvas mode");
})();
