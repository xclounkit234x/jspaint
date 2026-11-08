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
  try { if (typeof window.__void_undoable === "function") window.__void_undoable({ name }, function () {}); } catch (_) {}
}
function eachSegment(x0, y0, x1, y1, step, fn) {
  const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy);
  if (dist < 0.001) { fn(x1, y1); return; }
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i <= n; i++) { const t = i / n; fn(x0 + dx * t, y0 + dy * t); }
}
function lastPoint(tool, x, y) {
  const lx = tool._lx, ly = tool._ly; tool._lx = x; tool._ly = y;
  if (lx == null || ly == null) return { x, y };
  return { x: lx, y: ly };
}
function makeSlider(host, label, min, max, value, onChange) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;gap:2px;font-size:10px;width:100%;color:#cfe0ff;";
  const lab = document.createElement("label"); lab.textContent = label;
  const input = document.createElement("input");
  input.type = "range"; input.min = String(min); input.max = String(max); input.value = String(value);
  input.style.width = "100%";
  input.addEventListener("input", () => onChange(+input.value));
  wrap.appendChild(lab); wrap.appendChild(input); host.append(wrap);
}
function makeOptions(tool, builders) {
  const host = document.createElement("div");
  host.className = "void-tool-options";
  host.style.cssText = "display:flex;flex-direction:column;gap:6px;padding:2px;min-width:40px;";
  builders(host, tool);
  if (typeof window.$ === "function") return window.$(host);
  return Object.assign([host], { appendTo() { return this; }, trigger() { return this; }, length: 1 });
}

export const void_tools = [
  {
    id: "TOOL_VOID_SOFT_BRUSH", name: "Soft Brush",
    description: "Soft anti-aliased brush with hardness control.",
    cursor: ["precise-dotted", [16, 16], "crosshair"],
    void_size: 12, void_hard: 40, _lx: null, _ly: null,
    pointerdown() { this._lx = this._ly = null; },
    paint(ctx, x, y) {
      const prev = lastPoint(this, x, y);
      const size = this.void_size || 12, hard = (this.void_hard || 40) / 100, c = parseRGB(stroke_color);
      eachSegment(prev.x, prev.y, x, y, Math.max(1, size * 0.25), (px, py) => {
        const r = size / 2;
        const g = ctx.createRadialGradient(px, py, r * hard, px, py, r);
        g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.55 * c.a})`);
        g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      });
    },
    pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null,
  },
  {
    id: "TOOL_VOID_SMUDGE", name: "Smudge",
    description: "Smudges paint along your stroke.",
    cursor: ["precise-dotted", [16, 16], "crosshair"],
    void_size: 10, void_strength: 50, _lx: null, _ly: null,
    pointerdown() { this._lx = this._ly = null; },
    paint(ctx, x, y) {
      const prev = lastPoint(this, x, y);
      const r = Math.max(2, Math.round((this.void_size || 10) / 2));
      const strength = (this.void_strength || 50) / 100;
      const dx = x - prev.x, dy = y - prev.y;
      eachSegment(prev.x, prev.y, x, y, Math.max(1, r * 0.5), (px, py) => {
        const sx = Math.round(px - r), sy = Math.round(py - r), size = r * 2;
        if (sx < 0 || sy < 0 || sx + size > ctx.canvas.width || sy + size > ctx.canvas.height) return;
        try {
          const img = ctx.getImageData(sx, sy, size, size);
          const d = img.data, ox = Math.round(-dx * strength), oy = Math.round(-dy * strength);
          const copy = new Uint8ClampedArray(d);
          for (let iy = 0; iy < size; iy++) for (let ix = 0; ix < size; ix++) {
            const cx = ix - r, cy = iy - r;
            if (cx * cx + cy * cy > r * r) continue;
            const srcX = Math.min(size - 1, Math.max(0, ix + ox));
            const srcY = Math.min(size - 1, Math.max(0, iy + oy));
            const si = (srcY * size + srcX) * 4, di = (iy * size + ix) * 4, mix = 0.65;
            d[di] = copy[si] * mix + d[di] * (1 - mix);
            d[di + 1] = copy[si + 1] * mix + d[di + 1] * (1 - mix);
            d[di + 2] = copy[si + 2] * mix + d[di + 2] * (1 - mix);
          }
          ctx.putImageData(img, sx, sy);
        } catch (_) {}
      });
    },
    pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null,
  },
  {
    id: "TOOL_VOID_NEON", name: "Neon Glow",
    description: "Bright neon glow stroke.",
    cursor: ["precise-dotted", [16, 16], "crosshair"],
    void_size: 8, void_intensity: 70, _lx: null, _ly: null,
    pointerdown() { this._lx = this._ly = null; },
    paint(ctx, x, y) {
      const prev = lastPoint(this, x, y);
      const size = this.void_size || 8, intensity = (this.void_intensity || 70) / 100;
      const c = parseRGB(stroke_color);
      const r = Math.max(c.r, 40), g = Math.max(c.g, 40), b = Math.max(c.b, 40);
      ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
      [[size * 3.5, 0.12 * intensity], [size * 2.2, 0.2 * intensity], [size * 1.3, 0.35 * intensity], [size * 0.7, 0.65 * intensity]].forEach(([w, a]) => {
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(x, y); ctx.stroke();
      });
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * intensity})`; ctx.lineWidth = Math.max(1, size * 0.22);
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(x, y); ctx.stroke();
      ctx.restore();
    },
    pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null,
  },
  {
    id: "TOOL_VOID_RAINBOW", name: "Rainbow",
    description: "Continuous rainbow trail.",
    cursor: ["precise-dotted", [16, 16], "crosshair"],
    void_size: 10, void_speed: 12, _hue: 0, _lx: null, _ly: null,
    pointerdown() { this._lx = this._ly = null; },
    paint(ctx, x, y) {
      const prev = lastPoint(this, x, y);
      const size = this.void_size || 10, speed = this.void_speed || 12;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = size;
      const dx = x - prev.x, dy = y - prev.y, dist = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(dist / 1.5));
      for (let i = 1; i <= steps; i++) {
        const t0 = (i - 1) / steps, t1 = i / steps;
        this._hue = (this._hue + speed * (t1 - t0) * 12) % 360;
        ctx.strokeStyle = `hsl(${this._hue} 95% 55%)`;
        ctx.beginPath();
        ctx.moveTo(prev.x + dx * t0, prev.y + dy * t0);
        ctx.lineTo(prev.x + dx * t1, prev.y + dy * t1);
        ctx.stroke();
      }
    },
    pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null,
  },
  {
    id: "TOOL_VOID_STARS", name: "Stars",
    description: "Stamp stars along the stroke.",
    cursor: ["precise-dotted", [16, 16], "crosshair"],
    void_size: 14, void_density: 50, _lx: null, _ly: null,
    pointerdown() { this._lx = this._ly = null; },
    paint(ctx, x, y) {
      const prev = lastPoint(this, x, y);
      const size = this.void_size || 14, density = (this.void_density || 50) / 100;
      const star = (px, py, r) => {
        ctx.fillStyle = stroke_color; ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 === 0 ? r : r * 0.4;
          const sx = px + Math.cos(a) * rr, sy = py + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.closePath(); ctx.fill();
      };
      eachSegment(prev.x, prev.y, x, y, Math.max(4, size * 0.8), (px, py) => {
        if (Math.random() < density) star(px, py, size / 2 * (0.6 + Math.random() * 0.5));
      });
    },
    pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null,
  },
  {
    id: "TOOL_VOID_ARROW", name: "Arrow",
    description: "Drag to draw an arrow.",
    cursor: ["precise", [16, 16], "crosshair"],
    void_size: 3, _snap: null,
    pointerdown(ctx) {
      try { this._snap = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height); }
      catch (_) { this._snap = null; }
    },
    paint(ctx, x, y) {
      if (this._snap) { try { ctx.putImageData(this._snap, 0, 0); } catch (_) {} }
      if (typeof pointer_start === "undefined" || !pointer_start) return;
      const x0 = pointer_start.x, y0 = pointer_start.y;
      const x1 = (typeof pointer !== "undefined" && pointer) ? pointer.x : x;
      const y1 = (typeof pointer !== "undefined" && pointer) ? pointer.y : y;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const head = Math.min(28, Math.max(10, len * 0.28)), lw = this.void_size || 3;
      ctx.strokeStyle = stroke_color; ctx.fillStyle = stroke_color;
      ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
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
    void_size: 6, void_gap: 8, _lx: null, _ly: null, _carry: 0,
    pointerdown() { this._lx = this._ly = null; this._carry = 0; },
    paint(ctx, x, y) {
      const prev = lastPoint(this, x, y);
      const size = this.void_size || 6, gap = this.void_gap || 8, period = size + gap;
      const dx = x - prev.x, dy = y - prev.y, dist = Math.hypot(dx, dy);
      if (dist < 0.01) return;
      ctx.fillStyle = stroke_color;
      let d = this._carry; const ux = dx / dist, uy = dy / dist;
      while (d < dist) {
        if ((d % period) < size) {
          const px = prev.x + ux * d, py = prev.y + uy * d;
          ctx.beginPath(); ctx.arc(px, py, size / 2, 0, Math.PI * 2); ctx.fill();
        }
        d += 1;
      }
      this._carry = (this._carry + dist) % period;
    },
    pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null,
  },
  {
    id: "TOOL_VOID_NOISE", name: "Noise",
    description: "Textured noise spray.",
    cursor: ["airbrush", [7, 22], "crosshair"],
    void_size: 20, void_density: 60, paint_on_time_interval: 16,
    pointerdown() {},
    paint(ctx, x, y) {
      const r = (this.void_size || 20) / 2;
      const density = Math.round(((this.void_density || 60) / 100) * 80);
      const c = parseRGB(stroke_color);
      for (let i = 0; i < density; i++) {
        const rx = (Math.random() * 2 - 1) * r, ry = (Math.random() * 2 - 1) * r;
        if (rx * rx + ry * ry > r * r) continue;
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.2 + Math.random() * 0.6})`;
        ctx.fillRect(Math.floor(x + rx), Math.floor(y + ry), 1, 1);
      }
    },
    pointerup() { snapUndo(this.name); }, $options: null,
  },
  {
    id: "TOOL_VOID_BLUR", name: "Blur",
    description: "Softens the image under the cursor.",
    cursor: ["precise-dotted", [16, 16], "crosshair"],
    void_size: 16, void_strength: 40, _lx: null, _ly: null,
    pointerdown() { this._lx = this._ly = null; },
    paint(ctx, x, y) {
      const prev = lastPoint(this, x, y);
      const r = Math.max(3, Math.round((this.void_size || 16) / 2));
      const strength = (this.void_strength || 40) / 100;
      eachSegment(prev.x, prev.y, x, y, Math.max(1, r * 0.4), (px, py) => {
        const sx = Math.round(px - r), sy = Math.round(py - r), size = r * 2;
        if (sx < 0 || sy < 0 || sx + size > ctx.canvas.width || sy + size > ctx.canvas.height) return;
        try {
          const img = ctx.getImageData(sx, sy, size, size);
          const src = new Uint8ClampedArray(img.data), d = img.data;
          const passes = strength > 0.6 ? 2 : 1;
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
      });
    },
    pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null,
  },
  {
    id: "TOOL_VOID_CALLIGRAPHY", name: "Calligraphy",
    description: "Flat angled calligraphy pen.",
    cursor: ["precise-dotted", [16, 16], "crosshair"],
    void_size: 12, void_angle: 45, _lx: null, _ly: null,
    pointerdown() { this._lx = this._ly = null; },
    paint(ctx, x, y) {
      const prev = lastPoint(this, x, y);
      const size = this.void_size || 12;
      const angle = ((this.void_angle || 45) * Math.PI) / 180;
      const dx = x - prev.x, dy = y - prev.y, dist = Math.hypot(dx, dy);
      ctx.strokeStyle = stroke_color; ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.5, size * 0.18);
      const steps = Math.max(1, Math.ceil(dist / 1.2));
      const half = size / 2, ox = Math.cos(angle) * half, oy = Math.sin(angle) * half;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, px = prev.x + dx * t, py = prev.y + dy * t;
        ctx.beginPath(); ctx.moveTo(px - ox, py - oy); ctx.lineTo(px + ox, py + oy); ctx.stroke();
      }
    },
    pointerup() { snapUndo(this.name); this._lx = this._ly = null; }, $options: null,
  },
];

(function attachOptions() {
  const byId = {};
  void_tools.forEach((t) => { byId[t.id] = t; });
  byId.TOOL_VOID_SOFT_BRUSH.$options = makeOptions(byId.TOOL_VOID_SOFT_BRUSH, (host, tool) => {
    makeSlider(host, "Size", 2, 60, tool.void_size, (v) => { tool.void_size = v; });
    makeSlider(host, "Hard", 0, 100, tool.void_hard, (v) => { tool.void_hard = v; });
  });
  byId.TOOL_VOID_SMUDGE.$options = makeOptions(byId.TOOL_VOID_SMUDGE, (host, tool) => {
    makeSlider(host, "Size", 4, 40, tool.void_size, (v) => { tool.void_size = v; });
    makeSlider(host, "Pull", 10, 100, tool.void_strength, (v) => { tool.void_strength = v; });
  });
  byId.TOOL_VOID_NEON.$options = makeOptions(byId.TOOL_VOID_NEON, (host, tool) => {
    makeSlider(host, "Size", 2, 30, tool.void_size, (v) => { tool.void_size = v; });
    makeSlider(host, "Glow", 20, 100, tool.void_intensity, (v) => { tool.void_intensity = v; });
  });
  byId.TOOL_VOID_RAINBOW.$options = makeOptions(byId.TOOL_VOID_RAINBOW, (host, tool) => {
    makeSlider(host, "Size", 2, 40, tool.void_size, (v) => { tool.void_size = v; });
    makeSlider(host, "Speed", 2, 40, tool.void_speed, (v) => { tool.void_speed = v; });
  });
  byId.TOOL_VOID_STARS.$options = makeOptions(byId.TOOL_VOID_STARS, (host, tool) => {
    makeSlider(host, "Size", 6, 40, tool.void_size, (v) => { tool.void_size = v; });
    makeSlider(host, "Dense", 10, 100, tool.void_density, (v) => { tool.void_density = v; });
  });
  byId.TOOL_VOID_ARROW.$options = makeOptions(byId.TOOL_VOID_ARROW, (host, tool) => {
    makeSlider(host, "Width", 1, 20, tool.void_size, (v) => { tool.void_size = v; });
  });
  byId.TOOL_VOID_DOTTED.$options = makeOptions(byId.TOOL_VOID_DOTTED, (host, tool) => {
    makeSlider(host, "Dot", 2, 20, tool.void_size, (v) => { tool.void_size = v; });
    makeSlider(host, "Gap", 2, 30, tool.void_gap, (v) => { tool.void_gap = v; });
  });
  byId.TOOL_VOID_NOISE.$options = makeOptions(byId.TOOL_VOID_NOISE, (host, tool) => {
    makeSlider(host, "Radius", 6, 50, tool.void_size, (v) => { tool.void_size = v; });
    makeSlider(host, "Dense", 10, 100, tool.void_density, (v) => { tool.void_density = v; });
  });
  byId.TOOL_VOID_BLUR.$options = makeOptions(byId.TOOL_VOID_BLUR, (host, tool) => {
    makeSlider(host, "Size", 6, 40, tool.void_size, (v) => { tool.void_size = v; });
    makeSlider(host, "Soft", 10, 100, tool.void_strength, (v) => { tool.void_strength = v; });
  });
  byId.TOOL_VOID_CALLIGRAPHY.$options = makeOptions(byId.TOOL_VOID_CALLIGRAPHY, (host, tool) => {
    makeSlider(host, "Size", 4, 40, tool.void_size, (v) => { tool.void_size = v; });
    makeSlider(host, "Angle", 0, 180, tool.void_angle, (v) => { tool.void_angle = v; });
  });
})();
