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
      if (parsed && parsed.version === RCP.SEED_VERSION) {
        if (!parsed.pilotRevision && !safe.getItem('rcp-db-before-pilot-accounts')) safe.setItem('rcp-db-before-pilot-accounts',raw);
        return RCP.markDisneyUnderway(RCP.addWorkspaceLinks(RCP.addDisneyWorkspaces(RCP.cleanPilot(RCP.applyCalendarProposal(RCP.addExamples(parsed))))));
      }
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
    usersWith: (role) => db.users.filter((u) => u.active !== false && u.roles.includes(role)),
    displayName(id) {
      const u = S.user(id);
      if (!u) return 'Unknown';
      return u.form ? `${u.name} (${u.form})` : u.initials ? `${u.name} (${u.initials})` : u.name;
    },
  };

  // ---------- session ----------
  S.session = function () {
    try {
      const session = JSON.parse(safe.getItem(SESSION));
      const user = session && S.user(session.userId);
      return user && user.active !== false && session.authRevision === user.authRevision && user.roles.includes(session.role) ? session : null;
    } catch (e) { return null; }
  };
  const setSession = (u, role) => safe.setItem(SESSION, JSON.stringify({userId:u.id,role,authRevision:u.authRevision}));
  const passwordHash = async (password, salt) => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:120000,hash:'SHA-256'},key,256);
    return Array.from(new Uint8Array(bits), x => x.toString(16).padStart(2,'0')).join('');
  };
  S.login = async (username, password) => {
    const u = db.users.find(u => (u.username || u.name).toLowerCase() === username.trim().toLowerCase() && u.active !== false);
    if (!u || (u.passwordHash ? await passwordHash(password,u.passwordSalt) !== u.passwordHash : password !== u.username)) throw new Error('Incorrect username or password.');
    setSession(u,u.roles.includes('student') ? 'student' : u.roles.includes('committee') ? 'committee' : u.roles[0]);
    return u;
  };
  S.signIn = function (userId, role) {
    const u = S.me();
    if (!u || u.id !== userId || !u.roles.includes(role) || u.roles.includes('student') && role !== 'student') throw new Error('Sign in with your username and password first.');
    setSession(u,role);
  };
  S.signOut = function () { safe.removeItem(SESSION); };
  S.me = function () { const s = S.session(); return s ? S.user(s.userId) : null; };
  S.role = function () { const s = S.session(); return s ? s.role : null; };
  S.skipPasswordChange = () => {
    const u=S.me();if(!u)throw new Error('Please sign in.');
    const role=S.role();u.mustChangePassword=false;u.defaultPasswordAccepted=!u.passwordHash;u.authRevision++;
    setSession(u,role);save();
  };
  S.setProjectLinks = (projectId,links) => {
    const p=S.project(projectId);if(!S.canSeeProject(p)||S.role()==='partner')throw new Error('Project access required.');
    const clean={};
    for(const kind of ['github','drive']) {
      const value=String(links[kind] || '').trim();if(!value){clean[kind]='';continue;}
      let url;try{url=new URL(value);}catch(error){throw new Error('Enter a valid '+kind+' link.');}
      const domains=kind==='github'?['github.com']:['drive.google.com','docs.google.com'];
      if(url.protocol!=='https:' || url.username || url.password || !domains.includes(url.hostname))throw new Error('Use an HTTPS '+kind+' link on its official domain.');
      clean[kind]=url.href;
    }
    p.links=clean;S.log(S.me().id,'updated workspace links for “'+p.title+'”',projectId);save();
  };
  S.changePassword = async (oldPassword, password) => {
    const u = S.me();
    if (!u) throw new Error('Please sign in.');
    const valid = u.passwordHash ? await passwordHash(oldPassword,u.passwordSalt) === u.passwordHash : oldPassword === u.username;
    if (!valid) throw new Error('Current password is incorrect.');
    if (password.length < 12 || password === u.username) throw new Error('Choose a new password of at least 12 characters, different from your username.');
    u.passwordSalt = Array.from(crypto.getRandomValues(new Uint8Array(16)),x => x.toString(16).padStart(2,'0')).join('');
    const role = S.role(); u.passwordHash = await passwordHash(password,u.passwordSalt); u.mustChangePassword = false; u.authRevision++;
    setSession(u,role); save();
  };
  const committeeOnly = () => { if (S.role() !== 'committee' || S.me().roles.includes('student') || S.me().mustChangePassword) throw new Error('Committee access required.'); };
  S.manageAccount = data => {
    committeeOnly();
    const username = data.username.trim(), roles = data.roles, projectIds = data.projectIds;
    if (projectIds.some(id => !S.project(id))) throw new Error('Select an existing project.');
    if (!username || !roles.length || roles.some(r => !['student','teacher','mentor','committee','partner'].includes(r))) throw new Error('Enter a username and at least one valid role.');
    if (roles.includes('student') && roles.length !== 1) throw new Error('Use a separate staff account for internal committee roles.');
    if (roles.includes('partner') && roles.length !== 1) throw new Error('Partner accounts cannot have internal roles.');
    if (db.users.some(u => u.id !== data.id && (u.username || u.name).toLowerCase() === username.toLowerCase())) throw new Error('That username already exists.');
    let u = data.id ? S.user(data.id) : null;
    if (data.id && (!u || u.id === S.me().id)) throw new Error('Use My account to manage your own password.');
    if (u && u.roles.includes('committee') && (!data.active || !roles.includes('committee')) && !db.users.some(x => x.id !== u.id && x.active !== false && x.roles.includes('committee'))) throw new Error('Keep at least one active committee account.');
    if (!u) {u={id:uid('u'),name:username,email:'',username,authRevision:1,mustChangePassword:true};db.users.push(u);}
    if (u.username !== username && !u.passwordHash) u.mustChangePassword=true;
    Object.assign(u,{username,name:username,roles,active:data.active,projectIds}); u.authRevision++;
    for (const p of db.projects) for (const f of p.files) f.partnerIds = (f.partnerIds || []).filter(id => id !== u.id);
    S.log(S.me().id, 'updated account access for '+username);save();return u;
  };
  S.resetPassword = id => {
    committeeOnly(); const u = S.user(id);
    if (!u || u.id === S.me().id) throw new Error('Use My account to change your password.');
    delete u.passwordHash; delete u.passwordSalt; u.mustChangePassword=true;u.authRevision++;
    for (const p of db.projects) for (const f of p.files) f.partnerIds = (f.partnerIds || []).filter(id => id !== u.id);
    S.log(S.me().id,'reset the default password for '+u.username);save();
  };
  S.canSeeProject = (p, user=S.me(), role=S.role()) => !!(p && user && (user.roles.includes('student') ? p.members.includes(user.id) : role === 'committee' || p.members.includes(user.id) || p.teacherId === user.id || p.mentorId === user.id || role === 'partner' && (user.projectIds || []).includes(p.id)));
  S.setProjectMembers = (projectId, ids) => {
    committeeOnly();const p=S.project(projectId);
    if(!p || ids.some(id => !S.user(id)?.roles.includes('student') || S.user(id).active === false)) throw new Error('Select active student accounts.');
    p.members=[...new Set(ids)];p.membershipLocked=true;S.log(S.me().id,'updated participants for “'+p.title+'”',projectId);save();
  };
  S.canReadFile = id => {
    const u = S.me(), role = S.role(); if (!u || u.mustChangePassword) return false;
    const p = db.projects.find(p => p.files.some(f => f.id === id));
    if (p) return S.canSeeProject(p,u,role) && (role === 'partner' ? (u.projectIds || []).includes(p.id) && p.files.some(f => f.id === id && (f.partnerIds || []).includes(u.id) && f.category !== 'Experience evidence') : role === 'committee' || p.members.includes(u.id) || p.teacherId === u.id || p.mentorId === u.id);
    return role !== 'partner' && db.postings.some(o => (o.files || []).some(f => f.id === id));
  };
  S.shareFile = (projectId,fileId,ids) => {
    committeeOnly(); const p = S.project(projectId), f = p && p.files.find(f => f.id === fileId);
    if (!f || f.category === 'Experience evidence') throw new Error('Experience evidence cannot be shared with partners.');
    if (ids.some(id => {const u=S.user(id);return !u || u.active === false || !u.roles.includes('partner') || !(u.projectIds || []).includes(projectId);})) throw new Error('Choose active partners assigned to this project.');
    f.partnerIds=ids; S.log(S.me().id,'updated partner document access for “'+f.name+'”',projectId);save();
  };

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

  // ---------- custom deadlines (the mentor or teacher-in-charge of a project sets dates for their own project) ----------
  S.deadlinesFor = (projectId) => (db.customDates || []).filter((d) => d.projectId === projectId).sort((a, b) => a.date.localeCompare(b.date));
  S.allDeadlines = () => db.customDates || [];
  S.addDeadline = function (projectId, title, date, by) {
    const p = S.project(projectId);
    if (!p) throw new Error('Project not found.');
    if (p.mentorId !== by && p.teacherId !== by) throw new Error('Only the mentor or the teacher-in-charge of this project can set its deadlines.');
    title = String(title || '').trim();
    if (!title || !date) throw new Error('Give the deadline a name and a date.');
    (db.customDates ||= []).push({ id: uid('d'), projectId, title: title.slice(0, 80), date, by, createdAt: nowIso() });
    S.log(by, 'set a deadline “' + title + '” (' + date + ') on ' + p.title, projectId);
    for (const m of p.members) if (m !== by) db.mail.push({ id: uid('m'), to: m, from: by, at: nowIso(), subject: 'Deadline set: ' + title, body: S.displayName(by) + ' set a deadline “' + title + '” for ' + p.title + ' on ' + date + '.', read: false });
    save();
  };
  S.removeDeadline = function (id, by) {
    const d = (db.customDates || []).find((x) => x.id === id);
    if (!d) return;
    const p = S.project(d.projectId);
    if (d.by !== by && p.mentorId !== by && p.teacherId !== by) throw new Error('You can only remove deadlines you set for your own project.');
    db.customDates = db.customDates.filter((x) => x.id !== id);
    S.log(by, 'removed the deadline “' + d.title + '” from ' + p.title, d.projectId);
    save();
  };

  // ---------- workflow actions ----------
  S.saveDraft = function (draft, by) {
    let p = draft.id ? S.project(draft.id) : null;
    if (!p) {
      p = { id: uid('p'), status: 'draft', createdAt: nowIso(), endorsement: null, decision: null, mentorId: null, logs: [], files: [], checklist: Object.fromEntries(RCP.ACCOUNTABILITY.map(([k]) => [k, false])) };
      db.projects.unshift(p);
    }
    if (p.membershipLocked && JSON.stringify([...draft.members].sort()) !== JSON.stringify([...p.members].sort())) throw new Error('Only the committee can change participants for this project.');
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
    if (!S.canSeeProject(p) || S.role() === 'partner' || by !== S.me().id) throw new Error('Project access required.');
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
    if (!S.canSeeProject(S.project(projectId)) || S.role() === 'partner' || by !== S.me().id) throw new Error('Only the assigned project team can upload files.');
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
    if (!S.canReadFile(id)) throw new Error("This document is not shared with your account.");
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
  if (window.addEventListener) window.addEventListener('storage', event => {
    if (event.key === KEY) db = load();
    if (event.key === KEY || event.key === SESSION) window.dispatchEvent(new Event('rcp-sync'));
  });

  // Connect to the private service when this interface is served by server.cjs.
  let remoteSession=null, csrf='';
  const request = async (endpoint,body) => {
    const response=await fetch('/api/'+endpoint,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{},body:body?JSON.stringify(body):undefined});
    const result=await response.json();if(response.status===401){remoteSession=null;db=RCP.seed();}if(!response.ok)throw new Error(result.error || 'Request failed.');return result;
  };
  const applyRemote=result=>{if(result.db)db=result.db;if('session' in result)remoteSession=result.session;if(result.csrf)csrf=result.csrf;};
  S.isRemote=()=>false;
  S.ready=(async()=>{
    if(typeof fetch === 'undefined')return;
    try {const response=await fetch('/api/session',{credentials:'same-origin'});if(!response.ok || !(response.headers.get('content-type') || '').includes('application/json'))return;const initial=await response.json();if(!('session' in initial))return;applyRemote(initial);}catch(error){return;}
    S.isRemote=()=>true;S.session=()=>remoteSession;S.me=()=>remoteSession?S.user(remoteSession.userId):null;S.role=()=>remoteSession?.role || null;S.storesFilesDurably=()=>true;
    S.login=async(username,password)=>{const result=await request('login',{username,password});applyRemote(result);return S.me();};
    S.signOut=async()=>{await request('logout',{});remoteSession=null;db=RCP.seed();};
    const methods=['skipPasswordChange','setProjectLinks','changePassword','signIn','manageAccount','resetPassword','setProjectMembers','shareFile','setPlaces','saveDraft','submit','endorse','decide','assignMentor','addLog','comment','submitFinal','recordResult','recommendIndustry','addDeadline','removeDeadline','apply','shortlist','confirmEligibility','post','teacherProject','markRead','setCalendarCheck'];
    for(const method of methods) S[method]=async(...args)=>{const result=await request('action',{method,args});applyRemote(result);return result.result?.id ? (S.project(result.result.id)||S.posting(result.result.id)||S.user(result.result.id)||result.result) : result.result;};
    for(const method of ['addFile','addPostingFile']) S[method]=async(...args)=>{const f=args[1],bytes=new Uint8Array(await f.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));args[1]={name:f.name,type:f.type,content:btoa(binary)};const result=await request('action',{method,args});applyRemote(result);return result.result;};
    S.getFile=async id=>{const response=await fetch('/api/files/'+encodeURIComponent(id),{credentials:'same-origin'});if(!response.ok)throw new Error('File unavailable for your account.');const f=db.projects.flatMap(p=>p.files).find(f=>f.id===id);return new Blob([await response.arrayBuffer()],{type:f?.type || 'application/octet-stream'});};
    S.reset=()=>{throw new Error('Private project data cannot be reset from the browser.');};
  })();
  RCP.store = S;
})();
