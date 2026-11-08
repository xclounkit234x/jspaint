// Boot: inject void tools, expose undoable, then start app
import { tools } from "./tools.js";
import { void_tools } from "./void-tools.js";
import { undoable } from "./functions.js";

window.__void_undoable = undoable;

for (const t of void_tools) {
	tools.push(t);
}

await import("./app.js");
