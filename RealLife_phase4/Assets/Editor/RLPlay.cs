using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using VehiclePhysics;

namespace RealLife.EditorTools
{
    /// <summary>أدوات تجربة آلية: دخول Play، حالة اللعبة، تجربة ركوب وسواقة، وتسجيل الأخطاء في Library/RLBridge/log.txt.</summary>
    [InitializeOnLoad]
    public static class RLPlay
    {
        static string LogFile => Path.Combine(RLBridge.Dir, "log.txt");

        static RLPlay()
        {
            Application.logMessageReceived += (msg, stack, type) =>
            {
                if (type == LogType.Log) return;
                try { File.AppendAllText(LogFile, type + ": " + msg + "\n" + (type == LogType.Warning ? "" : stack + "\n")); } catch { }
            };
        }

        public static string ClearLog() { File.WriteAllText(LogFile, ""); return "cleared"; }

        public static string Enter(string scenePath)
        {
            if (EditorApplication.isPlaying) return "already playing";
            if (!string.IsNullOrWhiteSpace(scenePath)) EditorSceneManager.OpenScene(scenePath.Trim(), OpenSceneMode.Single);
            File.WriteAllText(LogFile, "");
            EditorApplication.EnterPlaymode();
            return "entering play mode";
        }

        public static string Exit()
        {
            if (EditorApplication.isPlaying) EditorApplication.ExitPlaymode();
            return "exit requested";
        }

        public static string Status()
        {
            var sb = new StringBuilder("playing=" + EditorApplication.isPlaying + " paused=" + EditorApplication.isPaused
                + " compiling=" + EditorApplication.isCompiling + " scene=" + UnityEngine.SceneManagement.SceneManager.GetActiveScene().name
                + " t=" + Time.time.ToString("0.0") + " fps=" + (1f / Mathf.Max(Time.smoothDeltaTime, 0.0001f)).ToString("0") + "\n");
            var player = Object.FindAnyObjectByType<PlayerController>(FindObjectsInactive.Include);
            if (player != null)
                sb.AppendLine("player active=" + player.gameObject.activeInHierarchy + " pos=" + player.transform.position + " grounded=" + player.IsGrounded);
            var cam = Camera.main;
            if (cam != null)
            {
                var tpc = cam.GetComponent<ThirdPersonCamera>();
                sb.AppendLine("camera pos=" + cam.transform.position + " target=" + (tpc != null && tpc.target != null ? tpc.target.name : "none"));
            }
            foreach (var v in Object.FindObjectsByType<VehicleInteraction>(FindObjectsInactive.Include))
            {
                var vb = v.GetComponent<VehicleBase>();
                var input = v.GetComponent<VPStandardInput>();
                sb.AppendLine(v.name + " pos=" + v.transform.position + " up=" + v.transform.up.y.ToString("0.00") + " driving=" + v.IsDriving
                    + " inputOn=" + (input != null && input.enabled)
                    + (vb != null ? " speed=" + vb.speed.ToString("0.0") + " rpm=" + (vb.data.Get(Channel.Vehicle, VehicleData.EngineRpm) / 1000f).ToString("0")
                        + " gear=" + vb.data.Get(Channel.Vehicle, VehicleData.GearboxGear) + " engineOn=" + vb.data.Get(Channel.Vehicle, VehicleData.EngineWorking) : ""));
            }
            return sb.ToString();
        }

        /// <summary>يركّب الشخصية أول سيارة (نفس اللي يسويه الزر F) ويدوس بنزين. الباراميتر: قوة البنزين 0..1.</summary>
        public static string DriveTest(string throttle)
        {
            if (!EditorApplication.isPlaying) return "not playing";
            var v = Object.FindObjectsByType<VehicleInteraction>(FindObjectsInactive.Include).OrderBy(x => x.name).LastOrDefault();
            if (v == null) return "no vehicle";
            if (!v.IsDriving) v.Enter();
            var input = v.GetComponent<VPStandardInput>();
            if (input != null) input.externalThrottle = float.Parse(throttle, System.Globalization.CultureInfo.InvariantCulture);
            return "driving " + v.name + "\n" + Status();
        }

        /// <summary>تجربة المرحلة 2: يجوّع اللاعب، يشتري من المحل، ويقدّم الوقت. يرجّع القيم قبل وبعد.</summary>
        public static string StatsTest()
        {
            if (!EditorApplication.isPlaying) return "not playing";
            var s = PlayerStats.Instance;
            var shop = Object.FindAnyObjectByType<Shop>();
            if (s == null || shop == null) return "missing stats=" + (s != null) + " shop=" + (shop != null);
            var sb = new StringBuilder();
            string Line(string tag) => tag + ": money=" + s.money + " health=" + s.health.ToString("0.0") + " food=" + s.hunger.ToString("0.0") + " water=" + s.thirst.ToString("0.0") + " msg=" + s.LastMessage;
            sb.AppendLine(Line("start"));
            s.hunger = 10f; s.thirst = 10f;
            sb.AppendLine(Line("hungry"));
            sb.AppendLine("buy meal -> " + shop.Buy(3)); sb.AppendLine(Line("after meal"));
            sb.AppendLine("buy water -> " + shop.Buy(0)); sb.AppendLine(Line("after water"));
            s.Tick(600f); sb.AppendLine(Line("after 10 min"));
            int before = s.money; s.money = 3;
            sb.AppendLine("buy with $3 -> " + shop.Buy(2)); sb.AppendLine(Line("broke"));
            s.money = before;
            s.hunger = 0f; s.thirst = 0f; s.health = 5f; s.Tick(30f);
            sb.AppendLine(Line("passed out"));
            var p = Object.FindAnyObjectByType<PlayerController>(FindObjectsInactive.Include);
            sb.AppendLine("player pos=" + p.transform.position + " shop pos=" + shop.transform.position);
            return sb.ToString();
        }

        /// <summary>تجربة المرحلة 3. step = "save": يغيّر القيم ويحفظ. step = "check": يطبع القيم الحالية (بعد إعادة تشغيل Play). step = "delete": يمسح ملف الحفظ.</summary>
        public static string SaveTest(string step)
        {
            if (!EditorApplication.isPlaying) return "not playing";
            var save = SaveSystem.Instance; var s = PlayerStats.Instance;
            var p = Object.FindAnyObjectByType<PlayerController>(FindObjectsInactive.Include);
            if (save == null || s == null || p == null) return "missing";
            step = step.Trim();
            if (step == "delete") return "deleted=" + save.DeleteSave() + " path=" + save.FilePath;
            if (step == "save")
            {
                s.money = 1234; s.hunger = 42f; s.thirst = 33f; s.health = 77f;
                var cc = p.GetComponent<CharacterController>(); cc.enabled = false;
                p.transform.position += new Vector3(6f, 0f, 3f); cc.enabled = true;
                bool ok = save.Save();
                string saved = "saved=" + ok + " pos=" + p.transform.position;
                // نخرّب القيم ونحمّل، عشان نتأكد إن التحميل داخل نفس الجلسة يرجّعها
                s.money = 1; cc.enabled = false; p.transform.position += Vector3.right * 20f; cc.enabled = true;
                bool loaded = save.Load();
                return saved + "\nreloaded=" + loaded + " money=" + s.money + " pos=" + p.transform.position + "\npath=" + save.FilePath;
            }
            var car = Object.FindAnyObjectByType<VehicleInteraction>(FindObjectsInactive.Include);
            return "money=" + s.money + " health=" + s.health.ToString("0") + " food=" + s.hunger.ToString("0") + " water=" + s.thirst.ToString("0")
                + " pos=" + p.transform.position + (car != null ? " car=" + car.transform.position : "") + " fileExists=" + File.Exists(save.FilePath);
        }

        /// <summary>
        /// تجربة المرحلة 4 (المواطنين والمرور). step = "report": وين البلوك والحارات وكم واحد يتحرك.
        /// step = "hit": يطيّح أول مواطن (كأن سيارة صدمته) ويطبع حالته. step = "rescan": يعيد المسح والتوزيع.
        /// </summary>
        public static string TrafficTest(string step)
        {
            if (!EditorApplication.isPlaying) return "not playing";
            var t = TrafficSystem.Instance;
            if (t == null) return "no TrafficSystem (is there a Game object with PlayerStats?)";
            if (!t.Ready) return "traffic not ready yet";
            step = (step ?? "").Trim();
            if (step == "rescan") { t.Setup(); return t.Report(); }
            if (step == "hit")
            {
                if (t.Pedestrians.Count == 0) return "no pedestrians";
                var ped = t.Pedestrians[0];
                ped.KnockDown(ped.transform.forward * 10f);
                return "knocked ped0 state=" + ped.State + " msg=" + (PlayerStats.Instance != null ? PlayerStats.Instance.LastMessage : "") + "\n" + t.Report();
            }
            return t.Report();
        }

        public static string ExitCarTest()
        {
            if (!EditorApplication.isPlaying) return "not playing";
            var v = VehicleInteraction.Current;
            if (v == null) return "not driving";
            var input = v.GetComponent<VPStandardInput>();
            if (input != null) input.externalThrottle = 0f;
            v.Exit();
            return "exited\n" + Status();
        }
    }
}
