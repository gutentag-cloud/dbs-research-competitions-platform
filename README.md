# DBS Research & Competitions Platform

The original school-branded interface and application workflows are retained. The current update adds account and document-access controls to the **browser prototype**; it does not turn GitHub Pages into a secure multi-user service.

## Sign in

Open the published site or run `Open Platform.command` locally.

The initial prototype administrator is:

- Username: `Mr. XXX`
- Default password: `Mr. XXX`

Existing accounts use their full displayed name as the username and default password, including spaces and punctuation (for example `Mr. Cho Ka Wai`). A new password of at least 12 characters is required on first sign-in. New committee-created accounts follow the same convention. The account's assigned roles determine its starting workspace; visitors cannot click a person or self-select an unassigned role.

Under **My account**, change the password. Under committee **Accounts**, create accounts, assign roles, select partner projects, suspend access or reset another account's password to its username. A reset requires another password change. Password changes use salted PBKDF2-SHA256 hashes (120,000 iterations), rather than storing the new password as plaintext. Credentials and data live in that browser's localStorage. Changing account permissions clears that user's prior document grants and invalidates its local session. Tabs receive account/session changes through storage events.

Default passwords are for demonstrating this prototype only. They are public, predictable credentials and must not be used for a real partner rollout.

## Content cleanup

Disney and **PwC Dark Lab** appear as partner R&D projects on the committee dashboard and register. Unrelated seeded projects, fictional recruitment postings, sample mail, progress logs, approvals and fabricated files are removed on migration and reset. Placeholder competition quotas are cleared; the actual competition catalogue from the proposal remains. User-created projects and uploaded files are retained. The old seed examples remain in source history/code for migration identification but no longer appear in the interface.

The partner projects begin as drafts, without invented approvals or results. Their existing scope descriptions need confirmation with the teams before being treated as an agreed brief.

Sign-ins no longer generate activity entries. Legacy sign-in entries are filtered from committee Recent activity.

## Partner document access

Create an **External partner** account and assign it to the appropriate project. Partner accounts cannot also carry internal roles.

Upload a document on the project page. The committee uses its **Partner access** controls to select approved recipients. Partners see only selected files in their assigned projects. Student experience/CV evidence cannot be shared. Clearing recipients revokes future access; downloaded copies cannot be recalled. Suspended accounts cannot sign in. Internal project pages are unavailable to partner roles.

These are prototype behaviour controls, not a security boundary. Browser data can be inspected or modified, and documents/accounts are not synchronised between different devices. **Do not put confidential R&D files into this public prototype.**

For real Disney/PwC use, retain this UI while moving accounts and workflows to a server: school SSO or invitation-based verified accounts, server-enforced project/document permissions, private file storage, shared database, HTTPS sessions and an agreed retention/backup policy. The GitHub Pages frontend alone cannot provide these. Soft launch requires backend hosting, verified partner contacts and approved documents before invitations are sent.

## Existing workflows

The original application wizard, teacher endorsement, committee review, mentor matching, project logs, attachments, quotas, register, CSV export, deadlines and calendar remain available. Notifications in Mail simulate email delivery.

## Verification

```sh
node tests/accounts.cjs
node --check app.js
node --check store.js
node --check data.js
```

The account checks cover clean seed data, failed login, removal of role-picker impersonation, mandatory default-password change, role assignment, account suspension, document approval and revocation, cross-partner separation, CV evidence restrictions and reload persistence.

`docs/` is the GitHub Pages publishing directory. Root and published frontend files are kept identical. Asset version queries prevent browsers combining old and updated scripts.
