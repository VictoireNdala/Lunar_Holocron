"""Recalcul INDÉPENDANT de l'horizon de Site01 (écrit par CHAT, 2026-11-15) : lancer depuis la racine du dépôt.
N'utilise ni pipeline/ ni le MNT 5 m : seulement le LDEM 80 m, un échantillonnage bilinéaire et la formule de visée avec courbure.
Sortie : RMS / maximum de l'écart avec `horizon.elev_deg` de web/data/sites/site01-connecting-ridge.json."""
import numpy as np, json, math
import tifffile
A=tifffile.imread('data/raw/LDEM_80S_80MPP_ADJ.tiff').astype(np.float32)  # lignes nord->sud, colonnes ouest->est ; exige `pip install tifffile imagecodecs`
R=1737400.0
def proj(lat,lon):
    rho=2*R*np.tan((np.radians(lat)+np.pi/2)/2); dl=np.radians(lon)
    return rho*np.sin(dl), rho*np.cos(dl)
def hgt(x,y):
    col=(x+304000.0)/80.0-0.5; row=(304000.0-y)/80.0-0.5
    c0=np.floor(col).astype(int); r0=np.floor(row).astype(int); fc=col-c0; fr=row-r0
    ok=(c0>=0)&(c0<7599)&(r0>=0)&(r0<7599)
    c0=np.clip(c0,0,7598); r0=np.clip(r0,0,7598)
    v=(A[r0,c0]*(1-fc)*(1-fr)+A[r0,c0+1]*fc*(1-fr)+A[r0+1,c0]*(1-fc)*fr+A[r0+1,c0+1]*fc*fr)
    return np.where(ok,v,np.nan)
def horizon(lat,lon,h0,eye=2.0,maxd=150000.0,step=40.0):
    la=math.radians(lat); lo=math.radians(lon)
    d=np.arange(step,maxd+step,step); th=d/R
    out=[]
    for az in range(360):
        a=math.radians(az)
        sl=math.sin(la)*np.cos(th)+math.cos(la)*np.sin(th)*math.cos(a)
        lat2=np.arcsin(sl)
        lon2=lo+np.arctan2(math.sin(a)*np.sin(th)*math.cos(la), np.cos(th)-math.sin(la)*sl)
        x,y=proj(np.degrees(lat2),np.degrees(lon2)); h=hgt(x,y)
        el=np.degrees(np.arctan2((R+h)*np.cos(th)-(R+h0+eye),(R+h)*np.sin(th)))
        out.append(np.nanmax(el) if np.isfinite(el).any() else np.nan)
    return np.array(out)
if __name__=='__main__':
    d=json.load(open('web/data/sites/site01-connecting-ridge.json'))
    L=d['location']; ref=np.array(d['horizon']['elev_deg'],float)
    x,y=proj(L['lat_deg'],L['lon_deg']); print('80m height at site',hgt(np.array([x]),np.array([y])),'vs 5m',L['ground_height_m'])
    mine=horizon(L['lat_deg'],L['lon_deg'],L['ground_height_m'])
    diff=mine-ref
    print('mine min/med/max',np.nanmin(mine),np.nanmedian(mine),np.nanmax(mine)); print('ref  min/med/max',ref.min(),np.median(ref),ref.max())
    print('diff mean %.3f rms %.3f max|d| %.3f  (mine-ref)'%(np.nanmean(diff),np.sqrt(np.nanmean(diff**2)),np.nanmax(abs(diff))))
    for az in range(0,360,30): print(az, round(mine[az],2), round(ref[az],2))
