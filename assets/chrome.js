/* ---------------------------------------------------------------------------
   Previo, shared page chrome.

   Every behaviour the public site needs, in one file: the `js` gate, the
   reveal-on-intersection observer, count-up figures, the nav (theme tracking
   under the sticky bar, hide on scroll down, mobile menu) and scroll fallbacks
   for browsers without `animation-timeline: view()`.

   Hand rolled on purpose. The whole motion vocabulary reduces to a per-child
   delay, an IntersectionObserver and one requestAnimationFrame loop; a motion
   library would weigh more than every font on the page put together.

   Two rules hold throughout. First, progressive enhancement: this file adds the
   `js` class and the CSS only hides a `.reveal` element when that class is
   present, so with scripting off nothing is hidden, and under
   `prefers-reduced-motion: reduce` everything is put in its final state at once
   rather than left at opacity 0. Second, no colour in JavaScript: this file
   only adds classes and sets custom properties.

   Every feature is guarded by an element check, so a page with no stat band, no
   mobile menu and no tracked steps pays nothing for them.
   --------------------------------------------------------------------------- */

(function () {
  "use strict";

  var doc = document;

  doc.documentElement.classList.add("js");

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var hasObserver = "IntersectionObserver" in window;

  // Where `animation-timeline: view()` exists, CSS drives the method track and
  // the case-study timeline on its own and the fallbacks below stay asleep.
  var hasViewTimeline =
    typeof CSS !== "undefined" &&
    !!CSS.supports &&
    CSS.supports("animation-timeline", "view()");

  function ready(fn) {
    if (doc.readyState !== "loading") fn();
    else doc.addEventListener("DOMContentLoaded", fn);
  }

  function each(list, fn) {
    for (var i = 0; i < list.length; i++) fn(list[i], i);
  }

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  /* One passive scroll listener and one rAF per frame, shared by everything
     that reads scroll position. The listener is bound at most once. */
  var frameTasks = [];
  var frameQueued = false;
  var scrollBound = false;

  function runTasks() {
    frameQueued = false;
    for (var i = 0; i < frameTasks.length; i++) frameTasks[i]();
  }

  function schedule() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(runTasks);
  }

  function onScrollFrame(fn) {
    frameTasks.push(fn);
    if (!scrollBound) {
      scrollBound = true;
      window.addEventListener("scroll", schedule, { passive: true });
    }
    fn();
  }

  /* Stagger ------------------------------------------------------------------
     CSS delays each child by calc(var(--i) * 60ms); the index is a document
     position, so it has to be handed over from here. */
  function setStagger(parent) {
    each(parent.children, function (child, i) {
      child.style.setProperty("--i", String(i));
    });
  }

  /* Land (count-up) ----------------------------------------------------------
     The target is whatever the page already says, so the figure stays true and
     checkable with scripting off. Only the first run of digits animates; any
     prefix or suffix ("DKK ", " days") is carried through untouched, and the
     original string is written back verbatim on the last frame. */
  var GROUP_SPACES = " \u00a0\u202f";
  var NUM_RE = /[0-9]+(?:[.,\u00a0\u202f ][0-9]+)*/;

  function countUp(el) {
    if (el.previoCounted) return;
    el.previoCounted = true;

    var original = el.textContent;
    var match = NUM_RE.exec(original);
    if (!match) return;

    var raw = match[0];
    var head = original.slice(0, match.index);
    var tail = original.slice(match.index + raw.length);
    var seps = raw.replace(/[0-9]/g, "");
    var groups = raw.split(/[^0-9]/);
    var thousands = "";
    var decimalSep = "";
    var decimals = 0;

    if (seps) {
      // Read the author's own separators back out: "1,600" groups, "1.6" is a
      // decimal, "1.234,5" does both. A lone separator followed by exactly
      // three digits is read as grouping, which is the common case.
      var lastSep = seps.charAt(seps.length - 1);
      var lastGroup = groups[groups.length - 1];
      var uniform = true;
      for (var s = 1; s < seps.length; s++) {
        if (seps.charAt(s) !== seps.charAt(0)) uniform = false;
      }
      var lastIsDecimal;
      if (!uniform) lastIsDecimal = true;
      else if (seps.length > 1) lastIsDecimal = false;
      else
        lastIsDecimal =
          GROUP_SPACES.indexOf(lastSep) < 0 && lastGroup.length !== 3;

      if (lastIsDecimal) {
        decimalSep = lastSep;
        decimals = lastGroup.length;
        thousands = seps.length > 1 ? seps.charAt(0) : "";
      } else {
        thousands = lastSep;
      }
    }

    var value = parseFloat(
      decimals
        ? groups.slice(0, groups.length - 1).join("") + "." + groups[groups.length - 1]
        : groups.join("")
    );
    if (!isFinite(value)) return;

    function render(v) {
      var text = v.toFixed(decimals);
      var dot = text.indexOf(".");
      var whole = dot < 0 ? text : text.slice(0, dot);
      var frac = dot < 0 ? "" : text.slice(dot + 1);
      if (thousands) {
        whole = whole.replace(/\B(?=([0-9]{3})+(?![0-9]))/g, thousands);
      }
      el.textContent = head + whole + (decimals ? decimalSep + frac : "") + tail;
    }

    var startedAt = 0;
    function frame(now) {
      if (!startedAt) startedAt = now;
      var t = clamp01((now - startedAt) / 900);
      if (t < 1) {
        render(value * (1 - Math.pow(1 - t, 3))); // ease out: it lands, it does not drift
        requestAnimationFrame(frame);
      } else {
        el.textContent = original;
      }
    }
    requestAnimationFrame(frame);
  }

  /* Rise, draw, land, timeline draw ------------------------------------------
     One observer for the lot: `.reveal` rises, `.draw` scales its hairline from
     0 on the X axis, `[data-count]` counts, `.timeline` gets `.is-drawn` where
     CSS cannot draw it. Each is released after the first hit. */
  function initReveals() {
    var targets = [];
    function add(el) {
      if (targets.indexOf(el) < 0) targets.push(el);
    }

    each(doc.querySelectorAll(".reveal, .draw, [data-count]"), add);
    if (!hasViewTimeline) each(doc.querySelectorAll(".timeline"), add);
    if (!targets.length) return;

    function enter(el, animate) {
      el.classList.add("is-visible");
      if (el.classList.contains("timeline")) el.classList.add("is-drawn");
      if (animate && el.hasAttribute("data-count")) countUp(el);
    }

    // No observer, or the visitor asked for reduced motion: show everything at
    // once and leave counted figures at the value the page already states.
    if (reduceMotion || !hasObserver) {
      each(targets, function (el) {
        enter(el, false);
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          enter(entry.target, true);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    each(targets, function (el) {
      observer.observe(el);
    });
  }

  /* Nav ----------------------------------------------------------------------
     Three jobs: read the theme of whatever sits under the bar, get out of the
     way on the way down, and be the mobile menu below 40rem. */
  function initNav() {
    var nav = doc.querySelector(".top-nav");
    if (!nav) return;

    var menuOpen = false;

    /* Theme tracking. The observer's root margin collapses the viewport to a
       1px band at the nav's bottom edge, so exactly the section passing under
       the bar reports in. The nav is dark by default, so a dark section means
       "remove the override" and a paper one means "flip to light". */
    var bandTargets = [];
    each(doc.querySelectorAll("[data-theme]"), function (el) {
      bandTargets.push(el);
    });
    if (bandTargets.length) {
      each(doc.querySelectorAll(".hero"), function (el) {
        if (bandTargets.indexOf(el) < 0) bandTargets.push(el);
      });
    }

    var themeObserver = null;

    function onBand(entries) {
      var hit = null;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) hit = entry.target;
      });
      if (!hit) return;
      if (hit.getAttribute("data-theme") === "light") nav.dataset.theme = "light";
      else nav.removeAttribute("data-theme");
    }

    function buildThemeObserver() {
      if (themeObserver) themeObserver.disconnect();
      themeObserver = null;
      if (!bandTargets.length || !hasObserver) return;
      var navH = nav.offsetHeight || 0;
      var below = (window.innerHeight || 0) - navH - 1;
      if (below < 0) return;
      themeObserver = new IntersectionObserver(onBand, {
        rootMargin: "-" + navH + "px 0px -" + below + "px 0px"
      });
      each(bandTargets, function (el) {
        themeObserver.observe(el);
      });
    }

    buildThemeObserver();

    /* Hide on the way down, return on the way up. Never hidden at the top of
       the page, never hidden while the menu is open. */
    var lastY = window.pageYOffset || 0;
    onScrollFrame(function () {
      var y = window.pageYOffset || 0;
      if (y <= 120 || menuOpen) nav.classList.remove("is-hidden");
      else if (y > lastY + 4) nav.classList.add("is-hidden");
      else if (y < lastY - 4) nav.classList.remove("is-hidden");
      lastY = y;
    });

    /* Mobile menu. The toggle and the panel are markup WP4 adds; without them
       this whole block is inert. */
    var toggle = nav.querySelector(".nav-toggle");
    var panel = doc.getElementById("site-menu") || nav.querySelector(".nav-links");
    var wide = window.matchMedia ? window.matchMedia("(min-width: 40rem)") : null;
    var FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

    function focusable() {
      return panel.querySelectorAll(FOCUSABLE);
    }

    function onMenuKey(e) {
      if (e.key === "Escape") {
        closeMenu();
        return;
      }
      if (e.key !== "Tab") return;
      // Focus stays inside the panel for as long as it covers the page.
      var items = focusable();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      var active = doc.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function onMenuClick(e) {
      if (e.target.closest && e.target.closest("a")) closeMenu();
    }

    function openMenu() {
      if (menuOpen) return;
      menuOpen = true;
      setStagger(panel);
      nav.classList.remove("is-hidden");
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      doc.body.classList.add("no-scroll");
      doc.addEventListener("keydown", onMenuKey);
      panel.addEventListener("click", onMenuClick);
      var items = focusable();
      if (items.length) items[0].focus();
    }

    function closeMenu() {
      if (!menuOpen) return;
      menuOpen = false;
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      doc.body.classList.remove("no-scroll");
      doc.removeEventListener("keydown", onMenuKey);
      panel.removeEventListener("click", onMenuClick);
      toggle.focus();
    }

    if (toggle && panel) {
      toggle.addEventListener("click", function () {
        if (menuOpen) closeMenu();
        else openMenu();
      });
    }

    /* Resize: the band depends on nav and viewport height, and a menu left open
       across the 40rem line would strand a panel on a desktop layout. */
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeTimer = null;
        if (wide && wide.matches) closeMenu();
        buildThemeObserver();
        schedule();
      }, 150);
    });
  }

  /* Track --------------------------------------------------------------------
     The method steps fill a progress hairline as they pass. CSS does it with
     `animation-timeline: view()` where that exists; this fallback publishes the
     same two hooks: `--progress` on the container, `.is-active` on the step
     nearest the middle of the viewport. */
  function initTracks() {
    if (hasViewTimeline) return;
    var tracks = doc.querySelectorAll(".steps--tracked");
    if (!tracks.length) return;

    if (reduceMotion) {
      each(tracks, function (track) {
        track.style.setProperty("--progress", "1");
        each(track.querySelectorAll(".step"), function (step) {
          step.classList.add("is-active");
        });
      });
      return;
    }

    onScrollFrame(function () {
      var vh = window.innerHeight || 1;
      each(tracks, function (track) {
        var box = track.getBoundingClientRect();
        // Same range as a default view timeline: 0 as the container enters from
        // the bottom, 1 once it has left past the top.
        track.style.setProperty(
          "--progress",
          clamp01((vh - box.top) / (vh + box.height)).toFixed(3)
        );

        var steps = track.querySelectorAll(".step");
        var middle = vh / 2;
        var nearest = -1;
        var shortest = Infinity;
        each(steps, function (step, i) {
          var rect = step.getBoundingClientRect();
          var distance = Math.abs(rect.top + rect.height / 2 - middle);
          if (distance < shortest) {
            shortest = distance;
            nearest = i;
          }
        });
        each(steps, function (step, i) {
          step.classList.toggle("is-active", i === nearest);
        });
      });
    });
  }

  ready(function () {
    each(doc.querySelectorAll("[data-stagger]"), setStagger);
    initReveals();
    initNav();
    initTracks();
  });
})();
