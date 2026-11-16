using System.Collections.Generic;
using UnityEngine;

namespace RealLife
{
    /// <summary>أدوات بناء أشكال المشاة وسيارات المرور من أشكال Unity الأساسية، مع كاش للمواد حسب اللون.</summary>
    public static class AgentParts
    {
        static readonly Dictionary<Color, Material> cache = new Dictionary<Color, Material>();
        static Material baseMaterial;

        public static GameObject Part(PrimitiveType type, string name, Transform parent, Vector3 localPos, Vector3 localScale, Color color, bool keepCollider = false)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.layer = TrafficSystem.AgentLayer;
            if (!keepCollider) Object.DestroyImmediate(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = localScale;
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = GetMaterial(color, r.sharedMaterial);
            return go;
        }

        public static Material GetMaterial(Color color, Material fallback)
        {
            if (baseMaterial == null) baseMaterial = fallback;
            color.a = 1f;
            if (cache.TryGetValue(color, out var m) && m != null) return m;
            m = new Material(baseMaterial) { name = "Agent_" + ColorUtility.ToHtmlStringRGB(color) };
            m.color = color;
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", color);
            cache[color] = m;
            return m;
        }

        public static Color RandomColor(System.Random rng, Color[] palette) => palette[rng.Next(palette.Length)];

        public static float Range(System.Random rng, float min, float max) => min + (float)rng.NextDouble() * (max - min);

        /// <summary>
        /// حجم سيارة اللاعب في إحداثياتها المحلية (نص العرض والارتفاع والطول)، من الـ colliders حقها.
        /// نستخدمه عشان نعرف إذا السيارة صدمت أحد، بدون ClosestPoint (ما يشتغل على MeshCollider مب convex).
        /// </summary>
        public static Bounds LocalColliderBounds(Transform root)
        {
            bool any = false;
            var b = new Bounds();
            foreach (var col in root.GetComponentsInChildren<Collider>())
            {
                if (col.isTrigger || col is WheelCollider) continue;
                Bounds local;
                if (col is BoxCollider box) local = new Bounds(box.center, box.size);
                else if (col is MeshCollider mc && mc.sharedMesh != null) local = mc.sharedMesh.bounds;
                else if (col is SphereCollider sc) local = new Bounds(sc.center, Vector3.one * sc.radius * 2f);
                else if (col is CapsuleCollider cc) local = new Bounds(cc.center, new Vector3(cc.radius * 2f, cc.height, cc.radius * 2f));
                else continue;
                Vector3 e = local.extents;
                for (int i = 0; i < 8; i++)
                {
                    var corner = local.center + new Vector3((i & 1) == 0 ? -e.x : e.x, (i & 2) == 0 ? -e.y : e.y, (i & 4) == 0 ? -e.z : e.z);
                    Vector3 p = root.InverseTransformPoint(col.transform.TransformPoint(corner));
                    if (!any) { b = new Bounds(p, Vector3.zero); any = true; }
                    else b.Encapsulate(p);
                }
            }
            if (!any || b.extents.x < 0.3f || b.extents.z < 0.8f) b = new Bounds(new Vector3(0f, 0.7f, 0f), new Vector3(1.9f, 1.4f, 4.4f));
            return b;
        }
    }
}
