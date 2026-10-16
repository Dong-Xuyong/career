# Career

Job pipeline and public portfolio for [dong-xuyong.github.io/career](https://dong-xuyong.github.io/career/).

The page is a static site. With no sync config in this browser it opens on **Demo data** (fake `EXAMPLE` jobs and projects). Those edits stay on the page and are never written to GitHub.

Real data lives only in the private repo `Dong-Xuyong/progress-sync`, file `career.json`, reached through the shared browser config `localStorage["dong-gh-sync"]`. The first save creates that file from `career.seed.json`, including the Law Wiki project. Each job keeps `stageHistory` (`{stage, at}`) and an optional `appliedOn` date.

Connect sync on the demo banner, add one record, and confirm `career.json` appears in progress-sync with `"app": "career"`, `"schemaVersion": 1`, and `"owner": "zoro"`.

```
node tests/core.test.mjs
```
