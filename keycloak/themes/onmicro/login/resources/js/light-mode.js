/*
 * Keep the login pages light regardless of the visitor's OS colour scheme.
 *
 * keycloak.v2's template.ftl carries an inline module script that toggles
 * `pf-v5-theme-dark` on <html> from a prefers-color-scheme media query.
 * That class is what PatternFly's dark palette hangs off — a single
 * `:where(.pf-v5-theme-dark) { ... }` block redefining every --pf-v5-global--*
 * token, so with it present *any* text the theme hasn't explicitly coloured
 * comes out light grey (#e0e0e0) on the white panels this theme paints.
 * Chasing that element by element in CSS only fixes the elements someone
 * happened to notice; removing the class fixes the whole page at once,
 * including pages (OTP, recovery codes, terms, ...) nobody has looked at yet.
 *
 * theme.properties lists this under `scripts`, which the parent template
 * emits as a classic <script> in <head> — it runs while the head is still
 * parsing, ahead of the deferred inline module, so the observer is already
 * watching by the time that module adds the class. MutationObserver
 * callbacks run at the microtask checkpoint, before the browser paints, so
 * the class never survives long enough to show a flash of dark theme.
 *
 * Keycloak 26.2 added a native `darkMode=false` theme.properties switch —
 * drop this file and set that instead once the image is upgraded.
 */
(function () {
  var DARK_MODE_CLASS = "pf-v5-theme-dark";

  function stripDarkMode() {
    var classList = document.documentElement.classList;
    // The contains() guard is load-bearing, not a micro-optimisation:
    // classList.remove() re-serialises and re-assigns the class attribute
    // even when the token was not there, which the observer below sees as a
    // fresh mutation — calling it unconditionally spins the main thread.
    if (classList.contains(DARK_MODE_CLASS)) {
      classList.remove(DARK_MODE_CLASS);
    }
  }

  stripDarkMode();

  new MutationObserver(stripDarkMode).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
})();
