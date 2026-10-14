Live backend workspace: [DBS Research & Competitions](https://dbs-research-project-workspace.cosmictern2.chatgpt.site/). GitHub Pages now redirects there. Existing pilot accounts and all ten original Disney documents have been migrated to persistent hosted storage.

# DBS Research & Competitions Platform

The original school-branded UI remains. There are now two modes:

- **GitHub Pages:** high-level project summaries. Browser account controls demonstrate the workflow; they cannot hide material included in the public source.
- **Private backend:** the same UI served by `server.cjs`, with shared SQLite state, server-checked accounts/project membership and private file downloads. The local server binds to localhost by default. This is prepared for a later VPS move; it has not been deployed on a VPS.

## Private local workspace

Requires Node 24+. No npm installation is needed.

```sh
node server.cjs
```

Open `http://localhost:4183` (use that exact hostname). Initial administrator: **Mr. XXX / Mr. XXX**. On first login, choose **Save password** or **Continue with default password**. Continuing preserves the username-as-password default and does not relax project membership checks. Each original named account initially uses its full displayed name as username and password, including spaces. New committee-created accounts follow the same convention. Account owners can change passwords later under My account.

Under **Accounts**, committee members create or suspend accounts, assign internal/partner roles and reset passwords. Under a project's **Project participants**, the committee selects the students taking part. Student accounts start in the student role and cannot switch into committee roles. Jaden Wong and Trevor Chak are the confirmed Disney participants. They share one Disney project with four phases; they have no access to the PwC project unless the committee explicitly adds them there.

The server filters project data before sending it to the browser and checks membership again on each file download or mutation. It uses salted PBKDF2 password hashes, eight-hour HttpOnly sessions, origin and CSRF checks, login rate limiting, and Secure cookies when configured with an HTTPS origin. Account suspension, password reset and membership changes affect subsequent requests. Files are stored under hashed filenames outside the static-file whitelist. Credential fields are not returned in the client state. Sign-ins do not appear in recent activity.

## Disney source content

Four phases of one Disney project were derived from the supplied Software folder:

1. Railway LiDAR intrusion detection — `RPi5/README.md`.
2. Railway camera detection — `Camera Detection/README.md`.
3. Railway sensor and gauge integration — `RPi5/SYSTEM_CONSOLE.md` and supporting notes.
4. Railway system console and evidence — `RPi5/SYSTEM_CONSOLE.md` and hardware preparation notes.

The Disney project is active, reflecting confirmation that the project is already underway. No approvals, field trials or completed results have been invented. The source's outstanding validation requirements remain explicit. The eight synthetic trial files have been removed. The nine original documents remain in private storage, grouped by phase.

The private local import contains **nine original documents**: the two subsystem READMEs, replay CSV, clearance-envelope and maintenance-vehicle PDFs, D6 protocol notes, gauge-mount defaults, system-console notes and pre-hardware notes. No configuration, environment secrets, model files, photographs or full source tree were copied. Originals remain in `.private-pilot/` and are excluded from Git and GitHub Pages. The source folder was read only and was not modified.

To refresh the selected private documents, stop the server and run:

```sh
node scripts/import-disney.cjs '/absolute/path/to/Software'
node server.cjs
```

The importer uses a fixed document allowlist and updates existing records without creating duplicates. It keeps existing partner-recipient choices. Source summaries and original files are local snapshots, not a live sync.

## Partner documents

Create an External partner account and assign a project. Use **Partner access** on the project files to approve named recipients. New imports are internal-only. Student experience/CV evidence cannot be shared. Unchecking recipients revokes future access; previously downloaded copies cannot be recalled. Partner accounts cannot upload or view internal project logs and personal details.

## VPS migration later

The backend and Dockerfile are included; no hosted service was provisioned.

1. Transfer the application and the private data directory separately over an authenticated channel. Keep one server instance; stop it before copying the SQLite database and its WAL files, or use an SQLite backup.
2. Use Node 24+ or the Dockerfile. Persist `PILOT_DATA_DIR` outside the public web root. Back up database and files together, and verify restore.
3. Put the service behind an HTTPS reverse proxy. Set `PILOT_ORIGIN` to the exact HTTPS site URL; it controls origin checks and Secure cookies. Set `PORT` as needed. Keep the node listener on localhost, or set `HOST=0.0.0.0` only inside a properly isolated container/network.
4. Configure account credentials and verify the participant roster privately before exposing the service. Add verified invitation delivery/identity and agree retention/partner sharing before wider rollout.
5. Serve the UI and API from the same origin. The UI detects `/api/session` automatically; no secrets are needed in client code.

The backend serialises requests and stores the existing workflow model in SQLite. It is for a small pilot; managed identity, finer operational monitoring and a more scalable data model are later rollout work.

## Tests

```sh
node tests/accounts.cjs
node tests/private-server.cjs
node --check app.js
node --check store.js
node --check data.js
node --check server.cjs
```

Tests cover login/default-password change, assigned roles, account suspension, partner grants, evidence restrictions, reload persistence, server-side participant filtering, denied direct downloads and writes, membership revocation, CSRF/origin checks, session logout and private-path isolation. The HTTP tests use temporary data and delete it afterward.

Existing applications, endorsement, review, mentor matching, progress logs, uploads, quotas, register, calendar and CSV workflows retain their UI. Mail simulates email delivery. Source and published files in `docs/` are kept in sync. Asset versions prevent old scripts mixing with updated pages.

## Workspaces and shared links

**Workspaces** opens one dedicated project workspace per visible project, including Disney (one project with four phases) and PwC Dark Lab. Each project page has a **Workspace links** panel. Disney uses the existing private `gutentag-cloud/Disney-Railway-Tracker` repository; PwC uses the existing private `gutentag-cloud/DBS-Robotics-R-D-x-PwC-Domain-Project` repository. These links do not change repository permissions.

Participants, assigned teachers/mentors and committee staff can edit the GitHub and Google Drive fields. Only HTTPS links on github.com, drive.google.com or docs.google.com are accepted. Partners cannot edit them. No Google Drive folder was invented or created; the field is ready for the team's real link.

The first-login password choice is optional in both public prototype and private-server mode. Tests check retaining the default password across login, participant-only access after that choice, link persistence, invalid-link rejection and rejected edits to unrelated projects.

## Disney partner workspace access

The pilot Disney account uses username `Disney` and default password `Disney`. It has full access to the Disney project and all four phases: project details, team, deadlines, progress logs and every project document, including experience evidence. It cannot access PwC or change accounts, participants, links. It can add and edit progress logs, add feedback, upload project files and set or remove task deadlines. Log edits preserve the original author and revision history. Other partner accounts continue to receive only selected documents unless the committee enables full workspace access under Accounts. Full access is always limited to the selected projects; removing a project or suspending the account revokes access. Google Drive/GitHub permissions remain separate. Public Pages is a browser prototype; server-enforced protection and original files require the private backend.

Isaac and Fergus Tam are assigned to the Disney project and all four phases. Fergus Tam has a mentor account with default username and password `Fergus Tam`. No teacher endorsement, committee decision or completed result is inferred from that confirmation.

## Disney test report in the progress log

The supplied `Railway_Intrusion_Detector_Test_Report_4Aug.docx` is attached to the Disney Phase 1 progress-log entry dated 13 October (the upload date, not the visit date). The original is stored only in private storage and requires authenticated project access. GitHub Pages shows a reference after prototype login and cannot download the original. The public download and current published copy have been removed; earlier Git commits or downloaded copies may still contain the previously published file.

## Project invitations, logs and overviews

Team formation uses invitations in the platform's Mail and Workspaces views. Accepting adds the invited student; declining leaves project access unchanged. Invitations use existing active student accounts and do not send external email. Existing confirmed teams are retained.

Students see submitted progress logs only. They may edit their own logs while both the posting date and log date are today in Hong Kong, for up to five hours after posting. The backend enforces the time limit; mentors and authorized project partners retain collaborative log editing. Partners do not see the eight-step accountability checklist.

Workspaces can be filtered to current/past projects and sorted by creation date, name or latest activity. Past projects remain accessible to their assigned participants. Project overviews include recorded achievements, results, endorsements and progress, with an authenticated downloadable text summary. No past projects or outcomes are invented.
