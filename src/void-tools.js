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
	if (n === 2) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke(); return; }
	const p0 = pts[n - 3], p1 = pts[n - 2], p2 = pts[n - 1];
	const m1x = (p0.x + p1.x) / 2, m1y = (p0.y + p1.y) / 2, m2x = (p1.x + p2.x) / 2, m2y = (p1.y + p2.y) / 2;
	ctx.beginPath(); ctx.moveTo(m1x, m1y); ctx.quadraticCurveTo(p1.x, p1.y, m2x, m2y); ctx.stroke();
}
function pushPoint(tool, x, y, minDist) {
	minDist = minDist || 1.5;
	if (!tool._pts) tool._pts = [];
	const pts = tool._pts;
	if (pts.length) { const last = pts[pts.length - 1]; if (Math.hypot(x - last.x, y - last.y) < minDist) return false; }
	pts.push({ x: x, y: y }); return true;
}
function makeSlider(host, label, min, max, value, onChange) {
	const wrap = document.createElement("div");
	wrap.style.cssText = "display:flex;flex-direction:column;gap:1px;font-size:9px;width:100%;color:#cfe0ff;";
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
	host.style.cssText = "display:flex;flex-direction:column;gap:4px;padding:2px;min-width:40px;";
	builders(host);
	if (typeof window.$ === "function") return window.$(host);
	return Object.assign([host], { appendTo: function () { return this; }, trigger: function () { return this; }, length: 1 });
}
function rgba(c, a) { return "rgba("+c.r+","+c.g+","+c.b+","+a+")"; }

export const void_tools = [
	{ id: "TOOL_VOID_SOFT_BRUSH", name: "Soft Brush", description: "Smooth anti-aliased soft brush.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 16, void_opacity: 45, void_hard: 30, void_flow: 80,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1.2)) return;
			const size = this.void_size || 16, opacity = ((this.void_opacity || 45) / 100) * ((this.void_flow || 80) / 100), hard = (this.void_hard || 30) / 100;
			const c = parseRGB(stroke_color), pts = this._pts, a = pts[pts.length - 2] || pts[0], b = pts[pts.length - 1];
			const dist = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(dist / Math.max(1, size * 0.15)));
			for (let i = 0; i <= steps; i++) {
				const t = i / steps, px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t, r = size / 2;
				const g = ctx.createRadialGradient(px, py, r * hard * 0.5, px, py, r);
				g.addColorStop(0, rgba(c, opacity * c.a)); g.addColorStop(0.55, rgba(c, opacity * 0.25 * c.a)); g.addColorStop(1, rgba(c, 0));
				ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
			}
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null },
	{ id: "TOOL_VOID_INK", name: "Ink", description: "Smooth continuous ink.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 4, void_opacity: 100, void_smoothing: 50,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			const minD = 1 + (100 - (this.void_smoothing || 50)) / 40;
			if (!pushPoint(this, x, y, minD)) return;
			const c = parseRGB(stroke_color);
			ctx.strokeStyle = rgba(c, ((this.void_opacity || 100) / 100) * c.a);
			ctx.lineWidth = this.void_size || 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
			strokeSegment(ctx, this._pts);
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null },
	{ id: "TOOL_VOID_MARKER", name: "Marker", description: "Semi-transparent marker.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 22, void_opacity: 25, void_soft: 40,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1.5)) return;
			const c = parseRGB(stroke_color), soft = (this.void_soft || 40) / 100;
			ctx.save(); ctx.lineCap = soft > 0.5 ? "round" : "square"; ctx.lineJoin = "round";
			ctx.strokeStyle = rgba(c, (this.void_opacity || 25) / 100); ctx.lineWidth = this.void_size || 22;
			strokeSegment(ctx, this._pts); ctx.restore();
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null },
	{ id: "TOOL_VOID_SMUDGE", name: "Smudge", description: "Smooth smudge along stroke.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 14, void_strength: 55, void_soft: 70, _lx: null, _ly: null,
		pointerdown() { this._lx = this._ly = null; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y; if (lx == null) return;
			const r = Math.max(3, Math.round((this.void_size || 14) / 2)), strength = (this.void_strength || 55) / 100, soft = (this.void_soft || 70) / 100;
			const dx = x - lx, dy = y - ly, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.35)));
			for (let i = 1; i <= steps; i++) {
				const t = i / steps, px = lx + dx * t, py = ly + dy * t;
				const sx = Math.round(px - r), sy = Math.round(py - r), size = r * 2;
				if (sx < 0 || sy < 0 || sx + size > ctx.canvas.width || sy + size > ctx.canvas.height) continue;
				try {
					const img = ctx.getImageData(sx, sy, size, size), d = img.data;
					const ox = Math.round(-dx * strength * 0.4), oy = Math.round(-dy * strength * 0.4), copy = new Uint8ClampedArray(d);
					for (let iy = 0; iy < size; iy++) for (let ix = 0; ix < size; ix++) {
						const cx = ix - r, cy = iy - r, rad = Math.sqrt(cx * cx + cy * cy); if (rad > r) continue;
						const fall = Math.pow(1 - rad / r, 0.5 + soft), mix = strength * fall * 0.7;
						const srcX = Math.min(size - 1, Math.max(0, ix + ox)), srcY = Math.min(size - 1, Math.max(0, iy + oy));
						const si = (srcY * size + srcX) * 4, di = (iy * size + ix) * 4;
						d[di] = copy[si] * mix + d[di] * (1 - mix); d[di + 1] = copy[si + 1] * mix + d[di + 1] * (1 - mix); d[di + 2] = copy[si + 2] * mix + d[di + 2] * (1 - mix);
					}
					ctx.putImageData(img, sx, sy);
				} catch (_) {}
			}
		},
		pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null },
	{ id: "TOOL_VOID_NEON", name: "Neon Glow", description: "Smooth neon glow trail.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 6, void_intensity: 80, void_core: 70,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1)) return;
			const size = this.void_size || 6, intensity = (this.void_intensity || 80) / 100, core = (this.void_core || 70) / 100;
			const c = parseRGB(stroke_color), r = Math.max(c.r, 50), g = Math.max(c.g, 50), b = Math.max(c.b, 50);
			ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
			[[size * 4, 0.08 * intensity], [size * 2.5, 0.15 * intensity], [size * 1.4, 0.35 * intensity], [size * 0.7, 0.7 * intensity]].forEach(function (L) {
				ctx.strokeStyle = "rgba("+r+","+g+","+b+","+L[1]+")"; ctx.lineWidth = L[0]; strokeSegment(ctx, this._pts);
			}.bind(this));
			ctx.strokeStyle = "rgba(255,255,255,"+(0.85*intensity*core)+")"; ctx.lineWidth = Math.max(1, size * 0.25 * core);
			strokeSegment(ctx, this._pts); ctx.restore();
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null },
	{ id: "TOOL_VOID_RAINBOW", name: "Rainbow", description: "Smooth rainbow trail.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 12, void_speed: 14, void_sat: 95, _hue: 0,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1)) return;
			const size = this.void_size || 12, speed = this.void_speed || 14, sat = this.void_sat || 95, pts = this._pts, n = pts.length;
			ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = size;
			if (n < 2) return;
			if (n === 2) { this._hue = (this._hue + speed) % 360; ctx.strokeStyle = "hsl("+this._hue+" "+sat+"% 55%)"; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke(); return; }
			const p0 = pts[n - 3], p1 = pts[n - 2], p2 = pts[n - 1];
			const m1x = (p0.x + p1.x) / 2, m1y = (p0.y + p1.y) / 2, m2x = (p1.x + p2.x) / 2, m2y = (p1.y + p2.y) / 2;
			const segLen = Math.hypot(m2x - m1x, m2y - m1y), sub = Math.max(1, Math.ceil(segLen / 2));
			for (let i = 0; i < sub; i++) {
				const t0 = i / sub, t1 = (i + 1) / sub;
				const q = function (t) { const u = 1 - t; return { x: u*u*m1x + 2*u*t*p1.x + t*t*m2x, y: u*u*m1y + 2*u*t*p1.y + t*t*m2y }; };
				const a = q(t0), b = q(t1);
				this._hue = (this._hue + speed * (1 / sub) * 4) % 360;
				ctx.strokeStyle = "hsl("+this._hue+" "+sat+"% 55%)"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
			}
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null },
	{ id: "TOOL_VOID_STARS", name: "Stars", description: "Stamp stars along path.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 16, void_density: 55, void_jitter: 40, _lx: null, _ly: null, _acc: 0,
		pointerdown() { this._lx = this._ly = null; this._acc = 0; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y; if (lx == null) return;
			const size = this.void_size || 16, density = (this.void_density || 55) / 100, jitter = (this.void_jitter || 40) / 100;
			const dist = Math.hypot(x - lx, y - ly); this._acc += dist;
			const spacing = size * (1.1 - density * 0.6);
			while (this._acc >= spacing) {
				this._acc -= spacing;
				const t = 1 - this._acc / (dist || 1);
				let px = lx + (x - lx) * Math.min(1, Math.max(0, t)), py = ly + (y - ly) * Math.min(1, Math.max(0, t));
				px += (Math.random() - 0.5) * size * jitter; py += (Math.random() - 0.5) * size * jitter;
				const r = size / 2 * (0.65 + Math.random() * 0.45);
				ctx.fillStyle = stroke_color; ctx.beginPath();
				for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 === 0 ? r : r * 0.4; const sx = px + Math.cos(a) * rr, sy = py + Math.sin(a) * rr; if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy); }
				ctx.closePath(); ctx.fill();
			}
		},
		pointerup() { snapUndo(this.name); }, $options: null },
	{ id: "TOOL_VOID_ARROW", name: "Arrow", description: "Drag to draw an arrow.", cursor: ["precise", [16, 16], "crosshair"],
		void_size: 4, void_head: 50, _snap: null,
		pointerdown(ctx) { try { this._snap = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height); } catch (_) { this._snap = null; } },
		paint(ctx) {
			if (this._snap) { try { ctx.putImageData(this._snap, 0, 0); } catch (_) {} }
			if (typeof pointer_start === "undefined" || !pointer_start) return;
			const x0 = pointer_start.x, y0 = pointer_start.y;
			const x1 = (typeof pointer !== "undefined" && pointer) ? pointer.x : x0, y1 = (typeof pointer !== "undefined" && pointer) ? pointer.y : y0;
			const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0) || 1;
			const head = Math.min(32, Math.max(12, len * 0.28)) * ((this.void_head || 50) / 50), lw = this.void_size || 4;
			ctx.strokeStyle = stroke_color; ctx.fillStyle = stroke_color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
			ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - head * Math.cos(ang - 0.4), y1 - head * Math.sin(ang - 0.4)); ctx.lineTo(x1 - head * Math.cos(ang + 0.4), y1 - head * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill();
		},
		pointerup() { snapUndo(this.name); this._snap = null; }, $options: null },
	{ id: "TOOL_VOID_DOTTED", name: "Dotted Line", description: "Smooth dotted freehand line.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 7, void_gap: 10, void_opacity: 100, _lx: null, _ly: null, _carry: 0,
		pointerdown() { this._lx = this._ly = null; this._carry = 0; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y; if (lx == null) return;
			const size = this.void_size || 7, gap = this.void_gap || 10, period = size + gap, c = parseRGB(stroke_color);
			const dx = x - lx, dy = y - ly, dist = Math.hypot(dx, dy); if (dist < 0.01) return;
			const ux = dx / dist, uy = dy / dist; ctx.fillStyle = rgba(c, ((this.void_opacity || 100) / 100) * c.a);
			let d = this._carry;
			while (d < dist) { if ((d % period) < size * 0.85) { const px = lx + ux * d, py = ly + uy * d; ctx.beginPath(); ctx.arc(px, py, size / 2, 0, Math.PI * 2); ctx.fill(); } d += 0.75; }
			this._carry = (this._carry + dist) % period;
		},
		pointerup() { snapUndo(this.name); }, $options: null },
	{ id: "TOOL_VOID_NOISE", name: "Noise", description: "Soft noise spray.", cursor: ["airbrush", [7, 22], "crosshair"],
		void_size: 28, void_density: 55, void_opacity: 50, paint_on_time_interval: 12,
		paint(ctx, x, y) {
			const r = (this.void_size || 28) / 2, density = Math.round(((this.void_density || 55) / 100) * 100), baseA = (this.void_opacity || 50) / 100, c = parseRGB(stroke_color);
			for (let i = 0; i < density; i++) {
				const ang = Math.random() * Math.PI * 2, rad = Math.sqrt(Math.random()) * r;
				ctx.fillStyle = rgba(c, baseA * (0.25 + Math.random() * 0.75) * c.a);
				ctx.beginPath(); ctx.arc(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 0.6 + Math.random() * 1.2, 0, Math.PI * 2); ctx.fill();
			}
		},
		pointerup() { snapUndo(this.name); }, $options: null },
	{ id: "TOOL_VOID_BLUR", name: "Blur", description: "Soft circular blur.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 20, void_strength: 50, _lx: null, _ly: null,
		pointerdown() { this._lx = this._ly = null; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y;
			if (lx == null) { this._doBlur(ctx, x, y); return; }
			const dist = Math.hypot(x - lx, y - ly), steps = Math.max(1, Math.ceil(dist / 4));
			for (let i = 1; i <= steps; i++) { const t = i / steps; this._doBlur(ctx, lx + (x - lx) * t, ly + (y - ly) * t); }
		},
		_doBlur(ctx, px, py) {
			const r = Math.max(4, Math.round((this.void_size || 20) / 2)), strength = (this.void_strength || 50) / 100;
			const sx = Math.round(px - r), sy = Math.round(py - r), size = r * 2;
			if (sx < 0 || sy < 0 || sx + size > ctx.canvas.width || sy + size > ctx.canvas.height) return;
			try {
				const img = ctx.getImageData(sx, sy, size, size), src = new Uint8ClampedArray(img.data), d = img.data, passes = strength > 0.55 ? 2 : 1;
				for (let p = 0; p < passes; p++) {
					const from = p === 0 ? src : new Uint8ClampedArray(d);
					for (let iy = 1; iy < size - 1; iy++) for (let ix = 1; ix < size - 1; ix++) {
						const cx = ix - r, cy = iy - r; if (cx * cx + cy * cy > r * r) continue;
						let rr = 0, gg = 0, bb = 0, aa = 0;
						for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const i = ((iy + oy) * size + (ix + ox)) * 4; rr += from[i]; gg += from[i + 1]; bb += from[i + 2]; aa += from[i + 3]; }
						const oi = (iy * size + ix) * 4; d[oi] = rr / 9; d[oi + 1] = gg / 9; d[oi + 2] = bb / 9; d[oi + 3] = aa / 9;
					}
				}
				ctx.putImageData(img, sx, sy);
			} catch (_) {}
		},
		pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null },
	{ id: "TOOL_VOID_CALLIGRAPHY", name: "Calligraphy", description: "Solid flat calligraphy ribbon (no gaps).", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 14, void_angle: 45, void_thin: 25, void_opacity: 100,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 0.8)) return;
			const size = this.void_size || 14, angle = ((this.void_angle || 45) * Math.PI) / 180;
			const thin = Math.max(0.08, (this.void_thin || 25) / 100), opacity = (this.void_opacity || 100) / 100;
			const c = parseRGB(stroke_color), pts = this._pts, n = pts.length; if (n < 2) return;
			const a = pts[n - 2], b = pts[n - 1], dist = Math.hypot(b.x - a.x, b.y - a.y);
			const steps = Math.max(2, Math.ceil(dist / 0.6)), hw = size / 2, hh = size * thin * 0.5;
			ctx.fillStyle = rgba(c, opacity * c.a);
			for (let i = 0; i <= steps; i++) {
				const t = i / steps, px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
				ctx.save(); ctx.translate(px, py); ctx.rotate(angle);
				ctx.beginPath(); ctx.ellipse(0, 0, hw, Math.max(0.8, hh), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
			}
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null },
	{ id: "TOOL_VOID_MIRROR", name: "Mirror", description: "Brush mirrored across canvas center.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 8, void_opacity: 90, void_mode: 1,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; this._w = ctx.canvas.width; this._h = ctx.canvas.height; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1)) return;
			const size = this.void_size || 8, opacity = (this.void_opacity || 90) / 100, mode = this.void_mode || 1, c = parseRGB(stroke_color);
			const w = this._w || ctx.canvas.width, h = this._h || ctx.canvas.height, pts = this._pts;
			ctx.strokeStyle = rgba(c, opacity * c.a); ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
			strokeSegment(ctx, pts);
			if (mode === 1 || mode === 3) strokeSegment(ctx, pts.map(function (p) { return { x: w - p.x, y: p.y }; }));
			if (mode === 2 || mode === 3) strokeSegment(ctx, pts.map(function (p) { return { x: p.x, y: h - p.y }; }));
			if (mode === 3) strokeSegment(ctx, pts.map(function (p) { return { x: w - p.x, y: h - p.y }; }));
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null },
	{ id: "TOOL_VOID_SKETCH", name: "Sketch", description: "Sketchy multi-line pencil stroke.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 2, void_layers: 4, void_spread: 30, void_opacity: 55,
		pointerdown(ctx, x, y) { this._pts = [{ x: x, y: y }]; },
		paint(ctx, x, y) {
			if (!pushPoint(this, x, y, 1.2)) return;
			const size = this.void_size || 2, layers = Math.max(1, Math.round(this.void_layers || 4));
			const spread = (this.void_spread || 30) / 10, opacity = (this.void_opacity || 55) / 100, c = parseRGB(stroke_color), pts = this._pts;
			ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = size;
			for (let L = 0; L < layers; L++) {
				const ox = (Math.random() - 0.5) * spread, oy = (Math.random() - 0.5) * spread;
				ctx.strokeStyle = rgba(c, opacity * c.a * (0.5 + Math.random() * 0.5));
				strokeSegment(ctx, pts.map(function (p) { return { x: p.x + ox + (Math.random() - 0.5) * 0.8, y: p.y + oy + (Math.random() - 0.5) * 0.8 }; }));
			}
		},
		pointerup() { snapUndo(this.name); this._pts = null; }, $options: null },
	{ id: "TOOL_VOID_RIPPLE", name: "Ripple", description: "Concentric ripple rings along stroke.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 24, void_rings: 3, void_opacity: 40, void_spacing: 40, _acc: 0, _lx: null, _ly: null,
		pointerdown() { this._acc = 0; this._lx = this._ly = null; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y; if (lx == null) return;
			const dist = Math.hypot(x - lx, y - ly); this._acc += dist;
			const spacing = this.void_spacing || 40, maxR = this.void_size || 24, rings = Math.max(1, Math.round(this.void_rings || 3));
			const opacity = (this.void_opacity || 40) / 100, c = parseRGB(stroke_color);
			while (this._acc >= spacing) {
				this._acc -= spacing;
				const t = 1 - this._acc / (dist || 1), px = lx + (x - lx) * Math.min(1, Math.max(0, t)), py = ly + (y - ly) * Math.min(1, Math.max(0, t));
				for (let i = 1; i <= rings; i++) {
					ctx.strokeStyle = rgba(c, opacity * c.a * (1 - i / (rings + 1))); ctx.lineWidth = Math.max(1, 2 - i * 0.3);
					ctx.beginPath(); ctx.arc(px, py, (maxR / rings) * i, 0, Math.PI * 2); ctx.stroke();
				}
			}
		},
		pointerup() { snapUndo(this.name); }, $options: null },
	{ id: "TOOL_VOID_CONFETTI", name: "Confetti", description: "Colorful confetti particles.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 10, void_density: 50, void_spread: 60, _lx: null, _ly: null, _acc: 0,
		pointerdown() { this._lx = this._ly = null; this._acc = 0; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y; if (lx == null) return;
			const dist = Math.hypot(x - lx, y - ly); this._acc += dist;
			const size = this.void_size || 10, density = (this.void_density || 50) / 100, spread = this.void_spread || 60;
			const spacing = Math.max(3, size * (1.2 - density)), hues = [0, 30, 55, 120, 200, 280, 320];
			while (this._acc >= spacing) {
				this._acc -= spacing;
				const t = 1 - this._acc / (dist || 1), bx = lx + (x - lx) * Math.min(1, Math.max(0, t)), by = ly + (y - ly) * Math.min(1, Math.max(0, t));
				const count = 1 + Math.floor(Math.random() * 3);
				for (let i = 0; i < count; i++) {
					const px = bx + (Math.random() - 0.5) * spread, py = by + (Math.random() - 0.5) * spread;
					const w = size * (0.4 + Math.random() * 0.8), h = size * (0.25 + Math.random() * 0.5), rot = Math.random() * Math.PI;
					const hue = hues[Math.floor(Math.random() * hues.length)];
					ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.fillStyle = "hsl("+hue+" 90% 55%)"; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
				}
			}
		},
		pointerup() { snapUndo(this.name); }, $options: null },
	{ id: "TOOL_VOID_PIXELATE", name: "Pixelate", description: "Pixelates image under brush into chunks.", cursor: ["precise-dotted", [16, 16], "crosshair"],
		void_size: 32, void_block: 6, void_strength: 80, _lx: null, _ly: null,
		pointerdown() { this._lx = this._ly = null; },
		paint(ctx, x, y) {
			const lx = this._lx, ly = this._ly; this._lx = x; this._ly = y;
			const r = Math.max(8, Math.round((this.void_size || 32) / 2)), block = Math.max(2, Math.round(this.void_block || 6)), strength = (this.void_strength || 80) / 100;
			const points = lx == null ? [[x, y]] : (function () {
				const dist = Math.hypot(x - lx, y - ly), steps = Math.max(1, Math.ceil(dist / (r * 0.5))), out = [];
				for (let i = 1; i <= steps; i++) { const t = i / steps; out.push([lx + (x - lx) * t, ly + (y - ly) * t]); }
				return out;
			})();
			for (let p = 0; p < points.length; p++) {
				const px = points[p][0], py = points[p][1];
				const sx = Math.max(0, Math.round(px - r)), sy = Math.max(0, Math.round(py - r));
				const ex = Math.min(ctx.canvas.width, Math.round(px + r)), ey = Math.min(ctx.canvas.height, Math.round(py + r));
				const bw = ex - sx, bh = ey - sy; if (bw < block || bh < block) continue;
				try {
					const img = ctx.getImageData(sx, sy, bw, bh), d = img.data;
					for (let by = 0; by < bh; by += block) for (let bx = 0; bx < bw; bx += block) {
						let rr = 0, gg = 0, bb = 0, aa = 0, count = 0;
						const bhe = Math.min(block, bh - by), bwe = Math.min(block, bw - bx);
						for (let iy = 0; iy < bhe; iy++) for (let ix = 0; ix < bwe; ix++) {
							const cx = bx + ix - (px - sx), cy = by + iy - (py - sy); if (cx * cx + cy * cy > r * r) continue;
							const i = ((by + iy) * bw + (bx + ix)) * 4; rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; aa += d[i + 3]; count++;
						}
						if (!count) continue; rr /= count; gg /= count; bb /= count; aa /= count;
						for (let iy = 0; iy < bhe; iy++) for (let ix = 0; ix < bwe; ix++) {
							const cx = bx + ix - (px - sx), cy = by + iy - (py - sy); if (cx * cx + cy * cy > r * r) continue;
							const i = ((by + iy) * bw + (bx + ix)) * 4;
							d[i] = d[i] * (1 - strength) + rr * strength; d[i + 1] = d[i + 1] * (1 - strength) + gg * strength;
							d[i + 2] = d[i + 2] * (1 - strength) + bb * strength; d[i + 3] = d[i + 3] * (1 - strength) + aa * strength;
						}
					}
					ctx.putImageData(img, sx, sy);
				} catch (_) {}
			}
		},
		pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null },
];

(function attach() {
	const t = {}; void_tools.forEach(function (tool) { t[tool.id] = tool; });
	function opt(id, fn) { t[id].$options = makeOptions(fn); }
	opt("TOOL_VOID_SOFT_BRUSH", function (h) {
		makeSlider(h, "Size", 4, 80, t.TOOL_VOID_SOFT_BRUSH.void_size, function (v) { t.TOOL_VOID_SOFT_BRUSH.void_size = v; });
		makeSlider(h, "Opacity", 10, 100, t.TOOL_VOID_SOFT_BRUSH.void_opacity, function (v) { t.TOOL_VOID_SOFT_BRUSH.void_opacity = v; });
		makeSlider(h, "Hard", 0, 100, t.TOOL_VOID_SOFT_BRUSH.void_hard, function (v) { t.TOOL_VOID_SOFT_BRUSH.void_hard = v; });
		makeSlider(h, "Flow", 20, 100, t.TOOL_VOID_SOFT_BRUSH.void_flow, function (v) { t.TOOL_VOID_SOFT_BRUSH.void_flow = v; });
	});
	opt("TOOL_VOID_INK", function (h) {
		makeSlider(h, "Size", 1, 30, t.TOOL_VOID_INK.void_size, function (v) { t.TOOL_VOID_INK.void_size = v; });
		makeSlider(h, "Opacity", 20, 100, t.TOOL_VOID_INK.void_opacity, function (v) { t.TOOL_VOID_INK.void_opacity = v; });
		makeSlider(h, "Smooth", 0, 100, t.TOOL_VOID_INK.void_smoothing, function (v) { t.TOOL_VOID_INK.void_smoothing = v; });
	});
	opt("TOOL_VOID_MARKER", function (h) {
		makeSlider(h, "Size", 8, 60, t.TOOL_VOID_MARKER.void_size, function (v) { t.TOOL_VOID_MARKER.void_size = v; });
		makeSlider(h, "Opacity", 8, 60, t.TOOL_VOID_MARKER.void_opacity, function (v) { t.TOOL_VOID_MARKER.void_opacity = v; });
		makeSlider(h, "Soft", 0, 100, t.TOOL_VOID_MARKER.void_soft, function (v) { t.TOOL_VOID_MARKER.void_soft = v; });
	});
	opt("TOOL_VOID_SMUDGE", function (h) {
		makeSlider(h, "Size", 6, 40, t.TOOL_VOID_SMUDGE.void_size, function (v) { t.TOOL_VOID_SMUDGE.void_size = v; });
		makeSlider(h, "Pull", 15, 100, t.TOOL_VOID_SMUDGE.void_strength, function (v) { t.TOOL_VOID_SMUDGE.void_strength = v; });
		makeSlider(h, "Soft", 0, 100, t.TOOL_VOID_SMUDGE.void_soft, function (v) { t.TOOL_VOID_SMUDGE.void_soft = v; });
	});
	opt("TOOL_VOID_NEON", function (h) {
		makeSlider(h, "Size", 2, 24, t.TOOL_VOID_NEON.void_size, function (v) { t.TOOL_VOID_NEON.void_size = v; });
		makeSlider(h, "Glow", 30, 100, t.TOOL_VOID_NEON.void_intensity, function (v) { t.TOOL_VOID_NEON.void_intensity = v; });
		makeSlider(h, "Core", 10, 100, t.TOOL_VOID_NEON.void_core, function (v) { t.TOOL_VOID_NEON.void_core = v; });
	});
	opt("TOOL_VOID_RAINBOW", function (h) {
		makeSlider(h, "Size", 2, 40, t.TOOL_VOID_RAINBOW.void_size, function (v) { t.TOOL_VOID_RAINBOW.void_size = v; });
		makeSlider(h, "Speed", 2, 40, t.TOOL_VOID_RAINBOW.void_speed, function (v) { t.TOOL_VOID_RAINBOW.void_speed = v; });
		makeSlider(h, "Sat", 40, 100, t.TOOL_VOID_RAINBOW.void_sat, function (v) { t.TOOL_VOID_RAINBOW.void_sat = v; });
	});
	opt("TOOL_VOID_STARS", function (h) {
		makeSlider(h, "Size", 6, 40, t.TOOL_VOID_STARS.void_size, function (v) { t.TOOL_VOID_STARS.void_size = v; });
		makeSlider(h, "Dense", 15, 100, t.TOOL_VOID_STARS.void_density, function (v) { t.TOOL_VOID_STARS.void_density = v; });
		makeSlider(h, "Jitter", 0, 100, t.TOOL_VOID_STARS.void_jitter, function (v) { t.TOOL_VOID_STARS.void_jitter = v; });
	});
	opt("TOOL_VOID_ARROW", function (h) {
		makeSlider(h, "Width", 1, 16, t.TOOL_VOID_ARROW.void_size, function (v) { t.TOOL_VOID_ARROW.void_size = v; });
		makeSlider(h, "Head", 20, 100, t.TOOL_VOID_ARROW.void_head, function (v) { t.TOOL_VOID_ARROW.void_head = v; });
	});
	opt("TOOL_VOID_DOTTED", function (h) {
		makeSlider(h, "Dot", 2, 20, t.TOOL_VOID_DOTTED.void_size, function (v) { t.TOOL_VOID_DOTTED.void_size = v; });
		makeSlider(h, "Gap", 2, 28, t.TOOL_VOID_DOTTED.void_gap, function (v) { t.TOOL_VOID_DOTTED.void_gap = v; });
		makeSlider(h, "Opacity", 20, 100, t.TOOL_VOID_DOTTED.void_opacity, function (v) { t.TOOL_VOID_DOTTED.void_opacity = v; });
	});
	opt("TOOL_VOID_NOISE", function (h) {
		makeSlider(h, "Radius", 8, 60, t.TOOL_VOID_NOISE.void_size, function (v) { t.TOOL_VOID_NOISE.void_size = v; });
		makeSlider(h, "Dense", 10, 100, t.TOOL_VOID_NOISE.void_density, function (v) { t.TOOL_VOID_NOISE.void_density = v; });
		makeSlider(h, "Opacity", 10, 100, t.TOOL_VOID_NOISE.void_opacity, function (v) { t.TOOL_VOID_NOISE.void_opacity = v; });
	});
	opt("TOOL_VOID_BLUR", function (h) {
		makeSlider(h, "Size", 8, 48, t.TOOL_VOID_BLUR.void_size, function (v) { t.TOOL_VOID_BLUR.void_size = v; });
		makeSlider(h, "Soft", 15, 100, t.TOOL_VOID_BLUR.void_strength, function (v) { t.TOOL_VOID_BLUR.void_strength = v; });
	});
	opt("TOOL_VOID_CALLIGRAPHY", function (h) {
		makeSlider(h, "Size", 4, 40, t.TOOL_VOID_CALLIGRAPHY.void_size, function (v) { t.TOOL_VOID_CALLIGRAPHY.void_size = v; });
		makeSlider(h, "Angle", 0, 180, t.TOOL_VOID_CALLIGRAPHY.void_angle, function (v) { t.TOOL_VOID_CALLIGRAPHY.void_angle = v; });
		makeSlider(h, "Thin", 5, 80, t.TOOL_VOID_CALLIGRAPHY.void_thin, function (v) { t.TOOL_VOID_CALLIGRAPHY.void_thin = v; });
		makeSlider(h, "Opacity", 20, 100, t.TOOL_VOID_CALLIGRAPHY.void_opacity, function (v) { t.TOOL_VOID_CALLIGRAPHY.void_opacity = v; });
	});
	opt("TOOL_VOID_MIRROR", function (h) {
		makeSlider(h, "Size", 2, 24, t.TOOL_VOID_MIRROR.void_size, function (v) { t.TOOL_VOID_MIRROR.void_size = v; });
		makeSlider(h, "Opacity", 20, 100, t.TOOL_VOID_MIRROR.void_opacity, function (v) { t.TOOL_VOID_MIRROR.void_opacity = v; });
		makeSlider(h, "Mode 1H 2V 3Both", 1, 3, t.TOOL_VOID_MIRROR.void_mode, function (v) { t.TOOL_VOID_MIRROR.void_mode = v; });
	});
	opt("TOOL_VOID_SKETCH", function (h) {
		makeSlider(h, "Size", 1, 8, t.TOOL_VOID_SKETCH.void_size, function (v) { t.TOOL_VOID_SKETCH.void_size = v; });
		makeSlider(h, "Layers", 1, 8, t.TOOL_VOID_SKETCH.void_layers, function (v) { t.TOOL_VOID_SKETCH.void_layers = v; });
		makeSlider(h, "Spread", 5, 80, t.TOOL_VOID_SKETCH.void_spread, function (v) { t.TOOL_VOID_SKETCH.void_spread = v; });
		makeSlider(h, "Opacity", 15, 100, t.TOOL_VOID_SKETCH.void_opacity, function (v) { t.TOOL_VOID_SKETCH.void_opacity = v; });
	});
	opt("TOOL_VOID_RIPPLE", function (h) {
		makeSlider(h, "Radius", 8, 60, t.TOOL_VOID_RIPPLE.void_size, function (v) { t.TOOL_VOID_RIPPLE.void_size = v; });
		makeSlider(h, "Rings", 1, 6, t.TOOL_VOID_RIPPLE.void_rings, function (v) { t.TOOL_VOID_RIPPLE.void_rings = v; });
		makeSlider(h, "Spacing", 15, 80, t.TOOL_VOID_RIPPLE.void_spacing, function (v) { t.TOOL_VOID_RIPPLE.void_spacing = v; });
		makeSlider(h, "Opacity", 10, 100, t.TOOL_VOID_RIPPLE.void_opacity, function (v) { t.TOOL_VOID_RIPPLE.void_opacity = v; });
	});
	opt("TOOL_VOID_CONFETTI", function (h) {
		makeSlider(h, "Size", 4, 24, t.TOOL_VOID_CONFETTI.void_size, function (v) { t.TOOL_VOID_CONFETTI.void_size = v; });
		makeSlider(h, "Dense", 15, 100, t.TOOL_VOID_CONFETTI.void_density, function (v) { t.TOOL_VOID_CONFETTI.void_density = v; });
		makeSlider(h, "Spread", 20, 120, t.TOOL_VOID_CONFETTI.void_spread, function (v) { t.TOOL_VOID_CONFETTI.void_spread = v; });
	});
	opt("TOOL_VOID_PIXELATE", function (h) {
		makeSlider(h, "Radius", 16, 80, t.TOOL_VOID_PIXELATE.void_size, function (v) { t.TOOL_VOID_PIXELATE.void_size = v; });
		makeSlider(h, "Block", 2, 20, t.TOOL_VOID_PIXELATE.void_block, function (v) { t.TOOL_VOID_PIXELATE.void_block = v; });
		makeSlider(h, "Strength", 20, 100, t.TOOL_VOID_PIXELATE.void_strength, function (v) { t.TOOL_VOID_PIXELATE.void_strength = v; });
	});
})();
