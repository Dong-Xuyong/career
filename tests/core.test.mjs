/**
 * Career merge, normalize, view math, and a stubbed 409 save.
 * Run: node tests/core.test.mjs
 * Never calls the real GitHub API.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const core = require("../core.js");

function job(partial) {
  return Object.assign({
    id: "job_aaaaaa",
    company: "EXAMPLE Co",
    role: "Engineer",
    stage: "saved",
    outcome: null,
    nextStep: "",
    nextStepDue: null,
    date: "2026-10-01",
    appliedOn: null,
    stageHistory: [{ stage: "saved", at: "2026-10-01T00:00:00.000Z" }],
    link: "",
    notes: "",
    updatedAt: "2026-10-01T00:00:00.000Z"
  }, partial);
}

const local = {
  app: "career",
  schemaVersion: 1,
  owner: "zoro",
  updatedAt: "2026-10-02T00:00:00.000Z",
  jobs: [job({
    id: "job_app111",
    company: "EXAMPLE App",
    role: "Edited role",
    updatedAt: "2026-10-04T00:00:00.000Z"
  })],
  portfolio: []
};
const remote = {
  app: "career",
  schemaVersion: 1,
  owner: "zoro",
  updatedAt: "2026-10-03T00:00:00.000Z",
  crewNote: "keep-me",
  jobs: [job({
    id: "job_bot222",
    company: "EXAMPLE Bot",
    role: "Bot role",
    updatedAt: "2026-10-03T00:00:00.000Z"
  })],
  portfolio: []
};
const both = core.merge(local, remote);
assert.deepEqual(both.jobs.map((item) => item.id).sort(), ["job_app111", "job_bot222"]);
assert.equal(both.jobs.find((item) => item.id === "job_app111").role, "Edited role");
assert.equal(both.jobs.find((item) => item.id === "job_bot222").company, "EXAMPLE Bot");
assert.equal(both.crewNote, "keep-me");

const older = job({ company: "EXAMPLE Old", updatedAt: "2026-10-01T00:00:00.000Z", notes: "old" });
const newer = job({ company: "EXAMPLE New", updatedAt: "2026-10-05T00:00:00.000Z", notes: "new" });
const won = core.merge({ jobs: [older] }, { jobs: [newer] });
assert.equal(won.jobs.length, 1);
assert.equal(won.jobs[0].company, "EXAMPLE New");
assert.equal(won.jobs[0].notes, "new");

const stringTrap = core.merge(
  { updatedAt: "2026-10-16T00:00:00Z", jobs: [job({ updatedAt: "2026-10-16T00:00:00Z", company: "EXAMPLE Utc" })] },
  { updatedAt: "2026-10-16T00:30:00+02:00", jobs: [job({ updatedAt: "2026-10-16T00:30:00+02:00", company: "EXAMPLE Offset" })] }
);
assert.equal(stringTrap.updatedAt, "2026-10-16T00:00:00Z");
assert.equal(stringTrap.jobs[0].company, "EXAMPLE Utc");

const laterOffset = core.merge(
  { updatedAt: "2026-10-16T00:00:00.000Z" },
  { updatedAt: "2026-10-16T02:00:00+01:00" }
);
assert.equal(laterOffset.updatedAt, "2026-10-16T02:00:00+01:00");

const live = job({ updatedAt: "2026-10-01T00:00:00.000Z", deleted: false, company: "EXAMPLE Live" });
const tomb = job({ updatedAt: "2026-10-03T00:00:00.000Z", deleted: true, company: "EXAMPLE Live" });
delete tomb.notes;
const buried = core.merge({ jobs: [live] }, { jobs: [tomb] });
assert.equal(buried.jobs[0].deleted, true);
assert.equal(buried.jobs[0].notes, "old" in tomb ? tomb.notes : live.notes);
assert.equal(buried.jobs[0].company, "EXAMPLE Live");

const revived = core.merge(
  { jobs: [job({ updatedAt: "2026-10-04T00:00:00.000Z", deleted: false, company: "EXAMPLE Back" })] },
  { jobs: [job({ updatedAt: "2026-10-02T00:00:00.000Z", deleted: true })] }
);
assert.equal(revived.jobs[0].deleted, false);
assert.equal(revived.jobs[0].company, "EXAMPLE Back");

const remoteWriter = job({ updatedAt: "2026-10-03T00:00:00.000Z", stage: "interview", role: "Writer" });
delete remoteWriter.stageHistory;
delete remoteWriter.appliedOn;
const historyKept = core.merge(
  {
    jobs: [job({
      updatedAt: "2026-10-02T00:00:00.000Z",
      stage: "applied",
      appliedOn: "2026-10-02",
      stageHistory: [
        { stage: "saved", at: "2026-10-01T00:00:00.000Z" },
        { stage: "applied", at: "2026-10-02T00:00:00.000Z" }
      ]
    })]
  },
  { jobs: [remoteWriter] }
);
assert.equal(historyKept.jobs[0].role, "Writer");
assert.equal(historyKept.jobs[0].stage, "interview");
assert.equal(historyKept.jobs[0].appliedOn, "2026-10-02");
assert.equal(historyKept.jobs[0].stageHistory.length, 2);

assert.equal(core.merge({ schemaVersion: 1 }, { schemaVersion: 2 }).schemaVersion, 2);

const days = core.merge(
  { days: { "2026-10-01": { updatedAt: "2026-10-02T00:00:00.000Z", minutes: 5 } } },
  {
    days: {
      "2026-10-01": { updatedAt: "2026-10-03T00:00:00.000Z", minutes: 9 },
      "2026-10-02": { updatedAt: "2026-10-02T00:00:00.000Z", minutes: 1 }
    }
  }
);
assert.equal(days.days["2026-10-01"].minutes, 9);
assert.equal(days.days["2026-10-02"].minutes, 1);

const settings = core.merge(
  { settings: { updatedAt: "2026-10-01T00:00:00.000Z", theme: "light", extra: 1 } },
  { settings: { updatedAt: "2026-10-02T00:00:00.000Z", theme: "dark" } }
);
assert.equal(settings.settings.theme, "dark");
assert.equal(settings.settings.extra, 1);

const seed = JSON.parse(fs.readFileSync(new URL("../career.seed.json", import.meta.url), "utf8"));
const normalized = core.normalize(seed);
assert.equal(normalized.app, "career");
assert.equal(normalized.schemaVersion, 1);
assert.equal(normalized.owner, "zoro");
assert.equal(normalized.jobs.length, 0);
assert.equal(normalized.portfolio[0].id, "prj_law-wiki");
assert.deepEqual(normalized.stages.map((stage) => stage.id), ["saved", "applied", "screening", "interview", "offer", "closed"]);

const filled = core.normalize({
  noteFromBot: "hi",
  jobs: [{
    id: "job_abc123",
    company: "EXAMPLE",
    role: "R",
    stage: "saved",
    nextStep: "",
    date: "2026-10-01",
    link: "",
    notes: "",
    updatedAt: "2026-10-01T00:00:00.000Z",
    secretField: "keep"
  }]
});
assert.equal(filled.noteFromBot, "hi");
assert.equal(filled.jobs[0].secretField, "keep");
assert.equal(filled.jobs[0].stageHistory[0].stage, "saved");
assert.equal(filled.jobs[0].appliedOn, null);
assert.equal(filled.jobs[0].outcome, null);
assert.equal(core.isNewerFormat(core.normalize({ schemaVersion: 2 }), core.SCHEMA_VERSION), true);
assert.equal(core.isNewerFormat(filled, core.SCHEMA_VERSION), false);

const grouped = core.groupByStage({
  jobs: [
    job({ id: "job_appld1", stage: "applied" }),
    job({ id: "job_clsd01", stage: "closed", deleted: true }),
    job({ id: "job_clsd02", stage: "closed", company: "EXAMPLE Open" })
  ]
});
assert.equal(grouped.find((column) => column.id === "applied").jobs.length, 1);
assert.equal(grouped.find((column) => column.id === "closed").jobs.length, 1);
assert.equal(grouped.find((column) => column.id === "closed").jobs[0].id, "job_clsd02");

const sorted = core.sortJobs([
  job({ id: "job_bbbbbb", nextStepDue: "2026-10-20", date: "2026-10-01", company: "EXAMPLE B" }),
  job({ id: "job_cccccc", nextStepDue: null, date: "2026-10-01", company: "EXAMPLE A" }),
  job({ id: "job_dddddd", nextStepDue: "2026-10-12", date: "2026-10-16", company: "EXAMPLE C" }),
  job({ id: "job_eeeeee", nextStepDue: "2026-10-12", date: "2026-10-02", company: "EXAMPLE D" })
]);
assert.deepEqual(sorted.map((item) => item.id), ["job_eeeeee", "job_dddddd", "job_bbbbbb", "job_cccccc"]);

const found = core.filterJobs([
  job({ company: "EXAMPLE Harbor", role: "Backend", notes: "lighthouse" }),
  job({ id: "job_zzzzzz", company: "EXAMPLE Other", deleted: true, notes: "lighthouse" })
], "LightHouse", "");
assert.equal(found.length, 1);
assert.equal(found[0].company, "EXAMPLE Harbor");
assert.equal(core.filterJobs(found, "", "applied").length, 0);

assert.equal(core.stageAgeDays("2026-10-04", "2026-10-16"), 12);
assert.equal(core.formatAge(12), "12d");
assert.equal(core.formatAge(0), "0d");
assert.equal(core.formatAge(null), "");
assert.equal(core.isOverdue("2026-10-12", "2026-10-16"), true);
assert.equal(core.isOverdue("2026-10-16", "2026-10-16"), false);
assert.equal(core.isOverdue(null, "2026-10-16"), false);
assert.equal(core.lisbonToday(new Date("2026-10-16T23:30:00.000Z")), "2026-10-17");
assert.equal(core.lisbonToday(new Date("2026-10-16T22:30:00.000Z")), "2026-10-16");
assert.equal(core.lisbonToday(new Date("2026-01-16T00:30:00.000Z")), "2026-01-16");
assert.equal(core.lisbonToday(new Date("2026-01-15T23:30:00.000Z")), "2026-01-15");

assert.equal(core.isSafeUrl("javascript:alert(1)"), false);
assert.equal(core.isSafeUrl("JAVASCRIPT:alert(1)"), false);
assert.equal(core.isSafeUrl("data:text/html,hi"), false);
assert.equal(core.isSafeUrl("https://example.com/jobs"), true);
assert.equal(core.isSafeUrl("  http://example.com  "), true);
assert.equal(core.isSafeUrl(""), false);

let seq = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
let cursor = 0;
const made = core.newId("job", ["job_aaaaaa"], function () {
  return (seq[cursor++] + 0.1) / 36;
});
assert.equal(made, "job_bbbbbb");
assert.match(core.newId("prj", []), /^prj_[a-z0-9]{6}$/);

let moved = core.blankJob("job_abc123", "2026-10-01", "2026-10-01T00:00:00.000Z");
moved = core.moveStage(moved, "applied", "2026-10-16", "2026-10-16T12:00:00.000Z");
assert.equal(moved.stage, "applied");
assert.equal(moved.date, "2026-10-16");
assert.equal(moved.appliedOn, "2026-10-16");
assert.equal(moved.updatedAt, "2026-10-16T12:00:00.000Z");
assert.deepEqual(moved.stageHistory.map((item) => item.stage), ["saved", "applied"]);
moved = core.moveStage(moved, "closed", "2026-10-17", "2026-10-17T00:00:00.000Z");
moved.outcome = "rejected";
moved = core.moveStage(moved, "screening", "2026-10-18", "2026-10-18T00:00:00.000Z");
assert.equal(moved.outcome, null);
assert.equal(moved.appliedOn, "2026-10-16");
const same = core.moveStage(moved, "screening", "2026-10-19", "2026-10-19T00:00:00.000Z");
assert.equal(same.stageHistory.length, moved.stageHistory.length);
assert.equal(same.date, moved.date);

const stone = core.tombstone(moved, "2026-10-19T00:00:00.000Z");
assert.equal(stone.deleted, true);
assert.equal(moved.deleted, undefined);

const ordered = core.reorderPortfolio([
  { id: "prj_aaaaaa", title: "EXAMPLE A", order: 1, updatedAt: "2026-10-01T00:00:00.000Z" },
  { id: "prj_bbbbbb", title: "EXAMPLE B", order: 2, updatedAt: "2026-10-01T00:00:00.000Z" },
  { id: "prj_cccccc", title: "EXAMPLE C", order: 3, updatedAt: "2026-10-01T00:00:00.000Z", deleted: true }
], "prj_aaaaaa", 1, "2026-10-02T00:00:00.000Z");
assert.equal(ordered.find((item) => item.id === "prj_aaaaaa").order, 2);
assert.equal(ordered.find((item) => item.id === "prj_bbbbbb").order, 1);
assert.equal(ordered.find((item) => item.id === "prj_cccccc").order, 3);

const demoCtx = vm.createContext({ console });
demoCtx.window = demoCtx;
demoCtx.globalThis = demoCtx;
vm.runInContext(fs.readFileSync(new URL("../demo.js", import.meta.url), "utf8"), demoCtx);
const demo = demoCtx.CAREER_DEMO;
assert.equal(demo.jobs.length, 6);
assert.equal(demo.portfolio.length, 2);
assert.equal(new Set(demo.jobs.map((item) => item.stage)).size, 6);
demo.jobs.forEach((item) => assert.equal(item.company.startsWith("EXAMPLE"), true));
demo.portfolio.forEach((item) => assert.equal(item.title.startsWith("EXAMPLE"), true));
assert.equal(core.isSafeUrl(demo.jobs.find((item) => item.id === "job_appld1").link), false);

const appSrc = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const ghSrc = fs.readFileSync(new URL("../dong-ui/gh-sync.js", import.meta.url), "utf8");
assert.match(appSrc, /SAVE_DELAY\s*=\s*2500/);
assert.match(appSrc, /GhSync\.save\(APP_ID/);
assert.match(appSrc, /saveOnceWithRetry/);
assert.match(appSrc, /quiet:\s*true/);
assert.equal((appSrc.match(/GhSync\.save\(/g) || []).length, 1);
assert.doesNotMatch(appSrc, /innerHTML/);
assert.doesNotMatch(appSrc + ghSrc, /ghp_|github_pat_/);
assert.match(ghSrc, /GhSync = \{ save: save, load: load \}/);
assert.doesNotMatch(ghSrc, /readConfig/);
assert.equal(core.APP_ID, "career");

const memory = new Map();
const localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); }
};
const calls = [];
let handler = async () => { throw new Error("fetch not stubbed"); };

function encodeContent(data) {
  return Buffer.from(unescape(encodeURIComponent(JSON.stringify(data))), "binary").toString("base64");
}
function decodeContent(b64) {
  return JSON.parse(decodeURIComponent(escape(Buffer.from(String(b64).replace(/\s/g, ""), "base64").toString("binary"))));
}
function response(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

const context = vm.createContext({
  localStorage,
  console,
  JSON,
  Object,
  Array,
  Error,
  Promise,
  Date,
  String,
  Number,
  unescape,
  escape,
  encodeURIComponent,
  decodeURIComponent,
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  atob: (value) => Buffer.from(value, "base64").toString("binary"),
  fetch: (url, opts) => {
    calls.push({ url, method: opts && opts.method, body: opts && opts.body, headers: opts && opts.headers });
    return handler(url, opts || {});
  },
  confirm: () => false,
  prompt: () => null
});
context.window = context;
context.globalThis = context;
vm.runInContext(ghSrc, context);
const GhSync = context.GhSync;
const FILE = "https://api.github.com/repos/Dong-Xuyong/progress-sync/contents/career.json";

function reset() {
  memory.clear();
  calls.length = 0;
  localStorage.setItem("dong-gh-sync", JSON.stringify({
    token: "example",
    repo: "Dong-Xuyong/progress-sync"
  }));
}

reset();
const remoteDoc = {
  app: "career",
  schemaVersion: 1,
  owner: "zoro",
  updatedAt: "2026-10-03T00:00:00.000Z",
  jobs: [
    job({ id: "job_bot222", company: "EXAMPLE Bot", updatedAt: "2026-10-03T00:00:00.000Z" }),
    job({ id: "job_shared", company: "EXAMPLE Shared", updatedAt: "2026-10-04T00:00:00.000Z", deleted: true })
  ],
  portfolio: []
};
let current = {
  app: "career",
  schemaVersion: 1,
  owner: "zoro",
  updatedAt: "2026-10-05T00:00:00.000Z",
  jobs: [
    job({ id: "job_app111", company: "EXAMPLE App", updatedAt: "2026-10-05T00:00:00.000Z" }),
    job({ id: "job_shared", company: "EXAMPLE Shared", updatedAt: "2026-10-01T00:00:00.000Z", deleted: false })
  ],
  portfolio: []
};
let gets = 0;
let puts = 0;
handler = async (url, opts) => {
  assert.equal(url, FILE);
  assert.equal(opts.headers.Authorization, "Bearer example");
  if (opts.method === "GET") {
    gets += 1;
    return response(200, {
      sha: gets === 1 ? "sha-old" : "sha-new",
      content: encodeContent(remoteDoc)
    });
  }
  puts += 1;
  const body = JSON.parse(opts.body);
  assert.equal(body.message, "Save career progress");
  if (puts === 1) {
    assert.equal(body.sha, "sha-old");
    return response(409, {});
  }
  assert.equal(body.sha, "sha-new");
  current = decodeContent(body.content);
  return response(200, { content: { sha: "sha-done" } });
};

const savedMsg = await core.saveOnceWithRetry(() => GhSync.save("career", () => current, (data) => {
  current = core.merge(current, data);
}, { quiet: true }));
assert.equal(savedMsg, "Saved to GitHub");
assert.deepEqual(calls.map((call) => call.method), ["GET", "PUT", "GET", "PUT"]);
assert.equal(puts, 2);
const ids = current.jobs.map((item) => item.id).sort();
assert.deepEqual(ids, ["job_app111", "job_bot222", "job_shared"]);
assert.equal(current.jobs.find((item) => item.id === "job_shared").deleted, true);
assert.equal(current.jobs.find((item) => item.id === "job_app111").company, "EXAMPLE App");

reset();
handler = async (url, opts) => {
  assert.equal(url, FILE);
  if (opts.method === "GET") return response(404, {});
  const body = JSON.parse(opts.body);
  assert.equal(body.sha, undefined);
  const data = decodeContent(body.content);
  assert.equal(data.app, "career");
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.owner, "zoro");
  assert.equal(data.portfolio[0].id, "prj_law-wiki");
  assert.equal(data.jobs.length, 0);
  return response(201, { content: { sha: "created" } });
};
const created = await GhSync.save("career", () => core.normalize(seed), () => {
  throw new Error("404 must not merge");
}, { quiet: true });
assert.equal(created, "Saved to GitHub");

reset();
let conflicts = 0;
handler = async (url, opts) => {
  if (opts.method === "GET") {
    return response(200, { sha: "sha-" + conflicts, content: encodeContent(remoteDoc) });
  }
  conflicts += 1;
  return response(409, {});
};
await assert.rejects(core.saveOnceWithRetry(() => GhSync.save("career", () => current, (data) => {
  current = core.merge(current, data);
}, { quiet: true })));
assert.equal(conflicts, 2);

reset();
let failures = 0;
handler = async () => {
  failures += 1;
  return response(500, {});
};
await assert.rejects(core.saveOnceWithRetry(() => GhSync.save("career", () => current, () => {}, { quiet: true })), /GitHub error 500/);
assert.equal(failures, 1);

console.log("career core tests passed");
