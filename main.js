// Behaviour shared by both language pages. Text and URLs come from the page itself (built by
// build.py from content/*.json): data attributes on <body> and the generated links.
const page = document.body.dataset;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const phone = window.matchMedia("(max-width: 639px)");
const touchScreen = window.matchMedia("(pointer: coarse)").matches;
const canObserve = "IntersectionObserver" in window;

// Hero loop: the source is set from here so it never blocks the page, and never with
// reduced motion (the poster stays, without the timeline).
const hero = document.getElementById("hero-video");
const heroToggle = document.getElementById("hero-toggle");
const heroTimeline = document.getElementById("hero-timeline");
const heroProgress = document.getElementById("hero-progress");

function drawProgress() {
  if (hero.duration) heroProgress.style.transform = "scaleX(" + hero.currentTime / hero.duration + ")";
  if (!hero.paused) requestAnimationFrame(drawProgress);
}

function startHero() {
  if (reduceMotion.matches || hero.getAttribute("src")) return;
  hero.src = page.videoSrc;
  hero.play().catch(() => {});
  heroTimeline.hidden = false;
}

function syncToggle() {
  heroToggle.classList.toggle("paused", hero.paused);
  heroToggle.setAttribute("aria-label", hero.paused ? page.resume : page.pause);
}

startHero();
reduceMotion.addEventListener("change", () => (reduceMotion.matches ? hero.pause() : startHero()));
hero.addEventListener("play", () => {
  syncToggle();
  requestAnimationFrame(drawProgress);
});
hero.addEventListener("pause", syncToggle);
hero.addEventListener("seeked", drawProgress);
heroToggle.addEventListener("click", () => (hero.paused ? hero.play().catch(() => {}) : hero.pause()));

// The YouTube player is loaded only when the visitor asks for it.
const play = document.getElementById("video-play");
play.addEventListener("click", () => {
  const iframe = document.createElement("iframe");
  iframe.src = page.embed + "?autoplay=1&rel=0";
  iframe.title = page.embedTitle;
  iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  play.replaceWith(iframe);
  iframe.focus();
});

// Native share sheet, on phones and tablets whose browser has one.
const shareNative = document.getElementById("share-native");
if (touchScreen && navigator.share) {
  shareNative.hidden = false;
  shareNative.addEventListener("click", () => {
    navigator.share({ title: "Zafra Radar", text: page.shareText, url: page.shareUrl }).catch(() => {});
  });
}

// Copy link.
const copyBtn = document.getElementById("copy-link");
const copyText = copyBtn.querySelector(".copy-text");
const copyStatus = document.getElementById("copy-status");

function copyFallback(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

copyBtn.addEventListener("click", async () => {
  let ok = false;
  try {
    await navigator.clipboard.writeText(page.shareUrl);
    ok = true;
  } catch {
    ok = copyFallback(page.shareUrl);
  }
  copyText.textContent = ok ? page.copied : page.shareUrl.replace("https://", "");
  copyBtn.classList.toggle("copied", ok);
  copyStatus.textContent = ok ? page.copiedStatus : page.copyFailed;
  setTimeout(() => {
    copyText.textContent = page.copy;
    copyBtn.classList.remove("copied");
  }, 2500);
});

// Motion: fade-in sections, counting numerals and the phone's sticky map button. All of it
// is skipped with reduced motion or without IntersectionObserver; the content is already in
// the page either way.
if (!reduceMotion.matches && canObserve) {
  document.documentElement.classList.add("motion");

  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      reveal.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll("main > .section").forEach((s) => {
    s.classList.add("reveal");
    reveal.observe(s);
  });

  const format = (value, decimals) =>
    value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const counter = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      counter.unobserve(entry.target);
      const el = entry.target;
      const to = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals, 10) || 0;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / 1200);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = format(to * eased, decimals);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = format(to, decimals);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach((el) => counter.observe(el));

  const sticky = document.getElementById("sticky-cta");
  const heroSection = document.getElementById("hero");
  new IntersectionObserver(([entry]) => {
    const show = phone.matches && !entry.isIntersecting;
    sticky.classList.toggle("visible", show);
    sticky.setAttribute("aria-hidden", show ? "false" : "true");
    sticky.tabIndex = show ? 0 : -1;
  }).observe(heroSection);
}
