s=open('shell.html').read()
s=s.replace('/*DATA*/',open('data.js').read()).replace('/*APP*/',open('app.js').read())
open('index.html','w').write(s)
