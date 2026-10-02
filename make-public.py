#!/usr/bin/env python3
"""Build the public, de-identified copy of the prototype.

The working copy in this folder keeps the school's name, crest and the real committee
members. The public build replaces all of that with a fictional school and fictional
people, so a public link carries no school branding and no real person's name.

    python3 make-public.py          # writes public-build/
"""
import pathlib
import re
import shutil
import sys

SRC = pathlib.Path(__file__).parent
OUT = SRC / 'public-build'
FILES = ['index.html', 'styles.css', 'data.js', 'store.js', 'app.js']

# Ordered: longer phrases first so they are replaced before their parts.
REPLACEMENTS = [
    # --- product name first, before the generic 'DBS ' rule ---
    ('DBS Research &amp; Competitions Platform', 'Research &amp; Competitions Platform'),
    ('DBS Research & Competitions Platform', 'Research & Competitions Platform'),
    # --- school, programmes and partners ---
    ("Diocesan Boys' School · PRISM · DSOBA", 'Proof of concept · demo data · fictional school'),
    ("Diocesan Boys’ School", 'Fairview College'),
    ("Diocesan Boys' School", 'Fairview College'),
    ('PRISM (DBS Robotics)', 'the robotics programme'),
    ('DBS Robotics', 'the robotics programme'),
    ('PRISM', 'the robotics programme'),
    ('DSOBA representative', 'Alumni association representative'),
    ('DSOBA', 'the alumni association'),
    ('Hong Kong Disneyland (via the robotics programme)', 'City theme park (via the robotics programme)'),
    ('Hong Kong Disneyland', 'a city theme park'),
    ('PwC Hong Kong', 'a professional services firm'),
    ('CMS Proposal v3, slides 6–9', 'the platform proposal'),
    ('CMS Proposal v3', 'the platform proposal'),
    ('Disneyland railway project', 'theme park railway project'),
    ('the PwC project log', 'the partner-firm project log'),
    ('the DBS name', 'the school name'),
    ('the DBS name, with the places DBS has', 'the school name, with the places the school has'),
    ('DBS places', 'School places'),
    ('DBS alumni', 'alumni'),
    ('DBS ', 'school '),
    ('dbs-research-competitions-register.csv', 'research-competitions-register.csv'),
    ('dbs-rcp', 'rcp-demo'),
    ('@dsoba.example', '@alumni.example'),
    ('@g.dbs.example', '@students.school.example'),
    ('@dbs.example', '@school.example'),
    ('@alumni.example', '@alumni.example'),
    # --- alumni wording ---
    ('Old Boy-initiated', 'Alumni-initiated'),
    ('Old Boy mentors', 'alumni mentors'),
    ('Old Boy mentor', 'alumni mentor'),
    ('Old Boy projects', 'Alumni projects'),
    ('Old Boy applicants', 'alumni applicants'),
    ('Old Boy-run', 'alumni-run'),
    ('Old Boy posts a project', 'Alumnus posts a project'),
    ('Old Boys', 'alumni'),
    ('Old Boy', 'alumnus'),
    ('old boy', 'alumnus'),
    # --- committee and staff (real people → fictional) ---
    ('Dean Cho', 'Dr. Ada Mensah'),
    ('Mr. Cho Ka Wai', 'Dr. Ada Mensah'),
    ('Mr. Chan Long Tin', 'Mr. Alan Reid'),
    ('Mr. Lee Chi Kong Alfred', 'Mr. Peter Novak'),
    ('Ms. Chan Sze Man', 'Ms. Clara Ortiz'),
    ('Mr. Wan Chi Yin', 'Mr. Ian Brooks'),
    ('(WCY)', '(IB)'),
    ('Ms. Lam Miu Lan', 'Dr. Maya Rosen'),
    ('Mr. Au Ka Lok', 'Mr. Owen Hart'),
    ('Mr. Ku Ka Chun', 'Mr. Kurt Keller'),
    ('Mr. Wong Kwok Wai', 'Mr. William Reeves'),
    ('Ms. Tang Hung Yuk', 'Ms. Theresa Holt'),
    ('Mr. Chow Kevin Chi Tsun', 'Mr. Kelvin Chow'),
    ('Mr. Ng Chun Ho', 'Mr. Nathan Ng'),
    ('Mr. Pahilwani Vijay Kishan', 'Mr. Vikram Patel'),
    ('Dr. Kelvin Ho (2008)', 'Dr. Ravi Menon (2008)'),
    ('Trevor Chak', 'Leo Fischer'),
    ('Jaden Wong', 'Noah Kim'),
    ("initials: 'KCW'", "initials: 'AM'"),
    ("initials: 'LTC'", "initials: 'AR'"),
    ("initials: 'CAL'", "initials: 'PN'"),
    ("initials: 'KSM'", "initials: 'CO'"),
    ("initials: 'WCY'", "initials: 'IB'"),
    ("initials: 'LML'", "initials: 'MR'"),
    ("initials: 'AKL'", "initials: 'OH'"),
    ("initials: 'KKC'", "initials: 'KK'"),
    ("initials: 'WKW'", "initials: 'WR'"),
    ("initials: 'THY'", "initials: 'TH'"),
    ("initials: 'CKC'", "initials: 'KC'"),
    ("initials: 'NCH'", "initials: 'NN'"),
    ("initials: 'PVK'", "initials: 'VP'"),
    ("initials: 'WKH'", "initials: 'IB'"),
    ("initials: 'LML'", "initials: 'MR'"),
    ('(KWC)', '(AM)'), ('(LTC)', '(AR)'), ('(CAL)', '(PN)'),
    ('(KSM)', '(CO)'), ('(WKH)', '(IB)'), ('(LML)', '(MR)'),
    # mentors: first-name-only alumni in the seed data
    ("name: 'Austin'", "name: 'Ben Carter'"),
    ("name: 'Isaac'", "name: 'Omar Haddad'"),
    ("name: 'David'", "name: 'Wei Lin'"),
    ("mentor Austin", "mentor Ben Carter"),
    ("'Austin'", "'Ben Carter'"), ("'Isaac'", "'Omar Haddad'"), ("'David'", "'Wei Lin'"),
    ('>Austin<', '>Ben Carter<'), ('>Isaac<', '>Omar Haddad<'), ('>David<', '>Wei Lin<'),
    ('Austin · Isaac · David', 'Ben Carter · Omar Haddad · Wei Lin'),
    ('Austin', 'Ben Carter'), ('Isaac', 'Omar Haddad'),
    # --- project ids and remaining bare first names ---
    ('p-disney', 'p-railway'), ('p-pwc', 'p-domains'),
    ('const pwc = ', 'const overdueProject = '), ('logDue(pwc)', 'logDue(overdueProject)'),
    ('Trevor', 'Leo'), ('Jaden', 'Noah'), ('David', 'Wei Lin'), ('Kelvin', 'Ravi'),
    # --- account ids (they appear in the page markup) ---
    ("'trevor'", "'leo'"), ('"trevor"', '"leo"'),
    ("'jaden'", "'noah'"), ('"jaden"', '"noah"'),
    ("'austin'", "'ben'"), ('"austin"', '"ben"'),
    ("'isaac'", "'omar'"), ('"isaac"', '"omar"'),
    ("'david'", "'wei'"), ('"david"', '"wei"'),
    ("'kwc'", "'dean'"), ('"kwc"', '"dean"'),
    ("'ltc'", "'tic1'"), ("'cal'", "'tic2'"), ("'ksm'", "'tic3'"),
    ("'wkh'", "'tic4'"), ("'lml'", "'tic5'"), ("'kho'", "'mentor4'"),
    # emails and leftover variable names
    ('trevor@', 'leo@'), ('jaden@', 'noah@'), ('austin@', 'ben@'), ('isaac@', 'omar@'),
    ('david@', 'wei@'), ('kwc@', 'dean@'), ('ltc@', 'tic1@'), ('cal@', 'tic2@'),
    ('ksm@', 'tic3@'), ('wkh@', 'tic4@'), ('lml@', 'tic5@'), ('kho@', 'mentor4@'),
    ('const trevor = ', 'const dual = '), ('trevor.roles', 'dual.roles'),
    ("'Trevor should hold both roles'", "'the dual-role account should hold both roles'"),
    # --- branding assets and titles ---
    ('assets/crest.png', 'assets/mark.svg'),
    ('alt="Diocesan Boys\' School crest"', 'alt=""'),
]

# Words that must not survive into the public build.
FORBIDDEN = ['DBS', 'Diocesan', 'DSOBA', 'PRISM', 'Disneyland', 'PwC', 'Old Boy',
             'Dean Cho', 'Cho Ka Wai', 'Chan Long Tin', 'Lee Chi Kong', 'Chan Sze Man',
             'Wan Chi Yin', 'Lam Miu Lan', 'Au Ka Lok', 'Ku Ka Chun', 'Wong Kwok Wai',
             'Tang Hung Yuk', 'Chow Kevin', 'Ng Chun Ho', 'Pahilwani',
             'Wong Ka Ho', 'Lam Mei Ling', 'Kelvin Ho', 'Trevor Chak', 'Jaden Wong',
             r'\bKWC\b', r'\bKCW\b', r'\bLTC\b', r'\bCAL\b', r'\bKSM\b', r'\bWCY\b', r'\bLML\b',
             r'\bAKL\b', r'\bKKC\b', r'\bWKW\b', r'\bTHY\b', r'\bNCH\b', r'\bPVK\b',
             r'\bWKH\b',
             r"\btrevor\b", r"\bjaden\b", r"\baustin\b", r"\bisaac\b",
             r"\bTrevor\b", r"\bJaden\b", r"\bDavid\b", r"\bAustin\b", r"\bIsaac\b",
             r"\bdisney\b", r"\bDisney\b", r"\bpwc\b", r"\bPwC\b"]

MARK = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="">
  <rect width="64" height="64" rx="10" fill="#13235b"/>
  <path d="M18 44V20h12a8 8 0 0 1 0 16h-6l9 8" fill="none" stroke="#b8912f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
'''


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / 'assets').mkdir(parents=True)
    (OUT / 'assets' / 'mark.svg').write_text(MARK)

    problems = []
    for name in FILES:
        text = (SRC / name).read_text()
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        (OUT / name).write_text(text)
        for word in FORBIDDEN:
            pattern = word if word.startswith('\\b') else re.escape(word)
            for line_no, line in enumerate(text.splitlines(), 1):
                if re.search(pattern, line):
                    problems.append(f'{name}:{line_no}: still contains “{word}”: {line.strip()[:110]}')

    print(f'Public build written to {OUT}')
    if problems:
        print(f'\n{len(problems)} identifying term(s) left — fix the replacement list:')
        for p in problems[:40]:
            print('  ' + p)
        sys.exit(1)
    print('No school name, crest or real person left in the build.')


if __name__ == '__main__':
    main()
