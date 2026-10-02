# DBS Research & Competitions Platform: prototype

The working prototype of the platform proposed in **CMS Proposal v3** (September 2026): one school platform for Stage 1 industry projects and Stage 2 research competitions, run with PRISM (DBS Robotics) and the DSOBA.

## Open it

- Double-click **`index.html`**, or
- double-click **`Open Platform.command`** (serves it on `http://127.0.0.1:4180` and opens the browser; press Ctrl+C in the Terminal window to stop).

No install and no internet needed (fonts fall back to system fonts offline). Everything is saved in this browser. **Reset demo data** in the footer restores the sample data.

## What the deck promised, and where it is

| Deck | In the prototype |
|---|---|
| **Separate logins**: students, teachers, mentors, committee (slide 13) | Sign-in page grouped by role. People with two roles (e.g. committee students, DSOBA mentors) switch role from the top bar |
| **Step-by-step applications, teacher emailed to endorse** (slide 13) | *New application*: a 6-step wizard (Track → Project → Team → Experience → Endorsement → Review), saved as a draft each step. The Experience step takes evidence attachments (CV, certificates, portfolio). Submitting "emails" the chosen teacher, who endorses or returns it with comments |
| **Teachers-in-charge** (slide 13) | The TIC dashboard: every application awaiting their endorsement in one place — proposal, experience and evidence inline, endorse or return without leaving the page — plus the progress of every project they oversee |
| **File storage**: proposals, logs, presentations (slide 13) | Upload and download on every project page; files can be attached to progress logs and to the Experience step of an application. Stored in the browser's IndexedDB |
| **Quota tracker**: places settled before deadlines (slide 13) | *Quota tracker*: places per competition, taken vs pending, days to deadline, and the committee sets the places. Approval is blocked once a competition is full, which ends first come, first served |
| **Accountability**: proposal → endorsement → experience → decision → mentor → logs → final → result (slide 11) | The 8-step tracker at the top of each project page, filled in by the real workflow |
| **Prototype: a student's project page** (slide 11) | `#/project/…`: proposal, people, decisions, log timeline with mentor feedback, files, final submission, result |
| **Stage 1, student-initiated**: proposal → committee review → matching TICs and Old Boys → regular updates (slide 9) | Wizard → endorsement → *Review queue* (assign mentor on approval) → monthly logs with overdue flags |
| **Stage 1, Old Boy-initiated**: project posted → students apply with CV and coursework → committee eligibility check → check-ins every 2 months (slide 9) | Mentors *Post a project*; students apply; the mentor shortlists; the committee confirms eligibility and names a TIC on *Eligibility*, which creates the project with a 2-month check-in cadence |
| **Teacher-initiated projects** | Teachers-in-charge can *Propose a project* (nav) — it skips endorsement and goes straight to the committee to ratify, then runs like any other project. Example seeded: *Acoustic levitation bench* (WKH) |
| **Targeted recruitment** | Postings carry a target audience (All students / G9–G10 / G11–G12): students only see postings aimed at their year level, and restricted ones are labelled |
| **Stage 2**: apply → review → DSOBA match → monitor → grow (slide 10) | Competition applications share the same pipeline; the committee assigns an Old Boy mentor and monitors logs |
| **Monitor / Document** aims (slide 4) | *Register* (every entry, exportable as CSV), *Audit log* (every action), committee *Dashboard* (awaiting decisions, overdue logs, closing deadlines) |
| Competition list and calendar (slides 6–8) | *Competitions* grouped by tier, sorted by deadline, with days-left and places on each card; *Calendar 2026–27* as a real month-by-month calendar with deadline days marked |

"Emails" appear in each person's **Mail** tab with a button that opens the right page, so the workflow can be demonstrated end to end.

## Updated proof of concept (30 September 2026)

The school colours and typography are retained. The sign-in page now groups accounts behind role tabs, project lists use rows, and copy describes the task directly. Tables scroll within their panel on small screens.

Use **Try the sample workflows** on the sign-in page or **Try the demo** in the footer. The walkthrough contains 18 examples with account shortcuts, actions to try and observable outcomes. It covers applications, endorsement and returns, committee approval and rejection, mentor matching, full quotas, uploads, logs, feedback, final submission, results, recruitment, year-level targeting, teacher proposals, calendar dates, Mail, audit and CSV export.

Ten additional sample projects include a returned solar proposal, a declined recycling sorter, an active pond logger, a submitted vibration monitor, a completed microplastics project and a Geneva entry waiting behind two occupied places. Sample proposals, CV evidence, measurements, final reports and a posting brief are real downloadable text or CSV files. New examples merge once into version-5 browser data without replacing existing work; **Reset demo data** recreates the sample state after confirmation.

The prototype was checked in an isolated Chromium browser on desktop and at 390px width. All 26 checks passed, including attachment retrieval after reload, quota enforcement, duplicate/capacity guards for recruitment, CSV content, notifications, audit entries, migration and reset. Sign-in and email delivery are simulated; the checks establish local prototype behaviour, not production integration.

## Try this demo path (about 3 minutes)

1. Sign in as **Ethan Lau** (student) → *New application* → ISEF → fill the steps (attach a CV on *Experience*) → choose **Ms. Chan Sze Man** → Submit.
2. Sign out → **Ms. Chan Sze Man** (teacher) → her dashboard shows Ethan's application inline; open the attached CV, then *Endorse*.
3. Sign out → **Dean Cho** (committee) → *Review queue* → open it → assign mentor **Austin** → Approve. The ISEF quota bar on the dashboard moves.
4. Sign out → **Ethan Lau** → open the project → post a progress log with a file (monthly documentation is the Stage 2 demo policy; the next-log countdown restarts) → *Mark final submission done* → record a result. All 8 accountability steps turn gold.
5. Try **David** (mentor) → *My posted projects* → shortlist Ryan → **Isaac** (committee) → *Eligibility* → confirm.
6. Compare **Ryan Ng** (9B) and **Aaron Tsang** (12IB) under *Old Boy projects*: Aaron sees the senior-only carbon dashboard posting, Ryan sees the junior robotics one. Postings can also carry attached briefs.
7. Try **Mr. Wong Ka Ho** (teacher) → his dashboard has the teacher-initiated *Acoustic levitation bench* (log overdue) and *Propose a project* to start a new one.

## Data

Committee members, competitions and their dates come from the deck; per the deck, dates follow the 2025–26 cycle unless a 2027 date is shown. Competition **place numbers are placeholders** for the committee to set. Students marked *sample*, the sample TICs (WKH, LML) and Dr. Kelvin Ho are fictional. The Disneyland and PwC projects mirror PRISM's current work so the pilot looks realistic. The seed data intentionally includes a **student-initiated** (schlieren, rain-aware routes), a **teacher-initiated** (acoustic levitation) and **Old Boy-initiated** (vision, carbon, robotics) example, plus a shortlisted applicant, so every page has something to show.

## From prototype to production

- **Sign-in:** school Google Workspace SSO restricted to DBS domains for students and staff; invited accounts (or DSOBA SSO) for Old Boys. Roles are assigned by an admin, never self-selected.
- **Server and database:** move the store to a server (e.g. Postgres, or Firebase/Supabase for a small team), with access checks on the server, not in the page.
- **Real email:** the school's mail service for endorsement links (signed, expiring links for teachers).
- **Files:** school Google Drive or cloud storage with per-project folders (the deck mentions "kept on drive").
- **Privacy:** students' CVs and logs are personal data (PDPO). Limit who sees them, set a retention period, and get consent from Old Boy mentors for sharing company material.

## Calendar checked against the supplied deck

The calendar now includes 18 competition milestones from slides 6–8, with exact days only where given in the deck. Samsung registration (3 September–16 October) and proposal submission (20 November) are separate milestones. Judging, exhibitions, workshops and finals appear as dated events or month windows. GTC registration has no closing date in the deck; Geneva selection is November–December; HKSSPC nominations are December–January. The former guessed dates for these events have been removed from the calendar, competition list and quota tracker.

Each milestone has a suggested preparation checklist based on the platform workflow in slides 11 and 13. Ticks persist per demo account and do not grant approval or submit to an organiser. The deck does not give organiser-specific forms, file formats, submission times or lead times; these must be confirmed. Dates without a year are projected onto the prototype's 2026–27 planning year and are labelled accordingly.

The calendar also lists project updates due for the signed-in account (all active projects for the committee). Slide 9 specifies monthly updates for student-led industry projects and check-ins every two months for Old Boy projects. Teacher-led and Stage 2 projects use a labelled monthly demo policy because the deck specifies no interval for them. Posting a new log restarts the appropriate interval, including for backdated log dates.

## Coverage of the proposal's routes (October 2026)

The demo data now shows every route in the proposal, so each one can be opened and compared:

- **Student-initiated Stage 1** — proposal, teacher endorsement, committee decision, monthly updates.
- **Old Boy-initiated Stage 1** — the Old Boy posts the problem, students apply with a CV, the
  committee confirms eligibility and names a TIC, then check-ins every two months.
- **Teacher-initiated** — the teacher proposes it and the committee ratifies it, with no endorsement step.

Austin, Isaac and David each have **one project they posted themselves and one student-initiated
project they mentor**, so the two processes sit side by side on one account. Every teacher has an
application waiting to endorse; every applicant state (pending, shortlisted, placed, declined,
ineligible) and every project status appears; Geneva is full, so the quota block can be shown; one
project has an overdue log; and there is now an example file of every type, including Presentation.

Two functions from the deliverables were missing and have been added:

- **Duplicate applications are blocked** — a student with a live entry in a competition cannot
  submit a second one; the message names the existing entry and its status.
- **Stage 2, step 5** — on a finished entry the committee can *Recommend for Stage 1*, which records
  it on the project and notifies the team, teacher and mentor.

There is no checks page in the product. The 36 automated checks live outside this folder as a test
harness that is injected at run time; the last run passed 36/36 on both this copy and the public one.


## Public copy

`python3 make-public.py` writes `public-build/`: the same prototype with the school name, crest,
alumni association, partner companies and every real person replaced by fictional ones. The script
fails if any identifying term survives. That build is published at

**https://gutentag-cloud.github.io/research-competitions-platform/**

from the public repo `gutentag-cloud/research-competitions-platform`. This folder keeps the real
names and branding for school use; regenerate and push the public build after changing anything here.
