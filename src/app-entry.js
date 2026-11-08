// Boot entry: inject Void tools, then start the app
import { tools } from "./tools.js";
import { void_tools } from "./void-tools.js";

for (const t of void_tools) {
	tools.push(t);
}

await import("./app.js");
