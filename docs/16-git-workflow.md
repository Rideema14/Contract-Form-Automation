# 16. Git Workflow

## Branches
| Branch | Purpose |
|---|---|
| `main` | Stable, deployable. Protected; changes only via PR from `develop` at milestones. |
| `develop` | Integration branch. All feature PRs target this. |
| `feature/<dev>-<module>-<short-desc>` | e.g. `feature/dev2-forms-draft-saving` |
| `fix/<short-desc>` | Bug fixes |
| `docs/<short-desc>` | Documentation changes |

## Daily Routine
1. `git checkout develop` then `git pull`
2. `git checkout -b feature/dev1-auth-login`
3. Commit small, logical changes
4. Regularly `git fetch` then `git rebase origin/develop` (or merge, team to agree)
5. Push and open a PR to `develop`

## Commit Messages
Format: `type(scope): short summary`
Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
Example: `feat(forms): add draft save endpoint`

## Pull Requests
- Small and focused; describe what, why and how to test
- At least one reviewer from another developer
- Must run locally and pass tests before merge
- Update docs when behavior or API changes
- Squash-merge into `develop`; delete the branch after merge

## Integrating Into `main`
At the end of each phase (or agreed milestone): all tests pass, a PR `develop` to `main` is reviewed by all three, then tagged (e.g. `phase-1-complete`).

## Avoiding Merge Conflicts
- Work within your owned modules (see [14-team-responsibilities.md](14-team-responsibilities.md)).
- Prisma `schema.prisma`: announce changes first, keep PRs small, merge quickly; never edit applied migrations; one person resolves migration ordering conflicts.
- Avoid reformatting unrelated files. Agree on one formatter config.
- Do not commit `.env`, `node_modules` or generated files.
- Shared files (`app.js`, route index): add lines only, keep PRs short-lived.
- Integrate at least daily; long-lived branches are discouraged.

## Independence
Each developer works against mocked or stubbed interfaces (for example, a fake `req.user` or storage adapter) until the dependency is merged.
