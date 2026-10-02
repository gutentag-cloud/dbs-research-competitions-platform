/* State, persistence and every workflow action. Each action writes the audit trail
   and, where the proposal says someone is notified, a message to the simulated mailbox. */
window.RCP = window.RCP || {};

(function () {
  const KEY = 'rcp-db';
  const SESSION = 'rcp-session';
  let db = null;

  // Browsers block localStorage on some origins (e.g. file:// in Safari); fall back to memory.
  const safe = (() => {
    try { const t = window.localStorage; t.setItem('rcp-test', '1'); t.removeItem('rcp-test'); return t; }
    catch (e) {
      const m = new Map();
      return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
    }
  })();

  function load() {
    try {
      const raw = safe.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.version === RCP.SEED_VERSION) return RCP.applyCalendarProposal(RCP.addExamples(parsed));
    } catch (e) { /* fall through to seed */ }
    return RCP.applyCalendarProposal(RCP.seed());
  }
  function save() {
    try { safe.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('Could not save', e); }
  }
  db = load();
  save();

  const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 9);
  const nowIso = () => new Date().toISOString();

  // ---------- lookups ----------
  const S = {
    get db() { return db; },
    user: (id) => db.users.find((u) => u.id === id),
    comp: (id) => db.competitions.find((c) => c.id === id),
    project: (id) => db.projects.find((p) => p.id === id),
    posting: (id) => db.postings.find((p) => p.id === id),
    usersWith: (role) => db.users.filter((u) => u.roles.includes(role)),
    displayName(id) {
      const u = S.user(id);
      if (!u) return 'Unknown';
      return u.form ? `${u.name} (${u.form})` : u.initials ? `${u.name} (${u.initials})` : u.name;
    },
  };

  // ---------- session ----------
  S.session = function () {
    try { return JSON.parse(safe.getItem(SESSION)) || null; } catch (e) { return null; }
  };
  S.signIn = function (userId, role) {
    safe.setItem(SESSION, JSON.stringify({ userId, role }));
    S.log(userId, `signed in as ${role}`);
  };
  S.signOut = function () { safe.removeItem(SESSION); };
  S.me = function () { const s = S.session(); return s ? S.user(s.userId) : null; };
  S.role = function () { const s = S.session(); return s ? s.role : null; };

  // ---------- audit + mail ----------
  S.log = function (by, text, projectId) {
    db.audit.unshift({ at: nowIso(), by, text, projectId: projectId || null });
    db.audit = db.audit.slice(0, 500);
    save();
  };
  S.mail = function (to, subject, body, action) {
    const list = Array.isArray(to) ? to : [to];
    for (const t of list) db.mail.unshift({ id: uid('m'), to: t, from: 'system', at: nowIso(), subject, body, action: action || null, read: false });
    save();
  };
  S.inbox = function (user, role) {
    return db.mail.filter((m) => m.to === user.id || (m.to === 'committee' && role === 'committee'));
  };
  S.markRead = function (id) { const m = db.mail.find((x) => x.id === id); if (m) { m.read = true; save(); } };

  // ---------- quota ----------
  /** Places taken = approved and beyond; pending = still moving through endorsement/review. */
  S.quota = function (compId) {
    const c = S.comp(compId);
    const entries = db.projects.filter((p) => p.competitionId === compId);
    const taken = entries.filter((p) => ['active', 'submitted', 'completed'].includes(p.status)).length;
    const pending = entries.filter((p) => ['endorsement', 'review'].includes(p.status)).length;
    const places = c && c.places !== null ? c.places : null;
    return { places, taken, pending, left: places === null ? null : Math.max(0, places - taken), full: places !== null && taken >= places };
  };
  S.setPlaces = function (compId, places, by) {
    const c = S.comp(compId);
    c.places = places;
    S.log(by, `set ${c.short} places to ${places}`);
    save();
  };

  // ---------- logs cadence ----------
  // Slide 9: monthly student-led industry updates; Old Boy check-ins every two months.
  // The deck gives no interval for Stage 2 or teacher-led projects; monthly is the demo policy.
  S.cadenceLabel = p => p.origin === 'oldboy' ? 'Check-in every 2 months' : p.stage === 1 && p.origin === 'student' ? 'Monthly update' : 'Monthly update (demo policy)';
  S.logDue = function (p) {
    if (p.status !== 'active') return null;
    const last = p.logs.length ? Math.max(...p.logs.map(l => Date.parse(l.at))) : Date.parse(p.decision ? p.decision.at : p.createdAt);
    const base = new Date(last);
    // Clamp end-of-month dates rather than overflowing (31 January → 28 February).
    const target = new Date(last);
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + (p.origin === 'oldboy' ? 2 : 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(base.getUTCDate(), lastDay));
    const due = target.getTime();
    return { due, overdue: Date.now() > due, days: Math.ceil((due - Date.now()) / 86400000) };
  };
  S.setCalendarCheck = function(userId, eventId, index, checked) {
    const key = userId + ':' + eventId + ':' + index;
    (db.calendarChecks ||= {})[key] = checked;
    save();
  };
  S.calendarChecked = (userId, eventId, index) => !!db.calendarChecks?.[userId + ':' + eventId + ':' + index];

  // ---------- workflow actions ----------
  S.saveDraft = function (draft, by) {
    let p = draft.id ? S.project(draft.id) : null;
    if (!p) {
      p = { id: uid('p'), status: 'draft', createdAt: nowIso(), endorsement: null, decision: null, mentorId: null, logs: [], files: [], checklist: Object.fromEntries(RCP.ACCOUNTABILITY.map(([k]) => [k, false])) };
      db.projects.unshift(p);
    }
    Object.assign(p, {
      stage: draft.stage, origin: draft.origin || 'student', title: draft.title.trim(), abstract: draft.abstract.trim(),
      competitionId: draft.stage === 2 ? draft.competitionId : null, partner: draft.stage === 1 ? draft.partner.trim() : null,
      members: draft.members, teacherId: draft.teacherId || null, experience: draft.experience.trim(),
    });
    p.checklist.proposal = !!(p.title && p.abstract);
    p.checklist.experience = !!p.experience;
    save();
    return p;
  };

  S.submit = function (id, by) {
    const p = S.project(id);
    // The proposal asks the tracker to prevent duplicate applications: one live entry per
    // student per competition, so two teams do not enter the same competition unaware.
    if (p.competitionId) {
      const live = ['endorsement', 'review', 'active', 'submitted', 'completed'];
      const clash = db.projects.find((x) => x.id !== p.id && x.competitionId === p.competitionId
        && live.includes(x.status) && x.members.some((m) => p.members.includes(m)));
      if (clash) {
        const who = clash.members.filter((m) => p.members.includes(m)).map(S.displayName).join(', ');
        throw new Error(`${who} already has an entry in ${S.comp(p.competitionId).short}: “${clash.title}” (${RCP.STATUS[clash.status].label}). Withdraw or revise that entry instead of entering twice.`);
      }
    }
    p.status = 'endorsement';
    p.endorsement = null;
    const comp = p.competitionId ? S.comp(p.competitionId).short : 'Stage 1 industry project';
    S.mail(p.teacherId, `Endorsement requested: ${p.title}`,
      `${S.displayName(by)} has asked you to endorse a ${comp} application. Team: ${p.members.map(S.displayName).join(', ')}.`,
      { label: 'Review and endorse', href: `#/endorse/${p.id}` });
    S.log(by, `submitted proposal “${p.title}” (${comp}) and emailed ${S.displayName(p.teacherId)} to endorse`, p.id);
  };

  S.endorse = function (id, by, approve, note) {
    const p = S.project(id);
    if (approve) {
      p.status = 'review';
      p.endorsement = { by, at: nowIso(), note };
      p.checklist.endorsement = true;
      const q = p.competitionId ? S.quota(p.competitionId) : null;
      S.mail('committee', `Ready for committee review: ${p.title}`,
        `Endorsed by ${S.displayName(by)}.${q && q.places !== null ? ` ${S.comp(p.competitionId).short} places: ${q.taken} of ${q.places} taken.` : ''}`,
        { label: 'Open review', href: `#/review/${p.id}` });
      S.log(by, `endorsed “${p.title}”`, p.id);
    } else {
      p.status = 'returned';
      p.endorsement = { by, at: nowIso(), note, declined: true };
      S.log(by, `returned “${p.title}” to the students`, p.id);
    }
    S.mail(p.members, approve ? `Your teacher endorsed “${p.title}”` : `Changes requested on “${p.title}”`,
      `${S.displayName(by)}: ${note || (approve ? 'Endorsed.' : 'Please revise and resubmit.')}`,
      { label: 'Open project', href: `#/project/${p.id}` });
    save();
  };

  S.decide = function (id, by, approve, note, mentorId) {
    const p = S.project(id);
    if (approve && p.competitionId && S.quota(p.competitionId).full) throw new Error('No places left for this competition. Raise the quota or decline.');
    p.decision = { by, at: nowIso(), outcome: approve ? 'approved' : 'rejected', note };
    p.checklist.decision = true;
    if (approve) {
      p.status = 'active';
      if (mentorId) S.assignMentor(id, mentorId, by, true);
      S.log(by, `approved “${p.title}”${mentorId ? ` and assigned mentor ${S.displayName(mentorId)}` : ''}`, p.id);
    } else {
      p.status = 'rejected';
      S.log(by, `did not approve “${p.title}”`, p.id);
    }
    S.mail([...p.members, p.teacherId].filter(Boolean), approve ? `Approved: ${p.title}` : `Decision on ${p.title}`,
      `Committee decision by ${S.displayName(by)}: ${note || (approve ? 'Approved.' : 'Not approved this round.')}`,
      { label: 'Open project', href: `#/project/${p.id}` });
    save();
  };

  S.assignMentor = function (id, mentorId, by, quiet) {
    const p = S.project(id);
    p.mentorId = mentorId;
    p.checklist.mentor = true;
    S.mail(mentorId, `You're mentoring “${p.title}”`, `Assigned by ${S.displayName(by)}. Team: ${p.members.map(S.displayName).join(', ')}.`, { label: 'Open project page', href: `#/project/${p.id}` });
    if (!quiet) S.log(by, `assigned mentor ${S.displayName(mentorId)} to “${p.title}”`, p.id);
    save();
  };

  S.addLog = function (id, by, date, text, fileIds) {
    const p = S.project(id);
    p.logs.push({ id: uid('l'), date, by, at: nowIso(), text: text.trim(), files: fileIds || [], comments: [] });
    p.logs.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
    p.checklist.logs = true;
    if (p.mentorId) S.mail(p.mentorId, `New progress log: ${p.title}`, `${S.displayName(by)} posted an update dated ${date}.`, { label: 'Read log', href: `#/project/${p.id}` });
    S.log(by, `posted a progress log dated ${date} for “${p.title}”`, p.id);
  };

  S.comment = function (projectId, logId, by, text) {
    const p = S.project(projectId);
    const l = p.logs.find((x) => x.id === logId);
    l.comments.push({ by, at: nowIso(), text: text.trim() });
    S.mail(p.members, `Feedback on your log`, `${S.displayName(by)}: ${text.trim()}`, { label: 'Open project', href: `#/project/${p.id}` });
    S.log(by, `commented on the ${l.date} log of “${p.title}”`, p.id);
  };

  S.submitFinal = function (id, by) {
    const p = S.project(id);
    p.status = 'submitted';
    p.checklist.final = true;
    S.mail(['committee', p.teacherId, p.mentorId].filter(Boolean), `Final submission: ${p.title}`, `${S.displayName(by)} marked the final submission as done.`, { label: 'Open project', href: `#/project/${p.id}` });
    S.log(by, `marked the final submission for “${p.title}”`, p.id);
  };

  /** Stage 2, step 5 of the proposal: push a finished competition entry towards a long-term
      industry project, and tell the team, their teacher and the mentor. */
  S.recommendIndustry = function (id, by, note) {
    const p = S.project(id);
    p.industryFollowUp = { by, at: nowIso(), note: (note || '').trim() };
    S.mail([...p.members, p.teacherId, p.mentorId].filter(Boolean), `Taking “${p.title}” further`,
      `${S.displayName(by)} has recommended this entry for a long-term industry project.${p.industryFollowUp.note ? ' ' + p.industryFollowUp.note : ''}`,
      { label: 'Open project', href: `#/project/${p.id}` });
    S.log(by, `recommended “${p.title}” for a long-term industry project`, p.id);
    save();
  };

  S.recordResult = function (id, by, result) {
    const p = S.project(id);
    p.result = result.trim();
    p.status = 'completed';
    p.checklist.result = true;
    S.log(by, `recorded the result for “${p.title}”: ${p.result}`, p.id);
  };

  // ---------- Old Boy postings (slide 9, second flow) ----------
  S.post = function (by, data) {
    const o = { id: uid('o'), by, status: 'open', createdAt: nowIso(), applications: [], ...data };
    db.postings.unshift(o);
    S.log(by, `posted an industry project “${o.title}” (${o.places} places)`);
    return o;
  };
  S.apply = function (postingId, studentId, cv, coursework) {
    const o = S.posting(postingId);
    o.applications.push({ id: uid('a'), studentId, at: nowIso(), cv: cv.trim(), coursework: coursework.trim(), status: 'pending' });
    S.mail(o.by, `New applicant: ${o.title}`, `${S.displayName(studentId)} applied to your posted project.`, { label: 'See applicants', href: `#/postings/${o.id}` });
    S.log(studentId, `applied to “${o.title}”`);
  };
  /** Mentor shortlists; the committee then confirms eligibility, which creates the project. */
  S.shortlist = function (postingId, appId, by, accept) {
    const o = S.posting(postingId);
    const a = o.applications.find((x) => x.id === appId);
    a.status = accept ? 'shortlisted' : 'declined';
    if (accept) S.mail('committee', `Eligibility check: ${S.displayName(a.studentId)} for “${o.title}”`, `${S.displayName(by)} shortlisted this applicant.`, { label: 'Check eligibility', href: `#/eligibility` });
    S.mail(a.studentId, accept ? `Shortlisted: ${o.title}` : `Application update: ${o.title}`, accept ? 'The Old Boy shortlisted you. The committee will confirm eligibility.' : 'Thank you for applying. The places have gone to other applicants this time.', { label: 'Industry projects', href: '#/postings' });
    S.log(by, `${accept ? 'shortlisted' : 'declined'} ${S.displayName(a.studentId)} for “${o.title}”`);
  };
  S.confirmEligibility = function (postingId, appId, by, eligible, teacherId) {
    const o = S.posting(postingId);
    const a = o.applications.find((x) => x.id === appId);
    if (a.status !== 'shortlisted') throw new Error('This application has already been decided.');
    const existing = db.projects.find(x => x.postingId === o.id);
    if (eligible && existing && existing.members.length >= o.places) throw new Error('All places on this project have been filled.');
    if (eligible && !teacherId) throw new Error('Choose a teacher-in-charge.');
    a.status = eligible ? 'placed' : 'ineligible';
    if (eligible) {
      // One team project per posting: the first placed student creates it, later ones join it.
      let p = db.projects.find((x) => x.postingId === o.id);
      if (!p) {
        p = {
          id: uid('p'), postingId: o.id, stage: 1, origin: 'oldboy', title: o.title, partner: o.org, competitionId: null,
          abstract: o.description, members: [], teacherId: teacherId || null, mentorId: o.by, experience: a.cv,
          status: 'active', createdAt: nowIso(), endorsement: null,
          decision: { by, at: nowIso(), outcome: 'approved', note: 'Eligibility confirmed (Old Boy-initiated project).' },
          checklist: Object.fromEntries(RCP.ACCOUNTABILITY.map(([k]) => [k, ['proposal', 'experience', 'decision', 'mentor', 'endorsement'].includes(k)])),
          logs: [], files: [],
        };
        db.projects.unshift(p);
      }
      if (!p.members.includes(a.studentId)) p.members.push(a.studentId);
      S.mail(a.studentId, `You're on “${o.title}”`, 'Eligibility confirmed. Documentation check-ins are every 2 months on your project page.', { label: 'Open project page', href: `#/project/${p.id}` });
      S.log(by, `confirmed ${S.displayName(a.studentId)} as eligible for “${o.title}”`, p.id);
    } else {
      S.log(by, `found ${S.displayName(a.studentId)} not eligible for “${o.title}”`);
    }
    save();
  };

  // ---------- files (IndexedDB, with in-memory fallback) ----------
  let idb = null;
  const memory = new Map();
  const idbReady = new Promise((resolve) => {
    try {
      const req = indexedDB.open('rcp-files', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('blobs');
      req.onsuccess = () => { idb = req.result; resolve(); };
      req.onerror = () => resolve();
    } catch (e) { resolve(); }
  });
  S.storesFilesDurably = () => !!idb;

  const putBlob = async function (file) {
    await idbReady;
    const id = uid('f');
    if (idb) {
      await new Promise((res, rej) => {
        const tx = idb.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').put(file, id);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    } else memory.set(id, file);
    return id;
  };

  S.addFile = async function (projectId, file, category, by) {
    const id = await putBlob(file);
    const p = S.project(projectId);
    p.files.push({ id, name: file.name, size: file.size, type: file.type, category, by, at: nowIso() });
    S.log(by, `uploaded ${category.toLowerCase()} “${file.name}” to “${p.title}”`, p.id);
    return id;
  };
  /** Files attached to an Old Boy's project posting (brief, specs, sample data). */
  S.addPostingFile = async function (postingId, file, by) {
    const id = await putBlob(file);
    const o = S.posting(postingId);
    (o.files ||= []).push({ id, name: file.name, size: file.size, type: file.type, by, at: nowIso() });
    S.log(by, `attached “${file.name}” to posting “${o.title}”`);
    return id;
  };
  /** A teacher-in-charge initiates the project themselves; it goes to the committee to ratify. */
  S.teacherProject = function (by, d) {
    const p = {
      id: uid('p'), stage: d.competitionId ? 2 : 1, origin: 'teacher', title: d.title.trim(),
      partner: d.competitionId ? null : (d.partner.trim() || null), competitionId: d.competitionId || null,
      abstract: d.abstract.trim(), members: d.members, teacherId: by, mentorId: null, industryTutor: null,
      experience: d.experience.trim(), status: 'review', createdAt: nowIso(),
      endorsement: { by, at: nowIso(), note: 'Teacher-initiated project.' }, decision: null,
      checklist: Object.fromEntries(RCP.ACCOUNTABILITY.map(([k]) => [k, ['proposal', 'endorsement', 'experience'].includes(k)])),
      logs: [], files: [],
    };
    db.projects.unshift(p);
    if (d.mentorId) S.assignMentor(p.id, d.mentorId, by, true);
    S.mail('committee', `Ratify teacher-initiated project: ${p.title}`, `Initiated by ${S.displayName(by)}. Team: ${p.members.map(S.displayName).join(', ')}.`, { label: 'Open review', href: `#/review/${p.id}` });
    S.log(by, `initiated project “${p.title}” and sent it to the committee to ratify`, p.id);
    save();
    return p;
  };
  S.getFile = async function (id) {
    const sample = [...db.projects.flatMap(p => p.files), ...db.postings.flatMap(o => o.files || [])].find(f => f.id === id && f.sampleContent !== undefined);
    if (sample) return new Blob([sample.sampleContent], { type: sample.type });
    await idbReady;
    if (!idb) return memory.get(id) || null;
    return new Promise((res) => {
      const req = idb.transaction('blobs').objectStore('blobs').get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  };

  S.exportCsv = function () {
    const rows = [['Title', 'Stage', 'Competition / partner', 'Team', 'Teacher', 'Mentor', 'Status', 'Endorsed', 'Decision', 'Logs', 'Result']];
    for (const p of db.projects) {
      rows.push([p.title, p.stage === 1 ? 'Stage 1 industry' : 'Stage 2 competition', p.competitionId ? S.comp(p.competitionId).short : p.partner || '',
        p.members.map(S.displayName).join('; '), p.teacherId ? S.displayName(p.teacherId) : '', p.mentorId ? S.displayName(p.mentorId) : '',
        RCP.STATUS[p.status].label, p.endorsement && !p.endorsement.declined ? p.endorsement.at.slice(0, 10) : '',
        p.decision ? `${p.decision.outcome} ${p.decision.at.slice(0, 10)}` : '', p.logs.length, p.result || '']);
    }
    return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  };

  S.reset = function () {
    db = RCP.applyCalendarProposal(RCP.seed());
    save();
    try { if (idb) idb.close(); indexedDB.deleteDatabase('rcp-files'); } catch (e) { /* ignore */ }
  };
  S.save = save;

  RCP.store = S;
})();
