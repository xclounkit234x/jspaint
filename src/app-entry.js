// Boot: inject void tools, expose undoable, start app, THEN sessions
// sessions must not race app.js — otherwise $canvas_area is undefined
import { tools } from "./tools.js";
import { void_tools } from "./void-tools.js";
import { undoable } from "./functions.js";

window.__void_undoable = undoable;

for (const t of void_tools) {
	tools.push(t);
}

await import("./app.js");
// LocalSession / hash restore needs window.$canvas_area from app.js
await import("./sessions.js");
window.__xkpaint_app_ready = true;
window.dispatchEvent(new Event("xkpaint-ready"));
