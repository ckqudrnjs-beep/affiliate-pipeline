import sys
n=sys.argv[1]
L=open(f'/tmp/claude-0/t/e{n}.txt').read().rstrip('\n').split('\n')
src=open(f'ch/{n}.txt').read().split('\n')
assert len(L)==len(src),(len(L),len(src))
open(f'ch/{n}.en','w').write('\n'.join(s.split('\t')[0]+'\t'+e for s,e in zip(src,L)))
print('ok',n)
