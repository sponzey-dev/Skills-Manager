# Filesystem infrastructure source index

These adapters implement application ports with local filesystem operations. They must return classified failures rather than expose raw filesystem details to Domain or Presentation.

| Path | Responsibility | Boundary / Side effects |
| --- | --- | --- |
| `file-system-analysis-store.js` | Atomically persist schema-v2 analysis metadata and report v1 metadata as stale. | Reads and writes repository metadata; never upgrades stale documents destructively. |
| `file-system-analysis-triage-store.js` | Atomically persist exact potential-finding acknowledgement identities. | Stores only source hash, rule code, and evidence fingerprint. |
| `file-system-backup-comparison-port.js` | Compare backup and target content. | Reads filesystem content. |
| `file-system-global-skill-enrollment-store.js` | Persist canonical Global enrollment metadata. | Atomic JSON write under `.sponzey/`. |
| `file-system-hash-port.js` | Hash readable skill directories, including target-root-bounded external content. | Reads filesystem content without following content outside the declared target root. |
| `file-system-repository-index-store.js` | Persist source-index metadata. | Reads and writes repository metadata. |
| `file-system-skill-repository.js` | Manage source skill directories and enumerate bounded analysis artifacts. | Reads and mutates repository files; stages source creation/import/archive/promotion, verifies a readable regular root `SKILL.md` before commit, rewrites only an editable top-level manifest name during source rename, uses a temporary sibling for verified case-only renames, removes rejected partial sources, reports invalid existing source folders as diagnostics, and analysis enumeration never follows symlinks. |
| `file-system-target-store.js` | Scan and mutate applied target entries. | Reads and mutates target files; preserves the caller's canonical source path when a symlink resolves through a filesystem alias, reports a broken symlink's normalized raw destination for safe alias matching, renames exact managed symlink/copy placements without touching external entries, updates only a copy manifest's top-level name and managed metadata, preserves copy body content, and compensates a failed rename. A failed compensation is returned explicitly as `target-rename-recovery-required`. |
| `file-system-transfer-audit-store.js` | Persist transfer audit records. | Reads and writes repository metadata. |
| `local-git-skill-source-resolver.js` | Resolve source data from local Git. | Runs local Git adapter logic. |
| `local-git-version-control-port.js` | Read local repository version status. | Runs local Git adapter logic. |
