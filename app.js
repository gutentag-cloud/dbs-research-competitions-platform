/* Views and routing. Every interpolated value goes through html``, which escapes it. */
(function () {
  const S = RCP.store;
  const root = document.getElementById('app');

  // ---------- templating ----------
  class Raw { constructor(s) { this.s = s; } }
  const raw = (s) => new Raw(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(fmt).join('') : v === null || v === undefined || v === false ? '' : esc(v));
  const html = (strings, ...vals) => raw(strings.reduce((acc, s, i) => acc + s + (i < vals.length ? fmt(vals[i]) : ''), ''));

  const date = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const ago = (iso) => {
    const d = Math.round((Date.now() - Date.parse(iso)) / 86400000);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : date(iso);
  };
  const todayIso = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
  const chunk = (a, n) => (a.length ? [a.slice(0, n), ...chunk(a.slice(n), n)] : []);
  const size = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
  const badge = (status) => html`<span class="badge tone-${RCP.STATUS[status].tone}">${RCP.STATUS[status].label}</span>`;
  const avatar = (id) => {
    const u = S.user(id);
    const letters = u ? (u.initials || u.name.replace(/^(Mr|Ms|Dr|Dean)\.?\s+/, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('')) : '?';
    return html`<span class="avatar" title="${S.displayName(id)}">${letters}</span>`;
  };
  const people = (ids) => html`<span class="people">${ids.map((id) => html`<span class="person">${avatar(id)}<span>${S.displayName(id)}</span></span>`)}</span>`;
  const trackLabel = (p) => (p.stage === 1 ? `Stage 1 · ${p.partner || (p.origin === 'teacher' ? 'School-based project' : 'Industry project')}` : `Stage 2 · ${p.competitionId ? S.comp(p.competitionId).short : ''}`);
  const expFiles = (p) => p.files.filter((f) => f.category === 'Experience evidence');
  const fileChips = (files) => files.length ? html`<div class="files-inline">${files.map((f) => html`<button type="button" class="file-chip" data-act="download" data-file="${f.id}">${f.name}</button>`)}</div>` : '';
  const AUDIENCES = [['all', 'All students'], ['G9–G10', 'G9–G10 only'], ['G11–G12', 'G11–G12 only']];
  const audienceLabel = (a) => (AUDIENCES.find(([k]) => k === a) || AUDIENCES[0])[1];
  const gradeOf = (u) => { const m = String((u && u.form) || '').match(/\d+/); return m ? Number(m[0]) : 0; };
  const audienceOk = (o, u) => !o.audience || o.audience === 'all' || (o.audience === 'G9–G10' ? gradeOf(u) <= 10 : gradeOf(u) >= 11);

  let loginRole = 'student';
  let calendarMode = 'agenda';
  let calendarCompetition = 'all';
  let flash = null;
  const notify = (msg, tone) => { flash = { msg, tone: tone || 'good' }; };

  // ---------- permissions ----------
  const canSee = (p, me, role) =>
    role === 'committee' || p.members.includes(me.id) || p.teacherId === me.id || p.mentorId === me.id;

  // ---------- chrome ----------
  const NAV = {
    student: [['#/', 'My projects'], ['#/apply', 'New application'], ['#/postings', 'Old Boy projects'], ['#/competitions', 'Competitions'], ['#/calendar', 'Calendar']],
    teacher: [['#/', 'Overview'], ['#/endorse', 'Endorsements'], ['#/propose', 'Propose a project'], ['#/competitions', 'Competitions'], ['#/calendar', 'Calendar']],
    mentor: [['#/', 'My mentees'], ['#/postings', 'My posted projects'], ['#/postings/new', 'Post a project'], ['#/calendar', 'Calendar']],
    committee: [['#/', 'Dashboard'], ['#/review', 'Review queue'], ['#/quota', 'Quota tracker'], ['#/eligibility', 'Eligibility'], ['#/register', 'Register'], ['#/calendar', 'Calendar'], ['#/audit', 'Audit log']],
  };
  const ROLE_LABEL = { student: 'Student', teacher: 'Teacher', mentor: 'Old Boy mentor', committee: 'Committee' };

  function shell(me, role, route, body) {
    const unread = S.inbox(me, role).filter((m) => !m.read).length;
    const links = NAV[role].map(([href, label]) => {
      const on = href === '#/' ? route === '#/' : route.startsWith(href) && !(href === '#/postings' && route === '#/postings/new');
      return html`<a href="${href}" class="${on ? 'on' : ''}">${label}</a>`;
    });
    const otherRoles = me.roles.filter((r) => r !== role);
    return html`
      <header class="topbar">
        <a class="brand" href="#/"><img src="assets/crest.png" alt=""><span><b>Research &amp; Competitions</b><small>Proof of concept · demo data · not an official school system</small></span></a>
        <nav class="nav">${links}<a href="#/mail" class="${route === '#/mail' ? 'on' : ''}">Mail${unread ? html` <span class="count">${unread}</span>` : ''}</a></nav>
        <div class="whoami">
          ${avatar(me.id)}
          <div><b>${me.name}</b><small>${ROLE_LABEL[role]}${me.title && role !== 'student' ? ` · ${me.title}` : ''}</small></div>
          ${otherRoles.length ? html`<select data-act="switch-role" aria-label="Switch role"><option value="">Switch role…</option>${otherRoles.map((r) => html`<option value="${r}">${ROLE_LABEL[r]}</option>`)}</select>` : ''}
          <button class="link" data-act="signout">Sign out</button>
        </div>
      </header>
      ${flash ? html`<div class="flash tone-${flash.tone}" role="status">${flash.msg}</div>` : ''}
      <main class="page">${body}</main>
      <footer class="foot"><span>Demo data stays in this browser. Notifications appear in Mail.</span><a href="#/demo">Try the demo</a>
        <button class="link" data-act="reset">Reset demo data</button></footer>`;
  }

  // ---------- login ----------
  function viewLogin() {
    const groups = [
      ['student', 'Students', 'Apply, keep logs, upload files'],
      ['teacher', 'Teachers', 'Endorse applications, follow projects'],
      ['mentor', 'Old Boy mentors', 'Post projects, mentor teams'],
      ['committee', 'Committee', 'Review, match mentors, set quotas'],
    ];
    return html`
      <div class="login">
        <div class="login-hero">
          <img src="assets/crest.png" alt="Diocesan Boys' School crest">
          <h1>Research &amp; Competitions Platform</h1>
          <p>Research projects and competition entries at Diocesan Boys’ School.</p><p class="poc-note">A proof of concept for the proposed platform. Every person, project and file here is made up, and this is not an official school system.</p>
          <div class="login-note"><p>Find a project, put forward a proposal or catch up with your team.</p><a href="#/demo">Try the sample workflows <span aria-hidden="true">→</span></a><small>Proof of concept for the 2026–27 school year</small></div>
        </div>
        <div class="login-pick">
          <h2>Choose a demo account</h2>
          <p class="muted">Select a role, then a person to see their workspace.</p>
          <div class="role-tabs" aria-label="Account role">${groups.map(([r, title]) => html`<button data-act="login-role" data-role="${r}" aria-pressed="${loginRole === r}" class="${loginRole === r ? 'on' : ''}">${title}</button>`)}</div>
          ${groups.filter(([r]) => r === loginRole).map(([role, title, blurb]) => html`
            <section class="login-group">
              <h3>${title}</h3>
              <div class="login-users">
                ${S.usersWith(role).map((u) => html`<button class="login-user" data-act="signin" data-user="${u.id}" data-role="${role}">${avatar(u.id)}<span><b>${u.name}</b><small>${u.form || u.title || ''}${u.sample ? ' · sample' : ''}</small></span></button>`)}
              </div>
            </section>`)}
        </div>
      </div>`;
  }

  // ---------- shared pieces ----------
  function checklist(p) {
    const done = RCP.ACCOUNTABILITY.filter(([k]) => p.checklist[k]).length;
    return html`
      <ol class="checklist" aria-label="Accountability: ${done} of ${RCP.ACCOUNTABILITY.length} done">
        ${RCP.ACCOUNTABILITY.map(([k, label]) => html`<li class="${p.checklist[k] ? 'done' : ''}"><i aria-hidden="true">${p.checklist[k] ? '✓' : ''}</i>${label}</li>`)}
      </ol>`;
  }

  function projectCard(p, extra) {
    const due = S.logDue(p);
    return html`
      <a class="card project-card" href="#/project/${p.id}">
        <div class="card-top"><span class="track">${trackLabel(p)}</span>${badge(p.status)}</div>
        <h3>${p.title || 'Untitled draft'}</h3>
        <div class="muted small">${p.members.map(S.displayName).join(', ')}</div>
        <div class="progress"><span style="width:${Math.round((RCP.ACCOUNTABILITY.filter(([k]) => p.checklist[k]).length / RCP.ACCOUNTABILITY.length) * 100)}%"></span></div>
        <div class="card-foot small">
          ${p.mentorId ? html`<span>Mentor: ${S.displayName(p.mentorId)}</span>` : ''}
          ${due ? html`<span class="${due.overdue ? 'tone-bad-text' : 'muted'}">${due.overdue ? `Log overdue by ${-due.days} days` : `Next log due in ${due.days} days`}</span>` : ''}
          ${extra || ''}
        </div>
      </a>`;
  }

  function empty(text, href, cta) {
    return html`<div class="empty"><p>${text}</p>${href ? html`<a class="btn" href="${href}">${cta}</a>` : ''}</div>`;
  }

  function quotaBar(compId) {
    const q = S.quota(compId);
    if (q.places === null) return html`<span class="muted small">Case by case</span>`;
    const pct = (n) => Math.min(100, (n / Math.max(1, q.places)) * 100);
    return html`
      <div class="quota" title="${q.taken} taken, ${q.pending} pending, ${q.places} places">
        <div class="quota-bar"><span class="taken" style="width:${pct(q.taken)}%"></span><span class="pending" style="width:${pct(Math.min(q.pending, Math.max(0, q.places - q.taken)))}%"></span></div>
        <span class="small">${q.taken}/${q.places} taken${q.pending ? ` · ${q.pending} pending` : ''}${q.full ? ' · full' : ''}</span>
      </div>`;
  }

  function daysUntil(d) { return d ? Math.ceil((Date.parse(d + 'T23:59:59+08:00') - Date.now()) / 86400000) : null; }

  // ---------- dashboards ----------
  function viewStudentHome(me) {
    const mine = S.db.projects.filter((p) => p.members.includes(me.id));
    const open = S.db.postings.filter((o) => o.status === 'open' && audienceOk(o, me)).slice(0, 2);
    const soon = S.db.competitions.filter((c) => daysUntil(c.deadline) !== null && daysUntil(c.deadline) >= 0).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3);
    return html`
      <div class="page-head"><div><h1>My projects</h1><p class="muted">Your applications and current research.</p></div><a class="btn" href="#/apply">New application</a></div>
      <div class="grid-2">
        <section>${mine.length ? html`<div class="cards">${mine.map((p) => projectCard(p))}</div>` : empty('You have no projects yet.', '#/apply', 'Start an application')}</section>
        <aside class="side">
          <div class="panel"><h3>Coming deadlines</h3>
            <ul class="plain">${soon.map((c) => html`<li><b>${c.short}</b> <span class="muted small">${c.hkRound}</span><br><span class="small ${daysUntil(c.deadline) < 21 ? 'tone-bad-text' : ''}">${daysUntil(c.deadline)} days · ${date(c.deadline)}</span></li>`)}</ul>
            <a class="small" href="#/competitions">All competitions →</a></div>
          <div class="panel"><h3>Posted by Old Boys</h3>
            ${open.map((o) => html`<a class="mini" href="#/postings/${o.id}"><b>${o.title}</b><span class="muted small">${o.places} places · ${o.hours}</span></a>`)}
            <a class="small" href="#/postings">Browse all →</a></div>
        </aside>
      </div>`;
  }

  function endorseCard(p) {
    const evidence = expFiles(p);
    return html`
      <div class="card">
        <div class="card-top"><span class="track">${trackLabel(p)}</span><span class="muted small">Submitted ${ago(p.createdAt)}</span></div>
        <h3><a href="#/project/${p.id}">${p.title}</a></h3>
        <div class="muted small">${p.members.map(S.displayName).join(', ')}</div>
        <p class="pre small">${p.abstract}</p>
        <details>
          <summary class="small">Previous experience${evidence.length ? html` · ${evidence.length} attached file${evidence.length === 1 ? '' : 's'}` : ''}</summary>
          <p class="pre small">${p.experience || '—'}</p>
          ${fileChips(evidence)}
        </details>
        <form class="inline-form" data-form="endorse" data-project="${p.id}">
          <input name="note" maxlength="400" placeholder="Comment to the students and committee (optional)" aria-label="Comment">
          <button class="btn small ghost" name="choice" value="no">Return</button>
          <button class="btn small" name="choice" value="yes">Endorse</button>
        </form>
      </div>`;
  }

  function viewTeacherHome(me) {
    const pending = S.db.projects.filter((p) => p.teacherId === me.id && p.status === 'endorsement').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const mine = S.db.projects.filter((p) => p.teacherId === me.id && !['draft', 'endorsement'].includes(p.status));
    return html`
      <div class="page-head"><div><h1>Overview</h1><p class="muted">Applications awaiting your endorsement and teams you supervise.</p></div><a class="btn ghost" href="#/propose">Propose a project</a></div>
      ${pending.length ? html`<div class="callout tone-warn"><b>${pending.length} application${pending.length > 1 ? 's' : ''} waiting for your endorsement.</b> You can decide right here; the students and the committee are notified either way.</div>` : ''}
      <h2>Awaiting your endorsement</h2>
      ${pending.length ? html`<div class="cards">${pending.map(endorseCard)}</div>` : empty('You have no applications to endorse.')}
      <h2>Projects you're teacher-in-charge for</h2>
      ${mine.length ? html`<div class="cards">${mine.map((p) => projectCard(p))}</div>` : empty('None yet.')}`;
  }

  function viewMentorHome(me) {
    const mine = S.db.projects.filter((p) => p.mentorId === me.id);
    const posts = S.db.postings.filter((o) => o.by === me.id);
    const pendingApps = posts.reduce((n, o) => n + o.applications.filter((a) => a.status === 'pending').length, 0);
    return html`
      <div class="page-head"><div><h1>My mentees</h1><p class="muted">Recent work from the teams you mentor.</p></div><a class="btn" href="#/postings/new">Post a project</a></div>
      ${pendingApps ? html`<div class="callout tone-info"><b>${pendingApps} new applicant${pendingApps > 1 ? 's' : ''}</b> on your posted projects. <a href="#/postings">See them →</a></div>` : ''}
      ${mine.length ? html`<div class="cards">${mine.map((p) => projectCard(p))}</div>` : empty('You have no assigned teams yet.', '#/postings/new', 'Post a project')}`;
  }

  function viewCommitteeHome() {
    const P = S.db.projects;
    const review = P.filter((p) => p.status === 'review');
    const endorsement = P.filter((p) => p.status === 'endorsement');
    const active = P.filter((p) => p.status === 'active');
    const overdue = active.filter((p) => S.logDue(p) && S.logDue(p).overdue);
    const noMentor = active.filter((p) => !p.mentorId);
    const elig = S.db.postings.reduce((n, o) => n + o.applications.filter((a) => a.status === 'shortlisted').length, 0);
    const closing = S.db.competitions.filter((c) => { const d = daysUntil(c.deadline); return d !== null && d >= 0 && d <= 45; });
    const stat = (n, label, href, tone) => html`<a class="stat ${tone ? 'tone-' + tone : ''}" href="${href}"><b>${n}</b><span>${label}</span></a>`;
    return html`
      <div class="page-head"><div><h1>Committee dashboard</h1><p class="muted">Applications, project updates and upcoming deadlines.</p></div><a class="btn ghost" href="#/register">Open register</a></div>
      <div class="stats">
        ${stat(review.length, 'awaiting committee decision', '#/review', review.length ? 'warn' : '')}
        ${stat(endorsement.length, 'awaiting teacher endorsement', '#/register', '')}
        ${stat(active.length, 'active projects', '#/register', 'good')}
        ${stat(overdue.length, 'progress logs overdue', '#/register', overdue.length ? 'bad' : '')}
        ${stat(elig, 'Old Boy applicants to check', '#/eligibility', elig ? 'warn' : '')}
      </div>
      <div class="grid-2">
        <section class="panel">
          <h3>Places to settle before deadlines</h3>
          <table class="table"><thead><tr><th>Competition</th><th>Deadline</th><th>Places</th></tr></thead><tbody>
          ${closing.map((c) => html`<tr><td><b>${c.short}</b></td><td class="${daysUntil(c.deadline) < 21 ? 'tone-bad-text' : ''}">${daysUntil(c.deadline)} days</td><td>${quotaBar(c.id)}</td></tr>`)}
          </tbody></table>
          <a class="small" href="#/quota">Quota tracker →</a>
        </section>
        <section class="panel">
          <h3>Needs attention</h3>
          <ul class="plain">
            ${review.map((p) => html`<li><a href="#/review/${p.id}">${p.title}</a> <span class="muted small">· ${trackLabel(p)} · endorsed ${ago(p.endorsement.at)}</span></li>`)}
            ${overdue.map((p) => html`<li><a href="#/project/${p.id}">${p.title}</a> <span class="tone-bad-text small">· log overdue ${-S.logDue(p).days} days</span></li>`)}
            ${noMentor.map((p) => html`<li><a href="#/project/${p.id}">${p.title}</a> <span class="small tone-warn-text">· no mentor assigned</span></li>`)}
            ${!review.length && !overdue.length && !noMentor.length ? html`<li class="muted">Nothing outstanding.</li>` : ''}
          </ul>
        </section>
      </div>
      <section class="panel"><h3>Recent activity</h3>${auditList(S.db.audit.slice(0, 8))}<a class="small" href="#/audit">Full audit log →</a></section>`;
  }

  // ---------- application wizard (slide 13: step-by-step) ----------
  let wizard = null;
  const STEPS = ['Track', 'Project', 'Team', 'Experience', 'Endorsement', 'Review'];

  function freshWizard(me, fromId) {
    const p = fromId ? S.project(fromId) : null;
    return {
      step: 0, id: p ? p.id : null, stage: p ? p.stage : 2, competitionId: p ? p.competitionId || 'isef' : 'isef', partner: p ? p.partner || '' : '',
      title: p ? p.title : '', abstract: p ? p.abstract : '', members: p ? [...p.members] : [me.id], experience: p ? p.experience : '', teacherId: p ? p.teacherId || '' : '',
    };
  }

  function viewApply(me, fromId) {
    if (!wizard || (fromId && wizard.id !== fromId)) wizard = freshWizard(me, fromId);
    const w = wizard;
    const step = w.step;
    const comp = S.comp(w.competitionId);
    const q = w.stage === 2 ? S.quota(w.competitionId) : null;
    const students = S.usersWith('student');
    const teachers = S.usersWith('teacher');
    let body;
    if (step === 0) {
      body = html`
        <div class="choice-grid">
          <label class="choice ${w.stage === 1 ? 'on' : ''}"><input type="radio" name="stage" value="1" ${w.stage === 1 ? raw('checked') : ''}><b>Stage 1 · Industry project</b><span>Research with an industry partner and an Old Boy mentor.</span></label>
          <label class="choice ${w.stage === 2 ? 'on' : ''}"><input type="radio" name="stage" value="2" ${w.stage === 2 ? raw('checked') : ''}><b>Stage 2 · Research competition</b><span>Enter a research competition through the school.</span></label>
        </div>
        ${w.stage === 2 ? html`
          <label class="field"><span>Competition</span>
            <select name="competitionId">${S.db.competitions.map((c) => html`<option value="${c.id}" ${c.id === w.competitionId ? raw('selected') : ''}>${c.short} — ${c.name}</option>`)}</select></label>
          <div class="callout ${q.full ? 'tone-bad' : 'tone-info'} small">
            <b>${comp.short}</b>: ${comp.hkRound}. Final: ${comp.final}.
            ${q.places !== null ? html`<br>School places: ${q.taken} of ${q.places} taken, ${q.pending} in progress.${q.full ? ' This competition is full; you can still apply to the waiting list.' : ''}` : html`<br>Considered case by case.`}
          </div>` : html`
          <label class="field"><span>Company or partner <small>(if known)</small></span><input name="partner" value="${w.partner}" placeholder="e.g. a PRISM partner, or leave blank to be matched"></label>`}`;
    } else if (step === 1) {
      body = html`
        <label class="field"><span>Project title</span><input name="title" value="${w.title}" required maxlength="120" placeholder="A clear, specific title"></label>
        <label class="field"><span>Proposal <small>What problem, what you'll build or test, how you'll know it worked (150–300 words)</small></span><textarea name="abstract" rows="8" required>${w.abstract}</textarea></label>`;
    } else if (step === 2) {
      body = html`
        <p class="muted">Tick everyone on the team. You're included automatically.</p>
        <div class="check-grid">${students.map((u) => html`<label class="check"><input type="checkbox" name="members" value="${u.id}" ${w.members.includes(u.id) ? raw('checked') : ''} ${u.id === me.id ? raw('disabled') : ''}>${avatar(u.id)} ${u.name} <span class="muted small">${u.form}</span></label>`)}</div>`;
    } else if (step === 3) {
      const attached = w.id && S.project(w.id) ? expFiles(S.project(w.id)) : [];
      body = html`
        <label class="field"><span>Previous experience <small>Competitions, clubs, coursework or skills relevant to this project</small></span><textarea name="experience" rows="6" required>${w.experience}</textarea></label>
        <label class="field"><span>Attach evidence <small>(optional) — CV, certificates or portfolio; the endorsing teacher and the committee can open these</small></span><input type="file" name="expfiles" multiple></label>
        ${attached.length ? html`<div class="field"><span>Already attached to this application</span>${fileChips(attached)}</div>` : ''}`;
    } else if (step === 4) {
      body = html`
        <p class="muted">Choose the teacher who will review your application; the request will appear in their Mail.</p>
        <div class="check-grid">${teachers.map((u) => html`<label class="check"><input type="radio" name="teacherId" value="${u.id}" ${w.teacherId === u.id ? raw('checked') : ''} required>${avatar(u.id)} ${S.displayName(u.id)} <span class="muted small">${u.title}</span></label>`)}</div>`;
    } else {
      const attached = w.id && S.project(w.id) ? expFiles(S.project(w.id)) : [];
      body = html`
        <dl class="summary">
          <dt>Track</dt><dd>${w.stage === 1 ? `Stage 1 industry project${w.partner ? ' · ' + w.partner : ''}` : `Stage 2 · ${comp.name}`}</dd>
          <dt>Title</dt><dd>${w.title}</dd>
          <dt>Proposal</dt><dd class="pre">${w.abstract}</dd>
          <dt>Team</dt><dd>${people(w.members)}</dd>
          <dt>Experience</dt><dd class="pre">${w.experience}</dd>
          <dt>Evidence files</dt><dd>${attached.length ? fileChips(attached) : html`<span class="muted">None attached</span>`}</dd>
          <dt>Endorsing teacher</dt><dd>${w.teacherId ? people([w.teacherId]) : '—'}</dd>
        </dl>
        <div class="callout tone-info small">Submitting sends an endorsement request to ${S.displayName(w.teacherId)} in Mail, then the committee reviews it${w.stage === 2 ? ' and allocates a place' : ' and matches a mentor'}.</div>`;
    }
    return html`
      <div class="page-head"><div><h1>${w.id ? 'Continue application' : 'New application'}</h1><p class="muted">Saved as a draft at every step.</p></div></div>
      <ol class="steps">${STEPS.map((s, i) => html`<li class="${i === step ? 'on' : i < step ? 'done' : ''}"><span>${i + 1}</span>${s}</li>`)}</ol>
      <form class="panel wizard" data-form="wizard">
        ${body}
        <div class="form-actions">
          ${step > 0 ? html`<button type="button" class="btn ghost" data-act="wiz-back">Back</button>` : html`<span></span>`}
          ${step < STEPS.length - 1 ? html`<button class="btn">Continue</button>` : html`<button class="btn" data-submit="1">Submit for endorsement</button>`}
        </div>
      </form>`;
  }

  function readWizard(form) {
    const w = wizard;
    const fd = new FormData(form);
    if (w.step === 0) {
      w.stage = Number(fd.get('stage') || w.stage);
      if (fd.get('competitionId')) w.competitionId = fd.get('competitionId');
      if (fd.has('partner')) w.partner = fd.get('partner');
    } else if (w.step === 1) { w.title = fd.get('title'); w.abstract = fd.get('abstract'); }
    else if (w.step === 2) { const me = S.me(); w.members = [me.id, ...fd.getAll('members').filter((id) => id !== me.id)]; }
    else if (w.step === 3) w.experience = fd.get('experience');
    else if (w.step === 4) w.teacherId = fd.get('teacherId') || '';
  }

  // ---------- project page (slide 11 prototype) ----------
  function viewProject(me, role, id) {
    const p = S.project(id);
    if (!p) return empty('Project not found.', '#/', 'Back');
    if (!canSee(p, me, role)) return empty('You can only open projects you are part of.', '#/', 'Back');
    const isMember = p.members.includes(me.id);
    const isMentor = p.mentorId === me.id;
    const due = S.logDue(p);
    const comp = p.competitionId ? S.comp(p.competitionId) : null;
    const today = todayIso();
    const fileById = Object.fromEntries(p.files.map((f) => [f.id, f]));
    return html`
      <a class="back" href="#/">← Back</a>
      <div class="project-head">
        <div>
          <div class="track">${trackLabel(p)}</div>
          <h1>${p.title || 'Untitled draft'}</h1>
          <div class="head-meta">${badge(p.status)} <span class="muted small">Started ${date(p.createdAt)}${p.origin === 'teacher' ? ' · Teacher-initiated' : p.origin === 'oldboy' ? ' · Old Boy-initiated' : ''}</span></div>
        </div>
        <div class="head-actions">
          ${isMember && ['draft', 'returned'].includes(p.status) ? html`<a class="btn" href="#/apply/${p.id}">${p.status === 'returned' ? 'Revise and resubmit' : 'Continue application'}</a>` : ''}
          ${role === 'committee' && p.status === 'review' ? html`<a class="btn" href="#/review/${p.id}">Review</a>` : ''}
          ${p.teacherId === me.id && p.status === 'endorsement' ? html`<a class="btn" href="#/endorse/${p.id}">Endorse</a>` : ''}
        </div>
      </div>
      ${checklist(p)}
      ${p.endorsement && p.endorsement.declined && p.status === 'returned' ? html`<div class="callout tone-bad"><b>Returned by ${S.displayName(p.endorsement.by)}:</b> ${p.endorsement.note}</div>` : ''}
      <div class="grid-2">
        <section>
          <div class="panel">
            <h3>Proposal</h3>
            <p class="pre">${p.abstract || '—'}</p>
            ${comp ? html`<p class="small muted"><b>${comp.name}</b> · ${comp.hkRound} · Final: ${comp.final}</p>` : ''}
            <h4>Previous experience</h4><p class="pre small">${p.experience || '—'}</p>
            ${fileChips(expFiles(p))}
          </div>

          <div class="panel">
            <div class="panel-head"><h3>Progress logs</h3>
              ${due ? html`<span class="small ${due.overdue ? 'tone-bad-text' : 'muted'}">${S.cadenceLabel(p)} · ${due.overdue ? `overdue by ${-due.days} days` : `next due in ${due.days} days`}</span>` : ''}</div>
            ${p.logs.length ? html`<ol class="timeline">${[...p.logs].reverse().map((l) => html`
              <li>
                <div class="tl-head"><b>${date(l.date)}</b><span class="muted small">${S.displayName(l.by)} · ${ago(l.at)}</span></div>
                <p class="pre">${l.text}</p>
                ${l.files.length ? html`<div class="files-inline">${l.files.map((fid) => fileById[fid] ? html`<button class="file-chip" data-act="download" data-file="${fid}">${fileById[fid].name}</button>` : '')}</div>` : ''}
                ${l.comments.map((c) => html`<div class="comment">${avatar(c.by)}<div><b>${S.displayName(c.by)}</b> <span class="muted small">${ago(c.at)}</span><p>${c.text}</p></div></div>`)}
                ${isMentor || role === 'committee' || p.teacherId === me.id ? html`
                  <form class="comment-form" data-form="comment" data-log="${l.id}"><input name="text" placeholder="Leave feedback" aria-label="Feedback on this log" required maxlength="600"><button class="btn small">Send</button></form>` : ''}
              </li>`)}</ol>` : html`<p class="muted">No logs yet.</p>`}
            ${isMember && p.status === 'active' ? html`
              <form class="log-form" data-form="log">
                <h4>Add a progress log</h4>
                <div class="row"><label class="field"><span>Log date</span><input type="date" name="date" value="${today}" required></label>
                <label class="field grow"><span>Attach files <small>(optional)</small></span><input type="file" name="files" multiple></label></div>
                <label class="field"><span>What did you do, what did you find, what's next?</span><textarea name="text" rows="4" required></textarea></label>
                <button class="btn">Post log</button>
              </form>` : ''}
          </div>
        </section>

        <aside class="side">
          <div class="panel">
            <h3>People</h3>
            <dl class="kv">
              <dt>Team</dt><dd>${people(p.members)}</dd>
              <dt>Teacher-in-charge</dt><dd>${p.teacherId ? people([p.teacherId]) : '—'}</dd>
              <dt>Old Boy mentor</dt><dd>${p.mentorId ? people([p.mentorId]) : html`<span class="muted">Not assigned</span>`}</dd>
              ${p.industryTutor ? html`<dt>Industrial tutor</dt><dd>${p.industryTutor}</dd>` : ''}
            </dl>
            ${role === 'committee' && ['active', 'review'].includes(p.status) ? html`
              <form data-form="assign-mentor" class="inline-form"><select name="mentorId" aria-label="Assign mentor"><option value="">${p.mentorId ? 'Change mentor…' : 'Assign mentor…'}</option>${S.usersWith('mentor').map((u) => html`<option value="${u.id}">${u.name}</option>`)}</select><button class="btn small ghost">Assign</button></form>` : ''}
          </div>

          <div class="panel">
            <h3>Decisions</h3>
            <ul class="plain small">
              <li><b>Endorsement:</b> ${p.endorsement ? html`${p.endorsement.declined ? 'Returned' : 'Endorsed'} by ${S.displayName(p.endorsement.by)}, ${date(p.endorsement.at)}${p.endorsement.note ? html`<br><span class="muted">“${p.endorsement.note}”</span>` : ''}` : html`<span class="muted">Pending</span>`}</li>
              <li><b>Committee:</b> ${p.decision ? html`${p.decision.outcome === 'approved' ? 'Approved' : 'Not approved'} by ${S.displayName(p.decision.by)}, ${date(p.decision.at)}${p.decision.note ? html`<br><span class="muted">“${p.decision.note}”</span>` : ''}` : html`<span class="muted">Pending</span>`}</li>
              ${p.result ? html`<li><b>Result:</b> ${p.result}</li>` : ''}
            </ul>
          </div>

          <div class="panel">
            <h3>Files</h3>
            ${p.files.length ? html`<ul class="files">${p.files.map((f) => html`<li><button class="file-chip" data-act="download" data-file="${f.id}">${f.name}</button><span class="muted small">${f.category} · ${size(f.size)} · ${S.user(f.by) ? S.user(f.by).name : ''}</span></li>`)}</ul>` : html`<p class="muted small">Proposals, logs and presentations uploaded here are kept with the project.</p>`}
            ${isMember || isMentor || role === 'committee' ? html`
              <form data-form="upload" class="upload">
                <select name="category" aria-label="File type">${RCP.FILE_CATEGORIES.map((c) => html`<option>${c}</option>`)}</select>
                <input type="file" name="file" required>
                <button class="btn small">Upload</button>
              </form>
              ${S.storesFilesDurably() ? '' : html`<p class="small tone-warn-text">This browser blocks local file storage; uploads last until the page closes.</p>`}` : ''}
          </div>

          ${isMember && p.status === 'active' ? html`<div class="panel"><h3>Final submission</h3><p class="small muted">Mark done once the final entry has gone to the organiser. Upload the submitted file first.</p><button class="btn ghost" data-act="final">Mark final submission done</button></div>` : ''}
          ${p.industryFollowUp ? html`<div class="panel"><h3>Taking it further</h3><p class="small">Recommended for a long-term industry project by ${S.displayName(p.industryFollowUp.by)}, ${date(p.industryFollowUp.at)}.${p.industryFollowUp.note ? html`<br><span class="muted">“${p.industryFollowUp.note}”</span>` : ''}</p></div>` : ''}
          ${role === 'committee' && ['submitted', 'completed'].includes(p.status) && !p.industryFollowUp ? html`
            <form class="panel" data-form="industry-followup"><h3>Taking it further</h3>
              <p class="small muted">Stage 2, step 5: recommend a finished entry for a long-term industry project with an Old Boy or partner.</p>
              <label class="field"><span>Note to the team <small>(optional)</small></span><input name="note" maxlength="200" placeholder="Who could host it, or what to develop"></label>
              <button class="btn small">Recommend for Stage 1</button></form>` : ''}
          ${(isMember || role === 'committee') && p.status === 'submitted' ? html`<form class="panel" data-form="result"><h3>Result</h3><label class="field"><span>Outcome or award</span><input name="result" placeholder="e.g. HKSSPC Senior — Second Prize" required maxlength="160"></label><button class="btn small">Record result</button></form>` : ''}
        </aside>
      </div>`;
  }

  // ---------- endorsement ----------
  function viewEndorseList(me) {
    const list = S.db.projects.filter((p) => p.teacherId === me.id && p.status === 'endorsement');
    return html`
      <div class="page-head"><div><h1>Endorsements</h1><p class="muted">Students have asked you to endorse these applications.</p></div></div>
      ${list.length ? html`<div class="cards">${list.map((p) => projectCard(p, html`<span>Submitted ${ago(p.createdAt)}</span>`))}</div>` : empty('Nothing waiting for your endorsement.')}`;
  }

  function decisionPage(p, kind) {
    const comp = p.competitionId ? S.comp(p.competitionId) : null;
    const q = comp ? S.quota(comp.id) : null;
    return html`
      <a class="back" href="#/${kind === 'endorse' ? 'endorse' : 'review'}">← Back</a>
      <div class="page-head"><div><div class="track">${trackLabel(p)}</div><h1>${p.title}</h1></div>${badge(p.status)}</div>
      <div class="grid-2">
        <section class="panel">
          <dl class="summary">
            <dt>Team</dt><dd>${people(p.members)}</dd>
            <dt>Proposal</dt><dd class="pre">${p.abstract}</dd>
            <dt>Previous experience</dt><dd class="pre">${p.experience}</dd>
            <dt>Evidence</dt><dd>${expFiles(p).length ? fileChips(expFiles(p)) : html`<span class="muted">None attached</span>`}</dd>
            ${p.endorsement ? html`<dt>Teacher endorsement</dt><dd>${S.displayName(p.endorsement.by)}: “${p.endorsement.note}”</dd>` : ''}
            ${comp ? html`<dt>Competition</dt><dd>${comp.name}<br><span class="muted small">${comp.hkRound} · Final: ${comp.final}</span></dd>` : ''}
          </dl>
        </section>
        <aside class="side">
          ${comp ? html`<div class="panel"><h3>${comp.short} places</h3>${quotaBar(comp.id)}${q.full ? html`<p class="small tone-bad-text">All places are taken. Increase the quota before approving another entry.</p>` : ''}</div>` : ''}
          <form class="panel" data-form="${kind}">
            <h3>${kind === 'endorse' ? 'Your endorsement' : 'Committee decision'}</h3>
            ${kind === 'review' ? html`<label class="field"><span>Assign Old Boy mentor</span><select name="mentorId"><option value="">Later</option>${S.usersWith('mentor').map((u) => html`<option value="${u.id}">${u.name}${u.title ? ' — ' + u.title : ''}</option>`)}</select></label>` : ''}
            <label class="field"><span>Comment ${kind === 'endorse' ? 'to the students and committee' : 'to the team'}</span><textarea name="note" rows="4" placeholder="${kind === 'endorse' ? 'Why you support it, or what to change' : 'Reason for the decision'}"></textarea></label>
            <div class="form-actions">
              <button class="btn ghost" name="choice" value="no">${kind === 'endorse' ? 'Return with comments' : 'Do not approve'}</button>
              <button class="btn" name="choice" value="yes">${kind === 'endorse' ? 'Endorse' : 'Approve'}</button>
            </div>
          </form>
        </aside>
      </div>`;
  }

  // ---------- committee ----------
  function viewReviewQueue() {
    const list = S.db.projects.filter((p) => p.status === 'review').sort((a, b) => (a.competitionId ? S.comp(a.competitionId).tier : 0) - (b.competitionId ? S.comp(b.competitionId).tier : 0));
    return html`
      <div class="page-head"><div><h1>Review queue</h1><p class="muted">Applications ready for a committee decision, ordered by track and competition tier.</p></div></div>
      ${list.length ? html`<div class="cards">${list.map((p) => projectCard(p, html`<span>Endorsed by ${S.displayName(p.endorsement.by)}</span>`))}</div>` : empty('The queue is empty.')}`;
  }

  function viewQuota(role) {
    return html`
      <div class="page-head"><div><h1>Quota tracker</h1><p class="muted">Set school places before registration or nomination. Date windows follow the proposal; exact current-year closing dates still need confirmation.</p></div></div>
      <div class="panel table-wrap"><table class="table quota-table"><thead><tr><th>Competition</th><th>Hong Kong round</th><th>Deadline</th><th>Places</th><th>Entries</th>${role === 'committee' ? html`<th>Set places</th>` : ''}</tr></thead><tbody>
      ${S.db.competitions.map((c) => {
        const d = daysUntil(c.deadline);
        const entries = S.db.projects.filter((p) => p.competitionId === c.id && p.status !== 'draft');
        return html`<tr>
          <td><b>${c.short}</b><br><span class="muted small">${c.name}</span></td>
          <td class="small">${c.hkRound}${c.via ? html`<br><span class="muted">via ${S.comp(c.via).short}</span>` : ''}</td>
          <td class="small ${d !== null && d < 21 && d >= 0 ? 'tone-bad-text' : ''}">${c.deadline ? html`${date(c.deadline)}<br>${d < 0 ? 'passed' : `${d} days`}` : c.deadlineWindow || 'TBC'}</td>
          <td>${quotaBar(c.id)}</td>
          <td class="small">${entries.length ? entries.map((p) => html`<a href="#/project/${p.id}">${p.title}</a> <span class="muted">(${RCP.STATUS[p.status].label})</span><br>`) : html`<span class="muted">—</span>`}</td>
          ${role === 'committee' ? html`<td>${c.places !== null ? html`<form data-form="places" data-comp="${c.id}" class="inline-form"><input type="number" name="places" min="0" max="20" value="${c.places}" aria-label="Places for ${c.short}"><button class="btn small ghost">Save</button></form>` : ''}</td>` : ''}
        </tr>`;
      })}
      </tbody></table></div>`;
  }

  function viewRegister() {
    const P = S.db.projects.filter((p) => p.status !== 'draft');
    return html`
      <div class="page-head"><div><h1>Register</h1><p class="muted">School entries and their current status.</p></div><button class="btn ghost" data-act="csv">Export CSV</button></div>
      <div class="panel table-wrap"><table class="table"><thead><tr><th>Project</th><th>Track</th><th>Team</th><th>Teacher</th><th>Mentor</th><th>Status</th><th>Logs</th></tr></thead><tbody>
      ${P.map((p) => { const due = S.logDue(p); return html`<tr>
        <td><a href="#/project/${p.id}">${p.title}</a></td><td class="small">${trackLabel(p)}</td>
        <td class="small">${p.members.map(S.displayName).join(', ')}</td>
        <td class="small">${p.teacherId ? S.displayName(p.teacherId) : '—'}</td>
        <td class="small">${p.mentorId ? S.displayName(p.mentorId) : '—'}</td>
        <td>${badge(p.status)}</td>
        <td class="small ${due && due.overdue ? 'tone-bad-text' : ''}">${p.logs.length}${due && due.overdue ? ' · overdue' : ''}</td></tr>`; })}
      </tbody></table></div>`;
  }

  function viewEligibility() {
    const rows = [];
    for (const o of S.db.postings) for (const a of o.applications) if (['shortlisted', 'placed', 'ineligible'].includes(a.status)) rows.push({ o, a });
    return html`
      <div class="page-head"><div><h1>Eligibility checks</h1><p class="muted">Confirm shortlisted applicants and assign a teacher-in-charge.</p></div></div>
      ${rows.length ? html`<div class="cards">${rows.map(({ o, a }) => html`
        <div class="card">
          <div class="card-top"><span class="track">${o.title}</span><span class="badge tone-${a.status === 'placed' ? 'good' : a.status === 'ineligible' ? 'bad' : 'warn'}">${a.status}</span></div>
          <h3>${S.displayName(a.studentId)}</h3>
          <p class="small"><b>CV:</b> ${a.cv}</p><p class="small"><b>Coursework:</b> ${a.coursework}</p>
          ${a.status === 'shortlisted' ? html`<form data-form="eligibility" data-posting="${o.id}" data-app="${a.id}" class="inline-form">
            <select name="teacherId" required aria-label="Teacher-in-charge"><option value="">Teacher-in-charge…</option>${S.usersWith('teacher').map((u) => html`<option value="${u.id}">${S.displayName(u.id)}</option>`)}</select>
            <button class="btn small ghost" name="choice" value="no" formnovalidate>Not eligible</button><button class="btn small" name="choice" value="yes">Confirm</button></form>` : ''}
        </div>`)}</div>` : empty('No shortlisted applicants to check.')}`;
  }

  // ---------- Old Boy postings ----------
  function viewPostings(me, role) {
    let list = role === 'mentor' ? S.db.postings.filter((o) => o.by === me.id) : S.db.postings.filter((o) => o.status === 'open');
    if (role === 'student') list = list.filter((o) => audienceOk(o, me));
    return html`
      <div class="page-head"><div><h1>${role === 'mentor' ? 'My posted projects' : 'Old Boy projects'}</h1><p class="muted">${role === 'mentor' ? 'Problems you have posted for students to take on.' : 'Research opportunities offered by Old Boys.'}</p></div>${role === 'mentor' ? html`<a class="btn" href="#/postings/new">Post a project</a>` : ''}</div>
      ${list.length ? html`<div class="cards">${list.map((o) => html`
        <a class="card" href="#/postings/${o.id}">
          <div class="card-top"><span class="track">${o.org}</span><span class="badge tone-good">${o.places} places</span></div>
          <h3>${o.title}</h3><p class="small muted clamp">${o.description}</p>
          <div class="card-foot small"><span>${o.hours} · ${o.duration}</span><span>Posted by ${S.displayName(o.by)}</span>${o.audience && o.audience !== 'all' ? html`<span class="badge tone-warn">${audienceLabel(o.audience)}</span>` : ''}${role === 'mentor' ? html`<span>${o.applications.length} applicant${o.applications.length === 1 ? '' : 's'}</span>` : ''}</div>
        </a>`)}</div>` : empty(role === 'mentor' ? 'You have not posted a project yet.' : role === 'student' ? 'No open projects for your year level right now — check back soon.' : 'No open projects right now.', role === 'mentor' ? '#/postings/new' : null, 'Post a project')}`;
  }

  function viewPosting(me, role, id) {
    const o = S.posting(id);
    if (!o) return empty('Not found.', '#/postings', 'Back');
    if (role === 'student' && !audienceOk(o, me)) return empty(`This project is aimed at ${audienceLabel(o.audience)} students, so it isn't open to you.`, '#/postings', 'Back');
    const mineApp = o.applications.find((a) => a.studentId === me.id);
    return html`
      <a class="back" href="#/postings">← Back</a>
      <div class="page-head"><div><div class="track">${o.org}</div><h1>${o.title}</h1><p class="muted">Posted by ${S.displayName(o.by)} · ${ago(o.createdAt)}</p></div></div>
      <div class="grid-2">
        <section class="panel">
          <p class="pre">${o.description}</p>
          ${(o.files || []).length ? html`<h4>Attached files</h4><ul class="files">${o.files.map((f) => html`<li><button class="file-chip" data-act="download" data-file="${f.id}">${f.name}</button><span class="muted small">${size(f.size)} · ${S.user(f.by) ? S.user(f.by).name : ''}</span></li>`)}</ul>` : ''}
          <dl class="kv"><dt>Places</dt><dd>${o.places}</dd><dt>Open to</dt><dd>${audienceLabel(o.audience)}</dd><dt>Time needed</dt><dd>${o.hours} for ${o.duration}</dd><dt>Looking for</dt><dd>${o.requirements}</dd><dt>Check-ins</dt><dd>Every 2 months, on the platform</dd></dl>
        </section>
        <aside class="side">
          ${role === 'student' ? (mineApp ? html`<div class="panel"><h3>Your application</h3><p>Status: <b>${mineApp.status}</b></p><p class="small muted">Sent ${ago(mineApp.at)}.</p></div>` : html`
            <form class="panel" data-form="apply-posting">
              <h3>Apply</h3>
              <label class="field"><span>CV highlights</span><textarea name="cv" rows="4" required placeholder="Relevant clubs, competitions, projects"></textarea></label>
              <label class="field"><span>Relevant coursework</span><textarea name="coursework" rows="3" required></textarea></label>
              <button class="btn">Send application</button>
            </form>`) : ''}
          ${o.by === me.id ? html`<div class="panel"><h3>Applicants (${o.applications.length})</h3>
            ${o.applications.length ? o.applications.map((a) => html`
              <div class="applicant">
                <div class="tl-head">${people([a.studentId])}<span class="badge tone-${a.status === 'pending' ? 'warn' : a.status === 'declined' || a.status === 'ineligible' ? 'bad' : 'good'}">${a.status}</span></div>
                <p class="small"><b>CV:</b> ${a.cv}</p><p class="small"><b>Coursework:</b> ${a.coursework}</p>
                ${a.status === 'pending' ? html`<div class="form-actions"><button class="btn small ghost" data-act="shortlist" data-app="${a.id}" data-yes="0">Decline</button><button class="btn small" data-act="shortlist" data-app="${a.id}" data-yes="1">Shortlist</button></div>` : ''}
              </div>`) : html`<p class="muted small">No applicants yet.</p>`}</div>` : ''}
        </aside>
      </div>`;
  }

  function viewNewPosting() {
    return html`
      <div class="page-head"><div><h1>Post a project</h1><p class="muted">Invite students to work on a project from your organisation.</p></div></div>
      <form class="panel wizard" data-form="new-posting">
        <label class="field"><span>Title</span><input name="title" required maxlength="120"></label>
        <label class="field"><span>Organisation <small>(can be described generally)</small></span><input name="org" required maxlength="120"></label>
        <label class="field"><span>The problem and what students would do</span><textarea name="description" rows="6" required></textarea></label>
        <div class="row">
          <label class="field"><span>Places</span><input type="number" name="places" min="1" max="10" value="2" required></label>
          <label class="field"><span>Time needed</span><input name="hours" value="3 h / week" required></label>
          <label class="field"><span>Duration</span><input name="duration" value="4 months" required></label>
        </div>
        <label class="field"><span>Looking for</span><input name="requirements" placeholder="Skills, form level" required></label>
        <label class="field"><span>Target audience</span>
          <select name="audience">${AUDIENCES.map(([k, label]) => html`<option value="${k}">${label}</option>`)}</select></label>
        <label class="field"><span>Attach brief or resources <small>(optional) — project brief, specs or sample data students can look at</small></span><input type="file" name="files" multiple></label>
        <div class="form-actions"><span></span><button class="btn">Post project</button></div>
      </form>`;
  }

  function viewPropose(me) {
    return html`
      <a class="back" href="#/">← Back</a>
      <div class="page-head"><div><h1>Propose a project</h1><p class="muted">Put forward a project as teacher-in-charge for committee approval.</p></div></div>
      <form class="panel wizard" data-form="teacher-project">
        <label class="field"><span>Project title</span><input name="title" required maxlength="120" placeholder="A clear, specific title"></label>
        <label class="field"><span>Outline <small>What the students will build or investigate, and what it's for (100–250 words)</small></span><textarea name="abstract" rows="6" required></textarea></label>
        <p class="muted small">Tick the students taking part</p>
        <div class="check-grid">${S.usersWith('student').map((u) => html`<label class="check"><input type="checkbox" name="members" value="${u.id}">${avatar(u.id)} ${u.name} <span class="muted small">${u.form}</span></label>`)}</div>
        <label class="field"><span>Track</span>
          <select name="competitionId"><option value="">School-based / industry project</option>${S.db.competitions.map((c) => html`<option value="${c.id}">${c.short} — ${c.name}</option>`)}</select></label>
        <label class="field"><span>Company or partner <small>(if any, and no competition chosen)</small></span><input name="partner" maxlength="120" placeholder="e.g. a PRISM partner"></label>
        <label class="field"><span>Team's relevant experience</span><textarea name="experience" rows="3" required></textarea></label>
        <label class="field"><span>Old Boy mentor <small>(optional)</small></span>
          <select name="mentorId"><option value="">None yet</option>${S.usersWith('mentor').map((u) => html`<option value="${u.id}">${u.name}${u.title ? ' — ' + u.title : ''}</option>`)}</select></label>
        <div class="form-actions"><span></span><button class="btn">Send to committee</button></div>
      </form>`;
  }

  // ---------- competitions (slide 6–7) ----------
  function viewCompetitions() {
    const tiers = [
      [1, 'Tier 1 · Very high-profile', 'The flagship international entries. Places are few and set by the committee; apply early.'],
      [2, 'Tier 2 · Other research competitions', 'Strong options with more places — good first external entries.'],
      [3, 'Case by case', 'Anything else worth entering under the DBS name; propose it and the committee will look.'],
    ];
    const byDeadline = (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999');
    return html`
      <div class="page-head"><div><h1>Competitions</h1><p class="muted">Competition dates from the proposal, placed in the 2026–27 planning year. Open Calendar for milestones and preparation; current organiser dates still need confirmation.</p></div><a class="btn" href="#/apply">Apply</a></div>
      ${tiers.map(([tier, title, blurb]) => {
        const list = S.db.competitions.filter((c) => c.tier === tier).sort(byDeadline);
        if (!list.length) return '';
        return html`
          <h2>${title}</h2>
          <p class="muted small">${blurb}</p>
          <div class="cards">${list.map((c) => {
            const d = daysUntil(c.deadline);
            return html`
              <div class="card">
                <div class="card-top"><span class="track">${c.short}</span>
                  ${d !== null ? html`<span class="small ${d < 0 ? 'muted' : d < 21 ? 'tone-bad-text' : 'muted'}">${d < 0 ? 'Deadline passed' : `${d} days left`}</span>` : html`<span class="muted small">Dates TBC</span>`}
                </div>
                <h3>${c.name}</h3>
                <dl class="kv small">
                  <dt>Deadline</dt><dd>${c.deadline ? date(c.deadline) : c.deadlineWindow || 'TBC'}${c.via ? html` <span class="muted">· via ${S.comp(c.via).short}</span>` : ''}</dd>
                  <dt>Hong Kong round</dt><dd>${c.hkRound}</dd>
                  <dt>Final</dt><dd>${c.final}</dd>
                </dl>
                ${quotaBar(c.id)}
              </div>`;
          })}</div>`;
      })}`;
  }

  function viewCalendar(me, role) {
    const all = RCP.CALENDAR_EVENTS;
    const events = all.filter(e => calendarCompetition === 'all' || e.comp === calendarCompetition);
    const visible = S.db.projects.filter(p => canSee(p, me, role));
    const logProjects = visible.filter(p => S.logDue(p) && (calendarCompetition === 'all' || p.competitionId === calendarCompetition)).sort((a,b) => S.logDue(a).due - S.logDue(b).due);
    const sortDate = e => e.date || (e.month || e.months?.[0] ? `${(e.month || e.months[0]) >= 9 ? 2026 : 2027}-${String(e.month || e.months[0]).padStart(2,'0')}-01` : '9999');
    const ordered = [...events].sort((a,b) => sortDate(a).localeCompare(sortDate(b)));
    const due = {};
    for (const e of events) if(e.date) {
      for(let d = e.date; d <= (e.end || e.date);) {
        (due[d] ||= []).push(e);
        const next = new Date(d + 'T12:00:00Z'); next.setUTCDate(next.getUTCDate()+1); d = next.toISOString().slice(0,10);
      }
    }
    const today = todayIso();
    const months = Array.from({length:12}, (_,i) => new Date(2026,8+i,1));
    return html`
      <div class="page-head"><div><h1>Calendar 2026–27</h1><p class="muted">What is due, what to prepare and when your next project update is needed.</p></div></div>
      <div class="calendar-source small"><b>Checked against CMS Proposal v3, slides 6–9.</b> Dates without a year are placed in this planning year. Month windows remain approximate; exact current-year organiser dates need confirmation. Preparation below is a suggested platform checklist based on slides 11 and 13, rather than a list of organiser requirements.</div>
      <div class="calendar-tools">
        <div class="role-tabs" aria-label="Calendar view"><button data-act="calendar-mode" data-mode="agenda" class="${calendarMode === 'agenda' ? 'on' : ''}" aria-pressed="${calendarMode === 'agenda'}">Deadlines &amp; preparation</button><button data-act="calendar-mode" data-mode="months" class="${calendarMode === 'months' ? 'on' : ''}" aria-pressed="${calendarMode === 'months'}">Month view</button></div>
        <label class="field"><span>Competition</span><select data-act="calendar-filter"> <option value="all">All competitions and industry projects</option>${S.db.competitions.map(c => html`<option value="${c.id}" ${calendarCompetition === c.id ? raw('selected') : ''}>${c.short}</option>`)}</select></label>
      </div>
      <section class="panel calendar-logs"><h2>Project updates due</h2><p class="small muted">${role === 'committee' ? 'All active projects.' : 'Projects available to your account.'} Upload a progress log and supporting files on the project page.</p>
        ${logProjects.length ? html`<ul class="plain">${logProjects.map(p => {const next = S.logDue(p);return html`<li><div><a href="#/project/${p.id}">${p.title}</a><span class="small muted">${S.cadenceLabel(p)}</span></div><span class="small ${next.overdue ? 'tone-bad-text' : ''}">${date(new Date(next.due).toISOString())}${next.overdue ? ' · overdue' : ''}</span></li>`;})}</ul>` : html`<p class="small muted">No active project updates due for this selection.</p>`}
      </section>
      ${calendarMode === 'months' ? html`
        <div class="legend small"><span><i class="cal-key"></i> Dated milestone — select it for preparation</span><span><i class="cal-key today"></i> Today</span></div>
        <div class="cal-year">${months.map(m => {
          const y=m.getFullYear(), mo=m.getMonth();
          const lead=(new Date(y,mo,1).getDay()+6)%7, len=new Date(y,mo+1,0).getDate();
          const cells=[...Array(lead).fill(null),...Array.from({length:len},(_,i)=>i+1)];while(cells.length%7)cells.push(null);
          const windows=events.filter(e=>!e.date && (e.month===mo+1 || e.months?.includes(mo+1)));
          return html`<div class="cal-month-card"><h4>${m.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h4><table class="cal-grid"><thead><tr>${['M','T','W','T','F','S','S'].map(d=>html`<th>${d}</th>`)}</tr></thead><tbody>${chunk(cells,7).map(week=>html`<tr>${week.map(d=>{
            if(!d)return html`<td class="pad"></td>`;
            const iso=`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;const list=due[iso];
            return html`<td class="${list?'due':''}${iso===today?' today':''}"><span class="cal-day">${d}</span>${list?list.map(e=>html`<button class="cal-due" data-act="calendar-open" data-event="${e.id}" aria-label="${S.comp(e.comp).short}: ${e.label}, ${e.when}">${S.comp(e.comp).short}</button>`):''}</td>`;
          })}</tr>`)}</tbody></table>${windows.length?html`<ul class="calendar-windows">${windows.map(e=>html`<li><button class="link" data-act="calendar-open" data-event="${e.id}">${S.comp(e.comp).short}: ${e.label}</button><span>${e.when} · day not specified</span></li>`)}</ul>`:''}</div>`;
        })}</div>
        <section class="panel"><h3>Dates to confirm</h3><ul class="plain">${events.filter(e=>!e.date&&!e.month&&!e.months).map(e=>html`<li><button class="link" data-act="calendar-open" data-event="${e.id}">${S.comp(e.comp).short}: ${e.label}</button> <span class="small muted">${e.when}</span></li>`)}</ul></section>
      ` : html`
        <h2>Competition milestones</h2><p class="small muted">Open a milestone to see its preparation checklist. Ticks are saved for your demo account and do not submit an entry or grant approval.</p>
        <div class="calendar-agenda">${ordered.map(e=>{
          const c=S.comp(e.comp), tasks=RCP.CALENDAR_PREP[e.kind], entries=visible.filter(p=>p.competitionId===e.comp);
          const completed=tasks.filter((t,i)=>S.calendarChecked(me.id,e.id,i)).length;
          return html`<details class="calendar-event" id="calendar-${e.id}"><summary><span class="calendar-when">${e.when}${e.date?html`<small>${daysUntil(e.end||e.date)<0?'Past milestone':daysUntil(e.date)<0?'Under way':`${daysUntil(e.date)} days to start`}</small>`:html`<small>${e.month||e.months?'Date window':'Date to confirm'}</small>`}</span><span><b>${c.short}</b><span>${e.label}</span></span><span class="small muted">${completed}/${tasks.length} prepared</span></summary>
          <div class="calendar-event-body"><p class="small muted">Schedule: proposal slide ${e.slide}. ${e.comp==='isef'&&e.kind==='final'?'Los Angeles, USA.':''}</p><h3>Before ${e.kind==='registration'&&e.id.endsWith('open')?'registering':'this milestone'}</h3>
          <div class="calendar-prep">${tasks.map((task,i)=>html`<label><input type="checkbox" data-act="calendar-check" data-event="${e.id}" data-index="${i}" ${S.calendarChecked(me.id,e.id,i)?raw('checked'):''}><span>${task}</span></label>`)}</div>
          <p class="small muted">Confirm the required forms, file formats and submission time with the organiser; the deck does not specify them.</p>
          ${entries.length?html`<h4>Your visible entries</h4><ul class="plain">${entries.map(p=>html`<li><a href="#/project/${p.id}">${p.title}</a> ${badge(p.status)}</li>`)}</ul>`:html`<p class="small muted">No entries for this competition in your workspace.</p>`}
          ${role==='committee'?html`<a class="small" href="#/quota">Check school places</a>`:role==='student'?html`<a class="small" href="#/apply">Start an application</a>`:''}
          </div></details>`;
        })}</div>
      `}`;
  }

  // ---------- mail + audit ----------
  function viewMail(me, role) {
    const list = S.inbox(me, role);
    return html`
      <div class="page-head"><div><h1>Mail</h1><p class="muted">Application decisions and project updates sent to this demo account.</p></div></div>
      ${list.length ? html`<div class="mail">${list.map((m) => html`
        <article class="mail-item ${m.read ? '' : 'unread'}">
          <div class="tl-head"><b>${m.subject}</b><span class="muted small">${ago(m.at)}${m.to === 'committee' ? ' · to committee' : ''}</span></div>
          <p class="small">${m.body}</p>
          ${m.action ? html`<a class="btn small" href="${m.action.href}" data-act="read" data-mail="${m.id}">${m.action.label}</a>` : ''}
        </article>`)}</div>` : empty('No mail.')}`;
  }

  function auditList(items) {
    return html`<ul class="audit">${items.map((a) => html`<li><span class="muted small">${new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> <b>${S.user(a.by) ? S.user(a.by).name : a.by}</b> ${a.text}</li>`)}</ul>`;
  }
  function viewAudit() {
    return html`<div class="page-head"><div><h1>Audit log</h1><p class="muted">Every action on the platform, newest first.</p></div></div><div class="panel">${auditList(S.db.audit)}</div>`;
  }

  // ---------- demo walkthrough ----------
  const DEMOS = [
    ['Application draft', 'Continue the air quality proposal through all six steps and submit it. Switch to Dr. Lam Mei Ling’s teacher account to review the request in Mail.', 'ethan', 'student', '#/apply/demo-draft', 'A saved draft and an endorsement request in the teacher’s Mail.'],
    ['Return and resubmit', 'Read the teacher’s requested changes on the solar charging proposal, then revise and submit it again.', 'ryan', 'student', '#/project/demo-returned', 'The status changes from Returned by teacher to Awaiting teacher endorsement.'],
    ['Teacher endorsement', 'Open the airflow application, download the evidence and choose Endorse or Return with comments.', 'ksm', 'teacher', '#/endorse/p-schlieren', 'An endorsed application appears in the committee’s review queue. A returned one goes back to the student.'],
    ['Committee review and mentor', 'Review the rain-aware walking routes application, choose a mentor and approve it.', 'kwc', 'committee', '#/review/p-rain', 'An active project, one more Samsung SFT place taken and notifications to the team and mentor.'],
    ['Full competition', 'Try approving the leaf disease application while both Geneva places are taken. Increase Geneva places to 3 on the Quota tracker and try again.', 'kwc', 'committee', '#/review/demo-full', 'Approval is blocked before the quota increases; afterwards the entry can be approved.'],
    ['Logs and attachments', 'Post an update on the pond logger and attach a file. Reload the page and download the uploaded file.', 'ethan', 'student', '#/project/demo-active', 'The log and attachment remain after reload and the next update is due in one month (demo policy).'],
    ['Mentor feedback', 'Read the pond logger’s measurements and add feedback to its progress log.', 'kho', 'mentor', '#/project/demo-active', 'The comment appears below the log and in Ethan’s Mail.'],
    ['Final submission', 'Upload a final report on the pond logger, then mark the final submission done.', 'ethan', 'student', '#/project/demo-active', 'The project changes to Final submitted and a result can be recorded.'],
    ['Record a result', 'The vibration monitor already has a sample final report. Record a result for it.', 'marcus', 'student', '#/project/demo-submitted', 'The project becomes Completed and its result appears in the register export.'],
    ['Completed and declined entries', 'Inspect the completed microplastics project and the recycling sorter that was not approved.', 'kwc', 'committee', '#/register', 'Decisions, mentor feedback, downloadable files and the completed result remain available.'],
    ['Old Boy recruitment', 'Download the construction project brief and shortlist Ryan. Use Dean Cho’s committee account under Eligibility to confirm him and name a teacher.', 'david', 'mentor', '#/postings/o-vision', 'A team project is created with David as mentor; further confirmed students join the same project.'],
    ['Year-level targeting', 'Browse postings as Ryan, then as Aaron. Ryan sees the junior robot project; Aaron sees the senior carbon dashboard.', 'ryan', 'student', '#/postings', 'The lists and direct posting links respect the selected account’s year level.'],
    ['Post an opportunity', 'Create a project with a brief, available places and a target year group.', 'isaac', 'mentor', '#/postings/new', 'Students in that year group can apply and their applications appear under the posting.'],
    ['Teacher proposal', 'Propose a project with students and an optional mentor. The campus heat survey is also ready for committee review.', 'wkh', 'teacher', '#/propose', 'Teacher proposals go directly to committee review without a separate endorsement step.'],
    ['Competition dates', 'Open the competition list and calendar, then compare the ISEF registration deadline.', 'ethan', 'student', '#/competitions', 'The same sample deadline appears on the competition card and the calendar.'],
    ['Register and export', 'Export the register as CSV and compare its statuses and results with the table.', 'kwc', 'committee', '#/register', 'The download includes each entry’s team, teacher, mentor, decision, log count and result.'],
    ['Mail and audit', 'Open notifications and follow a project link, then check the Audit log after making a decision or posting a log.', 'kwc', 'committee', '#/mail', 'Notifications open the relevant page and the audit records who acted and when.'],
    ['Overdue updates', 'Inspect the domain monitoring project and its overdue update on the teacher overview.', 'cal', 'teacher', '#/project/p-pwc', 'The project shows its next monthly update date (demo policy); posting a new log restarts the interval.'],
  ];
  function viewDemo() {
    return html`<div class="page-head"><div><h1>Try the demo</h1><p class="muted">Choose an example to open the account and page needed for the task.</p></div><a class="btn ghost" href="#/">Back to workspace</a></div>
      <div class="demo-intro"><p>These examples use fictional proposals and files. Changes are saved in this browser, so you can switch accounts to follow an application through the process.</p><p class="small muted">Sign-in uses demo accounts and Mail simulates email delivery. Use Reset demo data in the footer to start again.</p></div>
      <ol class="demo-list">${DEMOS.map(([title, instruction, user, role, href, proof], i) => html`<li><span class="demo-number">${i+1}</span><div><h3>${title}</h3><p>${instruction}</p><p class="small muted"><b>Check:</b> ${proof}</p></div><button class="btn ghost small" data-act="demo-open" data-user="${user}" data-role="${role}" data-href="${href}">Open as ${S.user(user).name}</button></li>`)}</ol>`;
  }

  // ---------- showing a file ----------
  /* Some viewers block downloads from the page, so a file is shown here and offered for download. */
  async function showBlob(name, blob) {
    const box = document.getElementById('filebox');
    const isText = /^text\/|json|csv|xml/.test(blob.type || '') || /\.(txt|csv|md|json|log)$/i.test(name);
    const body = isText ? await blob.text() : null;
    const url = URL.createObjectURL(blob);
    box.innerHTML = html`
      <div class="filebox-back" data-act="file-close"></div>
      <div class="filebox-panel" role="dialog" aria-label="${name}">
        <div class="panel-head"><h3>${name}</h3><span class="muted small">${size(blob.size)}${blob.type ? ' · ' + blob.type : ''}</span></div>
        ${body !== null ? html`<pre class="filebox-body">${body}</pre>` : html`<p class="muted small">This file type cannot be shown here. Download it to open it.</p>`}
        <div class="form-actions">
          <span>${body !== null ? html`<button class="btn ghost small" data-act="file-copy">Copy contents</button>` : ''}</span>
          <span class="flex"><a class="btn small ghost" href="${url}" download="${name}">Download</a><button class="btn small" data-act="file-close">Close</button></span>
        </div>
      </div>`.s;
    box.hidden = false;
    box.dataset.text = body === null ? '' : body;
    const close = () => URL.revokeObjectURL(url);
    setTimeout(close, 120000);
  }
  function closeFile() { const box = document.getElementById('filebox'); box.hidden = true; box.innerHTML = ''; }

  // ---------- router ----------
  function route() {
    const hash = location.hash || '#/';
    const me = S.me();
    const role = S.role();
    if (!me || !role || !me.roles.includes(role)) {
      if (hash === '#/demo') {
        root.innerHTML = html`<main class="page"><a class="back" href="#/">← Sign in</a>${viewDemo()}</main><footer class="foot"><button class="link" data-act="reset">Reset demo data</button></footer>`.s;
        return;
      }
      root.innerHTML = viewLogin().s;
      return;
    }
    const parts = hash.slice(2).split('/');
    let body;
    const guard = (roles, fn) => (roles.includes(role) ? fn() : empty('This page is for ' + roles.map((r) => ROLE_LABEL[r].toLowerCase()).join(' and ') + ' accounts.', '#/', 'Back'));
    switch (parts[0]) {
      case '': body = { student: viewStudentHome, teacher: viewTeacherHome, mentor: viewMentorHome, committee: viewCommitteeHome }[role](me); break;
      case 'apply': body = guard(['student'], () => viewApply(me, parts[1])); break;
      case 'project': body = viewProject(me, role, parts[1]); break;
      case 'endorse': body = guard(['teacher'], () => {
        if (!parts[1]) return viewEndorseList(me);
        const p = S.project(parts[1]);
        if (!p || p.teacherId !== me.id) return empty('This application was not sent to you.', '#/endorse', 'Back');
        if (p.status !== 'endorsement') return viewProject(me, role, p.id);
        return decisionPage(p, 'endorse');
      }); break;
      case 'review': body = guard(['committee'], () => {
        if (!parts[1]) return viewReviewQueue();
        const p = S.project(parts[1]);
        if (!p) return empty('Not found.', '#/review', 'Back');
        return p.status === 'review' ? decisionPage(p, 'review') : viewProject(me, role, p.id);
      }); break;
      case 'quota': body = viewQuota(role); break;
      case 'register': body = guard(['committee'], viewRegister); break;
      case 'eligibility': body = guard(['committee'], viewEligibility); break;
      case 'postings': body = parts[1] === 'new' ? guard(['mentor'], viewNewPosting) : parts[1] ? viewPosting(me, role, parts[1]) : viewPostings(me, role); break;
      case 'propose': body = guard(['teacher'], () => viewPropose(me)); break;
      case 'competitions': body = viewCompetitions(); break;
      case 'calendar': body = viewCalendar(me, role); break;
      case 'mail': body = viewMail(me, role); break;
      case 'demo': body = viewDemo(); break;
      case 'audit': body = guard(['committee'], viewAudit); break;
      default: body = empty('Page not found.', '#/', 'Home');
    }
    root.innerHTML = shell(me, role, hash, body).s;
    flash = null;
    window.scrollTo(0, 0);
  }

  // ---------- events ----------
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT') return;
    const act = el.dataset.act;
    const me = S.me();
    const hash = location.hash;
    if (act === 'calendar-mode') { calendarMode = el.dataset.mode; route(); }
    else if (act === 'calendar-open') { calendarMode = 'agenda'; route(); const target = document.getElementById('calendar-' + el.dataset.event); if(target) {target.open = true; target.scrollIntoView({block:'start'});} }
    else if (act === 'login-role') { loginRole = el.dataset.role; route(); }
    else if (act === 'demo-open') { S.signIn(el.dataset.user, el.dataset.role); wizard = null; location.hash = el.dataset.href; route(); }
    else if (act === 'signin') { S.signIn(el.dataset.user, el.dataset.role); wizard = null; location.hash = '#/'; route(); }
    else if (act === 'signout') { S.signOut(); wizard = null; location.hash = '#/'; route(); }
    else if (act === 'reset') {
      if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.textContent = 'Reset — click again to confirm'; setTimeout(() => { el.dataset.armed = '0'; el.textContent = 'Reset demo data'; }, 5000); return; }
      S.reset(); S.signOut(); wizard = null; location.hash = '#/'; location.reload();
    }
    else if (act === 'wiz-back') { readWizard(el.closest('form')); wizard.step--; route(); }
    else if (act === 'read') { S.markRead(el.dataset.mail); }
    else if (act === 'final') { S.submitFinal(hash.split('/')[2], me.id); notify('Final submission recorded and notifications added to Mail.'); route(); }
    else if (act === 'shortlist') { S.shortlist(hash.split('/')[2], el.dataset.app, me.id, el.dataset.yes === '1'); notify(el.dataset.yes === '1' ? 'Applicant sent to the committee for eligibility review.' : 'Applicant declined.'); route(); }
    else if (act === 'csv') {
      await showBlob('dbs-research-competitions-register.csv', new Blob([S.exportCsv()], { type: 'text/csv' }));
    } else if (act === 'download') {
      const blob = await S.getFile(el.dataset.file);
      if (!blob) { notify('That file is no longer stored in this browser.', 'bad'); route(); return; }
      const meta = [...S.db.projects.flatMap((p) => p.files), ...S.db.postings.flatMap((o) => o.files || [])].find((f) => f.id === el.dataset.file);
      await showBlob(meta ? meta.name : 'file', blob);
    } else if (act === 'file-close') { closeFile(); }
    else if (act === 'file-copy') {
      const text = document.getElementById('filebox').dataset.text || '';
      try { await navigator.clipboard.writeText(text); el.textContent = 'Copied'; setTimeout(() => { el.textContent = 'Copy contents'; }, 1500); }
      catch (err) {
        const pre = document.querySelector('.filebox-body');
        if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
        el.textContent = 'Selected — press Cmd/Ctrl+C';
      }
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-act=calendar-filter]')) { calendarCompetition = e.target.value; route(); }
    if (e.target.matches('[data-act=calendar-check]')) { S.setCalendarCheck(S.me().id, e.target.dataset.event, Number(e.target.dataset.index), e.target.checked); const box = e.target.closest('details'); const count = box.querySelector('summary > .small'); count.textContent = `${box.querySelectorAll('input:checked').length}/${box.querySelectorAll('input').length} prepared`; }
    if (e.target.matches('[data-act="switch-role"]') && e.target.value) {
      S.signIn(S.me().id, e.target.value); wizard = null; location.hash = '#/'; route();
    }
    if (e.target.closest('[data-form="wizard"]') && wizard && wizard.step === 0 && (e.target.name === 'stage' || e.target.name === 'competitionId')) {
      readWizard(e.target.closest('form')); route();
    }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const me = S.me();
    const fd = new FormData(form);
    const choice = e.submitter ? e.submitter.value : null;
    const projectId = form.dataset.project || location.hash.split('/')[2];
    try {
      switch (form.dataset.form) {
        case 'wizard': {
          readWizard(form);
          if (wizard.step === 4 && !wizard.teacherId) throw new Error('Choose a teacher to endorse this application.');
          const p = S.saveDraft(wizard, me.id);
          wizard.id = p.id;
          if (wizard.step === 3) for (const f of fd.getAll('expfiles')) if (f && f.size) await S.addFile(p.id, f, 'Experience evidence', me.id);
          if (wizard.step < STEPS.length - 1) { wizard.step++; }
          else { S.submit(p.id, me.id); wizard = null; notify(`Endorsement requested from ${S.displayName(p.teacherId)} in Mail.`); location.hash = `#/project/${p.id}`; return; }
          break;
        }
        case 'endorse': {
          S.endorse(projectId, me.id, choice === 'yes', fd.get('note').trim());
          notify(choice === 'yes' ? 'Endorsement sent to the committee.' : 'Returned to the students with your comments.');
          if (form.dataset.project && (location.hash === '#/' || location.hash === '')) route(); else location.hash = '#/endorse';
          return;
        }
        case 'review': S.decide(projectId, me.id, choice === 'yes', fd.get('note').trim(), fd.get('mentorId') || null); notify(choice === 'yes' ? 'Approval sent to the team and teacher in Mail.' : 'Decision recorded and the team notified.'); location.hash = '#/review'; return;
        case 'log': {
          const ids = [];
          for (const f of fd.getAll('files')) if (f && f.size) ids.push(await S.addFile(projectId, f, 'Progress log', me.id));
          S.addLog(projectId, me.id, fd.get('date'), fd.get('text'), ids);
          notify('Log posted.');
          break;
        }
        case 'comment': S.comment(projectId, form.dataset.log, me.id, fd.get('text')); notify('Feedback sent to the team.'); break;
        case 'upload': { const f = fd.get('file'); if (!f || !f.size) throw new Error('Choose a file first.'); await S.addFile(projectId, f, fd.get('category'), me.id); notify(`Uploaded ${f.name}.`); break; }
        case 'assign-mentor': if (!fd.get('mentorId')) throw new Error('Pick a mentor.'); S.assignMentor(projectId, fd.get('mentorId'), me.id); notify('Mentor assigned and emailed.'); break;
        case 'result': S.recordResult(projectId, me.id, fd.get('result')); notify('Result saved.'); break;
        case 'industry-followup': S.recommendIndustry(projectId, me.id, fd.get('note')); notify('Recommended for a long-term industry project; the team, teacher and mentor are notified.'); break;
        case 'places': S.setPlaces(form.dataset.comp, Number(fd.get('places')), me.id); notify('Places updated.'); break;
        case 'apply-posting': S.apply(projectId, me.id, fd.get('cv'), fd.get('coursework')); notify('Application sent to the Old Boy.'); break;
        case 'new-posting': {
          const o = S.post(me.id, { title: fd.get('title').trim(), org: fd.get('org').trim(), description: fd.get('description').trim(), places: Number(fd.get('places')), hours: fd.get('hours').trim(), duration: fd.get('duration').trim(), requirements: fd.get('requirements').trim(), audience: fd.get('audience') || 'all' });
          for (const f of fd.getAll('files')) if (f && f.size) await S.addPostingFile(o.id, f, me.id);
          notify('Project open to students in the selected year levels.'); location.hash = `#/postings/${o.id}`; return;
        }
        case 'teacher-project': {
          const members = fd.getAll('members');
          if (!members.length) throw new Error('Tick at least one student to take part.');
          const p = S.teacherProject(me.id, { title: fd.get('title'), abstract: fd.get('abstract'), members, competitionId: fd.get('competitionId') || null, partner: fd.get('partner') || '', experience: fd.get('experience'), mentorId: fd.get('mentorId') || null });
          notify('Project created and sent to the committee to ratify.');
          location.hash = `#/project/${p.id}`; return;
        }
        case 'eligibility': S.confirmEligibility(form.dataset.posting, form.dataset.app, me.id, choice === 'yes', fd.get('teacherId')); notify(choice === 'yes' ? 'Student placed on the project.' : 'Marked not eligible.'); break;
      }
    } catch (err) {
      notify(err.message || String(err), 'bad');
    }
    route();
  });

  window.addEventListener('hashchange', route);
  route();
})();
