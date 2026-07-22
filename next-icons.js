/* ===================================================================
   ClimPilot Next — Remplacement des emojis par des icônes fines (SVG)
   2026-07-20. 100 % additif et cosmétique : ne touche jamais aux champs
   de saisie ni à la logique. Emoji connu -> icône trait monochrome ;
   emoji inconnu -> rendu en niveaux de gris discret. Retirable (supprimer
   la balise <script>). Tout est protégé par try/catch.
   =================================================================== */
(function () {
  "use strict";
  var S = '<svg viewBox="0 0 24 24">';

  // Emoji (sans sélecteur de variante) -> intérieur du SVG (trait = currentColor)
  var MAP = {
    "📊": S + '<path d="M3 3v18h18"/><path d="M7 17v-6M12 17V8M17 17v-3"/></svg>',
    "📈": S + '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
    "📉": S + '<path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/></svg>',
    "📝": S + '<path d="M6 3h9l4 4v14H6z"/><path d="M9 8h4M9 12h7M9 16h7"/></svg>',
    "📐": S + '<path d="M5 3v18h16M5 21L21 5M9 21v-3M13 21v-6"/></svg>',
    "📅": S + '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
    "📋": S + '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8 11h8M8 15h5"/></svg>',
    "📨": S + '<path d="M22 3L11 14M22 3l-7 19-4-8-8-4z"/></svg>',
    "✈": S + '<path d="M21 3L3 10l6 3 3 6z"/></svg>',
    "✅": S + '<path d="M4 12l5 5L20 6"/></svg>',
    "✔": S + '<path d="M4 12l5 5L20 6"/></svg>',
    "☑": S + '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
    "🗂": S + '<path d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
    "🗃": S + '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M10 13h4"/></svg>',
    "📁": S + '<path d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
    "🔧": S + '<path d="M15 6a4 4 0 00-5 5l-7 7 2 2 7-7a4 4 0 005-5l-2.5 2.5-2-2z"/></svg>',
    "🛠": S + '<path d="M4 20l6-6M14 4l6 6-3 3-6-6zM7 7l3 3"/></svg>',
    "🔩": S + '<circle cx="9" cy="9" r="4"/><path d="M12 12l7 7-2 2-7-7"/></svg>',
    "💨": S + '<path d="M3 8h11a3 3 0 100-6M3 14h15a3 3 0 110 6M3 11h9"/></svg>',
    "🌬": S + '<path d="M3 8h11a3 3 0 100-6M3 14h15a3 3 0 110 6M3 11h9"/></svg>',
    "❄": S + '<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/></svg>',
    "🧊": S + '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',
    "📄": S + '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 16h4"/></svg>',
    "📃": S + '<path d="M6 3h8l4 4v14H6z"/><path d="M9 12h6M9 15h6"/></svg>',
    "📦": S + '<path d="M3 8l9-5 9 5-9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
    "💶": S + '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M14 9a3 3 0 100 6M7 11h5M7 13h4"/></svg>',
    "💰": S + '<circle cx="12" cy="14" r="6"/><path d="M12 10v8M10 12h3a1.5 1.5 0 010 3h-3M9 6l3-2 3 2"/></svg>',
    "🏦": S + '<path d="M3 9l9-5 9 5M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M3 21h18"/></svg>',
    "🤝": S + '<path d="M3 10l4-3 5 3 5-3 4 3M7 13l3 3 2-1M17 13l-3 3M3 10v4l4 4M21 10v4l-4 4"/></svg>',
    "🧪": S + '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M7 16h10"/></svg>',
    "👥": S + '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 5.5a3 3 0 010 5.8M21 20a6 6 0 00-3-4.6"/></svg>',
    "👤": S + '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0114 0"/></svg>',
    "🏷": S + '<path d="M3 12l8.5-8.5a2 2 0 012.8 0l6.2 6.2a2 2 0 010 2.8L12 21z"/><circle cx="8.5" cy="8.5" r="1.3"/></svg>',
    "⚙": S + '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>',
    "🎯": S + '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>',
    "🏆": S + '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4.5M16 6h3a3 3 0 01-3 4.5M10 15h4M9 20h6M12 15v3"/></svg>',
    "🕓": S + '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    "⏱": S + '<circle cx="12" cy="13" r="7"/><path d="M12 9v4M9 3h6"/></svg>',
    "⌛": S + '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/></svg>',
    "⏳": S + '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/></svg>',
    "🧰": S + '<rect x="3" y="8" width="18" height="11" rx="2"/><path d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18M10 13v2h4v-2"/></svg>',
    "🪖": S + '<path d="M4 17a8 8 0 0116 0M9 17V9a3 3 0 016 0v8M3 17h18"/></svg>',
    "🖥": S + '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/></svg>',
    "💻": S + '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 20h20"/></svg>',
    "🧮": S + '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/></svg>',
    "🧾": S + '<path d="M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1zM9 8h6M9 12h6M9 16h4"/></svg>',
    "💾": S + '<path d="M5 3h11l3 3v15H5zM8 3v5h7V3M8 14h8v7H8z"/></svg>',
    "🖨": S + '<path d="M7 8V3h10v5M7 18H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z"/></svg>',
    "✉": S + '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    "📧": S + '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    "📞": S + '<path d="M5 4h3l2 5-2 1a10 10 0 005 5l1-2 5 2v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/></svg>',
    "➕": S + '<path d="M12 5v14M5 12h14"/></svg>',
    "💡": S + '<path d="M9 18h6M10 21h4M8 11a4 4 0 118 0c0 2-2 3-2 5h-4c0-2-2-3-2-5z"/></svg>',
    "⚠": S + '<path d="M12 3l9 16H3zM12 10v4M12 17h.01"/></svg>',
    "📚": S + '<path d="M4 5h5v14H4zM9 5h5v14H9zM14 6l4 1-2 13-4-1"/></svg>',
    "📗": S + '<path d="M6 4h13v16H6a2 2 0 01-2-2V6a2 2 0 012-2zM6 16h13"/></svg>',
    "📖": S + '<path d="M12 6C10 4 6 4 3 5v13c3-1 7-1 9 1 2-2 6-2 9-1V5c-3-1-7-1-9 1zM12 6v13"/></svg>',
    "☁": S + '<path d="M7 18a4 4 0 010-8 5 5 0 019-2 4 4 0 011 8z"/></svg>',
    "🗑": S + '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
    "✏": S + '<path d="M4 20l4-1L20 7l-3-3L5 16zM14 6l3 3"/></svg>',
    "🖊": S + '<path d="M4 20l4-1L20 7l-3-3L5 16zM14 6l3 3"/></svg>',
    "🔎": S + '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>',
    "🔍": S + '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>',
    "🔐": S + '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
    "🔒": S + '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
    "🚚": S + '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-3M6.5 18a2 2 0 100-4 2 2 0 000 4M17.5 18a2 2 0 100-4 2 2 0 000 4"/></svg>',
    "🚀": S + '<path d="M5 15c-1 3-1 4-1 4s1 0 4-1M14 4c3 0 6 3 6 6l-8 8-4-4zM9 15l-1 1M14.5 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3"/></svg>',
    "🗺": S + '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/></svg>',
    "🗒": S + '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5M8 3v3M16 3v3"/></svg>',
    "🔔": S + '<path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 004 0"/></svg>',
    "🛒": S + '<path d="M3 4h2l2.5 12h11l2-8H6M9 20a1 1 0 100 .01M18 20a1 1 0 100 .01"/></svg>',
    "⚡": S + '<path d="M13 3L5 13h6l-1 8 8-11h-6z"/></svg>',
    "🔨": S + '<path d="M14 4l6 6-3 3-6-6zM11 7L4 14l3 3 7-7"/></svg>',
    "🧯": S + '<path d="M9 8a3 3 0 016 0v11H9zM9 12h6M12 5V3M12 3l3-1"/></svg>',
    "📌": S + '<path d="M12 17v5M9 3h6l-1 5 3 3H7l3-3z"/></svg>',
    "✳": S + '<path d="M12 4v16M4 12h16M6 6l12 12M18 6L6 18"/></svg>',
    "🏠": S + '<path d="M4 11l8-7 8 7M6 10v10h12V10"/></svg>',
    "❌": S + '<path d="M6 6l12 12M18 6L6 18"/></svg>',
    "✖": S + '<path d="M6 6l12 12M18 6L6 18"/></svg>',
    "🌡": S + '<path d="M10 13V5a2 2 0 014 0v8a4 4 0 11-4 0zM12 13V8"/></svg>',
    "💧": S + '<path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z"/></svg>',
    "🗓": S + '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
    "🛡": S + '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/></svg>',
    "🏢": S + '<path d="M5 21V4h14v17M9 8h.01M13 8h.01M9 12h.01M13 12h.01M9 16h.01M13 16h.01"/></svg>',
    "🚛": S + '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-3M6.5 18a2 2 0 100-4 2 2 0 000 4M17.5 18a2 2 0 100-4 2 2 0 000 4"/></svg>',
    "⚖": S + '<path d="M12 3v18M7 21h10M6 6h12M6 6l-3 6a3 3 0 006 0zM18 6l3 6a3 3 0 01-6 0z"/></svg>',
    "🔄": S + '<path d="M4 12a8 8 0 0114-5l2 2M20 5v4h-4M20 12a8 8 0 01-14 5l-2-2M4 19v-4h4"/></svg>',
    "🔁": S + '<path d="M4 12a8 8 0 0114-5l2 2M20 5v4h-4M20 12a8 8 0 01-14 5l-2-2M4 19v-4h4"/></svg>'
  };

  // Détection large des emojis "colorés" (pictogrammes), sélecteur de
  // variante et séquences ZWJ comprises. Les flèches/chevrons typographiques
  // (→ ‹ › ✓ ✕ ☆) ne sont PAS des pictogrammes -> laissés tels quels.
  var RE;
  try {
    RE = /(?:\p{Extended_Pictographic})(?:️|‍\p{Extended_Pictographic})*/gu;
  } catch (e) {
    // Repli si \p indisponible : plages emoji principales
    RE = /(?:[☀-➿⬀-⯿]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF])(?:️|‍)?/g;
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1, svg: 1, SVG: 1 };

  function base(match) { return match.replace(/[️‍]/g, ""); }

  function hasEmoji(t) { RE.lastIndex = 0; return RE.test(t); }

  function protectedNode(node) {
    var p = node.parentNode;
    while (p && p.nodeType === 1) {
      if (SKIP[p.tagName]) return true;
      if (p.id === "devisDoc") return true;   // ne jamais toucher au document PDF
      if (p.isContentEditable) return true;
      if (p.classList && (p.classList.contains("ci") || p.classList.contains("ci-e"))) return true;
      p = p.parentNode;
    }
    return false;
  }

  function makeIcon(match) {
    var b = base(match);
    var span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    if (MAP[b]) { span.className = "ci"; span.innerHTML = MAP[b]; }
    else { span.className = "ci-e"; span.textContent = match; } // inconnu -> niveaux de gris
    return span;
  }

  function replaceIn(node) {
    var text = node.nodeValue;
    RE.lastIndex = 0;
    var frag = document.createDocumentFragment();
    var last = 0, m, any = false;
    while ((m = RE.exec(text))) {
      any = true;
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(makeIcon(m[0]));
      last = m.index + m[0].length;
    }
    if (!any) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function scan(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !hasEmoji(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (protectedNode(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], cur;
    while ((cur = walker.nextNode())) nodes.push(cur);
    for (var i = 0; i < nodes.length; i++) { try { replaceIn(nodes[i]); } catch (e) {} }
  }

  var obs = null, timer = null, running = false;
  function run() {
    if (running) return;
    running = true;
    try { if (obs) obs.disconnect(); scan(document.body); }
    catch (e) {}
    finally {
      if (obs) { try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {} }
      running = false;
    }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 160); }

  function start() {
    try {
      run();
      obs = new MutationObserver(function () { schedule(); });
      obs.observe(document.body, { childList: true, subtree: true });
      // quelques passes de rattrapage pendant le rendu asynchrone initial
      setTimeout(run, 400); setTimeout(run, 1200);
    } catch (e) { /* silencieux : purement cosmétique */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
