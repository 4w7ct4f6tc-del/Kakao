using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using VehiclePhysics;

namespace RealLife
{
    /// <summary>
    /// الحفظ والتحميل: مكان اللاعب، فلوسه وحالته، وأماكن السيارات. ملف JSON واحد في persistentDataPath.
    /// يحمّل بروحه أول ما تبدأ اللعبة، ويحفظ كل autosaveSeconds ووقت الخروج. F5 حفظ، F9 تحميل.
    /// </summary>
    public class SaveSystem : MonoBehaviour
    {
        [Serializable]
        public class VehicleSave
        {
            public string name;
            public Vector3 position;
            public Quaternion rotation;
        }

        [Serializable]
        public class SaveData
        {
            public int version = 1;
            public string scene;
            public string savedAtUtc;
            public Vector3 playerPosition;
            public float playerYaw;
            public int money;
            public float health, hunger, thirst;
            public List<VehicleSave> vehicles = new List<VehicleSave>();
            public JobState job;   // المرحلة 5: الوظيفة والرتبة وعدد الدوامات (الحفظ القديم ما فيه، فيرجع null)
        }

        public static SaveSystem Instance { get; private set; }

        public string fileName = "save.json";
        public bool loadOnStart = true;
        public float autosaveSeconds = 30f;
        public KeyCode saveKey = KeyCode.F5;
        public KeyCode loadKey = KeyCode.F9;

        public string FilePath => Path.Combine(Application.persistentDataPath, fileName);

        PlayerController player;
        float nextAutosave;

        void Awake() => Instance = this;

        void Start()
        {
            player = FindAnyObjectByType<PlayerController>(FindObjectsInactive.Include);
            nextAutosave = Time.time + autosaveSeconds;
            if (loadOnStart && File.Exists(FilePath)) Load();
        }

        void Update()
        {
            if (Input.GetKeyDown(saveKey)) { if (Save()) Say("Game saved"); }
            else if (Input.GetKeyDown(loadKey)) Say(Load() ? "Game loaded" : "No save found");

            if (autosaveSeconds > 0f && Time.time >= nextAutosave)
            {
                nextAutosave = Time.time + autosaveSeconds;
                Save();
            }
        }

        void OnApplicationQuit() => Save();

        public bool Save()
        {
            PlayerStats stats = PlayerStats.Instance;
            if (player == null || stats == null) return false;

            var data = new SaveData
            {
                scene = gameObject.scene.name,
                savedAtUtc = DateTime.UtcNow.ToString("o"),
                money = stats.money, health = stats.health, hunger = stats.hunger, thirst = stats.thirst,
            };

            // إذا اللاعب يسوق، نحفظ مكانه جنب باب السيارة (لأنه يرجع على رجوله بعد التحميل)
            VehicleInteraction driving = VehicleInteraction.Current;
            if (driving != null)
            {
                Transform car = driving.transform;
                data.playerPosition = car.position - Vector3.ProjectOnPlane(car.right, Vector3.up).normalized * driving.sideExitOffset + Vector3.up * 0.5f;
                data.playerYaw = car.eulerAngles.y;
            }
            else
            {
                data.playerPosition = player.transform.position;
                data.playerYaw = player.transform.eulerAngles.y;
            }

            if (JobSystem.Instance != null) data.job = JobSystem.Instance.State;

            foreach (var v in FindObjectsByType<VehicleInteraction>(FindObjectsInactive.Include))
                data.vehicles.Add(new VehicleSave { name = v.name, position = v.transform.position, rotation = v.transform.rotation });

            try
            {
                string tmp = FilePath + ".tmp";
                File.WriteAllText(tmp, JsonUtility.ToJson(data, true));
                if (File.Exists(FilePath)) File.Delete(FilePath);
                File.Move(tmp, FilePath);
                return true;
            }
            catch (Exception e)
            {
                Debug.LogWarning("Save failed: " + e.Message);
                return false;
            }
        }

        public bool Load()
        {
            if (!File.Exists(FilePath)) return false;
            SaveData data;
            try { data = JsonUtility.FromJson<SaveData>(File.ReadAllText(FilePath)); }
            catch (Exception e) { Debug.LogWarning("Load failed: " + e.Message); return false; }
            if (data == null) return false;
            // حفظ من مشهد ثاني: ناخذ الفلوس والحالة بس، والأماكن لا
            bool sameScene = data.scene == gameObject.scene.name;

            PlayerStats stats = PlayerStats.Instance;
            if (stats != null)
            {
                stats.money = Mathf.Max(0, data.money);
                stats.health = Mathf.Clamp(data.health, 1f, 100f);
                stats.hunger = Mathf.Clamp(data.hunger, 0f, 100f);
                stats.thirst = Mathf.Clamp(data.thirst, 0f, 100f);
            }
            if (JobSystem.Instance != null) JobSystem.Instance.LoadState(data.job);
            if (!sameScene) return true;

            if (VehicleInteraction.Current != null) VehicleInteraction.Current.Exit();

            foreach (var v in FindObjectsByType<VehicleInteraction>(FindObjectsInactive.Include))
            {
                VehicleSave saved = data.vehicles.Find(s => s.name == v.name);
                if (saved == null) continue;
                var vpp = v.GetComponent<VehicleBase>();
                if (vpp != null && vpp.initialized) vpp.HardReposition(saved.position + Vector3.up * 0.1f, saved.rotation, true);
                else
                {
                    v.transform.SetPositionAndRotation(saved.position + Vector3.up * 0.1f, saved.rotation);
                    var rb = v.GetComponent<Rigidbody>();
                    if (rb != null && !rb.isKinematic) { rb.linearVelocity = Vector3.zero; rb.angularVelocity = Vector3.zero; }
                }
            }

            if (player != null)
            {
                var cc = player.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                player.transform.SetPositionAndRotation(data.playerPosition + Vector3.up * 0.05f, Quaternion.Euler(0f, data.playerYaw, 0f));
                if (cc != null) cc.enabled = true;
            }
            return true;
        }

        public bool DeleteSave()
        {
            if (!File.Exists(FilePath)) return false;
            File.Delete(FilePath);
            return true;
        }

        static void Say(string message)
        {
            if (PlayerStats.Instance != null) PlayerStats.Instance.Notify(message);
        }
    }
}
