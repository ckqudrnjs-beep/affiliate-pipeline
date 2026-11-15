# ch/*.txt(원문) + ch/*.en(번역) → en.json {원문: 번역}
import glob,json
D={}
for f in sorted(glob.glob('ch/*.txt')):
    S=dict(l.split('\t',1) for l in open(f).read().split('\n') if '\t' in l)
    E=dict(l.split('\t',1) for l in open(f[:-4]+'.en').read().split('\n') if '\t' in l)
    for i,k in S.items():
        D[k.replace('\\n','\n')]=E[i].replace('\\n','\n')
for l in open('extra.tsv').read().split('\n'):
    if '\t' in l: k,v=l.split('\t',1); D[k.replace('\\n','\n')]=v.replace('\\n','\n')
json.dump(D,open('en.json','w'),ensure_ascii=False,indent=0)
print(len(D))
