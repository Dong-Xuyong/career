/* Fake pipeline shown when this browser has no sync config. Never saved. */
(function (global) {
  "use strict";
  global.CAREER_DEMO = {
    app: "career",
    schemaVersion: 1,
    owner: "zoro",
    updatedAt: "2026-10-16T09:00:00.000Z",
    stages: [
      { id: "saved", label: "Saved" },
      { id: "applied", label: "Applied" },
      { id: "screening", label: "Screening" },
      { id: "interview", label: "Interview" },
      { id: "offer", label: "Offer" },
      { id: "closed", label: "Closed" }
    ],
    jobs: [
      {
        id: "job_saved1",
        company: "EXAMPLE Northwind",
        role: "Platform engineer",
        stage: "saved",
        outcome: null,
        nextStep: "Read the posting",
        nextStepDue: "2026-10-20",
        date: "2026-10-04",
        appliedOn: null,
        stageHistory: [{ stage: "saved", at: "2026-10-04T09:00:00.000Z" }],
        link: "https://example.com/jobs/northwind",
        notes: "Public example saved from a careers page.",
        createdAt: "2026-10-04T09:00:00.000Z",
        updatedAt: "2026-10-04T09:00:00.000Z"
      },
      {
        id: "job_appld1",
        company: "EXAMPLE Harbor",
        role: "Backend engineer",
        stage: "applied",
        outcome: null,
        nextStep: "Wait for a reply",
        nextStepDue: "2026-10-12",
        date: "2026-10-10",
        appliedOn: "2026-10-10",
        stageHistory: [
          { stage: "saved", at: "2026-10-08T09:00:00.000Z" },
          { stage: "applied", at: "2026-10-10T09:00:00.000Z" }
        ],
        link: "javascript:alert(1)",
        notes: "Example application. The posting link is not a real URL.",
        createdAt: "2026-10-08T09:00:00.000Z",
        updatedAt: "2026-10-10T09:00:00.000Z"
      },
      {
        id: "job_scre01",
        company: "EXAMPLE Lumen",
        role: "Support engineer",
        stage: "screening",
        outcome: null,
        nextStep: "Send the portfolio",
        nextStepDue: "2026-10-18",
        date: "2026-10-14",
        appliedOn: "2026-10-01",
        stageHistory: [
          { stage: "applied", at: "2026-10-01T09:00:00.000Z" },
          { stage: "screening", at: "2026-10-14T09:00:00.000Z" }
        ],
        link: "https://example.com/jobs/lumen",
        notes: "Recruiter asked for a short project list.",
        createdAt: "2026-10-01T09:00:00.000Z",
        updatedAt: "2026-10-14T09:00:00.000Z"
      },
      {
        id: "job_intv01",
        company: "EXAMPLE Cobalt",
        role: "Site reliability engineer",
        stage: "interview",
        outcome: null,
        nextStep: "Panel interview",
        nextStepDue: "2026-10-21",
        date: "2026-10-15",
        appliedOn: "2026-09-28",
        stageHistory: [
          { stage: "applied", at: "2026-09-28T09:00:00.000Z" },
          { stage: "interview", at: "2026-10-15T09:00:00.000Z" }
        ],
        link: "https://example.com/jobs/cobalt",
        notes: "Loop is one hour.",
        createdAt: "2026-09-28T09:00:00.000Z",
        updatedAt: "2026-10-15T09:00:00.000Z"
      },
      {
        id: "job_offr01",
        company: "EXAMPLE Maple",
        role: "Developer advocate",
        stage: "offer",
        outcome: null,
        nextStep: "Review the offer",
        nextStepDue: "2026-10-22",
        date: "2026-10-16",
        appliedOn: "2026-09-01",
        stageHistory: [
          { stage: "interview", at: "2026-10-02T09:00:00.000Z" },
          { stage: "offer", at: "2026-10-16T09:00:00.000Z" }
        ],
        link: "https://example.com/jobs/maple",
        notes: "Example offer, no numbers stored.",
        createdAt: "2026-09-01T09:00:00.000Z",
        updatedAt: "2026-10-16T09:00:00.000Z"
      },
      {
        id: "job_clsd01",
        company: "EXAMPLE Quartz",
        role: "Data engineer",
        stage: "closed",
        outcome: "rejected",
        nextStep: "",
        nextStepDue: null,
        date: "2026-09-30",
        appliedOn: "2026-09-02",
        stageHistory: [
          { stage: "applied", at: "2026-09-02T09:00:00.000Z" },
          { stage: "closed", at: "2026-09-30T09:00:00.000Z" }
        ],
        link: "",
        notes: "Closed example.",
        createdAt: "2026-09-02T09:00:00.000Z",
        updatedAt: "2026-09-30T09:00:00.000Z"
      }
    ],
    portfolio: [
      {
        id: "prj_example-board",
        title: "EXAMPLE Signal board",
        url: "https://example.com/signal",
        repo: null,
        summary: "A fake status board used only in demo mode.",
        tags: ["demo", "ui"],
        order: 1,
        updatedAt: "2026-10-16T09:00:00.000Z"
      },
      {
        id: "prj_example-notes",
        title: "EXAMPLE Field notes",
        url: "javascript:alert(1)",
        repo: null,
        summary: "A fake project whose address is shown as text.",
        tags: ["demo"],
        order: 2,
        updatedAt: "2026-10-16T09:00:00.000Z"
      }
    ]
  };
})(typeof window !== "undefined" ? window : globalThis);
