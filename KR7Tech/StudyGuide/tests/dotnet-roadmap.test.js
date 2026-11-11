const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

test("C#/.NET roadmap defines 52 complete weeks and exactly 365 daily missions", () => {
  const source = fs.readFileSync(path.join(root, "dotnet-roadmap.js"), "utf8");
  const start = source.indexOf("const roadmapWeeks = [");
  const end = source.indexOf("const phaseNames =");
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const dataSource = source.slice(start, end) +
    "\nglobalThis.roadmapTestData = { roadmapWeeks, dayPatterns };";
  const context = { globalThis: {} };
  vm.runInNewContext(dataSource, context);

  const { roadmapWeeks, dayPatterns } = context.globalThis.roadmapTestData;
  assert.equal(roadmapWeeks.length, 52);
  assert.equal(dayPatterns.length, 7);
  assert.equal(roadmapWeeks.length * dayPatterns.length + 1, 365);
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map(phase => roadmapWeeks.filter(week => week.phase === phase).length),
    [8, 10, 12, 9, 7, 6]
  );
  assert.ok(roadmapWeeks.every(week =>
    ["title", "concept", "lab", "failure", "apply", "interview", "outcome"]
      .every(field => typeof week[field] === "string" && week[field].trim().length > 0)
  ));
  assert.match(source, /number: 365/);
});
