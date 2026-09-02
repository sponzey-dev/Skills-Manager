import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readmePath = "README.md";
const koreanReadmePath = "README.ko.md";

const requiredTroubleshootingSignals = Object.freeze([
  "~/SponzeySkills",
  "Codex",
  "Claude",
  "Diagnostics",
  "permission",
  "watcher",
  "Sponzey Skills: Refresh Skills",
  "Product Log",
  "Field Debug Log",
  "Main Repository is a source repository",
]);

const requiredDevelopmentSignals = Object.freeze([
  "npm test",
  "npm run build",
  "npm run release:gate",
  "Release VSIX",
  "GitHub Release",
  "scripts/run-vscode-extension-host.sh",
]);

test("README covers current troubleshooting and release signals", async () => {
  const content = await readFile(readmePath, "utf8");

  for (const signal of requiredTroubleshootingSignals) {
    assert.match(content, new RegExp(escapeRegExp(signal), "i"));
  }

  for (const signal of requiredDevelopmentSignals) {
    assert.match(content, new RegExp(escapeRegExp(signal), "i"));
  }
});

test("README keeps Main Repository documented as source-only", async () => {
  const content = await readFile(readmePath, "utf8");

  assert.match(content, /Main Repository stores source skills only/i);
  assert.doesNotMatch(
    content,
    /Main Repository (?:is|acts as|serves as) (?:a|the) Global Target/i,
  );
});

test("English and Korean READMEs link to each other and describe the current release", async () => {
  const [english, korean] = await Promise.all([
    readFile(readmePath, "utf8"),
    readFile(koreanReadmePath, "utf8"),
  ]);

  assert.match(english, /README\.ko\.md/);
  assert.match(korean, /README\.md/);
  assert.match(english, /0\.2\.x/);
  assert.match(korean, /0\.2\.x/);
  assert.match(korean, /Main Repository에는 원본 스킬만 저장합니다/);
  assert.match(english, /Rename Source Skill/);
  assert.match(korean, /Rename Source Skill/);
  assert.match(english, /confirmed Critical finding blocks installation/i);
  assert.match(korean, /확인된 Critical 진단은 설치를 차단/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
