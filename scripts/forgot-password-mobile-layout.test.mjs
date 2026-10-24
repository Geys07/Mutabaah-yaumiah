import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (name) => readFile(new URL("../" + name, import.meta.url), "utf8");

test("legacy forgot-password login button styles cannot influence recovery page", async () => {
  const [appCss, recoveryCss, recoveryPage] = await Promise.all([
    read("src/App.css"), read("src/pages/ForgotPassword.css"),
    read("src/pages/ForgotPassword.jsx"),
  ]);
  assert.match(appCss, /\.login-page \.forgot-password \{/);
  assert.match(appCss, /\.login-page \.forgot-password button \{/);
  assert.doesNotMatch(appCss, /\n\.forgot-password\s*\{/);
  assert.match(recoveryPage, /className=\{`fp-recovery-page/);
  assert.doesNotMatch(recoveryPage, /className=\{`forgot-password/);
  assert.match(recoveryCss, /\.fp-recovery-page\s*\{/);
  assert.doesNotMatch(recoveryCss, /\.forgot-password/);
});

test("mobile recovery form occupies a single column and uses meaningful icons", async () => {
  const [css, jsx, loginCss] = await Promise.all([
    read("src/pages/ForgotPassword.css"),
    read("src/pages/ForgotPassword.jsx"),
    read("src/pages/LoginPage.css"),
  ]);
  assert.match(css, /flex-direction:column/);
  assert.match(css, /\.fp-form \{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.fp-form label \{display:flex;flex-direction:column/);
  assert.match(css, /\.fp-primary \{display:flex;align-items:center;justify-content:center;width:100%/);
  assert.match(css, /\.fp-form input.*min-height:50px/);
  assert.match(jsx, /<RecoveryIcon name="lock"/);
  assert.match(jsx, /<RecoveryIcon name="support"/);
  assert.match(jsx, /<RecoveryIcon name="bell"/);
  assert.doesNotMatch(jsx, /♙|♢|✦/);
  assert.match(jsx, /Nomor HP Terdaftar/);
  assert.match(jsx, /Lanjutkan ke Chat/);
  assert.match(loginCss, /--mut-scene-mobile/);
});

test("recovery form keeps the four WIB color variables and chat behavior intact", async () => {
  const [css, jsx, theme] = await Promise.all([
    read("src/pages/ForgotPassword.css"),
    read("src/pages/ForgotPassword.jsx"),
    read("src/styles/mutabaah-unified-theme.css"),
  ]);
  for (const variable of ["--mut-ui-accent", "--mut-ui-soft", "--mut-ui-text", "--mut-ui-muted", "--mut-ui-page"]) {
    assert.ok(css.includes(variable), variable);
  }
  for (const phase of ["pagi", "siang", "sore", "malam"]) {
    assert.ok(theme.includes(`data-time-theme="${phase}"`));
  }
  for (const action of ['action: "request"', 'action: "my_chat"', 'action: "my_send"', 'action: "redeem"']) {
    assert.ok(jsx.includes(action), action);
  }
  assert.match(jsx, /minLength=\{6\}/);
  assert.match(css, /\.fp-recovery-page\.is-chat/);
});
