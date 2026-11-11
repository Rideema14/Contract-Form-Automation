# 13. Testing Strategy

## Levels
- **Unit**: services, validators, utilities.
- **API/Integration**: Express routes against a test PostgreSQL database.
- **Manual/UAT**: end-to-end flows in the browser using the checklist below.
Test tooling is to be agreed by the team (no extra dependencies until then).

## Checklist

### Authentication
- [ ] Valid login succeeds; invalid password/unknown email fails with generic message
- [ ] Inactive user cannot log in
- [ ] Expired/invalid token returns 401
- [ ] Logout invalidates client session

### Permissions (RBAC)
- [ ] User cannot access Admin endpoints (403)
- [ ] User cannot read or edit another user's form
- [ ] Approver can act only on the current pending step
- [ ] Admin can manage users and view all forms
- [ ] Direct API calls without UI are still blocked

### Forms and Drafts
- [ ] Create form; save draft with missing required fields
- [ ] Resume draft; data persists exactly
- [ ] Edit allowed only in Draft/Returned status
- [ ] Submitted form is locked for the creator

### Validation
- [ ] Client and server both reject invalid input
- [ ] Required fields enforced at submit, not at draft
- [ ] Negative/invalid amounts, bad currency, oversized text rejected
- [ ] Vendor type autocomplete returns matches

### Bidders, Evaluations, Estimates
- [ ] Add/remove multiple bidders and quotations
- [ ] Evaluations save and reload per bidder
- [ ] Cost breakdown totals compute correctly
- [ ] Excel upload: valid file accepted; wrong type/size rejected

### Approvals
- [ ] Submit notifies first approver
- [ ] Approve advances to next level; final approval sets APPROVED
- [ ] Return/Reject require comment
- [ ] Out-of-order and duplicate actions return 409
- [ ] History records actor, action, comment, timestamp
- [ ] Concurrent decisions: only one succeeds

### File Uploads and Drive
- [ ] Upload stores file in Drive and metadata in PostgreSQL
- [ ] Failed upload leaves no metadata row
- [ ] Unauthorized user cannot download
- [ ] Authorized download returns the correct file

### PDF Generation
- [ ] All 14 sections render with real data
- [ ] Empty optional sections handled
- [ ] Long text and many bidders paginate correctly
- [ ] PDF stored in Drive and linked to the form
- [ ] Layout matches company sample (after CL-01)

### Dashboard and Register
- [ ] Counts match database for each status
- [ ] User sees own counts; Admin sees all
- [ ] Search and each filter work, alone and combined
- [ ] Pagination correct

### Notifications and Audit
- [ ] Next approver receives notification
- [ ] Audit entries exist for each significant action

### Deployment
- [ ] Migrations apply cleanly on Azure database
- [ ] Environment variables load; no secrets in repo
- [ ] Smoke test passes on deployed environment
- [ ] CORS and HTTPS configured; budget alert active
