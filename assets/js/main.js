/* THEME 8 — "Bold Contractor" front-end behaviours. Sections are inlined at
   generation time, so there is no client-side component loading. */

function initNavbar() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-links");
  if (!toggle || !menu) return;
  var isMobileNav = function () {
    return window.matchMedia("(max-width: 991px)").matches;
  };
  const closeMenu = () => {
    toggle.setAttribute("aria-expanded", "false");
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
    // Collapse any open sub-menus so the menu reopens with them closed.
    menu.querySelectorAll(".nav-dd.open").forEach(function (d) {
      d.classList.remove("open");
    });
  };
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    menu.classList.toggle("open", !isOpen);
    document.body.classList.toggle("menu-open", !isOpen);
    if (isOpen) closeMenu();
  });
  menu.querySelectorAll("a").forEach(function (link) {
    // A direct-child <a> of a .nav-dd is the Services/Areas sub-menu toggle. On
    // mobile, tapping it opens/closes the sub-menu (+ / −) instead of navigating
    // or closing the whole menu.
    var isDdToggle =
      link.parentElement && link.parentElement.classList.contains("nav-dd");
    link.addEventListener("click", function (e) {
      if (isDdToggle && isMobileNav()) {
        e.preventDefault();
        var dd = link.closest(".nav-dd");
        if (dd) dd.classList.toggle("open");
      } else {
        closeMenu();
      }
    });
  });
  document.addEventListener("keydown", (event) => event.key === "Escape" && closeMenu());
}

function initAccordions() {
  document.querySelectorAll(".accordion article").forEach((item) => {
    const button = item.querySelector("button");
    if (!button) return;
    button.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      document.querySelectorAll(".accordion article").forEach((other) => {
        other.classList.remove("open");
        other.querySelector("button")?.setAttribute("aria-expanded", "false");
        const s = other.querySelector("button b");
        if (s) s.textContent = "+";
      });
      if (!wasOpen) {
        item.classList.add("open");
        button.setAttribute("aria-expanded", "true");
        const s = button.querySelector("b");
        if (s) s.textContent = "−";
      }
    });
  });
}

/* Interactive process stepper — reads step content from the clicked article's
   data attributes so it stays niche-driven (no hardcoded copy). */
function initProcess() {
  const title = document.getElementById("process-title");
  const description = document.getElementById("process-description");
  const label = document.getElementById("process-step");
  const meter = document.querySelector(".process-meter span");
  const buttons = document.querySelectorAll("[data-process]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.getAttribute("data-process"));
      document.querySelectorAll(".process-list article").forEach((item) => item.classList.remove("active"));
      button.closest("article")?.classList.add("active");
      if (label) label.textContent = "STEP " + String(index + 1).padStart(2, "0");
      if (title) title.textContent = button.getAttribute("data-title") || "";
      if (description) description.textContent = button.getAttribute("data-desc") || "";
      if (meter) meter.style.width = ((index + 1) / buttons.length) * 100 + "%";
    });
  });
}

/* Read the lead-capture config baked into <head> at deploy time.
   Returns null when the site isn't wired for leads (preview, un-deployed,
   or placeholders left unreplaced) so we degrade to a plain thank-you. */
function leadsConfig() {
  var c = window.__RL_LEADS || {};
  var base = String(c.apiBase || "");
  var siteId = String(c.siteId || "");
  if (!/^https?:\/\//.test(base)) return null; // apiBase not set
  if (!siteId || siteId.indexOf("{{") !== -1) return null; // siteId not baked
  var key = String(c.turnstileSiteKey || "");
  if (!key || key.indexOf("{{") !== -1) key = ""; // widget disabled if unset
  return { apiBase: base.replace(/\/+$/, ""), siteId: siteId, turnstileSiteKey: key };
}

/* Cloudflare Turnstile is loaded LAZILY — only when a visitor first focuses a
   form field — so it adds zero weight to the initial page load Google measures
   (no Core Web Vitals / SEO cost). Each form gets its own invisible widget that
   drops a `cf-turnstile-response` token, read back on submit. */
var _tsState = { loading: false, loaded: false, queue: [] };
function loadTurnstile(cb) {
  if (_tsState.loaded && window.turnstile) return cb();
  _tsState.queue.push(cb);
  if (_tsState.loading) return;
  _tsState.loading = true;
  window.__rlTurnstileReady = function () {
    _tsState.loaded = true;
    _tsState.queue.forEach(function (f) { f(); });
    _tsState.queue = [];
  };
  var s = document.createElement("script");
  s.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__rlTurnstileReady&render=explicit";
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}
function mountTurnstile(form, siteKey) {
  if (!siteKey || form.__rlTs) return;
  form.__rlTs = true;
  var box = document.createElement("div");
  box.className = "rl-turnstile";
  var submit = form.querySelector('button[type="submit"]');
  if (submit && submit.parentNode) submit.parentNode.insertBefore(box, submit);
  else form.appendChild(box);
  loadTurnstile(function () {
    try {
      window.turnstile.render(box, { sitekey: siteKey, size: "flexible" });
    } catch (_e) {
      /* widget failed to render — submission still works (token just absent) */
    }
  });
}

function initForms() {
  var cfg = leadsConfig();

  document.querySelectorAll("form[data-t8-form]").forEach((form) => {
    // Lazy-mount the Turnstile widget on first interaction (keeps page load clean).
    if (cfg && cfg.turnstileSiteKey) {
      form.addEventListener(
        "focusin",
        function () { mountTurnstile(form, cfg.turnstileSiteKey); },
        { once: true },
      );
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');

      // Honeypot: a hidden field only bots fill — silently drop if present.
      const hp = form.querySelector('[name="_hp"]');
      const isBot = hp && hp.value;

      if (cfg && !isBot) {
        const data = {};
        new FormData(form).forEach((value, key) => {
          if (key === "_hp") return;
          data[key] = typeof value === "string" ? value : String(value);
        });
        data.pageUrl = window.location.href;
        const tokenInput = form.querySelector('[name="cf-turnstile-response"]');
        if (tokenInput && tokenInput.value) data.turnstileToken = tokenInput.value;
        // Fire-and-forget: never block the thank-you on the network call.
        try {
          fetch(cfg.apiBase + "/api/leads/" + encodeURIComponent(cfg.siteId), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            keepalive: true,
          }).catch(() => {});
        } catch (_e) {
          /* ignore — still show success below */
        }
      }

      form.querySelector(".form-success")?.classList.add("visible");
      if (submit) {
        submit.disabled = true;
        submit.innerHTML = "Request received <span>✓</span>";
      }
    });
  });
  document.getElementById("newsletter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    if (button) {
      button.textContent = "You're on the list ✓";
      button.disabled = true;
    }
  });
}

/* Self-hosted scroll reveal — replaces the third-party sal.js (unpkg). Crucially
   LCP-safe: elements are visible by DEFAULT; JS adds the hidden/animated state
   ONLY to elements that start BELOW the fold, so the hero (the LCP element) is
   never hidden and never waits on a script. Respects reduced-motion. */
function initReveal() {
  var els = document.querySelectorAll("[data-sal]");
  if (!els.length) return;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return; // leave visible
  var vh = window.innerHeight || document.documentElement.clientHeight;
  if (!vh) return; // viewport unknown → hide nothing (LCP-safe)
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("sal-shown");
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  els.forEach(function (el) {
    // Pre-hide (and animate on scroll) ONLY elements that start fully below the
    // fold. Anything already touching the first screenful — the hero/LCP — is
    // left painted so it never waits on JS.
    if (el.getBoundingClientRect().top >= vh) {
      el.classList.add("sal-hidden");
      io.observe(el);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  initAccordions();
  initProcess();
  initForms();
  initReveal();
});
