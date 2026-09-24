/* Body Spray site script. Classic script, no dependencies, works from file://.
   Handles: theme toggle, mobile nav, copy buttons, tabs, search, the ladder demo, and
   the arc demo's selection events. */
(function () {
  "use strict";
  var doc = document;
  var root = doc.documentElement;
  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Theme -----------------------------------------------------------------
  function applyTheme(theme) {
    if (theme) root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
    var dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    doc.querySelectorAll(".theme-toggle").forEach(function (b) {
      b.setAttribute("aria-pressed", String(dark));
      b.textContent = dark ? "Light" : "Dark";
      b.title = dark ? "Switch to the light theme" : "Switch to the dark theme";
    });
  }
  var storedTheme = null;
  try {
    storedTheme = localStorage.getItem("axe-theme");
  } catch {
    storedTheme = null;
  }
  applyTheme(storedTheme);
  doc.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".theme-toggle");
    if (!b) return;
    var dark = root.getAttribute("data-theme")
      ? root.getAttribute("data-theme") === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    var next = dark ? "light" : "dark";
    try {
      localStorage.setItem("axe-theme", next);
    } catch {
      /* private mode */
    }
    applyTheme(next);
  });

  // --- Mobile nav ------------------------------------------------------------
  doc.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".nav-toggle");
    if (!b) return;
    var target = doc.getElementById(b.getAttribute("aria-controls"));
    if (!target) return;
    var open = target.classList.toggle("open");
    b.setAttribute("aria-expanded", String(open));
  });

  // --- Copy buttons ----------------------------------------------------------
  doc.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button.copy");
    if (!b) return;
    var container = b.parentElement;
    var source = container.querySelector("pre") || container.querySelector("code");
    if (!source) return;
    var text = source.textContent;
    var done = function () {
      var label = b.textContent;
      b.textContent = "Copied";
      setTimeout(function () {
        b.textContent = label;
      }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  });
  function fallbackCopy(text) {
    var ta = doc.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    doc.body.appendChild(ta);
    ta.select();
    try {
      doc.execCommand("copy");
    } catch {
      /* ignore */
    }
    doc.body.removeChild(ta);
  }

  // --- Tabs (mount snippets) -------------------------------------------------
  function activateTab(tab) {
    var list = tab.closest("[role=tablist]");
    var tabs = Array.prototype.slice.call(list.querySelectorAll("[role=tab]"));
    tabs.forEach(function (t) {
      var selected = t === tab;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      var panel = doc.getElementById(t.getAttribute("aria-controls"));
      if (panel && t.hasAttribute("data-mount")) panel.hidden = !selected;
    });
  }
  doc.addEventListener("click", function (e) {
    var tab = e.target.closest && e.target.closest("[role=tab]");
    if (!tab) return;
    activateTab(tab);
    if (tab.hasAttribute("data-path")) ladder.setPath(tab.getAttribute("data-path"));
  });
  doc.addEventListener("keydown", function (e) {
    var tab = e.target.closest && e.target.closest("[role=tab]");
    if (!tab || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    var tabs = Array.prototype.slice.call(
      tab.closest("[role=tablist]").querySelectorAll("[role=tab]"),
    );
    var i = tabs.indexOf(tab);
    var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    next.click();
    e.preventDefault();
  });

  // --- Search ----------------------------------------------------------------
  var dialog = doc.getElementById("search-dialog");
  var rootPrefix = root.getAttribute("data-root") || "";
  var index = [];
  // Data scripts load after the page is painted: classic <script src>, so file:// works.
  var loading = {};
  function loadScript(name, onload) {
    if (loading[name]) {
      if (loading[name].done) onload();
      else loading[name].callbacks.push(onload);
      return;
    }
    var entry = { done: false, callbacks: [onload] };
    loading[name] = entry;
    var sc = doc.createElement("script");
    sc.src = rootPrefix + name;
    sc.onload = function () {
      entry.done = true;
      entry.callbacks.forEach(function (cb) {
        cb();
      });
      entry.callbacks = [];
    };
    doc.head.appendChild(sc);
  }
  function whenIdle(fn) {
    if (doc.readyState === "complete") setTimeout(fn, 0);
    else
      window.addEventListener("load", function () {
        setTimeout(fn, 0);
      });
  }
  function ensureSearch(cb) {
    loadScript("search-index.js", function () {
      index = Array.isArray(window.AXE_SEARCH) ? window.AXE_SEARCH : [];
      cb();
    });
  }
  // Warm the index once the user shows intent (hovering or focusing the search control).
  doc.addEventListener("focusin", function (e) {
    if (e.target.closest && e.target.closest(".search-open")) ensureSearch(function () {});
  });
  doc.addEventListener("pointerover", function (e) {
    if (e.target.closest && e.target.closest(".search-open")) ensureSearch(function () {});
  });
  function openSearch() {
    if (!dialog || typeof dialog.showModal !== "function") return;
    dialog.showModal();
    var input = dialog.querySelector(".search-input");
    input.value = "";
    renderResults("");
    input.focus();
    ensureSearch(function () {
      renderResults(input.value);
    });
  }
  doc.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".search-open")) openSearch();
  });
  doc.addEventListener("keydown", function (e) {
    if (
      e.key === "/" &&
      !/^(INPUT|TEXTAREA)$/.test(doc.activeElement.tagName) &&
      !(dialog && dialog.open)
    ) {
      e.preventDefault();
      openSearch();
    }
  });
  function score(entry, q) {
    var t = entry.t.toLowerCase();
    var s = 0;
    if (t === q) s += 100;
    else if (t.indexOf(q) === 0) s += 60;
    else if (t.indexOf(q) >= 0) s += 40;
    var h = entry.h.find(function (x) {
      return x[0].toLowerCase().indexOf(q) >= 0;
    });
    if (h) s += 25;
    if (entry.e.toLowerCase().indexOf(q) >= 0) s += 10;
    // Fuzzy: every character of q appears in order in the title.
    var j = 0;
    for (var i = 0; i < t.length && j < q.length; i++) if (t[i] === q[j]) j++;
    if (j === q.length) s += 5;
    return s;
  }
  function renderResults(q) {
    if (!dialog) return;
    var list = dialog.querySelector(".search-results");
    list.innerHTML = "";
    q = q.trim().toLowerCase();
    var results = q
      ? index
          .map(function (e) {
            return { e: e, s: score(e, q) };
          })
          .filter(function (r) {
            return r.s > 0;
          })
          .sort(function (a, b) {
            return b.s - a.s;
          })
          .slice(0, 12)
      : index.slice(0, 8).map(function (e) {
          return { e: e, s: 0 };
        });
    if (!results.length) {
      var li = doc.createElement("li");
      li.className = "search-empty";
      li.textContent = "No matches.";
      list.appendChild(li);
      return;
    }
    results.forEach(function (r) {
      var li = doc.createElement("li");
      li.setAttribute("role", "option");
      var a = doc.createElement("a");
      var heading = q
        ? r.e.h.find(function (x) {
            return x[0].toLowerCase().indexOf(q) >= 0;
          })
        : null;
      a.href = rootPrefix + r.e.u + (heading ? "#" + heading[1] : "");
      a.textContent = r.e.t + (heading ? " › " + heading[0] : "");
      var small = doc.createElement("small");
      small.textContent = r.e.e;
      a.appendChild(small);
      li.appendChild(a);
      list.appendChild(li);
    });
  }
  if (dialog) {
    dialog.querySelector(".search-input").addEventListener("input", function (e) {
      renderResults(e.target.value);
    });
    dialog.addEventListener("keydown", function (e) {
      var links = Array.prototype.slice.call(dialog.querySelectorAll(".search-results a"));
      var i = links.indexOf(doc.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        (links[i + 1] || links[0] || dialog.querySelector(".search-input")).focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        (i > 0 ? links[i - 1] : dialog.querySelector(".search-input")).focus();
      }
      if (e.key === "Enter" && doc.activeElement.classList.contains("search-input") && links[0]) {
        e.preventDefault();
        links[0].click();
      }
    });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
  }

  // --- On-this-page highlight -------------------------------------------------
  var tocLinks = Array.prototype.slice.call(doc.querySelectorAll(".toc a"));
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) {
      byId[a.getAttribute("href").slice(1)] = a;
    });
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          tocLinks.forEach(function (a) {
            a.classList.remove("current");
          });
          var a = byId[en.target.id];
          if (a) a.classList.add("current");
        });
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    Object.keys(byId).forEach(function (id) {
      var h = doc.getElementById(id);
      if (h) observer.observe(h);
    });
  }

  // --- Ladder demo -----------------------------------------------------------
  var ladder = (function () {
    var el = doc.getElementById("ladder-demo");
    if (!el) return { setPath: function () {}, bind: function () {} };
    var fixtures = { wallet: [], handoff: [], unitIds: {} };
    var ready = false;
    var pending = [];
    function whenReady(fn) {
      if (ready) fn();
      else pending.push(fn);
    }
    window.axeFixturesReady = function () {
      fixtures = window.AXE_LADDER || fixtures;
      ready = true;
      state.unitId = el.hasAttribute("data-bound-unit")
        ? state.unitId
        : (fixtures.unitIds && fixtures.unitIds[state.path]) || state.unitId;
      var arcFrame = doc.getElementById("arc-frame");
      if (arcFrame && typeof window.AXE_ARC_HTML === "string")
        arcFrame.setAttribute("srcdoc", window.AXE_ARC_HTML);
      el.setAttribute("data-ready", "true");
      render();
      pending.forEach(function (fn) {
        fn();
      });
      pending = [];
    };
    // The demo data (real envelopes and the rendered search) loads when the demos come near the viewport
    // or the user interacts with them, so a reader who never scrolls never downloads it.
    var requested = false;
    function requestFixtures() {
      if (requested) return;
      requested = true;
      loadScript("fixtures.js", function () {
        if (!ready) window.axeFixturesReady();
      });
    }
    el.addEventListener("click", requestFixtures);
    el.addEventListener("focusin", requestFixtures);
    var arcSection = doc.getElementById("arc");
    if ("IntersectionObserver" in window) {
      var near = new IntersectionObserver(
        function (entries) {
          if (
            entries.some(function (en) {
              return en.isIntersecting;
            })
          ) {
            requestFixtures();
            near.disconnect();
          }
        },
        { rootMargin: "800px 0px" },
      );
      near.observe(el);
      if (arcSection) near.observe(arcSection);
    } else {
      whenIdle(requestFixtures);
    }
    var hash = window.location.hash;
    if (hash === "#how-it-works" || hash === "#arc") requestFixtures();
    var state = { path: "wallet", step: -1, unitId: "u_204", timer: null };
    var statusEl = doc.getElementById("ladder-status");
    var captionEl = doc.getElementById("ladder-caption");
    var envelopeEl = doc.getElementById("ladder-envelope");
    var progressEl = doc.getElementById("ladder-progress");
    var boundEl = doc.getElementById("ladder-bound");
    var panel = doc.getElementById("ladder-panel");
    var rungs = Array.prototype.slice.call(el.querySelectorAll(".rung"));

    function steps() {
      return fixtures[state.path] || [];
    }
    function highlightStatus(html, status) {
      if (!status) return html;
      // Emphasize the status line of the envelope: the <span> tokens for "status" and its value.
      return html.replace(
        /(<span[^>]*>\s*"status"<\/span>)(<span[^>]*>: <\/span>)?(<span[^>]*>"[a-z_]+"<\/span>)/,
        function (m) {
          return '<span class="status-line">' + m + "</span>";
        },
      );
    }
    function bindUnit(html) {
      var own = (fixtures.unitIds && fixtures.unitIds[state.path]) || "u_204";
      return html.split(own).join(state.unitId);
    }
    function render() {
      var list = steps();
      var i = state.step;
      rungs.forEach(function (r) {
        r.classList.remove("active", "done");
      });
      if (i < 0) {
        statusEl.textContent = "status: —";
        captionEl.textContent = "Press Step to send the first request.";
        envelopeEl.innerHTML = "";
        progressEl.textContent = "";
        el.setAttribute("data-status", "");
        return;
      }
      var s = list[i];
      var status = s.status;
      statusEl.textContent = "status: " + (status || "request");
      el.setAttribute("data-status", status || "request");
      captionEl.textContent = s.caption;
      progressEl.textContent = "Step " + (i + 1) + " of " + list.length;
      var html = "";
      if (s.request)
        html +=
          '<div class="code" data-lang="http"><span class="code-title">' +
          escapeHtml(s.request.title) +
          '</span><button class="copy" type="button" aria-label="Copy code to clipboard">Copy</button>' +
          (i === 0 ? bindUnit(s.request.html) : s.request.html) +
          "</div>";
      if (s.response)
        html +=
          '<div class="code" data-lang="json"><span class="code-title">response</span><button class="copy" type="button" aria-label="Copy code to clipboard">Copy</button>' +
          highlightStatus(s.response.html, status) +
          "</div>";
      envelopeEl.innerHTML = html;
      var reached = list
        .slice(0, i + 1)
        .map(function (x) {
          return x.status;
        })
        .filter(Boolean);
      rungs.forEach(function (r) {
        var rung = r.getAttribute("data-rung");
        if (rung === status) r.classList.add("active");
        else if (reached.indexOf(rung) >= 0) r.classList.add("done");
      });
    }
    function step() {
      var list = steps();
      state.step = (state.step + 1) % (list.length + 1);
      if (state.step === list.length) state.step = -1;
      render();
    }
    function reset() {
      state.step = -1;
      stopAuto();
      render();
    }
    function stopAuto() {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }
    }
    function startAuto() {
      if (reduceMotion || state.timer) return;
      state.timer = setInterval(function () {
        if (state.step >= steps().length - 1) {
          stopAuto();
          return;
        }
        step();
      }, 2600);
    }
    doc.getElementById("ladder-step").addEventListener("click", function () {
      whenReady(function () {
        stopAuto();
        step();
      });
    });
    doc.getElementById("ladder-reset").addEventListener("click", function () {
      whenReady(reset);
    });
    // Auto-advance once when the demo scrolls into view and motion is allowed.
    if (!reduceMotion && "IntersectionObserver" in window) {
      var started = false;
      new IntersectionObserver(
        function (entries, obs) {
          if (started) return;
          if (
            entries.some(function (en) {
              return en.isIntersecting;
            })
          ) {
            started = true;
            obs.disconnect();
            whenReady(function () {
              if (state.step === -1) {
                step();
                startAuto();
              }
            });
          }
        },
        { threshold: 0.35 },
      ).observe(el);
    }
    render();
    return {
      setPath: function (path) {
        whenReady(function () {
          setPathNow(path);
        });
      },
      bind: function (unitId, action) {
        whenReady(function () {
          bindNow(unitId, action);
        });
      },
    };
    function setPathNow(path) {
      if (!fixtures[path]) return;
      state.path = path;
      if (!el.hasAttribute("data-bound-unit"))
        state.unitId = (fixtures.unitIds && fixtures.unitIds[path]) || state.unitId;
      boundEl.innerHTML = el.hasAttribute("data-bound-unit")
        ? boundEl.innerHTML
        : "Applying for <code>" +
          escapeHtml(state.unitId) +
          "</code>. Pick a unit in the search below to change it.";
      panel.setAttribute("aria-labelledby", "tab-" + path);
      reset();
    }
    function bindNow(unitId, action) {
      if (typeof unitId !== "string" || !/^[a-z0-9_-]+$/i.test(unitId)) return;
      stopAuto();
      state.unitId = unitId;
      el.setAttribute("data-bound-unit", unitId);
      boundEl.innerHTML =
        "Applying for <code>" +
        escapeHtml(unitId) +
        "</code> via <code>" +
        escapeHtml(action || "applications.submit") +
        "</code>, bound from the affordance you chose.";
      state.step = 0;
      render();
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  })();

  // --- Arc demo: listen for the renderer's selection events -------------------
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.type !== "axe:select" || !d.detail) return;
    var input = d.detail.input || {};
    var action = d.detail.action;
    var unit = input.unitId || d.detail.itemId;
    if (action === "applications.submit") ladder.bind(unit, action);
    else if (action === "tours.book") {
      var bound = doc.getElementById("ladder-bound");
      if (bound)
        bound.innerHTML =
          "You chose <code>tours.book</code> for <code>" +
          escapeHtml(unit) +
          "</code>. The ladder below plays <code>applications.submit</code>; tours book in one <code>ok</code> step.";
    }
  });
  // Test hook: the same entry point the iframe uses, callable from the page.
  window.axeSelect = function (detail) {
    window.postMessage({ type: "axe:select", detail: detail }, "*");
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
