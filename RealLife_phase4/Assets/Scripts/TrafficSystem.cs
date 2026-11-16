using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;

namespace RealLife
{
    /// <summary>
    /// المرحلة 4: المواطنين والمرور.
    /// أول ما تبدأ اللعبة، يمسح الأرض حول اللاعب بأشعة (raycast) ويلقى البلوك (الرصيف والمباني أعلى من الشارع)،
    /// وبعدها يسوي مسار رصيف للمشاة وحارتين حول البلوك لسيارات المرور (حارة مع عقارب الساعة وحارة عكسها، السواقة على اليمين).
    /// ينضاف بروحه لكائن "Game" في أي مشهد فيه لاعب، فما تحتاج تعيد بناء المشهد.
    /// السيارات هنا مب VPP (النسخة المجانية تسمح بسيارة وحدة بس)، حركتها على المسار بالكود.
    /// </summary>
    public class TrafficSystem : MonoBehaviour
    {
        public static TrafficSystem Instance { get; private set; }

        [Header("Counts")]
        public int pedestrianCount = 24;
        public int carCount = 8;

        [Header("Scan (auto-detect the block)")]
        [Tooltip("نص قطر المنطقة اللي ينمسح حول اللاعب، بالمتر")]
        public float scanRadius = 180f;
        public float cellSize = 2f;
        [Tooltip("كم لازم الرصيف يكون أعلى من أوطى أرض عشان ينحسب بلوك")]
        public float curbHeight = 0.12f;
        [Tooltip("إذا true يستخدم manualBlock بدال المسح")]
        public bool useManualBlock = false;
        [Tooltip("x,y = أقل X وأقل Z. width/height بالمتر")]
        public Rect manualBlock = new Rect(-50f, -50f, 100f, 100f);

        [Header("Layout")]
        [Tooltip("بُعد مسار المشاة داخل حافة الرصيف")]
        public float sidewalkInset = 1.8f;
        [Tooltip("بُعد الحارة اليمين (مع عقارب الساعة) عن حافة الرصيف")]
        public float innerLaneOffset = 4f;
        [Tooltip("بُعد الحارة الثانية (عكس عقارب الساعة) عن حافة الرصيف")]
        public float outerLaneOffset = 7.5f;

        public LoopPath Sidewalk { get; private set; }
        public LoopPath InnerLane { get; private set; }
        public LoopPath OuterLane { get; private set; }
        public Rect Block { get; private set; }
        public float GroundY { get; private set; }
        public bool Ready { get; private set; }
        public string SetupLog { get; private set; } = "";

        readonly List<Pedestrian> pedestrians = new List<Pedestrian>();
        readonly List<TrafficCar> cars = new List<TrafficCar>();
        public IReadOnlyList<Pedestrian> Pedestrians => pedestrians;
        public IReadOnlyList<TrafficCar> Cars => cars;

        /// <summary>المشاة والسيارات في طبقة Ignore Raycast عشان كاميرا اللاعب ما تصطدم فيهم.</summary>
        public const int AgentLayer = 2;
        /// <summary>للأرض: كل الطبقات إلا Ignore Raycast (اللاعب والمشاة والسيارات).</summary>
        public const int GroundMask = ~(1 << AgentLayer);

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoAdd()
        {
            if (FindAnyObjectByType<TrafficSystem>() != null) return;
            var stats = FindAnyObjectByType<PlayerStats>();
            if (stats == null) return;
            stats.gameObject.AddComponent<TrafficSystem>();
        }

        void Awake()
        {
            Instance = this;
        }

        IEnumerator Start()
        {
            // ننتظر فريم وخطوة فيزياء، عشان الحفظ يتحمّل وكل الـ colliders تكون في مكانها
            yield return null;
            yield return new WaitForFixedUpdate();
            Physics.SyncTransforms();
            Setup();
        }

        public void Setup()
        {
            var log = new StringBuilder();
            var player = FindAnyObjectByType<PlayerController>(FindObjectsInactive.Include);
            Vector3 center = player != null ? player.transform.position : Vector3.zero;

            Rect block;
            float groundY;
            if (useManualBlock)
            {
                block = manualBlock;
                groundY = center.y;
                if (Physics.Raycast(new Vector3(block.center.x, center.y + 50f, block.yMin - innerLaneOffset), Vector3.down, out RaycastHit h, 120f, GroundMask, QueryTriggerInteraction.Ignore))
                    groundY = h.point.y;
                log.AppendLine("manual block " + block);
            }
            else if (!DetectBlock(center, log, out block, out groundY))
            {
                block = new Rect(center.x - 40f, center.z + 10f, 80f, 80f);
                groundY = center.y;
                log.AppendLine("detect failed, fallback block " + block);
            }

            Block = block;
            GroundY = groundY;
            Sidewalk = LoopPath.RoundedRect(Expand(block, -sidewalkInset), 0.8f, true, groundY);
            InnerLane = LoopPath.RoundedRect(Expand(block, innerLaneOffset), innerLaneOffset, true, groundY);
            OuterLane = LoopPath.RoundedRect(Expand(block, outerLaneOffset), outerLaneOffset, false, groundY);
            log.AppendLine("block=" + block + " groundY=" + groundY.ToString("0.00")
                + " sidewalk=" + Sidewalk.Length.ToString("0") + "m inner=" + InnerLane.Length.ToString("0") + "m outer=" + OuterLane.Length.ToString("0") + "m");

            Spawn(player, log);
            Ready = true;
            SetupLog = log.ToString();
            Debug.Log("[Traffic] " + SetupLog);
        }

        static Rect Expand(Rect r, float d) => new Rect(r.xMin - d, r.yMin - d, r.width + 2f * d, r.height + 2f * d);

        /// <summary>
        /// يمسح شبكة حول اللاعب. الخلايا الأعلى من أوطى أرض بـ curbHeight = بلوك (رصيف أو مبنى).
        /// ياخذ أكبر مجموعة خلايا متصلة (وإذا فيه أكثر من وحدة بنفس الحجم، الأقرب للاعب)، ويرجّع المستطيل اللي يحويها.
        /// </summary>
        bool DetectBlock(Vector3 center, StringBuilder log, out Rect block, out float groundY)
        {
            block = default;
            int n = Mathf.Max(8, Mathf.CeilToInt(scanRadius * 2f / cellSize));
            float x0 = center.x - scanRadius, z0 = center.z - scanRadius;
            var heights = new float[n, n];
            var hitAny = new bool[n, n];
            groundY = float.MaxValue;
            int hits = 0;

            for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
            {
                var origin = new Vector3(x0 + (i + 0.5f) * cellSize, center.y + 150f, z0 + (j + 0.5f) * cellSize);
                if (!Physics.Raycast(origin, Vector3.down, out RaycastHit hit, 300f, GroundMask, QueryTriggerInteraction.Ignore)) continue;
                // نتجاهل الأشياء اللي تتحرك (السيارة) والمحل
                if (hit.collider.attachedRigidbody != null && !hit.collider.attachedRigidbody.isKinematic) continue;
                if (hit.collider.GetComponentInParent<Shop>() != null) continue;
                if (hit.point.y < center.y - 5f) continue;
                heights[i, j] = hit.point.y;
                hitAny[i, j] = true;
                hits++;
                if (hit.point.y < groundY) groundY = hit.point.y;
            }
            if (hits == 0) { log.AppendLine("scan: no ground hits"); return false; }

            float threshold = groundY + curbHeight;
            var raised = new bool[n, n];
            int raisedCount = 0;
            for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                if (hitAny[i, j] && heights[i, j] > threshold) { raised[i, j] = true; raisedCount++; }
            // نشيل الأشياء النحيفة اللي طالعة على الشارع (ذراع إشارة المرور، أعمدة، صناديق): تآكل وبعده تمدد (opening) بشبكة 3×3
            raised = Dilate(Erode(raised, n), n);
            int opened = 0;
            foreach (bool r in raised) if (r) opened++;
            log.AppendLine("scan " + n + "x" + n + " hits=" + hits + " lowest=" + groundY.ToString("0.00") + " raised=" + raisedCount + " afterOpening=" + opened);
            if (opened == 0) return false;

            // المجموعات المتصلة
            var label = new int[n, n];
            var comps = new List<(int size, int minI, int maxI, int minJ, int maxJ)>();
            var queue = new Queue<Vector2Int>();
            for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
            {
                if (!raised[i, j] || label[i, j] != 0) continue;
                int id = comps.Count + 1;
                int size = 0, minI = i, maxI = i, minJ = j, maxJ = j;
                label[i, j] = id;
                queue.Enqueue(new Vector2Int(i, j));
                while (queue.Count > 0)
                {
                    var c = queue.Dequeue();
                    size++;
                    minI = Mathf.Min(minI, c.x); maxI = Mathf.Max(maxI, c.x);
                    minJ = Mathf.Min(minJ, c.y); maxJ = Mathf.Max(maxJ, c.y);
                    foreach (var d in new[] { Vector2Int.right, Vector2Int.left, Vector2Int.up, Vector2Int.down })
                    {
                        var m = c + d;
                        if (m.x < 0 || m.y < 0 || m.x >= n || m.y >= n || !raised[m.x, m.y] || label[m.x, m.y] != 0) continue;
                        label[m.x, m.y] = id;
                        queue.Enqueue(m);
                    }
                }
                comps.Add((size, minI, maxI, minJ, maxJ));
            }

            int maxSize = 0;
            foreach (var c in comps) maxSize = Mathf.Max(maxSize, c.size);
            float bestDist = float.MaxValue;
            bool found = false;
            foreach (var c in comps)
            {
                if (c.size < maxSize * 0.5f) continue;
                var r = new Rect(x0 + c.minI * cellSize, z0 + c.minJ * cellSize, (c.maxI - c.minI + 1) * cellSize, (c.maxJ - c.minJ + 1) * cellSize);
                if (r.width < 10f || r.height < 10f) continue;
                float dx = Mathf.Max(r.xMin - center.x, 0f, center.x - r.xMax);
                float dz = Mathf.Max(r.yMin - center.z, 0f, center.z - r.yMax);
                float dist = dx * dx + dz * dz;
                if (dist < bestDist) { bestDist = dist; block = r; found = true; }
            }
            log.AppendLine("components=" + comps.Count + " biggest=" + maxSize + " cells, chosen=" + block);
            return found;
        }

        static bool[,] Erode(bool[,] g, int n)
        {
            var o = new bool[n, n];
            for (int i = 1; i < n - 1; i++)
            for (int j = 1; j < n - 1; j++)
            {
                bool all = true;
                for (int a = -1; a <= 1 && all; a++)
                for (int b = -1; b <= 1 && all; b++)
                    all = g[i + a, j + b];
                o[i, j] = all;
            }
            return o;
        }

        static bool[,] Dilate(bool[,] g, int n)
        {
            var o = new bool[n, n];
            for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
            {
                if (!g[i, j]) continue;
                for (int a = -1; a <= 1; a++)
                for (int b = -1; b <= 1; b++)
                {
                    int x = i + a, y = j + b;
                    if (x >= 0 && y >= 0 && x < n && y < n) o[x, y] = true;
                }
            }
            return o;
        }

        void Spawn(PlayerController player, StringBuilder log)
        {
            foreach (var p in pedestrians) if (p != null) Destroy(p.gameObject);
            foreach (var c in cars) if (c != null) Destroy(c.gameObject);
            pedestrians.Clear();
            cars.Clear();

            var rng = new System.Random(4242);
            var root = new GameObject("Traffic").transform;
            Vector3 playerPos = player != null ? player.transform.position : Vector3.zero;

            for (int i = 0; i < pedestrianCount; i++)
            {
                float s = Sidewalk.Length * (i + (float)rng.NextDouble() * 0.6f) / Mathf.Max(1, pedestrianCount);
                var ped = Pedestrian.Create(root, this, s, rng);
                pedestrians.Add(ped);
            }

            int placed = 0;
            for (int i = 0; i < carCount; i++)
            {
                LoopPath lane = i % 2 == 0 ? InnerLane : OuterLane;
                int k = i / 2, perLane = Mathf.CeilToInt(carCount / 2f);
                float s = lane.Length * (k + 0.3f * (float)rng.NextDouble()) / Mathf.Max(1, perLane) + (i % 2) * 11f;
                // نبعد عن اللاعب وعن السيارات الواقفة
                for (int attempt = 0; attempt < 12; attempt++)
                {
                    Vector2 p2 = lane.PointAt(s);
                    Vector3 p = LoopPath.ToWorld(p2, GroundY);
                    Vector2 t = lane.TangentAt(s);
                    bool nearPlayer = (new Vector2(playerPos.x, playerPos.z) - p2).sqrMagnitude < 12f * 12f;
                    bool blocked = Physics.CheckBox(p + Vector3.up * 1f, new Vector3(1.1f, 0.6f, 2.6f),
                        Quaternion.LookRotation(new Vector3(t.x, 0f, t.y)), ~0, QueryTriggerInteraction.Ignore);
                    if (!nearPlayer && !blocked) break;
                    s += 9f;
                }
                cars.Add(TrafficCar.Create(root, this, lane, s, rng));
                placed++;
            }
            log.AppendLine("spawned pedestrians=" + pedestrians.Count + " cars=" + placed);
        }

        /// <summary>يرجّع أقرب ارتفاع أرض تحت نقطة، أو الارتفاع المعروف إذا ما فيه أرض.</summary>
        public float GroundAt(Vector3 p, float fallback)
        {
            if (Physics.Raycast(new Vector3(p.x, p.y + 1.5f, p.z), Vector3.down, out RaycastHit hit, 4f, GroundMask, QueryTriggerInteraction.Ignore))
                return hit.point.y;
            return fallback;
        }

        /// <summary>تقرير للتجربة الآلية (RLPlay.TrafficTest).</summary>
        public string Report()
        {
            var sb = new StringBuilder(SetupLog);
            int moving = 0, down = 0;
            foreach (var p in pedestrians) { if (p.CurrentSpeed > 0.2f) moving++; if (p.IsDown) down++; }
            sb.AppendLine("pedestrians=" + pedestrians.Count + " moving=" + moving + " down=" + down);
            for (int i = 0; i < Mathf.Min(3, pedestrians.Count); i++)
                sb.AppendLine("  ped" + i + " pos=" + pedestrians[i].transform.position + " state=" + pedestrians[i].State);
            int carsMoving = 0;
            foreach (var c in cars) if (c.Speed > 0.5f) carsMoving++;
            sb.AppendLine("cars=" + cars.Count + " moving=" + carsMoving);
            foreach (var c in cars)
                sb.AppendLine("  " + c.name + " pos=" + c.transform.position + " speed=" + (c.Speed * 3.6f).ToString("0") + "km/h " + c.Status);
            return sb.ToString();
        }

        void OnDrawGizmos()
        {
            if (!Ready) return;
            DrawLoop(Sidewalk, Color.green);
            DrawLoop(InnerLane, Color.yellow);
            DrawLoop(OuterLane, new Color(1f, 0.5f, 0f));
        }

        static void DrawLoop(LoopPath path, Color color)
        {
            if (path == null) return;
            Gizmos.color = color;
            for (int i = 0; i < path.Count; i++)
                Gizmos.DrawLine(LoopPath.ToWorld(path[i], path.Y + 0.2f), LoopPath.ToWorld(path[(i + 1) % path.Count], path.Y + 0.2f));
        }
    }
}
