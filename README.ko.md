<p align="center">
  <img src="media/sponzey-skills-icon.png" width="112" alt="Sponzey Skills Manager 아이콘">
</p>

<h1 align="center">Sponzey Skills Manager</h1>

<p align="center">VS Code에서 AI 클라이언트와 프로젝트의 Agent Skill을 관리합니다.</p>

<p align="center">
  <a href="README.md">English</a> · <strong>한국어</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=Sponzey.sponzey-skills-manager"><img src="https://img.shields.io/visual-studio-marketplace/v/Sponzey.sponzey-skills-manager?style=flat-square&label=VS%20Code%20Marketplace" alt="VS Code Marketplace 버전"></a>
  <a href="https://github.com/sponzey-lab/Skills-Manager"><img src="https://img.shields.io/github/stars/sponzey-lab/Skills-Manager?style=flat-square" alt="GitHub stars"></a>
  <img src="https://img.shields.io/badge/license-GPL--2.0-6e7781?style=flat-square" alt="GPL-2.0 라이선스">
</p>

스킬 파일을 Codex, Claude Code, 프로젝트마다 따로 복사하다 보면 어떤 것이 원본인지 헷갈리기 쉽습니다. 이 확장은 원본을 한 저장소에 모으고, 각 스킬이 어디에 설치되어 있는지 보여줍니다.

## 주요 기능

- 새 스킬을 만들거나 로컬 폴더, GitHub URL, Sponzey 아카이브에서 가져옵니다.
- 전역 또는 현재 프로젝트에 스킬을 복사하거나 심볼릭 링크로 설치합니다.
- 여러 AI 클라이언트에 설치된 같은 전역 스킬을 한 줄에서 관리합니다.
- 복사본의 변경 여부, 끊어진 링크, 외부에서 만든 스킬을 구분합니다.
- 원본 폴더, `SKILL.md`의 이름, 관리 중인 설치본의 이름을 함께 변경합니다.
- 스킬의 구조 오류, 충돌, 호환성 문제, 보안 위험을 검사합니다.
- 스킬을 복사, 이동, 백업, 비교, 복원하거나 백업을 원본으로 전환합니다.

## 저장소와 설치 대상

| 화면 | 내용 |
| --- | --- |
| **Main Repository** | 직접 관리하고 편집하는 원본 스킬 |
| **Global Skills** | 설정된 AI 클라이언트에 전역으로 설치된 스킬 |
| **Project Skills** | 현재 작업 공간에 설치된 스킬 |
| **Diagnostics** | 유효성, 동기화, 호환성, 위험 검사 결과 |

**Main Repository에는 원본 스킬만 저장합니다.** Main Repository는 원본 저장소이며 Global Target이 아닙니다. 대상에 스킬을 설치하거나 제거해도 원본은 바뀌거나 삭제되지 않습니다.

```text
Main Repository
└── code-reviewer                  원본
    ├── SKILL.md
    ├── references/
    └── scripts/
          │
          ├── Codex 전역           복사 또는 심볼릭 링크
          ├── Claude 전역          복사 또는 심볼릭 링크
          └── 현재 프로젝트        복사 또는 심볼릭 링크
```

## 0.2.x 주요 변경 사항

- Global Skills에서 같은 스킬을 한 줄로 묶고, 설치된 AI 클라이언트를 아이콘으로 표시합니다.
- 관리 중인 전역 스킬은 나중에 등록된 호환 대상에도 자동으로 설치할 수 있습니다.
- Main Repository, Global Skills, Project Skills의 목록을 같은 방식으로 정렬했습니다.
- 루트 `SKILL.md`를 읽을 수 있고 저장한 스킬을 다시 찾을 수 있을 때만 가져오기를 성공으로 처리합니다. 실패하면 이유를 표시하고, 가능한 경우 남은 파일을 정리합니다.
- **Rename Source Skill**은 폴더, `SKILL.md` 최상위 `name:`, 저장소 정보, 접근 가능한 관리 설치본을 함께 변경합니다. 사용자가 수정한 복사본은 먼저 확인하며 다른 내용은 유지합니다.
- Diagnostics에서 확인된 문제와 의심 항목을 구분하고, 분석하지 못한 범위와 오래된 관리 설치본을 표시합니다.
- 파일 작업이 실패하면 가능한 범위에서 이전 상태로 되돌립니다. 복구가 끝나지 않았으면 성공으로 처리하지 않고 현재 상태를 알립니다.

## 사용 방법

### 스킬 추가

기본 파일로 새 스킬을 만들거나 로컬 폴더, 저장소 URL, 아카이브에서 가져올 수 있습니다. 선택한 폴더의 루트에는 읽을 수 있는 일반 파일 `SKILL.md`가 있어야 합니다.

GitHub 저장소나 하위 폴더에 스킬이 여러 개 있으면 함께 찾을 수 있습니다. Main Repository 안에 잘못된 폴더가 이미 있다면 원본 목록에서는 제외하고 Diagnostics에 표시합니다.

### 스킬 설치

설치본을 따로 관리하려면 **Copy**, 원본 변경을 바로 반영하려면 **Symlink**를 사용합니다.

전역 등록은 설정된 호환 클라이언트에 함께 적용되며, 이후 추가한 대상도 포함할 수 있습니다. 프로젝트 대상은 작업 공간마다 따로 관리합니다.

Critical 진단이 있으면 설치를 차단하고, High 위험은 설치 전에 확인합니다. 관리되지 않은 대상은 확인 없이 덮어쓰지 않습니다.

### 이름 변경과 동기화

관리 중인 복사본은 원본, 대상 또는 양쪽이 바뀌었는지 보여줍니다. 원본 내용으로 복사본을 갱신하거나 Copy와 Symlink 방식을 바꿀 수 있습니다.

이름 변경 내역은 고정된 원본 ID로 추적합니다. 이름을 바꿀 때 닫혀 있던 프로젝트는 다시 연 뒤 Diagnostics에 표시된 동기화 작업을 실행하면 됩니다. 사용자가 수정한 복사본은 확인하기 전까지 변경하지 않습니다.

### 설치된 스킬 백업

- **Copy to Main Repository**는 설치본을 유지하고 원본을 만듭니다.
- **Backup to Main Repository**는 설치본을 바꾸지 않고 스냅샷을 저장합니다.
- **Move to Main Repository**는 새 원본을 확인한 뒤 기존 설치본을 제거하거나 교체합니다.
- 백업은 비교, 복원, 원본 전환, 삭제가 가능합니다.

## Diagnostics와 개인정보 보호

분석은 로컬에서 실행됩니다. 스킬 스크립트를 실행하거나 심볼릭 링크를 따라가지 않으며 네트워크에도 접속하지 않습니다. 정해진 파일 수, 깊이, 크기 안에서 스킬 정보와 관련 텍스트 파일을 검사합니다.

의심 항목 하나만으로 Critical 등급을 매기지 않습니다. 확인된 Critical 진단은 설치를 차단하며, 확인이 어렵거나 분석하지 못한 내용은 검토할 수 있도록 남겨 둡니다.

Diagnostics에는 상대 파일 위치와 짧은 설명을 표시합니다. Product Log에는 작업 결과만 기록합니다. Field Debug Log는 지원 과정에서 사용자가 켠 경우에만 잠시 사용하고, Development Log는 로컬 개발용입니다. 일반 로그에는 스킬 본문, 인증 정보, 탐지된 원문, 사용자의 절대경로를 남기지 않습니다.

## 시작하기

1. [Sponzey Skills Manager](https://marketplace.visualstudio.com/items?itemName=Sponzey.sponzey-skills-manager)를 설치합니다.
2. Activity Bar에서 **Sponzey Skills**를 엽니다.
3. 기본 저장소 `~/SponzeySkills`를 그대로 사용하거나 **Sponzey Skills: Set Main Repository**에서 다른 폴더를 고릅니다.
4. 스킬을 새로 만들거나 가져옵니다.
5. 원본을 오른쪽 클릭해 전역 또는 현재 프로젝트에 설치합니다.
6. 처음 보는 스킬은 설치 전에 Diagnostics를 확인합니다.

기본 저장소에는 `skills/`, `backups/`, `.sponzey/` 폴더가 만들어집니다. `~/.agents/skills`나 `~/.claude/skills` 같은 설치 폴더를 Main Repository로 지정하지 마세요.

## AI 클라이언트와 대상

Codex와 Claude Code는 기본으로 활성화됩니다.

| 클라이언트 | 전역 대상 | 프로젝트 대상 |
| --- | --- | --- |
| Codex | `~/.agents/skills` | `<workspace>/.agents/skills` |
| Claude Code | `~/.claude/skills` | `<workspace>/.claude/skills` |

전역 및 프로젝트 대상을 더 등록할 수 있습니다. OpenAI/Codex, Claude, Gemini, GitHub Copilot, Cursor, Perplexity, Mistral, DeepSeek, Meta AI, Hugging Face, Ollama 아이콘을 제공하며, 그 밖의 클라이언트에는 공통 아이콘을 사용합니다. 자세한 출처는 [AI 아이콘 출처](media/AI_ICON_SOURCES.md)에 정리되어 있습니다.

## 설정

| 설정 | 설명 |
| --- | --- |
| `sponzeySkills.mainRepositoryPath` | 원본 저장소 경로. 비어 있으면 `~/SponzeySkills` 사용 |
| `sponzeySkills.enabledClients` | 대상을 찾을 때 포함할 클라이언트 |
| `sponzeySkills.globalTargets` | 추가 전역 대상 폴더 |
| `sponzeySkills.projectTargetPatterns` | 작업 공간 기준 프로젝트 대상 경로 |
| `sponzeySkills.defaultApplyMode` | 기본 `copy` 또는 `symlink` 방식 |
| `sponzeySkills.riskPolicy` | 분석 및 설치 정책 |
| `sponzeySkills.backupPolicy` | 백업 설정 |
| `sponzeySkills.loggingPolicy` | 제품·현장 디버그·개발 로그 설정 |

## 문제 해결

- **제거한 스킬이 Codex나 Claude에 계속 보임:** 해당 클라이언트를 다시 시작하거나 새 세션을 열어 저장된 스킬 목록을 갱신합니다.
- **가져온 폴더가 목록에 없음:** 폴더 루트에 읽을 수 있는 `SKILL.md`가 있는지 확인합니다. 가져오기에 실패한 폴더는 저장된 스킬로 세지 않습니다.
- **이름을 바꾼 프로젝트 스킬이 이전 이름으로 남아 있음:** 프로젝트를 다시 열고 Diagnostics에서 수정된 복사본을 확인한 뒤 동기화 작업을 실행합니다.
- **복사본을 갱신할 수 없음:** 먼저 동기화 상태를 확인합니다. 대상에서 바뀐 내용은 확인하기 전까지 교체하지 않습니다.
- **폴더를 읽거나 쓸 수 없음:** 로컬 파일 권한(permission)을 고친 뒤 **Sponzey Skills: Refresh Skills**를 실행합니다.
- **파일 변경이 목록에 나타나지 않음:** 파일 감시기(watcher)를 사용할 수 없는 환경일 수 있습니다. **Sponzey Skills: Refresh Skills**를 직접 실행합니다.

## 개발

VS Code 1.95 이상과 Node.js 22 이상이 필요합니다.

```sh
npm test
npm run build
npm run release:gate
```

`scripts/run-vscode-extension-host.sh`를 실행하면 Extension Development Host가 열립니다. [Release VSIX 워크플로](.github/workflows/release-vsix.yml)는 태그 빌드를 검사하고 Marketplace에 확장을 배포한 뒤 VSIX를 GitHub Release에 추가합니다.

버그 제보와 기여는 [GitHub 저장소](https://github.com/sponzey-lab/Skills-Manager) 또는 [이슈 트래커](https://github.com/sponzey-lab/Skills-Manager/issues)에서 받습니다.

## 라이선스

Sponzey Skills Manager는 [GPL-2.0-only](LICENSE)로 배포됩니다.
