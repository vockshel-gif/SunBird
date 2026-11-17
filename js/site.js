/* Sunbird Lanka Tours – menu, slider and enquiry forms */
(function () {
  "use strict";
  var d = document, body = d.body;

  // ---- mobile menu
  var toggle = d.querySelector(".nav-toggle"), nav = d.getElementById("nav");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  d.querySelectorAll(".sub-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.parentNode.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
  if (nav) {
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        body.classList.remove("nav-open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ---- header shadow
  var header = d.querySelector(".site-header");
  function onScroll() { if (header) header.classList.toggle("scrolled", window.scrollY > 10); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---- home slider
  var slider = d.querySelector(".slider");
  if (slider) {
    var slides = slider.querySelectorAll(".slide"), dots = slider.querySelectorAll(".dots button"), i = 0, timer;
    var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var go = function (n) {
      slides[i].classList.remove("active"); if (dots[i]) dots[i].classList.remove("active");
      i = (n + slides.length) % slides.length;
      slides[i].classList.add("active"); if (dots[i]) dots[i].classList.add("active");
    };
    var start = function () {
      clearInterval(timer);
      if (!still && slides.length > 1) timer = setInterval(function () { go(i + 1); }, 6000);
    };
    dots.forEach(function (dot, n) { dot.addEventListener("click", function () { go(n); start(); }); });
    slider.addEventListener("mouseenter", function () { clearInterval(timer); });
    slider.addEventListener("mouseleave", start);
    start();
  }

  // ---- enquiry forms (sent by email through Web3Forms)
  var cfg = window.SB || {};
  var contactHtml = function () {
    return 'Please email us at <a href="mailto:' + cfg.email + '">' + cfg.email + '</a> or <a href="https://wa.me/' +
      cfg.whatsapp + '" target="_blank" rel="noopener">message us on WhatsApp</a>.';
  };
  d.querySelectorAll("form.plan-form").forEach(function (form) {
    var status = form.querySelector(".form-status"), button = form.querySelector("[type=submit]");
    var say = function (cls, htmlText) { status.className = "form-status " + cls; status.innerHTML = htmlText; };
    form.addEventListener("input", function (e) { e.target.classList.remove("invalid"); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var firstBad = null;
      form.querySelectorAll("[required]").forEach(function (el) {
        var v = el.value.trim();
        var ok = v !== "" && (el.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
        el.classList.toggle("invalid", !ok);
        if (!ok && !firstBad) firstBad = el;
      });
      if (firstBad) { say("err", "Please fill in the highlighted fields."); firstBad.focus(); return; }
      if (form.elements.botcheck && form.elements.botcheck.checked) { say("ok", "Thank you! Your message has been sent."); return; }
      if (!cfg.key || cfg.key.indexOf("PASTE") === 0) { say("err", "Sorry, this form isn’t connected yet. " + contactHtml()); return; }

      var data = {};
      new FormData(form).forEach(function (v, k) { if (k !== "botcheck" && v !== "") data[k] = v; });
      data.access_key = cfg.key;
      data.subject = (form.getAttribute("data-subject") || "Website enquiry") + (data.name ? " – " + data.name : "");
      data.from_name = "Sunbird website";
      data.page = location.href;
      button.disabled = true;
      say("", "Sending…");
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      }).then(function (r) { return r.json(); }).then(function (r) {
        if (!r || !r.success) throw new Error("failed");
        say("ok", "Thank you! We’ve received your request and will reply within 24 hours.");
        form.reset();
      }).catch(function () {
        say("err", "Sorry, something went wrong. " + contactHtml());
      }).then(function () { button.disabled = false; });
    });
  });
})();
