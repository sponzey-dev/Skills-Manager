import test from "node:test";
import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { renameSourceSkill } from "../../src/application/skill/skill-operation-use-cases.js";
import { FileSystemRepositoryIndexStore } from "../../src/infrastructure/filesystem/file-system-repository-index-store.js";
import { FileSystemSkillRepository } from "../../src/infrastructure/filesystem/file-system-skill-repository.js";
import { FileSystemTargetStore } from "../../src/infrastructure/filesystem/file-system-target-store.js";

test("renameSourceSkill coordinates a filesystem source, index, and managed symlink", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ssm-rename-integration-"));
  const repositoryPath = path.join(root, "repository");
  const targetPath = path.join(root, "target");
  const repository = new FileSystemSkillRepository();
  const targetStore = new FileSystemTargetStore();
  const indexStore = new FileSystemRepositoryIndexStore();
  await repository.initializeRepository({ repositoryPath });
  await repository.createSourceSkill({ repositoryPath, skillName: "alpha", description: "Fixture", body: "Original body" });
  await mkdir(targetPath, { recursive: true });
  await symlink(path.join(repositoryPath, "skills", "alpha"), path.join(targetPath, "alpha"), "dir");
  await indexStore.writeRepositoryIndex({
    repositoryPath,
    index: {
      schemaVersion: 1,
      indexedAt: "2026-09-02T00:00:00.000Z",
      sources: [{
        sourceId: "stable-source-id",
        sourceName: "alpha",
        sourcePath: path.join(repositoryPath, "skills", "alpha"),
        indexedAt: "2026-09-02T00:00:00.000Z",
        indexStatus: "indexed",
      }],
    },
  });
  const initialScan = await targetStore.scanAppliedSkills({
    targetPath,
    knownSourcePaths: [path.join(repositoryPath, "skills", "alpha")],
  });
  assert.deepEqual(initialScan.appliedSkills.map((entry) => entry.kind), ["managed-symlink"]);
  const targetRenameCalls = [];
  const renameScanResults = [];
  const renameScanInputs = [];

  const result = await renameSourceSkill({
    context: { mainRepositoryPath: repositoryPath, globalTargets: [{ id: "global:fixture", targetPath }] },
    input: { source: { id: "stable-source-id", name: "alpha", sourcePath: path.join(repositoryPath, "skills", "alpha") }, newName: "beta" },
    skillRepository: repository,
    targetStore: {
      async scanAppliedSkills(input) { renameScanInputs.push(input); const scan = await targetStore.scanAppliedSkills(input); renameScanResults.push(scan); return scan; },
      async renameManagedSymlink(input) { targetRenameCalls.push(input); return targetStore.renameManagedSymlink(input); },
    },
    repositoryIndexStore: indexStore,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source.id, "stable-source-id");
  assert.deepEqual(renameScanResults[0].appliedSkills.map((entry) => entry.kind), ["managed-symlink"]);
  assert.equal(renameScanResults[0].appliedSkills[0].sourcePath, path.join(repositoryPath, "skills", "alpha"));
  assert.deepEqual(renameScanInputs, [{ targetPath, knownSourcePaths: [path.join(repositoryPath, "skills", "alpha")] }]);
  assert.equal(targetRenameCalls.length, 1);
  await assert.rejects(() => lstat(path.join(repositoryPath, "skills", "alpha")), { code: "ENOENT" });
  assert.match(await readFile(path.join(repositoryPath, "skills", "beta", "SKILL.md"), "utf8"), /^name: beta$/m);
  await assert.rejects(() => lstat(path.join(targetPath, "alpha")), { code: "ENOENT" });
  assert.equal((await lstat(path.join(targetPath, "beta"))).isSymbolicLink(), true);
  const savedIndex = await indexStore.readRepositoryIndex({ repositoryPath });
  assert.equal(savedIndex.index.sources[0].sourceId, "stable-source-id");
  assert.equal(savedIndex.index.sources[0].sourceName, "beta");
  assert.deepEqual(savedIndex.index.sources[0].previousSourcePaths, [path.join(repositoryPath, "skills", "alpha")]);
});
