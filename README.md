# DBS R&D partner pilot

A focused pilot for **Disney** and **PwC Dark Lab**. Replaces the role-picker demo and fabricated competition entries. Existing prototype history is retained in Git, but its seeded people, documents, progress and approvals are not migrated into the pilot.

## What is ready

- Two workspaces, with no fictional participants, documents or progress.
- Invitation-only accounts: committee, project team, external partner. Roles are assigned at invitation time; participants cannot choose or change their role.
- Committee account management: workspace assignment, suspension and session revocation. Saving account access also clears prior document grants, requiring a fresh sharing decision.
- Internal uploads, committee approval and sharing with **specific named partner accounts**. The server checks both workspace membership and document grants for every listing and download. Revoke access by clearing recipients or suspending the account; downloaded copies cannot be recalled.
- Internal team updates and committee-published partner updates.
- Persistent pilot feedback, ratings and review status.
- Recent activity records project actions, access changes and feedback; sign-ins are excluded.

## Local launch

Requires Python 3.10 or later; no packages required.

```sh
python3 server.py --create-admin
python3 server.py
```

Create the first committee account using the interactive prompt, then open `http://localhost:4180`. Passwords are entered without terminal echo. Default development origin is exactly `http://localhost:4180`; use that hostname, not `127.0.0.1`.

Passwords use salted PBKDF2-SHA256 (600,000 iterations). Sessions use random tokens stored as hashes, HttpOnly cookies, eight-hour expiry, origin and CSRF checks. HTTPS deployments add Secure cookies. Accounts and files live in `.pilot-data/`, which is ignored by Git and cannot be served as static files. Do not upload private documents into `docs/`, the repository or GitHub Pages.

An administrator can reset a password interactively:

```sh
python3 server.py --reset-password
```

This revokes the account's existing sessions. Invitation acceptance uses an exact email match and a one-time seven-day link. Send invitations directly to the named recipients through an agreed private channel. The app does not send emails automatically. There is no public registration or demo impersonation.

## Deployment

**GitHub Pages is the public, read-only preview.** It cannot run the authentication/database/file server. No account actions or feedback submission are enabled in that preview. The live pilot must serve this same interface and API together on an HTTPS host, not put private data in GitHub Pages or localStorage.

The supplied Dockerfile and `render.yaml` prepare deployment on Render with a persistent disk. Provisioning hosting and its paid disk requires the hosting account owner. Set `PILOT_ORIGIN` to the exact deployment URL, e.g. `https://your-pilot.onrender.com` (no trailing slash). The server uses the host's `PORT`. Set `PILOT_DATA_DIR` to the mounted private storage path. Run `python server.py --create-admin` through the deployment's private shell to bootstrap the committee account. No default passwords or real invitations are included.

The disk and SQLite are suitable for a small, single-instance pilot. Keep one instance, back up the entire private data directory together (database and files), and test restore before storing important work. For broader rollout, add managed identity/SSO, email verification/delivery, organisation-approved retention and backups, and a managed database/object store. Partners should only receive documents the project owner has approved for sharing.

## Soft-launch checklist

1. Deploy the secure server and create the committee account.
2. Confirm the Disney and PwC Dark Lab project briefs with the teams. Current titles are workspace labels based on the prior project context, not confirmed milestones or approvals.
3. Invite one DBS project lead and one named contact from each partner. Assign each partner only its own workspace.
4. Upload one approved brief per workspace, then use **Manage access** to share it with that partner.
5. Ask participants to sign in, open the brief, read an update and submit feedback using the form. Suggested prompt: “Please try the workspace and tell us what was confusing, what was useful, and what would make it easier to collaborate.”
6. Review feedback before inviting more people. Invitations have not been sent: real contact emails and the hosting deployment are still required.

## Verification

```sh
python3 -m unittest discover -s tests -v
node --check app.js
```

Integration checks cover invitation email matching and replay rejection, login/logout, CSRF/origin rejection, unauthenticated access, partner separation, private document listing/download, approval/revocation, forced internal team updates, feedback, account suspension, excluded sign-ins and blocked private static paths.

`docs/` is the GitHub Pages publish directory. Keep `index.html`, `app.js`, `styles.css` and `assets/` in sync with the root interface. Legacy localStorage is left untouched but is no longer read or displayed.
