<p align="center">
  <img src="media/sponzey-skills-icon.png" width="112" alt="Sponzey Skills Manager icon">
</p>

<h1 align="center">Sponzey Skills Manager</h1>

<p align="center">Manage Agent Skills across AI clients and projects from VS Code.</p>

<p align="center">
  <strong>English</strong> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=Sponzey.sponzey-skills-manager"><img src="https://img.shields.io/visual-studio-marketplace/v/Sponzey.sponzey-skills-manager?style=flat-square&label=VS%20Code%20Marketplace" alt="VS Code Marketplace version"></a>
  <a href="https://github.com/sponzey-lab/Skills-Manager"><img src="https://img.shields.io/github/stars/sponzey-lab/Skills-Manager?style=flat-square" alt="GitHub stars"></a>
  <img src="https://img.shields.io/badge/license-GPL--2.0-6e7781?style=flat-square" alt="GPL-2.0 license">
</p>

Skill files are easy to duplicate across Codex, Claude Code, and individual projects. This extension keeps the originals in one repository and shows where each skill is installed.

## Features

- Create skills or import them from a local folder, GitHub URL, or Sponzey archive.
- Install a skill globally or in the current project as a copy or symlink.
- Manage a global skill across multiple AI clients from a single row.
- Check whether a copy has changed, a link is broken, or a target contains an unmanaged skill.
- Rename a source together with its `SKILL.md` name and managed installations.
- Scan skills for structural errors, conflicts, compatibility issues, and security risks.
- Copy, move, back up, compare, restore, and promote skills.

## Repository and targets

| View | Contents |
| --- | --- |
| **Main Repository** | Source skills you own and edit |
| **Global Skills** | Skills installed for configured AI clients |
| **Project Skills** | Skills installed in the current workspace |
| **Diagnostics** | Validation, sync, compatibility, and risk findings |

**Main Repository stores source skills only.** Main Repository is a source repository, not a Global Target. Installing or removing a skill from a target does not change or delete its source.

```text
Main Repository
└── code-reviewer                  source
    ├── SKILL.md
    ├── references/
    └── scripts/
          │
          ├── Codex global         copy or symlink
          ├── Claude global        copy or symlink
          └── current project      copy or symlink
```

## 0.2.x release highlights

- Global Skills now combines matching installations into one row and shows an icon for each AI client.
- Managed global skills can be installed automatically when a compatible target is registered later.
- The three skill lists now use the same flat, aligned layout.
- An import succeeds only when the root `SKILL.md` is readable and the saved skill can be found again. Failed imports report a reason and clean up partial files when possible.
- **Rename Source Skill** updates the folder, the top-level `name:` field, repository metadata, and reachable managed installations. It asks before changing a modified copy and preserves the rest of that copy.
- Diagnostics now distinguishes confirmed findings from possible issues, reports incomplete analysis, and detects stale managed installations.
- Failed file operations are rolled back when possible. If recovery is incomplete, the extension reports that state instead of returning success.

## Using the extension

### Add a skill

Create a starter skill, import a local directory, install from a repository URL, or restore an archive. The selected folder must contain a readable regular `SKILL.md` at its root.

GitHub repository and folder URLs can contain more than one skill. Invalid folders already present in the repository are left out of the source list and shown in Diagnostics.

### Install a skill

Use **Copy** when the installed skill should be independent. Use **Symlink** when edits in the Main Repository should be available immediately.

A global enrollment covers all eligible configured clients and can include compatible targets added later. Project targets are managed separately for each workspace.

Critical findings block installation. High-risk findings require confirmation. The extension does not overwrite an unmanaged target without asking.

### Rename and synchronize

Managed copies report whether the source, the target, or both have changed. You can update a copy from its source and switch between copy and symlink modes.

Renames are tracked with a stable source ID. If a project was closed during a rename, open it again and use the action shown in Diagnostics. Modified copies are not renamed until you confirm the change.

### Back up an installed skill

- **Copy to Main Repository** creates a source and keeps the installed skill.
- **Backup to Main Repository** saves a snapshot without changing the target.
- **Move to Main Repository** verifies the new source before removing or replacing the old target.
- A backup can be compared, restored, promoted to a source, or deleted.

## Diagnostics and privacy

Analysis runs locally and does not execute skill scripts, follow symlinks, or access the network. It checks the skill manifest and related text files within fixed file-count, depth, and size limits.

A single possible issue is not rated Critical. A confirmed Critical finding blocks installation; incomplete or uncertain results stay visible for review.

Diagnostics use relative file locations and shortened descriptions. Product Log contains basic operation results. Field Debug Log is optional and intended for short support sessions, while Development Log is for local development. Routine logs do not include skill contents, credentials, raw matches, or absolute user paths.

## Getting started

1. Install [Sponzey Skills Manager](https://marketplace.visualstudio.com/items?itemName=Sponzey.sponzey-skills-manager).
2. Open **Sponzey Skills** from the Activity Bar.
3. Keep the default `~/SponzeySkills` repository or choose another with **Sponzey Skills: Set Main Repository**.
4. Create or import a skill.
5. Right-click the source to install it globally or in the current project.
6. Check Diagnostics before installing an unfamiliar skill.

The default repository contains `skills/`, `backups/`, and `.sponzey/`. Do not use an installation folder such as `~/.agents/skills` or `~/.claude/skills` as the Main Repository.

## AI clients and targets

Codex and Claude Code are enabled by default.

| Client | Global target | Project target |
| --- | --- | --- |
| Codex | `~/.agents/skills` | `<workspace>/.agents/skills` |
| Claude Code | `~/.claude/skills` | `<workspace>/.claude/skills` |

You can add more global and project targets. Icons are included for OpenAI/Codex, Claude, Gemini, GitHub Copilot, Cursor, Perplexity, Mistral, DeepSeek, Meta AI, Hugging Face, and Ollama. Other clients use the generic icon. See [AI icon sources](media/AI_ICON_SOURCES.md) for attribution.

## Settings

| Setting | Description |
| --- | --- |
| `sponzeySkills.mainRepositoryPath` | Source repository; empty uses `~/SponzeySkills` |
| `sponzeySkills.enabledClients` | Clients included in target discovery |
| `sponzeySkills.globalTargets` | Additional global target folders |
| `sponzeySkills.projectTargetPatterns` | Workspace-relative project target paths |
| `sponzeySkills.defaultApplyMode` | Default `copy` or `symlink` mode |
| `sponzeySkills.riskPolicy` | Analysis and installation rules |
| `sponzeySkills.backupPolicy` | Backup options |
| `sponzeySkills.loggingPolicy` | Product, field-debug, and development log options |

## Troubleshooting

- **A removed skill still appears in Codex or Claude:** restart that client or start a new session to refresh its cached skill list.
- **An imported folder is missing from the list:** check that a readable `SKILL.md` is present at the folder root. A failed import is not counted as a saved skill.
- **A renamed project skill is stale:** reopen the project and use the synchronization action in Diagnostics after reviewing any modified copy.
- **A copy cannot be updated:** check its sync status. Target-side changes require confirmation before they are replaced.
- **A folder cannot be read or written:** fix its local permission and run **Sponzey Skills: Refresh Skills**.
- **A filesystem change is not shown:** the watcher may be unavailable. Run **Sponzey Skills: Refresh Skills** manually.

## Development

Requires VS Code 1.95 or later and Node.js 22 or later.

```sh
npm test
npm run build
npm run release:gate
```

Run `scripts/run-vscode-extension-host.sh` to open an Extension Development Host. The [Release VSIX workflow](.github/workflows/release-vsix.yml) checks tagged builds, publishes the extension to the Marketplace, and adds the VSIX to a GitHub Release.

Bug reports and contributions are welcome in the [GitHub repository](https://github.com/sponzey-lab/Skills-Manager) and [issue tracker](https://github.com/sponzey-lab/Skills-Manager/issues).

## License

Sponzey Skills Manager is available under [GPL-2.0-only](LICENSE).
