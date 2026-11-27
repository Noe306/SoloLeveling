"""
Blender (headless) test: build a detailed icy rock outcrop procedurally and export it as GLB.
Run:  blender -b --python ice_outcrop.py -- <output.glb>
Technique: high-res icosphere -> two noise displacements (big shapes + fine detail)
-> planar decimate (stylised facets) -> bevel -> per-vertex colours baked from
height / slope (snow on top, dark stone in hollows) -> apply modifiers -> export.
"""
import bpy, bmesh, sys, math, random
from mathutils import Vector, noise

out = sys.argv[sys.argv.index("--") + 1]
random.seed(4)
bpy.ops.wm.read_factory_settings(use_empty=True)

def make_rock(name, loc, scale, seed):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.0, location=loc)
    ob = bpy.context.active_object; ob.name = name
    me = ob.data
    # Displace vertices with layered noise (done in Python for full control)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in me.vertices:
        p = v.co.copy()
        big = noise.fractal(p * 1.3 + off, 0.6, 2.0, 4)                 # large lumps
        fine = noise.fractal(p * 5.0 + off, 0.5, 2.0, 3) * 0.25          # small detail
        ridge = abs(noise.noise(p * 2.2 + off)) * -0.25                  # cracks
        v.co = p * (1.0 + 0.32 * big + 0.12 * fine + ridge)
    ob.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    # Stylised facets + softened edges
    dec = ob.modifiers.new("dec", "DECIMATE"); dec.decimate_type = "COLLAPSE"; dec.ratio = 0.18
    bev = ob.modifiers.new("bev", "BEVEL"); bev.width = 0.015; bev.segments = 1; bev.limit_method = "ANGLE"
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    # Flat shading for crisp facets
    for poly in ob.data.polygons: poly.use_smooth = False
    # Vertex colours: snow on upward faces, stone elsewhere, darker low and in hollows
    me = ob.data
    ca = me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    snow, stone, dark = Vector((0.93, 0.96, 1.0)), Vector((0.55, 0.62, 0.70)), Vector((0.22, 0.27, 0.34))
    zmin = min(v.co.z for v in me.vertices); zmax = max(v.co.z for v in me.vertices)
    for poly in me.polygons:
        up = poly.normal.z
        for li in poly.loop_indices:
            vz = me.vertices[me.loops[li].vertex_index].co.z
            h = (vz - zmin) / max(1e-6, zmax - zmin)
            snowy = up > 0.8 and h > 0.55                                  # snow only on flat-ish tops
            c = stone.lerp(snow, min(1.0, (up - 0.8) * 6.0)) if snowy else stone.lerp(dark, max(0.0, 0.7 - h) * 1.2)
            c = c * (0.85 + 0.15 * random.random())
            # colours above are screen (sRGB) values; vertex colours are stored linear -> convert
            ca.data[li].color = (c.x ** 2.2, c.y ** 2.2, c.z ** 2.2, 1.0)
    # Material that uses the vertex colours (so the glTF exporter keeps them)
    mat = bpy.data.materials.new(name + "_mat"); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes.get("Principled BSDF")
    vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    me.materials.append(mat)
    return ob

# A main boulder with two smaller ones leaning on it
make_rock("outcrop_main", (0, 0, 0), (1.2, 1.0, 0.85), 1)
make_rock("outcrop_b", (0.9, 0.5, -0.25), (0.55, 0.5, 0.45), 2)
make_rock("outcrop_c", (-0.85, -0.45, -0.3), (0.5, 0.55, 0.4), 3)

bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, export_vertex_color="ACTIVE")
tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
print("EXPORTED", out, "faces:", tris)
