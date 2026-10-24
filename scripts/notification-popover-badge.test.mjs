import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (name) => readFile(new URL("../" + name, import.meta.url));

test("Admin bell uses portal; parent routine status bell is absent", async () => {
  const [viewport, style, staff, parent] = await Promise.all([
    read("src/components/ViewportPopover.jsx"),
    read("src/components/ViewportPopover.css"),
    read("src/components/StaffWorkspace.jsx"),
    read("src/pages/ParentDashboard.jsx"),
  ]);
  const code = viewport.toString();
  const css = style.toString();
  assert.match(code, /createPortal\(/);
  assert.match(code, /document\.body/);
  assert.match(code, /getBoundingClientRect/);
  assert.match(code, /window\.visualViewport/);
  assert.match(code, /popup\.style\.maxHeight/);
  assert.match(code, /document\.addEventListener\("pointerdown", outside\)/);
  assert.match(code, /document\.addEventListener\("keydown", escape\)/);
  assert.match(css, /position: fixed !important/);
  assert.match(css, /overflow-y: auto/);
  assert.match(staff.toString(), /<ViewportPopover/);
  assert.doesNotMatch(parent.toString(), /<ViewportPopover/);
  assert.match(staff.toString(), /aria-expanded=\{noticeOpen\}/);
  assert.doesNotMatch(parent.toString(), /aria-expanded=\{noticeOpen\}/);
  assert.match(staff.toString(), /showNoticeBell = true/);
});

test("Android notification badge uses smaller and slimmer Amal Harian wordmark", async () => {
  const [png, worker, manifest] = await Promise.all([
    read("public/notification/amal-harian-status-v2.png"),
    read("public/parent-push-sw.js"),
    read("public/manifest.webmanifest"),
  ]);
  assert.equal(png.toString("ascii", 1, 4), "PNG");
  assert.equal(png.readUInt32BE(16), 96);
  assert.equal(png.readUInt32BE(20), 96);
  assert.equal(png[25], 6, "PNG should have RGBA transparency");
  assert.ok(png.length > 1500, "badge cannot be empty");
  assert.ok(png.includes(Buffer.from("Amal Harian")), "badge provenance metadata is missing");
  assert.ok(png.includes(Buffer.from("safe padding")), "badge should include safe-padding revision metadata");

  assert.match(worker.toString(), /mutabaah-pwa-v8-amal-harian-slim-20261022/);
  assert.match(worker.toString(), /notification\/amal-harian-status-v2\.png/);
  assert.match(worker.toString(), /showNotification\(payload\.title \|\| "Mutabaah Yaumiah"/);
  assert.match(worker.toString(), /const icon = new URL\("logo-sekolah-loading\.png"/);
  assert.doesNotMatch(worker.toString(), /badge = new URL\("notification\/mutabaah-status-v4\.png"/);
  assert.match(manifest.toString(), /"name": "Mutabaah Yaumiah/);
});
