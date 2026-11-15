import json,os,glob
K=json.load(open('keys.json')); done=set()
for f in glob.glob('ch/*.en'):
    for l in open(f.replace('.en','.txt')).read().split('\n'):
        if '\t' in l: done.add(l.split('\t',1)[1].replace('\\n','\n'))
todo=[k for k in K if k not in done]
for f in glob.glob('ch/*.txt'):
    if not os.path.exists(f.replace('.txt','.en')): os.remove(f)
start=len(glob.glob('ch/*.en')); N=110
for c in range(0,len(todo),N):
    open(f'ch/{start+c//N:02d}.txt','w').write('\n'.join(f'{start*1000+i}\t'+todo[i].replace('\n','\\n') for i in range(c,min(c+N,len(todo)))))
print('todo',len(todo),'chunks',(len(todo)+N-1)//N)
