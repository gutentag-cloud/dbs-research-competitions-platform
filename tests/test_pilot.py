import base64, http.cookiejar, importlib.util, json, tempfile, threading, unittest, urllib.error, urllib.request
from pathlib import Path
spec=importlib.util.spec_from_file_location('pilot',Path(__file__).resolve().parents[1]/'server.py'); pilot=importlib.util.module_from_spec(spec);spec.loader.exec_module(pilot)

class PilotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();pilot.DATA=Path(cls.temp.name);pilot.init()
        cls.server=pilot.ThreadingHTTPServer(('127.0.0.1',0),pilot.Handler);cls.origin='http://127.0.0.1:'+str(cls.server.server_port);pilot.ORIGIN=cls.origin
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        with pilot.db() as c:
            c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?)',('admin','admin@example.test','Admin','committee',pilot.password_hash('test password 123'),1,'[]'))
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.temp.cleanup()
    def client(self):return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def request(self,client,path,data=None,csrf='',origin=None):
        headers={'Origin':self.origin if origin is None else origin,'X-CSRF-Token':csrf}
        if data is not None:headers['Content-Type']='application/json'
        req=urllib.request.Request(self.origin+'/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
        try:
            with client.open(req) as r:
                raw=r.read();return r.status,json.loads(raw) if 'application/json' in r.headers.get('Content-Type','') else raw
        except urllib.error.HTTPError as ex:
            with ex: return ex.code,json.loads(ex.read())
    def test_full_partner_pilot(self):
        admin=self.client();anonymous=self.client()
        self.assertEqual(self.request(anonymous,'state')[0],401)
        code,res=self.request(admin,'login',{'email':'admin@example.test','password':'test password 123'});self.assertEqual(code,200);csrf=res['csrf']
        self.assertEqual(self.request(admin,'update',{'project':'disney','body':'test'},origin='https://evil.test',csrf=csrf)[0],403)
        self.assertEqual(self.request(admin,'update',{'project':'disney','body':'test'})[0],403)
        def invite(email,proj,role='partner'):
            code,r=self.request(admin,'invite',{'email':email,'name':email,'role':role,'projects':[proj]},csrf);self.assertEqual(code,200)
            token=r['url'].split('#invite=')[1];cl=self.client()
            self.assertEqual(self.request(cl,'accept-invite',{'email':'wrong@example.test','password':'test password 123','token':token})[0],400)
            code,r=self.request(cl,'accept-invite',{'email':email,'password':'test password 123','token':token});self.assertEqual(code,200)
            self.assertEqual(self.request(self.client(),'accept-invite',{'email':email,'password':'test password 123','token':token})[0],400)
            return cl,r['csrf'],r['user']['id']
        disney,dc,di=invite('disney@example.test','disney');pwc,pc,pi=invite('pwc@example.test','pwc');team,tc,ti=invite('team@example.test','disney','team')
        self.assertEqual(self.request(disney,'invite',{},dc)[0],403)
        self.assertEqual(self.request(disney,'upload',{'project':'disney'},dc)[0],403)
        self.assertEqual(self.request(pwc,'feedback',{'project':'disney','rating':5,'body':'wrong project'},pc)[0],403)
        self.assertEqual(self.request(team,'upload',{'project':'disney','name':'brief.txt','content':base64.b64encode(b'private brief').decode()},tc)[0],200)
        _,a=self.request(admin,'state');doc=a['documents'][0]['id']
        self.assertEqual(self.request(disney,'documents/'+doc)[0],404)
        self.assertEqual(self.request(disney,'state')[1]['documents'],[])
        self.assertEqual(self.request(admin,'share',{'id':doc,'users':[pi]},csrf)[0],400)
        self.assertEqual(self.request(admin,'share',{'id':doc,'users':[di]},csrf)[0],200)
        self.assertEqual(self.request(disney,'documents/'+doc),(200,b'private brief'))
        self.assertEqual(self.request(pwc,'documents/'+doc)[0],404)
        self.assertEqual(self.request(admin,'share',{'id':doc,'users':[]},csrf)[0],200)
        self.assertEqual(self.request(disney,'documents/'+doc)[0],404)
        self.assertEqual(self.request(team,'update',{'project':'disney','body':'Internal note','shared':True},tc)[0],200)
        self.assertEqual(self.request(disney,'state')[1]['updates'],[])
        self.assertEqual(self.request(admin,'update',{'project':'disney','body':'Approved partner update','shared':True},csrf)[0],200)
        self.assertEqual(len(self.request(disney,'state')[1]['updates']),1)
        self.assertEqual(self.request(disney,'feedback',{'project':'disney','body':'Useful pilot','rating':4},dc)[0],200)
        _,a=self.request(admin,'state');self.assertEqual(len(a['feedback']),1)
        self.assertFalse(any('signed in' in x['body'] for x in a['activity']))
        self.assertEqual(self.request(admin,'feedback-status',{'id':a['feedback'][0]['id'],'status':'Reviewing'},csrf)[0],200)
        self.assertEqual(self.request(disney,'state')[1]['feedback'][0]['status'],'Reviewing')
        self.assertEqual(self.request(pwc,'state')[1]['feedback'],[])
        self.assertEqual(self.request(admin,'account',{'id':di,'active':False,'projects':['disney']},csrf)[0],200)
        self.assertEqual(self.request(disney,'state')[0],401)
        self.assertEqual(self.request(disney,'login',{'email':'disney@example.test','password':'test password 123'})[0],401)
        self.assertEqual(self.request(admin,'logout',{},csrf)[0],200)
        self.assertEqual(self.request(admin,'state')[0],401)
    def test_no_private_static_paths(self):
        for path in ['/.pilot-data/pilot.sqlite3','/server.py','/data.js','/store.js','/../server.py']:
            try:urllib.request.urlopen(self.origin+path);self.fail(path)
            except urllib.error.HTTPError as ex:
                with ex: self.assertEqual(ex.code,404)

if __name__=='__main__':unittest.main()
