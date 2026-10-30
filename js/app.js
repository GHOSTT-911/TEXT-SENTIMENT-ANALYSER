/**
 * Neon Pulse — app shell: routing between modules, theme, nav animation, boot.
 */
(function (global) {
  "use strict";

  const { store } = global.NP;
  const FX = global.FX;
  const VIEWS = ["analyzer", "batch", "compare", "dashboard", "evaluation", "about"];
  const PHRASES = {
    analyzer: ["English ho ya Hinglish, mood samajh lega.", "Paste a review and see which words decide the mood.", "Press Ctrl + K to jump anywhere."],
    batch: ["Analyze thousands of reviews in seconds.", "Upload a CSV, export the results."],
    compare: ["Which message lands better?", "Put two texts head-to-head."],
    dashboard: ["Every analysis, visualized.", "Spot trends in your mood data."],
    evaluation: ["Rules vs machine learning — measured, not guessed.", "5 engines · k-fold cross-validation · confusion matrices."],
    about: ["How the system works under the hood.", "Architecture · Algorithm · Team."],
  };
  let current = null;
  let typeTimer = null;

  function typewrite(phrases) {
    const el = document.getElementById("typewriter");
    clearTimeout(typeTimer);
    if (FX.reduce()) return (el.textContent = phrases[0]);
    let p = 0, i = 0, del = false;
    const tick = () => {
      const w = phrases[p];
      el.textContent = w.slice(0, i);
      let delay = del ? 22 : 45;
      if (!del && i < w.length) i++;
      else if (!del) {
        del = true;
        delay = 2200;
      } else if (i > 0) i--;
      else {
        del = false;
        p = (p + 1) % phrases.length;
        delay = 300;
      }
      typeTimer = setTimeout(tick, delay);
    };
    tick();
  }

  function moveIndicator(link) {
    const ind = document.querySelector(".nav-indicator");
    if (!ind || !link) return;
    const nav = link.parentElement;
    const r = link.getBoundingClientRect(), n = nav.getBoundingClientRect();
    ind.style.transform = `translate(${r.left - n.left}px, ${r.top - n.top}px)`;
    ind.style.width = `${r.width}px`;
    ind.style.height = `${r.height}px`;
  }

  function show(view) {
    if (!VIEWS.includes(view)) view = "analyzer";
    if (view === current) return;
    const next = document.getElementById(`view-${view}`);
    const prev = current && document.getElementById(`view-${current}`);
    if (prev) {
      prev.classList.remove("enter");
      prev.hidden = true;
    }
    next.hidden = false;
    next.classList.remove("enter");
    void next.offsetWidth;
    next.classList.add("enter");
    current = view;

    document.querySelectorAll(".nav-link").forEach((a) => {
      const on = a.dataset.view === view;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    moveIndicator(document.querySelector(`.nav-link[data-view="${view}"]`));

    const title = document.getElementById("view-title");
    title.textContent = next.dataset.title;
    title.classList.remove("drawn");
    void title.offsetWidth;
    title.classList.add("drawn");
    document.getElementById("view-eyebrow").textContent = next.dataset.eyebrow;
    document.title = `${next.dataset.title} · Neon Pulse`;
    typewrite(PHRASES[view]);

    FX.reveal(next);
    if (view === "dashboard") global.DashboardView.render();
    if (view === "about") {
      const pipe = document.getElementById("pipeline");
      pipe.classList.remove("run");
      void pipe.offsetWidth;
      pipe.classList.add("run");
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    document.querySelector(".theme-text").textContent = t === "dark" ? "Day mode" : "Night mode";
    try {
      localStorage.setItem("neon-pulse-theme-v4", t);
    } catch (_) {}
  }

  function rerenderCharts() {
    document.getElementById("gauge")._gauge = null;
    document.getElementById("face")._face = null;
    global.AnalyzerView.rerender();
    global.BatchView.rerender();
    global.CompareView.rerender();
    global.EvaluationView.rerender();
    if (current === "dashboard") global.DashboardView.render();
    const v = document.getElementById("compound");
    if (v && !document.getElementById("verdict-body").hidden) {
      global.Charts.gauge(document.getElementById("gauge"), Number(v.dataset.value || 0), { duration: 0 });
      global.Charts.face(document.getElementById("face"), Number(v.dataset.value || 0));
    }
  }

  function updateCount() {
    FX.countUp(document.getElementById("engine-count"), store.count(), { duration: 600 });
  }

  function init() {
    let theme = "light";
    try {
      theme = localStorage.getItem("neon-pulse-theme-v4") || "light";
    } catch (_) {}
    setTheme(theme);
    const toggleTheme = () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
      document.body.classList.add("theme-anim");
      setTimeout(() => document.body.classList.remove("theme-anim"), 600);
      rerenderCharts();
    };
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

    global.EvaluationView.init();
    global.AnalyzerView.init();
    global.BatchView.init();
    global.CompareView.init();
    global.DashboardView.init();

    FX.tooltips();

    // Ctrl + K command palette
    const go = (v) => () => (location.hash = `#${v}`);
    const click = (id) => () => {
      const b = document.getElementById(id);
      if (b && !b.disabled && b.offsetParent !== null) b.click();
      else FX.toast("Run an analysis first", "info");
    };
    const commands = [
      { group: "Go to", label: "Analyzer", keywords: "home single text", run: go("analyzer") },
      { group: "Go to", label: "Batch analysis", keywords: "csv bulk many", run: go("batch") },
      { group: "Go to", label: "Compare two texts", keywords: "versus a b", run: go("compare") },
      { group: "Go to", label: "Dashboard", keywords: "history trend stats", run: go("dashboard") },
      { group: "Go to", label: "Model evaluation", keywords: "accuracy f1 confusion ml", run: go("evaluation") },
      { group: "Go to", label: "About the project", keywords: "team abstract architecture", run: go("about") },
      { group: "Settings", label: "Switch day / night mode", keywords: "theme dark light", run: toggleTheme },
      { group: "Analyzer", label: "Focus the text box", keywords: "type write input", run: () => { go("analyzer")(); setTimeout(() => document.getElementById("text-input").focus(), 80); } },
      { group: "Analyzer", label: "Download mood card (PNG)", keywords: "image share export", run: click("card-btn") },
      { group: "Analyzer", label: "Download report (JSON)", keywords: "export save", run: click("json-btn") },
      { group: "Analyzer", label: "Clear the text box", keywords: "reset empty", run: () => document.getElementById("clear-btn").click() },
      ...global.AnalyzerView.SAMPLES.map(([label, text]) => ({
        group: "Try a sample",
        label: label.replace(/^\S+\s/, ""),
        keywords: "sample example demo " + text.slice(0, 40),
        run: () => { go("analyzer")(); setTimeout(() => global.AnalyzerView.load(text), 60); },
      })),
      { group: "Try a sample", label: "Sarcastic complaint", keywords: "sarcasm irony", run: () => { go("analyzer")(); setTimeout(() => global.AnalyzerView.load("Oh great, the delivery is late again and the box is damaged. Just what I needed 🙄 Wah re customer care, kya baat hai!"), 60); } },
      { group: "Dashboard", label: "Load demo data", keywords: "fill sample", run: () => { go("dashboard")(); setTimeout(() => { const b = document.getElementById("dash-demo"); if (b.offsetParent) b.click(); else document.getElementById("d-demo2").click(); }, 80); } },
      { group: "Evaluation", label: "Run model evaluation", keywords: "k-fold cross validation", run: () => { go("evaluation")(); setTimeout(() => document.getElementById("eval-run").click(), 120); } },
    ];
    const pal = global.Palette.init(commands);
    document.getElementById("pal-open").addEventListener("click", pal.open);

    store.onChange(updateCount);
    updateCount();

    addEventListener("hashchange", () => show(location.hash.slice(1)));
    addEventListener("resize", () => moveIndicator(document.querySelector(".nav-link.active")));

    // Keyboard shortcuts: Alt+1..5 switch modules
    addEventListener("keydown", (e) => {
      if (e.altKey && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        location.hash = `#${VIEWS[Number(e.key) - 1]}`;
      }
    });

    FX.splash(() => {
      document.body.classList.add("ready");
      show(location.hash.slice(1) || "analyzer");
      setTimeout(() => moveIndicator(document.querySelector(".nav-link.active")), 50);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
