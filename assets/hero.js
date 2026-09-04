/* ---------------------------------------------------------------------------
   Previo, the resolve.

   The home hero carries one inline <svg class="hero-piece"> whose FINISHED
   frame is the CSS default. Nothing here creates that frame; this file only
   plays the ~8.5 seconds in which it assembles, then hands control back by
   adding `is-done` so the CSS default takes over again.

   The order is the argument the brand makes: four namesakes arrive, the one
   subject is underlined and given a record identifier, six public sources draw
   out to it, three dated findings strike, and a person signs.

   Three rules, same as chrome.js. Progressive enhancement: with this file dead
   the piece is already whole, because every pre-animation state is scoped to
   `.js .hero-piece:not(.is-done)`. Reduced motion: the frame is set at once and
   nothing runs. No colour: this file animates opacity and stroke offset only,
   never a value from the palette.
   --------------------------------------------------------------------------- */

(function () {
  "use strict";

  var piece = document.querySelector(".hero-piece");
  if (!piece) return;

  function finish() {
    piece.classList.add("is-done");
  }

  var mq = window.matchMedia;
  var reduce = !!mq && mq("(prefers-reduced-motion: reduce)").matches;

  // No Web Animations, or the reader asked for stillness: show the whole piece.
  if (reduce || typeof piece.animate !== "function") {
    finish();
    return;
  }

  // Below 40rem components.css hides the namesake stack and the source labels,
  // so those two steps are skipped rather than played to nothing.
  var narrow = !!mq && mq("(max-width: 40rem)").matches;

  var EASE = "cubic-bezier(0.2, 0, 0, 1)";
  var last = 0;

  function play(el, frames, at, dur) {
    if (!el) return;
    el.animate(frames, {
      duration: dur,
      delay: at,
      easing: EASE,
      fill: "both"
    });
    if (at + dur > last) last = at + dur;
  }

  // `fill: both` holds the first frame through the delay, which is what hides
  // the elements the CSS pre-state does not cover (the identifier, the source
  // labels, the signature line).
  function fade(el, at, dur) {
    play(el, [{ opacity: 0 }, { opacity: 1 }], at, dur);
  }

  // Every rule, connector and hairline carries pathLength="1", so one dash of
  // length 1 draws from offset 1 to 0 whatever the real geometry is.
  function draw(el, at, dur) {
    play(el, [{ strokeDashoffset: "1" }, { strokeDashoffset: "0" }], at, dur);
  }

  function all(selector, root) {
    return (root || piece).querySelectorAll(selector);
  }

  var t = 0;
  var items;
  var i;
  var at;

  /* 1. Namesakes. Four rows of the same name arrive from the register. */
  if (!narrow) {
    items = all(".hp-name--ghost");
    for (i = 0; i < items.length; i++) fade(items[i], i * 150, 420);
    t = items.length * 150 + 480;
  } else {
    t = 250;
  }

  /* 2. Resolved. The subject is underlined and given its record identifier. */
  draw(piece.querySelector(".hp-subject .hp-rule"), t, 650);
  fade(piece.querySelector(".hp-id"), t + 620, 340);
  t += 1160;

  /* 3. Sources draw on, left to right, 90ms apart at the elbow. */
  if (!narrow) {
    items = all(".hp-source");
    for (i = 0; i < items.length; i++) {
      at = t + i * 150;
      draw(items[i].querySelector(".hp-connector"), at, 420);
      fade(items[i].querySelector("text"), at + 240, 300);
    }
    t += (items.length - 1) * 150 + 740;
  }

  /* The ledger the findings are entered on. */
  items = all(".hp-rules .hp-rule");
  for (i = 0; i < items.length; i++) draw(items[i], t + i * 180, 300);
  t += (items.length - 1) * 180 + 520;

  /* 4. Findings strike: the row, its leader rule, then the punch. */
  items = all(".hp-finding");
  for (i = 0; i < items.length; i++) {
    at = t + i * 760;
    fade(items[i], at, 240);
    draw(items[i].querySelector(".hp-connector"), at + 60, 220);
    fade(items[i].querySelector(".hp-punch"), at + 300, 240);
  }
  t += (items.length - 1) * 760 + 860;

  /* 5. Signed. */
  fade(piece.querySelector(".hp-sign"), t, 420);
  draw(piece.querySelector(".hp-sign-rule"), t + 460, 820);

  window.setTimeout(finish, last + 160);
})();
