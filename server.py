"""DBS partner pilot. Standard-library server with SQLite and private file storage."""
import argparse, base64, getpass, hashlib, hmac, json, os, secrets, sqlite3, time
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get('PILOT_DATA_DIR', str(ROOT / '.pilot-data')))
ORIGIN = os.environ.get('PILOT_ORIGIN', 'http://localhost:4180').rstrip('/')
PROJECTS = [dict(id='disney', partner='Disney', title='Railway clearance monitoring', description='A workspace for the Disney R&D pilot. Confirm the scope with the project team before inviting partners.'), dict(id='pwc', partner='PwC Dark Lab', title='Cybersecurity R&D', description='A workspace for the PwC Dark Lab pilot. Add an approved brief and agree the scope with the partner.')]

@contextmanager
def db():
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    c = sqlite3.connect(DATA / 'pilot.sqlite3'); c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    try:
        with c: yield c
    finally: c.close()

def init():
    with db() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT,role TEXT,password TEXT,active INTEGER DEFAULT 1,projects TEXT);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER,csrf TEXT);
        CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,email TEXT,name TEXT,role TEXT,projects TEXT,expires INTEGER,used INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,project TEXT,name TEXT,owner TEXT REFERENCES users(id),approved INTEGER DEFAULT 0,created INTEGER);
        CREATE TABLE IF NOT EXISTS grants(doc_id TEXT REFERENCES documents(id),user_id TEXT REFERENCES users(id),PRIMARY KEY(doc_id,user_id));
        CREATE TABLE IF NOT EXISTS updates(id TEXT PRIMARY KEY,project TEXT,author TEXT REFERENCES users(id),body TEXT,shared INTEGER,created INTEGER);
        CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,project TEXT,author TEXT REFERENCES users(id),body TEXT,rating INTEGER,status TEXT DEFAULT 'New',created INTEGER);
        CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY,actor TEXT,project TEXT,body TEXT,created INTEGER);
        CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER,started INTEGER);
        ''')

def password_hash(p):
    salt = secrets.token_bytes(16)
    return base64.b64encode(salt + hashlib.pbkdf2_hmac('sha256', p.encode(), salt, 600000)).decode()

def password_ok(p, stored):
    try:
        raw = base64.b64decode(stored)
        return hmac.compare_digest(raw[16:], hashlib.pbkdf2_hmac('sha256', p.encode(), raw[:16], 600000))
    except Exception: return False

def digest(t): return hashlib.sha256(t.encode()).hexdigest()
def uid(): return secrets.token_hex(16)
def activity(c, u, project, text): c.execute('INSERT INTO activity(actor,project,body,created) VALUES(?,?,?,?)', (u['id'], project, text, int(time.time())))
def memberships(u): return json.loads(u['projects'])
def access(u, project): return project in [p['id'] for p in PROJECTS] and (u['role'] == 'committee' or project in memberships(u))
def visible(c, u, d):
    return access(u, d['project']) and (u['role'] != 'partner' or (d['approved'] and c.execute('SELECT 1 FROM grants WHERE doc_id=? AND user_id=?', (d['id'], u['id'])).fetchone()))
def public_user(u): return {k: u[k] for k in ['id','email','name','role','active']} | {'projects': memberships(u)}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass  # URLs can contain invite tokens; never log them.
    def reply(self, code, body, cookie=None):
        raw = json.dumps(body).encode(); self.send_response(code)
        self.send_header('Content-Type','application/json'); self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        if cookie: self.send_header('Set-Cookie', cookie)
        self.end_headers(); self.wfile.write(raw)
    def cookie(self, token, age):
        return f'pilot_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}' + ('; Secure' if ORIGIN.startswith('https://') else '')
    def session(self,c):
        cookies = dict(x.strip().split('=',1) for x in self.headers.get('Cookie','').split(';') if '=' in x)
        token = cookies.get('pilot_session','')
        s = c.execute('SELECT * FROM sessions WHERE token=? AND expires>?', (digest(token),time.time())).fetchone()
        u = c.execute('SELECT * FROM users WHERE id=? AND active=1',(s['user_id'],)).fetchone() if s else None
        return u,s
    def start_session(self,c,u):
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        c.execute('DELETE FROM sessions WHERE expires<?',(time.time(),))
        c.execute('INSERT INTO sessions VALUES(?,?,?,?)',(digest(token),u['id'],int(time.time())+28800,csrf))
        return token,csrf
    def do_GET(self):
        path = urlparse(self.path).path
        if not path.startswith('/api/'):
            files = {'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css','/assets/crest.png':'assets/crest.png'}
            if path not in files: return self.reply(404,{'error':'Not found'})
            p = ROOT / files[path]; raw = p.read_bytes(); self.send_response(200)
            self.send_header('Content-Type', {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png'}[p.suffix])
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            self.send_header('X-Content-Type-Options','nosniff'); self.end_headers(); self.wfile.write(raw); return
        with db() as c:
            u,s = self.session(c)
            if path == '/api/session': return self.reply(200,{'user':public_user(u) if u else None,'csrf':s['csrf'] if u else None})
            if not u: return self.reply(401,{'error':'Please sign in.'})
            if path == '/api/state':
                projects = [p for p in PROJECTS if access(u,p['id'])]
                docs = []
                for d in c.execute('SELECT * FROM documents ORDER BY created DESC'):
                    if visible(c,u,d):
                        item = dict(d); item['grants'] = [r[0] for r in c.execute('SELECT user_id FROM grants WHERE doc_id=?',(d['id'],))] if u['role'] == 'committee' else []
                        docs.append(item)
                updates = [dict(r) for r in c.execute('SELECT updates.*,users.name AS author_name FROM updates JOIN users ON users.id=updates.author ORDER BY created DESC') if access(u,r['project']) and (u['role'] != 'partner' or r['shared'])]
                feedback = [dict(r) for r in c.execute('SELECT feedback.*,users.name AS author_name FROM feedback JOIN users ON users.id=feedback.author ORDER BY created DESC') if access(u,r['project']) and (u['role'] != 'partner' or r['author']==u['id'])]
                events = [dict(r) for r in c.execute('SELECT activity.*,users.name AS author_name FROM activity LEFT JOIN users ON users.id=activity.actor ORDER BY created DESC LIMIT 50')] if u['role']=='committee' else []
                users = [public_user(r) for r in c.execute('SELECT * FROM users')] if u['role']=='committee' else []
                return self.reply(200,dict(projects=projects,documents=docs,updates=updates,feedback=feedback,activity=events,users=users))
            if path.startswith('/api/documents/'):
                d = c.execute('SELECT * FROM documents WHERE id=?',(path.rsplit('/',1)[-1],)).fetchone()
                if not d or not visible(c,u,d): return self.reply(404,{'error':'Document unavailable.'})
                raw = (DATA / 'files' / d['id']).read_bytes(); self.send_response(200)
                self.send_header('Content-Type','application/octet-stream'); self.send_header('Content-Disposition',"attachment; filename*=UTF-8''" + __import__('urllib.parse',fromlist=['quote']).quote(d['name']))
                self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff'); self.end_headers(); self.wfile.write(raw); return
            return self.reply(404,{'error':'Not found'})
    def do_POST(self):
        if self.headers.get('Origin') != ORIGIN: return self.reply(403,{'error':'Request origin rejected.'})
        try:
            length = int(self.headers.get('Content-Length','0'))
            if length < 1 or length > 15000000: return self.reply(413,{'error':'Maximum document size is 10 MB.'})
            data = json.loads(self.rfile.read(length))
            if not isinstance(data,dict): raise ValueError()
        except (ValueError,TypeError): return self.reply(400,{'error':'Invalid request.'})
        path = urlparse(self.path).path
        try:
            with db() as c:
                u,s = self.session(c)
                if path in ['/api/login','/api/accept-invite']:
                    key = self.client_address[0]
                    a = c.execute('SELECT * FROM attempts WHERE key=?',(key,)).fetchone()
                    if a and time.time()-a['started'] < 900 and a['count'] >= 10: return self.reply(429,{'error':'Too many attempts. Try again in 15 minutes.'})
                    if not a or time.time()-a['started'] >= 900: c.execute('INSERT OR REPLACE INTO attempts VALUES(?,0,?)',(key,int(time.time())))
                    c.execute('UPDATE attempts SET count=count+1 WHERE key=?',(key,))
                    email = str(data.get('email','')).strip().lower(); password = str(data.get('password',''))
                    if len(password)>256: return self.reply(400,{'error':'Password is too long.'})
                    if path == '/api/login':
                        u = c.execute('SELECT * FROM users WHERE email=? AND active=1',(email,)).fetchone()
                        if not u or not password_ok(password,u['password']): return self.reply(401,{'error':'Email or password is incorrect.'})
                    else:
                        inv = c.execute('SELECT * FROM invites WHERE token=? AND used=0 AND expires>?',(digest(str(data.get('token',''))),time.time())).fetchone()
                        if not inv or inv['email']!=email: return self.reply(400,{'error':'Invitation is invalid, expired, or for a different email.'})
                        if len(password)<12 or len(password)>256: return self.reply(400,{'error':'Use a password of 12–256 characters.'})
                        new_id=uid(); c.execute('INSERT INTO users(id,email,name,role,password,projects) VALUES(?,?,?,?,?,?)',(new_id,email,inv['name'],inv['role'],password_hash(password),inv['projects']))
                        c.execute('UPDATE invites SET used=1 WHERE token=?',(inv['token'],)); u=c.execute('SELECT * FROM users WHERE id=?',(new_id,)).fetchone()
                    c.execute('DELETE FROM attempts WHERE key=?',(key,)); token,csrf=self.start_session(c,u)
                    return self.reply(200,{'user':public_user(u),'csrf':csrf},self.cookie(token,28800))
                if not u: return self.reply(401,{'error':'Please sign in.'})
                if self.headers.get('X-CSRF-Token') != s['csrf']: return self.reply(403,{'error':'Please refresh and try again.'})
                if path=='/api/logout':
                    c.execute('DELETE FROM sessions WHERE token=?',(s['token'],)); return self.reply(200,{},self.cookie('',0))
                if path in ['/api/invite','/api/account','/api/share','/api/feedback-status'] and u['role']!='committee': return self.reply(403,{'error':'Committee access required.'})
                project=str(data.get('project',''))
                if path in ['/api/upload','/api/update','/api/feedback'] and not access(u,project): return self.reply(403,{'error':'Project access required.'})
                if path=='/api/invite':
                    email=str(data.get('email','')).strip().lower(); name=str(data.get('name','')).strip(); role=data.get('role'); projects=data.get('projects',[])
                    if role not in ['committee','team','partner'] or not name or '@' not in email or not isinstance(projects,list) or any(p not in ['disney','pwc'] for p in projects) or (role!='committee' and not projects): return self.reply(400,{'error':'Enter a name, email, role and workspace.'})
                    if c.execute('SELECT 1 FROM users WHERE email=?',(email,)).fetchone(): return self.reply(400,{'error':'This account already exists.'})
                    c.execute('UPDATE invites SET used=1 WHERE email=?',(email,)); token=secrets.token_urlsafe(32)
                    c.execute('INSERT INTO invites VALUES(?,?,?,?,?,?,0)',(digest(token),email,name,role,json.dumps(projects),int(time.time())+604800))
                    activity(c,u,None,'Created an invitation for '+email)
                    return self.reply(200,{'url':ORIGIN+'/#invite='+token,'expires':'7 days'})
                if path=='/api/account':
                    target=c.execute('SELECT * FROM users WHERE id=?',(data.get('id'),)).fetchone(); projects=data.get('projects',[])
                    if not target or target['id']==u['id'] or target['role']=='committee': return self.reply(400,{'error':'Manage other team and partner accounts here. Committee changes require the server administrator.'})
                    if not isinstance(projects,list) or any(p not in ['disney','pwc'] for p in projects): return self.reply(400,{'error':'Invalid workspace.'})
                    active=1 if data.get('active') else 0
                    c.execute('UPDATE users SET active=?,projects=? WHERE id=?',(active,json.dumps(projects),target['id']))
                    c.execute('DELETE FROM sessions WHERE user_id=?',(target['id'],))
                    c.execute('DELETE FROM grants WHERE user_id=?',(target['id'],))
                    activity(c,u,None,'Updated account access for '+target['email'])
                elif path=='/api/upload':
                    if u['role']=='partner': return self.reply(403,{'error':'Only the project team can upload documents.'})
                    name=Path(str(data.get('name',''))).name[:200]; raw=base64.b64decode(data.get('content',''),validate=True)
                    if not name or not raw or len(raw)>10485760: return self.reply(400,{'error':'Choose a file up to 10 MB.'})
                    doc_id=uid(); folder=DATA/'files'; folder.mkdir(exist_ok=True,mode=0o700); (folder/doc_id).write_bytes(raw)
                    c.execute('INSERT INTO documents VALUES(?,?,?,?,0,?)',(doc_id,project,name,u['id'],int(time.time()))); activity(c,u,project,'Uploaded '+name+' for internal review')
                elif path=='/api/share':
                    d=c.execute('SELECT * FROM documents WHERE id=?',(data.get('id'),)).fetchone(); ids=data.get('users',[])
                    if not d or not isinstance(ids,list): return self.reply(400,{'error':'Document unavailable.'})
                    for user_id in ids:
                        partner=c.execute("SELECT * FROM users WHERE id=? AND role='partner' AND active=1",(user_id,)).fetchone()
                        if not partner or not access(partner,d['project']): return self.reply(400,{'error':'Select active partners assigned to this workspace.'})
                    c.execute('UPDATE documents SET approved=? WHERE id=?',(1 if ids else 0,d['id'])); c.execute('DELETE FROM grants WHERE doc_id=?',(d['id'],))
                    c.executemany('INSERT INTO grants VALUES(?,?)',[(d['id'],x) for x in set(ids)]); activity(c,u,d['project'],'Updated partner access for '+d['name'])
                elif path=='/api/update':
                    if u['role']=='partner': return self.reply(403,{'error':'Only the project team can post updates.'})
                    body=str(data.get('body','')).strip()[:10000]
                    if not body: return self.reply(400,{'error':'Write an update first.'})
                    shared=1 if u['role']=='committee' and data.get('shared') else 0
                    c.execute('INSERT INTO updates VALUES(?,?,?,?,?,?)',(uid(),project,u['id'],body,shared,int(time.time()))); activity(c,u,project,'Posted a project update')
                elif path=='/api/feedback':
                    body=str(data.get('body','')).strip()[:10000]; rating=int(data.get('rating',0))
                    if not body or rating not in range(1,6): return self.reply(400,{'error':'Add feedback and a rating from 1 to 5.'})
                    c.execute('INSERT INTO feedback(id,project,author,body,rating,created) VALUES(?,?,?,?,?,?)',(uid(),project,u['id'],body,rating,int(time.time()))); activity(c,u,project,'Submitted pilot feedback')
                elif path=='/api/feedback-status':
                    status=data.get('status')
                    if status not in ['New','Reviewing','Resolved']: return self.reply(400,{'error':'Invalid status.'})
                    c.execute('UPDATE feedback SET status=? WHERE id=?',(status,data.get('id')))
                else: return self.reply(404,{'error':'Not found'})
                return self.reply(200,{'ok':True})
        except (ValueError,TypeError,sqlite3.IntegrityError): return self.reply(400,{'error':'Invalid request or account already exists.'})
        except Exception: return self.reply(500,{'error':'Request could not be completed. Contact the administrator.'})

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--create-admin',action='store_true'); parser.add_argument('--reset-password',action='store_true'); parser.add_argument('--port',type=int,default=int(os.environ.get('PORT','4180'))); args=parser.parse_args(); init()
    if args.create_admin or args.reset_password:
        email=input('Account email: ').strip().lower(); password=getpass.getpass('Password (at least 12 characters): ')
        if '@' not in email or len(password)<12: raise SystemExit('A valid email and a password of at least 12 characters are required.')
        with db() as c:
            if args.reset_password:
                u=c.execute('SELECT id FROM users WHERE email=?',(email,)).fetchone()
                if not u: raise SystemExit('Account not found.')
                c.execute('UPDATE users SET password=? WHERE email=?',(password_hash(password),email)); c.execute('DELETE FROM sessions WHERE user_id=?',(u['id'],))
            else: c.execute('INSERT INTO users(id,email,name,role,password,projects) VALUES(?,?,?,?,?,?)',(uid(),email,input('Name: ').strip(),'committee',password_hash(password),'[]'))
        print('Account saved.'); raise SystemExit()
    if ORIGIN.startswith('http://') and 'localhost' not in ORIGIN and '127.0.0.1' not in ORIGIN: raise SystemExit('Use an HTTPS PILOT_ORIGIN for deployment.')
    print('Pilot server listening on port',args.port); ThreadingHTTPServer(('0.0.0.0',args.port),Handler).serve_forever()
