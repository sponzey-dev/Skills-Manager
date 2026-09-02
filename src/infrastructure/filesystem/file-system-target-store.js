import {
  access,
  cp,
  lstat,
  mkdir,
  readFile,
  readlink,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { normalizePath } from "../../domain/index.js";

const APPLIED_METADATA_FILE = ".sponzey-applied.json";
const BACKUP_METADATA_FILE = ".sponzey-backup.json";

export class FileSystemTargetStore {
  constructor({ fileSystem = {} } = {}) {
    this.scanFileSystem = {
      access: fileSystem.access ?? access,
      lstat: fileSystem.lstat ?? lstat,
      readFile: fileSystem.readFile ?? readFile,
      readdir: fileSystem.readdir ?? readdir,
      realpath: fileSystem.realpath ?? realpath,
      readlink: fileSystem.readlink ?? readlink,
    };
    this.mutationFileSystem = {
      lstat: fileSystem.lstat ?? lstat,
      readFile: fileSystem.readFile ?? readFile,
      rename: fileSystem.rename ?? rename,
      symlink: fileSystem.symlink ?? symlink,
      unlink: fileSystem.unlink ?? unlink,
      writeFile: fileSystem.writeFile ?? writeFile,
    };
  }

  async linkSkillToTarget({ sourcePath, targetRootPath, skillName }) {
    const destinationResult = resolveTargetDestination({
      targetRootPath,
      skillName,
    });

    if (!destinationResult.ok) {
      return destinationResult;
    }

    const targetPath = destinationResult.targetPath;
    if (await canAccess(targetPath)) {
      return {
        ok: false,
        error: {
          code: "target-overwrite-rejected",
          severity: "error",
          message: "Target destination already exists.",
        },
      };
    }

    return withFileSystemResult(async () => {
      await mkdir(targetRootPath, { recursive: true });
      await symlink(sourcePath, targetPath, "dir");

      return {
        ok: true,
        targetPath: normalizePath(targetPath),
        linkTargetPath: normalizePath(sourcePath),
      };
    }, "link-skill-to-target");
  }

  async copySkillToTarget({ sourcePath, targetRootPath, skillName, metadata }) {
    const destinationResult = resolveTargetDestination({
      targetRootPath,
      skillName,
    });

    if (!destinationResult.ok) {
      return destinationResult;
    }

    const targetPath = destinationResult.targetPath;
    if (await canAccess(targetPath)) {
      return {
        ok: false,
        error: {
          code: "target-overwrite-rejected",
          severity: "error",
          message: "Target destination already exists.",
        },
      };
    }

    return withFileSystemResult(async () => {
      await mkdir(targetRootPath, { recursive: true });
      await cp(sourcePath, targetPath, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });

      const metadataPath = path.join(targetPath, APPLIED_METADATA_FILE);
      await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

      return {
        ok: true,
        targetPath: normalizePath(targetPath),
        metadataPath: normalizePath(metadataPath),
      };
    }, "copy-skill-to-target");
  }

  async restoreBackupToTarget({
    backupPath,
    targetRootPath,
    skillName,
    overwrite,
    metadata,
  }) {
    const destinationResult = resolveTargetDestination({
      targetRootPath,
      skillName,
    });

    if (!destinationResult.ok) {
      return destinationResult;
    }

    const targetPath = destinationResult.targetPath;
    const targetExists = await canAccess(targetPath);
    if (targetExists && overwrite !== true) {
      return {
        ok: false,
        error: {
          code: "target-overwrite-rejected",
          severity: "error",
          message: "Target destination already exists.",
        },
      };
    }

    return withFileSystemResult(async () => {
      await mkdir(targetRootPath, { recursive: true });
      if (targetExists) {
        await rm(targetPath, { recursive: true, force: false });
      }

      await cp(backupPath, targetPath, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      await rm(path.join(targetPath, BACKUP_METADATA_FILE), {
        force: true,
      });

      const metadataPath = path.join(targetPath, APPLIED_METADATA_FILE);
      await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

      return {
        ok: true,
        targetPath: normalizePath(targetPath),
        metadataPath: normalizePath(metadataPath),
      };
    }, "restore-backup-to-target");
  }

  async removeTargetEntry({ targetPath }) {
    return withFileSystemResult(async () => {
      const stats = await lstat(targetPath);
      const normalizedTargetPath = normalizePath(targetPath);

      if (stats.isSymbolicLink()) {
        await unlink(targetPath);

        return {
          ok: true,
          removedPath: normalizedTargetPath,
          removedKind: "symlink",
        };
      }

      if (stats.isDirectory()) {
        await rm(targetPath, { recursive: true, force: false });

        return {
          ok: true,
          removedPath: normalizedTargetPath,
          removedKind: "directory",
        };
      }

      await unlink(targetPath);

      return {
        ok: true,
        removedPath: normalizedTargetPath,
        removedKind: "file",
      };
    }, "remove-target-entry");
  }

  async renameManagedSymlink({ oldTargetPath, newTargetPath, targetRootPath, skillName, sourcePath }) {
    const destinationResult = newTargetPath
      ? { ok: true, targetPath: newTargetPath }
      : resolveTargetDestination({ targetRootPath, skillName });
    if (!destinationResult.ok) return destinationResult;
    newTargetPath = destinationResult.targetPath;
    if (await canAccess(newTargetPath)) {
      return {
        ok: false,
        error: {
          code: "target-overwrite-rejected",
          severity: "error",
          message: "Target destination already exists.",
        },
      };
    }

    return withFileSystemResult(async () => {
      const fileSystem = this.mutationFileSystem;
      const stats = await fileSystem.lstat(oldTargetPath);
      if (!stats.isSymbolicLink()) {
        return {
          ok: false,
          error: {
            code: "managed-symlink-required",
            severity: "error",
            message: "Managed target rename requires a symbolic link.",
          },
        };
      }
      await fileSystem.symlink(sourcePath, newTargetPath, "dir");
      try {
        await fileSystem.unlink(oldTargetPath);
      } catch (error) {
        try {
          await fileSystem.unlink(newTargetPath);
        } catch (rollbackError) {
          return targetRenameRecoveryRequired(error, rollbackError);
        }
        return targetRenameRolledBack(error);
      }
      return {
        ok: true,
        targetPath: normalizePath(newTargetPath),
        linkTargetPath: normalizePath(sourcePath),
      };
    }, "rename-managed-symlink");
  }

  async renameManagedCopy({ oldTargetPath, targetRootPath, skillName, metadata }) {
    const destinationResult = resolveTargetDestination({ targetRootPath, skillName });
    if (!destinationResult.ok) return destinationResult;
    const newTargetPath = destinationResult.targetPath;
    if (await canAccess(newTargetPath)) {
      return { ok: false, error: { code: "target-overwrite-rejected", severity: "error", message: "Target destination already exists." } };
    }
    return withFileSystemResult(async () => {
      const fileSystem = this.mutationFileSystem;
      const stats = await fileSystem.lstat(oldTargetPath);
      if (!stats.isDirectory() || stats.isSymbolicLink()) return { ok: false, error: { code: "managed-copy-required", severity: "error", message: "Managed target rename requires a copy directory." } };
      const oldManifestPath = path.join(oldTargetPath, "SKILL.md");
      const oldMetadataPath = path.join(oldTargetPath, APPLIED_METADATA_FILE);
      const manifest = await fileSystem.readFile(oldManifestPath, "utf8");
      const oldMetadata = await fileSystem.readFile(oldMetadataPath, "utf8");
      const nextManifest = replaceTopLevelName(manifest, skillName);
      if (nextManifest === null) return { ok: false, error: { code: "source-manifest-name-invalid", severity: "error", message: "Source SKILL.md must contain one editable top-level name field." } };
      await fileSystem.rename(oldTargetPath, newTargetPath);
      try {
        await fileSystem.writeFile(path.join(newTargetPath, "SKILL.md"), nextManifest);
        await fileSystem.writeFile(path.join(newTargetPath, APPLIED_METADATA_FILE), `${JSON.stringify(metadata, null, 2)}\n`);
      } catch (error) {
        try {
          await fileSystem.rename(newTargetPath, oldTargetPath);
          await fileSystem.writeFile(oldManifestPath, manifest);
          await fileSystem.writeFile(oldMetadataPath, oldMetadata);
        } catch (rollbackError) {
          return targetRenameRecoveryRequired(error, rollbackError);
        }
        return targetRenameRolledBack(error);
      }
      return { ok: true, targetPath: normalizePath(newTargetPath), metadataPath: normalizePath(path.join(newTargetPath, APPLIED_METADATA_FILE)) };
    }, "rename-managed-copy");
  }

  async replaceCopyFromSource({ sourcePath, targetPath, metadata }) {
    return withFileSystemResult(async () => {
      await rm(targetPath, { recursive: true, force: false });
      await cp(sourcePath, targetPath, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      const metadataPath = path.join(targetPath, APPLIED_METADATA_FILE);
      await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
      return {
        ok: true,
        targetPath: normalizePath(targetPath),
        metadataPath: normalizePath(metadataPath),
      };
    }, "replace-copy-from-source");
  }

  async convertSymlinkToCopy({ sourcePath, targetPath, metadata }) {
    return withFileSystemResult(async () => {
      await unlink(targetPath);
      await cp(sourcePath, targetPath, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      const metadataPath = path.join(targetPath, APPLIED_METADATA_FILE);
      await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
      return {
        ok: true,
        targetPath: normalizePath(targetPath),
        metadataPath: normalizePath(metadataPath),
      };
    }, "convert-symlink-to-copy");
  }

  async convertCopyToSymlink({ sourcePath, targetPath }) {
    return withFileSystemResult(async () => {
      await rm(targetPath, { recursive: true, force: false });
      await symlink(sourcePath, targetPath, "dir");
      return {
        ok: true,
        targetPath: normalizePath(targetPath),
        linkTargetPath: normalizePath(sourcePath),
      };
    }, "convert-copy-to-symlink");
  }

  async scanAppliedSkills({ targetPath, knownSourcePaths = [] }) {
    return withFileSystemResult(async () => {
      const knownSourcePathsByResolvedPath = await createKnownSourcePathsByResolvedPath(
        knownSourcePaths,
        this.scanFileSystem,
      );
      const entries = await readOptionalDirectoryEntries(
        targetPath,
        this.scanFileSystem,
      );
      entries.sort((left, right) => left.name.localeCompare(right.name));

      const appliedSkills = [];
      const diagnostics = [];

      for (const entry of entries) {
        const entryPath = path.join(targetPath, entry.name);
        let stats;
        try {
          stats = await this.scanFileSystem.lstat(entryPath);
        } catch (error) {
          diagnostics.push({
            code: "target-entry-unreadable",
            severity: "warning",
            riskLevel: "low",
            message: "A target entry could not be inspected.",
            skillName: entry.name,
            cause: error?.code,
          });
          continue;
        }

        if (stats.isSymbolicLink()) {
          const skill = await classifySymlink({
            name: entry.name,
            entryPath,
            knownSourcePathsByResolvedPath,
            diagnostics,
            fileSystem: this.scanFileSystem,
          });
          if (skill) {
            appliedSkills.push(skill);
          }
          continue;
        }

        if (!stats.isDirectory()) {
          continue;
        }

        const hasSkillMd = await canAccess(
          path.join(entryPath, "SKILL.md"),
          this.scanFileSystem,
        );
        if (!hasSkillMd) {
          continue;
        }

        appliedSkills.push(
          await classifyDirectory({
            name: entry.name,
            entryPath,
            diagnostics,
            fileSystem: this.scanFileSystem,
          }),
        );
      }

      return {
        ok: true,
        appliedSkills,
        diagnostics,
      };
    }, "scan-applied-skills");
  }
}

function resolveTargetDestination({ targetRootPath, skillName }) {
  const normalizedSkillName = String(skillName ?? "").trim();

  if (
    normalizedSkillName.length === 0 ||
    path.isAbsolute(normalizedSkillName)
  ) {
    return targetPathTraversalRejected();
  }

  const resolvedRootPath = path.resolve(targetRootPath);
  const resolvedTargetPath = path.resolve(resolvedRootPath, normalizedSkillName);

  if (
    resolvedTargetPath === resolvedRootPath ||
    !resolvedTargetPath.startsWith(`${resolvedRootPath}${path.sep}`)
  ) {
    return targetPathTraversalRejected();
  }

  return {
    ok: true,
    targetPath: resolvedTargetPath,
  };
}

function targetPathTraversalRejected() {
  return {
    ok: false,
    error: {
      code: "target-path-traversal-rejected",
      severity: "error",
      message: "Target skill name must stay inside the target root.",
    },
  };
}

async function createKnownSourcePathsByResolvedPath(knownSourcePaths, fileSystem) {
  const knownSourcePathsByResolvedPath = new Map();

  for (const sourcePath of knownSourcePaths) {
    const normalizedSourcePath = normalizePath(sourcePath);
    try {
      knownSourcePathsByResolvedPath.set(
        normalizePath(await fileSystem.realpath(sourcePath)),
        normalizedSourcePath,
      );
    } catch {
      knownSourcePathsByResolvedPath.set(normalizedSourcePath, normalizedSourcePath);
    }
  }

  return knownSourcePathsByResolvedPath;
}

async function classifySymlink({
  name,
  entryPath,
  knownSourcePathsByResolvedPath,
  diagnostics,
  fileSystem,
}) {
  let resolvedPath;

  try {
    resolvedPath = normalizePath(await fileSystem.realpath(entryPath));
  } catch {
    const linkTargetPath = await readLinkTargetPath({ entryPath, fileSystem });
    diagnostics.push({
      code: "broken-symlink",
      severity: "warning",
      riskLevel: "low",
      message: "Target skill symlink cannot be resolved.",
      skillName: name,
    });

    return {
      name,
      kind: "broken-symlink",
      targetPath: normalizePath(entryPath),
      ...(linkTargetPath ? { linkTargetPath } : {}),
    };
  }

  if (!(await canAccess(path.join(resolvedPath, "SKILL.md"), fileSystem))) {
    diagnostics.push({
      code: "symlink-skill-file-missing",
      severity: "warning",
      riskLevel: "low",
      message: "Resolved target symlink does not contain SKILL.md.",
      skillName: name,
    });
    return null;
  }

  const knownSourcePath = knownSourcePathsByResolvedPath.get(resolvedPath);
  if (knownSourcePath) {
    return {
      name,
      kind: "managed-symlink",
      targetPath: normalizePath(entryPath),
      sourcePath: knownSourcePath,
    };
  }

  return {
    name,
    kind: "external-symlink",
    targetPath: normalizePath(entryPath),
    sourcePath: resolvedPath,
  };
}

async function readLinkTargetPath({ entryPath, fileSystem }) {
  try {
    const target = await fileSystem.readlink(entryPath);
    return normalizePath(path.resolve(path.dirname(entryPath), target));
  } catch {
    return null;
  }
}

async function classifyDirectory({
  name,
  entryPath,
  diagnostics,
  fileSystem,
}) {
  const metadataResult = await readAppliedMetadata({
    name,
    entryPath,
    diagnostics,
    fileSystem,
  });

  if (metadataResult.invalid) {
    return {
      name,
      kind: "invalid-managed-copy",
      targetPath: normalizePath(entryPath),
    };
  }

  if (metadataResult.exists) {
    return {
      name,
      kind: "managed-copy",
      targetPath: normalizePath(entryPath),
      metadata: metadataResult.metadata,
    };
  }

  return {
    name,
    kind: "external",
    targetPath: normalizePath(entryPath),
  };
}

async function readAppliedMetadata({
  name,
  entryPath,
  diagnostics,
  fileSystem,
}) {
  try {
    const text = await fileSystem.readFile(
      path.join(entryPath, APPLIED_METADATA_FILE),
      "utf8",
    );
    return {
      exists: true,
      metadata: JSON.parse(text),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        exists: false,
      };
    }

    diagnostics.push({
      code: "invalid-applied-metadata",
      severity: "warning",
      riskLevel: "low",
      message: "Applied skill metadata must be valid JSON.",
      skillName: name,
    });

    return {
      invalid: true,
    };
  }
}

async function canAccess(filePath, fileSystem = { access }) {
  try {
    await fileSystem.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function replaceTopLevelName(markdown, name) {
  const opening = /^\uFEFF?---\r?\n/.exec(markdown);
  if (!opening) return null;
  const closing = /\r?\n---(?=\r?\n|$)/g;
  closing.lastIndex = opening[0].length;
  const end = closing.exec(markdown);
  if (!end) return null;
  const frontmatter = markdown.slice(opening[0].length, end.index);
  const matches = [...frontmatter.matchAll(/^(name:[ \t]*)([^#\r\n]*?)([ \t]*(?:#.*)?)$/gm)];
  if (matches.length !== 1 || matches[0][2].trim().length === 0) return null;
  const start = opening[0].length + matches[0].index;
  return markdown.slice(0, start) + `${matches[0][1]}${name}${matches[0][3]}` + markdown.slice(start + matches[0][0].length);
}

async function readOptionalDirectoryEntries(directoryPath, fileSystem) {
  try {
    return await fileSystem.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function targetRenameRolledBack(error) {
  return {
    ok: false,
    error: {
      code: "target-rename-rolled-back",
      severity: "error",
      message: "Managed target rename failed and was rolled back.",
      cause: error?.code,
    },
  };
}

function targetRenameRecoveryRequired(error, rollbackError) {
  return {
    ok: false,
    recoveryRequired: true,
    error: {
      code: "target-rename-recovery-required",
      severity: "error",
      message: "Managed target rename failed and automatic recovery did not complete.",
      cause: error?.code,
      recoveryCause: rollbackError?.code,
    },
  };
}

async function withFileSystemResult(operation, operationName) {
  try {
    return await operation();
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "filesystem-operation-failed",
        severity: "error",
        operation: operationName,
        message: `Filesystem operation failed during ${operationName}.`,
        cause: error?.code,
      },
    };
  }
}
