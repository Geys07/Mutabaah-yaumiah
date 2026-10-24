import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(p)=>readFile(new URL("../"+p,import.meta.url),"utf8");

test("splash has a five second time cap without assuming account authorization",async()=>{
 const [app,css]=await Promise.all([read("src/App.jsx"),read("src/styles/splash-transition.css")]);
 assert.match(app,/const readingMs = session === 0 \? 4300 : 250;/);
 assert.match(app,/if \(elapsed >= readingMs\)/);
 assert.doesNotMatch(app,/dataReady &&\s*\(\s*elapsed >= readingMs/);
 assert.match(app,/className="mut-startup-connecting"/);
 assert.match(app,/!bootReady && !loadError/);
 assert.match(app,/progress=\{!bootReady \? Math\.min\(progress, 95\) : progress\}/);
 assert.match(app,/if \(loadError && !bootReady\) return <OfflineStartup/);
 assert.match(css,/\.mut-startup-connecting \{/);
 assert.match(css,/var\(--mut-ui-page/);
 assert.match(css,/var\(--mut-ui-accent/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
