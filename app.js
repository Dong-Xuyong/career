/* Career pipeline UI. Reads and writes career.json through GhSync. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;

  var core = window.CareerCore;
  var APP_ID = core ? core.APP_ID : "career";
  var SCHEMA_VERSION = core ? core.SCHEMA_VERSION : 1;
  var SAVE_DELAY = 2500;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var FALLBACK_SEED = {
    app: "career",
    schemaVersion: 1,
    owner: "zoro",
    updatedAt: null,
    stages: [
      { id: "saved", label: "Saved" },
      { id: "applied", label: "Applied" },
      { id: "screening", label: "Screening" },
      { id: "interview", label: "Interview" },
      { id: "offer", label: "Offer" },
      { id: "closed", label: "Closed" }
    ],
    jobs: [],
    portfolio: [
      {
        id: "prj_law-wiki",
        title: "Law Wiki",
        url: "https://github.com/Dong-Xuyong/law-wiki",
        repo: "Dong-Xuyong/law-wiki",
        summary: "",
        tags: [],
        order: 1,
        updatedAt: "2026-10-16T00:00:00Z"
      }
    ]
  };

  var els = {
    sync: document.getElementById("sync-label"),
    main: document.getElementById("main"),
    demoBanner: document.getElementById("demo-banner"),
    formatBanner: document.getElementById("format-banner"),
    fab: document.getElementById("fab"),
    connect: document.getElementById("btn-connect")
  };

  var doc = null;
  var demo = false;
  var dirty = false;
  var saving = false;
  var saveAgain = false;
  var saveTimer = null;
  var loading = false;
  var readOnly = false;
  var holdSaves = false;
  var painted = "";
  var draft = null;
  var listQuery = "";
  var listStage = "";
  var sectionOpen = {};

  function hasToken() {
    try {
      var cfg = JSON.parse(localStorage.getItem("dong-gh-sync") || "null");
      return !!(cfg && cfg.token);
    } catch (err) {
      return false;
    }
  }

  function setSync(text) {
    if (!els.sync) return;
    els.sync.textContent = text;
    els.sync.title = text;
  }

  function hhmm() {
    var now = new Date();
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return pad(now.getHours()) + ":" + pad(now.getMinutes());
  }

  function h(tag, props) {
    var node = document.createElement(tag);
    if (!props) return node;
    Object.keys(props).forEach(function (key) {
      var value = props[key];
      if (value == null) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "hidden") node.hidden = !!value;
      else if (key === "disabled") node.disabled = !!value;
      else node.setAttribute(key, String(value));
    });
    return node;
  }

  function add(parent) {
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i]) parent.appendChild(arguments[i]);
    }
    return parent;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function parseRoute() {
    var raw = (location.hash || "#/board").replace(/^#/, "");
    var parts = raw.split("/").filter(Boolean);
    if (!parts.length || parts[0] === "board") return { name: "board" };
    if (parts[0] === "list") return { name: "list" };
    if (parts[0] === "portfolio") return { name: "portfolio" };
    if (parts[0] === "job") return { name: "job", id: parts[1] || "new" };
    if (parts[0] === "project") return { name: "project", id: parts[1] || "new" };
    return { name: "board" };
  }

  function editsLocked() {
    return readOnly || holdSaves;
  }

  function idsOf(list) {
    return (list || []).map(function (item) { return item && item.id; }).filter(Boolean);
  }

  function liveJobs() {
    return (doc.jobs || []).filter(function (job) { return job && job.deleted !== true; });
  }

  function findJob(id) {
    for (var i = 0; i < (doc.jobs || []).length; i++) {
      if (doc.jobs[i].id === id && doc.jobs[i].deleted !== true) return doc.jobs[i];
    }
    return null;
  }

  function findProject(id) {
    for (var i = 0; i < (doc.portfolio || []).length; i++) {
      if (doc.portfolio[i].id === id && doc.portfolio[i].deleted !== true) return doc.portfolio[i];
    }
    return null;
  }

  function replaceJob(next) {
    var jobs = doc.jobs || (doc.jobs = []);
    for (var i = 0; i < jobs.length; i++) {
      if (jobs[i].id === next.id) {
        jobs[i] = next;
        return;
      }
    }
    jobs.push(next);
  }

  function replaceProject(next) {
    var projects = doc.portfolio || (doc.portfolio = []);
    for (var i = 0; i < projects.length; i++) {
      if (projects[i].id === next.id) {
        projects[i] = next;
        return;
      }
    }
    projects.push(next);
  }

  function stageLabel(id) {
    var stages = (doc && doc.stages) || core.STAGES;
    for (var i = 0; i < stages.length; i++) {
      if (stages[i].id === id) return stages[i].label;
    }
    return id;
  }

  function shortDate(iso) {
    if (!iso || String(iso).length < 10) return "";
    var parts = String(iso).slice(0, 10).split("-");
    var month = MONTHS[Number(parts[1]) - 1] || parts[1];
    return String(Number(parts[2])) + " " + month;
  }

  function isSectionOpen(id) {
    if (Object.prototype.hasOwnProperty.call(sectionOpen, id)) return !!sectionOpen[id];
    return id !== "closed";
  }

  function fieldFocused() {
    var el = document.activeElement;
    if (!el || el === document.body) return false;
    return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
  }

  function scheduleSave() {
    if (demo || readOnly || holdSaves || !hasToken()) return;
    dirty = true;
    setSync("✏️ Saving soon…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushNow, SAVE_DELAY);
  }

  function markDirty() {
    if (!doc) return;
    doc.updatedAt = new Date().toISOString();
    if (demo) {
      setSync("Demo data");
      return;
    }
    scheduleSave();
  }

  function mergeRemote(remote) {
    var merged = core.merge(doc, remote);
    if (core.isNewerFormat(merged, SCHEMA_VERSION)) {
      doc = core.normalize(remote);
      readOnly = true;
      holdSaves = true;
      throw new Error("Newer data format, update the app");
    }
    doc = merged;
  }

  function pushNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!doc || demo || readOnly || holdSaves || !hasToken() || !window.GhSync) return;
    if (saving) {
      saveAgain = true;
      return;
    }
    saving = true;
    setSync("☁️ Saving…");
    core.saveOnceWithRetry(function () {
      return GhSync.save(APP_ID, function () {
        doc.updatedAt = new Date().toISOString();
        return doc;
      }, mergeRemote, { quiet: true });
    }).then(function () {
      saving = false;
      if (!saveAgain) dirty = false;
      setSync("✅ Saved " + hhmm());
      if (saveAgain) {
        saveAgain = false;
        pushNow();
      } else {
        render();
      }
    }, function (err) {
      saving = false;
      saveAgain = false;
      if (readOnly || (err && /Newer data format/.test(String(err.message || err)))) {
        readOnly = true;
        holdSaves = true;
        setSync("Newer data format, update the app");
        render();
        return;
      }
      if (err && err.careerGaveUp) {
        holdSaves = true;
        dirty = true;
        setSync("⚠️ Not saved, reload");
        return;
      }
      dirty = true;
      setSync("⚠️ " + (err && err.message ? err.message : "Not saved"));
    });
  }

  function useSeed() {
    demo = false;
    fetch("career.seed.json", { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("Missing seed");
      return res.json();
    }).catch(function () {
      return FALLBACK_SEED;
    }).then(function (seed) {
      doc = core.normalize(seed);
      dirty = false;
      readOnly = false;
      demo = false;
      render();
      setSync("☁️ Nothing saved yet");
    });
  }

  function enterDemo() {
    if (demo && doc) {
      setSync("Demo data");
      return;
    }
    demo = true;
    readOnly = false;
    if (!window.CAREER_DEMO) {
      setSync("Demo data failed to load");
      render();
      return;
    }
    doc = core.normalize(window.CAREER_DEMO);
    setSync("Demo data");
    render();
  }

  function pull() {
    if (!window.GhSync) {
      setSync("GitHub sync failed to load.");
      if (!hasToken()) enterDemo();
      return;
    }
    if (loading) return;
    loading = true;
    setSync("☁️ Syncing…");
    GhSync.load(APP_ID, function (remote) {
      doc = core.normalize(remote);
      demo = false;
      dirty = false;
      readOnly = core.isNewerFormat(doc, SCHEMA_VERSION);
      if (readOnly) holdSaves = true;
    }).then(function (msg) {
      loading = false;
      if (!hasToken()) {
        enterDemo();
        return;
      }
      if (msg === "Nothing saved on GitHub yet") {
        useSeed();
        return;
      }
      render();
      setSync(readOnly ? "Newer data format, update the app" : "☁️ Synced " + hhmm());
    }, function (err) {
      loading = false;
      if (!hasToken()) {
        enterDemo();
        return;
      }
      setSync("⚠️ " + (err && err.message ? err.message : "Could not load"));
    });
  }

  function autoLoad() {
    if (!hasToken()) {
      if (!demo) enterDemo();
      return;
    }
    if (loading || saving || saveTimer || dirty || fieldFocused() || holdSaves) return;
    pull();
  }

  function safeAnchor(url, text, className) {
    if (core.isSafeUrl(url)) {
      return h("a", {
        class: className,
        href: String(url).trim(),
        target: "_blank",
        rel: "noopener",
        text: text
      });
    }
    return h("span", { class: className, text: text });
  }

  function jobCard(job, today) {
    var card = h("article", { class: "job-card dx-card", "data-id": job.id });
    var open = h("a", { class: "job-card__open", href: "#/job/" + job.id });
    add(open, h("h2", { class: "job-card__company", text: job.company || "Untitled" }));
    add(open, h("p", { class: "job-card__role", text: job.role || "" }));
    add(open, h("p", {
      class: job.nextStep ? "job-card__note" : "job-card__note is-empty",
      text: job.nextStep || "No next step"
    }));
    var meta = h("div", { class: "job-card__row" });
    if (job.nextStepDue) {
      var overdue = core.isOverdue(job.nextStepDue, today);
      var label = (overdue ? "Overdue " : "") + shortDate(job.nextStepDue);
      add(meta, h("span", {
        class: overdue ? "badge is-overdue" : "badge",
        text: label
      }));
    }
    var age = core.formatAge(core.stageAgeDays(job.date, today));
    if (age) add(meta, h("span", { class: "age", text: age, title: "Days in this stage" }));
    if (job.stage === "closed" && job.outcome) {
      add(meta, h("span", { class: "badge", text: job.outcome }));
    }
    open.appendChild(meta);
    card.appendChild(open);
    if (job.link) {
      var linkRow = h("p", { class: "job-card__link" });
      linkRow.appendChild(safeAnchor(job.link, job.link, "job-card__url"));
      card.appendChild(linkRow);
    }
    var move = h("label", { class: "job-card__move" });
    add(move, h("span", { class: "sr-only", text: "Stage for " + (job.company || "job") }));
    var select = h("select", {
      "data-action": "move-stage",
      "data-id": job.id,
      "aria-label": "Stage for " + (job.company || "job"),
      disabled: editsLocked()
    });
    (doc.stages || []).forEach(function (stage) {
      var opt = h("option", { value: stage.id, text: stage.label });
      if (stage.id === job.stage) opt.selected = true;
      select.appendChild(opt);
    });
    move.appendChild(select);
    card.appendChild(move);
    return card;
  }

  function renderBoard() {
    clear(els.main);
    var today = core.lisbonToday();
    var groups = core.groupByStage(doc);
    if (!liveJobs().length) {
      els.main.appendChild(h("p", { class: "hint dx-on-bg", text: "No jobs yet. Use + Job to add one." }));
    }
    groups.forEach(function (group) {
      var open = isSectionOpen(group.id);
      var section = h("section", { class: "stage dx-card", "data-stage": group.id });
      var toggle = h("button", {
        type: "button",
        class: "stage__toggle",
        "data-action": "toggle-stage",
        "data-stage": group.id,
        "aria-expanded": open ? "true" : "false"
      });
      add(toggle,
        h("span", { class: "stage__name", text: group.label }),
        h("span", { class: "stage__count", text: String(group.jobs.length) })
      );
      section.appendChild(toggle);
      var body = h("div", { class: "stage__body", hidden: !open });
      if (!group.jobs.length) {
        body.appendChild(h("p", { class: "empty", text: "No jobs" }));
      } else {
        group.jobs.forEach(function (job) { body.appendChild(jobCard(job, today)); });
      }
      section.appendChild(body);
      els.main.appendChild(section);
    });
  }

  function renderListShell() {
    clear(els.main);
    var label = h("label", { class: "search-label", for: "q" });
    add(label, h("span", { class: "sr-only", text: "Search jobs" }));
    var input = h("input", {
      id: "q",
      class: "search-input",
      type: "search",
      placeholder: "Company, role, or notes",
      value: listQuery,
      autocomplete: "off"
    });
    label.appendChild(input);
    els.main.appendChild(label);
    var filters = h("div", { class: "filters", role: "group", "aria-label": "Stage" });
    var chips = [{ id: "", label: "All" }].concat(core.STAGES.map(function (stage) {
      return { id: stage.id, label: stage.label };
    }));
    chips.forEach(function (chip) {
      filters.appendChild(h("button", {
        type: "button",
        class: chip.id === listStage ? "seg active" : "seg",
        "data-action": "stage-filter",
        "data-stage": chip.id,
        text: chip.label
      }));
    });
    els.main.appendChild(filters);
    els.main.appendChild(h("p", { class: "hint dx-on-bg", text: "Sorted by due date, then stage date." }));
    els.main.appendChild(h("div", { id: "list-results" }));
  }

  function fillList() {
    var host = document.getElementById("list-results");
    if (!host) return;
    clear(host);
    var today = core.lisbonToday();
    var jobs = core.sortJobs(core.filterJobs(doc.jobs, listQuery, listStage));
    if (!jobs.length) {
      host.appendChild(h("p", { class: "empty dx-on-bg", text: "No matching jobs" }));
      return;
    }
    jobs.forEach(function (job) { host.appendChild(jobCard(job, today)); });
  }

  function liveProjects() {
    return (doc.portfolio || []).filter(function (project) {
      return project && project.deleted !== true;
    }).slice().sort(function (a, b) {
      return (Number(a.order) || 0) - (Number(b.order) || 0);
    });
  }

  function renderPortfolio() {
    clear(els.main);
    if (!editsLocked()) {
      els.main.appendChild(h("a", { class: "text-btn", href: "#/project/new", text: "Add project" }));
    }
    var projects = liveProjects();
    if (!projects.length) {
      els.main.appendChild(h("p", { class: "empty dx-on-bg", text: "No projects yet." }));
      return;
    }
    projects.forEach(function (project, index) {
      var card = h("article", { class: "job-card dx-card", "data-id": project.id });
      card.appendChild(safeAnchor(project.url, project.title || "Untitled", "job-card__company project-title"));
      if (project.url) {
        var urlRow = h("p", { class: "job-card__link" });
        urlRow.appendChild(safeAnchor(project.url, project.url, "job-card__url"));
        card.appendChild(urlRow);
      }
      if (project.summary) card.appendChild(h("p", { class: "job-card__note", text: project.summary }));
      if (project.repo) card.appendChild(h("p", { class: "job-card__role", text: project.repo }));
      if (project.tags && project.tags.length) {
        var tags = h("ul", { class: "tags" });
        project.tags.forEach(function (tag) {
          tags.appendChild(h("li", { text: tag }));
        });
        card.appendChild(tags);
      }
      if (!editsLocked()) {
        var actions = h("div", { class: "card-actions" });
        add(actions,
          h("button", {
            type: "button",
            "data-action": "project-up",
            "data-id": project.id,
            text: "Up",
            disabled: index === 0
          }),
          h("button", {
            type: "button",
            "data-action": "project-down",
            "data-id": project.id,
            text: "Down",
            disabled: index === projects.length - 1
          }),
          h("a", { class: "text-btn", href: "#/project/" + project.id, text: "Edit" }),
          h("button", {
            type: "button",
            class: "danger",
            "data-action": "project-delete",
            "data-id": project.id,
            text: "Delete"
          })
        );
        card.appendChild(actions);
      }
      els.main.appendChild(card);
    });
  }

  function field(name, label, control) {
    var wrap = h("label", { class: "field", id: name === "outcome" ? "outcome-field" : null });
    add(wrap, h("span", { text: label }), control);
    return wrap;
  }

  function textInput(name, value, type) {
    return h("input", {
      name: name,
      type: type || "text",
      value: value || "",
      autocomplete: "off",
      disabled: editsLocked()
    });
  }

  function ensureJobDraft(id) {
    if (draft && draft.kind === "job" && (id === "new" ? draft.isNew : draft.record.id === id)) return draft;
    if (id === "new") {
      var now = new Date().toISOString();
      draft = {
        kind: "job",
        isNew: true,
        record: core.blankJob(core.newId("job", idsOf(doc.jobs)), core.lisbonToday(), now)
      };
      return draft;
    }
    var job = findJob(id);
    if (!job) {
      draft = null;
      return null;
    }
    draft = { kind: "job", isNew: false, record: job };
    return draft;
  }

  function ensureProjectDraft(id) {
    if (draft && draft.kind === "project" && (id === "new" ? draft.isNew : draft.record.id === id)) return draft;
    if (id === "new") {
      var now = new Date().toISOString();
      var order = liveProjects().reduce(function (max, project) {
        return Math.max(max, Number(project.order) || 0);
      }, 0) + 1;
      draft = {
        kind: "project",
        isNew: true,
        record: core.blankProject(core.newId("prj", idsOf(doc.portfolio)), order, now)
      };
      return draft;
    }
    var project = findProject(id);
    if (!project) {
      draft = null;
      return null;
    }
    draft = { kind: "project", isNew: false, record: project };
    return draft;
  }

  function stageSelect(record) {
    var select = h("select", { name: "stage", disabled: editsLocked() });
    (doc.stages || core.STAGES).forEach(function (stage) {
      var opt = h("option", { value: stage.id, text: stage.label });
      if (stage.id === record.stage) opt.selected = true;
      select.appendChild(opt);
    });
    return select;
  }

  function outcomeSelect(record) {
    var select = h("select", { name: "outcome", disabled: editsLocked() });
    select.appendChild(h("option", { value: "", text: "—" }));
    ["rejected", "withdrawn", "declined", "accepted"].forEach(function (outcome) {
      var opt = h("option", { value: outcome, text: outcome });
      if (record.outcome === outcome) opt.selected = true;
      select.appendChild(opt);
    });
    return select;
  }

  function renderJobEditor() {
    clear(els.main);
    var route = parseRoute();
    var current = ensureJobDraft(route.id);
    if (!current) {
      add(els.main,
        h("a", { class: "text-btn", href: "#/board", text: "Back" }),
        h("p", { class: "empty dx-on-bg", text: "Job not found." })
      );
      return;
    }
    var record = current.record;
    add(els.main, h("a", { class: "text-btn", href: "#/board", text: "Back" }));
    var form = h("form", { id: "editor", class: "dx-card" });
    form.appendChild(h("h2", { class: "editor-title", text: current.isNew ? "New job" : (record.company || "Job") }));
    add(form,
      field("company", "Company", textInput("company", record.company)),
      field("role", "Role", textInput("role", record.role)),
      field("stage", "Stage", stageSelect(record))
    );
    var outcome = field("outcome", "Outcome", outcomeSelect(record));
    outcome.hidden = record.stage !== "closed";
    form.appendChild(outcome);
    add(form,
      field("nextStep", "Next step", textInput("nextStep", record.nextStep)),
      field("nextStepDue", "Next step due", textInput("nextStepDue", record.nextStepDue, "date")),
      field("date", "Entered stage", textInput("date", record.date, "date")),
      field("appliedOn", "Applied on", textInput("appliedOn", record.appliedOn, "date")),
      field("link", "Link", textInput("link", record.link)),
      field("notes", "Notes", (function () {
        var box = h("textarea", { name: "notes", disabled: editsLocked() });
        box.value = record.notes || "";
        return box;
      })())
    );
    if (record.stageHistory && record.stageHistory.length) {
      var history = h("div", { class: "field" });
      history.appendChild(h("span", { text: "Stage history" }));
      var list = h("ol", { class: "history" });
      record.stageHistory.forEach(function (item) {
        list.appendChild(h("li", { text: stageLabel(item.stage) + " · " + (item.at || "") }));
      });
      history.appendChild(list);
      form.appendChild(history);
    }
    var actions = h("div", { class: "form-actions" });
    if (!editsLocked()) {
      actions.appendChild(h("button", { type: "submit", text: "Save" }));
      if (!current.isNew) {
        actions.appendChild(h("button", { type: "button", class: "danger", "data-action": "delete-draft", text: "Delete" }));
      }
    }
    form.appendChild(actions);
    els.main.appendChild(form);
  }

  function renderProjectEditor() {
    clear(els.main);
    var route = parseRoute();
    var current = ensureProjectDraft(route.id);
    if (!current) {
      add(els.main,
        h("a", { class: "text-btn", href: "#/portfolio", text: "Back" }),
        h("p", { class: "empty dx-on-bg", text: "Project not found." })
      );
      return;
    }
    var record = current.record;
    add(els.main, h("a", { class: "text-btn", href: "#/portfolio", text: "Back" }));
    var form = h("form", { id: "editor", class: "dx-card" });
    form.appendChild(h("h2", { class: "editor-title", text: current.isNew ? "New project" : (record.title || "Project") }));
    var summary = h("textarea", { name: "summary", disabled: editsLocked() });
    summary.value = record.summary || "";
    add(form,
      field("title", "Title", textInput("title", record.title)),
      field("url", "URL", textInput("url", record.url)),
      field("repo", "Repo", textInput("repo", record.repo || "")),
      field("summary", "Summary", summary),
      field("tags", "Tags", textInput("tags", (record.tags || []).join(", ")))
    );
    var actions = h("div", { class: "form-actions" });
    if (!editsLocked()) {
      actions.appendChild(h("button", { type: "submit", text: "Save" }));
      if (!current.isNew) {
        actions.appendChild(h("button", { type: "button", class: "danger", "data-action": "delete-draft", text: "Delete" }));
      }
    }
    form.appendChild(actions);
    els.main.appendChild(form);
  }

  function paintChrome() {
    var route = parseRoute();
    if (els.demoBanner) els.demoBanner.hidden = !demo;
    if (els.formatBanner) els.formatBanner.hidden = !readOnly;
    if (els.fab) {
      els.fab.hidden = editsLocked() || !(route.name === "board" || route.name === "list");
    }
    document.querySelectorAll("#tabbar [data-tab]").forEach(function (btn) {
      var tab = btn.getAttribute("data-tab");
      var on = tab === route.name ||
        (route.name === "job" && tab === "board") ||
        (route.name === "project" && tab === "portfolio");
      btn.classList.toggle("active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  function render() {
    if (!els.main || !core) return;
    paintChrome();
    if (!doc) {
      clear(els.main);
      els.main.appendChild(h("p", { class: "empty dx-on-bg", text: "Loading…" }));
      painted = "";
      return;
    }
    var route = parseRoute();
    if (route.name === "list") {
      if (painted !== "list" || !document.getElementById("q")) {
        painted = "list";
        renderListShell();
      }
      fillList();
      return;
    }
    if (route.name === "job" || route.name === "project") {
      var key = route.name + ":" + route.id;
      if (painted === key && document.getElementById("editor")) {
        syncOutcomeField();
        return;
      }
      painted = key;
      if (route.name === "job") renderJobEditor();
      else renderProjectEditor();
      return;
    }
    painted = route.name;
    draft = null;
    if (route.name === "portfolio") renderPortfolio();
    else renderBoard();
  }

  function syncOutcomeField() {
    var wrap = document.getElementById("outcome-field");
    if (!wrap || !draft || draft.kind !== "job") return;
    wrap.hidden = draft.record.stage !== "closed";
  }

  function writeField(record, name, value) {
    if (name === "company" || name === "role" || name === "nextStep" || name === "link" ||
        name === "notes" || name === "title" || name === "summary" || name === "url") {
      record[name] = value;
    } else if (name === "nextStepDue" || name === "date" || name === "appliedOn") {
      record[name] = value || null;
    } else if (name === "outcome") {
      record.outcome = value || null;
    } else if (name === "repo") {
      record.repo = value.trim() ? value.trim() : null;
    } else if (name === "tags") {
      record.tags = value.split(",").map(function (part) { return part.trim(); }).filter(Boolean);
    } else {
      return false;
    }
    if (draft && !draft.isNew) record.updatedAt = new Date().toISOString();
    return true;
  }

  function onMoveStage(select) {
    if (!doc || editsLocked()) return;
    var job = findJob(select.getAttribute("data-id"));
    if (!job) return;
    var next = core.moveStage(job, select.value, core.lisbonToday(), new Date().toISOString());
    replaceJob(next);
    sectionOpen[next.stage] = true;
    if (!demo) markDirty();
    else setSync("Demo data");
    painted = "";
    render();
  }

  function onClick(event) {
    var btn = event.target && event.target.closest ? event.target.closest("[data-action]") : null;
    if (!btn || !doc) return;
    var action = btn.getAttribute("data-action");
    if (action === "toggle-stage") {
      var stageId = btn.getAttribute("data-stage");
      sectionOpen[stageId] = !isSectionOpen(stageId);
      painted = "";
      render();
      return;
    }
    if (action === "stage-filter") {
      listStage = btn.getAttribute("data-stage") || "";
      document.querySelectorAll(".filters .seg").forEach(function (seg) {
        seg.classList.toggle("active", (seg.getAttribute("data-stage") || "") === listStage);
      });
      fillList();
      return;
    }
    if (action === "project-up" || action === "project-down") {
      if (editsLocked()) return;
      var dir = action === "project-up" ? -1 : 1;
      doc.portfolio = core.reorderPortfolio(doc.portfolio, btn.getAttribute("data-id"), dir, new Date().toISOString());
      if (!demo) markDirty();
      else setSync("Demo data");
      painted = "";
      render();
      return;
    }
    if (action === "project-delete") {
      if (editsLocked()) return;
      var project = findProject(btn.getAttribute("data-id"));
      if (!project) return;
      if (!window.confirm("Delete this project? It stays in the file, hidden.")) return;
      replaceProject(core.tombstone(project, new Date().toISOString()));
      if (!demo) {
        markDirty();
        pushNow();
      } else setSync("Demo data");
      painted = "";
      render();
      return;
    }
    if (action === "delete-draft") {
      event.preventDefault();
      deleteDraft();
    }
  }

  function onInput(event) {
    var target = event.target;
    if (!target || target.id === "q") {
      if (target && target.id === "q") {
        listQuery = target.value;
        fillList();
      }
      return;
    }
    if (!draft || !target.name || target.name === "stage") return;
    if (!writeField(draft.record, target.name, target.value)) return;
    persistDraftEdit();
  }

  function draftInvalid() {
    if (!draft || draft.isNew) return false;
    if (draft.kind === "job") {
      return !String(draft.record.company || "").trim() || !String(draft.record.role || "").trim();
    }
    return !String(draft.record.title || "").trim();
  }

  function persistDraftEdit() {
    if (!draft || draft.isNew || demo) return;
    if (draftInvalid()) {
      clearTimeout(saveTimer);
      saveTimer = null;
      dirty = false;
      setSync(draft.kind === "job" ? "⚠️ Company and role are required" : "⚠️ Title is required");
      return;
    }
    markDirty();
  }

  function onChange(event) {
    var target = event.target;
    if (!target) return;
    if (target.getAttribute("data-action") === "move-stage") {
      onMoveStage(target);
      return;
    }
    if (!draft || !target.name) return;
    if (target.name === "stage" && draft.kind === "job") {
      draft.record = core.moveStage(draft.record, target.value, core.lisbonToday(), new Date().toISOString());
      if (!draft.isNew) replaceJob(draft.record);
      sectionOpen[draft.record.stage] = true;
      painted = "";
      render();
      if (!draft.isNew && !demo) markDirty();
      return;
    }
    if (!writeField(draft.record, target.name, target.value)) return;
    persistDraftEdit();
  }

  function deleteDraft() {
    if (!draft || draft.isNew || editsLocked()) {
      location.hash = draft && draft.kind === "project" ? "#/portfolio" : "#/board";
      return;
    }
    var kind = draft.kind;
    var noun = kind === "job" ? "job" : "project";
    if (!window.confirm("Delete this " + noun + "? It stays in the file, hidden.")) return;
    var next = core.tombstone(draft.record, new Date().toISOString());
    if (kind === "job") replaceJob(next);
    else replaceProject(next);
    draft = null;
    if (!demo) {
      markDirty();
      pushNow();
    } else setSync("Demo data");
    location.hash = kind === "job" ? "#/board" : "#/portfolio";
  }

  function onSubmit(event) {
    var form = event.target;
    if (!form || form.id !== "editor") return;
    event.preventDefault();
    if (!draft || editsLocked()) return;
    if (draft.kind === "job") {
      var company = String(draft.record.company || "").trim();
      var role = String(draft.record.role || "").trim();
      if (!company || !role) {
        setSync("⚠️ Company and role are required");
        return;
      }
      draft.record.company = company;
      draft.record.role = role;
      draft.record.updatedAt = new Date().toISOString();
      if (draft.isNew) doc.jobs.push(draft.record);
    } else {
      var title = String(draft.record.title || "").trim();
      if (!title) {
        setSync("⚠️ Title is required");
        return;
      }
      draft.record.title = title;
      draft.record.updatedAt = new Date().toISOString();
      if (draft.isNew) doc.portfolio.push(draft.record);
    }
    var nextHash = draft.kind === "job" ? "#/board" : "#/portfolio";
    draft = null;
    if (!demo) {
      markDirty();
      pushNow();
    } else setSync("Demo data");
    location.hash = nextHash;
  }

  if (!els.main || !core) {
    setSync("Career failed to load.");
    return;
  }

  els.main.addEventListener("click", onClick);
  els.main.addEventListener("input", onInput);
  els.main.addEventListener("change", onChange);
  els.main.addEventListener("submit", onSubmit);
  if (els.connect) els.connect.addEventListener("click", pull);
  document.querySelectorAll("#tabbar [data-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      location.hash = "#/" + btn.getAttribute("data-tab");
    });
  });
  window.addEventListener("hashchange", function () {
    draft = null;
    painted = "";
    render();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && (saveTimer || (dirty && !demo))) pushNow();
    if (document.visibilityState === "visible") autoLoad();
  });

  if (!location.hash || location.hash === "#" || location.hash === "#/") {
    history.replaceState(null, "", "#/board");
  }
  if (!hasToken()) enterDemo();
  else {
    render();
    autoLoad();
  }
  setInterval(autoLoad, 60000);
})();
