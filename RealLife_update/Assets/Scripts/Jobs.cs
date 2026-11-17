using System;
using System.Collections.Generic;

namespace RealLife
{
    /// <summary>نوع المهمة في الدوام.</summary>
    public enum JobTaskKind
    {
        Patrol,     // الشرطة: تمر على نقاط حول البلوك (مشي أو بالسيارة)
        Delivery,   // التوصيل: تاخذ الطرد من المستودع وتوصّله للباب (على رجولك)
    }

    /// <summary>رتبة في وظيفة: اسمها، راتب الدوام، وكم دوام لازم عشان توصلها.</summary>
    [Serializable]
    public class JobRank
    {
        public string title;
        public int payPerShift;
        public int shiftsRequired;
        public JobRank(string title, int pay, int shifts) { this.title = title; payPerShift = pay; shiftsRequired = shifts; }
    }

    /// <summary>تعريف وظيفة. بيانات بس، عشان بعدين (الأونلاين) السيرفر يقرر.</summary>
    public class JobDefinition
    {
        public string id;
        public string title;
        public string office;          // اسم المكان اللي تقدّم فيه
        public JobTaskKind task;
        public int tasksPerShift;
        public float minHealthToApply; // شرط القبول: لياقة
        public float minFoodToApply;   // شرط القبول: مب جوعان ولا عطشان
        public int applicationFee;
        public JobRank[] ranks;

        public JobRank RankFor(int shiftsDone)
        {
            JobRank r = ranks[0];
            foreach (var k in ranks) if (shiftsDone >= k.shiftsRequired) r = k;
            return r;
        }

        public int RankIndexFor(int shiftsDone)
        {
            int idx = 0;
            for (int i = 0; i < ranks.Length; i++) if (shiftsDone >= ranks[i].shiftsRequired) idx = i;
            return idx;
        }
    }

    /// <summary>حالة وظيفة اللاعب. تنحفظ مع الحفظ (JsonUtility).</summary>
    [Serializable]
    public class JobState
    {
        public string jobId = "";          // فاضي = عاطل
        public bool onDuty;
        public int taskIndex;              // كم مهمة خلصت في الدوام الحالي
        public bool carrying;              // التوصيل: الطرد معك؟
        public int totalEarned;
        public List<string> shiftKeys = new List<string>();   // JsonUtility ما يحفظ Dictionary
        public List<int> shiftValues = new List<int>();

        public int ShiftsDone(string id)
        {
            int i = shiftKeys.IndexOf(id);
            return i < 0 ? 0 : shiftValues[i];
        }

        public void AddShift(string id)
        {
            int i = shiftKeys.IndexOf(id);
            if (i < 0) { shiftKeys.Add(id); shiftValues.Add(1); }
            else shiftValues[i]++;
        }
    }

    /// <summary>قوانين الوظايف: تقديم، دوام، راتب، ترقية. بدون Unity ولا واجهة.</summary>
    public static class Jobs
    {
        public static readonly JobDefinition Police = new JobDefinition
        {
            id = "police",
            title = "Police",
            office = "Police Station",
            task = JobTaskKind.Patrol,
            tasksPerShift = 4,
            minHealthToApply = 60f,
            minFoodToApply = 25f,
            applicationFee = 0,
            ranks = new[]
            {
                new JobRank("Cadet", 120, 0),
                new JobRank("Officer", 180, 3),
                new JobRank("Sergeant", 260, 8),
                new JobRank("Lieutenant", 360, 15),
                new JobRank("Captain", 500, 25),
            },
        };

        public static readonly JobDefinition Courier = new JobDefinition
        {
            id = "courier",
            title = "Courier",
            office = "Delivery Depot",
            task = JobTaskKind.Delivery,
            tasksPerShift = 3,
            minHealthToApply = 20f,
            minFoodToApply = 0f,
            applicationFee = 0,
            ranks = new[]
            {
                new JobRank("Courier", 75, 0),
                new JobRank("Senior Courier", 110, 4),
                new JobRank("Route Lead", 160, 10),
            },
        };

        public static readonly JobDefinition[] All = { Police, Courier };

        public static JobDefinition Get(string id)
        {
            foreach (var j in All) if (j.id == id) return j;
            return null;
        }

        /// <summary>يرجّع null إذا مقبول، أو سبب الرفض.</summary>
        public static string CanApply(JobState s, JobDefinition job, float health, float hunger, float thirst, int money)
        {
            if (s.jobId == job.id) return "You already work here.";
            if (s.onDuty) return "Finish your current shift first.";
            if (health < job.minHealthToApply) return "Rejected: failed the fitness test (health " + health.ToString("0") + "/" + job.minHealthToApply.ToString("0") + ").";
            if (hunger < job.minFoodToApply || thirst < job.minFoodToApply) return "Rejected: you look too hungry or thirsty. Eat first.";
            if (money < job.applicationFee) return "Application fee is $" + job.applicationFee + ".";
            return null;
        }

        public static void Hire(JobState s, JobDefinition job)
        {
            s.jobId = job.id;
            s.onDuty = false;
            s.taskIndex = 0;
            s.carrying = false;
        }

        public static void Quit(JobState s)
        {
            s.jobId = "";
            s.onDuty = false;
            s.taskIndex = 0;
            s.carrying = false;
        }

        public static void StartShift(JobState s)
        {
            s.onDuty = true;
            s.taskIndex = 0;
            s.carrying = false;
        }

        /// <summary>يخلّص مهمة. يرجّع true إذا الدوام كله خلص.</summary>
        public static bool CompleteTask(JobState s, JobDefinition job)
        {
            s.taskIndex++;
            return s.taskIndex >= job.tasksPerShift;
        }

        /// <summary>يقفل الدوام ويحسب الراتب. promoted = صار ترقية.</summary>
        public static int FinishShift(JobState s, JobDefinition job, out bool promoted, out JobRank newRank)
        {
            int before = job.RankIndexFor(s.ShiftsDone(job.id));
            int pay = job.RankFor(s.ShiftsDone(job.id)).payPerShift;
            s.AddShift(job.id);
            int after = job.RankIndexFor(s.ShiftsDone(job.id));
            promoted = after > before;
            newRank = job.ranks[after];
            s.onDuty = false;
            s.taskIndex = 0;
            s.carrying = false;
            s.totalEarned += pay;
            return pay;
        }
    }
}
