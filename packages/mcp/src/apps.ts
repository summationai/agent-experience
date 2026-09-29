/**
 * A minimal MCP Apps view for AXE `display` (review item 14, 2026-09-24). EXPERIMENTAL.
 *
 * The installed MCP SDK (1.30.1) has no types for the Apps extension, so this module implements
 * the wire shape from the extension's specification (SEP-1865, "MCP Apps", stable version
 * 2026-01-26, read 2026-09-24 at github.com/modelcontextprotocol/ext-apps and
 * apps.extensions.modelcontextprotocol.io):
 *
 * - A host that renders Apps declares `capabilities.extensions["io.modelcontextprotocol/ui"]`
 *   with `mimeTypes` including `text/html;profile=mcp-app`. Servers SHOULD check it before
 *   offering UI; the bridge offers nothing to a host that did not declare it.
 * - A UI resource has a `ui://` URI and that MIME type, and is read with `resources/read`
 *   (`text`). A tool points at it with `_meta.ui.resourceUri`.
 * - The view is an iframe that speaks JSON-RPC over `postMessage`: it sends `ui/initialize`,
 *   then `ui/notifications/initialized`, and receives `ui/notifications/tool-result` with the
 *   tool's `CallToolResult`. The host's default CSP allows inline script and style and no
 *   network (`connect-src 'none'`, images from `'self'` and `data:` only).
 *
 * The view here is one static page for every `display` action. Each `ok` result of such an
 * action carries the `toHTML` rendering in `_meta["axe/presentation"].html`; the view parses it
 * with `DOMParser` (which runs no script), drops scripts, event-handler attributes, the affordance
 * buttons (they have no effect inside a host), and anything but the page's `<style>` and
 * `<main>`, and shows it. The text content stays the Markdown
 * rendering, which is what a host without Apps shows ([P-MCP-8]).
 */

export const APPS_EXTENSION = "io.modelcontextprotocol/ui";
export const APPS_MIME_TYPE = "text/html;profile=mcp-app";
export const PRESENTATION_URI = "ui://axe/presentation";
export const PRESENTATION_META_KEY = "axe/presentation";

/** Whether the connected host declared the Apps extension with the HTML view type. */
export function appsNegotiated(capabilities: unknown): boolean {
  const ext = (capabilities as { extensions?: Record<string, unknown> } | undefined)?.extensions;
  const ui = ext?.[APPS_EXTENSION] as { mimeTypes?: unknown } | undefined;
  return !!ui && Array.isArray(ui.mimeTypes) && ui.mimeTypes.includes(APPS_MIME_TYPE);
}

/** The resource as listed. */
export const PRESENTATION_RESOURCE = {
  uri: PRESENTATION_URI,
  name: "axe-presentation",
  title: "AXE result view",
  description:
    "Renders the result of an action that has display hints: the same comparison as the text result, as cards or a table.",
  mimeType: APPS_MIME_TYPE,
} as const;

// The view. Self-contained: no external script, style, font, or request. It reads only
// `_meta["axe/presentation"].html` (the SDK's escaped rendering) and the text content as a
// fallback, and it never evaluates anything from the result.
const VIEW_SCRIPT = `(function(){
var nextId=1,pending={},hostCaps={};
var root=document.getElementById("axe-root");
function post(m){window.parent.postMessage(m,"*")}
function request(method,params){var id=nextId++;post({jsonrpc:"2.0",id:id,method:method,params:params});return new Promise(function(res,rej){pending[id]={res:res,rej:rej}})}
function textOf(result){var c=(result&&result.content)||[];var out=[];for(var i=0;i<c.length;i++){if(c[i]&&c[i].type==="text")out.push(String(c[i].text||""))}return out.join("\\n")}
function clean(node){var all=node.querySelectorAll("*");for(var i=0;i<all.length;i++){var el=all[i];var names=[];for(var j=0;j<el.attributes.length;j++){var n=el.attributes[j].name;if(/^on/i.test(n)||n==="srcdoc")names.push(n)}for(var k=0;k<names.length;k++)el.removeAttribute(names[k]);var href=el.getAttribute("href");if(href&&!/^https?:/i.test(href))el.removeAttribute("href");var src=el.getAttribute("src");if(src&&!/^https?:/i.test(src))el.removeAttribute("src")}}
function render(result){var meta=result&&result._meta&&result._meta["${PRESENTATION_META_KEY}"];var html=meta&&typeof meta.html==="string"?meta.html:null;if(!html){var pre=document.createElement("pre");pre.textContent=textOf(result)||"No result.";root.replaceChildren(pre);return}
var doc=new DOMParser().parseFromString(html,"text/html");var dead=doc.querySelectorAll("script,iframe,object,embed,form,link,meta,base,.axe-actions");for(var i=0;i<dead.length;i++)dead[i].remove();
var main=doc.querySelector("main");if(!main){root.textContent=textOf(result);return}clean(main);
var styles=doc.querySelectorAll("style");var head=document.head;var old=head.querySelectorAll("style[data-axe]");for(var s=0;s<old.length;s++)old[s].remove();for(var t=0;t<styles.length;t++){var st=document.createElement("style");st.setAttribute("data-axe","");st.textContent=styles[t].textContent;head.appendChild(st)}
root.replaceChildren(document.importNode(main,true))}
window.addEventListener("message",function(e){if(e.source!==window.parent)return;var m=e.data;if(!m||m.jsonrpc!=="2.0")return;
if(m.id!=null&&pending[m.id]&&(("result" in m)||("error" in m))){var p=pending[m.id];delete pending[m.id];if("error" in m)p.rej(m.error);else p.res(m.result);return}
if(m.method==="ui/notifications/tool-result")render(m.params||{})});
document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a||!hostCaps.openLinks)return;e.preventDefault();request("ui/open-link",{url:a.href}).catch(function(){})});
request("ui/initialize",{protocolVersion:"2026-01-26",appCapabilities:{},clientInfo:{name:"axe-presentation",version:"0.1.0"}}).then(function(r){hostCaps=(r&&r.hostCapabilities)||{};post({jsonrpc:"2.0",method:"ui/notifications/initialized",params:{}})},function(){})
})();`;

export const PRESENTATION_VIEW_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Result</title>
<style>body{margin:0;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}#axe-root>pre{white-space:pre-wrap;padding:16px;margin:0}</style>
</head>
<body>
<div id="axe-root"><p style="padding:16px;margin:0">Waiting for the result.</p></div>
<script>${VIEW_SCRIPT}</script>
</body>
</html>
`;
