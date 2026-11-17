using UnityEngine;

namespace RealLife
{
    /// <summary>
    /// واجهة اللعبة (OnGUI): أزرار التحكم على اليسار، والفلوس والصحة والجوع والعطش على اليمين، ورسايل قصيرة فوق.
    /// تنحط على كائن "Game" المستقل عشان تبقى ظاهرة وقت السواقة.
    /// النصوص إنجليزي لأن OnGUI ما يدعم توصيل الحروف العربية.
    /// </summary>
    public class GameHUD : MonoBehaviour
    {
        PlayerController player;
        PlayerStats stats;
        GUIStyle boxStyle, labelStyle, moneyStyle, toastStyle;
        Texture2D white;
        bool showHelp = true;

        void Start()
        {
            player = FindAnyObjectByType<PlayerController>(FindObjectsInactive.Include);
            stats = PlayerStats.Instance != null ? PlayerStats.Instance : FindAnyObjectByType<PlayerStats>();
        }

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.H)) showHelp = !showHelp;
        }

        void OnGUI()
        {
            if (boxStyle == null) BuildStyles();

            // --- يسار: المساعدة والسرعة ---
            bool driving = VehicleInteraction.Current != null;
            string speed;
            if (driving)
            {
                var rb = VehicleInteraction.Current.GetComponent<Rigidbody>();
                speed = "Speed: " + (rb != null ? rb.linearVelocity.magnitude * 3.6f : 0f).ToString("0") + " km/h";
            }
            else speed = player != null ? "Speed: " + player.CurrentSpeed.ToString("0.0") + " m/s" : "";

            string help = driving
                ? "RealLife - Driving\nW / S: Throttle / Brake\nA / D: Steer\nSpace: Handbrake\nF: Exit car\nMouse: Look   Wheel: Zoom\nF5: Save   F9: Load   H: Hide help\n"
                : "RealLife\nWASD / Arrows: Move\nShift: Run   Space: Jump\nF: Enter car   E: Shop / Job office\nMouse: Look   Wheel: Zoom\nF5: Save   F9: Load\nEsc: Free cursor   H: Hide help\n";
            GUI.Box(new Rect(12, 12, 280, showHelp ? (driving ? 166 : 184) : 34), showHelp ? help + speed : speed, boxStyle);

            // --- يمين: الفلوس والحالة ---
            if (stats == null) return;
            float w = 240f, x = Screen.width - w - 12f, y = 12f;
            GUI.Box(new Rect(x, y, w, 132f), GUIContent.none, boxStyle);
            GUI.Label(new Rect(x + 12f, y + 6f, w - 24f, 30f), "$ " + stats.money.ToString("N0"), moneyStyle);
            Bar(x + 12f, y + 44f, w - 24f, "Health", stats.health, new Color(0.85f, 0.2f, 0.2f));
            Bar(x + 12f, y + 72f, w - 24f, "Food", stats.hunger, new Color(0.9f, 0.6f, 0.15f));
            Bar(x + 12f, y + 100f, w - 24f, "Water", stats.thirst, new Color(0.2f, 0.55f, 0.95f));

            string warn = stats.hunger <= 0f || stats.thirst <= 0f ? "You are starving - health is dropping!"
                : stats.IsHungry && stats.IsThirsty ? "You are hungry and thirsty"
                : stats.IsHungry ? "You are hungry" : stats.IsThirsty ? "You are thirsty" : null;
            string toast = Time.time - stats.LastMessageTime < 3.5f ? stats.LastMessage : warn;
            if (!string.IsNullOrEmpty(toast))
                GUI.Box(new Rect(Screen.width * 0.5f - 220f, 14f, 440f, 36f), toast, toastStyle);
        }

        void Bar(float x, float y, float w, string label, float value, Color color)
        {
            GUI.Label(new Rect(x, y, 58f, 22f), label, labelStyle);
            var back = new Rect(x + 60f, y + 4f, w - 60f, 14f);
            Color prev = GUI.color;
            GUI.color = new Color(0f, 0f, 0f, 0.6f);
            GUI.DrawTexture(back, white);
            GUI.color = value < 25f && Mathf.Repeat(Time.time, 1f) < 0.5f ? Color.white : color;
            GUI.DrawTexture(new Rect(back.x + 1f, back.y + 1f, (back.width - 2f) * Mathf.Clamp01(value / 100f), back.height - 2f), white);
            GUI.color = prev;
        }

        void BuildStyles()
        {
            white = Texture2D.whiteTexture;
            boxStyle = new GUIStyle(GUI.skin.box) { fontSize = 14, alignment = TextAnchor.UpperLeft, wordWrap = true };
            boxStyle.normal.textColor = Color.white;
            boxStyle.padding = new RectOffset(10, 10, 8, 8);
            labelStyle = new GUIStyle(GUI.skin.label) { fontSize = 13 };
            labelStyle.normal.textColor = Color.white;
            moneyStyle = new GUIStyle(GUI.skin.label) { fontSize = 22, fontStyle = FontStyle.Bold };
            moneyStyle.normal.textColor = new Color(0.45f, 0.95f, 0.45f);
            toastStyle = new GUIStyle(GUI.skin.box) { fontSize = 16, alignment = TextAnchor.MiddleCenter };
            toastStyle.normal.textColor = Color.white;
        }
    }
}
