using System.Collections.Generic;
using UnityEngine;

namespace RealLife
{
    /// <summary>
    /// مواطن يمشي على الرصيف حول البلوك. يوقف أحياناً، يرجع على عقبه أحياناً، يتلفّت للاعب إذا وقف جنبه،
    /// ينحاش إذا سيارة اللاعب جاية بسرعة، ويطيح إذا انصدم وبعدين يرجع يقوم في مكان ثاني.
    /// </summary>
    public class Pedestrian : MonoBehaviour
    {
        public enum PedState { Walk, Pause, Greet, Flee, Down }

        public PedState State { get; private set; } = PedState.Walk;
        public float CurrentSpeed { get; private set; }
        public bool IsDown => State == PedState.Down;

        TrafficSystem system;
        float s;                 // المكان على مسار الرصيف
        int dir = 1;             // 1 مع المسار، -1 عكسه
        float lane;              // إزاحة جانبية على الرصيف (+ برا البلوك)
        float walkSpeed;
        float stateUntil;
        float nextDecision;
        float blockedTime;
        Vector3 fleeDir;
        float groundY;
        Transform visual;
        CapsuleCollider body;
        System.Random rng;

        static readonly Color[] Shirts =
        {
            new Color(0.8f, 0.2f, 0.2f), new Color(0.2f, 0.6f, 0.3f), new Color(0.9f, 0.75f, 0.2f), new Color(0.5f, 0.3f, 0.7f),
            new Color(0.95f, 0.95f, 0.95f), new Color(0.15f, 0.15f, 0.18f), new Color(0.3f, 0.7f, 0.85f), new Color(0.9f, 0.5f, 0.2f),
        };
        static readonly Color[] Skins =
        {
            new Color(0.96f, 0.80f, 0.66f), new Color(0.85f, 0.65f, 0.48f), new Color(0.65f, 0.45f, 0.32f), new Color(0.42f, 0.28f, 0.2f),
        };
        static readonly Color[] Pants =
        {
            new Color(0.15f, 0.2f, 0.35f), new Color(0.25f, 0.25f, 0.25f), new Color(0.45f, 0.38f, 0.28f), new Color(0.1f, 0.1f, 0.1f),
        };

        public static Pedestrian Create(Transform parent, TrafficSystem system, float s, System.Random rng)
        {
            var go = new GameObject("Pedestrian");
            go.layer = TrafficSystem.AgentLayer;
            go.transform.SetParent(parent, false);

            var visual = new GameObject("Visual").transform;
            visual.gameObject.layer = TrafficSystem.AgentLayer;
            visual.SetParent(go.transform, false);
            float h = AgentParts.Range(rng, 0.9f, 1.08f); // طول مختلف لكل واحد
            visual.localScale = new Vector3(1f, h, 1f);
            AgentParts.Part(PrimitiveType.Capsule, "Legs", visual, new Vector3(0f, 0.45f, 0f), new Vector3(0.45f, 0.45f, 0.4f), AgentParts.RandomColor(rng, Pants));
            AgentParts.Part(PrimitiveType.Capsule, "Body", visual, new Vector3(0f, 1.05f, 0f), new Vector3(0.6f, 0.42f, 0.5f), AgentParts.RandomColor(rng, Shirts));
            var skin = AgentParts.RandomColor(rng, Skins);
            AgentParts.Part(PrimitiveType.Sphere, "Head", visual, new Vector3(0f, 1.62f, 0f), Vector3.one * 0.38f, skin);
            AgentParts.Part(PrimitiveType.Cube, "Nose", visual, new Vector3(0f, 1.62f, 0.19f), new Vector3(0.08f, 0.08f, 0.08f), skin);

            var col = go.AddComponent<CapsuleCollider>();
            col.height = 1.75f * h;
            col.radius = 0.3f;
            col.center = new Vector3(0f, col.height * 0.5f, 0f);
            var rb = go.AddComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;

            var ped = go.AddComponent<Pedestrian>();
            ped.system = system;
            ped.visual = visual;
            ped.body = col;
            ped.rng = new System.Random(rng.Next());
            ped.s = s;
            ped.dir = rng.NextDouble() < 0.5 ? 1 : -1;
            ped.lane = AgentParts.Range(rng, -0.7f, 0.7f);
            ped.walkSpeed = AgentParts.Range(rng, 1.1f, 1.7f);
            ped.groundY = system.GroundY;
            ped.nextDecision = Time.time + AgentParts.Range(rng, 4f, 12f);
            ped.PlaceOnPath();
            IgnorePlayerCars(col);
            return ped;
        }

        /// <summary>سيارة اللاعب ما تصطدم فيزيائياً بالمشاة (كانت بتوقف كأنها صدمت عمود). الصدمة نحسبها بالكود.</summary>
        static void IgnorePlayerCars(Collider col)
        {
            foreach (var v in FindObjectsByType<VehicleInteraction>(FindObjectsInactive.Include))
                foreach (var c in v.GetComponentsInChildren<Collider>(true))
                    Physics.IgnoreCollision(col, c, true);
        }

        void PlaceOnPath()
        {
            var path = system.Sidewalk;
            Vector2 p = path.PointAt(s) + path.OutwardAt(s) * lane;
            Vector3 pos = LoopPath.ToWorld(p, groundY);
            pos.y = groundY = system.GroundAt(pos + Vector3.up * 0.5f, groundY);
            Vector2 t = path.TangentAt(s) * dir;
            transform.SetPositionAndRotation(pos, Quaternion.LookRotation(new Vector3(t.x, 0f, t.y)));
        }

        float R(float a, float b) => AgentParts.Range(rng, a, b);

        void Update()
        {
            if (system == null || !system.Ready) return;
            float dt = Time.deltaTime;
            float now = Time.time;

            if (State == PedState.Down)
            {
                CurrentSpeed = 0f;
                if (now > stateUntil) GetUp();
                return;
            }

            if (CheckHitByCar()) return;
            CheckFlee(now);

            var player = PlayerNearby(out float playerDist);
            if (State == PedState.Walk || State == PedState.Pause || State == PedState.Greet)
            {
                if (player != null && playerDist < 2.2f && VehicleInteraction.Current == null)
                {
                    State = PedState.Greet;
                    stateUntil = now + 1.5f;
                }
                else if (State == PedState.Greet && now > stateUntil) State = PedState.Walk;
            }

            if (State == PedState.Walk && now > nextDecision)
            {
                nextDecision = now + R(6f, 16f);
                double roll = rng.NextDouble();
                if (roll < 0.25) { State = PedState.Pause; stateUntil = now + R(2f, 5f); }
                else if (roll < 0.4) dir = -dir;
                else if (roll < 0.6) lane = R(-0.7f, 0.7f);
            }
            if (State == PedState.Pause && now > stateUntil) State = PedState.Walk;

            Vector3 desired = Vector3.zero;
            float speed = 0f;
            switch (State)
            {
                case PedState.Walk:
                {
                    var path = system.Sidewalk;
                    Vector2 target2 = path.PointAt(s + dir * 1.2f) + path.OutwardAt(s + dir * 1.2f) * lane;
                    Vector3 target = new Vector3(target2.x, transform.position.y, target2.y);
                    desired = target - transform.position;
                    speed = walkSpeed;
                    break;
                }
                case PedState.Flee:
                    desired = fleeDir;
                    speed = 4.5f;
                    if (now > stateUntil) { State = PedState.Walk; s = system.Sidewalk.ClosestS(transform.position); }
                    break;
                case PedState.Greet:
                    if (player != null) Face(player.position - transform.position, dt);
                    break;
            }

            desired.y = 0f;
            if (speed > 0f && desired.sqrMagnitude > 0.0001f)
            {
                Vector3 step = desired.normalized;
                if (Blocked(step, State == PedState.Flee ? 1.0f : 0.8f))
                {
                    blockedTime += dt;
                    // نحاول نتحرك جنب الشي اللي قدامنا، وإذا طوّل نرجع على عقبنا
                    Vector3 side = Vector3.Cross(Vector3.up, step) * (lane > 0f ? -1f : 1f);
                    if (!Blocked((step + side).normalized, 0.8f)) step = (step + side).normalized;
                    else { speed = 0f; }
                    if (blockedTime > 1.5f) { dir = -dir; lane = -lane; blockedTime = 0f; if (State == PedState.Flee) State = PedState.Walk; }
                }
                else blockedTime = 0f;

                if (speed > 0f)
                {
                    Vector3 move = step * speed * dt;
                    Vector3 pos = transform.position + move;
                    float gy = system.GroundAt(pos, groundY);
                    if (gy - transform.position.y > 0.45f) speed = 0f; // ما نطلع على شي عالي
                    else
                    {
                        groundY = Mathf.Lerp(groundY, gy, 1f - Mathf.Exp(-15f * dt));
                        pos.y = groundY;
                        transform.position = pos;
                        Face(step, dt);
                        // نقدّم مكاننا على المسار بقدر اللي مشيناه على اتجاهه (بالسالب إذا ماشيين عكسه)
                        if (State == PedState.Walk) s = system.Sidewalk.Wrap(s + Vector3.Dot(move, Dir3(system.Sidewalk.TangentAt(s))));
                    }
                }
            }
            CurrentSpeed = speed;

            // مشية بسيطة: الجسم يهتز شوي وهو يمشي
            float bob = speed > 0.1f ? Mathf.Abs(Mathf.Sin(now * speed * 4f)) * 0.04f : 0f;
            visual.localPosition = new Vector3(0f, bob, 0f);
        }

        static Vector3 Dir3(Vector2 v) => new Vector3(v.x, 0f, v.y);

        void Face(Vector3 d, float dt)
        {
            d.y = 0f;
            if (d.sqrMagnitude < 0.0001f) return;
            transform.rotation = Quaternion.RotateTowards(transform.rotation, Quaternion.LookRotation(d), 360f * dt);
        }

        static readonly RaycastHit[] castHits = new RaycastHit[8];

        bool Blocked(Vector3 dirn, float distance)
        {
            Vector3 origin = transform.position + Vector3.up * 0.9f;
            int count = Physics.SphereCastNonAlloc(origin, 0.25f, dirn, castHits, distance, ~0, QueryTriggerInteraction.Ignore);
            for (int i = 0; i < count; i++)
            {
                var c = castHits[i].collider;
                if (c == body || castHits[i].distance <= 0f) continue;
                return true;
            }
            return false;
        }

        Transform PlayerNearby(out float dist)
        {
            dist = float.MaxValue;
            var p = PlayerCache.Player;
            if (p == null || !p.gameObject.activeInHierarchy) return null;
            dist = Vector3.Distance(p.transform.position, transform.position);
            return p.transform;
        }

        /// <summary>سيارة اللاعب جاية بسرعة وقريبة: ينحاش على جنب.</summary>
        void CheckFlee(float now)
        {
            if (State == PedState.Flee) return;
            var car = VehicleInteraction.Current;
            if (car == null) return;
            var rb = car.GetComponent<Rigidbody>();
            if (rb == null) return;
            Vector3 v = rb.linearVelocity; v.y = 0f;
            if (v.magnitude < 5f) return;
            Vector3 toMe = transform.position - car.transform.position; toMe.y = 0f;
            if (toMe.magnitude > 12f || Vector3.Dot(toMe.normalized, v.normalized) < 0.5f) return;
            Vector3 side = Vector3.Cross(Vector3.up, v.normalized);
            fleeDir = Vector3.Dot(side, toMe) >= 0f ? side : -side;
            State = PedState.Flee;
            stateUntil = now + 1.4f;
        }

        bool CheckHitByCar()
        {
            var car = VehicleInteraction.Current;
            if (car == null) return false;
            var rb = car.GetComponent<Rigidbody>();
            if (rb == null || rb.linearVelocity.magnitude < 2.5f) return false;
            Bounds b = PlayerCache.CarBounds(car);
            Vector3 local = car.transform.InverseTransformPoint(transform.position + Vector3.up * 0.9f);
            if (Mathf.Abs(local.x - b.center.x) > b.extents.x + 0.35f || Mathf.Abs(local.z - b.center.z) > b.extents.z + 0.35f) return false;
            if (local.y < b.min.y - 1f || local.y > b.max.y + 1f) return false;
            KnockDown(rb.linearVelocity);
            return true;
        }

        public void KnockDown(Vector3 carVelocity)
        {
            State = PedState.Down;
            stateUntil = Time.time + 6f;
            CurrentSpeed = 0f;
            body.enabled = false;
            Vector3 push = carVelocity; push.y = 0f;
            transform.position += push.normalized * Mathf.Min(3f, push.magnitude * 0.25f);
            transform.position = new Vector3(transform.position.x, system.GroundAt(transform.position, groundY), transform.position.z);
            Vector3 axis = Vector3.Cross(Vector3.up, push.sqrMagnitude > 0.01f ? push.normalized : transform.forward);
            visual.localRotation = Quaternion.Inverse(transform.rotation) * Quaternion.AngleAxis(90f, axis) * transform.rotation;
            visual.localPosition = new Vector3(0f, 0.3f, 0f);
            if (PlayerStats.Instance != null) PlayerStats.Instance.Notify("You hit a pedestrian!");
        }

        /// <summary>يقوم ويرجع على الرصيف في مكان بعيد عن اللاعب.</summary>
        void GetUp()
        {
            visual.localRotation = Quaternion.identity;
            visual.localPosition = Vector3.zero;
            body.enabled = true;
            var path = system.Sidewalk;
            Vector3 playerPos = PlayerCache.Player != null ? PlayerCache.Player.transform.position : transform.position;
            if (VehicleInteraction.Current != null) playerPos = VehicleInteraction.Current.transform.position;
            float best = s;
            for (int i = 0; i < 10; i++)
            {
                float cand = (float)rng.NextDouble() * path.Length;
                Vector2 p = path.PointAt(cand);
                if ((new Vector2(playerPos.x, playerPos.z) - p).sqrMagnitude > 25f * 25f) { best = cand; break; }
            }
            s = best;
            groundY = system.GroundY;
            PlaceOnPath();
            State = PedState.Walk;
        }
    }

    /// <summary>كاش صغير: الشخصية، وحجم كل سيارة للاعب.</summary>
    public static class PlayerCache
    {
        static PlayerController player;
        static readonly Dictionary<VehicleInteraction, Bounds> bounds = new Dictionary<VehicleInteraction, Bounds>();

        public static PlayerController Player
        {
            get
            {
                if (player == null) player = Object.FindAnyObjectByType<PlayerController>(FindObjectsInactive.Include);
                return player;
            }
        }

        public static Bounds CarBounds(VehicleInteraction car)
        {
            if (!bounds.TryGetValue(car, out var b))
            {
                b = AgentParts.LocalColliderBounds(car.transform);
                bounds[car] = b;
            }
            return b;
        }
    }
}
