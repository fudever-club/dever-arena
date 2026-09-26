/**
 * DEVER Arena — Oracle tham chiếu (Python) cho 5 bài seed.
 * Dùng để chấm hack: chạy victim và oracle trên cùng input, verdict thật.
 * Mỗi oracle đọc stdin dạng token-stream, in đáp án chuẩn.
 */

export const ORACLES = {
  // A. Cyber Energy Array — T cases, mỗi case: n k + n số; max window length K
  p101: `import sys
def main():
    t=list(map(int,sys.stdin.read().strip().split()))
    if not t: return
    it=iter(t); T=next(it); out=[]
    for _ in range(T):
        try: n=next(it); k=next(it)
        except StopIteration: break
        a=[next(it) for _ in range(n)]
        s=sum(a[:k]); best=s
        for i in range(k,n):
            s+=a[i]-a[i-k]
            if s>best: best=s
        out.append(str(best))
    sys.stdout.write("\\n".join(out))
main()`,
  // B. Big Product — S = ((sum)^2 - sumSq)/2
  p102: `import sys
def main():
    t=list(map(int,sys.stdin.read().strip().split()))
    if not t: return
    n=t[0]; a=t[1:1+n]
    s=sum(a); sq=sum(x*x for x in a)
    sys.stdout.write(str((s*s-sq)//2))
main()`,
  // C. Dijkstra 1 -> N
  p103: `import sys,heapq
def main():
    t=list(map(int,sys.stdin.read().strip().split()))
    if len(t)<2: return
    n,m=t[0],t[1]; g=[[] for _ in range(n+1)]; idx=2
    for _ in range(m):
        u,v,w=t[idx],t[idx+1],t[idx+2]; idx+=3
        if 1<=u<=n and 1<=v<=n: g[u].append((v,w)); g[v].append((u,w))
    INF=10**18; dist=[INF]*(n+1); dist[1]=0; pq=[(0,1)]
    while pq:
        d,u=heapq.heappop(pq)
        if d!=dist[u]: continue
        for v,w in g[u]:
            nd=d+w
            if nd<dist[v]: dist[v]=nd; heapq.heappush(pq,(nd,v))
    sys.stdout.write(str(-1 if dist[n]==INF else dist[n]))
main()`,
  // D. Tribonacci F(n)=F(n-1)+F(n-2)+F(n-3), F(0)=0? sample: N=4 -> 7
  // f(1)=1,f(2)=2,f(3)=4,f(4)=7 mod 1e9+7, matrix exponentiation O(log N)
  p104: `import sys
MOD=10**9+7
def mat_mul(a,b):
    return [[(a[0][0]*b[0][0]+a[0][1]*b[1][0]+a[0][2]*b[2][0])%MOD,
             (a[0][0]*b[0][1]+a[0][1]*b[1][1]+a[0][2]*b[2][1])%MOD,
             (a[0][0]*b[0][2]+a[0][1]*b[1][2]+a[0][2]*b[2][2])%MOD],
            [(a[1][0]*b[0][0]+a[1][1]*b[1][0]+a[1][2]*b[2][0])%MOD,
             (a[1][0]*b[0][1]+a[1][1]*b[1][1]+a[1][2]*b[2][1])%MOD,
             (a[1][0]*b[0][2]+a[1][1]*b[1][2]+a[1][2]*b[2][2])%MOD],
            [(a[2][0]*b[0][0]+a[2][1]*b[1][0]+a[2][2]*b[2][0])%MOD,
             (a[2][0]*b[0][1]+a[2][1]*b[1][1]+a[2][2]*b[2][1])%MOD,
             (a[2][0]*b[0][2]+a[2][1]*b[1][2]+a[2][2]*b[2][2])%MOD]]
def mat_pow(m,e):
    r=[[1,0,0],[0,1,0],[0,0,1]]
    while e:
        if e&1: r=mat_mul(r,m)
        m=mat_mul(m,m); e>>=1
    return r
def main():
    s=sys.stdin.read().strip().split()
    if not s: return
    n=int(s[0])
    if n==0: sys.stdout.write("0"); return
    if n==1: sys.stdout.write("1"); return
    if n==2: sys.stdout.write("2"); return
    T=[[1,1,1],[1,0,0],[0,1,0]]
    P=mat_pow(T,n-2)
    ans=(P[0][0]*2+P[0][1]*1+P[0][2]*0)%MOD
    sys.stdout.write(str(ans))
main()`,
  // E. XOR-basis max subset trên path U-V (parse n, n-1 edges, rồi từng cặp query)
  p105: `import sys
def basis_max(vals):
    b=[0]*61
    for x in vals:
        v=x
        for i in range(60,-1,-1):
            if not (v>>i)&1: continue
            if not b[i]: b[i]=v; break
            v^=b[i]
    ans=0
    for i in range(60,-1,-1):
        if ans^b[i]>ans: ans^=b[i]
    return ans
def main():
    t=list(map(int,sys.stdin.read().strip().split()))
    if not t: return
    n=t[0]; g=[[] for _ in range(n+1)]; idx=1
    for _ in range(n-1):
        u,v,w=t[idx],t[idx+1],t[idx+2]; idx+=3
        g[u].append((v,w)); g[v].append((u,w))
    parent=[0]*(n+1); pw=[0]*(n+1); stack=[1]; parent[1]=-1
    while stack:
        u=stack.pop()
        for v,w in g[u]:
            if parent[v]==0: parent[v]=u; pw[v]=w; stack.append(v)
    out=[]
    while idx+1<len(t):
        u,v=t[idx],t[idx+1]; idx+=2
        au=[]; bu=[]
        # depths
        du,dv=0,0; x=u
        while x!=-1 and x!=0: x=parent[x]; du+=1
        x=v
        while x!=-1 and x!=0: x=parent[x]; dv+=1
        uu,vv=u,v
        while du>dv: au.append(pw[uu]); uu=parent[uu]; du-=1
        while dv>du: bu.append(pw[vv]); vv=parent[vv]; dv-=1
        while uu!=vv:
            au.append(pw[uu]); bu.append(pw[vv]); uu=parent[uu]; vv=parent[vv]
        out.append(str(basis_max(au+bu)))
    sys.stdout.write("\\n".join(out) if out else "0")
main()`,
};
