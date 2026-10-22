import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (name) => readFile(new URL("../" + name, import.meta.url));

test("both staff and parent bell menus use portal instead of clipped header", async () => {
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
  assert.match(parent.toString(), /<ViewportPopover/);
  assert.match(staff.toString(), /aria-expanded=\{noticeOpen\}/);
  assert.match(parent.toString(), /aria-expanded=\{noticeOpen\}/);
});

test("push status badge is a high-contrast readable MY monogram", async () => {
  const [png, worker, manifest] = await Promise.all([
    read("public/notification/mutabaah-status-v3.png"),
    read("public/parent-push-sw.js"),
    read("public/manifest.webmanifest"),
  ]);
  assert.equal(png.toString("ascii", 1, 4), "PNG");
  assert.equal(png.readUInt32BE(16), 96);
  assert.equal(png.readUInt32BE(20), 96);
  assert.equal(png[25], 6, "PNG needs RGBA alpha");
  assert.ok(png.length > 1500);
  assert.match(worker.toString(), /notification\/mutabaah-status-v3\.png/);
  assert.match(renderer.toString(), /"name": "Mutabaah Yaumiah/);
  assert.match(worker.toString(), /showNotification\(payload\.title \|\| "Mutabaah Yaumiah"/);
  assert.doesNotMatch(worker.toString(), /badge = new URL\("notification\/mutabaah-status-v2\.png"/);
  assert.doesNotMatch(worker.toString(), /badge = new URL\("notification\/mutabaah-status\.png"/);
});
