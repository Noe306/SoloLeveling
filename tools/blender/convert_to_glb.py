"""
convert_to_glb.py: turn a model made in Maya (or any other 3D tool) into a
game-ready .glb for the village, using Blender in headless mode.

Why: the app only loads GLB (via assets/model-pack.js). Maya saves .ma/.mb,
which nothing but Maya can read, so the exchange format is FBX (Maya's
File > Export Selection > FBX export) or USD. This script imports that file,
cleans it up the way our pipeline expects and writes a GLB.

Run (from the project root):
    blender -b --python tools/blender/convert_to_glb.py -- <input> <output.glb> [options]

Inputs accepted: .fbx  .obj  .usd/.usda/.usdc/.usdz  .gltf/.glb  .stl  .ply

Options:
    --height H      scale the model so it is H units tall (1 unit = 1 village tile)
    --max-faces N   decimate meshes so the whole model has at most ~N faces
    --flat          flat shading (crisp low-poly facets, like the Kenney kits)
    --no-ground     keep the original pivot (default: centre on X/Z, base at Y=0)

After converting: copy the .glb into assets/models/<kit>/, add its name to
MODELS in tools/pack-models.py, run `python tools/pack-models.py`, and load it
in the page through K3.prepareModel(gltf.scene) (see docs/3d-design-guide.md).
"""
import bpy
import os
import sys
from mathutils import Vector

# ---------------------------------------------------------------- arguments
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    sys.exit("usage: blender -b --python convert_to_glb.py -- <input> <output.glb> "
             "[--height H] [--max-faces N] [--flat] [--no-ground]")
src, out = os.path.abspath(argv[0]), os.path.abspath(argv[1])
opts = argv[2:]


def opt_value(name, cast):
    """Return the value that follows --name in the options, or None."""
    return cast(opts[opts.index(name) + 1]) if name in opts else None


target_height = opt_value("--height", float)
max_faces = opt_value("--max-faces", int)
flat = "--flat" in opts
ground = "--no-ground" not in opts

if not os.path.isfile(src):
    sys.exit("Input not found: " + src)

# ---------------------------------------------------------------- import
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
IMPORTERS = {
    # FBX from Maya: Maya works in centimetres, Y-up. The FBX importer reads the
    # file's own unit/axis settings, so no manual fix is needed here.
    ".fbx": lambda: bpy.ops.import_scene.fbx(filepath=src, use_image_search=True),
    ".obj": lambda: bpy.ops.wm.obj_import(filepath=src),
    ".usd": lambda: bpy.ops.wm.usd_import(filepath=src),
    ".usda": lambda: bpy.ops.wm.usd_import(filepath=src),
    ".usdc": lambda: bpy.ops.wm.usd_import(filepath=src),
    ".usdz": lambda: bpy.ops.wm.usd_import(filepath=src),
    ".gltf": lambda: bpy.ops.import_scene.gltf(filepath=src),
    ".glb": lambda: bpy.ops.import_scene.gltf(filepath=src),
    ".stl": lambda: bpy.ops.wm.stl_import(filepath=src),
    ".ply": lambda: bpy.ops.wm.ply_import(filepath=src),
}
if ext not in IMPORTERS:
    sys.exit("Unsupported format " + ext + " (export FBX or USD from Maya)")
IMPORTERS[ext]()

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
if not meshes:
    sys.exit("No mesh found in " + src)

# ---------------------------------------------------------------- cleanup
# Bake every object's transform into its vertices so the GLB has clean,
# unscaled nodes (Maya's cm->m conversion arrives as a 0.01 scale).
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# Optional decimation, shared proportionally across all meshes.
faces_before = sum(len(o.data.polygons) for o in meshes)
if max_faces and faces_before > max_faces:
    ratio = max_faces / faces_before
    for o in meshes:
        mod = o.modifiers.new("decimate", "DECIMATE")
        mod.ratio = ratio
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)

# Shading: flat facets on request, otherwise keep what the source had.
if flat:
    for o in meshes:
        for poly in o.data.polygons:
            poly.use_smooth = False


def world_bounds():
    """Axis-aligned bounds of all meshes in world space (Blender is Z-up)."""
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


# Group everything under one root so scaling/centering moves the whole model.
root = bpy.data.objects.new("root", None)
bpy.context.scene.collection.objects.link(root)
for o in [o for o in bpy.data.objects if o.parent is None and o is not root]:
    o.parent = root

if target_height:
    lo, hi = world_bounds()
    h = hi.z - lo.z
    if h > 1e-6:
        root.scale = (target_height / h,) * 3
        bpy.context.view_layer.update()

if ground:
    # Centre on the floor plane and stand on it (Blender Z = glTF/Three.js Y).
    lo, hi = world_bounds()
    root.location -= Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    bpy.context.view_layer.update()

# ---------------------------------------------------------------- export
os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_apply=True,               # bake remaining modifiers
    export_vertex_color="ACTIVE",    # keep painted vertex colours
    export_yup=True,                 # Three.js is Y-up
)

lo, hi = world_bounds()
size = hi - lo
faces_after = sum(len(o.data.polygons) for o in meshes)
print("CONVERTED %s -> %s" % (src, out))
print("  meshes: %d  faces: %d -> %d" % (len(meshes), faces_before, faces_after))
print("  size (w x h x d): %.2f x %.2f x %.2f" % (size.x, size.z, size.y))
print("  file: %.1f KB" % (os.path.getsize(out) / 1024))
