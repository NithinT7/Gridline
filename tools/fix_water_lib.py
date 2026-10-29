def stitch(segs):
    segs=[[(q["lat"],q["lon"]) for q in s] for s in segs if s and len(s)>1];rings=[]
    while segs:
        cur=segs.pop(0)
        changed=True
        while cur[0]!=cur[-1] and changed:
            changed=False
            for i,s in enumerate(segs):
                if s[0]==cur[-1]:cur=cur+s[1:]
                elif s[-1]==cur[-1]:cur=cur+s[::-1][1:]
                elif s[-1]==cur[0]:cur=s+cur[1:]
                elif s[0]==cur[0]:cur=s[::-1]+cur[1:]
                else:continue
                segs.pop(i);changed=True;break
        if cur[0]==cur[-1]:rings.append([{"lat":a,"lon":b} for a,b in cur])
        else:print("  open ring dropped",len(cur))
    return rings
