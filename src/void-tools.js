// @ts-nocheck
/* global stroke_color, pointer, pointer_start */
function parseRGB(color) {
	try {
		const c = document.createElement("canvas");
		const ctx = c.getContext("2d");
		ctx.fillStyle = color || "#000";
		ctx.fillRect(0, 0, 1, 1);
		const d = ctx.getImageData(0, 0, 1, 1).data;
		return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
	} catch (_) { return { r: 0, g: 0, b: 0, a: 1 }; }
}
function snapUndo(name) {
	try { if (typeof window.__void_undoable === "function") window.__void_undoable({ name: name }, function () {}); } catch (_) {}
}
function strokeSegment(ctx, pts) {
	const n = pts.length;
	if (n < 2) return;
	if (n === 2) {
		ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
		return;
	}
	const p0 = pts[n - 3], p1 = pts[n - 2], p2 = pts[n - 1];
	const m1x = (p0.x + p1.x) / 2, m1y = (p0.y + p1.y) / 2;
	const m2x = (p1.x + p2.x) / 2, m2y = (p1.y + p2.y) / 2;
	ctx.beginPath(); ctx.moveTo(m1x, m1y); ctx.quadraticCurveTo(p1.x, p1.y, m2x, m2y); ctx.stroke();
}
function pushPoint(tool, x, y, minDist) {
	minDist = minDist || 1.5;
	if (!tool._pts) tool._pts = [];
	const pts = tool._pts;
	if (pts.length) {
		const last = pts[pts.length - 1];
		if (Math.hypot(x - last.x, y - last.y) < minDist) return false;
	}
	pts.push({ x: x, y: y });
	return true;
}
function makeSlider(host, label, min, max, value, onChange) {
	const wrap = document.createElement("div");
	wrap.style.cssText = "display:flex;flex-direction:column;gap:2px;font-size:10px;width:100%;color:#cfe0ff;";
	const lab = document.createElement("label"); lab.textContent = label;
	const input = document.createElement("input");
	input.type = "range"; input.min = String(min); input.max = String(max); input.value = String(value);
	input.style.width = "100%";
	input.addEventListener("input", function () { onChange(+input.value); });
	wrap.appendChild(lab); wrap.appendChild(input); host.append(wrap);
}
function makeOptions(builders) {
	const host = document.createElement("div");
	host.className = "void-tool-options";
	host.style.cssText = "display:flex;flex-direction:column;gap:6px;padding:2px;min-width:40px;";
	builders(host);
	if (typeof window.$ === "function") return window.$(host);
	return Object.assign([host], { appendTo: function () { return this; }, trigger: function () { return this; }, length: 1 });
}

export const void_tools = [
	{
		id: "TOOL_VOID_SOFT_BRUSH", name: "Soft Brush",
		description: "Smooth anti-aliased soft brush (MoPaint-style).",
		cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 16, void_opacity: 45, void_hard: 30,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1.2)) return;
			const size = this.void_size || 16, opacity = (this.void_opacity || 45) / 100, hard = (this.void_hard || 30) / 100;
			const c = parseRGB(stroke_color), pts = this._pts;
			const a = pts[pts.length - 2] || pts[0], b = pts[pts.length - 1];
			const dist = Math.hypot(b.x - a.x, b.y - a.y);
			const steps = Math.max(1, Math.ceil(dist / Math.max(1, size * 0.15)));
			for (let i = 0; i <= steps; i++) {
				const t = i / steps, px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t, r = size / 2;
				const g = ctx.createRadialGradient(px, py, r * hard * 0.5, px, py, r);
				g.addColorStop(0, "rgba("+c.r+","+c.g+","+c.b+","+(opacity*c.a)+")");
				g.addColorStop(0.55, "rgba("+c.r+","+c.g+","+c.b+","+(opacity*0.25*c.a)+")");
				g.addColorStop(1, "rgba("+c.r+","+c.g+","+c.b+",0)");
				ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
			}
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null,
	},
	{
		id: "TOOL_VOID_INK", name: "Ink",
		description: "Smooth continuous ink with curve fitting.",
		cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 4, void_opacity: 100,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1)) return;
			const size = this.void_size || 4, opacity = (this.void_opacity || 100) / 100;
			const c = parseRGB(stroke_color);
			ctx.strokeStyle = "rgba("+c.r+","+c.g+","+c.b+","+(opacity*c.a)+")";
			ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
			strokeSegment(ctx, this._pts);
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null,
	},
	{
		id: "TOOL_VOID_MARKER", name: "Marker",
		description: "Semi-transparent marker / highlighter.",
		cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 22, void_opacity: 25,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1.5)) return;
			const size = this.void_size || 22, opacity = (this.void_opacity || 25) / 100;
			const c = parseRGB(stroke_color);
			ctx.save();
			ctx.strokeStyle = "rgba("+c.r+","+c.g+","+c.b+","+opacity+")";
			ctx.lineWidth = size; ctx.lineCap = "square"; ctx.lineJoin = "round";
			strokeSegment(ctx, this._pts);
			ctx.restore();
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null,
	},
	{
		id: "TOOL_VOID_SMUDGE", name: "Smudge",
		description: "Smooth smudge along stroke.",
		cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 14, void_strength: 55, _lx: null, _ly: null,
		pointerdown() { this._lx = this._ly = null; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y;
			if (lx == null) return;
			const r = Math.max(3, Math.round((this.void_size || 14) / 2));
			const strength = (this.void_strength || 55) / 100;
			const dx = x - lx, dy = y - ly, dist = Math.hypot(dx, dy);
			const steps = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.35)));
			for (let i = 1; i <= steps; i++) {
				const t = i / steps, px = lx + dx * t, py = ly + dy * t;
				const sx = Math.round(px - r), sy = Math.round(py - r), size = r * 2;
				if (sx < 0 || sy < 0 || sx + size > ctx.canvas.width || sy + size > ctx.canvas.height) continue;
				try {
					const img = ctx.getImageData(sx, sy, size, size);
					const d = img.data, ox = Math.round(-dx * strength * 0.4), oy = Math.round(-dy * strength * 0.4);
					const copy = new Uint8ClampedArray(d);
					for (let iy = 0; iy < size; iy++) for (let ix = 0; ix < size; ix++) {
						const cx = ix - r, cy = iy - r;
						if (cx * cx + cy * cy > r * r) continue;
						const fall = 1 - Math.sqrt(cx * cx + cy * cy) / r, mix = strength * fall * 0.7;
						const srcX = Math.min(size - 1, Math.max(0, ix + ox)), srcY = Math.min(size - 1, Math.max(0, iy + oy));
						const si = (srcY * size + srcX) * 4, di = (iy * size + ix) * 4;
						d[di] = copy[si] * mix + d[di] * (1 - mix);
						d[di + 1] = copy[si + 1] * mix + d[di + 1] * (1 - mix);
						d[di + 2] = copy[si + 2] * mix + d[di + 2] * (1 - mix);
					}
					ctx.putImageData(img, sx, sy);
				} catch (_) {}
			}
		},
		pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null,
	},
	{
		id: "TOOL_VOID_NEON", name: "Neon Glow",
		description: "Smooth neon glow trail.",
		cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 6, void_intensity: 80,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1)) return;
			const size = this.void_size || 6, intensity = (this.void_intensity || 80) / 100;
			const c = parseRGB(stroke_color);
			const r = Math.max(c.r, 50), g = Math.max(c.g, 50), b = Math.max(c.b, 50);
			ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
			[[size * 4, 0.08 * intensity], [size * 2.5, 0.15 * intensity], [size * 1.4, 0.35 * intensity], [size * 0.7, 0.7 * intensity]].forEach(function (L) {
				ctx.strokeStyle = "rgba("+r+","+g+","+b+","+L[1]+")"; ctx.lineWidth = L[0]; strokeSegment(ctx, this._pts);
			}.bind(this));
			ctx.strokeStyle = "rgba(255,255,255,"+(0.85*intensity)+")"; ctx.lineWidth = Math.max(1, size * 0.25);
			strokeSegment(ctx, this._pts); ctx.restore();
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null,
	},
	{
		id: "TOOL_VOID_RAINBOW", name: "Rainbow",
		description: "Smooth continuous rainbow trail.",
		cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 12, void_speed: 14, _hue: 0,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1)) return;
			const size = this.void_size || 12, speed = this.void_speed || 14, pts = this._pts, n = pts.length;
			ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = size;
			if (n < 2) return;
			if (n === 2) {
				this._hue = (this._hue + speed) % 360;
				ctx.strokeStyle = "hsl("+this._hue+" 95% 55%)";
				ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
				return;
			}
			const p0 = pts[n - 3], p1 = pts[n - 2], p2 = pts[n - 1];
			const m1x = (p0.x + p1.x) / 2, m1y = (p0.y + p1.y) / 2, m2x = (p1.x + p2.x) / 2, m2y = (p1.y + p2.y) / 2;
			const segLen = Math.hypot(m2x - m1x, m2y - m1y), sub = Math.max(1, Math.ceil(segLen / 2));
			for (let i = 0; i < sub; i++) {
				const t0 = i / sub, t1 = (i + 1) / sub;
				const q = function (t) {
					const u = 1 - t;
					return { x: u * u * m1x + 2 * u * t * p1.x + t * t * m2x, y: u * u * m1y + 2 * u * t * p1.y + t * t * m2y };
				};
				const a = q(t0), b = q(t1);
				this._hue = (this._hue + speed * (1 / sub) * 4) % 360;
				ctx.strokeStyle = "hsl("+this._hue+" 95% 55%)";
				ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
			}
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null,
	},
	{
		id: "TOOL_VOID_STARS", name: "Stars",
		description: "Stamp stars along path.",
		cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 16, void_density: 55, _lx: null, _ly: null, _acc: 0,
		pointerdown() { this._lx = this._ly = null; this._acc = 0; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y;
			if (lx == null) return;
			const size = this.void_size || 16, density = (this.void_density || 55) / 100;
			const dist = Math.hypot(x - lx, y - ly); this._acc += dist;
			const spacing = size * (1.1 - density * 0.6);
			while (this._acc >= spacing) {
				this._acc -= spacing;
				const t = 1 - this._acc / (dist || 1);
				const px = lx + (x - lx) * Math.min(1, Math.max(0, t));
				const py = ly + (y - ly) * Math.min(1, Math.max(0, t));
				const r = size / 2 * (0.65 + Math.random() * 0.45);
				ctx.fillStyle = stroke_color; ctx.beginPath();
				for (let i = 0; i < 10; i++) {
					const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 === 0 ? r : r * 0.4;
					const sx = px + Math.cos(a) * rr, sy = py + Math.sin(a) * rr;
					if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
				}
				ctx.closePath(); ctx.fill();
			}
		},
		pointerup() { snapUndo(this.name); }, $options: null,
	},
	{
		id: "TOOL_VOID_ARROW", name: "Arrow",
		description: "Drag to draw an arrow.",
		cursor: ["precise", [16, 16], "crosshair"],
		void_size: 4, _snap: null,
		pointerdown(ctx) {
			try { this._snap = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height); } catch (_) { this._snap = null; }
		},
		paint(ctx) {
			if (this._snap) { try { ctx.putImageData(this._snap, 0, 0); } catch (_) {} }
			if (typeof pointer_start === "undefined" || !pointer_start) return;
			const x0 = pointer_start.x, y0 = pointer_start.y;
			const x1 = (typeof pointer !== "undefined" && pointer) ? pointer.x : x0;
			const y1 = (typeof pointer !== "undefined" && pointer) ? pointer.y : y0;
			const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0) || 1;
			const head = Math.min(32, Math.max(12, len * 0.28)), lw = this.void_size || 4;
			ctx.strokeStyle = stroke_color; ctx.fillStyle = stroke_color;
			ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
			ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(x1, y1);
			ctx.lineTo(x1 - head * Math.cos(ang - 0.4), y1 - head * Math.sin(ang - 0.4));
			ctx.lineTo(x1 - head * Math.cos(ang + 0.4), y1 - head * Math.sin(ang + 0.4));
			ctx.closePath(); ctx.fill();
		},
		pointerup() { snapUndo(this.name); this._snap = null; }, $options: null,
	},
	{
		id: "TOOL_VOID_DOTTED", name: "Dotted Line",
		description: "Smooth dotted freehand line.",
		cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 7, void_gap: 10, _lx: null, _ly: null, _carry: 0,
		pointerdown() { this._lx = this._ly = null; this._carry = 0; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y;
			if (lx == null) return;
			const size = this.void_size || 7, gap = this.void_gap || 10, period = size + gap;
			const dx = x - lx, dy = y - ly, dist = Math.hypot(dx, dy);
			if (dist < 0.01) return;
			const ux = dx / dist, uy = dy / dist;
			ctx.fillStyle = stroke_color;
			let d = this._carry;
			while (d < dist) {
				if ((d % period) < size * 0.85) {
					const px = lx + ux * d, py = ly + uy * d;
					ctx.beginPath(); ctx.arc(px, py, size / 2, 0, Math.PI * 2); ctx.fill();
				}
				d += 0.75;
			}
			this._carry = (this._carry + dist) % period;
		},
		pointerup() { snapUndo(this.name); }, $options: null,
	},
	{
		id: "TOOL_VOID_NOISE", name: "Noise",
		description: "Soft noise spray.",
		cursor: ["airbrush", [7, 22], "crosshair"],
		void_size: 28, void_density: 55, paint_on_time_interval: 12,
		paint(ctx, x, y) {
			const r = (this.void_size || 28) / 2;
			const density = Math.round(((this.void_density || 55) / 100) * 100);
			const c = parseRGB(stroke_color);
			for (let i = 0; i < density; i++) {
				const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * r;
				const px = x + Math.cos(ang) * rad, py = y + Math.sin(ang) * rad;
				ctx.fillStyle = "rgba("+c.r+","+c.g+","+c.b+","+(0.12+Math.random()*0.5)+")";
				ctx.beginPath(); ctx.arc(px, py, 0.6 + Math.random() * 1.2, 0, Math.PI * 2); ctx.fill();
			}
		},
		pointerup() { snapUndo(this.name); }, $options: null,
	},
	{
		id: "TOOL_VOID_BLUR", name: "Blur",
		description: "Soft circular blur.",
		cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 20, void_strength: 50, _lx: null, _ly: null,
		pointerdown() { this._lx = this._ly = null; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y;
			if (lx == null) { this._doBlur(ctx, x, y); return; }
			const dist = Math.hypot(x - lx, y - ly), steps = Math.max(1, Math.ceil(dist / 4));
			for (let i = 1; i <= steps; i++) {
				const t = i / steps;
				this._doBlur(ctx, lx + (x - lx) * t, ly + (y - ly) * t);
			}
		},
		_doBlur(ctx, px, py) {
			const r = Math.max(4, Math.round((this.void_size || 20) / 2));
			const strength = (this.void_strength || 50) / 100;
			const sx = Math.round(px - r), sy = Math.round(py - r), size = r * 2;
			if (sx < 0 || sy < 0 || sx + size > ctx.canvas.width || sy + size > ctx.canvas.height) return;
			try {
				const img = ctx.getImageData(sx, sy, size, size);
				const src = new Uint8ClampedArray(img.data), d = img.data;
				const passes = strength > 0.55 ? 2 : 1;
				for (let p = 0; p < passes; p++) {
					const from = p === 0 ? src : new Uint8ClampedArray(d);
					for (let iy = 1; iy < size - 1; iy++) for (let ix = 1; ix < size - 1; ix++) {
						const cx = ix - r, cy = iy - r;
						if (cx * cx + cy * cy > r * r) continue;
						let rr = 0, gg = 0, bb = 0, aa = 0;
						for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
							const i = ((iy + oy) * size + (ix + ox)) * 4;
							rr += from[i]; gg += from[i + 1]; bb += from[i + 2]; aa += from[i + 3];
						}
						const oi = (iy * size + ix) * 4;
						d[oi] = rr / 9; d[oi + 1] = gg / 9; d[oi + 2] = bb / 9; d[oi + 3] = aa / 9;
					}
				}
				ctx.putImageData(img, sx, sy);
			} catch (_) {}
		},
		pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null,
	},
	{
		id: "TOOL_VOID_CALLIGRAPHY", name: "Calligraphy",
		description: "Smooth flat calligraphy pen.",
		cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 14, void_angle: 45,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1)) return;
			const size = this.void_size || 14, angle = ((this.void_angle || 45) * Math.PI) / 180;
			const pts = this._pts, n = pts.length;
			if (n < 2) return;
			const a = pts[n - 2], b = pts[n - 1], half = size / 2;
			const ox = Math.cos(angle) * half, oy = Math.sin(angle) * half;
			ctx.fillStyle = stroke_color;
			ctx.beginPath();
			ctx.moveTo(a.x - ox, a.y - oy); ctx.lineTo(a.x + ox, a.y + oy);
			ctx.lineTo(b.x + ox, b.y + oy); ctx.lineTo(b.x - ox, b.y - oy);
			ctx.closePath(); ctx.fill();
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null,
	},
];

(function attach() {
	const t = {};
	void_tools.forEach(function (tool) { t[tool.id] = tool; });
	t.TOOL_VOID_SOFT_BRUSH.$options = makeOptions(function (h) {
		makeSlider(h, "Size", 4, 80, t.TOOL_VOID_SOFT_BRUSH.void_size, function (v) { t.TOOL_VOID_SOFT_BRUSH.void_size = v; });
		makeSlider(h, "Opacity", 10, 100, t.TOOL_VOID_SOFT_BRUSH.void_opacity, function (v) { t.TOOL_VOID_SOFT_BRUSH.void_opacity = v; });
		makeSlider(h, "Hard", 0, 100, t.TOOL_VOID_SOFT_BRUSH.void_hard, function (v) { t.TOOL_VOID_SOFT_BRUSH.void_hard = v; });
	});
	t.TOOL_VOID_INK.$options = makeOptions(function (h) {
		makeSlider(h, "Size", 1, 30, t.TOOL_VOID_INK.void_size, function (v) { t.TOOL_VOID_INK.void_size = v; });
		makeSlider(h, "Opacity", 20, 100, t.TOOL_VOID_INK.void_opacity, function (v) { t.TOOL_VOID_INK.void_opacity = v; });
	});
	t.TOOL_VOID_MARKER.$options = makeOptions(function (h) {
		makeSlider(h, "Size", 8, 60, t.TOOL_VOID_MARKER.void_size, function (v) { t.TOOL_VOID_MARKER.void_size = v; });
		makeSlider(h, "Opacity", 8, 60, t.TOOL_VOID_MARKER.void_opacity, function (v) { t.TOOL_VOID_MARKER.void_opacity = v; });
	});
	t.TOOL_VOID_SMUDGE.$options = makeOptions(function (h) {
		makeSlider(h, "Size", 6, 40, t.TOOL_VOID_SMUDGE.void_size, function (v) { t.TOOL_VOID_SMUDGE.void_size = v; });
		makeSlider(h, "Pull", 15, 100, t.TOOL_VOID_SMUDGE.void_strength, function (v) { t.TOOL_VOID_SMUDGE.void_strength = v; });
	});
	t.TOOL_VOID_NEON.$options = makeOptions(function (h) {
		makeSlider(h, "Size", 2, 24, t.TOOL_VOID_NEON.void_size, function (v) { t.TOOL_VOID_NEON.void_size = v; });
		makeSlider(h, "Glow", 30, 100, t.TOOL_VOID_NEON.void_intensity, function (v) { t.TOOL_VOID_NEON.void_intensity = v; });
	});
	t.TOOL_VOID_RAINBOW.$options = makeOptions(function (h) {
		makeSlider(h, "Size", 2, 40, t.TOOL_VOID_RAINBOW.void_size, function (v) { t.TOOL_VOID_RAINBOW.void_size = v; });
		makeSlider(h, "Speed", 2, 40, t.TOOL_VOID_RAINBOW.void_speed, function (v) { t.TOOL_VOID_RAINBOW.void_speed = v; });
	});
	t.TOOL_VOID_STARS.$options = makeOptions(function (h) {
		makeSlider(h, "Size", 6, 40, t.TOOL_VOID_STARS.void_size, function (v) { t.TOOL_VOID_STARS.void_size = v; });
		makeSlider(h, "Dense", 15, 100, t.TOOL_VOID_STARS.void_density, function (v) { t.TOOL_VOID_STARS.void_density = v; });
	});
	t.TOOL_VOID_ARROW.$options = makeOptions(function (h) {
		makeSlider(h, "Width", 1, 16, t.TOOL_VOID_ARROW.void_size, function (v) { t.TOOL_VOID_ARROW.void_size = v; });
	});
	t.TOOL_VOID_DOTTED.$options = makeOptions(function (h) {
		makeSlider(h, "Dot", 2, 20, t.TOOL_VOID_DOTTED.void_size, function (v) { t.TOOL_VOID_DOTTED.void_size = v; });
		makeSlider(h, "Gap", 2, 28, t.TOOL_VOID_DOTTED.void_gap, function (v) { t.TOOL_VOID_DOTTED.void_gap = v; });
	});
	t.TOOL_VOID_NOISE.$options = makeOptions(function (h) {
		makeSlider(h, "Radius", 8, 60, t.TOOL_VOID_NOISE.void_size, function (v) { t.TOOL_VOID_NOISE.void_size = v; });
		makeSlider(h, "Dense", 10, 100, t.TOOL_VOID_NOISE.void_density, function (v) { t.TOOL_VOID_NOISE.void_density = v; });
	});
	t.TOOL_VOID_BLUR.$options = makeOptions(function (h) {
		makeSlider(h, "Size", 8, 48, t.TOOL_VOID_BLUR.void_size, function (v) { t.TOOL_VOID_BLUR.void_size = v; });
		makeSlider(h, "Soft", 15, 100, t.TOOL_VOID_BLUR.void_strength, function (v) { t.TOOL_VOID_BLUR.void_strength = v; });
	});
	t.TOOL_VOID_CALLIGRAPHY.$options = makeOptions(function (h) {
		makeSlider(h, "Size", 4, 40, t.TOOL_VOID_CALLIGRAPHY.void_size, function (v) { t.TOOL_VOID_CALLIGRAPHY.void_size = v; });
		makeSlider(h, "Angle", 0, 180, t.TOOL_VOID_CALLIGRAPHY.void_angle, function (v) { t.TOOL_VOID_CALLIGRAPHY.void_angle = v; });
	});
})();
