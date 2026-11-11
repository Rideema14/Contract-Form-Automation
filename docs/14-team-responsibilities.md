# 14. Team Responsibilities

## Ownership
| Developer | Owns |
|---|---|
| **Developer 1** | Authentication, User/Admin RBAC, dashboard, admin management |
| **Developer 2** | Contract forms, drafts, vendors, bidders, evaluations, cost estimates |
| **Developer 3** | Approval workflow, audit history, Google Drive integration, PDF generation |

## Detailed Modules
| Dev | Backend modules | Frontend areas |
|---|---|---|
| 1 | `auth`, `users`, `dashboard`, `admin`, middleware (auth, RBAC) | `login`, `dashboard`, `admin`, `components/layout`, `components/dashboard` |
| 2 | `forms`, `vendors`, `bidders`, `evaluations`, `cost-estimates` | `forms`, `drafts`, `components/forms`, `schemas` |
| 3 | `approvals`, `audit`, `notifications`, `documents`, `pdf` | `approvals`, `documents`, `components/approvals`, `components/documents` |

## Shared Responsibilities
- Prisma schema: one owner per model group; all schema changes go through pull request and are announced to the team.
- Shared utilities (`utils`, `config`, `middleware/validation`): changes need review from another developer.
- API contracts: agree request/response shape before implementing; update `06-api-documentation.md`.
- Integration: each developer integrates daily into `develop` (see [16-git-workflow.md](16-git-workflow.md)).
- Testing: each owner writes tests for their module; the team runs the full checklist before each phase sign-off.
- Documentation: keep docs updated with the code.
- Code review: every PR is reviewed by at least one other developer.

## Cross-Dependencies
- Dev 2 forms need Dev 1's auth/RBAC middleware (agree on `req.user` shape early).
- Dev 3 approvals need Dev 2's form status model.
- Dev 3 documents integrate with Dev 2's Excel upload and form pages.
- Dev 1 dashboard counts depend on Dev 2 form statuses and Dev 3 approvals.
