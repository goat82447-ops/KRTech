const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("interview studio includes all five offline practice labs", () => {
  const html = fs.readFileSync(path.join(root, "Interview-Studio.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "interview-studio.js"), "utf8");

  for (const id of ["debugging", "sql-lab", "system-design", "incident-lab", "project-stories"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /src="interview-studio\.js"/);
  assert.match(html, /cannot guarantee an interview result/i);
  assert.match(html, /does not execute your query/i);
  assert.match(html, /browser on this device/i);
  assert.doesNotMatch(script, /\bfetch\s*\(/);
});
