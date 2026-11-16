using System.Collections.Generic;
using UnityEngine;

namespace RealLife
{
    /// <summary>
    /// مسار مقفول على الأرض (XZ بس، الارتفاع ينحسب بالـ raycast وقت الحركة).
    /// نستخدمه للأرصفة (المشاة) والحارات (سيارات المرور). بيانات بس، بدون MonoBehaviour.
    /// </summary>
    public class LoopPath
    {
        readonly List<Vector2> points = new List<Vector2>();
        readonly List<float> cumulative = new List<float>();
        public float Length { get; private set; }
        /// <summary>true = مع عقارب الساعة من فوق (البلوك على يمين اللي يمشي).</summary>
        public bool Clockwise { get; private set; }
        public float Y;

        public int Count => points.Count;
        public Vector2 this[int i] => points[i];

        /// <summary>مستطيل بزوايا مدوّرة. أقواس الزوايا مركزها زوايا المستطيل بعد ما ينكمش بمقدار radius.</summary>
        public static LoopPath RoundedRect(Rect r, float radius, bool clockwise, float y, int arcSteps = 6)
        {
            var p = new LoopPath { Clockwise = clockwise, Y = y };
            radius = Mathf.Clamp(radius, 0f, Mathf.Min(r.width, r.height) * 0.5f - 0.01f);
            // الزوايا مع عقارب الساعة من فوق (+Z شمال، +X شرق): شمال غرب ← شمال شرق ← جنوب شرق ← جنوب غرب
            var centers = new[]
            {
                new Vector2(r.xMin + radius, r.yMax - radius),
                new Vector2(r.xMax - radius, r.yMax - radius),
                new Vector2(r.xMax - radius, r.yMin + radius),
                new Vector2(r.xMin + radius, r.yMin + radius),
            };
            float[] startAngles = { 180f, 90f, 0f, -90f }; // كل قوس يلف 90 درجة مع عقارب الساعة
            for (int c = 0; c < 4; c++)
            {
                for (int k = 0; k <= arcSteps; k++)
                {
                    float a = (startAngles[c] - 90f * k / arcSteps) * Mathf.Deg2Rad;
                    p.points.Add(centers[c] + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * radius);
                    if (radius <= 0f) break;
                }
            }
            if (!clockwise) p.points.Reverse();
            p.Rebuild();
            return p;
        }

        void Rebuild()
        {
            cumulative.Clear();
            float total = 0f;
            for (int i = 0; i < points.Count; i++)
            {
                cumulative.Add(total);
                total += Vector2.Distance(points[i], points[(i + 1) % points.Count]);
            }
            Length = total;
        }

        public float Wrap(float s)
        {
            if (Length <= 0f) return 0f;
            s %= Length;
            return s < 0f ? s + Length : s;
        }

        int SegmentAt(float s)
        {
            int lo = 0, hi = cumulative.Count - 1;
            while (lo < hi)
            {
                int mid = (lo + hi + 1) / 2;
                if (cumulative[mid] <= s) lo = mid; else hi = mid - 1;
            }
            return lo;
        }

        public Vector2 PointAt(float s)
        {
            s = Wrap(s);
            int i = SegmentAt(s);
            Vector2 a = points[i], b = points[(i + 1) % points.Count];
            float len = Vector2.Distance(a, b);
            return len < 1e-4f ? a : Vector2.Lerp(a, b, (s - cumulative[i]) / len);
        }

        public Vector2 TangentAt(float s)
        {
            s = Wrap(s);
            int i = SegmentAt(s);
            Vector2 d = points[(i + 1) % points.Count] - points[i];
            return d.sqrMagnitude < 1e-8f ? Vector2.up : d.normalized;
        }

        /// <summary>اتجاه برا البلوك (عمودي على المسار).</summary>
        public Vector2 OutwardAt(float s)
        {
            Vector2 t = TangentAt(s);
            Vector2 left = new Vector2(-t.y, t.x);
            return Clockwise ? left : -left;
        }

        /// <summary>أقرب نقطة على المسار (s) لموقع معيّن.</summary>
        public float ClosestS(Vector3 world)
        {
            Vector2 q = new Vector2(world.x, world.z);
            float best = 0f, bestD = float.MaxValue;
            for (int i = 0; i < points.Count; i++)
            {
                Vector2 a = points[i], b = points[(i + 1) % points.Count];
                Vector2 ab = b - a;
                float t = ab.sqrMagnitude < 1e-8f ? 0f : Mathf.Clamp01(Vector2.Dot(q - a, ab) / ab.sqrMagnitude);
                float d = (a + ab * t - q).sqrMagnitude;
                if (d < bestD) { bestD = d; best = cumulative[i] + ab.magnitude * t; }
            }
            return best;
        }

        public static Vector3 ToWorld(Vector2 p, float y) => new Vector3(p.x, y, p.y);
    }
}
