using UnityEngine;

namespace RealLife
{
    /// <summary>
    /// مكتب وظيفة (كشك على الرصيف). إذا اللاعب واقف عنده على رجوله: E يفتح القائمة، والأرقام تختار.
    /// القائمة تتغيّر حسب حالتك: تقديم، بدء دوام، استقالة، أو إلغاء الدوام.
    /// </summary>
    public class JobOffice : MonoBehaviour
    {
        public JobDefinition job;
        public float useDistance = 3.5f;
        public KeyCode useKey = KeyCode.E;
        public bool IsOpen { get; private set; }

        Transform playerTransform;
        GUIStyle style;

        public static JobOffice Create(JobDefinition job, Vector3 pos, float yaw, Color color)
        {
            var go = new GameObject(job.office);
            go.transform.SetPositionAndRotation(pos, Quaternion.Euler(0f, yaw, 0f));
            var t = go.transform;
            var white = new Color(0.92f, 0.92f, 0.9f);
            // الكشك: جسم بلون الوظيفة، كاونتر أبيض، سقف، ولوحة فوق
            var booth = AgentParts.Part(PrimitiveType.Cube, "Booth", t, new Vector3(0f, 1.2f, -0.2f), new Vector3(2.2f, 2.4f, 1.4f), color, true);
            booth.layer = 0; // الكاميرا تصطدم فيه مثل أي مبنى
            AgentParts.Part(PrimitiveType.Cube, "Counter", t, new Vector3(0f, 1.0f, 0.55f), new Vector3(2.2f, 0.12f, 0.35f), white);
            AgentParts.Part(PrimitiveType.Cube, "Roof", t, new Vector3(0f, 2.5f, 0f), new Vector3(2.6f, 0.15f, 2.0f), white);
            AgentParts.Part(PrimitiveType.Cube, "Sign", t, new Vector3(0f, 3.05f, 0.1f), new Vector3(2.2f, 0.8f, 0.12f), color);
            AgentParts.Part(PrimitiveType.Cube, "SignStripe", t, new Vector3(0f, 3.05f, 0.17f), new Vector3(1.8f, 0.18f, 0.02f), white);
            if (job == Jobs.Police)
                AgentParts.Part(PrimitiveType.Sphere, "Light", t, new Vector3(0f, 3.6f, 0.1f), Vector3.one * 0.35f, new Color(0.3f, 0.5f, 1f));
            else
                AgentParts.Part(PrimitiveType.Cube, "Parcel", t, new Vector3(0.6f, 1.25f, 0.55f), new Vector3(0.4f, 0.3f, 0.3f), new Color(0.7f, 0.5f, 0.3f));
            var office = go.AddComponent<JobOffice>();
            office.job = job;
            return office;
        }

        void Start()
        {
            var player = FindAnyObjectByType<PlayerController>(FindObjectsInactive.Include);
            if (player != null) playerTransform = player.transform;
        }

        bool PlayerInRange()
        {
            if (playerTransform == null || !playerTransform.gameObject.activeInHierarchy) return false;
            if (VehicleInteraction.Current != null) return false;
            Vector3 d = playerTransform.position - transform.position;
            d.y = 0f;
            return d.sqrMagnitude <= useDistance * useDistance;
        }

        void Update()
        {
            if (!PlayerInRange()) { IsOpen = false; return; }
            if (Input.GetKeyDown(useKey)) IsOpen = !IsOpen;
            if (!IsOpen) return;
            if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.Keypad1)) Choose(1);
            else if (Input.GetKeyDown(KeyCode.Alpha2) || Input.GetKeyDown(KeyCode.Keypad2)) Choose(2);
        }

        /// <summary>ينفّذ الخيار رقم n من القائمة الحالية.</summary>
        public string Choose(int n)
        {
            var js = JobSystem.Instance;
            if (js == null) return "no job system";
            var st = js.State;
            bool mine = st.jobId == job.id;
            bool wasOnDuty = st.onDuty;
            string result = "";
            if (!mine) { if (n == 1) result = js.Apply(job); }   // القائمة تبقى مفتوحة، فـ [1] مرة ثانية تبدأ الدوام
            else if (st.onDuty) { if (n == 1) { js.CancelShift(); result = "cancel"; } }
            else if (n == 1) result = js.StartShift();
            else if (n == 2) result = js.Quit();
            if (js.State.onDuty != wasOnDuty) IsOpen = false;
            return result;
        }

        void OnGUI()
        {
            if (!PlayerInRange()) return;
            if (style == null)
            {
                style = new GUIStyle(GUI.skin.box) { fontSize = 18, alignment = TextAnchor.UpperLeft, richText = true, wordWrap = true };
                style.normal.textColor = Color.white;
                style.padding = new RectOffset(14, 14, 10, 10);
            }
            if (!IsOpen)
            {
                var prompt = new GUIStyle(style) { alignment = TextAnchor.MiddleCenter, fontSize = 20 };
                GUI.Box(new Rect(Screen.width * 0.5f - 150f, Screen.height - 140f, 300f, 40f), "[" + useKey + "]  " + job.office, prompt);
                return;
            }

            var js = JobSystem.Instance;
            var st = js != null ? js.State : new JobState();
            int done = st.ShiftsDone(job.id);
            var rank = job.RankFor(done);
            string text = "<b>" + job.office + "</b>\n" + job.title + ": " + (job.task == JobTaskKind.Patrol ? "patrol the streets around the block." : "pick up packages here and deliver them on foot.")
                + "\nPay: $" + rank.payPerShift + " per shift (" + rank.title + "). Promotion after more shifts.\n";
            if (st.jobId != job.id)
            {
                text += "Requires: health " + job.minHealthToApply.ToString("0") + "+" + (job.minFoodToApply > 0f ? ", not hungry or thirsty" : "") + "\n";
                if (Jobs.Get(st.jobId) != null) text += "<color=#ffcc66>Applying here replaces your job as " + Jobs.Get(st.jobId).title + ".</color>\n";
                text += "\n[1]  Apply";
            }
            else if (st.onDuty) text += "\nYou are on duty.\n[1]  Cancel shift (no pay)";
            else text += "\nShifts done here: " + done + "\n[1]  Start shift\n[2]  Quit job";
            text += "\n[" + useKey + "]  Close";
            GUI.Box(new Rect(Screen.width * 0.5f - 240f, Screen.height * 0.5f - 130f, 480f, 260f), text, style);
        }
    }
}
