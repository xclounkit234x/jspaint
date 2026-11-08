// @ts-nocheck
/* global stroke_color, brush_size, stroke_size */
function parseRGB(color) {
	try {
		const c = document.createElement("canvas");
		const ctx = c.getContext("2d");
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, 1, 1);
		const d = ctx.getImageData(0, 0, 1, 1).data;
		return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
	} catch (_) { return { r: 0, g: 0, b: 0, a: 1 }; }
}
function touchHelper() {
	try { if (typeof window.$G !== "undefined") window.$G.triggerHandler("redraw-helper-layer"); } catch (_) {}
}
export const void_tools = [
	{ id: "TOOL_VOID_SOFT_BRUSH", name: "Soft Brush", description: "Soft edged brush with smooth falloff.", cursor: ["precise-dotted", [16, 16], "crosshair"], continuous: "space",
		paint(ctx, x, y) { const r = Math.max(2, (typeof brush_size !== "undefined" ? brush_size : 4) * 1.5); const g = ctx.createRadialGradient(x, y, 0, x, y, r); const c = parseRGB(stroke_color); g.addColorStop(0, "rgba("+c.r+","+c.g+","+c.b+","+(0.45*c.a)+")"); g.addColorStop(0.55, "rgba("+c.r+","+c.g+","+c.b+","+(0.15*c.a)+")"); g.addColorStop(1, "rgba("+c.r+","+c.g+","+c.b+",0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); touchHelper(); } },
	{ id: "TOOL_VOID_SMUDGE", name: "Smudge", description: "Smudges existing paint.", cursor: ["precise-dotted", [16, 16], "crosshair"], continuous: "space",
		paint(ctx, x, y) { const r = Math.max(2, Math.ceil(typeof brush_size !== "undefined" ? brush_size : 4)); try { const size = r * 2; const img = ctx.getImageData(Math.floor(x - r), Math.floor(y - r), size, size); const out = ctx.createImageData(size, size); const d = img.data, o = out.data; for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) { const dx = px - r, dy = py - r; if (dx*dx+dy*dy > r*r) continue; const sx = Math.min(size-1, Math.max(0, Math.floor(px - dx*0.15))); const sy = Math.min(size-1, Math.max(0, Math.floor(py - dy*0.15))); const si = (sy*size+sx)*4, oi = (py*size+px)*4; o[oi]=d[si]; o[oi+1]=d[si+1]; o[oi+2]=d[si+2]; o[oi+3]=Math.min(255,d[si+3]*0.85); } ctx.putImageData(out, Math.floor(x - r), Math.floor(y - r)); } catch(_){} touchHelper(); } },
	{ id: "TOOL_VOID_NEON", name: "Neon Glow", description: "Glowing neon strokes.", cursor: ["precise-dotted", [16, 16], "crosshair"], continuous: "space",
		paint(ctx, x, y) { const r = Math.max(2, (typeof stroke_size !== "undefined" ? stroke_size : brush_size) || 4); const c = parseRGB(stroke_color); ctx.save(); ctx.globalCompositeOperation = "lighter"; [[r*3,0.08],[r*2,0.15],[r,0.35],[r*0.4,0.7]].forEach(function(p){ ctx.beginPath(); ctx.fillStyle="rgba("+c.r+","+c.g+","+c.b+","+p[1]+")"; ctx.arc(x,y,p[0],0,Math.PI*2); ctx.fill(); }); ctx.restore(); touchHelper(); } },
	{ id: "TOOL_VOID_RAINBOW", name: "Rainbow", description: "Cycles hue as you draw.", cursor: ["precise-dotted", [16, 16], "crosshair"], continuous: "space", _hue: 0,
		paint(ctx, x, y) { this._hue = (this._hue + 8) % 360; const r = Math.max(1, typeof brush_size !== "undefined" ? brush_size : 4); ctx.fillStyle = "hsl("+this._hue+" 90% 55%)"; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); touchHelper(); } },
	{ id: "TOOL_VOID_STARS", name: "Stars", description: "Stamps stars along the stroke.", cursor: ["precise-dotted", [16, 16], "crosshair"], continuous: "space",
		paint(ctx, x, y) { if (Math.random() > 0.35) return; const r = Math.max(3, (typeof brush_size !== "undefined" ? brush_size : 4) * 1.2); ctx.fillStyle = stroke_color; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = (i * 4 * Math.PI) / 5 - Math.PI / 2; const rr = i % 2 === 0 ? r : r * 0.4; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.fill(); touchHelper(); } },
	{ id: "TOOL_VOID_ARROW", name: "Arrow", description: "Drag to draw an arrow.", cursor: ["precise", [16, 16], "crosshair"], stroke_only: true,
		shape(ctx, x, y, w, h) { const x2 = x + w, y2 = y + h, ang = Math.atan2(h, w), len = Math.hypot(w, h) || 1, head = Math.min(20, len * 0.35); ctx.strokeStyle = stroke_color; ctx.fillStyle = stroke_color; ctx.lineWidth = Math.max(1, typeof stroke_size !== "undefined" ? stroke_size : 1); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - head * Math.cos(ang - 0.4), y2 - head * Math.sin(ang - 0.4)); ctx.lineTo(x2 - head * Math.cos(ang + 0.4), y2 - head * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill(); } },
	{ id: "TOOL_VOID_DOTTED", name: "Dotted Line", description: "Dotted freehand line.", cursor: ["precise-dotted", [16, 16], "crosshair"], continuous: "space", _step: 0,
		paint(ctx, x, y) { this._step = (this._step + 1) % 4; if (this._step !== 0) return; const r = Math.max(1, Math.ceil((typeof stroke_size !== "undefined" ? stroke_size : 2) / 2)); ctx.fillStyle = stroke_color; ctx.fillRect(Math.floor(x - r), Math.floor(y - r), r * 2, r * 2); touchHelper(); } },
	{ id: "TOOL_VOID_NOISE", name: "Noise", description: "Textured noise spray.", cursor: ["airbrush", [7, 22], "crosshair"], continuous: "time",
		paint(ctx, x, y) { const r = Math.max(4, (typeof brush_size !== "undefined" ? brush_size : 4) * 2); const c = parseRGB(stroke_color); for (let i = 0; i < 40; i++) { const rx = (Math.random()*2-1)*r, ry = (Math.random()*2-1)*r; if (rx*rx+ry*ry > r*r) continue; ctx.fillStyle = "rgba("+c.r+","+c.g+","+c.b+","+(0.15+Math.random()*0.5)+")"; ctx.fillRect(Math.floor(x+rx), Math.floor(y+ry), 1, 1); } touchHelper(); } },
	{ id: "TOOL_VOID_BLUR", name: "Blur", description: "Softens under the cursor.", cursor: ["precise-dotted", [16, 16], "crosshair"], continuous: "space",
		paint(ctx, x, y) { const r = Math.max(3, Math.ceil((typeof brush_size !== "undefined" ? brush_size : 4) * 1.5)); try { const size = r * 2, sx = Math.floor(x - r), sy = Math.floor(y - r); const img = ctx.getImageData(sx, sy, size, size); const src = new Uint8ClampedArray(img.data), d = img.data, k = 1/9; for (let py = 1; py < size-1; py++) for (let px = 1; px < size-1; px++) { const dx = px - r, dy = py - r; if (dx*dx+dy*dy > r*r) continue; let rr=0,gg=0,bb=0,aa=0; for (let oy=-1;oy<=1;oy++) for (let ox=-1;ox<=1;ox++) { const i=((py+oy)*size+(px+ox))*4; rr+=src[i]; gg+=src[i+1]; bb+=src[i+2]; aa+=src[i+3]; } const oi=(py*size+px)*4; d[oi]=rr*k; d[oi+1]=gg*k; d[oi+2]=bb*k; d[oi+3]=aa*k; } ctx.putImageData(img, sx, sy); } catch(_){} touchHelper(); } },
	{ id: "TOOL_VOID_CALLIGRAPHY", name: "Calligraphy", description: "Angled calligraphy stroke.", cursor: ["precise-dotted", [16, 16], "crosshair"], continuous: "space", _lx: null, _ly: null,
		pointerdown() { this._lx = this._ly = null; },
		paint(ctx, x, y) { const prevX = this._lx, prevY = this._ly; this._lx = x; this._ly = y; if (prevX == null) return; const dx = x - prevX, dy = y - prevY, dist = Math.hypot(dx, dy) || 1, angle = Math.atan2(dy, dx) + Math.PI / 4, bs = typeof brush_size !== "undefined" ? brush_size : 4, thick = Math.max(1, bs * (0.4 + Math.min(2, dist / 8))); ctx.strokeStyle = stroke_color; ctx.lineWidth = thick; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(prevX + Math.cos(angle) * thick * 0.3, prevY + Math.sin(angle) * thick * 0.3); ctx.lineTo(x + Math.cos(angle) * thick * 0.3, y + Math.sin(angle) * thick * 0.3); ctx.stroke(); touchHelper(); } },
];
