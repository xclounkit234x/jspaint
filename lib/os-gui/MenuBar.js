((exports) => {

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName
 * @param {Record<string, string>} [attrs]
 * @returns {HTMLElementTagNameMap[K]}
 */
function E(tagName, attrs) {
	const el = document.createElement(tagName);
	if (attrs) {
		for (const key in attrs) {
			if (key === "class") {
				el.className = attrs[key];
			} else {
				el.setAttribute(key, attrs[key]);
			}
		}
	}
	return el;
}

// TEMPORARY MINIMAL STUB - will be replaced
// If you see this, full restore failed
console.error("MenuBar stub loaded - full file restore needed");
function MenuBar(menus) {
	this.element = E("div", { class: "menus" });
	this.closeMenus = function(){};
	this.setKeyboardScope = function(){};
}
const AccessKeys = { escape: s=>s, unescape: s=>s, indexOf: ()=>-1, has: ()=>false, get: ()=>null, remove: s=>s, toText: s=>s, toHTML: s=>s, toFragment: s=>{const f=document.createDocumentFragment(); f.append(document.createTextNode(s)); return f;} };
const MENU_DIVIDER = "MENU_DIVIDER";
exports.MenuBar = MenuBar;
exports.AccessKeys = AccessKeys;
exports.MENU_DIVIDER = MENU_DIVIDER;

})(typeof module !== "undefined" ? module.exports : window);
