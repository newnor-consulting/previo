/* ---------------------------------------------------------------------------
   Previo — shared page chrome.

   The single copy of what used to be pasted into seven pages: the scroll state
   on the nav and the reveal-on-intersection observer.

   Everything here is progressive enhancement. The `js` class is added by this
   file, and base.css only hides a .reveal element when that class is present —
   so with scripting disabled nothing is hidden and the page reads normally.
   --------------------------------------------------------------------------- */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ready(fn) {
    if (document.readyState !== "loading") {
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  ready(function () {
    var revealables = document.querySelectorAll(".reveal");

    // No IntersectionObserver, or the visitor asked for reduced motion: show
    // everything at once rather than leaving content stuck at opacity 0.
    if (reduceMotion || !("IntersectionObserver" in window)) {
      for (var i = 0; i < revealables.length; i++) {
        revealables[i].classList.add("is-visible");
      }
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    for (var j = 0; j < revealables.length; j++) {
      observer.observe(revealables[j]);
    }
  });
})();
