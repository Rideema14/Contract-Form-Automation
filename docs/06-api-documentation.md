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
| PATCH | `/users/:id` | Update user/role/active state | A |
| GET | `/users/approvers` | List active approver accounts | U |

## Forms
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/forms` | Contract register: search, filter, paginate | U (own) / A (all) |
| POST | `/forms` | Create form (draft) | U |
| GET | `/forms/:id` | Form detail | U owner / AP / A |
| PATCH | `/forms/:id` | Update draft or returned form | U owner / A |
| POST | `/forms/:id/save-draft` | Save with relaxed validation | U owner / A |
| DELETE | `/forms/:id` | Delete a draft form | U owner / A |
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
| POST | `/forms/:id/bidders` | Add bidder | U owner / A |
| PATCH | `/forms/:id/bidders/:bidderId` | Update bidder | U owner / A |
| DELETE | `/forms/:id/bidders/:bidderId` | Remove bidder | U owner / A |
| POST | `/bidders/:bidderId/quotations` | Add quotation | U owner / A |
| PATCH | `/quotations/:id` | Update quotation | U owner / A |

## Evaluations
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/forms/:id/evaluations` | List evaluations | U owner / AP / A |
| PUT | `/forms/:id/evaluations` | Save technical/commercial evaluations | U owner / A |

## Cost Estimates
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/forms/:id/cost-estimate` | Get breakdown | U owner / AP / A |
| PUT | `/forms/:id/cost-estimate` | Save breakdown lines | U owner / A |
| POST | `/forms/:id/cost-estimate/excel` | Upload Excel estimate | U owner / A |
| GET | `/forms/cost-estimate/template` | Download the standard `.xlsx` cost template | U |
| POST | `/forms/:formId/cost-lines/import` | Validate and append cost rows from the standard template | U owner / A |

The import template requires `Description`, `Quantity` and `Unit Cost` columns. Amounts are
calculated by the server; imported rows append to existing rows. Imports accept `.xlsx` files up
to 5 MiB and 500 non-empty rows. Invalid files are rejected without creating any rows.

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
| POST | `/forms/:id/documents` | Upload supporting document | U owner / A |
| GET | `/forms/:id/documents` | List documents (metadata) | Authorized |
| GET | `/documents/:id/download` | Stream file via backend | Authorized |
| DELETE | `/forms/:formId/attachments/:attachmentId` | Remove an attachment; deletion is audited | U owner (draft/returned) / A |

## PDF
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/forms/:formId/pdf` | Download a PDF snapshot of the current saved contract; not stored | Contract creator, assigned approver, or Admin |
| POST | `/forms/:formId/final-pdf/generate` | Generate or retrieve the approved final PDF and return attachment metadata | Contract creator, assigned approver, or Admin |
| POST | `/forms/:formId/final-pdf` | Download a ZIP containing the final PDF and supporting files | Assigned approver or Admin |

The final-PDF generation endpoint is available only for approved contracts. The
returned attachment can be downloaded through the authorized attachment download
endpoint.

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
| GET | `/admin/audit?page=&pageSize=&q=` | Search and paginate recorded audit history | A |

## Admin / Reference Data
| Method | Endpoint | Description | Access |
|---|---|---|---|
| GET | `/reference-data` | List reference values | U |
| POST | `/reference-data/:category` | Create departments, categories, vendors, vendor types, and currencies | A |
| PATCH/DELETE | `/reference-data/:category/:id` | Update or remove reference values | A |
| GET | `/form-builder/draft` | Get draft form schema | A |
| PUT | `/form-builder/draft` | Save draft form schema | A |
| POST | `/form-builder/publish` | Publish form schema | A |

## Conventions (proposed)
- Errors: `{ "error": { "code": "...", "message": "...", "details": [] } }`
- Status codes: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 invalid state transition.
- Pagination: `?page=1&pageSize=20`; register filters: `status`, `department`, `category`, `vendor`, `q`, `from`, `to`.
