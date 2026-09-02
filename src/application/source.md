# Application source index

The application layer composes domain policies through injected ports and returns explicit read models or closed operation results. It does not construct filesystem, VSCode, or settings adapters.

| Path | Responsibility | Boundary / Side effects |
| --- | --- | --- |
| `apply/` | Apply a source skill to one validated target. | Calls analysis and target-store ports. |
| `analysis/` | Analyze normalized, bounded source artifacts and repository skills with versioned confirmed and potential findings. | Calls analysis and persistence ports; emits only sanitized relative evidence, keeps isolated script signals non-blocking, requires correlation before high-risk confirmation, records acknowledgements only after domain validation, and detects executable unsafe recursive permission changes. |
| `analysis/analysis-batch-state-machine.js` | Define analysis batch lifecycle transitions. | Pure application state machine for completed, partial, failed, and cancelled analysis. |
| `config/` | Build validated runtime context values. | Converts startup settings at the application boundary. |
| `confirmation/` | Build confirmation diagnostics and inputs. | Pure application result helpers. |
| `diagnostics/` | Model diagnostic remediation transitions. | Pure state-machine logic. |
| `global/` | Migrate and reconcile persistent Global enrollment intent. | Calls injected repository, target, enrollment, and apply ports. |
| `logging/` | Route product and field-debug events. | Calls injected logger ports. |
| `refresh/` | Scan sources and targets and build skills read models. | Calls repository, target, hash, and metadata ports; reports an exact stable-id managed placement whose name differs from its source after a reopened project is scanned, including a broken symlink only when its raw destination matches a stored source-path alias. |
| `repository/` | Manage configured skill repositories. | Calls configuration, repository, and refresh ports. |
| `skill/` | Operate on sources and applied skills, including authoritative source-delete cleanup/source-only flows. | Calls injected repository, target, enrollment, index, hash, and analysis ports; rename preserves stable source identity, requires confirmation for modified managed copies, coordinates exact current placements, and compensates target/source/index writes on failure. A separate confirmed synchronization revalidates one stable-id managed copy before updating its name and metadata. |
| `source/` | Create and import source skills. | Calls injected repository and analysis ports; maps manifest verification and incomplete-source recovery failures to explicit terminal results before analysis. |
| `transfer/` | Copy, move, back up, restore, and promote skills. | Calls injected repository, target, audit, and comparison ports. |
| `watch/` | Debounce refresh invalidations. | Calls injected refresh callback. |
| `index.js` | Export public application use cases. | Public module boundary only. |
