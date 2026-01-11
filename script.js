(() => {
  const STORAGE_KEY = "notion-flipclock-theme";
  const root = document.documentElement;

  const frame = document.getElementById("frame");
  const stage = document.getElementById("stage");
  const toggleBtn = document.getElementById("themeToggle");

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Theme ----------
function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function applyTheme(theme) {
  const safe = theme === "light" ? "light" : "dark";
  root.setAttribute("data-theme", safe);
  toggleBtn.querySelector(".icon").textContent = safe === "light" ? "☀" : "☾";

  // Save in BOTH places (Notion iframe friendly)
  try { localStorage.setItem(STORAGE_KEY, safe); } catch (_) {}
  try { setCookie(STORAGE_KEY, safe); } catch (_) {}
}

function loadTheme() {
  // Try localStorage first
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (_) {}

  // Fallback to cookie
  try {
    const c = getCookie(STORAGE_KEY);
    if (c === "light" || c === "dark") return c;
  } catch (_) {}

  // Final fallback: user's system preference, else dark
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
  } catch (_) {}

  return "dark";
}

  toggleBtn.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  applyTheme(loadTheme());

  // ---------- Flip Card DOM (HH and MM) ----------
  function createCard(el) {
    el.insertAdjacentHTML(
      "afterbegin",
      `
      <div class="flip" aria-hidden="true">
        <div class="half top"><div class="face"><span class="val">0</span></div></div>
        <div class="half bottom"><div class="face"><span class="val">0</span></div></div>

        <div class="flip-top"><div class="face"><span class="val">0</span></div><div class="shade"></div></div>
        <div class="flip-bottom"><div class="face"><span class="val">0</span></div><div class="shade"></div></div>
      </div>
      `
    );

    const flip = el.querySelector(".flip");

    const topStatic = el.querySelector(".half.top .val");
    const bottomStatic = el.querySelector(".half.bottom .val");

    const flipTopEl = el.querySelector(".flip-top");
    const flipBottomEl = el.querySelector(".flip-bottom");

    const topFlipVal = el.querySelector(".flip-top .val");
    const bottomFlipVal = el.querySelector(".flip-bottom .val");

    return {
      flip,
      topStatic,
      bottomStatic,
      flipTopEl,
      flipBottomEl,
      topFlipVal,
      bottomFlipVal,
      value: "0",
      isFlipping: false,
    };
  }

  const cards = {};
  document.querySelectorAll(".time-card").forEach((c) => {
    const slot = c.getAttribute("data-slot");
    cards[slot] = createCard(c);
  });

  function setCardInstant(cardObj, val) {
    cardObj.value = val;
    cardObj.topStatic.textContent = val;
    cardObj.bottomStatic.textContent = val;
    cardObj.topFlipVal.textContent = val;
    cardObj.bottomFlipVal.textContent = val;
    cardObj.flip.classList.remove("is-flipping");
    cardObj.isFlipping = false;
  }

  function flipCardTo(cardObj, nextVal) {
    const currentVal = cardObj.value;
    if (currentVal === nextVal) return;

    if (prefersReducedMotion) {
      setCardInstant(cardObj, nextVal);
      return;
    }

    if (cardObj.isFlipping) {
      setCardInstant(cardObj, nextVal);
      return;
    }

    cardObj.isFlipping = true;

    // Static top shows NEXT immediately
    cardObj.topStatic.textContent = nextVal;
    // Static bottom stays CURRENT until finish
    cardObj.bottomStatic.textContent = currentVal;

    // Flip panels: top flips out CURRENT, bottom flips in NEXT
    cardObj.topFlipVal.textContent = currentVal;
    cardObj.bottomFlipVal.textContent = nextVal;

    cardObj.flip.classList.add("is-flipping");

    const onBottomDone = () => {
      cardObj.bottomStatic.textContent = nextVal;
      cardObj.value = nextVal;

      cardObj.flip.classList.remove("is-flipping");
      cardObj.isFlipping = false;

      cardObj.topFlipVal.textContent = nextVal;
      cardObj.bottomFlipVal.textContent = nextVal;
    };

    cardObj.flipBottomEl.addEventListener("animationend", onBottomDone, { once: true });
  }

  // ---------- Clock Logic (Local Time, 12hr, no leading 0 hour) ----------
  function updateClock(animated = true) {
    const now = new Date();

    // AM/PM
    const ampm = now.getHours() >= 12 ? "PM" : "AM";

    // 12-hour hours with NO leading 0
    let hours = now.getHours() % 12;
    if (hours === 0) hours = 12;
    const hh = String(hours); // no pad

    // minutes always 2-digit
    const mm = String(now.getMinutes()).padStart(2, "0");

    // update cards
    if (!cards.hh || !cards.mm) return;

    if (!animated) {
      setCardInstant(cards.hh, hh);
      setCardInstant(cards.mm, mm);
    } else {
      flipCardTo(cards.hh, hh);
      flipCardTo(cards.mm, mm);
    }

    // Labels
    const amEl = document.querySelector(".ampm");
    if (amEl) amEl.textContent = ampm;

    const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
    const wdEl = document.querySelector(".weekday");
    if (wdEl) wdEl.textContent = days[now.getDay()];
  }

  // Initialize (no animation on first paint)
  updateClock(false);

  // Update on the minute boundary, then every 60s
  function scheduleMinuteTicks() {
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    window.setTimeout(() => {
      updateClock(true);
      window.setInterval(() => updateClock(true), 60_000);
    }, msUntilNextMinute);
  }
  scheduleMinuteTicks();

  // ---------- Responsive Scaling to Fit Iframe ----------
 function fitStage() {
  // Reset transform so we can measure natural size
  stage.style.transform = "translate(-50%, -50%) scale(1)";

  // Use clientWidth/Height (more reliable in iframes)
  const availW = frame.clientWidth;
  const availH = frame.clientHeight;

  // Measure the stage's natural rendered size
  const rect = stage.getBoundingClientRect();
  const stageW = rect.width;
  const stageH = rect.height;

  // Avoid divide-by-zero
  if (!stageW || !stageH) return;

  const scale = Math.min(availW / stageW, availH / stageH);
  const safeScale = Number.isFinite(scale) ? Math.max(scale, 0.01) : 1;

  // Always center + scale together
  stage.style.transform = `translate(-50%, -50%) scale(${safeScale})`;
}

  const ro = new ResizeObserver(() => fitStage());
  ro.observe(frame);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => fitStage()).catch(() => fitStage());
  } else {
    window.addEventListener("load", fitStage, { once: true });
  }

  window.setTimeout(() => fitStage(), 50);
})();