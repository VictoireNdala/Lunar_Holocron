"""Recalcul indépendant des valeurs de docs/TESTS-VALIDATION.md §§ 1-3, par d'autres méthodes que les formules documentées."""
import math

import numpy as np

R = 1737400.0

print("== § 1 Fraction visible : intégration numérique de l'aire du disque au-dessus de y = -d ==")
r = 0.27
# Aire de la partie du disque (centre 0, rayon r) d'ordonnée y > -d, par quadrature sur y (largeur de corde 2*sqrt(r²-y²)).
y = np.linspace(-r, r, 2_000_001)
chord = 2 * np.sqrt(np.clip(r * r - y * y, 0, None))
dy = y[1] - y[0]
total = np.trapezoid(chord, dx=dy)
doc = {0.27: 1.0, 0.135: 0.804499, 0.0675: 0.657481, 0.0: 0.5, -0.0675: 0.342519, -0.135: 0.195501, -0.27: 0.0, 0.5: 1.0, -0.5: 0.0}
for d, expected in doc.items():
    mask = y > -d
    f = np.trapezoid(chord * mask, dx=dy) / total if -d < r else 0.0
    print(f"d={d:+.4f}  f_num={f:.6f}  doc={expected:.6f}  écart={f - expected:+.1e}")

print("\n== § 2 Élévation : géométrie vectorielle 2D (observateur sur l'axe, point tourné de δ) ==")
def elev_vec(h_t, d, h_o=0.0):
    delta = d / R
    obs = np.array([0.0, R + h_o])
    tgt = (R + h_t) * np.array([math.sin(delta), math.cos(delta)])
    v = tgt - obs
    up = obs / np.linalg.norm(obs)
    return math.degrees(math.asin(np.dot(v, up) / np.linalg.norm(v)))

for h_t, d, expected in [(2000, 20000, 5.377488), (2000, 50000, 1.464689), (500, 5000, 5.627328),
                         (1000, 100000, -1.076279), (0, 10000, -0.164889), (0, 100000, -1.648894)]:
    e = elev_vec(h_t, d)
    print(f"h_t={h_t:5d} d={d:6d}  elev={e:.6f}  doc={expected:.6f}  écart={e - expected:+.1e}")
print(f"sol lisse, premier pas 20 m : {elev_vec(0, 20):.7f}° (doc : ≈ -0.0003°)")

print("\n== § 3 Trajet sphérique : rotation 3D dans la base ENU ==")
def enu(lat, lon):
    p, l = math.radians(lat), math.radians(lon)
    up = np.array([math.cos(p) * math.cos(l), math.cos(p) * math.sin(l), math.sin(p)])
    east = np.array([-math.sin(l), math.cos(l), 0.0])
    north = np.cross(up, east)
    return east, north, up

def dest_vec(lat, lon, az, dist):
    east, north, up = enu(lat, lon)
    a, dl = math.radians(az), dist / R
    direction = math.cos(a) * north + math.sin(a) * east
    p = math.cos(dl) * up + math.sin(dl) * direction
    return math.degrees(math.asin(p[2])), math.degrees(math.atan2(p[1], p[0]))

arc = R * math.pi / 180
print(f"1° d'arc = {arc:.4f} m (doc : 30 323,35)")
for az, n, expected in [(0, 1, (-88.0, 0.0)), (90, 1, (-88.585822, 45.004364)), (270, 1, (-88.585822, -45.004364)), (180, 2, (-89.0, 180.0))]:
    la, lo = dest_vec(-89, 0, az, n * arc)
    print(f"az={az:3d} dist={n}°  lat={la:.6f} lon={lo:.6f}  doc={expected}")
east, north, up = enu(-89, 0)
print("vérif. base : north (via up × east) =", np.round(north, 12), " formule doc :", np.round([-math.sin(math.radians(-89)), 0, math.cos(math.radians(-89))], 12))

print("\n== § 3 Projection stéréographique : construction géométrique (projection depuis le pôle Nord sur le plan tangent au pôle Sud) ==")
def stereo_geom(lat, lon):
    east, north, up = enu(lat, lon)
    P = R * up
    N = np.array([0, 0, R])           # point de vue : pôle Nord
    # plan z = -R (tangent au pôle Sud) ; droite N + t (P - N)
    t = (-R - R) / (P[2] - R)
    Q = N + t * (P - N)
    # convention doc : lon 0 vers +y, lon 90 E vers +x ⇒ x = Q_y, y = Q_x
    return Q[1], Q[0]

for (lat, lon), expected in [((-90, 0), (0, 0)), ((-89, 0), (0, 30324.12)), ((-89, 90), (30324.12, 0)),
                             ((-89, 180), (0, -30324.12)), ((-89, -90), (-30324.12, 0)), ((-85, 45), (107277.323, 107277.323))]:
    x, yv = stereo_geom(lat, lon)
    print(f"({lat},{lon})  x={x:.3f} y={yv:.3f}  doc={expected}")
