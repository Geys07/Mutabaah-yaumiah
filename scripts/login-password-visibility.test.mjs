import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("login password visibility has a readable, correctly wired label, not mystery glyphs", async () => {
  const app = await read("src/App.jsx");
  assert.match(app, /className="mut-login-password-visibility"/);
  assert.match(app, /type="checkbox"\s+checked=\{showPassword\}/);
  assert.match(app, /setShowPassword\(event\.target\.checked\)/);
  assert.match(app, /showPassword\s*\? "text"\s*: "password"/);
  assert.match(app, /"Tampilkan kata sandi"/);
  assert.match(app, /"Sembunyikan kata sandi"/);
  assert.doesNotMatch(app, /mut-login-eye|\{showPassword \? "◉" : "◌"\}/);
});

test("login password toggle is comfortably tappable and uses existing four-time accent", async () => {
  const [styles, theme] = await Promise.all([
    read("src/pages/LoginPage.css"),
    read("src/styles/mutabaah-unified-theme.css"),
  ]);
  assert.match(styles, /\.mut-login-password-actions\s*\{[^}]*display: flex/s);
  assert.match(styles, /\.mut-login-password-visibility\s*\{[^}]*min-height: 40px/s);
  assert.match(styles, /\.mut-login-password-visibility input\[type="checkbox"\]/);
  assert.match(styles, /accent-color: var\(--mut-ui-accent/);
  assert.match(styles, /:focus-visible/);
  for (const time of ["pagi", "siang", "sore", "malam"]) {
    assert.ok(theme.includes(`data-time-theme="${time}"`), time);
  }
});

test("parent activation retains its existing show-password checkbox and both inputs", async () => {
  const activation = await read("src/pages/ParentActivation.jsx");
  assert.match(activation, /className="activation-checkbox"/);
  assert.match(activation, /<span>Tampilkan kata sandi<\/span>/);
  assert.match(activation, /checked=\{showPassword\}/);
  assert.match(activation, /form\.confirm_password/);
});
