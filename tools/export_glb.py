"""Export the LUDUS hierarchy (claw + ball) from the material .blend to GLB.
The source .blend is opened read-only in memory and never saved.
Adds two extras used by the web app (no geometry change):
  - Claw_Arm_0X.collision_pts : arm centreline samples [x,y,z,r,...] in glTF arm-local space
Usage: python export_glb.py -- <in.blend> <out.glb>
"""
import bpy, sys, json
from mathutils import Vector

src, out = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.open_mainfile(filepath=src)
O = bpy.data.objects

KEEP = ["LUDUS", "CLAW", "Ball", "Claw_Body", "Claw_Wire",
        "Claw_Pivot_01", "Claw_Pivot_02", "Claw_Pivot_03",
        "Claw_Arm_01", "Claw_Arm_02", "Claw_Arm_03"]

SEC = 24


def b2g(v):  # Blender Z-up -> glTF Y-up
    return (v.x, v.z, -v.y)


for i in (1, 2, 3):
    arm = O[f"Claw_Arm_0{i}"]
    vs = arm.data.vertices
    n_rings = 57
    assert len(vs) >= n_rings * SEC + 1, (arm.name, len(vs))
    pts = []
    for k in list(range(0, n_rings, 2)) + [n_rings - 1]:
        ring = [vs[k * SEC + j].co for j in range(SEC)]
        c = sum(ring, Vector()) / SEC
        r = min((p - c).length for p in ring)       # in-plane half thickness
        pts += [*b2g(c), r]
    # tip (rounded cap apex) — last ring vertex set
    tip = vs[n_rings * SEC + 5 * SEC].co
    pts += [*b2g(tip), 0.004]
    arm["collision_pts"] = [round(x, 5) for x in pts]

# select only the model hierarchy
for o in bpy.context.view_layer.objects:
    o.select_set(o.name in KEEP)
bpy.context.view_layer.objects.active = O["LUDUS"]

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format='GLB',
    use_selection=True,
    export_extras=True,
    export_yup=True,
    export_apply=False,
    export_cameras=False,
    export_lights=False,
    export_animations=False,
    export_materials='EXPORT',
    export_normals=True,
    export_texcoords=False,
)
print("EXPORTED", out)
