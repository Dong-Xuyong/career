/* Career pipeline logic. No DOM. */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CareerCore = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var APP_ID = "career";
  var SCHEMA_VERSION = 1;
  var STAGE_LIST = [
    { id: "saved", label: "Saved" },
    { id: "applied", label: "Applied" },
    { id: "screening", label: "Screening" },
    { id: "interview", label: "Interview" },
    { id: "offer", label: "Offer" },
    { id: "closed", label: "Closed" }
  ];
  var STAGE_RANK = {};
  STAGE_LIST.forEach(function (stage, i) { STAGE_RANK[stage.id] = i; });
  var OUTCOMES = { rejected: 1, withdrawn: 1, declined: 1, accepted: 1 };
  var ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
  var YMD = /^\d{4}-\d{2}-\d{2}$/;
  var DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    if (value === null || typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function ymdOrNull(value) {
    return typeof value === "string" && YMD.test(value) ? value : null;
  }

  function hasStamp(value) {
    return isObject(value) && typeof value.updatedAt === "string";
  }

  function isDateMap(value) {
    if (!isObject(value)) return false;
    var keys = Object.keys(value);
    if (!keys.length) return false;
    for (var i = 0; i < keys.length; i++) {
      if (!DATE_KEY.test(keys[i])) return false;
    }
    return true;
  }

  function timeCmp(localRec, remoteRec) {
    var localAt = Date.parse(localRec && localRec.updatedAt);
    var remoteAt = Date.parse(remoteRec && remoteRec.updatedAt);
    var localOk = Number.isFinite(localAt);
    var remoteOk = Number.isFinite(remoteAt);
    if (localOk && remoteOk) {
      if (localAt > remoteAt) return -1;
      if (remoteAt > localAt) return 1;
      return 0;
    }
    if (localOk) return -1;
    if (remoteOk) return 1;
    return 0;
  }

  function fillMissing(winner, loser) {
    if (!isObject(winner) || !isObject(loser)) return winner;
    Object.keys(loser).forEach(function (key) {
      if (winner[key] === undefined) {
        winner[key] = clone(loser[key]);
      } else if (
        isObject(winner[key]) &&
        isObject(loser[key]) &&
        !Array.isArray(winner[key]) &&
        !Array.isArray(loser[key])
      ) {
        fillMissing(winner[key], loser[key]);
      }
    });
    return winner;
  }

  function mergeRecord(localRec, remoteRec) {
    var cmp = timeCmp(localRec, remoteRec);
    if (cmp < 0) return fillMissing(clone(localRec), remoteRec);
    if (cmp > 0) return fillMissing(clone(remoteRec), localRec);
    return mergePlain(localRec, remoteRec);
  }

  function mergeRecords(localArr, remoteArr) {
    var out = [];
    var index = Object.create(null);
    function take(item, sourceIsRemote) {
      if (!isObject(item) || typeof item.id !== "string") {
        out.push(clone(item));
        return;
      }
      if (index[item.id] == null) {
        index[item.id] = out.length;
        out.push(clone(item));
        return;
      }
      var at = index[item.id];
      out[at] = sourceIsRemote ? mergeRecord(out[at], item) : mergeRecord(item, out[at]);
    }
    (localArr || []).forEach(function (item) { take(item, false); });
    (remoteArr || []).forEach(function (item) { take(item, true); });
    return out;
  }

  function looksLikeRecords(arr) {
    return Array.isArray(arr) && arr.length > 0 && arr.every(function (item) {
      return isObject(item) && typeof item.id === "string";
    });
  }

  function unionValues(localArr, remoteArr) {
    var out = [];
    var seen = Object.create(null);
    function add(item) {
      var key = JSON.stringify(item);
      if (seen[key]) return;
      seen[key] = true;
      out.push(clone(item));
    }
    (Array.isArray(localArr) ? localArr : []).forEach(add);
    (Array.isArray(remoteArr) ? remoteArr : []).forEach(add);
    return out;
  }

  function mergeArray(localArr, remoteArr) {
    var local = Array.isArray(localArr) ? localArr : [];
    var remote = Array.isArray(remoteArr) ? remoteArr : [];
    var localRecords = local.length === 0 || looksLikeRecords(local);
    var remoteRecords = remote.length === 0 || looksLikeRecords(remote);
    if ((looksLikeRecords(local) || looksLikeRecords(remote)) && localRecords && remoteRecords) {
      return mergeRecords(local, remote);
    }
    return unionValues(local, remote);
  }

  function mergeDateMap(localMap, remoteMap) {
    var local = isObject(localMap) ? localMap : {};
    var remote = isObject(remoteMap) ? remoteMap : {};
    var out = {};
    var seen = Object.create(null);
    Object.keys(local).concat(Object.keys(remote)).forEach(function (key) {
      if (seen[key]) return;
      seen[key] = true;
      if (!hasOwn(remote, key)) out[key] = clone(local[key]);
      else if (!hasOwn(local, key)) out[key] = clone(remote[key]);
      else if (isObject(local[key]) && isObject(remote[key])) out[key] = mergeRecord(local[key], remote[key]);
      else out[key] = clone(local[key]);
    });
    return out;
  }

  function mergeValue(local, remote) {
    if (remote === undefined) return clone(local);
    if (local === undefined) return clone(remote);
    if (Array.isArray(local) || Array.isArray(remote)) return mergeArray(local, remote);
    if (isObject(local) && isObject(remote)) {
      var localDate = isDateMap(local);
      var remoteDate = isDateMap(remote);
      if (localDate && remoteDate) return mergeDateMap(local, remote);
      if ((localDate || remoteDate) && Object.keys(localDate ? remote : local).length === 0) {
        return clone(localDate ? local : remote);
      }
      if (hasStamp(local) || hasStamp(remote)) return mergeRecord(local, remote);
      return mergePlain(local, remote);
    }
    return clone(local);
  }

  function mergePlain(local, remote) {
    var left = isObject(local) ? local : {};
    var right = isObject(remote) ? remote : {};
    var out = {};
    var seen = Object.create(null);
    Object.keys(left).concat(Object.keys(right)).forEach(function (key) {
      if (seen[key]) return;
      seen[key] = true;
      if (!hasOwn(right, key)) out[key] = clone(left[key]);
      else if (!hasOwn(left, key)) out[key] = clone(right[key]);
      else out[key] = mergeValue(left[key], right[key]);
    });
    return out;
  }

  function newerStamp(localAt, remoteAt) {
    var localMs = Date.parse(localAt);
    var remoteMs = Date.parse(remoteAt);
    var localOk = Number.isFinite(localMs);
    var remoteOk = Number.isFinite(remoteMs);
    if (localOk && remoteOk) return localMs >= remoteMs ? localAt : remoteAt;
    if (localOk) return localAt;
    if (remoteOk) return remoteAt;
    if (localAt != null) return localAt;
    if (remoteAt != null) return remoteAt;
    return null;
  }

  function merge(local, remote) {
    var left = isObject(local) ? local : {};
    var right = isObject(remote) ? remote : {};
    var merged = mergePlain(left, right);
    var versions = [left.schemaVersion, right.schemaVersion]
      .map(function (value) { return Number(value); })
      .filter(function (value) { return Number.isFinite(value); });
    if (versions.length) merged.schemaVersion = Math.max.apply(null, versions);
    merged.updatedAt = newerStamp(left.updatedAt, right.updatedAt);
    return merged;
  }

  function normalizeHistory(list, stage, updatedAt, date) {
    var out = [];
    if (Array.isArray(list)) {
      list.forEach(function (item) {
        if (!isObject(item) || !STAGE_RANK.hasOwnProperty(item.stage) || typeof item.at !== "string") return;
        out.push(clone(item));
      });
    }
    if (!out.length && STAGE_RANK.hasOwnProperty(stage)) {
      var at = typeof updatedAt === "string" ? updatedAt : (date ? date + "T00:00:00.000Z" : "1970-01-01T00:00:00.000Z");
      out.push({ stage: stage, at: at });
    }
    return out;
  }

  function normalizeJob(job) {
    if (!isObject(job)) return null;
    var copy = clone(job);
    if (typeof copy.company !== "string") copy.company = "";
    if (typeof copy.role !== "string") copy.role = "";
    if (!STAGE_RANK.hasOwnProperty(copy.stage)) copy.stage = "saved";
    copy.outcome = copy.stage === "closed" && OUTCOMES[copy.outcome] ? copy.outcome : null;
    if (typeof copy.nextStep !== "string") copy.nextStep = "";
    copy.nextStepDue = ymdOrNull(copy.nextStepDue);
    copy.date = ymdOrNull(copy.date);
    copy.appliedOn = ymdOrNull(copy.appliedOn);
    if (typeof copy.link !== "string") copy.link = "";
    if (typeof copy.notes !== "string") copy.notes = "";
    if (typeof copy.updatedAt !== "string") copy.updatedAt = "1970-01-01T00:00:00.000Z";
    copy.stageHistory = normalizeHistory(copy.stageHistory, copy.stage, copy.updatedAt, copy.date);
    return copy;
  }

  function normalizeProject(project) {
    if (!isObject(project)) return null;
    var copy = clone(project);
    if (typeof copy.title !== "string") copy.title = "";
    if (typeof copy.url !== "string") copy.url = "";
    if (typeof copy.summary !== "string") copy.summary = "";
    if (!Array.isArray(copy.tags)) copy.tags = [];
    else copy.tags = copy.tags.filter(function (tag) { return typeof tag === "string"; });
    if (copy.repo != null && typeof copy.repo !== "string") copy.repo = null;
    if (typeof copy.order !== "number" || !isFinite(copy.order)) copy.order = 0;
    if (typeof copy.updatedAt !== "string") copy.updatedAt = "1970-01-01T00:00:00.000Z";
    return copy;
  }

  function normalizeStages(input) {
    var byId = Object.create(null);
    var extras = [];
    if (Array.isArray(input)) {
      input.forEach(function (stage) {
        if (!isObject(stage) || typeof stage.id !== "string") return;
        if (STAGE_RANK.hasOwnProperty(stage.id)) byId[stage.id] = stage;
        else extras.push(clone(stage));
      });
    }
    var stages = STAGE_LIST.map(function (base) {
      var src = byId[base.id];
      var copy = src ? clone(src) : { id: base.id, label: base.label };
      copy.id = base.id;
      if (typeof copy.label !== "string" || !copy.label.trim()) copy.label = base.label;
      return copy;
    });
    extras.sort(function (a, b) {
      return String(a.id).localeCompare(String(b.id));
    });
    return stages.concat(extras);
  }

  function normalize(input) {
    var doc = isObject(input) ? clone(input) : {};
    if (typeof doc.app !== "string" || !doc.app) doc.app = APP_ID;
    var version = Number(doc.schemaVersion);
    doc.schemaVersion = Number.isFinite(version) ? version : SCHEMA_VERSION;
    if (typeof doc.owner !== "string" || !doc.owner) doc.owner = "zoro";
    if (doc.updatedAt == null) doc.updatedAt = null;
    doc.stages = normalizeStages(doc.stages);
    doc.jobs = Array.isArray(doc.jobs) ? doc.jobs.map(normalizeJob).filter(Boolean) : [];
    doc.portfolio = Array.isArray(doc.portfolio) ? doc.portfolio.map(normalizeProject).filter(Boolean) : [];
    return doc;
  }

  function newId(prefix, existing, rng) {
    var rand = rng || Math.random;
    var used = Object.create(null);
    (existing || []).forEach(function (id) { used[id] = true; });
    var n = 0;
    while (n < 80) {
      var body = "";
      for (var i = 0; i < 6; i++) {
        var index = Math.floor(rand() * ALPHABET.length);
        if (index < 0 || index >= ALPHABET.length) index = 0;
        body += ALPHABET.charAt(index);
      }
      var id = prefix + "_" + body;
      if (!used[id]) return id;
      n += 1;
    }
    return prefix + "_" + ALPHABET.charAt(Math.floor(rand() * ALPHABET.length)) + String(Date.now()).slice(-5);
  }

  function groupByStage(doc) {
    var norm = normalize(doc);
    var jobs = norm.jobs.filter(function (job) { return job.deleted !== true; });
    return norm.stages.map(function (stage) {
      return {
        id: stage.id,
        label: stage.label,
        jobs: jobs.filter(function (job) { return job.stage === stage.id; })
      };
    });
  }

  function isSafeUrl(value) {
    if (typeof value !== "string") return false;
    var trimmed = value.trim();
    if (!trimmed) return false;
    try {
      var url = new URL(trimmed);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (err) {
      return false;
    }
  }

  function lisbonToday(now) {
    var date = now instanceof Date ? now : new Date(now || Date.now());
    if (!isFinite(date.getTime())) date = new Date();
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    var year = "0000";
    var month = "01";
    var day = "01";
    parts.forEach(function (part) {
      if (part.type === "year") year = part.value;
      if (part.type === "month") month = part.value;
      if (part.type === "day") day = part.value;
    });
    return year + "-" + month + "-" + day;
  }

  function stageAgeDays(dateStr, today) {
    if (!ymdOrNull(dateStr) || !ymdOrNull(today)) return null;
    var start = Date.parse(dateStr + "T00:00:00Z");
    var end = Date.parse(today + "T00:00:00Z");
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return Math.round((end - start) / 86400000);
  }

  function formatAge(days) {
    if (days == null || !isFinite(days)) return "";
    return Math.max(0, Math.floor(days)) + "d";
  }

  function isOverdue(due, today) {
    if (!ymdOrNull(due) || !ymdOrNull(today)) return false;
    return due < today;
  }

  function sortJobs(jobs) {
    return (jobs || []).slice().sort(function (a, b) {
      var aDue = a && a.nextStepDue ? a.nextStepDue : "9999-99-99";
      var bDue = b && b.nextStepDue ? b.nextStepDue : "9999-99-99";
      if (aDue !== bDue) return aDue < bDue ? -1 : 1;
      var aDate = a && a.date ? a.date : "9999-99-99";
      var bDate = b && b.date ? b.date : "9999-99-99";
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;
      return String((a && a.company) || "").localeCompare(String((b && b.company) || ""));
    });
  }

  function filterJobs(jobs, query, stage) {
    var q = String(query || "").trim().toLowerCase();
    return (jobs || []).filter(function (job) {
      if (!job || job.deleted === true) return false;
      if (stage && job.stage !== stage) return false;
      if (!q) return true;
      return [job.company, job.role, job.notes].join("\n").toLowerCase().indexOf(q) !== -1;
    });
  }

  function moveStage(job, stage, today, nowIso) {
    var next = clone(job || {});
    if (!STAGE_RANK.hasOwnProperty(stage) || next.stage === stage) return next;
    next.stage = stage;
    next.date = today;
    next.updatedAt = nowIso;
    if (stage !== "closed") next.outcome = null;
    if (stage === "applied" && !ymdOrNull(next.appliedOn)) next.appliedOn = today;
    if (!Array.isArray(next.stageHistory)) next.stageHistory = [];
    next.stageHistory.push({ stage: stage, at: nowIso });
    return next;
  }

  function tombstone(record, nowIso) {
    var next = clone(record || {});
    next.deleted = true;
    next.updatedAt = nowIso;
    return next;
  }

  function reorderPortfolio(projects, id, dir, nowIso) {
    var all = (projects || []).map(clone);
    var live = [];
    all.forEach(function (project, index) {
      if (project && project.deleted !== true) live.push(index);
    });
    live.sort(function (i, j) {
      var delta = (Number(all[i].order) || 0) - (Number(all[j].order) || 0);
      return delta || i - j;
    });
    var pos = -1;
    for (var n = 0; n < live.length; n++) {
      if (all[live[n]].id === id) pos = n;
    }
    var swap = pos + dir;
    if (pos < 0 || swap < 0 || swap >= live.length) return all;
    var a = all[live[pos]];
    var b = all[live[swap]];
    var orderA = a.order;
    a.order = b.order;
    b.order = orderA;
    if (a.order === b.order) {
      a.order = Math.min(pos, swap) + 1;
      b.order = Math.max(pos, swap) + 1;
    }
    a.updatedAt = nowIso;
    b.updatedAt = nowIso;
    return all;
  }

  function isNewerFormat(doc, schemaVersion) {
    var version = Number(doc && doc.schemaVersion);
    return Number.isFinite(version) && version > schemaVersion;
  }

  function isConflict(err) {
    return /another device/i.test(String(err && err.message ? err.message : err));
  }

  function saveOnceWithRetry(save) {
    return Promise.resolve()
      .then(save)
      .catch(function (err) {
        if (!isConflict(err)) throw err;
        return Promise.resolve()
          .then(save)
          .catch(function (err2) {
            if (err2 && typeof err2 === "object") err2.careerGaveUp = true;
            throw err2;
          });
      });
  }

  function blankJob(id, today, nowIso) {
    return {
      id: id,
      company: "",
      role: "",
      stage: "saved",
      outcome: null,
      nextStep: "",
      nextStepDue: null,
      date: today,
      appliedOn: null,
      stageHistory: [{ stage: "saved", at: nowIso }],
      link: "",
      notes: "",
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }

  function blankProject(id, order, nowIso) {
    return {
      id: id,
      title: "",
      url: "",
      repo: null,
      summary: "",
      tags: [],
      order: order,
      updatedAt: nowIso
    };
  }

  return {
    APP_ID: APP_ID,
    SCHEMA_VERSION: SCHEMA_VERSION,
    STAGES: STAGE_LIST.map(function (stage) { return { id: stage.id, label: stage.label }; }),
    normalize: normalize,
    merge: merge,
    newId: newId,
    groupByStage: groupByStage,
    isSafeUrl: isSafeUrl,
    lisbonToday: lisbonToday,
    stageAgeDays: stageAgeDays,
    formatAge: formatAge,
    isOverdue: isOverdue,
    sortJobs: sortJobs,
    filterJobs: filterJobs,
    moveStage: moveStage,
    tombstone: tombstone,
    reorderPortfolio: reorderPortfolio,
    isNewerFormat: isNewerFormat,
    isConflict: isConflict,
    saveOnceWithRetry: saveOnceWithRetry,
    blankJob: blankJob,
    blankProject: blankProject
  };
});
