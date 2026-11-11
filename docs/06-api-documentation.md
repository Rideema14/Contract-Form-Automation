# 06. API Documentation

> **All endpoints are PROPOSED and NOT IMPLEMENTED.** Base path: `/api`. JSON in/out. All routes except login require authentication. Access column: **U** = authenticated user (owner checks apply), **A** = Admin, **AP** = assigned approver.

## Auth
| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/auth/login` | Log in, receive token | Public |
| POST | `/auth/logout` | End session | U |
| GET | `/auth/me` | Current user and role | U |

## Users (Admin)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/users` | List users | A |
| POST | `/users` | Create user | A |
| GET | `/users/:id` | User detail | A |
| PATCH | `/users/:id` | Update user/role/active state | A |

## Forms
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/forms` | Contract register: search, filter, paginate | U (own) / A (all) |
| POST | `/forms` | Create form (draft) | U |
| GET | `/forms/:id` | Form detail | U owner / AP / A |
| PATCH | `/forms/:id` | Update draft or returned form | U owner |
| POST | `/forms/:id/save-draft` | Save with relaxed validation | U owner |
| POST | `/forms/:id/submit` | Full validation, start approval | U owner |
| GET | `/forms/drafts` | Current user's drafts | U |

## Vendors
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/vendors` | List/search vendors | U |
| POST | `/vendors` | Create vendor | U |
| GET | `/vendors/types?q=` | Vendor type autocomplete | U |

## Bidders and Quotations
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/forms/:id/bidders` | List bidders | U owner / AP / A |
| POST | `/forms/:id/bidders` | Add bidder | U owner |
| PATCH | `/forms/:id/bidders/:bidderId` | Update bidder | U owner |
| DELETE | `/forms/:id/bidders/:bidderId` | Remove bidder | U owner |
| POST | `/bidders/:bidderId/quotations` | Add quotation | U owner |
| PATCH | `/quotations/:id` | Update quotation | U owner |

## Evaluations
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/forms/:id/evaluations` | List evaluations | U owner / AP / A |
| PUT | `/forms/:id/evaluations` | Save technical/commercial evaluations | U owner |

## Cost Estimates
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/forms/:id/cost-estimate` | Get breakdown | U owner / AP / A |
| PUT | `/forms/:id/cost-estimate` | Save breakdown lines | U owner |
| POST | `/forms/:id/cost-estimate/excel` | Upload Excel estimate | U owner |

## Approvals
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/approvals/pending` | Forms awaiting my decision | AP |
| POST | `/approvals/:formId/approve` | Approve (comment) | AP |
| POST | `/approvals/:formId/return` | Return (comment required) | AP |
| POST | `/approvals/:formId/reject` | Reject (comment required) | AP |
| GET | `/forms/:id/approval-history` | Full history | U owner / AP / A |

## Documents
| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/forms/:id/documents` | Upload supporting document | U owner |
| GET | `/forms/:id/documents` | List documents (metadata) | Authorized |
| GET | `/documents/:id/download` | Stream file via backend | Authorized |
| DELETE | `/documents/:id` | Remove document (rules per CL-14) | U owner (draft) / A |

## PDF
| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/forms/:id/pdf` | Generate PDF and store in Drive | Authorized |
| GET | `/forms/:id/pdf` | Download latest PDF | Authorized |

## Dashboard
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/dashboard/summary` | Counts: total, draft, pending, approved, rejected/returned | U (own) / A (all) |

## Notifications
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/notifications` | My notifications | U |
| PATCH | `/notifications/:id/read` | Mark read | U |

## Audit (Admin)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/audit-logs` | Filterable audit log | A |
| GET | `/forms/:id/audit-logs` | Audit for one form | Owner / A |

## Admin / Reference Data
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET/POST/PATCH | `/admin/departments` | Manage departments | A |
| GET/POST/PATCH | `/admin/contract-categories` | Manage categories | A |
| GET/POST/PATCH | `/admin/vendor-types` | Manage vendor types | A |
| GET/PUT | `/admin/approval-chain` | Configure approver sequence (pending CL-03/CL-04) | A |

## Conventions (proposed)
- Errors: `{ "error": { "code": "...", "message": "...", "details": [] } }`
- Status codes: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 invalid state transition.
- Pagination: `?page=1&pageSize=20`; register filters: `status`, `department`, `category`, `vendor`, `q`, `from`, `to`.
