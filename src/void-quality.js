// Higher quality drawing defaults
(function () {
	function apply() {
		try {
			if (window.main_ctx) {
				main_ctx.imageSmoothingEnabled = true;
				if ("imageSmoothingQuality" in main_ctx) main_ctx.imageSmoothingQuality = "high";
			}
			document.querySelectorAll("canvas").forEach(function (c) {
				try {
					const ctx = c.getContext("2d");
					if (ctx) {
						ctx.imageSmoothingEnabled = true;
						if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
					}
				} catch (e) {}
			});
		} catch (e) {}
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(apply, 200); });
	else setTimeout(apply, 200);
	setTimeout(apply, 1500);
	console.info("[void-ui] high quality smoothing on");
})();
