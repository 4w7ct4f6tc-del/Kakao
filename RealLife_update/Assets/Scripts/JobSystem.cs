using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace RealLife
{
    /// <summary>
    /// المرحلة 5: الوظايف. ينضاف بروحه لكائن "Game".
    /// يحط مكاتب الوظايف (مركز الشرطة ومستودع التوصيل) على رصيف البلوك، ويدير الدوام: علامة الهدف، الوصول، الراتب، الترقية، وزي الدوام.
    /// القوانين نفسها في Jobs.cs (بدون Unity)، هنا بس ربطها بالعالم والواجهة.
    /// </summary>
    public class JobSystem : MonoBehaviour
    {
        public static JobSystem Instance { get; private set; }

        public JobState State { get; private set; } = new JobState();
        public JobDefinition CurrentJob => Jobs.Get(State.jobId);
        public Vector3? Target { get; private set; }
        public string TargetLabel { get; private set; } = "";
        public readonly List<JobOffice> Offices = new List<JobOffice>();

        public float arriveOnFoot = 3f;
        public float arriveInCar = 6f;

        PlayerController player;
        GameObject marker;
        Renderer playerBody;
        Material playerBodyOriginal;
        System.Random rng = new System.Random();
        float patrolStartS;
        GUIStyle style;

        static readonly Color PoliceBlue = new Color(0.08f, 0.12f, 0.35f);
        static readonly Color CourierBrown = new Color(0.55f, 0.35f, 0.15f);

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoAdd()
        {
            if (FindAnyObjectByType<JobSystem>() != null) return;
            var stats = FindAnyObjectByType<PlayerStats>();
            if (stats == null) return;
            stats.gameObject.AddComponent<JobSystem>();
        }

        void Awake() => Instance = this;

        IEnumerator Start()
        {
            player = FindAnyObjectByType<PlayerController>(FindObjectsInactive.Include);
            if (player != null)
            {
                var body = player.transform.Find("Body");
                if (body != null) { playerBody = body.GetComponent<Renderer>(); playerBodyOriginal = playerBody.sharedMaterial; }
            }
            // ننتظر المرور يخلّص المسح، عشان نحط المكاتب على الرصيف اللي لقاه (أو 3 ثواني ونحطها جنب اللاعب)
            float until = Time.time + 3f;
            while ((TrafficSystem.Instance == null || !TrafficSystem.Instance.Ready) && Time.time < until) yield return null;
            SpawnOffices();
        }

        void SpawnOffices()
        {
            var traffic = TrafficSystem.Instance;
            var placed = new[] { (Jobs.Police, 0.12f, new Color(0.15f, 0.3f, 0.8f)), (Jobs.Courier, 0.62f, new Color(0.85f, 0.5f, 0.15f)) };
            foreach (var (job, frac, color) in placed)
            {
                Vector3 pos; float yaw;
                if (traffic != null && traffic.Ready)
                {
                    var path = traffic.Sidewalk;
                    float s = path.Length * frac;
                    Vector2 out2 = path.OutwardAt(s);
                    pos = LoopPath.ToWorld(path.PointAt(s) - out2 * 0.6f, traffic.GroundY);
                    pos.y = traffic.GroundAt(pos + Vector3.up, traffic.GroundY);
                    yaw = Mathf.Atan2(out2.x, out2.y) * Mathf.Rad2Deg; // الواجهة على الشارع
                }
                else
                {
                    Vector3 p = player != null ? player.transform.position : Vector3.zero;
                    pos = p + new Vector3(job == Jobs.Police ? 8f : -8f, 0f, 8f);
                    yaw = 180f;
                }
                Offices.Add(JobOffice.Create(job, pos, yaw, color));
            }
        }

        public JobOffice OfficeFor(JobDefinition job)
        {
            foreach (var o in Offices) if (o != null && o.job == job) return o;
            return null;
        }

        // ---------------- أوامر (تجي من المكتب أو من التجربة الآلية) ----------------

        public string Apply(JobDefinition job)
        {
            var stats = PlayerStats.Instance;
            if (stats == null) return "no stats";
            string reason = Jobs.CanApply(State, job, stats.health, stats.hunger, stats.thirst, stats.money);
            if (reason != null) { stats.Notify(reason); return reason; }
            if (job.applicationFee > 0) stats.TrySpend(job.applicationFee);
            bool hadJob = CurrentJob != null;
            Jobs.Hire(State, job);
            string msg = (hadJob ? "You switched jobs. " : "") + "Hired as " + job.title + " - " + job.RankFor(State.ShiftsDone(job.id)).title + "! Press [1] to start a shift.";
            stats.Notify(msg);
            return msg;
        }

        public string Quit()
        {
            var job = CurrentJob;
            if (job == null) return "no job";
            CancelShift(false);
            Jobs.Quit(State);
            Say("You quit your job as " + job.title + ".");
            return "quit";
        }

        public string StartShift()
        {
            var job = CurrentJob;
            if (job == null) return "no job";
            if (State.onDuty) return "already on duty";
            Jobs.StartShift(State);
            patrolStartS = -1f;
            SetUniform(true);
            NextTarget();
            Say("Shift started: " + Describe(job) + ". Follow the marker.");
            return "started";
        }

        public void CancelShift(bool notify = true)
        {
            if (!State.onDuty) return;
            State.onDuty = false;
            State.taskIndex = 0;
            State.carrying = false;
            ClearTarget();
            SetUniform(false);
            if (notify) Say("Shift cancelled. No pay.");
        }

        /// <summary>للتجربة الآلية: كأن اللاعب وصل للهدف الحالي.</summary>
        public void DebugArrive() { if (State.onDuty) Arrive(); }

        public void LoadState(JobState saved)
        {
            ClearTarget();
            SetUniform(false);
            State = saved ?? new JobState();
            if (State.shiftKeys == null) State.shiftKeys = new List<string>();
            if (State.shiftValues == null) State.shiftValues = new List<int>();
            // دوام نص نص ما يرجع بعد التحميل
            State.onDuty = false;
            State.taskIndex = 0;
            State.carrying = false;
            if (Jobs.Get(State.jobId) == null) State.jobId = "";
        }

        // ---------------- الدوام ----------------

        static string Describe(JobDefinition job) =>
            job.task == JobTaskKind.Patrol ? "patrol " + job.tasksPerShift + " points around the block" : "deliver " + job.tasksPerShift + " packages";

        void Update()
        {
            if (!State.onDuty || !Target.HasValue) return;
            Vector3 me = PlayerPosition(out bool inCar);
            Vector3 d = me - Target.Value; d.y = 0f;
            float radius = inCar ? arriveInCar : arriveOnFoot;
            if (d.magnitude > radius) return;

            var job = CurrentJob;
            if (job != null && job.task == JobTaskKind.Delivery && State.carrying && inCar)
            {
                if (Time.frameCount % 120 == 0) Say("Get out of the car to hand over the package.");
                return;
            }
            Arrive();
        }

        void Arrive()
        {
            var job = CurrentJob;
            if (job == null) { CancelShift(false); return; }

            if (job.task == JobTaskKind.Delivery && !State.carrying)
            {
                State.carrying = true;
                Say("Package picked up. Deliver it to the marker.");
                NextTarget();
                return;
            }

            bool done = Jobs.CompleteTask(State, job);
            if (!done)
            {
                Say(job.task == JobTaskKind.Patrol ? "Checkpoint " + State.taskIndex + "/" + job.tasksPerShift + " clear." : "Delivered " + State.taskIndex + "/" + job.tasksPerShift + ".");
                State.carrying = false;
                NextTarget();
                return;
            }

            int pay = Jobs.FinishShift(State, job, out bool promoted, out JobRank rank);
            if (PlayerStats.Instance != null) PlayerStats.Instance.AddMoney(pay);
            ClearTarget();
            SetUniform(false);
            Say("Shift complete! Paid $" + pay + (promoted ? "  -  PROMOTED to " + rank.title + "!" : ""));
        }

        void NextTarget()
        {
            var job = CurrentJob;
            var traffic = TrafficSystem.Instance;
            Vector3 me = PlayerPosition(out _);
            Vector3 pos;
            string label;

            if (job.task == JobTaskKind.Delivery && !State.carrying)
            {
                var depot = OfficeFor(job);
                pos = depot != null ? depot.transform.position : me + Vector3.forward * 10f;
                label = "Pick up package";
            }
            else if (traffic != null && traffic.Ready)
            {
                if (job.task == JobTaskKind.Patrol)
                {
                    var lane = traffic.InnerLane;
                    if (patrolStartS < 0f) patrolStartS = lane.ClosestS(me) + lane.Length / (job.tasksPerShift * 2f);
                    float s = patrolStartS + lane.Length * State.taskIndex / job.tasksPerShift;
                    pos = LoopPath.ToWorld(lane.PointAt(s), traffic.GroundY);
                    label = "Patrol checkpoint " + (State.taskIndex + 1) + "/" + job.tasksPerShift;
                }
                else
                {
                    var walk = traffic.Sidewalk;
                    float s = walk.ClosestS(me);
                    float pick = s;
                    for (int i = 0; i < 12; i++)
                    {
                        pick = (float)rng.NextDouble() * walk.Length;
                        float gap = Mathf.Abs(walk.Wrap(pick - s));
                        if (Mathf.Min(gap, walk.Length - gap) > 35f) break;
                    }
                    pos = LoopPath.ToWorld(walk.PointAt(pick) - walk.OutwardAt(pick) * 1.2f, traffic.GroundY);
                    label = "Deliver package " + (State.taskIndex + 1) + "/" + job.tasksPerShift;
                }
                pos.y = traffic.GroundAt(pos + Vector3.up, traffic.GroundY);
            }
            else
            {
                float a = (float)rng.NextDouble() * Mathf.PI * 2f;
                pos = me + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * 25f;
                label = job.task == JobTaskKind.Patrol ? "Patrol checkpoint" : "Deliver package";
            }
            SetTarget(pos, label, job.task == JobTaskKind.Patrol ? new Color(0.2f, 0.45f, 1f) : new Color(1f, 0.65f, 0.1f));
        }

        void SetTarget(Vector3 pos, string label, Color color)
        {
            Target = pos;
            TargetLabel = label;
            if (marker == null) marker = CreateMarker();
            marker.SetActive(true);
            marker.transform.position = pos;
            foreach (var r in marker.GetComponentsInChildren<Renderer>()) r.sharedMaterial = AgentParts.GetMaterial(color, r.sharedMaterial);
        }

        void ClearTarget()
        {
            Target = null;
            TargetLabel = "";
            if (marker != null) marker.SetActive(false);
        }

        GameObject CreateMarker()
        {
            var m = new GameObject("Job Marker");
            m.AddComponent<MarkerBob>();
            AgentParts.Part(PrimitiveType.Cylinder, "Ring", m.transform, new Vector3(0f, 0.05f, 0f), new Vector3(2.4f, 0.03f, 2.4f), Color.white);
            AgentParts.Part(PrimitiveType.Cylinder, "Beam", m.transform, new Vector3(0f, 3f, 0f), new Vector3(0.25f, 3f, 0.25f), Color.white);
            AgentParts.Part(PrimitiveType.Sphere, "Top", m.transform, new Vector3(0f, 6.3f, 0f), Vector3.one * 0.7f, Color.white);
            return m;
        }

        void SetUniform(bool on)
        {
            if (playerBody == null) return;
            var job = CurrentJob;
            if (on && job != null)
                playerBody.sharedMaterial = AgentParts.GetMaterial(job == Jobs.Police ? PoliceBlue : CourierBrown, playerBodyOriginal);
            else if (playerBodyOriginal != null)
                playerBody.sharedMaterial = playerBodyOriginal;
        }

        Vector3 PlayerPosition(out bool inCar)
        {
            var car = VehicleInteraction.Current;
            inCar = car != null;
            if (inCar) return car.transform.position;
            return player != null ? player.transform.position : Vector3.zero;
        }

        static void Say(string msg)
        {
            if (PlayerStats.Instance != null) PlayerStats.Instance.Notify(msg);
        }

        // ---------------- الواجهة ----------------

        void OnGUI()
        {
            if (style == null)
            {
                style = new GUIStyle(GUI.skin.box) { fontSize = 14, alignment = TextAnchor.UpperLeft, wordWrap = true, richText = true };
                style.normal.textColor = Color.white;
                style.padding = new RectOffset(10, 10, 8, 8);
            }
            var job = CurrentJob;
            string text;
            if (job == null) text = "<b>Unemployed</b>\nFind work at the Police Station or the Delivery Depot.";
            else
            {
                int done = State.ShiftsDone(job.id);
                var rank = job.RankFor(done);
                text = "<b>" + job.title + " - " + rank.title + "</b>  ($" + rank.payPerShift + "/shift)\nShifts: " + done;
                int next = job.RankIndexFor(done) + 1;
                if (next < job.ranks.Length) text += "   Next rank in " + (job.ranks[next].shiftsRequired - done);
                if (State.onDuty && Target.HasValue)
                {
                    Vector3 me = PlayerPosition(out _);
                    Vector3 d = Target.Value - me; d.y = 0f;
                    text += "\n<color=#7fd0ff>ON DUTY</color>  " + TargetLabel + "\n" + d.magnitude.ToString("0") + " m  " + Heading(d);
                }
                else text += "\nOff duty. Go to the " + job.office + " to start a shift.";
            }
            float w = 240f;
            GUI.Box(new Rect(Screen.width - w - 12f, 152f, w, State.onDuty ? 104f : 84f), text, style);
        }

        static string Heading(Vector3 d)
        {
            var cam = Camera.main;
            if (cam == null || d.sqrMagnitude < 1f) return "";
            Vector3 f = cam.transform.forward; f.y = 0f;
            float angle = Vector3.SignedAngle(f, d, Vector3.up);
            if (Mathf.Abs(angle) < 30f) return "^ ahead";
            if (Mathf.Abs(angle) > 150f) return "v behind";
            return angle > 0f ? "> right" : "< left";
        }
    }

    /// <summary>حركة خفيفة لعلامة الهدف عشان تنشاف.</summary>
    public class MarkerBob : MonoBehaviour
    {
        void Update()
        {
            transform.Rotate(0f, 90f * Time.deltaTime, 0f);
            if (transform.childCount > 2)
                transform.GetChild(2).localPosition = new Vector3(0f, 6.3f + Mathf.Sin(Time.time * 3f) * 0.3f, 0f);
        }
    }
}
