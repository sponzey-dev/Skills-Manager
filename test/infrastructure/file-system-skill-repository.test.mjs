import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { FileSystemSkillRepository } from "../../src/infrastructure/filesystem/file-system-skill-repository.js";

test("initializeRepository creates main repository directories in explicit path", async () => {
  const repositoryPath = await createTempPath("ssm-repo-init-");
  const repository = new FileSystemSkillRepository();

  const result = await repository.initializeRepository({ repositoryPath });

  assert.equal(result.ok, true);
  assert.deepEqual(result.createdDirectories, ["skills", "backups", ".sponzey"]);
  await assertDirectory(path.join(repositoryPath, "skills"));
  await assertDirectory(path.join(repositoryPath, "backups"));
  await assertDirectory(path.join(repositoryPath, ".sponzey"));
});

test("scanSourceSkills returns only skills/* directories that contain SKILL.md", async () => {
  const repositoryPath = await createTempPath("ssm-repo-scan-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await mkdir(path.join(repositoryPath, "skills", "valid"), { recursive: true });
  await mkdir(path.join(repositoryPath, "skills", "no-skill"), { recursive: true });
  await mkdir(path.join(repositoryPath, "outside"), { recursive: true });
  await writeFile(path.join(repositoryPath, "skills", "valid", "SKILL.md"), "body");
  await writeFile(path.join(repositoryPath, "skills", "no-skill", "README.md"), "readme");
  await writeFile(path.join(repositoryPath, "outside", "SKILL.md"), "body");

  const result = await repository.scanSourceSkills({ repositoryPath });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.sources.map((source) => source.name),
    ["valid"],
  );
  assert.equal(result.sources[0].id, "valid");
  assert.equal(result.sources[0].sourcePath.endsWith("/skills/valid"), true);
});

test("scanSourceSkills returns empty sources when skills directory is missing", async () => {
  const repositoryPath = await createTempPath("ssm-repo-missing-skills-");
  const repository = new FileSystemSkillRepository();

  const result = await repository.scanSourceSkills({ repositoryPath });

  assert.deepEqual(result, {
    ok: true,
    sources: [],
  });
});

test("repository metadata can be written and read from .sponzey/repository.json", async () => {
  const repositoryPath = await createTempPath("ssm-repo-metadata-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  const metadata = Object.freeze({
    schemaVersion: 1,
    repositoryId: "repo-1",
    updatedAt: "2026-06-28T00:00:00.000Z",
  });

  const writeResult = await repository.writeRepositoryMetadata({
    repositoryPath,
    metadata,
  });
  const readResult = await repository.readRepositoryMetadata({ repositoryPath });

  assert.equal(writeResult.ok, true);
  assert.equal(writeResult.metadataPath.endsWith("/.sponzey/repository.json"), true);
  assert.equal(
    await readFile(path.join(repositoryPath, ".sponzey", "repository.json"), "utf8"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  assert.deepEqual(readResult, {
    ok: true,
    metadata,
    metadataPath: writeResult.metadataPath,
  });
});

test("invalid repository metadata returns typed parse error without throwing", async () => {
  const repositoryPath = await createTempPath("ssm-repo-invalid-json-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await writeFile(
    path.join(repositoryPath, ".sponzey", "repository.json"),
    "{ invalid json",
  );

  const result = await repository.readRepositoryMetadata({ repositoryPath });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "repository-metadata-invalid-json",
      severity: "error",
      message: "Repository metadata must be valid JSON.",
    },
  });
});

test("createSourceSkill writes SKILL.md inside main repository skills directory", async () => {
  const repositoryPath = await createTempPath("ssm-repo-create-source-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });

  const result = await repository.createSourceSkill({
    repositoryPath,
    skillName: "helper",
    description: "Use this skill when writing helper code.",
    body: "Help with focused implementation.",
  });

  assert.equal(result.ok, true);
  assert.equal(result.source.name, "helper");
  assert.equal(result.source.sourcePath.endsWith("/skills/helper"), true);
  assert.equal(
    await readFile(path.join(repositoryPath, "skills", "helper", "SKILL.md"), "utf8"),
    [
      "---",
      "name: helper",
      "description: Use this skill when writing helper code.",
      "---",
      "",
      "Help with focused implementation.",
      "",
    ].join("\n"),
  );
});

test("createSourceSkill removes a committed source when post-commit manifest read-back fails", async () => {
  const repositoryPath = await createTempPath("ssm-repo-readback-rollback-");
  let inspections = 0;
  const repository = new FileSystemSkillRepository({
    manifestInspector: async () => {
      inspections += 1;
      return inspections === 2
        ? { ok: false, error: { code: "source-skill-md-unreadable", severity: "error", message: "Source SKILL.md cannot be read." } }
        : { ok: true };
    },
  });
  await repository.initializeRepository({ repositoryPath });

  const result = await repository.createSourceSkill({
    repositoryPath,
    skillName: "readback-failure",
    description: "Description",
    body: "Body",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "source-skill-md-unreadable");
  assert.equal(inspections, 2);
  await assert.rejects(() => stat(path.join(repositoryPath, "skills", "readback-failure")), { code: "ENOENT" });
});

test("createSourceSkill returns RecoveryRequired when committed-source cleanup fails after read-back", async () => {
  const repositoryPath = await createTempPath("ssm-repo-readback-recovery-");
  let inspections = 0;
  const repository = new FileSystemSkillRepository({
    manifestInspector: async () => {
      inspections += 1;
      return inspections === 2
        ? { ok: false, error: { code: "source-skill-md-unreadable", severity: "error", message: "Source SKILL.md cannot be read." } }
        : { ok: true };
    },
    sourceCleanup: async () => ({
      ok: false,
      recoveryRequired: true,
      error: { code: "source-cleanup-failed", severity: "error", message: "An incomplete source skill could not be removed." },
    }),
  });
  await repository.initializeRepository({ repositoryPath });

  const result = await repository.createSourceSkill({
    repositoryPath,
    skillName: "readback-recovery",
    description: "Description",
    body: "Body",
  });

  assert.equal(result.ok, false);
  assert.equal(result.recoveryRequired, true);
  assert.equal(result.error.code, "source-cleanup-failed");
  await assertDirectory(path.join(repositoryPath, "skills", "readback-recovery"));
});

test("createSourceSkill rejects existing source and path traversal", async () => {
  const repositoryPath = await createTempPath("ssm-repo-create-reject-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await mkdir(path.join(repositoryPath, "skills", "existing"), { recursive: true });

  const conflictResult = await repository.createSourceSkill({
    repositoryPath,
    skillName: "existing",
    description: "Description",
    body: "Body",
  });
  const traversalResult = await repository.createSourceSkill({
    repositoryPath,
    skillName: "../escape",
    description: "Description",
    body: "Body",
  });

  assert.deepEqual(conflictResult, {
    ok: false,
    error: {
      code: "source-name-conflict",
      severity: "error",
      message: "Source skill already exists.",
    },
  });
  assert.deepEqual(traversalResult, {
    ok: false,
    error: {
      code: "source-path-traversal-rejected",
      severity: "error",
      message: "Source skill name must stay inside the repository skills directory.",
    },
  });
});

test("importSourceSkill copies external folder and writes origin metadata", async () => {
  const repositoryPath = await createTempPath("ssm-repo-import-");
  const externalPath = await createTempPath("ssm-external-skill-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await writeFile(path.join(externalPath, "SKILL.md"), "external");
  await mkdir(path.join(externalPath, "references"), { recursive: true });
  await writeFile(path.join(externalPath, "references", "info.md"), "reference");
  const origin = {
    type: "local-folder",
    path: externalPath,
  };

  const result = await repository.importSourceSkill({
    repositoryPath,
    externalSourcePath: externalPath,
    skillName: "imported",
    origin,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source.name, "imported");
  assert.equal(
    await readFile(path.join(repositoryPath, "skills", "imported", "SKILL.md"), "utf8"),
    "external",
  );
  assert.equal(
    await readFile(
      path.join(repositoryPath, "skills", "imported", "references", "info.md"),
      "utf8",
    ),
    "reference",
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(repositoryPath, "skills", "imported", ".sponzey-source.json"),
        "utf8",
      ),
    ),
    { origin },
  );
});

test("importSourceSkill rejects a folder without a root SKILL.md before creating a source", async () => {
  const repositoryPath = await createTempPath("ssm-repo-import-missing-manifest-");
  const externalPath = await createTempPath("ssm-external-no-manifest-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await writeFile(path.join(externalPath, "README.md"), "not a skill");

  const result = await repository.importSourceSkill({
    repositoryPath,
    externalSourcePath: externalPath,
    skillName: "not-a-skill",
    origin: { type: "local-folder", path: externalPath },
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "source-skill-md-missing",
      severity: "error",
      message: "Source skill must contain SKILL.md at its root.",
      recommendation: "Choose a skill folder that contains SKILL.md at its root.",
    },
  });
  await assertRejectsMissing(path.join(repositoryPath, "skills", "not-a-skill"));
});

test("scanSourceSkills reports invalid source folders without listing them as sources", async () => {
  const repositoryPath = await createTempPath("ssm-repo-scan-invalid-source-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await mkdir(path.join(repositoryPath, "skills", "valid"), { recursive: true });
  await mkdir(path.join(repositoryPath, "skills", "missing-manifest"), { recursive: true });
  await writeFile(path.join(repositoryPath, "skills", "valid", "SKILL.md"), "valid");

  const result = await repository.scanSourceSkills({ repositoryPath });

  assert.deepEqual(result.sources.map((source) => source.name), ["valid"]);
  assert.deepEqual(result.diagnostics, [
    {
      code: "source-skill-md-missing",
      severity: "warning",
      message: "Source skill folder is missing SKILL.md.",
      recommendation: "Add SKILL.md at the root or remove the invalid source folder.",
      skillName: "missing-manifest",
    },
  ]);
});

test("readSourceSkillFiles returns source files keyed by relative paths", async () => {
  const repositoryPath = await createTempPath("ssm-repo-read-source-files-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  const sourcePath = path.join(repositoryPath, "skills", "reader");
  await mkdir(path.join(sourcePath, "references"), { recursive: true });
  await writeFile(path.join(sourcePath, "SKILL.md"), "skill body");
  await writeFile(
    path.join(sourcePath, "references", "details.md"),
    "reference body",
  );

  const result = await repository.readSourceSkillFiles({ sourcePath });

  assert.deepEqual(result, {
    ok: true,
    files: {
      "SKILL.md": "skill body",
      "references/details.md": "reference body",
    },
  });
});

test("readSourceSkillArtifacts enforces analysis budgets without following links", async () => {
  const repositoryPath = await createTempPath("ssm-repo-analysis-artifacts-");
  const outsidePath = await createTempPath("ssm-repo-analysis-outside-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  const sourcePath = path.join(repositoryPath, "skills", "reader");
  await mkdir(path.join(sourcePath, "scripts"), { recursive: true });
  await writeFile(path.join(sourcePath, "SKILL.md"), "safe skill");
  await writeFile(path.join(sourcePath, "scripts", "large.sh"), "x".repeat(32));
  await writeFile(path.join(sourcePath, "scripts", "binary.bin"), Buffer.from([0, 1, 2]));
  await writeFile(path.join(outsidePath, "outside.md"), "outside");
  await symlink(outsidePath, path.join(sourcePath, "linked-outside"));

  const result = await repository.readSourceSkillArtifacts({
    sourcePath,
    budget: {
      maxFiles: 10,
      maxDepth: 4,
      maxTextFileBytes: 16,
      maxTotalTextBytes: 64,
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.artifacts.map((artifact) => artifact.relativePath),
    ["SKILL.md"],
  );
  assert.deepEqual(result.coverage.skipped, [
    {
      code: "analysis-artifact-symlink-skipped",
      relativePath: "linked-outside",
    },
    {
      code: "analysis-artifact-binary-skipped",
      relativePath: "scripts/binary.bin",
    },
    {
      code: "analysis-artifact-file-limit-skipped",
      relativePath: "scripts/large.sh",
      sizeBytes: 32,
    },
  ]);
});

test("readSourceSkillArtifacts reports encoding, depth, and count coverage gaps", async () => {
  const repositoryPath = await createTempPath("ssm-repo-analysis-coverage-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  const sourcePath = path.join(repositoryPath, "skills", "reader");
  await mkdir(path.join(sourcePath, "nested", "deeper"), { recursive: true });
  await writeFile(path.join(sourcePath, "SKILL.md"), "safe skill");
  await writeFile(path.join(sourcePath, "broken.txt"), Buffer.from([0xc3, 0x28]));
  await writeFile(path.join(sourcePath, "nested", "deeper", "hidden.md"), "hidden");

  const result = await repository.readSourceSkillArtifacts({
    sourcePath,
    budget: {
      maxFiles: 1,
      maxDepth: 1,
      maxTextFileBytes: 64,
      maxTotalTextBytes: 64,
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.coverage.skipped, [
    {
      code: "analysis-artifact-invalid-encoding-skipped",
      relativePath: "broken.txt",
    },
    {
      code: "analysis-artifact-depth-limit-skipped",
      relativePath: "nested/deeper",
    },
    {
      code: "analysis-artifact-count-limit-skipped",
      relativePath: "SKILL.md",
    },
  ]);
});

test("copyTargetSkillToMainRepository copies target skill into skills without overwrite", async () => {
  const repositoryPath = await createTempPath("ssm-repo-copy-target-");
  const targetSkillPath = await createTempPath("ssm-target-source-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await writeFile(path.join(targetSkillPath, "SKILL.md"), "target skill");
  const origin = {
    type: "target-copy",
    targetId: "global:codex",
    targetPath: targetSkillPath,
  };

  const result = await repository.copyTargetSkillToMainRepository({
    repositoryPath,
    targetSkillPath,
    skillName: "copied",
    origin,
  });
  const conflictResult = await repository.copyTargetSkillToMainRepository({
    repositoryPath,
    targetSkillPath,
    skillName: "copied",
    origin,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source.name, "copied");
  assert.equal(
    await readFile(path.join(repositoryPath, "skills", "copied", "SKILL.md"), "utf8"),
    "target skill",
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(repositoryPath, "skills", "copied", ".sponzey-source.json"),
        "utf8",
      ),
    ),
    { origin },
  );
  assert.equal(conflictResult.ok, false);
  assert.equal(conflictResult.error.code, "source-name-conflict");
});

test("backupTargetSkillToMainRepository writes snapshot without mutating target", async () => {
  const repositoryPath = await createTempPath("ssm-repo-backup-target-");
  const targetSkillPath = await createTempPath("ssm-target-backup-source-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await writeFile(path.join(targetSkillPath, "SKILL.md"), "target skill");
  const metadata = {
    type: "target-backup",
    targetId: "global:codex",
    targetPath: targetSkillPath,
    skillName: "external",
    snapshotId: "snapshot-001",
  };

  const result = await repository.backupTargetSkillToMainRepository({
    repositoryPath,
    targetSkillPath,
    skillName: "external",
    snapshotId: "snapshot-001",
    metadata,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.backup, {
    skillName: "external",
    snapshotId: "snapshot-001",
    backupPath: normalizeExpectedPath(
      path.join(repositoryPath, "backups", "external", "snapshot-001"),
    ),
  });
  assert.equal(
    await readFile(
      path.join(repositoryPath, "backups", "external", "snapshot-001", "SKILL.md"),
      "utf8",
    ),
    "target skill",
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(
          repositoryPath,
          "backups",
          "external",
          "snapshot-001",
          ".sponzey-backup.json",
        ),
        "utf8",
      ),
    ),
    metadata,
  );
  assert.equal(await readFile(path.join(targetSkillPath, "SKILL.md"), "utf8"), "target skill");
});

test("renameSourceSkill and deleteSourceSkill mutate only source directory", async () => {
  const repositoryPath = await createTempPath("ssm-repo-source-lifecycle-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await repository.createSourceSkill({
    repositoryPath,
    skillName: "old-name",
    description: "Description",
    body: "Body",
  });

  const renameResult = await repository.renameSourceSkill({
    repositoryPath,
    oldName: "old-name",
    newName: "new-name",
  });

  assert.equal(renameResult.ok, true);
  assert.equal(renameResult.source.name, "new-name");
  await assertRejectsMissing(path.join(repositoryPath, "skills", "old-name"));
  assert.equal(
    await readFile(path.join(repositoryPath, "skills", "new-name", "SKILL.md"), "utf8"),
    [
      "---",
      "name: new-name",
      "description: Description",
      "---",
      "",
      "Body",
      "",
    ].join("\n"),
  );
  const deleteResult = await repository.deleteSourceSkill({
    repositoryPath,
    skillName: "new-name",
  });
  await assertRejectsMissing(path.join(repositoryPath, "skills", "new-name"));
  assert.equal(deleteResult.ok, true);
  assert.equal(deleteResult.skillName, "new-name");
});

test("renameSourceSkill preserves frontmatter comments and CRLF while changing only name", async () => {
  const repositoryPath = await createTempPath("ssm-repo-rename-manifest-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  const oldPath = path.join(repositoryPath, "skills", "old-name");
  await mkdir(oldPath, { recursive: true });
  const original = [
    "---",
    "# retain this comment",
    "name: old-name # retain inline comment",
    "description: Keep every other line",
    "---",
    "",
    "old-name in the body must stay unchanged.",
    "",
  ].join("\r\n");
  await writeFile(path.join(oldPath, "SKILL.md"), original);

  const result = await repository.renameSourceSkill({
    repositoryPath,
    oldName: "old-name",
    newName: "new-name",
  });

  assert.equal(result.ok, true);
  assert.equal(
    await readFile(path.join(repositoryPath, "skills", "new-name", "SKILL.md"), "utf8"),
    original.replace("name: old-name # retain inline comment", "name: new-name # retain inline comment"),
  );
});

test("renameSourceSkill supports a case-only source name change", async () => {
  const repositoryPath = await createTempPath("ssm-repo-case-only-rename-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await repository.createSourceSkill({ repositoryPath, skillName: "alpha", description: "Description", body: "Body" });

  const result = await repository.renameSourceSkill({ repositoryPath, oldName: "alpha", newName: "Alpha" });

  assert.equal(result.ok, true);
  assert.equal(result.source.name, "Alpha");
  assert.match(await readFile(path.join(repositoryPath, "skills", "Alpha", "SKILL.md"), "utf8"), /^---\nname: Alpha\n/m);
});

test("renameSourceSkill rejects malformed or duplicate manifest name without renaming source", async () => {
  const repositoryPath = await createTempPath("ssm-repo-rename-invalid-manifest-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  const oldPath = path.join(repositoryPath, "skills", "old-name");
  await mkdir(oldPath, { recursive: true });
  await writeFile(
    path.join(oldPath, "SKILL.md"),
    ["---", "name: old-name", "name: duplicate", "---", "", "Body", ""].join("\n"),
  );

  const result = await repository.renameSourceSkill({
    repositoryPath,
    oldName: "old-name",
    newName: "new-name",
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "source-manifest-name-invalid",
      severity: "error",
      message: "Source SKILL.md must contain one editable top-level name field.",
      recommendation: "Fix the SKILL.md frontmatter name field before renaming the source.",
    },
  });
  await assertDirectory(oldPath);
  await assertRejectsMissing(path.join(repositoryPath, "skills", "new-name"));
});

test("exportSourceSkill and importSkillArchiveToMainRepository roundtrip source files", async () => {
  const repositoryPath = await createTempPath("ssm-repo-archive-");
  const archivePath = path.join(repositoryPath, "alpha.sponzey-skill.json");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await repository.createSourceSkill({
    repositoryPath,
    skillName: "alpha",
    description: "Description",
    body: "Body",
  });
  await mkdir(path.join(repositoryPath, "skills", "alpha", "references"), {
    recursive: true,
  });
  await writeFile(
    path.join(repositoryPath, "skills", "alpha", "references", "info.md"),
    "reference",
  );

  const exportResult = await repository.exportSourceSkill({
    repositoryPath,
    skillName: "alpha",
    archivePath,
  });
  const importResult = await repository.importSkillArchiveToMainRepository({
    repositoryPath,
    archivePath,
    skillName: "alpha-imported",
  });

  assert.equal(exportResult.ok, true);
  assert.deepEqual(JSON.parse(await readFile(archivePath, "utf8")).format, "sponzey-skill-archive-v1");
  assert.equal(importResult.ok, true);
  assert.equal(
    await readFile(
      path.join(repositoryPath, "skills", "alpha-imported", "references", "info.md"),
      "utf8",
    ),
    "reference",
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(
          repositoryPath,
          "skills",
          "alpha-imported",
          ".sponzey-source.json",
        ),
        "utf8",
      ),
    ).origin,
    {
      type: "archive",
      archivePath: normalizeExpectedPath(archivePath),
    },
  );
});

test("importSkillArchiveToMainRepository removes an invalid staged source and reports missing SKILL.md", async () => {
  const repositoryPath = await createTempPath("ssm-repo-archive-missing-manifest-");
  const archiveRoot = await createTempPath("ssm-archive-missing-manifest-");
  const archivePath = path.join(archiveRoot, "invalid.sponzey-skill.json");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await writeFile(
    archivePath,
    `${JSON.stringify({
      format: "sponzey-skill-archive-v1",
      skillName: "invalid",
      files: { "README.md": "not a skill" },
    })}\n`,
  );

  const result = await repository.importSkillArchiveToMainRepository({
    repositoryPath,
    archivePath,
    skillName: "invalid",
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "source-skill-md-missing",
      severity: "error",
      message: "Source skill must contain SKILL.md at its root.",
      recommendation: "Choose a skill folder that contains SKILL.md at its root.",
    },
  });
  await assertRejectsMissing(path.join(repositoryPath, "skills", "invalid"));
});

test("scanBackups, promoteBackupToSource, and deleteBackup manage backup catalog", async () => {
  const repositoryPath = await createTempPath("ssm-repo-backup-catalog-");
  const targetSkillPath = await createTempPath("ssm-target-backup-catalog-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  await writeFile(path.join(targetSkillPath, "SKILL.md"), "backup body");
  await repository.backupTargetSkillToMainRepository({
    repositoryPath,
    targetSkillPath,
    skillName: "alpha",
    snapshotId: "snapshot-001",
    metadata: {
      type: "target-backup",
      skillName: "alpha",
    },
  });

  const scanResult = await repository.scanBackups({ repositoryPath });
  const promoteResult = await repository.promoteBackupToSource({
    repositoryPath,
    backupPath: path.join(repositoryPath, "backups", "alpha", "snapshot-001"),
    skillName: "alpha-restored",
  });
  const deleteResult = await repository.deleteBackup({
    backupPath: path.join(repositoryPath, "backups", "alpha", "snapshot-001"),
  });

  assert.equal(scanResult.ok, true);
  assert.equal(scanResult.backups[0].skillName, "alpha");
  assert.equal(scanResult.backups[0].snapshotId, "snapshot-001");
  assert.equal(promoteResult.ok, true);
  assert.equal(
    await readFile(
      path.join(repositoryPath, "skills", "alpha-restored", "SKILL.md"),
      "utf8",
    ),
    "backup body",
  );
  await assertRejectsMissing(
    path.join(repositoryPath, "skills", "alpha-restored", ".sponzey-backup.json"),
  );
  assert.equal(deleteResult.ok, true);
  await assertRejectsMissing(
    path.join(repositoryPath, "backups", "alpha", "snapshot-001"),
  );
});

test("promoteBackupToSource rejects a backup without a root SKILL.md and leaves no source", async () => {
  const repositoryPath = await createTempPath("ssm-repo-promote-missing-manifest-");
  const repository = new FileSystemSkillRepository();
  await repository.initializeRepository({ repositoryPath });
  const backupPath = path.join(repositoryPath, "backups", "invalid", "snapshot-001");
  await mkdir(backupPath, { recursive: true });
  await writeFile(path.join(backupPath, ".sponzey-backup.json"), "{}\n");

  const result = await repository.promoteBackupToSource({
    repositoryPath,
    backupPath,
    skillName: "invalid-promoted",
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: "source-skill-md-missing",
      severity: "error",
      message: "Source skill must contain SKILL.md at its root.",
      recommendation: "Choose a skill folder that contains SKILL.md at its root.",
    },
  });
  await assertRejectsMissing(path.join(repositoryPath, "skills", "invalid-promoted"));
});

async function createTempPath(prefix) {
  return mkdtemp(path.join(tmpdir(), prefix));
}

async function assertDirectory(directoryPath) {
  const stats = await stat(directoryPath);
  assert.equal(stats.isDirectory(), true);
}

async function assertRejectsMissing(filePath) {
  await assert.rejects(() => stat(filePath), { code: "ENOENT" });
}

function normalizeExpectedPath(value) {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}
