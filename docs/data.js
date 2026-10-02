/* Seed data for the prototype. Committee members, competitions and dates come from the
   CMS proposal deck (Sept 2026). Other students, teachers and Old Boys are sample people. */
window.RCP = window.RCP || {};

RCP.SEED_VERSION = 7;

/* Minimal single-page PDF writer: sample documents become real PDF files with no library.
   Output is ASCII-only, so JS string offsets equal PDF byte offsets. */
RCP.makePdf = function (title, lines) {
  const fold = (c) => ({ '\u2019': "'", '\u2018': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '-', '\u00b7': '-', '\u00d7': 'x', '\u2026': '...' }[c] || '?');
  const esc = (t) => String(t).replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e]/g, fold);
  const wrap = (t, n) => { const out = []; for (const para of String(t).split('\n')) { let line = ''; for (const w of para.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push('  ' + line.trim()); line = w; } else line += ' ' + w; } out.push('  ' + line.trim()); } return out; };
  const rows = wrap(lines.join('\n').replace(/\n{2,}/g, '\n \n').replace(/\n/g, '\n '), 88).slice(0, 44);
  const content = [`BT /F1 15 Tf 64 772 Td (${esc(title)}) Tj ET`].concat(rows.map((l, i) => `BT /F1 10.5 Tf 64 ${744 - i * 13} Td (${esc(l)}) Tj ET`)).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const off = [0];
  objs.forEach((o, i) => { off.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.slice(1).map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
};

RCP.ACCOUNTABILITY = [
  ['proposal', 'Proposal'],
  ['endorsement', 'Teacher endorsement'],
  ['experience', 'Previous experience'],
  ['decision', 'Committee decision'],
  ['mentor', 'Mentor assigned'],
  ['logs', 'Progress logs'],
  ['final', 'Final submission'],
  ['result', 'Result'],
];

RCP.STATUS = {
  draft: { label: 'Draft', tone: 'muted' },
  endorsement: { label: 'Awaiting teacher endorsement', tone: 'warn' },
  returned: { label: 'Returned by teacher', tone: 'bad' },
  review: { label: 'Committee review', tone: 'info' },
  rejected: { label: 'Not approved', tone: 'bad' },
  active: { label: 'Active', tone: 'good' },
  submitted: { label: 'Final submitted', tone: 'info' },
  completed: { label: 'Completed', tone: 'good' },
};

RCP.FILE_CATEGORIES = ['Proposal', 'Progress log', 'Presentation', 'Final submission', 'Experience evidence', 'Other'];

RCP.seed = function seed() {
  const now = Date.now();
  const day = 86400000;
  const iso = (d) => new Date(d).toISOString();

  const users = [
    // Committee (slide 12)
    { id: 'austin', name: 'Austin', roles: ['mentor', 'committee'], title: 'DSOBA representative', email: 'austin@dsoba.example' },
    { id: 'isaac', name: 'Isaac', roles: ['mentor', 'committee'], title: 'DSOBA representative', email: 'isaac@dsoba.example' },
    { id: 'david', name: 'David', roles: ['mentor', 'committee'], title: 'DSOBA representative', email: 'david@dsoba.example' },
    // Teachers named as on the DBS staff list (dbs.edu.hk, Aug 2025); initials and emails are demo values.
    { id: 'kwc', name: 'Mr. Cho Ka Wai', initials: 'KCW', roles: ['committee', 'teacher'], title: 'Dean of Culture', email: 'kwc@dbs.example' },
    { id: 'ltc', name: 'Mr. Chan Long Tin', initials: 'LTC', roles: ['committee', 'teacher'], title: 'Mathematics, ECA Master', email: 'ltc@dbs.example' },
    { id: 'cal', name: 'Mr. Lee Chi Kong Alfred', initials: 'CAL', roles: ['committee', 'teacher'], title: 'Design & Technology, ECA Master', email: 'cal@dbs.example' },
    { id: 'ksm', name: 'Ms. Chan Sze Man', initials: 'KSM', roles: ['committee', 'teacher'], title: 'Chinese Language', email: 'ksm@dbs.example' },
    { id: 'trevor', name: 'Trevor Chak', form: '11IB', roles: ['student', 'committee'], title: 'Student representative', email: 'trevor@g.dbs.example' },
    { id: 'jaden', name: 'Jaden Wong', form: '11IB', roles: ['student', 'committee'], title: 'Student representative', email: 'jaden@g.dbs.example' },
    // Teachers-in-charge, named as on the DBS staff list; departments are sample assignments
    { id: 'wkh', name: 'Mr. Wan Chi Yin', initials: 'WCY', roles: ['teacher'], title: 'Physics, TIC', email: 'wkh@dbs.example', sample: true },
    { id: 'lml', name: 'Ms. Lam Miu Lan', initials: 'LML', roles: ['teacher'], title: 'Biology, TIC', email: 'lml@dbs.example', sample: true },
    { id: 'auckl', name: 'Mr. Au Ka Lok', initials: 'AKL', roles: ['teacher'], title: 'Physics', email: 'auckl@dbs.example', sample: true },
    { id: 'kukc', name: 'Mr. Ku Ka Chun', initials: 'KKC', roles: ['teacher'], title: 'Physics', email: 'kukc@dbs.example', sample: true },
    { id: 'wongkw', name: 'Mr. Wong Kwok Wai', initials: 'WKW', roles: ['teacher'], title: 'Computer Science', email: 'wongkw@dbs.example', sample: true },
    { id: 'tanghy', name: 'Ms. Tang Hung Yuk', initials: 'THY', roles: ['teacher'], title: 'Chemistry', email: 'tanghy@dbs.example', sample: true },
    { id: 'chowkc', name: 'Mr. Chow Kevin Chi Tsun', initials: 'CKC', roles: ['teacher'], title: 'Engineering', email: 'chowkc@dbs.example', sample: true },
    { id: 'ngch', name: 'Mr. Ng Chun Ho', initials: 'NCH', roles: ['teacher'], title: 'Mathematics', email: 'ngch@dbs.example', sample: true },
    { id: 'pahvk', name: 'Mr. Pahilwani Vijay Kishan', initials: 'PVK', roles: ['teacher'], title: 'Mathematics', email: 'pahvk@dbs.example', sample: true },
    // Sample Old Boy mentors
    { id: 'kho', name: 'Dr. Kelvin Ho (2008)', roles: ['mentor'], title: 'Robotics engineer', email: 'kho@alumni.example', sample: true },
    // Sample students
    { id: 'ethan', name: 'Ethan Lau', form: '10C', roles: ['student'], email: 'ethan@g.dbs.example', sample: true },
    { id: 'marcus', name: 'Marcus Cheung', form: '11D', roles: ['student'], email: 'marcus@g.dbs.example', sample: true },
    { id: 'ryan', name: 'Ryan Ng', form: '9B', roles: ['student'], email: 'ryan@g.dbs.example', sample: true },
    { id: 'aaron', name: 'Aaron Tsang', form: '12IB', roles: ['student'], email: 'aaron@g.dbs.example', sample: true },
    { id: 'owen', name: 'Owen Yip', form: '10A', roles: ['student'], email: 'owen@g.dbs.example', sample: true },
  ];

  // Slides 6–8. Dates follow the 2025–26 cycle unless a 2027 date is shown. Places are committee-set placeholders.
  const competitions = [
    { id: 'isef', short: 'ISEF', name: 'Regeneron International Science and Engineering Fair', tier: 1, hkRound: 'HK ISEF selection · register by mid-Oct, judged Nov', final: 'Los Angeles, USA · 8–14 May 2027', deadline: null, places: 2, bars: [[1, 2, 'HK selection'], [8, 8, 'Final']] },
    { id: 'geneva', short: 'GI Geneva', name: 'International Exhibition of Inventions Geneva', tier: 1, hkRound: 'HK delegation selection · Nov – Dec', final: 'Geneva, Switzerland · March', deadline: null, places: 2, bars: [[2, 3, 'HK selection'], [6, 6, 'Final']] },
    { id: 'hksspc', short: 'HKSSPC', name: 'Hong Kong Student Science Project Competition', tier: 1, hkRound: 'School nominations · Dec – Jan', final: 'Final judging · April', deadline: null, places: 4, bars: [[3, 4, 'Nominations'], [7, 7, 'Final']] },
    { id: 'hkstic', short: 'HKSTIC', name: 'HK Youth Science and Technology Innovation Competition', tier: 1, hkRound: 'Registration closes mid-Jan', final: 'Final exhibition · March – April', deadline: null, places: 4, bars: [[3, 4, 'Registration'], [6, 7, 'Final']] },
    { id: 'gtc', short: 'GTC-ISPC', name: "G.T. College Int'l Science Project Competition (Bio)", tier: 2, hkRound: 'Registration open now', final: 'G.T. College, Hong Kong · 9 Jan 2027', deadline: null, places: 3, bars: [[0, 1, 'Registration'], [4, 4, 'Final']] },
    { id: 'sft', short: 'Samsung SFT', name: 'Samsung Solve for Tomorrow', tier: 2, hkRound: 'Register 3 Sep – 16 Oct · proposal due 20 Nov', final: 'Prototype workshops · Jan – Mar 2027', deadline: '2026-10-16', places: 3, bars: [[0, 2, 'Register · proposal'], [4, 6, 'Workshops']] },
    { id: 'gystb', short: 'GYSTB', name: 'Global Youth Science and Technology Bowl', tier: 2, hkRound: 'Through HKSSPC', final: 'Hong Kong, summer (TBC)', deadline: null, places: 1, via: 'hksspc', bars: [[10, 10, 'TBC']] },
    { id: 'apcys', short: 'APCYS', name: 'Asia-Pacific Conference of Young Scientists', tier: 2, hkRound: 'Through HKSSPC', final: 'Host varies (TBC)', deadline: null, places: 1, via: 'hksspc', bars: [[10, 10, 'TBC']] },
    { id: 'other', short: 'Others', name: 'Other competition (suggested by students)', tier: 3, hkRound: 'Case by case', final: '—', deadline: null, places: null, bars: [] },
  ];

  const checklist = (done) => Object.fromEntries(RCP.ACCOUNTABILITY.map(([k]) => [k, done.includes(k)]));
  const sampleFile = (id, name, category, by, days, content) => ({ id, name, category, by, at: iso(now - days * day),
    type: name.endsWith('.csv') ? 'text/csv' : 'application/pdf', size: content.length, sampleContent: content });

  const projects = [
    {
      id: 'p-disney', stage: 1, origin: 'student', title: 'Railway clearance monitoring at Hong Kong Disneyland',
      partner: 'Hong Kong Disneyland (via PRISM)', competitionId: null,
      abstract: 'LiDAR-based clearance-envelope checks for the park railway, turning DXF track drawings into a live obstruction detector with a web dashboard for the operations team.',
      members: ['jaden', 'trevor'], teacherId: 'ltc', mentorId: 'austin', industryTutor: 'Park railway engineering lead',
      experience: 'PRISM R&D since 2025; LiDAR frontend and DXF clearance-envelope tooling built Feb–Apr 2026.',
      status: 'active', createdAt: iso(now - 120 * day),
      endorsement: { by: 'ltc', at: iso(now - 118 * day), note: 'Strong, well-scoped industry project. Endorsed.' },
      decision: { by: 'kwc', at: iso(now - 112 * day), outcome: 'approved', note: 'Approved as the pilot Stage 1 project.' },
      checklist: checklist(['proposal', 'endorsement', 'experience', 'decision', 'mentor', 'logs']),
      logs: [
        { id: 'l1', date: iso(now - 70 * day).slice(0, 10), by: 'jaden', at: iso(now - 70 * day), text: 'Clearance envelope generated from all DXF sections. Started field capture plan with the park team.', files: [], comments: [{ by: 'austin', at: iso(now - 68 * day), text: 'Good progress. Agree a safety briefing before any trackside capture.' }] },
        { id: 'l2', date: iso(now - 38 * day).slice(0, 10), by: 'trevor', at: iso(now - 38 * day), text: 'Detector prototype runs on recorded LiDAR at 12 fps. False positives on vegetation; adding a height filter.', files: [], comments: [] },
        { id: 'l3', date: iso(now - 6 * day).slice(0, 10), by: 'jaden', at: iso(now - 6 * day), text: 'September progress update deck shared with the park. Next: live trial window and alert thresholds.', files: ['f-deck'], comments: [] },
      ],
      files: [
        sampleFile('f-deck', 'september-update-deck.pdf', 'Presentation', 'jaden', 6,
          RCP.makePdf('Railway clearance monitoring — September update', ['FICTIONAL DEMO PRESENTATION', '', '1. Clearance envelope generated from DXF drawings', '2. Detector running at 12 fps on recorded LiDAR', '3. False positives on vegetation and the height filter', '4. Ask: live trial window and alert thresholds'])),
        sampleFile('f-risk', 'trackside-risk-assessment.pdf', 'Other', 'ltc', 40,
          RCP.makePdf('Trackside risk assessment', ['FICTIONAL DEMO DOCUMENT', '', 'Controls: park safety briefing before each visit, staff escort at all times, no capture during operating hours, equipment secured to the vehicle.'])),
      ],
    },
    {
      id: 'p-pwc', stage: 1, origin: 'student', title: 'Detecting suspicious newly registered domains',
      partner: 'PwC Hong Kong (via PRISM)', competitionId: null,
      abstract: 'Flag look-alike domains registered in the last 30 days that target Hong Kong companies, and send automatic reports to the affected organisations.',
      members: ['aaron', 'owen'], teacherId: 'cal', mentorId: 'isaac', industryTutor: 'Cyber risk consultant',
      experience: 'Aaron: HKCERT CTF finalist. Owen: Python data-pipeline coursework.',
      status: 'active', createdAt: iso(now - 60 * day),
      endorsement: { by: 'cal', at: iso(now - 58 * day), note: 'Endorsed.' },
      decision: { by: 'ltc', at: iso(now - 50 * day), outcome: 'approved', note: 'Approved. Keep monthly logs on the platform.' },
      checklist: checklist(['proposal', 'endorsement', 'experience', 'decision', 'mentor', 'logs']),
      logs: [
        { id: 'l4', date: iso(now - 40 * day).slice(0, 10), by: 'aaron', at: iso(now - 40 * day), text: 'Pulled certificate-transparency feed; 2.1k candidate domains per day after filtering.', files: [], comments: [] },
      ],
      files: [],
    },
    {
      id: 'p-levitation', stage: 1, origin: 'teacher', title: 'Acoustic levitation bench for physics demos',
      partner: null, competitionId: null,
      abstract: 'Build a low-cost ultrasonic levitator array for the physics lab, so junior classes can float beads, water droplets and styrofoam balls to see standing waves in action.',
      members: ['owen', 'ryan'], teacherId: 'wkh', mentorId: 'kho', industryTutor: null,
      experience: 'Owen and Ryan finished the PRISM electronics curriculum and soldered the society\'s oscilloscope kit.',
      status: 'active', createdAt: iso(now - 30 * day),
      endorsement: { by: 'wkh', at: iso(now - 30 * day), note: 'Teacher-initiated project for the physics society.' },
      decision: { by: 'kwc', at: iso(now - 28 * day), outcome: 'approved', note: 'Ratified as a teacher-initiated project.' },
      checklist: checklist(['proposal', 'endorsement', 'experience', 'decision', 'mentor', 'logs']),
      logs: [
        { id: 'l6', date: iso(now - 16 * day).slice(0, 10), by: 'owen', at: iso(now - 16 * day), text: 'Mounted 72 transducers on the circular board; first styrofoam bead levitated for 3 seconds.', files: [], comments: [{ by: 'kho', at: iso(now - 15 * day), text: 'Great milestone. Check the phase calibration across the array before the next run.' }] },
      ],
      files: [],
    },
    {
      id: 'p-schlieren', stage: 2, origin: 'student', title: 'Seeing airflow with a phone: low-cost schlieren imaging',
      competitionId: 'isef', partner: null,
      abstract: 'Background-oriented schlieren on commodity cameras to visualise heat plumes and airflow for school labs, validated against a mirror schlieren rig.',
      members: ['ethan'], teacherId: 'ksm', mentorId: null,
      experience: 'HKYPT 2026 team member; built the optics rig for the school physics society.',
      status: 'endorsement', createdAt: iso(now - 3 * day),
      endorsement: null, decision: null,
      checklist: checklist(['proposal', 'experience']), logs: [], files: [],
    },
    {
      id: 'p-rain', stage: 2, origin: 'student', title: 'Rain-aware walking routes for Hong Kong',
      competitionId: 'sft', partner: null,
      abstract: 'Route pedestrians under covered walkways when HKO radar shows rain within 20 minutes, using Lands Department footbridge and covered-walkway data.',
      members: ['marcus', 'ryan'], teacherId: 'wkh', mentorId: null,
      experience: 'Marcus built a school timetable app; Ryan completed the PRISM beginner curriculum.',
      status: 'review', createdAt: iso(now - 9 * day),
      endorsement: { by: 'wkh', at: iso(now - 7 * day), note: 'Endorsed. Ryan is young but keen; recommend mentoring.' },
      decision: null,
      checklist: checklist(['proposal', 'endorsement', 'experience']), logs: [], files: [],
    },
    {
      id: 'p-algae', stage: 2, origin: 'student', title: 'Microalgae growth under LED spectra',
      competitionId: 'gtc', partner: null,
      abstract: 'Compare Chlorella growth rates under narrow-band LEDs to find the most energy-efficient spectrum for school-scale bioreactors.',
      members: ['owen'], teacherId: 'lml', mentorId: 'david',
      experience: 'Biology Olympiad training squad.',
      status: 'active', createdAt: iso(now - 85 * day),
      endorsement: { by: 'lml', at: iso(now - 83 * day), note: 'Endorsed.' },
      decision: { by: 'ksm', at: iso(now - 80 * day), outcome: 'approved', note: 'Approved for a GTC-ISPC place.' },
      checklist: checklist(['proposal', 'endorsement', 'experience', 'decision', 'mentor', 'logs']),
      logs: [{ id: 'l5', date: iso(now - 72 * day).slice(0, 10), by: 'owen', at: iso(now - 72 * day), text: 'Set up 4 culture flasks; baseline OD readings recorded.', files: [], comments: [] }],
      files: [],
    },
    {
      id: 'p-draft', stage: 2, origin: 'student', title: 'Magnetic accelerator efficiency (draft)',
      competitionId: 'hksspc', partner: null, abstract: '', members: ['marcus'], teacherId: null, mentorId: null, experience: '',
      status: 'draft', createdAt: iso(now - 1 * day), endorsement: null, decision: null,
      checklist: checklist([]), logs: [], files: [],
    },
  ];

  const postings = [
    {
      id: 'o-chiller', by: 'austin', title: 'Predictive maintenance for building chillers', org: 'Building services engineering firm (Old Boy-run)', audience: 'all',
      description: 'Vibration and temperature data from four chiller units, two of which failed last year. Students look for the signature that comes before a failure and write it up for the maintenance team.',
      places: 2, hours: '3 h / week', duration: '5 months', requirements: 'Physics or ICT; some Python. Any form level.',
      status: 'open', createdAt: iso(now - 75 * day), files: [],
      applications: [
        { id: 'a3', studentId: 'aaron', at: iso(now - 70 * day), cv: 'HKCERT CTF finalist; data analysis in Python for the school weather station.', coursework: 'Physics HL, Computer Science HL', status: 'placed' },
        { id: 'a4', studentId: 'owen', at: iso(now - 69 * day), cv: 'Electronics workshop; soldered the society oscilloscope kit.', coursework: 'Physics SL', status: 'declined' },
      ],
    },
    {
      id: 'o-vision', by: 'david', title: 'Computer vision for construction-site safety', org: 'Construction technology firm (Old Boy-run)', audience: 'all',
      description: 'Detect missing helmets and harnesses from site CCTV and measure how often alerts are acted on. Real footage under an NDA; students work with the site safety manager.',
      places: 3, hours: '4 h / week', duration: '6 months', requirements: 'Python; any machine-learning coursework is a plus. Form 4 and above.',
      status: 'open', createdAt: iso(now - 12 * day), files: [],
      applications: [{ id: 'a1', studentId: 'ryan', at: iso(now - 4 * day), cv: 'PRISM beginner curriculum; built a YOLO detector for screws in the railway project dataset.', coursework: 'ICT: 7/7 on image-processing SBA', status: 'pending' },
        { id: 'a2', studentId: 'trevor', at: iso(now - 2 * day), cv: 'PRISM R&D member; LiDAR dashboard frontend for the Disneyland railway project.', coursework: 'ICT: full marks on the database unit', status: 'shortlisted' },
        { id: 'a5', studentId: 'marcus', at: iso(now - 30 * day), cv: 'School timetable app.', coursework: 'ICT SL', status: 'ineligible' }],
    },
    {
      id: 'o-carbon', by: 'isaac', title: 'Carbon accounting dashboard for SMEs', org: 'Sustainability consultancy (Old Boy-run)', audience: 'G11–G12',
      description: 'Turn utility bills and delivery logs into Scope 1–2 estimates for small shops. Output: a dashboard pilot with three client businesses.',
      places: 2, hours: '3 h / week', duration: '4 months', requirements: 'Spreadsheet or web skills; interest in climate. Client-facing work, so senior students only.',
      status: 'open', createdAt: iso(now - 50 * day), files: [],
      applications: [{ id: 'a6', studentId: 'aaron', at: iso(now - 46 * day), cv: 'Weather station data pipeline; school sustainability committee.', coursework: 'Economics HL, Computer Science HL', status: 'placed' }],
    },
    {
      id: 'o-line', by: 'kho', title: 'Line-following robot race firmware', org: 'Robotics startup (Old Boy-run)', audience: 'G9–G10',
      description: 'Tune and extend the firmware of a competition line-follower: PID, sensor fusion and a race-tuning guide. Aims at younger students who want a first hardware win.',
      places: 4, hours: '3 h / week', duration: '3 months', requirements: 'Basic Arduino or Python; PRISM beginner curriculum ideal. Juniors only — seniors have their own postings.',
      status: 'open', createdAt: iso(now - 8 * day), files: [], applications: [],
    },
  ];

  // Old Boy-initiated projects: posted by an Old Boy, applied for, eligibility confirmed, then run
  // with check-ins every two months. One for each DSOBA member, so both Stage 1 routes are visible.
  projects.push(
    {
      id: 'p-chiller', postingId: 'o-chiller', stage: 1, origin: 'oldboy', title: 'Predictive maintenance for building chillers',
      partner: 'Building services engineering firm (Old Boy-run)', competitionId: null,
      abstract: 'Vibration and temperature data from four chiller units, two of which failed last year. Find the signature that comes before a failure and write it up for the maintenance team.',
      members: ['aaron'], teacherId: 'ksm', mentorId: 'austin', industryTutor: 'Maintenance engineering lead',
      experience: 'HKCERT CTF finalist; data analysis in Python for the school weather station.',
      status: 'active', createdAt: iso(now - 68 * day), endorsement: null,
      decision: { by: 'kwc', at: iso(now - 68 * day), outcome: 'approved', note: 'Eligibility confirmed (Old Boy-initiated project).' },
      checklist: checklist(['proposal', 'endorsement', 'experience', 'decision', 'mentor', 'logs']),
      logs: [
        { id: 'l7', date: iso(now - 62 * day).slice(0, 10), by: 'aaron', at: iso(now - 62 * day), text: 'Site visit and data handover: 14 months of vibration logs for four units, sampled every 10 minutes.', files: [], comments: [{ by: 'austin', at: iso(now - 61 * day), text: 'Check the units were running under comparable load before you compare them.' }] },
        { id: 'l8', date: iso(now - 8 * day).slice(0, 10), by: 'aaron', at: iso(now - 8 * day), text: 'Spectra for the two failed units show a rising 2x-rotation peak about three weeks before failure. Writing it up with the raw readings attached.', files: ['f-chiller-data'], comments: [] },
      ],
      files: [sampleFile('f-chiller-data', 'chiller-vibration-sample.csv', 'Progress log', 'aaron', 8, 'unit,week,peak_2x_mm_s,outcome\nA,1,0.8,ok\nA,12,2.6,failed\nB,1,0.7,ok\nB,12,0.9,ok\n')],
    },
    {
      id: 'p-vision', postingId: 'o-vision', stage: 1, origin: 'oldboy', title: 'Computer vision for construction-site safety',
      partner: 'Construction technology firm (Old Boy-run)', competitionId: null,
      abstract: 'Detect missing helmets and harnesses from site CCTV and measure how often alerts are acted on.',
      members: ['trevor'], teacherId: 'ltc', mentorId: 'david', industryTutor: 'Site safety manager',
      experience: 'PRISM R&D member; LiDAR dashboard frontend for the Disneyland railway project.',
      status: 'active', createdAt: iso(now - 10 * day), endorsement: null,
      decision: { by: 'kwc', at: iso(now - 10 * day), outcome: 'approved', note: 'Eligibility confirmed (Old Boy-initiated project).' },
      checklist: checklist(['proposal', 'endorsement', 'experience', 'decision', 'mentor']),
      logs: [], files: [],
    },
    {
      id: 'p-carbon', postingId: 'o-carbon', stage: 1, origin: 'oldboy', title: 'Carbon accounting dashboard for SMEs',
      partner: 'Sustainability consultancy (Old Boy-run)', competitionId: null,
      abstract: 'Turn utility bills and delivery logs into Scope 1–2 estimates for small shops, with a dashboard piloted at three client businesses.',
      members: ['aaron'], teacherId: 'cal', mentorId: 'isaac', industryTutor: 'Sustainability consultant',
      experience: 'Weather station data pipeline; school sustainability committee.',
      status: 'active', createdAt: iso(now - 44 * day), endorsement: null,
      decision: { by: 'ltc', at: iso(now - 44 * day), outcome: 'approved', note: 'Eligibility confirmed (Old Boy-initiated project).' },
      checklist: checklist(['proposal', 'endorsement', 'experience', 'decision', 'mentor', 'logs']),
      logs: [{ id: 'l9', date: iso(now - 20 * day).slice(0, 10), by: 'aaron', at: iso(now - 20 * day), text: 'Collected a year of bills from the first shop; electricity and gas mapped to emission factors.', files: [], comments: [] }],
      files: [],
    },
  );

  // Applications waiting on each teacher, so every teacher account has something to decide.
  projects.push(
    {
      id: 'p-tide', stage: 2, origin: 'student', title: 'Tidal flow measurement with a drifting GPS float',
      competitionId: 'hkstic', partner: null,
      abstract: 'Release GPS floats at three points in the harbour and compare the tracks with the published tidal stream atlas.',
      members: ['marcus'], teacherId: 'ltc', mentorId: null,
      experience: 'Built a school timetable app; physics society member.',
      status: 'endorsement', createdAt: iso(now - 2 * day), endorsement: null, decision: null,
      checklist: checklist(['proposal', 'experience']), logs: [], files: [],
    },
    {
      id: 'p-queue', stage: 1, origin: 'student', title: 'Measuring canteen queue times with a counter app',
      competitionId: null, partner: null,
      abstract: 'Count arrivals and service times at the canteen for two weeks, then test whether a second till would cut the queue.',
      members: ['owen', 'ryan'], teacherId: 'cal', mentorId: null,
      experience: 'Electronics workshop; PRISM beginner curriculum.',
      status: 'endorsement', createdAt: iso(now - 1 * day), endorsement: null, decision: null,
      checklist: checklist(['proposal', 'experience']), logs: [], files: [],
    },
    {
      id: 'p-lab', stage: 2, origin: 'student', title: 'Reaction rates with a phone light sensor',
      competitionId: 'hksspc', partner: null,
      abstract: 'Use a phone light sensor to follow a colour-change reaction and compare the rate constants with a spectrophotometer.',
      members: ['ethan'], teacherId: 'kwc', mentorId: null,
      experience: 'Chemistry olympiad training squad.',
      status: 'endorsement', createdAt: iso(now - 1 * day), endorsement: null, decision: null,
      checklist: checklist(['proposal', 'experience']), logs: [], files: [],
    },
  );

  const mail = [
    { id: 'm1', to: 'ksm', from: 'system', at: iso(now - 3 * day), subject: 'Endorsement requested: Seeing airflow with a phone', body: 'Ethan Lau (10C) has asked you to endorse an ISEF application.', action: { label: 'Review and endorse', href: '#/endorse/p-schlieren' }, read: false },
    { id: 'm2', to: 'committee', from: 'system', at: iso(now - 7 * day), subject: 'Ready for committee review: Rain-aware walking routes', body: 'Endorsed by Mr. Wan Chi Yin (WCY). Samsung SFT places: 0 of 3 taken.', action: { label: 'Open review', href: '#/review/p-rain' }, read: false },
    { id: 'm3', to: 'david', from: 'system', at: iso(now - 4 * day), subject: 'New applicant: Computer vision for construction-site safety', body: 'Ryan Ng (9B) applied to your posted project.', action: { label: 'See applicants', href: '#/postings/o-vision' }, read: false },
    { id: 'm4', to: 'kho', from: 'system', at: iso(now - 16 * day), subject: 'New progress log: Acoustic levitation bench for physics demos', body: 'Owen Yip (10A) posted an update on your mentee project.', action: { label: 'Read log', href: '#/project/p-levitation' }, read: false },
  ];

  const audit = [
    { at: iso(now - 120 * day), by: 'jaden', text: 'submitted proposal “Railway clearance monitoring at Hong Kong Disneyland”' },
    { at: iso(now - 118 * day), by: 'ltc', text: 'endorsed “Railway clearance monitoring at Hong Kong Disneyland”' },
    { at: iso(now - 112 * day), by: 'kwc', text: 'approved “Railway clearance monitoring at Hong Kong Disneyland” and assigned mentor Austin' },
    { at: iso(now - 9 * day), by: 'marcus', text: 'submitted proposal “Rain-aware walking routes for Hong Kong” (Samsung SFT)' },
    { at: iso(now - 7 * day), by: 'wkh', text: 'endorsed “Rain-aware walking routes for Hong Kong”' },
    { at: iso(now - 3 * day), by: 'ethan', text: 'submitted proposal “Seeing airflow with a phone” (ISEF)' },
  ];

  audit.sort((a, b) => b.at.localeCompare(a.at));
  return RCP.addExamples({ version: RCP.SEED_VERSION, users, competitions, projects, postings, mail, audit, customDates: [] });
};

// Additional examples are merged once without replacing existing browser work.
RCP.addExamples = function (db) {
  if (db.examplesRevision === 1) return db;
  const now = Date.now(), day = 86400000;
  const at = (days) => new Date(now - days * day).toISOString();
  const done = (...keys) => Object.fromEntries(RCP.ACCOUNTABILITY.map(([k]) => [k, keys.includes(k)]));
  const file = (id, name, category, by, content) => ({ id, name, category, by, at: at(2), type: name.endsWith('.csv') ? 'text/csv' : 'application/pdf', size: content.length, sampleContent: content });
  const rows = [
    ['draft', 'Classroom air quality sensor', 'ethan', 'lml', 'hkstic', 'draft', 'Compare CO2 readings in three classrooms before and after opening the windows. Calibrate against a borrowed reference sensor and report the measurement error.'],
    ['returned', 'Solar charging station for the playground', 'ryan', 'wkh', 'sft', 'returned', 'Measure the energy collected by a small solar panel and test whether it can power a USB charging station during lunchtime.'],
    ['rejected', 'Automatic recycling bin sorter', 'owen', 'cal', 'hksspc', 'rejected', 'Classify clean paper, plastic and metal using a camera and test the accuracy on a labelled set of 120 items.'],
    ['active', 'Water quality logger for the school pond', 'ethan', 'lml', 'hksspc', 'active', 'Log temperature and turbidity for four weeks, compare against manual readings and document sensor drift.'],
    ['submitted', 'Low-cost vibration monitor for lab motors', 'marcus', 'wkh', 'hkstic', 'submitted', 'Use an accelerometer to detect a loose motor mounting and compare the results with a securely mounted motor at three speeds.'],
    ['completed', 'Reusable filter for microplastics', 'aaron', 'lml', 'hksspc', 'completed', 'Compare three mesh sizes using prepared water samples and calculate the recovery rate over five repeated trials.'],
    ['full', 'Leaf disease detection on school tablets', 'marcus', 'lml', 'geneva', 'review', 'Compare a compact image classifier with a larger model on the same 300 leaf images and measure accuracy and tablet inference time.'],
    ['teacher', 'Mapping heat around the school campus', 'owen', 'wkh', null, 'review', 'Students will measure surface temperature at twelve campus locations and compare shade, paving and vegetation during the lunch break.'],
  ];
  const approvedKeys = ['proposal', 'endorsement', 'experience', 'decision', 'mentor', 'logs'];
  for (const [key, title, member, teacher, competitionId, status, abstract] of rows) {
    const id = 'demo-' + key;
    if (db.projects.some(p => p.id === id)) continue;
    const advanced = ['active', 'submitted', 'completed'].includes(status);
    const p = { id, example: true, stage: competitionId ? 2 : 1, origin: key === 'teacher' ? 'teacher' : 'student', title, abstract,
      competitionId, partner: null, members: [member], teacherId: teacher, mentorId: advanced ? 'kho' : null,
      experience: 'Sample team experience: PRISM sensor workshop, Python data analysis and a completed classroom measurement exercise.',
      status, createdAt: at(24), endorsement: status === 'draft' ? null : { by: teacher, at: at(22), note: status === 'returned' ? 'Add a power budget and explain how you will protect the wiring from rain.' : 'The measurement plan is suitable for the team.', ...(status === 'returned' ? {declined: true} : {}) },
      decision: advanced || status === 'rejected' ? { by: 'kwc', at: at(20), outcome: status === 'rejected' ? 'rejected' : 'approved', note: status === 'rejected' ? 'The scope overlaps an existing team. Please discuss a different research question with your teacher.' : 'Approved with monthly updates.' } : null,
      checklist: advanced ? done(...approvedKeys, ...(status !== 'active' ? ['final'] : []), ...(status === 'completed' ? ['result'] : [])) : done('proposal', 'experience', ...(status !== 'draft' && status !== 'returned' ? ['endorsement'] : []), ...(status === 'rejected' ? ['decision'] : [])),
      logs: advanced ? [{ id: id + '-log', date: at(3).slice(0,10), at: at(3), by: member, text: 'Repeated the calibration five times. The mean difference was 0.8 units; raw measurements are attached. Next we will test the sensor outdoors.', files: [id + '-measurements'], comments: [{ by: 'kho', at: at(2), text: 'Include the spread of the readings as well as the mean, and keep the reference conditions the same.' }] }] : [], files: [] };
    p.files.push(file(id + '-proposal', 'sample-proposal.pdf', 'Proposal', member, RCP.makePdf('Sample proposal: ' + title, ['', 'Every person, project and file in this prototype is fictional.', '', 'Abstract', abstract, '', 'Method', 'Repeat each measurement five times under the same conditions.', '', 'Success criterion', 'Report error against a reference measurement.'])));
    if (advanced) p.files.push(file(id + '-measurements', 'sample-measurements.csv', 'Progress log', member, 'trial,reference,sensor\n1,10,10.7\n2,10,10.9\n3,10,10.8\n4,10,10.6\n5,10,11.0\n'));
    if (['submitted', 'completed'].includes(status)) p.files.push(file(id + '-final', 'sample-final-report.pdf', 'Final submission', member, RCP.makePdf('Sample final report: ' + title, ['', 'Every person, project and file in this prototype is fictional.', '', 'Results', 'Five calibration trials gave a mean sensor reading of 10.8 against a reference of 10.0.', '', 'Conclusion', 'The sensor requires an offset correction of -0.8.'])));
    if (status === 'completed') p.result = 'Sample result: school research showcase, commendation for experimental method.';
    db.projects.push(p);
    if (p.decision) db.audit.unshift({ at: p.decision.at, by: 'kwc', text: 'recorded a sample committee decision for “' + title + '”', projectId: id });
    if (status === 'returned') db.mail.push({ id: 'demo-return-mail', to: member, from: 'system', at: at(22), subject: 'Changes requested: ' + title, body: p.endorsement.note, action: { label: 'Revise application', href: '#/apply/' + id }, read: false });
  }
  // Two approved Geneva entries fill its two sample places.
  for (let i = 1; i <= 2; i++) {
    const id = 'demo-geneva-' + i;
    if (!db.projects.some(p => p.id === id)) db.projects.push({ ...structuredClone(db.projects.find(p => p.id === 'demo-active')), id, title: ['Portable braille label printer', 'Passive cooling sleeve for water bottles'][i-1], abstract: ['Build a portable label printer with embossed braille dots and compare tactile readability across three dot heights.', 'Compare three sleeve materials under the same ambient conditions and measure how quickly a chilled water bottle warms.'][i-1], experience: 'PRISM prototyping workshop and repeated measurement exercises.', competitionId: 'geneva', members: [i === 1 ? 'trevor' : 'jaden'], files: [], logs: [], checklist: done('proposal', 'endorsement', 'experience', 'decision', 'mentor') });
  }
  const schlieren = db.projects.find(p => p.id === 'p-schlieren');
  if (schlieren && !schlieren.files.length) schlieren.files.push(file('demo-cv', 'sample-student-cv.pdf', 'Experience evidence', 'ethan', RCP.makePdf('Sample student CV: Ethan Lau', ['', 'Every person in this prototype is fictional.', '', 'Ethan Lau, 10C', 'HKYPT team member: assembled the optics rig and analysed camera frames.', 'PRISM workshop: Python and sensor calibration.'])));
  const vision = db.postings.find(o => o.id === 'o-vision');
  if (vision && !(vision.files || []).length) vision.files = [file('demo-brief', 'sample-project-brief.pdf', 'Proposal', 'david', RCP.makePdf('Project brief: construction-site safety detector', ['', 'Every person, project and file in this prototype is fictional.', '', 'Task', 'Use a synthetic image set to compare false positives and missed detections.', '', 'Deliverables', 'A labelled dataset, a baseline model and a short evaluation report. No real site footage is included.']))];
  db.customDates ||= [];
  if (!db.customDates.length) db.customDates.push({ id: 'demo-deadline-1', projectId: 'demo-active', title: 'Mentor call: review drift data', date: new Date(now + 12 * day).toISOString().slice(0, 10), by: 'kho', createdAt: at(10) });
  db.examplesRevision = 1;
  db.audit.sort((a,b) => b.at.localeCompare(a.at));
  return db;
};

// Calendar milestones checked against CMS Proposal v3, slides 6–8.
// Dates without a year are placed in the prototype's 2026–27 planning year.
RCP.CALENDAR_EVENTS = [
  {id:'sft-open', comp:'sft', label:'Registration opens', date:'2026-09-03', when:'3 September 2026', month:9, kind:'registration', slide:7},
  {id:'sft-register', comp:'sft', label:'Registration closes', date:'2026-10-16', when:'16 October 2026', month:10, kind:'registration', slide:7},
  {id:'sft-proposal', comp:'sft', label:'Proposal due', date:'2026-11-20', when:'20 November 2026', month:11, kind:'proposal', slide:7},
  {id:'sft-workshops', comp:'sft', label:'Prototype workshops', when:'January–March 2027', months:[1,2,3], kind:'workshop', slide:7},
  {id:'isef-register', comp:'isef', label:'HK selection registration', when:'By mid-October 2026', month:10, kind:'registration', slide:6},
  {id:'isef-judging', comp:'isef', label:'HK selection judging', when:'November 2026', month:11, kind:'judging', slide:6},
  {id:'isef-final', comp:'isef', label:'International final', date:'2027-05-08', end:'2027-05-14', when:'8–14 May 2027', month:5, kind:'final', slide:6},
  {id:'geneva-selection', comp:'geneva', label:'HK delegation selection', when:'November–December 2026', months:[11,12], kind:'selection', slide:6},
  {id:'geneva-final', comp:'geneva', label:'International exhibition', when:'March 2027', month:3, kind:'final', slide:6},
  {id:'hksspc-nominations', comp:'hksspc', label:'School nominations', when:'December 2026–January 2027', months:[12,1], kind:'nomination', slide:6},
  {id:'hksspc-final', comp:'hksspc', label:'Final judging', when:'April 2027', month:4, kind:'judging', slide:6},
  {id:'hkstic-registration', comp:'hkstic', label:'Registration closes', when:'By mid-January 2027', month:1, kind:'registration', slide:6},
  {id:'hkstic-final', comp:'hkstic', label:'Final exhibition', when:'March–April 2027', months:[3,4], kind:'final', slide:6},
  {id:'gtc-registration', comp:'gtc', label:'Registration', when:'Open at the time of the proposal; closing date not given', kind:'registration', slide:7},
  {id:'gtc-final', comp:'gtc', label:'Competition final', date:'2027-01-09', when:'9 January 2027', month:1, kind:'final', slide:7},
  {id:'gystb-route', comp:'gystb', label:'Entry through HKSSPC', when:'Summer; date TBC', kind:'referral', slide:7},
  {id:'apcys-route', comp:'apcys', label:'Entry through HKSSPC', when:'Date and host TBC', kind:'referral', slide:7},
  {id:'other-route', comp:'other', label:'Committee review', when:'Case by case', kind:'selection', slide:7},
];
RCP.CALENDAR_PREP = {
  registration: ['Prepare the proposal and team details.', 'Obtain teacher endorsement and committee approval.', 'Confirm a school place before registering.'],
  proposal: ['Finish the proposal and attach the version to be submitted.', 'Ask the teacher and mentor to review it.', 'Submit to the organiser and keep a copy of the confirmation.'],
  selection: ['Prepare the proposal and evidence of previous experience.', 'Obtain teacher endorsement and a committee decision.', 'Confirm the nomination route and available school places.'],
  nomination: ['Prepare the proposal and team experience.', 'Obtain teacher endorsement and committee approval.', 'Confirm the school nomination and allocated place.'],
  judging: ['Update the progress logs and attach supporting evidence.', 'Prepare the report and presentation for teacher and mentor review.', 'Check the organiser’s submission and judging instructions.'],
  final: ['Prepare the final report and presentation with teacher and mentor feedback.', 'Upload the submitted files and record final submission on the project.', 'Confirm the organiser’s arrangements; record the result afterwards.'],
  workshop: ['Bring the current prototype and an updated progress log.', 'Agree the next steps with the teacher and Old Boy mentor.', 'Check workshop attendance and materials with the organiser.'],
  referral: ['Follow the HKSSPC nomination route first.', 'Ask the committee to confirm selection and the event dates.', 'Prepare the final submission after the invitation is confirmed.'],
};
RCP.applyCalendarProposal = function(db) {
  if (db.calendarRevision === 1) return db;
  const fields = {
    isef: {deadline:null, deadlineWindow:'By mid-October 2026'},
    geneva: {deadline:null, deadlineWindow:'November–December 2026 selection'},
    hksspc: {deadline:null, deadlineWindow:'December 2026–January 2027 nominations'},
    hkstic: {deadline:null, deadlineWindow:'By mid-January 2027'},
    gtc: {deadline:null, deadlineWindow:'Registration open; closing date not given'},
    sft: {deadline:'2026-10-16', deadlineWindow:'16 October 2026 (planning year)'},
  };
  for (const c of db.competitions) if (fields[c.id]) Object.assign(c, fields[c.id]);
  db.calendarRevision = 1;
  return db;
};
