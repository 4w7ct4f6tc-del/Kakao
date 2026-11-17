using UnityEngine;

namespace RealLife
{
    /// <summary>
    /// سيارة مرور تمشي في حارتها حول البلوك. Rigidbody من نوع kinematic: حركتها بالكود على المسار، مب فيزياء محرك.
    /// توقف إذا قدامها شي (مشاة، اللاعب، سيارة)، تزمّر إذا اللاعب واقف قدامها، وإذا وقفها شي ثابت فترة تتجاوزه.
    /// إذا صدمتها سيارة اللاعب توقف شوي.
    /// </summary>
    public class TrafficCar : MonoBehaviour
    {
        public float cruiseSpeed = 9f;      // ~32 كم/س
        public float cornerSpeed = 5f;
        public float acceleration = 3f;
        public float braking = 9f;

        public float Speed { get; private set; }
        public string Status { get; private set; } = "";

        TrafficSystem system;
        LoopPath lane;
        float s;
        float sideOffset;         // للتجاوز: سالب = يسار
        float targetSideOffset;
        float overtakeUntil;
        float blockedTime;
        float stunnedUntil;
        float nextHonk;
        float groundY;
        Rigidbody rb;
        Collider[] ownColliders;
        BoxCollider box;
        Transform[] wheels;
        float cruiseJitter;

        static readonly Color[] Paints =
        {
            new Color(0.75f, 0.1f, 0.1f), new Color(0.1f, 0.25f, 0.6f), new Color(0.92f, 0.92f, 0.9f), new Color(0.12f, 0.12f, 0.13f),
            new Color(0.55f, 0.57f, 0.6f), new Color(0.1f, 0.45f, 0.25f), new Color(0.95f, 0.75f, 0.1f), new Color(0.45f, 0.2f, 0.12f),
        };

        public static TrafficCar Create(Transform parent, TrafficSystem system, LoopPath lane, float s, System.Random rng)
        {
            var go = new GameObject("TrafficCar");
            go.layer = TrafficSystem.AgentLayer;
            go.transform.SetParent(parent, false);

            Color paint = AgentParts.RandomColor(rng, Paints);
            Color glass = new Color(0.12f, 0.16f, 0.2f);
            Color tire = new Color(0.07f, 0.07f, 0.07f);
            var t = go.transform;
            bool van = rng.NextDouble() < 0.25;
            if (van)
            {
                AgentParts.Part(PrimitiveType.Cube, "Body", t, new Vector3(0f, 1.05f, 0f), new Vector3(1.95f, 1.6f, 4.8f), paint);
                AgentParts.Part(PrimitiveType.Cube, "Windshield", t, new Vector3(0f, 1.45f, 2.38f), new Vector3(1.75f, 0.6f, 0.06f), glass);
            }
            else
            {
                AgentParts.Part(PrimitiveType.Cube, "Body", t, new Vector3(0f, 0.6f, 0f), new Vector3(1.85f, 0.65f, 4.3f), paint);
                AgentParts.Part(PrimitiveType.Cube, "Cabin", t, new Vector3(0f, 1.15f, -0.2f), new Vector3(1.65f, 0.55f, 2.2f), paint);
                AgentParts.Part(PrimitiveType.Cube, "Windshield", t, new Vector3(0f, 1.15f, 0.92f), new Vector3(1.55f, 0.48f, 0.04f), glass);
                AgentParts.Part(PrimitiveType.Cube, "RearWindow", t, new Vector3(0f, 1.15f, -1.32f), new Vector3(1.55f, 0.48f, 0.04f), glass);
                AgentParts.Part(PrimitiveType.Cube, "SideWindows", t, new Vector3(0f, 1.17f, -0.2f), new Vector3(1.67f, 0.4f, 1.9f), glass);
            }
            float halfLen = van ? 2.4f : 2.15f;
            foreach (float x in new[] { -0.7f, 0.7f })
            {
                AgentParts.Part(PrimitiveType.Cube, "Headlight", t, new Vector3(x, van ? 0.75f : 0.65f, halfLen + 0.01f), new Vector3(0.35f, 0.15f, 0.04f), new Color(1f, 0.97f, 0.85f));
                AgentParts.Part(PrimitiveType.Cube, "Taillight", t, new Vector3(x, van ? 0.75f : 0.7f, -halfLen - 0.01f), new Vector3(0.35f, 0.12f, 0.04f), new Color(0.8f, 0.05f, 0.05f));
            }
            var wheels = new Transform[4];
            int w = 0;
            foreach (float x in new[] { -0.88f, 0.88f })
            foreach (float z in new[] { -halfLen + 0.75f, halfLen - 0.75f })
            {
                var wheel = AgentParts.Part(PrimitiveType.Cylinder, "Wheel", t, new Vector3(x, 0.34f, z), new Vector3(0.68f, 0.12f, 0.68f), tire);
                wheel.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
                wheels[w++] = wheel.transform;
            }

            var box = go.AddComponent<BoxCollider>();
            box.center = new Vector3(0f, van ? 1.0f : 0.8f, 0f);
            box.size = new Vector3(1.9f, van ? 1.7f : 1.25f, halfLen * 2f + 0.05f);
            var rb = go.AddComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;
            rb.interpolation = RigidbodyInterpolation.Interpolate;

            var car = go.AddComponent<TrafficCar>();
            car.system = system;
            car.lane = lane;
            car.s = lane.Wrap(s);
            car.rb = rb;
            car.wheels = wheels;
            car.ownColliders = go.GetComponentsInChildren<Collider>();
            car.box = box;
            car.cruiseJitter = AgentParts.Range(rng, -1.5f, 1.5f);
            car.groundY = system.GroundY;
            go.name = (van ? "Van " : "Car ") + (lane.Clockwise ? "CW" : "CCW");
            car.Snap(true);
            return car;
        }

        Vector3 PathPosition(float at, float side, out Quaternion rot)
        {
            Vector2 p = lane.PointAt(at);
            Vector2 tan = lane.TangentAt(at);
            // يسار اللي ماشي = (-y, x)
            Vector2 left = new Vector2(-tan.y, tan.x);
            p += left * -side;
            // الاتجاه من نقطة شوي ورا لنقطة شوي قدام، عشان اللفة تكون ناعمة
            Vector2 ahead = lane.PointAt(at + 1.5f) - lane.PointAt(at - 1.5f);
            rot = Quaternion.LookRotation(new Vector3(ahead.x, 0f, ahead.y));
            return new Vector3(p.x, groundY, p.y);
        }

        void Snap(bool instant)
        {
            Vector3 pos = PathPosition(s, sideOffset, out Quaternion rot);
            if (instant)
            {
                groundY = system.GroundAt(pos + Vector3.up, groundY);
                pos.y = groundY;
                transform.SetPositionAndRotation(pos, rot);
            }
        }

        void FixedUpdate()
        {
            if (system == null || !system.Ready || lane == null) return;
            float dt = Time.fixedDeltaTime;
            float now = Time.time;

            // السرعة اللي نبيها: أبطأ في اللفات
            float target = cruiseSpeed + cruiseJitter;
            Vector2 t0 = lane.TangentAt(s), t1 = lane.TangentAt(s + 10f);
            if (Vector2.Angle(t0, t1) > 20f) target = cornerSpeed;

            string status = "cruise";
            if (now < stunnedUntil) { target = 0f; status = "stunned"; }

            // شي قدامنا؟
            float look = Mathf.Clamp(3f + Speed * 1.3f, 4f, 16f);
            if (Obstacle(look, out float dist, out Collider hitCol))
            {
                float stopAt = 2.5f;
                float allowed = dist <= stopAt ? 0f : Mathf.Sqrt(2f * braking * 0.5f * (dist - stopAt));
                if (allowed < target) { target = allowed; status = "yield:" + hitCol.name; }
                if (Speed < 0.5f) blockedTime += dt; else blockedTime = 0f;

                bool isPlayer = hitCol.GetComponentInParent<PlayerController>() != null;
                bool isAgent = hitCol.GetComponentInParent<Pedestrian>() != null || hitCol.GetComponentInParent<TrafficCar>() != null;
                if (isPlayer && blockedTime > 1.5f && now > nextHonk)
                {
                    nextHonk = now + 6f;
                    if (PlayerStats.Instance != null) PlayerStats.Instance.Notify("BEEP BEEP! A car is waiting for you to move.");
                }
                // شي ثابت (سيارة اللاعب الواقفة، عمود...) سكّر الطريق: نتجاوزه من اليسار
                if (!isPlayer && !isAgent && blockedTime > 3f && now > overtakeUntil)
                {
                    targetSideOffset = -3.2f;
                    overtakeUntil = now + 7f;
                    blockedTime = 0f;
                }
            }
            else blockedTime = 0f;
            if (now > overtakeUntil && targetSideOffset != 0f && !SideBlocked()) targetSideOffset = 0f;
            sideOffset = Mathf.MoveTowards(sideOffset, targetSideOffset, 1.2f * dt);

            Speed = target > Speed ? Mathf.Min(target, Speed + acceleration * dt) : Mathf.Max(target, Speed - braking * dt);
            s = lane.Wrap(s + Speed * dt);

            Vector3 pos = PathPosition(s, sideOffset, out Quaternion rot);
            float gy = system.GroundAt(pos + Vector3.up, groundY);
            if (Mathf.Abs(gy - groundY) < 0.5f) groundY = Mathf.Lerp(groundY, gy, 1f - Mathf.Exp(-8f * dt));
            pos.y = groundY;
            rb.MovePosition(pos);
            rb.MoveRotation(Quaternion.RotateTowards(rb.rotation, rot, 120f * dt));

            float spin = Speed * dt / 0.34f * Mathf.Rad2Deg;
            foreach (var w in wheels) w.Rotate(Vector3.up, spin, Space.Self);
            Status = status;
        }

        static readonly RaycastHit[] hits = new RaycastHit[12];

        bool Obstacle(float distance, out float nearest, out Collider nearestCol)
        {
            nearest = float.MaxValue;
            nearestCol = null;
            Vector3 fwd = transform.forward;
            float halfLen = box.size.z * 0.5f;
            // نبدأ من قدّام السيارة، على ارتفاع يتجاهل الرصيف والمطبّات
            Vector3 origin = transform.position + Vector3.up * 1.0f + fwd * (halfLen + 0.3f);
            Vector3 dir = fwd;
            // في اللفة: نطالع لنقطة قريبة على الحارة (5م) بدال قدام على طول، عشان ما نشوف زاوية الرصيف ونوقف
            if (Vector2.Angle(lane.TangentAt(s), lane.TangentAt(s + 10f)) > 20f)
            {
                Vector2 p = lane.PointAt(s + halfLen + 5f);
                Vector3 to = new Vector3(p.x, origin.y, p.y) - origin;
                if (to.sqrMagnitude > 0.01f) dir = to.normalized;
                distance = Mathf.Min(distance, 5f);
            }
            int count = Physics.BoxCastNonAlloc(origin, new Vector3(0.9f, 0.45f, 0.1f), dir, hits, Quaternion.LookRotation(dir), distance, ~0, QueryTriggerInteraction.Ignore);
            for (int i = 0; i < count; i++)
            {
                var c = hits[i].collider;
                if (IsOwn(c) || hits[i].distance <= 0f) continue;
                if (hits[i].normal.y > 0.7f) continue; // أرضية أو منحدر
                if (hits[i].distance < nearest) { nearest = hits[i].distance; nearestCol = c; }
            }
            return nearestCol != null;
        }

        bool SideBlocked()
        {
            Vector3 center = transform.position + Vector3.up * 1f + transform.right * 3.2f;
            var cols = Physics.OverlapBox(center, new Vector3(1.1f, 0.5f, 3f), transform.rotation, ~0, QueryTriggerInteraction.Ignore);
            foreach (var c in cols) if (!IsOwn(c)) return true;
            return false;
        }

        bool IsOwn(Collider c)
        {
            foreach (var o in ownColliders) if (o == c) return true;
            return false;
        }

        void OnCollisionEnter(Collision collision)
        {
            if (collision.collider.GetComponentInParent<VehicleInteraction>() == null) return;
            if (collision.relativeVelocity.magnitude < 3f) return;
            stunnedUntil = Time.time + 3f;
            Speed = 0f;
            if (PlayerStats.Instance != null) PlayerStats.Instance.Notify("Crash! Watch the road.");
        }
    }
}
