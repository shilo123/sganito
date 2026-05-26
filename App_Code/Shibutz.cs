using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.IO;

public class Shibutz
{
    // ====== CONFIG ======
    private const int MAX_CONSECUTIVE = 15;      // Almost no limit (as requested)
    private const int CHAIN_DEPTH = 6;           // Was 10 — 6 is ~4x faster with similar result
    private const int MAX_VISITS_PER_TIME = 800; // Was 1500

    // ====== PROGRESS TRACKING ======
    public readonly List<string> ProgressLog = new List<string>();
    private System.Diagnostics.Stopwatch _sw;
    private int _lastLoggedRed = -1;

    // Shared in-memory progress store (NOT in Session, to avoid lock contention
    // with the long-running assign request). Keyed by ConfigurationId.
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, ShibutzLiveStatus>
        _liveStatus = new System.Collections.Concurrent.ConcurrentDictionary<int, ShibutzLiveStatus>();

    // Cancellation flags. Set by the cancel endpoint; checked by the algorithm
    // at safe points (between iterations / phases) so it can abort early.
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, bool>
        _cancelRequested = new System.Collections.Concurrent.ConcurrentDictionary<int, bool>();

    public static void RequestCancel(int configurationId)
    {
        _cancelRequested[configurationId] = true;
    }

    public static bool IsCancelRequested(int configurationId)
    {
        bool v;
        return _cancelRequested.TryGetValue(configurationId, out v) && v;
    }

    public static void ClearCancel(int configurationId)
    {
        bool removed;
        _cancelRequested.TryRemove(configurationId, out removed);
    }

    public static ShibutzLiveStatus GetLiveStatus(int configurationId)
    {
        ShibutzLiveStatus s;
        if (_liveStatus.TryGetValue(configurationId, out s)) return s;
        return null;
    }

    public static void ResetLiveStatus(int configurationId)
    {
        ShibutzLiveStatus s = new ShibutzLiveStatus();
        s.StartedAt = DateTime.UtcNow;
        s.IsRunning = true;
        s.CurrentStep = "מתחיל שיבוץ...";
        _liveStatus[configurationId] = s;
        ClearCancel(configurationId);  // fresh run - clear any stale cancel flag
    }

    private void UpdateLiveStatus(string currentStep, int totalSlots, int totalReds)
    {
        ShibutzLiveStatus s;
        if (!_liveStatus.TryGetValue(_configurationId, out s)) return;
        s.CurrentStep = currentStep;
        s.TotalSlots = totalSlots;
        s.RedSlots = totalReds;
        s.ElapsedMs = _sw != null ? _sw.ElapsedMilliseconds : 0;

        // Per-class progress: how many slots in each class are filled/total
        if (_allSlots != null)
        {
            Dictionary<int, int[]> perClass = new Dictionary<int, int[]>();
            for (int i = 0; i < _allSlots.Count; i++)
            {
                HourSlot sl = _allSlots[i];
                int[] stats;
                if (!perClass.TryGetValue(sl.ClassId, out stats)) { stats = new int[2]; perClass[sl.ClassId] = stats; }
                stats[0]++;                                   // total
                if (sl.AssignedTeacherId > 0) stats[1]++;     // filled
            }
            List<ClassProgress> list = new List<ClassProgress>();
            foreach (var kv in perClass)
            {
                ClassProgress cp = new ClassProgress();
                cp.ClassId = kv.Key;
                cp.ClassName = _classNames.ContainsKey(kv.Key) ? _classNames[kv.Key] : ("כיתה " + kv.Key);
                cp.TotalSlots = kv.Value[0];
                cp.FilledSlots = kv.Value[1];
                list.Add(cp);
            }
            s.Classes = list;
        }
    }

    public static void MarkLiveDone(int configurationId)
    {
        ShibutzLiveStatus s;
        if (_liveStatus.TryGetValue(configurationId, out s))
        {
            s.IsRunning = false;
            s.CurrentStep = "הסתיים";
        }
    }

    private void LogStep(string step)
    {
        if (_sw == null) return;
        int reds = CountRedSlots();
        long ms = _sw.ElapsedMilliseconds;
        ProgressLog.Add(ms + "ms | reds=" + reds + " | " + step);
        _lastLoggedRed = reds;

        // Update live shared status
        UpdateLiveStatus(step, _allSlots != null ? _allSlots.Count : 0, reds);
    }

    private readonly int _configurationId;

    private readonly List<HourSlot> _allSlots = new List<HourSlot>();

    // Remaining per (ClassId, TeacherId) based on ct.LastTeacherHoursInClass
    private readonly Dictionary<string, int> _remaining = new Dictionary<string, int>();

    // Teacher busy per (TeacherId, Day, Hour) => assigned slot (prevents teacher duplication at same hour)
    private readonly Dictionary<int, Dictionary<int, Dictionary<int, HourSlot>>> _busy =
        new Dictionary<int, Dictionary<int, Dictionary<int, HourSlot>>>();

    // Teacher hours set per day for consecutive
    private readonly Dictionary<int, Dictionary<int, HashSet<int>>> _teacherDayHours =
        new Dictionary<int, Dictionary<int, HashSet<int>>>();

    // TeacherId -> HomeClassId (TafkidId==1)
    private readonly Dictionary<int, int> _homeClassByTeacher = new Dictionary<int, int>();

    // ClassId -> HomeroomTeacherId (the FIRST TafkidId=1 for this class)
    private readonly Dictionary<int, int> _homeroomByClass = new Dictionary<int, int>();

    // ClassId -> ClassName
    private readonly Dictionary<int, string> _classNames = new Dictionary<int, string>();

    // ClassId -> LayerId. Populated in BuildModel from the Class table.
    // Hakbatza groups are now keyed by LayerId (a "shchava" / grade level)
    // rather than ClassId, so a hakbatza like "math, level 1" can pull
    // students out of every class in the same grade and have multiple
    // teachers working in parallel — one per class.
    private readonly Dictionary<int, int> _classLayer = new Dictionary<int, int>();
    // teacherId -> FreeDay (1-6, 0 means no free day). Pulled from the Teacher
    // table at BuildModel time so the scheduler can hard-block any candidate
    // whose FreeDay matches the slot's day digit (HourId / 10).
    private readonly Dictionary<int, int> _teacherFreeDay = new Dictionary<int, int>();

    // TeacherId -> TeacherName
    private readonly Dictionary<int, string> _teacherNames = new Dictionary<int, string>();

    // TeacherId -> HashSet of HourId (working hours for each teacher)
    private readonly Dictionary<int, HashSet<int>> _teacherWorkingHours = new Dictionary<int, HashSet<int>>();

    // (TeacherId × ClassId × Day) → count of hours already assigned. Used by
    // ScoreCandidate to apply a quadratic penalty so the scheduler spreads a
    // teacher's hours in a class across multiple days, instead of letting one
    // teacher own a full day. Updated on every ApplyAssign / UndoAssign.
    private readonly Dictionary<int, Dictionary<int, Dictionary<int, int>>> _teacherClassDayCount =
        new Dictionary<int, Dictionary<int, Dictionary<int, int>>>();

    // Flag: When true, protect homeroom teachers at hour 1 from being moved
    private bool _protectHomeroomHour1 = false;

    // Hakbatza/Ihud groups - key = "classId_hak_ihud" OR "hak_ihud" (for Ihud across classes)
    // Value = list of (TeacherId, ClassId, ProfessionalId, LastTeacherHoursInClass) in the group
    private readonly Dictionary<string, List<ClassTeacher>> _hakbatzaGroups = new Dictionary<string, List<ClassTeacher>>();

    // Hakbatza meta-data — נטען מהטבלה החדשה Hakbatza ב-BuildModel.
    // המפתח הוא gkey ("H_layer_number") כמו ב-_hakbatzaGroups.
    // כל record כולל את הנתונים האטומיים של ההקבצה: HakbatzaId, Hours (משך
    // אטומי), Mode (simple/bijection/partial), רשימות Classes ו-Teachers.
    public class HakbatzaMeta
    {
        public int HakbatzaId;
        public int LayerId;
        public int Number;
        public int Hours;          // X = כמה שעות ההקבצה רצה
        public string Mode;        // "simple" / "bijection" / "partial"
        public List<int> Classes = new List<int>();
        public List<int> Teachers = new List<int>();
        public Dictionary<int, int> TeacherHours = new Dictionary<int, int>(); // TeacherId → HoursContribution
    }
    private readonly Dictionary<string, HakbatzaMeta> _hakbatzaMeta = new Dictionary<string, HakbatzaMeta>();

    // _soloHours[ClassId_TeacherId] = solo Hour של ה-CT (Hakbatza IS NULL).
    // משמש את PreScheduleHakbatzas לדעת מה להחזיר ל-_remaining אחרי שהוא
    // מאפס את ההקבצה — אם יש למורה גם solo + Hak לאותה כיתה, הסולו אמור
    // להישאר לו פעיל (הקבצה רק "צרכה" Hak shares שלו, לא solo shares).
    private readonly Dictionary<string, int> _soloHours = new Dictionary<string, int>();

    // Extra assignments to write to DB for Hakbatza/Ihud partners
    // Key = "classId_hourId_teacherId" to avoid duplicates
    private readonly Dictionary<string, ExtraAssignment> _extraAssignments = new Dictionary<string, ExtraAssignment>();

    // When true, assign even when normal constraints fail (FORCE mode)
    private bool _forceMode = false;

    public readonly List<ShibutzError> Errors = new List<ShibutzError>();

    public Shibutz(DataSet ds, int configurationId)
    {
        _configurationId = configurationId;
        BuildModel(ds);
    }

    public List<HourSlot> GetSlots()
    {
        return _allSlots;
    }

    // =========================================================
    // PUBLIC: Start + Save Always
    // =========================================================
    public ShibutzRunResult StartShibutz_SaveAlways()
    {
        Errors.Clear();
        _busy.Clear();
        _teacherDayHours.Clear();
        _teacherClassDayCount.Clear();
        ProgressLog.Clear();
        _sw = System.Diagnostics.Stopwatch.StartNew();
        _lastLoggedRed = -1;

        // ============================================================
        // STEP 0: PRE-ASSIGN HOMEROOM TEACHERS TO HOUR 1
        // ============================================================
        LogStep("מציב מחנכים לשעה הראשונה של היום");
        AssignHomeroomToHour1();
        LogStep("מחנכים שובצו לשעה 1 בכיתות האם");

        // Extend opening into a 2-3 hour consecutive block per day (home class only)
        ExtendHomeroomOpeningBlock();
        LogStep("מרחיב פתיחת יום של מחנכים לבלוק של 2-3 שעות");

        // Pre-schedule Hakbatzas atomically: לכל הקבצה, נבחר X שעות (=MAX(Hour))
        // ובכל שעה bijection מורים↔כיתות. כך הקבצות רצות אטומית ולא חצי-לב.
        // ה-greedy אחר-כך ממלא רק את הסולו (Hak slots כבר תפוסים).
        PreScheduleHakbatzas();
        LogStep("הקבצות תוזמנו אטומית לפני המעגל הראשי");

        // group by time (Hour, Day) - early hours first
        Dictionary<int, List<HourSlot>> byTime = BuildTimeBuckets();
        List<int> timeKeys = new List<int>(byTime.Keys);
        timeKeys.Sort();

        List<int> hour1Keys = new List<int>();
        List<int> otherKeys = new List<int>();
        for (int i = 0; i < timeKeys.Count; i++)
        {
            int hourId = timeKeys[i];
            int day, hour;
            ResolveDayHour(hourId, out day, out hour);
            if (hour == 1) hour1Keys.Add(hourId);
            else otherKeys.Add(hourId);
        }

        // Fill remaining hour 1 slots directly (non-homeroom teachers)
        for (int i = 0; i < hour1Keys.Count; i++) DirectFill(byTime[hour1Keys[i]]);
        LogStep("מילוי ראשוני של שעה 1 הושלם");

        // Main pipeline iterations - early-stop when no progress OR when the
        // previous iteration made only small gains (<5% improvement).
        // Also stop after iteration 1 if reds drops below 10% of total slots
        // (iteration 2+ have historically made zero progress in that regime).
        int totalSlots = _allSlots.Count;
        for (int iteration = 0; iteration < 3; iteration++)
        {
            if (IsCancelRequested(_configurationId)) { LogStep("בקשת עצירה התקבלה — מפסיק"); break; }
            int redsBeforeIter = CountRedSlots();
            if (redsBeforeIter == 0) break;

            // Hour 1 pipeline
            LogStep("סבב " + (iteration + 1) + " — משבץ שעות פתיחה של כל הכיתות");
            for (int i = 0; i < hour1Keys.Count; i++)
            {
                if (IsCancelRequested(_configurationId)) break;
                List<HourSlot> slots = byTime[hour1Keys[i]];
                TryCrossTimeSwapsForBatch(slots);
                DirectFill(slots);
                FindAvailableTeachersFill(slots);
                SmartSwapFill(slots);
                LocalSwapFill(slots);
                DeepChainFill(slots, CHAIN_DEPTH);
            }
            if (IsCancelRequested(_configurationId)) { LogStep("בקשת עצירה התקבלה — מפסיק"); break; }
            // Other hours pipeline
            LogStep("סבב " + (iteration + 1) + " — משבץ שעות המשך של כל הכיתות");
            for (int i = 0; i < otherKeys.Count; i++)
            {
                if (IsCancelRequested(_configurationId)) break;
                List<HourSlot> slots = byTime[otherKeys[i]];
                TryCrossTimeSwapsForBatch(slots);
                DirectFill(slots);
                FindAvailableTeachersFill(slots);
                SmartSwapFill(slots);
                LocalSwapFill(slots);
                DeepChainFill(slots, CHAIN_DEPTH);
            }

            int redsAfterIter = CountRedSlots();
            int gain = redsBeforeIter - redsAfterIter;
            LogStep("סבב שיבוץ " + (iteration + 1) + " הושלם (שובצו עוד " + gain + " משבצות)");

            if (gain <= 0)
            {
                LogStep("אין התקדמות נוספת — מסיים סבבים");
                break;
            }
            // Less than 5% improvement - later iterations are unlikely to help
            if (gain * 20 < redsBeforeIter)
            {
                LogStep("שיפור נמוך (פחות מ-5%) — מסיים סבבים");
                break;
            }
            // אין יותר early-stop ב-10% — ממשיכים את כל 3 הסיבובים כדי
            // לתפוס את כל החוסרים האחרונים (ה-greedy יכול עדיין למצוא
            // ב-LocalSwap/DeepChain shifts שלא נמצאו ב-iter1).
        }

        // Single cross-time swap attempt with a tight time budget (10s).
        // Removed the MEGA cleanup loop entirely - in practice it burned 3-4
        // minutes for zero improvement beyond iteration 1.
        int redsBeforeCTS = CountRedSlots();
        if (redsBeforeCTS > 0)
        {
            CrossTimeSwapFill();
            int redsAfterCTS = CountRedSlots();
            LogStep("החלפות בין זמנים (חוסרים " + redsBeforeCTS + " → " + redsAfterCTS + ")");
            if (redsAfterCTS < redsBeforeCTS)
            {
                FillTeachersMissingHours();
                LogStep("השלמת שעות חסרות למורים הושלמה");
            }
        }
        else
        {
            LogStep("כל המשבצות שובצו — מסיים את הפייפליין הראשי");
        }

        // Hakbatza propagation: כעת מבוצע inline ב-ApplyAssign ע"י
        // ApplyHakbatzaPropagation, ש-מסנכרן partner-teacher שונה לכל
        // (C', H) בקבצה. הקריאה הישנה ל-ExpandHakbatzaIhudAssignments
        // השתמשה ב-busyFromSelf כדי להוסיף את **אותו** מורה לכיתה אחרת
        // — וזה גרם ל-double-booking (e.g. חיים בעדי+24 וגם בשמרית+24).
        // לא קוראים לה יותר.
        LogStep("הקבצות סונכרנו דרך ApplyHakbatzaPropagation");

        // Post-pass: תאים ריקים שניתן למלא ע"י מורים גלובליים-חסרי. אם
        // ה-greedy לא הצליח לתפוס את התא, אך יש מורה ב-Candidates שיש לו
        // CT.Hour לכיתה והוא לא busy ולא חסום, נשבץ אותו (ויתאזן Got<Req).
        FillEmptyByGlobalShortage();
        LogStep("Post-pass: מילוי תאים ריקים ע''י מורים חסרים");

        // Build detailed errors for remaining reds
        Errors.Clear();
        for (int i = 0; i < _allSlots.Count; i++)
        {
            if (_allSlots[i].AssignedTeacherId <= 0)
            {
                string reason = AnalyzeWhyNotAssigned(_allSlots[i]);
                AddError(_allSlots[i], reason);
            }
        }

        // Also build errors for teachers who still have remaining hours (group partners missing)
        BuildMissingTeacherErrors();

        // Save always (only assigned)
        int saved = SaveAssignmentsToDatabase_ReturnCount();

        ShibutzRunResult r = new ShibutzRunResult();
        r.SavedCount = saved;
        r.ErrorCount = Errors.Count;
        return r;
    }

    // =========================================================
    // HAKBATZA: Add co-teachers at same slots as their group partner.
    // Each member teaches their own class at the same hour, since a single
    // hakbatza spans every class in the same layer that opted in.
    // =========================================================
    private void ExpandHakbatzaIhudAssignments()
    {
        // For each slot that was assigned with a Hakbatza group, add the
        // other members.
        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot s = _allSlots[i];
            if (s.AssignedTeacherId <= 0) continue;
            if (s.AssignedHakbatza <= 0) continue; // Ihud removed

            string gkey = GetGroupKey(s.ClassId, s.AssignedHakbatza, 0);
            if (gkey == null) continue;

            List<ClassTeacher> group;
            if (!_hakbatzaGroups.TryGetValue(gkey, out group)) continue;
            if (group == null || group.Count <= 1) continue;

            for (int j = 0; j < group.Count; j++)
            {
                ClassTeacher ct = group[j];
                if (ct == null) continue;
                if (ct.TeacherId == s.AssignedTeacherId && ct.ClassId == s.ClassId) continue;

                // Each partner teaches their OWN class at the same hour.
                int targetClassId = ct.ClassId;

                // Skip if already assigned in this slot or extra assignment exists
                string extraKey = targetClassId + "_" + s.HourId + "_" + ct.TeacherId;
                if (_extraAssignments.ContainsKey(extraKey)) continue;

                // Check if there's a regular slot that's already assigned to this teacher here
                HourSlot existingSlot = FindSlot(targetClassId, s.Day, s.Hour);
                if (existingSlot != null && existingSlot.AssignedTeacherId == ct.TeacherId) continue;

                // CRITICAL: Check remaining hours - don't over-assign
                string rkCheck = Key(targetClassId, ct.TeacherId);
                int remCheck;
                if (!_remaining.TryGetValue(rkCheck, out remCheck) || remCheck <= 0) continue;

                // If teacher is busy at this time, skip — UNLESS the busy
                // mark is from the original Hakbatza placement we're now
                // propagating (i.e. ct.TeacherId == s.AssignedTeacherId).
                // Without this exception, the primary teacher gets marked
                // busy when assigned to slot s, then the propagation loop
                // refuses to add her to her partner classes in the same
                // Hakbatza — leaving real Hakbatza groups assigned to only
                // ONE of their classes (caught by the loop test: Hakbatza 4
                // in layer 5 / hour 44 was placed in ענת but never copied
                // to אודיה because מלי herself was "busy").
                bool busyFromSelf = (ct.TeacherId == s.AssignedTeacherId);
                if (!busyFromSelf && IsBusy(ct.TeacherId, s.Day, s.Hour))
                {
                    continue;
                }

                // Hakbatza propagation must also respect FreeDay — without
                // this, a Hakbatza assigned at a slot on day D would drag in
                // partners whose FreeDay = D, producing a real violation
                // (real case: teacher 30 / FreeDay=2 was extra-assigned at
                // HourId=24 because her Hakbatza partner was placed there).
                int partnerFreeDay;
                if (_teacherFreeDay.TryGetValue(ct.TeacherId, out partnerFreeDay)
                    && partnerFreeDay > 0
                    && partnerFreeDay == s.Day)
                {
                    continue;
                }

                ExtraAssignment ea = new ExtraAssignment();
                ea.ClassId = targetClassId;
                ea.HourId = s.HourId;
                ea.Day = s.Day;
                ea.Hour = s.Hour;
                ea.TeacherId = ct.TeacherId;
                ea.ProfessionalId = ct.ProfessionalId;
                ea.Hakbatza = s.AssignedHakbatza;
                ea.Ihud = 0; // Ihud removed from the model

                _extraAssignments[extraKey] = ea;

                // Mark as busy so other slots won't claim this teacher
                SetBusy(ct.TeacherId, s.Day, s.Hour, s);
                GetDaySet(ct.TeacherId, s.Day).Add(s.Hour);

                // Reduce remaining for this teacher/class
                string rk = Key(targetClassId, ct.TeacherId);
                if (_remaining.ContainsKey(rk) && _remaining[rk] > 0)
                {
                    _remaining[rk] = _remaining[rk] - 1;
                }
            }
        }
    }

    // Build errors for teachers who have remaining hours but were never placed
    // This happens when Hakbatza/Ihud partner prevented placement
    private void BuildMissingTeacherErrors()
    {
        Dictionary<string, int> missingPerTeacher = new Dictionary<string, int>();
        foreach (var kv in _remaining)
        {
            if (kv.Value <= 0) continue;
            missingPerTeacher[kv.Key] = kv.Value;
        }

        foreach (var kv in missingPerTeacher)
        {
            string[] parts = kv.Key.Split('_');
            if (parts.Length < 2) continue;
            int classId, teacherId;
            if (!int.TryParse(parts[0], out classId)) continue;
            if (!int.TryParse(parts[1], out teacherId)) continue;

            string cname = _classNames.ContainsKey(classId) ? _classNames[classId] : ("כיתה " + classId);
            string tname = _teacherNames.ContainsKey(teacherId) ? _teacherNames[teacherId] : ("מורה " + teacherId);

            ShibutzError e = new ShibutzError();
            e.ClassId = classId;
            e.Day = 0;
            e.Hour = 0;
            e.Message = "למורה " + tname + " חסרות " + kv.Value + " שעות בכיתה " + cname + ". ייתכן שיש התנגשות בהקבצה/איחוד או יום חופשי שחוסם.";
            e.TeachersMissingHours = new List<int> { teacherId };
            Errors.Add(e);
        }
    }

    private int CountRedSlots()
    {
        int count = 0;
        for (int i = 0; i < _allSlots.Count; i++)
        {
            if (_allSlots[i].AssignedTeacherId <= 0) count++;
        }
        return count;
    }

    // ============================================================
    // PRE-ASSIGN HOMEROOM TEACHERS TO HOUR 1
    // TWO PASSES: First ManageClassId, then TafkidId fallback
    // ============================================================
    private void AssignHomeroomToHour1()
    {
        try { File.WriteAllText(GetHomeroomLogPath(), ""); } catch { }
        LogHomeroom("=== AssignHomeroomToHour1 START ===");
        
        // Process slots with ManageClassId match FIRST, then fallback - ensures homerooms go to their class
        List<HourSlot> hour1Slots = new List<HourSlot>();
        for (int i = 0; i < _allSlots.Count; i++)
        {
            if (_allSlots[i].Hour == 1 && _allSlots[i].Candidates != null && _allSlots[i].Candidates.Count > 0)
                hour1Slots.Add(_allSlots[i]);
        }
        // Sort: slots with ManageClassId match first (so we assign definite homerooms before fallbacks)
        hour1Slots.Sort((a, b) =>
        {
            bool aHasManage = HasManageClassIdMatch(a);
            bool bHasManage = HasManageClassIdMatch(b);
            if (aHasManage && !bHasManage) return -1;
            if (!aHasManage && bHasManage) return 1;
            return 0;
        });
        for (int i = 0; i < hour1Slots.Count; i++)
        {
            HourSlot slot = hour1Slots[i];

            // Find teacher where ManageClassId == ClassId
            ClassTeacher homeroom = null;
            for (int j = 0; j < slot.Candidates.Count; j++)
            {
                ClassTeacher ct = slot.Candidates[j];
                if (ct.ManageClassId == slot.ClassId)
                {
                    homeroom = ct;
                    break;
                }
            }
            
            // STRICT: No fallback to other TafkidId=1 teachers — the homeroom
            // who opens the day MUST be the registered ManageClassId teacher
            // for that class. A different "מורת כיתה" who happens to teach
            // here can still take other slots, but they cannot stand in as
            // the day-opener — that role is reserved for the actual
            // homeroom (pedagogical requirement enforced by precheck).

            if (homeroom != null)
            {
                string cname = _classNames.ContainsKey(slot.ClassId) ? _classNames[slot.ClassId] : ("Class" + slot.ClassId);
                string tname = _teacherNames.ContainsKey(homeroom.TeacherId) ? _teacherNames[homeroom.TeacherId] : ("T" + homeroom.TeacherId);

                // CRITICAL: Don't over-assign the homeroom. If they're already out of
                // remaining hours for THIS class, skip this day. Without this guard,
                // a homeroom with CT.Hour=2 would still get assigned to hour 1 of all
                // 6 days (6 cells), producing 4 over-quota cells in the class.
                string rk = Key(slot.ClassId, homeroom.TeacherId);
                if (_remaining.ContainsKey(rk) && _remaining[rk] <= 0)
                {
                    LogHomeroom(string.Format("SKIP: {0} Day{1} -> {2} (no remaining hours)", cname, slot.Day, tname));
                }
                else
                {
                    LogHomeroom(string.Format("ASSIGN: {0} Day{1} -> {2} (M={3})", cname, slot.Day, tname, homeroom.ManageClassId));
                    slot.AssignedTeacherId = homeroom.TeacherId;
                    slot.AssignedProfessionalId = homeroom.ProfessionalId;
                    slot.AssignedHakbatza = homeroom.Hakbatza;
                    slot.AssignedIhud = homeroom.Ihud;
                    SetBusy(homeroom.TeacherId, slot.Day, slot.Hour, slot);
                    GetDaySet(homeroom.TeacherId, slot.Day).Add(slot.Hour);

                    if (_remaining.ContainsKey(rk) && _remaining[rk] > 0)
                    {
                        _remaining[rk] = _remaining[rk] - 1;
                    }
                }
            }
            else
            {
                string cname = _classNames.ContainsKey(slot.ClassId) ? _classNames[slot.ClassId] : ("Class" + slot.ClassId);
                LogHomeroom(string.Format("SKIP: {0} Day{1} - no homeroom found", cname, slot.Day));
            }
        }
        LogHomeroom("=== AssignHomeroomToHour1 END ===");
    }

    // =========================================================
    // Extend each homeroom's opening into a 2-3 hour block in the home class.
    // Pass 1: add hour 2 to every day the homeroom opens hour 1.
    // Pass 2: add hour 3 to every day where pass 1 succeeded.
    // Distribution across days comes for free because pass 1 completes
    // before pass 2 starts — so a day never gets 3 hours unless every
    // opening day already has 2.
    // Soft constraint: skips a day if remaining is 0, teacher isn't in
    // TeachList for that (class, hour), slot is already taken, etc.
    // =========================================================
    private void ExtendHomeroomOpeningBlock()
    {
        LogHomeroom("=== ExtendHomeroomOpeningBlock START ===");

        foreach (KeyValuePair<int, int> kv in _homeroomByClass)
        {
            int classId = kv.Key;
            int teacherId = kv.Value;

            // Days where the homeroom already opens hour 1 in the home class
            List<int> openingDays = new List<int>();
            for (int i = 0; i < _allSlots.Count; i++)
            {
                HourSlot s = _allSlots[i];
                if (s.ClassId == classId && s.Hour == 1 && s.AssignedTeacherId == teacherId)
                    openingDays.Add(s.Day);
            }
            if (openingDays.Count == 0) continue;
            openingDays.Sort();

            string cname = _classNames.ContainsKey(classId) ? _classNames[classId] : ("Class" + classId);
            string tname = _teacherNames.ContainsKey(teacherId) ? _teacherNames[teacherId] : ("T" + teacherId);

            // Pass 1 (hour 2) then pass 2 (hour 3) — round-robin across days
            for (int targetHour = 2; targetHour <= 3; targetHour++)
            {
                for (int d = 0; d < openingDays.Count; d++)
                {
                    int day = openingDays[d];

                    string rk = Key(classId, teacherId);
                    if (!_remaining.ContainsKey(rk) || _remaining[rk] <= 0)
                    {
                        LogHomeroom(string.Format("STOP: {0} T{1} - no remaining hours (hour {2})", cname, teacherId, targetHour));
                        break;
                    }

                    HourSlot target = null;
                    for (int i = 0; i < _allSlots.Count; i++)
                    {
                        HourSlot s = _allSlots[i];
                        if (s.ClassId == classId && s.Day == day && s.Hour == targetHour)
                        {
                            target = s;
                            break;
                        }
                    }
                    if (target == null) continue;
                    if (target.AssignedTeacherId > 0) continue;
                    if (target.Candidates == null || target.Candidates.Count == 0) continue;

                    ClassTeacher homeroomCt = FindTeacherInCandidates(target.Candidates, teacherId);
                    if (homeroomCt == null) continue;

                    if (!CanAssign(target, homeroomCt)) continue;

                    ApplyAssign(target, homeroomCt);
                    LogHomeroom(string.Format("EXTEND: {0} Day{1} Hour{2} -> {3}", cname, day, targetHour, tname));
                }
            }
        }

        LogHomeroom("=== ExtendHomeroomOpeningBlock END ===");
    }

    private bool HasManageClassIdMatch(HourSlot slot)
    {
        if (slot.Candidates == null) return false;
        for (int j = 0; j < slot.Candidates.Count; j++)
        {
            if (slot.Candidates[j] != null && slot.Candidates[j].ManageClassId == slot.ClassId)
                return true;
        }
        return false;
    }

    // =========================================================
    // PUBLIC: Fix Missing Slots (keep existing, only fill reds)
    // Loads existing assignments, marks them as busy, then only
    // tries to fill unassigned slots via swaps/chains.
    // =========================================================
    public ShibutzRunResult FixMissingSlots_SaveAlways(DataTable existingAssignments)
    {
        Errors.Clear();

        // Step 1: Load existing assignments into the model
        // Mark all existing teachers as busy and reduce remaining hours
        if (existingAssignments != null)
        {
            for (int r = 0; r < existingAssignments.Rows.Count; r++)
            {
                DataRow row = existingAssignments.Rows[r];
                int teacherId = ToInt(row["TeacherId"]);
                int hourId = ToInt(row["HourId"]);
                int classId = ToInt(row["ClassId"]);
                int profId = existingAssignments.Columns.Contains("ProfessionalId") ? ToInt(row["ProfessionalId"]) : 0;
                int hak = existingAssignments.Columns.Contains("Hakbatza") ? ToInt(row["Hakbatza"]) : 0;
                int ihud = 0; // Ihud removed from the model

                if (teacherId <= 0 || hourId <= 0 || classId <= 0) continue;

                int day, hour;
                ResolveDayHour(hourId, out day, out hour);

                // Find the matching slot
                for (int i = 0; i < _allSlots.Count; i++)
                {
                    HourSlot slot = _allSlots[i];
                    if (slot.ClassId == classId && slot.Day == day && slot.Hour == hour)
                    {
                        if (slot.AssignedTeacherId <= 0)
                        {
                            slot.AssignedTeacherId = teacherId;
                            slot.AssignedProfessionalId = profId;
                            slot.AssignedHakbatza = hak;
                            slot.AssignedIhud = ihud;

                            SetBusy(teacherId, day, hour, slot);
                            GetDaySet(teacherId, day).Add(hour);

                            string rk = Key(classId, teacherId);
                            if (_remaining.ContainsKey(rk) && _remaining[rk] > 0)
                            {
                                _remaining[rk] = _remaining[rk] - 1;
                            }
                        }
                        break;
                    }
                }
            }
        }

        // Step 2: Count reds before
        int redsBefore = CountRedSlots();
        if (redsBefore == 0)
        {
            // Nothing to fix
            int savedAll = SaveAssignmentsToDatabase_ReturnCount();
            ShibutzRunResult rOk = new ShibutzRunResult();
            rOk.SavedCount = savedAll;
            rOk.ErrorCount = 0;
            return rOk;
        }

        // Step 3: Try to fill missing slots using ALL strategies
        Dictionary<int, List<HourSlot>> byTime = BuildTimeBuckets();
        List<int> timeKeys = new List<int>(byTime.Keys);
        timeKeys.Sort();

        for (int iteration = 0; iteration < 3; iteration++)
        {
            for (int i = 0; i < timeKeys.Count; i++)
            {
                List<HourSlot> slots = byTime[timeKeys[i]];
                TryCrossTimeSwapsForBatch(slots);
                DirectFill(slots);
                FindAvailableTeachersFill(slots);
                SmartSwapFill(slots);
                LocalSwapFill(slots);
                DeepChainFill(slots, CHAIN_DEPTH);
            }
        }

        // Step 4: Aggressive cross-time swaps
        CrossTimeSwapFill();
        FillTeachersMissingHours();

        // Step 5: Mega cleanup
        for (int megaRound = 0; megaRound < 3; megaRound++)
        {
            int redsNow = CountRedSlots();
            for (int i = 0; i < timeKeys.Count; i++)
            {
                List<HourSlot> slots = byTime[timeKeys[i]];
                TryCrossTimeSwapsForBatch(slots);
                DirectFill(slots);
                FindAvailableTeachersFill(slots);
                SmartSwapFill(slots);
                LocalSwapFill(slots);
                DeepChainFill(slots, CHAIN_DEPTH);
            }
            CrossTimeSwapFill();
            FillTeachersMissingHours();
            int redsAfter = CountRedSlots();
            if (redsAfter >= redsNow) break;
        }

        // Build errors for remaining reds
        Errors.Clear();
        for (int i = 0; i < _allSlots.Count; i++)
        {
            if (_allSlots[i].AssignedTeacherId <= 0)
            {
                string reason = AnalyzeWhyNotAssigned(_allSlots[i]);
                AddError(_allSlots[i], reason);
            }
        }

        // Delete existing auto-assignments and re-save ALL (existing + new)
        Dal.ExeSp("Assign_DeleteAssignAuto", "1", _configurationId);
        int saved = SaveAssignmentsToDatabase_ReturnCount();

        ShibutzRunResult result = new ShibutzRunResult();
        result.SavedCount = saved;
        result.ErrorCount = Errors.Count;
        return result;
    }

    // =========================================================
    // BUILD MODEL
    // =========================================================
    private void BuildModel(DataSet ds)
    {
        _allSlots.Clear();
        _remaining.Clear();
        _homeClassByTeacher.Clear();
        _homeroomByClass.Clear();
        _classNames.Clear();
        _classLayer.Clear();
        _teacherNames.Clear();
        _teacherWorkingHours.Clear();
        _teacherFreeDay.Clear();
        Errors.Clear();

        // Pull LayerId for every class once. Used for keying Hakbatza groups
        // by grade level instead of class. Falls back gracefully if the
        // Class table isn't accessible — Hakbatza will just collapse to a
        // single class until we get a layer mapping (same as old behavior).
        try
        {
            DataTable dtClass = Dal.GetDataTable(
                "SELECT ClassId, ISNULL(LayerId,0) AS LayerId FROM Class WHERE ConfigurationId=" +
                _configurationId);
            for (int ci = 0; ci < dtClass.Rows.Count; ci++)
            {
                int cid = ToInt(dtClass.Rows[ci]["ClassId"]);
                int lid = ToInt(dtClass.Rows[ci]["LayerId"]);
                if (cid > 0) _classLayer[cid] = lid;
            }
        }
        catch
        {
            /* keep going — falls back to per-class behavior */
        }

        // Pull every teacher's FreeDay so we can hard-block assignment on
        // that day. The init-data SP doesn't always filter by FreeDay (we've
        // observed teachers ending up assigned on their off day even though
        // FreeDay is set). Loading it here lets us scrub candidates BEFORE
        // they reach the scheduler, regardless of upstream SP behavior.
        try
        {
            DataTable dtTeachers = Dal.GetDataTable(
                "SELECT TeacherId, ISNULL(FreeDay,0) AS FreeDay FROM Teacher WHERE ConfigurationId=" +
                _configurationId);
            for (int ti = 0; ti < dtTeachers.Rows.Count; ti++)
            {
                int tid = ToInt(dtTeachers.Rows[ti]["TeacherId"]);
                int fd = ToInt(dtTeachers.Rows[ti]["FreeDay"]);
                if (tid > 0 && fd > 0) _teacherFreeDay[tid] = fd;
            }
        }
        catch
        {
            /* if the lookup fails we proceed without FreeDay enforcement —
               the FillEmptySlots SP still has its own filter as a safety net */
        }

        // טעינת solo Hours לכל (T,C) + "extras" של מורים ב-Hak שיש להם
        // CT.Hour גבוה מ-Hak.Hours האטומי (לדוגמה Hak=3 שCT=6 בנופר אבל
        // Hours=5 → 1 שעה extra סולו). ה-extras מתווספים ל-_soloHours כדי
        // שאחרי PreSchedule (שאיפס _remaining ל-soloHours) המורה יוכל
        // לקבל את העודף שלו דרך ה-greedy.
        _soloHours.Clear();
        try
        {
            DataTable dtSolo = Dal.GetDataTable(
                "SELECT TeacherId, ClassId, ISNULL(Hour,0) AS Hour FROM ClassTeacher " +
                "WHERE ConfigurationId=" + _configurationId + " AND HakbatzaId IS NULL AND Hour > 0");
            for (int i = 0; i < dtSolo.Rows.Count; i++)
            {
                int tid = ToInt(dtSolo.Rows[i]["TeacherId"]);
                int cid = ToInt(dtSolo.Rows[i]["ClassId"]);
                int hr = ToInt(dtSolo.Rows[i]["Hour"]);
                if (tid > 0 && cid > 0)
                {
                    string sk = cid + "_" + tid;
                    if (_soloHours.ContainsKey(sk)) _soloHours[sk] += hr;
                    else _soloHours[sk] = hr;
                }
            }
            // Extras: CT.Hour - Hak.Hours לכל מורה ב-Hak (אם CT.Hour > Hak.Hours)
            DataTable dtExtras = Dal.GetDataTable(
                "SELECT ct.TeacherId, ct.ClassId, (ct.Hour - h.Hours) AS Extra " +
                "FROM ClassTeacher ct INNER JOIN Hakbatza h ON h.HakbatzaId=ct.HakbatzaId " +
                "WHERE ct.ConfigurationId=" + _configurationId + " AND ct.Hour > h.Hours");
            for (int i = 0; i < dtExtras.Rows.Count; i++)
            {
                int tid = ToInt(dtExtras.Rows[i]["TeacherId"]);
                int cid = ToInt(dtExtras.Rows[i]["ClassId"]);
                int ext = ToInt(dtExtras.Rows[i]["Extra"]);
                if (tid > 0 && cid > 0 && ext > 0)
                {
                    string sk = cid + "_" + tid;
                    if (_soloHours.ContainsKey(sk)) _soloHours[sk] += ext;
                    else _soloHours[sk] = ext;
                }
            }
        }
        catch { /* fallback: empty */ }

        // טעינת Hakbatza meta מהטבלאות החדשות. כל הקבצה היא יחידה אטומית עם
        // Hours, Mode, רשימות כיתות ומורים. ה-greedy ישתמש ב-meta הזה כדי
        // לתזמן את ההקבצות נכונות (אטומיות) במקום לנחש מ-MAX-per-Hak.
        _hakbatzaMeta.Clear();
        try
        {
            DataTable dtHak = Dal.GetDataTable(
                "SELECT HakbatzaId, LayerId, Number, Hours, Mode FROM Hakbatza WHERE ConfigurationId=" +
                _configurationId);
            Dictionary<int, HakbatzaMeta> byId = new Dictionary<int, HakbatzaMeta>();
            for (int hi = 0; hi < dtHak.Rows.Count; hi++)
            {
                DataRow r = dtHak.Rows[hi];
                HakbatzaMeta m = new HakbatzaMeta();
                m.HakbatzaId = ToInt(r["HakbatzaId"]);
                m.LayerId = ToInt(r["LayerId"]);
                m.Number = ToInt(r["Number"]);
                m.Hours = ToInt(r["Hours"]);
                m.Mode = r["Mode"] == null ? "simple" : r["Mode"].ToString();
                byId[m.HakbatzaId] = m;
                string gkey = "H_" + m.LayerId + "_" + m.Number;
                _hakbatzaMeta[gkey] = m;
            }
            DataTable dtHakC = Dal.GetDataTable(
                "SELECT hc.HakbatzaId, hc.ClassId FROM HakbatzaClass hc " +
                "INNER JOIN Hakbatza h ON h.HakbatzaId=hc.HakbatzaId WHERE h.ConfigurationId=" +
                _configurationId);
            for (int i = 0; i < dtHakC.Rows.Count; i++)
            {
                int hid = ToInt(dtHakC.Rows[i]["HakbatzaId"]);
                int cid = ToInt(dtHakC.Rows[i]["ClassId"]);
                HakbatzaMeta m;
                if (byId.TryGetValue(hid, out m)) m.Classes.Add(cid);
            }
            DataTable dtHakT = Dal.GetDataTable(
                "SELECT ht.HakbatzaId, ht.TeacherId, ht.HoursContribution FROM HakbatzaTeacher ht " +
                "INNER JOIN Hakbatza h ON h.HakbatzaId=ht.HakbatzaId WHERE h.ConfigurationId=" +
                _configurationId);
            for (int i = 0; i < dtHakT.Rows.Count; i++)
            {
                int hid = ToInt(dtHakT.Rows[i]["HakbatzaId"]);
                int tid = ToInt(dtHakT.Rows[i]["TeacherId"]);
                int hrs = ToInt(dtHakT.Rows[i]["HoursContribution"]);
                HakbatzaMeta m;
                if (byId.TryGetValue(hid, out m))
                {
                    m.Teachers.Add(tid);
                    m.TeacherHours[tid] = hrs;
                }
            }
        }
        catch
        {
            /* fallback: no meta — ה-PreSchedule יחזור להתנהגות הישנה */
        }

        if (ds == null || ds.Tables.Count == 0 || ds.Tables[0] == null)
            return;

        // Load teacher working hours from DataSet (if available)
        // Typically in table index 2 (dtTeacherHours) based on AssignAuto.cs pattern
        // NOTE: If HourId column doesn't exist in table 2, skip this section
        // The TeachList in table 0 already contains available teachers for each hour
        if (ds.Tables.Count > 2 && ds.Tables[2] != null)
        {
            DataTable dtTeacherHours = ds.Tables[2];

            // Check if HourId column exists in this table
            if (dtTeacherHours.Columns.Contains("HourId") && dtTeacherHours.Columns.Contains("TeacherId"))
            {
                for (int i = 0; i < dtTeacherHours.Rows.Count; i++)
                {
                    DataRow row = dtTeacherHours.Rows[i];
                    int teacherId = ToInt(row["TeacherId"]);
                    int hourId = ToInt(row["HourId"]);

                    if (teacherId > 0 && hourId > 0)
                    {
                        // Skip hours that fall on the teacher's FreeDay —
                        // HourId leading digit is the day (1=Sun..6=Fri).
                        int freeDay;
                        if (_teacherFreeDay.TryGetValue(teacherId, out freeDay)
                            && freeDay > 0
                            && (hourId / 10) == freeDay)
                        {
                            continue;
                        }
                        if (!_teacherWorkingHours.ContainsKey(teacherId))
                        {
                            _teacherWorkingHours[teacherId] = new HashSet<int>();
                        }
                        _teacherWorkingHours[teacherId].Add(hourId);
                    }
                }
            }
            // If HourId doesn't exist, we rely on TeachList from table 0 which already contains available teachers
        }

        DataTable t = ds.Tables[0];

        // First pass: collect class names and find homeroom for each class
        for (int r = 0; r < t.Rows.Count; r++)
        {
            DataRow row = t.Rows[r];
            int classId = ToInt(row["ClassId"]);

            // Store class name if available
            if (t.Columns.Contains("Name") && row["Name"] != null)
            {
                string className = row["Name"].ToString();
                if (!_classNames.ContainsKey(classId))
                {
                    _classNames[classId] = className;
                }
            }
        }

        // Track which (Class, Teacher, Hakbatza, Ihud) combos we've already counted
        // toward _remaining. The TeachList of every HourSlot of a class repeats the
        // same candidates, so without de-dup we'd over-count. With de-dup keyed by
        // the row signature, a (T,C) pair that has both a solo row (Hakbatza=NULL)
        // and a Hakbatza row gets BOTH added — restoring the SUM behavior the
        // legacy MIN missed (which capped the teacher at the smaller value and
        // pushed over-fill onto whoever covered the difference).
        HashSet<string> seenRowSignatures = new HashSet<string>();

        // Second pass: build slots and find homeroom teachers
        for (int r = 0; r < t.Rows.Count; r++)
        {
            DataRow row = t.Rows[r];

            int classId = ToInt(row["ClassId"]);
            int hourId = ToInt(row["HourId"]);

            int day, hour;
            ResolveDayHour(hourId, out day, out hour);

            HourSlot slot = new HourSlot();
            slot.ClassId = classId;
            slot.HourId = hourId;
            slot.Day = day;
            slot.Hour = hour;
            slot.Candidates = new List<ClassTeacher>();

            string teachList = (row["TeachList"] == null) ? "" : row["TeachList"].ToString();
            if (!string.IsNullOrEmpty(teachList))
            {
                string[] parts = teachList.Split(',');
                for (int i = 0; i < parts.Length; i++)
                {
                    string item = parts[i].Trim();
                    if (string.IsNullOrEmpty(item)) continue;

                    // *** ClassTeacher as yours, do not modify ***
                    ClassTeacher ct = new ClassTeacher(item, classId);
                    if (ct == null) continue;
                    if (ct.TeacherId <= 0) continue;

                    // Drop any candidate whose FreeDay falls on this slot's
                    // day. The init-data SP doesn't always filter this — and
                    // letting such candidates through resulted in real
                    // FreeDay violations (e.g. teacher 30 / FreeDay=2 was
                    // assigned to HourId=24). Cheaper to filter here than
                    // to chase the SP.
                    int teacherFreeDay;
                    if (_teacherFreeDay.TryGetValue(ct.TeacherId, out teacherFreeDay)
                        && teacherFreeDay > 0
                        && teacherFreeDay == day)
                    {
                        continue;
                    }

                    // SKIP candidates with ClassTeacher.Hour=0 — even if marked Hakbatza/Ihud.
                    // Hour=0 means "this teacher is not contracted to teach this class".
                    // Including them produces over-fill (the Hakbatza expansion code propagates
                    // them to partner classes, manufacturing assignments out of nothing).
                    // A real Hakbatza member must have Hour > 0 in their own row.
                    if (ct.LastTeacherHoursInClass <= 0)
                    {
                        continue;
                    }

                    slot.Candidates.Add(ct);

                    string rk = Key(classId, ct.TeacherId);
                    int remainingHours = ct.LastTeacherHoursInClass;
                    if (remainingHours <= 0) remainingHours = 1;

                    // Per-row signature: same TeachList row appears in every HourSlot
                    // of the class, so we de-dup by (Class,Teacher,Hak,Ihud,Hour).
                    // First time we see this signature, ADD its hours to remaining.
                    // Same signature later: skip. Different signature for same (T,C)
                    // — i.e. a solo row plus a Hakbatza row — adds again, giving SUM.
                    string rowSig = classId + "_" + ct.TeacherId + "_" + ct.Hakbatza + "_" + ct.Ihud + "_" + remainingHours;
                    if (seenRowSignatures.Add(rowSig))
                    {
                        if (_remaining.ContainsKey(rk))
                            _remaining[rk] += remainingHours;
                        else
                            _remaining[rk] = remainingHours;
                    }

                    // Store class -> homeroom teacher mapping
                    // ONLY use ManageClassId == ClassId
                    if (ct.ManageClassId == classId)
                    {
                        _homeroomByClass[classId] = ct.TeacherId;
                        _homeClassByTeacher[ct.TeacherId] = classId;
                    }
                }
            }

            _allSlots.Add(slot);
        }

        // No fallback: classes without a ManageClassId homeroom are blocked
        // upstream by Assign_ShibutzAuto's pre-check. If we got here with a
        // class missing a homeroom, leave the mapping empty rather than
        // promoting a random TafkidId=1 teacher — that's what produced the
        // "homeroom-of-another-class teaches first lesson here" bug.

        BuildHakbatzaIhudGroups();
    }

    // =========================================================
    // HAKBATZA / IHUD GROUPS
    // Collect all teachers that must co-teach at the same (ClassId, HourId)
    // Hakbatza: same class, same hakbatza number -> teach together
    // Ihud: different classes, same ihud number -> teach at same time across classes
    // =========================================================
    private void BuildHakbatzaIhudGroups()
    {
        _hakbatzaGroups.Clear();

        HashSet<string> seenTeacherPerGroup = new HashSet<string>();

        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot s = _allSlots[i];
            if (s.Candidates == null) continue;

            for (int j = 0; j < s.Candidates.Count; j++)
            {
                ClassTeacher ct = s.Candidates[j];
                if (ct == null || ct.TeacherId <= 0) continue;
                if (ct.Hakbatza <= 0) continue; // Ihud removed — only Hakbatza forms groups

                string gkey = GetGroupKey(ct);
                if (gkey == null) continue;
                string dedupeKey = gkey + "|" + ct.ClassId + "|" + ct.TeacherId;
                if (seenTeacherPerGroup.Contains(dedupeKey)) continue;
                seenTeacherPerGroup.Add(dedupeKey);

                List<ClassTeacher> list;
                if (!_hakbatzaGroups.TryGetValue(gkey, out list))
                {
                    list = new List<ClassTeacher>();
                    _hakbatzaGroups[gkey] = list;
                }
                list.Add(ct);
            }
        }
    }

    private int LayerOf(int classId)
    {
        int lid;
        if (_classLayer.TryGetValue(classId, out lid)) return lid;
        return 0;
    }

    // Ihud (cross-layer grouping) was removed by user request. The data
    // model now treats every cross-class teaching link as a Hakbatza —
    // teachers grouped within the same layer (grade level). The Ihud
    // column is kept as 0 in DB rows for backward compatibility.
    private string GetGroupKey(ClassTeacher ct)
    {
        if (ct.Hakbatza <= 0) return null;
        return "H_" + LayerOf(ct.ClassId) + "_" + ct.Hakbatza;
    }

    private string GetGroupKey(int classId, int hak, int ihud)
    {
        // ihud parameter kept for callers but ignored — see note above.
        if (ihud > 0) { /* legacy data — ignore */ }
        if (hak > 0) return "H_" + LayerOf(classId) + "_" + hak;
        return null;
    }

    private void ResolveDayHour(int hourId, out int day, out int hour)
    {
        // hourId format: 35 = day 3, hour 5
        day = hourId / 10;
        hour = hourId % 10;

        if (day <= 0 || hour <= 0)
        {
            string s = hourId.ToString();
            if (s.Length >= 2)
            {
                day = SafeInt(s.Substring(0, 1));
                hour = SafeInt(s.Substring(1, 1));
            }
        }
    }

    private Dictionary<int, List<HourSlot>> BuildTimeBuckets()
    {
        // key = Hour*100 + Day  ==> hour 1 before hour 2, and days inside
        Dictionary<int, List<HourSlot>> map = new Dictionary<int, List<HourSlot>>();

        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot s = _allSlots[i];
            int key = s.Hour * 100 + s.Day;

            List<HourSlot> list;
            if (!map.TryGetValue(key, out list))
            {
                list = new List<HourSlot>();
                map[key] = list;
            }
            list.Add(s);
        }

        // sort each time: harder first (less candidates)
        foreach (int k in map.Keys)
        {
            List<HourSlot> slots = map[k];
            slots.Sort(CompareHardFirst);
        }

        return map;
    }

    private int CompareHardFirst(HourSlot a, HourSlot b)
    {
        int ac = (a.Candidates == null) ? 0 : a.Candidates.Count;
        int bc = (b.Candidates == null) ? 0 : b.Candidates.Count;
        if (ac != bc) return ac.CompareTo(bc);
        return a.ClassId.CompareTo(b.ClassId);
    }

    // =========================================================
    // CROSS-TIME SWAP - SUPER AGGRESSIVE SEARCH ALGORITHM
    // User requested: "go as aggressive as possible, I don't mind waiting 3+ minutes"
    // =========================================================
    private const int MAX_RECURSION_DEPTH = 12;
    private int _recursionVisits = 0;
    private const int MAX_RECURSION_VISITS = 50000;    // ~1 min total

    private void CrossTimeSwapFill()
    {
        // Get list of red slots
        List<HourSlot> redSlots = new List<HourSlot>();
        for (int i = 0; i < _allSlots.Count; i++)
        {
            if (_allSlots[i].AssignedTeacherId <= 0)
            {
                redSlots.Add(_allSlots[i]);
            }
        }

        if (redSlots.Count == 0) return;

        // Hard cap: 5 seconds for the whole function (was unlimited)
        long budgetMs = (_sw != null ? _sw.ElapsedMilliseconds : 0) + 5000;

        for (int pass = 0; pass < 20; pass++)
        {
            if (_sw != null && _sw.ElapsedMilliseconds > budgetMs) return;
            bool anyProgress = false;

            // Try to fill each red slot
            for (int i = 0; i < redSlots.Count; i++)
            {
                // Check budget in inner loop too - each slot can be expensive
                if (_sw != null && _sw.ElapsedMilliseconds > budgetMs) return;
                HourSlot redSlot = redSlots[i];
                if (redSlot == null) continue;
                if (redSlot.AssignedTeacherId > 0) continue;
                if (redSlot.Candidates == null || redSlot.Candidates.Count == 0) continue;

                // STRATEGY 2 FIRST: Swap before direct fill - e.g. Yochi Sun5->Wed6, Ariel->Sun5
                // (Direct fill with Yochi would fill Wed6 but leave Ariel without his hour)
                if (TrySwapWithFreeSlot(redSlot))
                {
                    anyProgress = true;
                    continue;
                }

                // STRATEGY 1: Direct fill with free teacher
                if (TryDirectFill(redSlot))
                {
                    anyProgress = true;
                    continue;
                }

                // STRATEGY 3: Free a busy teacher by finding replacement in their current class
                if (TryFreeTeacherFromOtherClass(redSlot))
                {
                    anyProgress = true;
                    continue;
                }

                // STRATEGY 4: Deep recursive search with fresh visited set
                _recursionVisits = 0;
                HashSet<string> visited = new HashSet<string>();
                if (TryFillSlotRecursive(redSlot, 0, visited))
                {
                    anyProgress = true;
                    continue;
                }

                // STRATEGY 5: AGGRESSIVE - Try ALL possible chains across ALL classes
                if (TryAggressiveGlobalSearch(redSlot))
                {
                    anyProgress = true;
                }
            }

            if (!anyProgress) break;
        }
    }

    // Run cross-time swap strategies on red slots in this batch BEFORE DirectFill.
    // Ensures e.g. (Yochi Sun5->Wed6, Ariel->Sun5) is tried before filling Wed6 with Yochi directly.
    private void TryCrossTimeSwapsForBatch(List<HourSlot> slots)
    {
        if (slots == null) return;
        for (int i = 0; i < slots.Count; i++)
        {
            HourSlot redSlot = slots[i];
            if (redSlot == null || redSlot.AssignedTeacherId > 0) continue;
            if (redSlot.Candidates == null || redSlot.Candidates.Count == 0) continue;

            if (TrySwapWithFreeSlot(redSlot)) continue;
            if (TryFreeTeacherFromOtherClass(redSlot)) continue;
            _recursionVisits = 0;
            HashSet<string> visited = new HashSet<string>();
            if (TryFillSlotRecursive(redSlot, 0, visited)) continue;
            TryAggressiveGlobalSearch(redSlot);
        }
    }

    // TEACHER-CENTRIC: For teachers with remaining hours, try swap to give them a slot
    // Scenario: Ariel needs 1 hour in Yochi class. (Yochi class, Sun 2) has Yochi. (Yochi class, Wed 6) is RED.
    // Swap: Yochi Sun2->Wed6, Ariel->Sun2
    private void FillTeachersMissingHours()
    {
        // Hard cap: 5 seconds for the whole function
        long budgetMs = (_sw != null ? _sw.ElapsedMilliseconds : 0) + 5000;

        for (int pass = 0; pass < 15; pass++)
        {
            if (_sw != null && _sw.ElapsedMilliseconds > budgetMs) return;
            bool anyProgress = false;
            foreach (var kv in _remaining)
            {
                if (kv.Value <= 0) continue;
                string[] parts = kv.Key.Split('_');
                if (parts.Length < 2) continue;
                int classId, teacherId;
                if (!int.TryParse(parts[0], out classId) || !int.TryParse(parts[1], out teacherId)) continue;

                ClassTeacher ctForTeacher = null;
                for (int i = 0; i < _allSlots.Count; i++)
                {
                    HourSlot filledSlot = _allSlots[i];
                    if (filledSlot.ClassId != classId || filledSlot.AssignedTeacherId <= 0) continue;
                    if (filledSlot.Candidates == null) continue;

                    ctForTeacher = FindTeacherInCandidates(filledSlot.Candidates, teacherId);
                    if (ctForTeacher == null) continue;
                    if (IsBusy(teacherId, filledSlot.Day, filledSlot.Hour)) continue;
                    if (!CanAssign(filledSlot, ctForTeacher)) continue;

                    int currentTeacherId = filledSlot.AssignedTeacherId;
                    ClassTeacher currentCt = FindTeacherInCandidates(filledSlot.Candidates, currentTeacherId);
                    if (currentCt == null) continue;

                    // Find a RED slot (same or other class) where currentTeacher can go
                    for (int j = 0; j < _allSlots.Count; j++)
                    {
                        HourSlot redSlot = _allSlots[j];
                        if (redSlot.AssignedTeacherId > 0) continue;
                        if (redSlot.Day == filledSlot.Day && redSlot.Hour == filledSlot.Hour) continue;
                        if (redSlot.Candidates == null) continue;

                        ClassTeacher currentInRed = FindTeacherInCandidates(redSlot.Candidates, currentTeacherId);
                        if (currentInRed == null) continue;
                        if (IsBusy(currentTeacherId, redSlot.Day, redSlot.Hour)) continue;
                        if (!CanAssign(redSlot, currentInRed)) continue;

                        int oldTeacher = filledSlot.AssignedTeacherId;
                        int oldProf = filledSlot.AssignedProfessionalId;
                        int oldHak = filledSlot.AssignedHakbatza;
                        int oldIhu = filledSlot.AssignedIhud;
                        UndoAssign(filledSlot);
                        if (CanAssign(redSlot, currentInRed) && CanAssign(filledSlot, ctForTeacher))
                        {
                            ApplyAssign(filledSlot, ctForTeacher);
                            ApplyAssign(redSlot, currentInRed);
                            anyProgress = true;
                            break;
                        }
                        RestoreAssign(filledSlot, oldTeacher, oldProf, oldHak, oldIhu);
                    }
                    if (anyProgress) break;
                }
                if (anyProgress) break;
            }
            if (!anyProgress) break;
        }
    }

    // FINAL AGGRESSIVE PASS - One more round trying everything
    // STRATEGY 5: Aggressive search - wrapped in try-catch for safety
    private bool TryAggressiveGlobalSearch(HourSlot redSlot)
    {
        try
        {
            if (redSlot == null || redSlot.Candidates == null) return false;

            // For each candidate who should teach in this class
            for (int j = 0; j < redSlot.Candidates.Count; j++)
            {
                ClassTeacher candidate = redSlot.Candidates[j];
                if (candidate == null || candidate.TeacherId <= 0) continue;

                // If candidate is free, try direct
                if (!IsBusy(candidate.TeacherId, redSlot.Day, redSlot.Hour))
                {
                    if (CanAssign(redSlot, candidate))
                    {
                        ApplyAssign(redSlot, candidate);
                        return true;
                    }
                    continue;
                }

                // STRATEGY 5A: Cross-class swap
                // Look at ALL slots where this candidate works (in ANY class)
                // Find a slot where they're FREE and try to swap
                if (TryCrossClassSwapForCandidate(redSlot, candidate))
                {
                    return true;
                }

                // STRATEGY 5B: Try to free candidate with chain
                if (TryFreeTeacherChain(candidate.TeacherId, redSlot.Day, redSlot.Hour, 0, new HashSet<string>()))
                {
                    if (CanAssign(redSlot, candidate))
                    {
                        ApplyAssign(redSlot, candidate);
                        return true;
                    }
                }
            }
        }
        catch
        {
            // Ignore errors in aggressive search
        }
        return false;
    }

    // Cross-class swap: For a candidate who is busy at red slot time,
    // find ANY slot (in ANY class) where they're FREE, and try to swap
    private bool TryCrossClassSwapForCandidate(HourSlot redSlot, ClassTeacher candidate)
    {
        if (candidate == null || candidate.TeacherId <= 0) return false;

        // Candidate is busy at red slot time - find where they're FREE
        // Look at ALL slots across ALL classes
        for (int k = 0; k < _allSlots.Count; k++)
        {
            HourSlot otherSlot = _allSlots[k];
            if (otherSlot == null) continue;
            if (otherSlot.Day == redSlot.Day && otherSlot.Hour == redSlot.Hour) continue;
            if (otherSlot.AssignedTeacherId <= 0) continue;
            if (otherSlot.Candidates == null) continue;

            // Check if candidate is in otherSlot's candidates (can teach there)
            ClassTeacher candidateInOther = FindTeacherInCandidates(otherSlot.Candidates, candidate.TeacherId);
            if (candidateInOther == null) continue;

            // Check if candidate is FREE at otherSlot's time
            if (IsBusy(candidate.TeacherId, otherSlot.Day, otherSlot.Hour)) continue;

            // Candidate CAN teach at otherSlot and is FREE there
            // Get the teacher currently at otherSlot
            int currentTeacherId = otherSlot.AssignedTeacherId;

            // Check if currentTeacher is in redSlot's candidates (can teach there)
            ClassTeacher currentInRed = FindTeacherInCandidates(redSlot.Candidates, currentTeacherId);
            if (currentInRed == null) continue;

            // Save otherSlot's assignment
            int oldTeacher = otherSlot.AssignedTeacherId;
            int oldProf = otherSlot.AssignedProfessionalId;
            int oldHak = otherSlot.AssignedHakbatza;
            int oldIhu = otherSlot.AssignedIhud;

            // Try the swap: move currentTeacher to redSlot, candidate to otherSlot
            UndoAssign(otherSlot);

            // Check if currentTeacher is free at red slot time (they might be busy elsewhere)
            if (!IsBusy(currentTeacherId, redSlot.Day, redSlot.Hour))
            {
                if (CanAssign(redSlot, currentInRed) && CanAssign(otherSlot, candidateInOther))
                {
                    ApplyAssign(otherSlot, candidateInOther);
                    ApplyAssign(redSlot, currentInRed);
                    return true;
                }
            }
            else
            {
                // currentTeacher is busy elsewhere at red time - try to free them
                if (TryFreeTeacherChain(currentTeacherId, redSlot.Day, redSlot.Hour, 0, new HashSet<string>()))
                {
                    if (CanAssign(redSlot, currentInRed) && CanAssign(otherSlot, candidateInOther))
                    {
                        ApplyAssign(otherSlot, candidateInOther);
                        ApplyAssign(redSlot, currentInRed);
                        return true;
                    }
                }
            }

            // Rollback
            RestoreAssign(otherSlot, oldTeacher, oldProf, oldHak, oldIhu);
        }

        // Also try: swap within the red slot's class
        // Find another teacher in redSlot's class who can move, and put candidate in their place
        for (int k = 0; k < _allSlots.Count; k++)
        {
            HourSlot classSlot = _allSlots[k];
            if (classSlot == null) continue;
            if (classSlot.ClassId != redSlot.ClassId) continue;  // Same class only
            if (classSlot.Day == redSlot.Day && classSlot.Hour == redSlot.Hour) continue;
            if (classSlot.AssignedTeacherId <= 0) continue;
            if (classSlot.Candidates == null) continue;

            int assignedInClassSlot = classSlot.AssignedTeacherId;

            // Check if candidate can teach at classSlot's time
            ClassTeacher candidateInClassSlot = FindTeacherInCandidates(classSlot.Candidates, candidate.TeacherId);
            if (candidateInClassSlot == null) continue;

            // Check if candidate is FREE at classSlot's time
            if (IsBusy(candidate.TeacherId, classSlot.Day, classSlot.Hour)) continue;

            // Check if assignedInClassSlot can teach at red time
            ClassTeacher assignedInRed = FindTeacherInCandidates(redSlot.Candidates, assignedInClassSlot);
            if (assignedInRed == null) continue;

            // Save state
            int oldTeacher = classSlot.AssignedTeacherId;
            int oldProf = classSlot.AssignedProfessionalId;
            int oldHak = classSlot.AssignedHakbatza;
            int oldIhu = classSlot.AssignedIhud;

            UndoAssign(classSlot);

            // Check if assignedInClassSlot is free at red time
            if (!IsBusy(assignedInClassSlot, redSlot.Day, redSlot.Hour))
            {
                if (CanAssign(redSlot, assignedInRed) && CanAssign(classSlot, candidateInClassSlot))
                {
                    ApplyAssign(classSlot, candidateInClassSlot);
                    ApplyAssign(redSlot, assignedInRed);
                    return true;
                }
            }

            RestoreAssign(classSlot, oldTeacher, oldProf, oldHak, oldIhu);
        }

        return false;
    }

    // Try to free a teacher with a chain of swaps (depth limited)
    private bool TryFreeTeacherChain(int teacherId, int day, int hour, int depth, HashSet<string> visited)
    {
        if (depth > 6) return false;   // Max chain depth for TryFreeTeacherChain
        if (!IsBusy(teacherId, day, hour)) return true;  // Already free

        string key = teacherId + "_" + day + "_" + hour;
        if (visited.Contains(key)) return false;
        visited.Add(key);

        HourSlot blockingSlot = GetBusySlot(teacherId, day, hour);
        if (blockingSlot == null || blockingSlot.Candidates == null)
        {
            visited.Remove(key);
            return false;
        }

        int oldTeacher = blockingSlot.AssignedTeacherId;
        int oldProf = blockingSlot.AssignedProfessionalId;
        int oldHak = blockingSlot.AssignedHakbatza;
        int oldIhu = blockingSlot.AssignedIhud;

        // Try each candidate for blocking slot
        for (int k = 0; k < blockingSlot.Candidates.Count; k++)
        {
            ClassTeacher replacement = blockingSlot.Candidates[k];
            if (replacement == null || replacement.TeacherId <= 0) continue;
            if (replacement.TeacherId == teacherId) continue;

            bool replacementFree = !IsBusy(replacement.TeacherId, blockingSlot.Day, blockingSlot.Hour);

            if (!replacementFree)
            {
                // Try to free replacement recursively
                replacementFree = TryFreeTeacherChain(replacement.TeacherId, blockingSlot.Day, blockingSlot.Hour, depth + 1, visited);
            }

            if (replacementFree)
            {
                UndoAssign(blockingSlot);

                if (CanAssign(blockingSlot, replacement))
                {
                    ApplyAssign(blockingSlot, replacement);
                    visited.Remove(key);
                    return true;  // teacherId is now free
                }

                RestoreAssign(blockingSlot, oldTeacher, oldProf, oldHak, oldIhu);
            }
        }

        visited.Remove(key);
        return false;
    }

    // STRATEGY 1: Direct fill with any free teacher
    private bool TryDirectFill(HourSlot redSlot)
    {
        if (redSlot == null || redSlot.Candidates == null) return false;

        for (int j = 0; j < redSlot.Candidates.Count; j++)
        {
            ClassTeacher ct = redSlot.Candidates[j];
            if (ct == null || ct.TeacherId <= 0) continue;

            if (!IsBusy(ct.TeacherId, redSlot.Day, redSlot.Hour))
            {
                if (CanAssign(redSlot, ct))
                {
                    ApplyAssign(redSlot, ct);
                    return true;
                }
            }
        }
        return false;
    }

    // STRATEGY 2: For each candidate teacher who is busy at red slot time,
    // find a DIFFERENT slot in the same class where they're FREE
    // and swap with the teacher currently there
    private bool TrySwapWithFreeSlot(HourSlot redSlot)
    {
        if (redSlot == null || redSlot.Candidates == null) return false;

        // APPROACH A: For each candidate who is BUSY at red time, find where they're FREE
        for (int j = 0; j < redSlot.Candidates.Count; j++)
        {
            ClassTeacher candidate = redSlot.Candidates[j];
            if (candidate == null || candidate.TeacherId <= 0) continue;

            // Skip if candidate is free at red slot time - TryDirectFill handles that
            if (!IsBusy(candidate.TeacherId, redSlot.Day, redSlot.Hour)) continue;

            // Candidate is BUSY at red slot time
            // Find a slot (same or other class) where candidate is FREE
            for (int k = 0; k < _allSlots.Count; k++)
            {
                HourSlot otherSlot = _allSlots[k];
                if (otherSlot == null) continue;
                if (otherSlot.Day == redSlot.Day && otherSlot.Hour == redSlot.Hour) continue;
                if (otherSlot.AssignedTeacherId <= 0) continue;
                if (otherSlot.Candidates == null) continue;

                // Check if candidate is FREE at otherSlot's time
                if (IsBusy(candidate.TeacherId, otherSlot.Day, otherSlot.Hour)) continue;

                // Check if candidate is in otherSlot's candidates
                ClassTeacher candidateInOther = FindTeacherInCandidates(otherSlot.Candidates, candidate.TeacherId);
                if (candidateInOther == null) continue;

                // Get the teacher currently at otherSlot
                int currentTeacherId = otherSlot.AssignedTeacherId;

                // Check if currentTeacher is in redSlot's candidates
                ClassTeacher currentInRed = FindTeacherInCandidates(redSlot.Candidates, currentTeacherId);
                if (currentInRed == null) continue;

                // Save otherSlot's assignment
                int oldTeacher = otherSlot.AssignedTeacherId;
                int oldProf = otherSlot.AssignedProfessionalId;
                int oldHak = otherSlot.AssignedHakbatza;
                int oldIhu = otherSlot.AssignedIhud;

                // Remove currentTeacher from otherSlot
                UndoAssign(otherSlot);

                // Check if currentTeacher is busy at red slot time (teaching ANOTHER class)
                if (IsBusy(currentTeacherId, redSlot.Day, redSlot.Hour))
                {
                    // Try to free currentTeacher from their other class
                    HourSlot blockingSlot = GetBusySlot(currentTeacherId, redSlot.Day, redSlot.Hour);
                    if (blockingSlot != null && blockingSlot.Candidates != null)
                    {
                        // Save blocking slot
                        int blockOld = blockingSlot.AssignedTeacherId;
                        int blockProf = blockingSlot.AssignedProfessionalId;
                        int blockHak = blockingSlot.AssignedHakbatza;
                        int blockIhu = blockingSlot.AssignedIhud;

                        // Try each replacement for blockingSlot
                        for (int m = 0; m < blockingSlot.Candidates.Count; m++)
                        {
                            ClassTeacher replacement = blockingSlot.Candidates[m];
                            if (replacement == null) continue;
                            if (replacement.TeacherId == currentTeacherId) continue;
                            if (IsBusy(replacement.TeacherId, blockingSlot.Day, blockingSlot.Hour)) continue;

                            UndoAssign(blockingSlot);

                            if (CanAssign(blockingSlot, replacement))
                            {
                                ApplyAssign(blockingSlot, replacement);

                                // Now currentTeacher should be free
                                if (CanAssign(redSlot, currentInRed) && CanAssign(otherSlot, candidateInOther))
                                {
                                    ApplyAssign(otherSlot, candidateInOther);
                                    ApplyAssign(redSlot, currentInRed);
                                    return true;
                                }

                                UndoAssign(blockingSlot);
                            }

                            RestoreAssign(blockingSlot, blockOld, blockProf, blockHak, blockIhu);
                        }
                    }

                    // Couldn't free currentTeacher, rollback otherSlot
                    RestoreAssign(otherSlot, oldTeacher, oldProf, oldHak, oldIhu);
                    continue;
                }

                // currentTeacher is free at red slot time - try the swap
                if (CanAssign(redSlot, currentInRed) && CanAssign(otherSlot, candidateInOther))
                {
                    ApplyAssign(otherSlot, candidateInOther);
                    ApplyAssign(redSlot, currentInRed);
                    return true;
                }

                // Rollback
                RestoreAssign(otherSlot, oldTeacher, oldProf, oldHak, oldIhu);
            }
        }

        // APPROACH B: Look at ALL assigned slots in the class
        // For each assigned teacher, check if they can go to red slot
        // And find any candidate who can take their place
        for (int k = 0; k < _allSlots.Count; k++)
        {
            HourSlot otherSlot = _allSlots[k];
            if (otherSlot == null) continue;
            if (otherSlot.ClassId != redSlot.ClassId) continue;
            if (otherSlot.Day == redSlot.Day && otherSlot.Hour == redSlot.Hour) continue;
            if (otherSlot.AssignedTeacherId <= 0) continue;
            if (otherSlot.Candidates == null) continue;

            int currentTeacherId = otherSlot.AssignedTeacherId;

            // Check if currentTeacher can teach at red slot time
            ClassTeacher currentInRed = FindTeacherInCandidates(redSlot.Candidates, currentTeacherId);
            if (currentInRed == null) continue;

            // Check if currentTeacher is free at red slot time
            if (IsBusy(currentTeacherId, redSlot.Day, redSlot.Hour)) continue;

            // Find ANY candidate for red slot who can take otherSlot
            for (int j = 0; j < redSlot.Candidates.Count; j++)
            {
                ClassTeacher candidate = redSlot.Candidates[j];
                if (candidate == null || candidate.TeacherId <= 0) continue;
                if (candidate.TeacherId == currentTeacherId) continue;

                // Check if candidate is in otherSlot's candidates
                ClassTeacher candidateInOther = FindTeacherInCandidates(otherSlot.Candidates, candidate.TeacherId);
                if (candidateInOther == null) continue;

                // Check if candidate is free at otherSlot's time
                if (IsBusy(candidate.TeacherId, otherSlot.Day, otherSlot.Hour)) continue;

                // Save and try swap
                int oldTeacher = otherSlot.AssignedTeacherId;
                int oldProf = otherSlot.AssignedProfessionalId;
                int oldHak = otherSlot.AssignedHakbatza;
                int oldIhu = otherSlot.AssignedIhud;

                UndoAssign(otherSlot);

                if (CanAssign(redSlot, currentInRed) && CanAssign(otherSlot, candidateInOther))
                {
                    ApplyAssign(otherSlot, candidateInOther);
                    ApplyAssign(redSlot, currentInRed);
                    return true;
                }

                RestoreAssign(otherSlot, oldTeacher, oldProf, oldHak, oldIhu);
            }
        }

        // APPROACH C: Cross-class swap - same logic as B but allow OTHER classes
        // Teacher in (Class B, T1) can move to red (Class A, T2) if they teach both;
        // candidate from red takes (B, T1) if they teach B too
        for (int k = 0; k < _allSlots.Count; k++)
        {
            HourSlot otherSlot = _allSlots[k];
            if (otherSlot == null) continue;
            if (otherSlot.Day == redSlot.Day && otherSlot.Hour == redSlot.Hour) continue;
            if (otherSlot.AssignedTeacherId <= 0) continue;
            if (otherSlot.Candidates == null) continue;

            int currentTeacherId = otherSlot.AssignedTeacherId;
            ClassTeacher currentInRed = FindTeacherInCandidates(redSlot.Candidates, currentTeacherId);
            if (currentInRed == null) continue;
            if (IsBusy(currentTeacherId, redSlot.Day, redSlot.Hour)) continue;

            for (int j = 0; j < redSlot.Candidates.Count; j++)
            {
                ClassTeacher candidate = redSlot.Candidates[j];
                if (candidate == null || candidate.TeacherId <= 0) continue;
                if (candidate.TeacherId == currentTeacherId) continue;
                ClassTeacher candidateInOther = FindTeacherInCandidates(otherSlot.Candidates, candidate.TeacherId);
                if (candidateInOther == null) continue;
                if (IsBusy(candidate.TeacherId, otherSlot.Day, otherSlot.Hour)) continue;

                int oldTeacher = otherSlot.AssignedTeacherId;
                int oldProf = otherSlot.AssignedProfessionalId;
                int oldHak = otherSlot.AssignedHakbatza;
                int oldIhu = otherSlot.AssignedIhud;
                UndoAssign(otherSlot);
                if (CanAssign(redSlot, currentInRed) && CanAssign(otherSlot, candidateInOther))
                {
                    ApplyAssign(otherSlot, candidateInOther);
                    ApplyAssign(redSlot, currentInRed);
                    return true;
                }
                RestoreAssign(otherSlot, oldTeacher, oldProf, oldHak, oldIhu);
            }
        }

        return false;
    }

    // STRATEGY 3: For each candidate teacher who is busy at red slot time (teaching in ANOTHER class),
    // try to find a replacement for them in that other class, freeing them for the red slot
    private bool TryFreeTeacherFromOtherClass(HourSlot redSlot)
    {
        if (redSlot == null || redSlot.Candidates == null) return false;

        for (int j = 0; j < redSlot.Candidates.Count; j++)
        {
            ClassTeacher candidate = redSlot.Candidates[j];
            if (candidate == null || candidate.TeacherId <= 0) continue;

            // Skip if candidate is free
            if (!IsBusy(candidate.TeacherId, redSlot.Day, redSlot.Hour)) continue;

            // Find where the candidate is busy
            HourSlot blockingSlot = GetBusySlot(candidate.TeacherId, redSlot.Day, redSlot.Hour);
            if (blockingSlot == null) continue;
            if (blockingSlot.ClassId == redSlot.ClassId) continue; // Same class - handled by TrySwapWithFreeSlot
            if (blockingSlot.Candidates == null) continue;

            // Save blockingSlot's assignment
            int oldTeacher = blockingSlot.AssignedTeacherId;
            int oldProf = blockingSlot.AssignedProfessionalId;
            int oldHak = blockingSlot.AssignedHakbatza;
            int oldIhu = blockingSlot.AssignedIhud;

            // LEVEL 1: Try to find a FREE replacement for blockingSlot
            for (int k = 0; k < blockingSlot.Candidates.Count; k++)
            {
                ClassTeacher replacement = blockingSlot.Candidates[k];
                if (replacement == null || replacement.TeacherId <= 0) continue;
                if (replacement.TeacherId == candidate.TeacherId) continue;

                if (IsBusy(replacement.TeacherId, blockingSlot.Day, blockingSlot.Hour)) continue;

                UndoAssign(blockingSlot);

                if (CanAssign(blockingSlot, replacement))
                {
                    ApplyAssign(blockingSlot, replacement);

                    if (CanAssign(redSlot, candidate))
                    {
                        ApplyAssign(redSlot, candidate);
                        return true;
                    }

                    UndoAssign(blockingSlot);
                }

                RestoreAssign(blockingSlot, oldTeacher, oldProf, oldHak, oldIhu);
            }

            // LEVEL 2: Try to free a BUSY replacement by finding THEIR replacement
            for (int k = 0; k < blockingSlot.Candidates.Count; k++)
            {
                ClassTeacher replacement = blockingSlot.Candidates[k];
                if (replacement == null || replacement.TeacherId <= 0) continue;
                if (replacement.TeacherId == candidate.TeacherId) continue;
                if (!IsBusy(replacement.TeacherId, blockingSlot.Day, blockingSlot.Hour)) continue; // Only busy ones

                // Find where replacement is busy
                HourSlot replacement2Slot = GetBusySlot(replacement.TeacherId, blockingSlot.Day, blockingSlot.Hour);
                if (replacement2Slot == null) continue;
                if (replacement2Slot.ClassId == blockingSlot.ClassId) continue;
                if (replacement2Slot.Candidates == null) continue;

                // Save replacement2Slot
                int r2Old = replacement2Slot.AssignedTeacherId;
                int r2Prof = replacement2Slot.AssignedProfessionalId;
                int r2Hak = replacement2Slot.AssignedHakbatza;
                int r2Ihu = replacement2Slot.AssignedIhud;

                // Try to find someone to replace the replacement
                for (int m = 0; m < replacement2Slot.Candidates.Count; m++)
                {
                    ClassTeacher replacement2 = replacement2Slot.Candidates[m];
                    if (replacement2 == null) continue;
                    if (replacement2.TeacherId == replacement.TeacherId) continue;
                    if (replacement2.TeacherId == candidate.TeacherId) continue;
                    if (IsBusy(replacement2.TeacherId, replacement2Slot.Day, replacement2Slot.Hour)) continue;

                    UndoAssign(replacement2Slot);

                    if (CanAssign(replacement2Slot, replacement2))
                    {
                        ApplyAssign(replacement2Slot, replacement2);

                        // Now 'replacement' is free
                        UndoAssign(blockingSlot);

                        if (CanAssign(blockingSlot, replacement))
                        {
                            ApplyAssign(blockingSlot, replacement);

                            // Now 'candidate' is free
                            if (CanAssign(redSlot, candidate))
                            {
                                ApplyAssign(redSlot, candidate);
                                return true;
                            }

                            UndoAssign(blockingSlot);
                        }

                        RestoreAssign(blockingSlot, oldTeacher, oldProf, oldHak, oldIhu);
                        UndoAssign(replacement2Slot);
                    }

                    RestoreAssign(replacement2Slot, r2Old, r2Prof, r2Hak, r2Ihu);
                }
            }

            // LEVEL 3: Cross-time swap in the blocking class
            // Find another slot in blockingSlot's class where candidate is free
            // and swap with the teacher there
            for (int k = 0; k < _allSlots.Count; k++)
            {
                HourSlot otherInBlockingClass = _allSlots[k];
                if (otherInBlockingClass == null) continue;
                if (otherInBlockingClass.ClassId != blockingSlot.ClassId) continue;
                if (otherInBlockingClass.Day == blockingSlot.Day && otherInBlockingClass.Hour == blockingSlot.Hour) continue;
                if (otherInBlockingClass.AssignedTeacherId <= 0) continue;
                if (otherInBlockingClass.Candidates == null) continue;

                // Check if candidate is FREE at this other time
                if (IsBusy(candidate.TeacherId, otherInBlockingClass.Day, otherInBlockingClass.Hour)) continue;

                // Check if candidate is in this slot's candidates
                ClassTeacher candidateInOtherBlocking = FindTeacherInCandidates(otherInBlockingClass.Candidates, candidate.TeacherId);
                if (candidateInOtherBlocking == null) continue;

                // Get the teacher at otherInBlockingClass
                int otherTeacherId = otherInBlockingClass.AssignedTeacherId;

                // Check if otherTeacher can teach at blockingSlot's time
                ClassTeacher otherInBlocking = FindTeacherInCandidates(blockingSlot.Candidates, otherTeacherId);
                if (otherInBlocking == null) continue;

                // Check if otherTeacher is free at blockingSlot's time (after we move them)
                // They're already assigned at otherInBlockingClass time, not blockingSlot time
                // So we need to check if they're free at blockingSlot's time
                if (IsBusy(otherTeacherId, blockingSlot.Day, blockingSlot.Hour)) continue;

                // Save both slots
                int otherOld = otherInBlockingClass.AssignedTeacherId;
                int otherProf = otherInBlockingClass.AssignedProfessionalId;
                int otherHak = otherInBlockingClass.AssignedHakbatza;
                int otherIhu = otherInBlockingClass.AssignedIhud;

                // Do the swap within blocking class
                UndoAssign(otherInBlockingClass);
                UndoAssign(blockingSlot);

                if (CanAssign(blockingSlot, otherInBlocking) && CanAssign(otherInBlockingClass, candidateInOtherBlocking))
                {
                    ApplyAssign(blockingSlot, otherInBlocking);
                    ApplyAssign(otherInBlockingClass, candidateInOtherBlocking);

                    // Now candidate is FREE at redSlot's time!
                    if (CanAssign(redSlot, candidate))
                    {
                        ApplyAssign(redSlot, candidate);
                        return true;
                    }

                    // Rollback
                    UndoAssign(blockingSlot);
                    UndoAssign(otherInBlockingClass);
                }

                RestoreAssign(blockingSlot, oldTeacher, oldProf, oldHak, oldIhu);
                RestoreAssign(otherInBlockingClass, otherOld, otherProf, otherHak, otherIhu);
            }
        }
        return false;
    }

    // Recursive function to try to fill a slot
    // Returns true if the slot was successfully filled
    private bool TryFillSlotRecursive(HourSlot targetSlot, int depth, HashSet<string> visited)
    {
        if (targetSlot == null) return false;
        if (targetSlot.AssignedTeacherId > 0) return true; // Already filled
        if (targetSlot.Candidates == null || targetSlot.Candidates.Count == 0) return false;
        if (depth > MAX_RECURSION_DEPTH) return false;
        
        _recursionVisits++;
        if (_recursionVisits > MAX_RECURSION_VISITS) return false;

        string slotKey = "S" + targetSlot.ClassId + "_" + targetSlot.Day + "_" + targetSlot.Hour;
        if (visited.Contains(slotKey)) return false;
        visited.Add(slotKey);

        // STEP 1: Try direct assignment with any free teacher
        for (int j = 0; j < targetSlot.Candidates.Count; j++)
        {
            ClassTeacher ct = targetSlot.Candidates[j];
            if (ct == null) continue;
            if (ct.TeacherId <= 0) continue;

            if (!IsBusy(ct.TeacherId, targetSlot.Day, targetSlot.Hour))
            {
                if (CanAssign(targetSlot, ct))
                {
                    ApplyAssign(targetSlot, ct);
                    return true;
                }
            }
        }

        // STEP 2: For each candidate who is busy, try to free them recursively
        for (int j = 0; j < targetSlot.Candidates.Count; j++)
        {
            ClassTeacher neededTeacher = targetSlot.Candidates[j];
            if (neededTeacher == null) continue;
            if (neededTeacher.TeacherId <= 0) continue;
            if (!IsBusy(neededTeacher.TeacherId, targetSlot.Day, targetSlot.Hour)) continue;

            // Try to free this teacher recursively
            bool freed = TryFreeTeacherRecursive(neededTeacher.TeacherId, targetSlot.Day, targetSlot.Hour, depth + 1, visited);
            if (freed)
            {
                // Teacher is now free - try to assign
                if (CanAssign(targetSlot, neededTeacher))
                {
                    ApplyAssign(targetSlot, neededTeacher);
                    return true;
                }
            }
        }

        // STEP 3: Look for cross-time swaps (same or other class)
        for (int k = 0; k < _allSlots.Count; k++)
        {
            HourSlot otherSlot = _allSlots[k];
            if (otherSlot == null) continue;
            if (otherSlot.Day == targetSlot.Day && otherSlot.Hour == targetSlot.Hour) continue;
            if (otherSlot.AssignedTeacherId <= 0) continue;
            if (otherSlot.Candidates == null || otherSlot.Candidates.Count == 0) continue;

            int assignedId = otherSlot.AssignedTeacherId;

            // Check if assigned teacher can go to targetSlot
            ClassTeacher assignedInTarget = FindTeacherInCandidates(targetSlot.Candidates, assignedId);
            if (assignedInTarget == null) continue;

            // Find a replacement for otherSlot from targetSlot's candidates
            for (int j = 0; j < targetSlot.Candidates.Count; j++)
            {
                ClassTeacher candidate = targetSlot.Candidates[j];
                if (candidate == null) continue;
                if (candidate.TeacherId <= 0) continue;
                if (candidate.TeacherId == assignedId) continue;

                // Check if candidate can go to otherSlot
                ClassTeacher candidateInOther = FindTeacherInCandidates(otherSlot.Candidates, candidate.TeacherId);
                if (candidateInOther == null) continue;

                // Check if candidate is free at otherSlot's time
                if (IsBusy(candidate.TeacherId, otherSlot.Day, otherSlot.Hour))
                {
                    // Try to free the candidate recursively
                    bool freed = TryFreeTeacherRecursive(candidate.TeacherId, otherSlot.Day, otherSlot.Hour, depth + 1, visited);
                    if (!freed) continue;
                }

                // Now candidate should be free - try the swap
                int oldTeacher = otherSlot.AssignedTeacherId;
                int oldProf = otherSlot.AssignedProfessionalId;
                int oldHak = otherSlot.AssignedHakbatza;
                int oldIhu = otherSlot.AssignedIhud;

                UndoAssign(otherSlot);

                if (CanAssign(otherSlot, candidateInOther) && CanAssign(targetSlot, assignedInTarget))
                {
                    ApplyAssign(otherSlot, candidateInOther);
                    ApplyAssign(targetSlot, assignedInTarget);
                    return true;
                }

                // Rollback
                RestoreAssign(otherSlot, oldTeacher, oldProf, oldHak, oldIhu);
            }
        }

        visited.Remove(slotKey);
        return false;
    }

    // Recursive function to try to free a teacher at a specific time
    // Returns true if the teacher was successfully freed
    private bool TryFreeTeacherRecursive(int teacherId, int day, int hour, int depth, HashSet<string> visited)
    {
        if (depth > MAX_RECURSION_DEPTH) return false;
        
        _recursionVisits++;
        if (_recursionVisits > MAX_RECURSION_VISITS) return false;

        // Check if already free
        if (!IsBusy(teacherId, day, hour)) return true;

        string key = "T" + teacherId + "_D" + day + "_H" + hour;
        if (visited.Contains(key)) return false;
        visited.Add(key);

        // Find where the teacher is busy
        HourSlot blockingSlot = GetBusySlot(teacherId, day, hour);
        if (blockingSlot == null)
        {
            visited.Remove(key);
            return true; // Not actually busy
        }

        if (blockingSlot.Candidates == null || blockingSlot.Candidates.Count == 0)
        {
            visited.Remove(key);
            return false;
        }

        // Save blocking slot's assignment
        int oldTeacher = blockingSlot.AssignedTeacherId;
        int oldProf = blockingSlot.AssignedProfessionalId;
        int oldHak = blockingSlot.AssignedHakbatza;
        int oldIhu = blockingSlot.AssignedIhud;

        // Try each alternative teacher for blocking slot
        for (int k = 0; k < blockingSlot.Candidates.Count; k++)
        {
            ClassTeacher altTeacher = blockingSlot.Candidates[k];
            if (altTeacher == null) continue;
            if (altTeacher.TeacherId == teacherId) continue;

            // Check if altTeacher is free at this time
            if (IsBusy(altTeacher.TeacherId, blockingSlot.Day, blockingSlot.Hour))
            {
                // Try to free altTeacher recursively
                bool freed = TryFreeTeacherRecursive(altTeacher.TeacherId, blockingSlot.Day, blockingSlot.Hour, depth + 1, visited);
                if (!freed) continue;
            }

            // altTeacher is now free - try to assign them to blocking slot
            UndoAssign(blockingSlot);

            if (CanAssign(blockingSlot, altTeacher))
            {
                ApplyAssign(blockingSlot, altTeacher);
                visited.Remove(key);
                return true; // Successfully freed the original teacher
            }

            // Rollback and try next
            RestoreAssign(blockingSlot, oldTeacher, oldProf, oldHak, oldIhu);
        }

        // Try cross-time swap (same or other class)
        for (int k = 0; k < _allSlots.Count; k++)
        {
            HourSlot otherSlot = _allSlots[k];
            if (otherSlot == null) continue;
            if (otherSlot.Day == blockingSlot.Day && otherSlot.Hour == blockingSlot.Hour) continue;
            if (otherSlot.AssignedTeacherId <= 0) continue;
            if (otherSlot.Candidates == null || otherSlot.Candidates.Count == 0) continue;

            // Check if the teacher we want to free can go to otherSlot
            ClassTeacher teacherInOther = FindTeacherInCandidates(otherSlot.Candidates, teacherId);
            if (teacherInOther == null) continue;

            // Check if teacher is free at otherSlot's time
            if (IsBusy(teacherId, otherSlot.Day, otherSlot.Hour)) continue;

            // Check if the teacher at otherSlot can go to blockingSlot
            int otherAssignedId = otherSlot.AssignedTeacherId;
            ClassTeacher otherAssignedInBlocking = FindTeacherInCandidates(blockingSlot.Candidates, otherAssignedId);
            if (otherAssignedInBlocking == null) continue;

            // Save both slots
            int otherOldTeacher = otherSlot.AssignedTeacherId;
            int otherOldProf = otherSlot.AssignedProfessionalId;
            int otherOldHak = otherSlot.AssignedHakbatza;
            int otherOldIhu = otherSlot.AssignedIhud;

            // Do the swap
            UndoAssign(otherSlot);
            UndoAssign(blockingSlot);

            if (CanAssign(blockingSlot, otherAssignedInBlocking) && CanAssign(otherSlot, teacherInOther))
            {
                ApplyAssign(blockingSlot, otherAssignedInBlocking);
                ApplyAssign(otherSlot, teacherInOther);
                visited.Remove(key);
                return true; // Teacher is now free at the original time
            }

            // Rollback
            RestoreAssign(blockingSlot, oldTeacher, oldProf, oldHak, oldIhu);
            RestoreAssign(otherSlot, otherOldTeacher, otherOldProf, otherOldHak, otherOldIhu);
        }

        visited.Remove(key);
        return false;
    }

    // Helper: Find a teacher in candidates list by TeacherId
    private ClassTeacher FindTeacherInCandidates(List<ClassTeacher> candidates, int teacherId)
    {
        if (candidates == null) return null;
        for (int i = 0; i < candidates.Count; i++)
        {
            if (candidates[i] != null && candidates[i].TeacherId == teacherId)
            {
                return candidates[i];
            }
        }
        return null;
    }

    // =========================================================
    // PRE-ASSIGN HOMEROOM TEACHERS TO HOUR 1 (BEFORE ALL SCHEDULING)
    // This runs FIRST, before any other scheduling
    // Simple and direct - place homeroom at hour 1 of their home class
    // =========================================================
    private void PreAssignHomeroomToHour1()
    {
        // For each homeroom teacher
        foreach (int teacherId in _homeClassByTeacher.Keys)
        {
            int homeClassId = _homeClassByTeacher[teacherId];

            // For each day
            for (int day = 1; day <= 6; day++)
            {
                // Find hour 1 slot of their home class
                HourSlot hour1Slot = FindSlot(homeClassId, day, 1);
                if (hour1Slot == null) continue;  // No hour 1 on this day for this class
                if (hour1Slot.AssignedTeacherId > 0) continue;  // Already assigned

                // Check if homeroom is in TeachList for this slot
                ClassTeacher homeroomCt = FindTeacherInCandidates(hour1Slot.Candidates, teacherId);
                if (homeroomCt == null) continue;  // Homeroom doesn't work at hour 1 in this class

                // Check if homeroom is free at this time (not assigned elsewhere)
                if (IsBusy(teacherId, day, 1)) continue;

                // Homeroom MUST be at hour 1 - hard constraint
                if (CanAssignIgnoringRemaining(hour1Slot, homeroomCt))
                {
                    ApplyAssign(hour1Slot, homeroomCt);
                }
            }
        }
    }

    // =========================================================
    // FINAL FORCE: SWAP HOMEROOM TO HOUR 1 (LAST RESORT)
    // This runs at the VERY END and forces homeroom into hour 1
    // by swapping them with whoever is currently there
    // =========================================================
    private void FinalForceHomeroomToHour1()
    {
        // For each homeroom teacher
        foreach (int teacherId in _homeClassByTeacher.Keys)
        {
            int homeClassId = _homeClassByTeacher[teacherId];

            // For each day
            for (int day = 1; day <= 6; day++)
            {
                // Find hour 1 slot of their home class
                HourSlot hour1Slot = FindSlot(homeClassId, day, 1);
                if (hour1Slot == null) continue;

                // Check if homeroom is in TeachList for hour 1
                ClassTeacher homeroomCt = FindTeacherInCandidates(hour1Slot.Candidates, teacherId);
                if (homeroomCt == null) continue;  // Homeroom doesn't work at hour 1 in this class on this day

                // Check if homeroom is already at hour 1
                if (hour1Slot.AssignedTeacherId == teacherId) continue;  // Already correct!

                // HOMEROOM IS NOT AT HOUR 1 - NEED TO FORCE IT!
                
                // Get who is currently at hour 1
                int currentTeacherId = hour1Slot.AssignedTeacherId;

                // Find where homeroom is currently assigned (on this day, any hour, in home class)
                HourSlot homeroomCurrentSlot = null;
                for (int k = 0; k < _allSlots.Count; k++)
                {
                    HourSlot s = _allSlots[k];
                    if (s.Day == day && s.AssignedTeacherId == teacherId)
                    {
                        homeroomCurrentSlot = s;
                        break;
                    }
                }

                // CASE 1: No one at hour 1 - just assign homeroom
                if (currentTeacherId <= 0)
                {
                    // Check if homeroom is busy elsewhere at hour 1
                    HourSlot busyAt1 = GetBusySlot(teacherId, day, 1);
                    if (busyAt1 != null && busyAt1.ClassId != homeClassId)
                    {
                        // Homeroom is teaching ANOTHER class at hour 1
                        // Find replacement for that class and move homeroom
                        TryFreeHomeroomFromOtherClass(hour1Slot, busyAt1, teacherId, homeroomCt);
                    }
                    else if (busyAt1 == null)
                    {
                        // Homeroom is free at hour 1 - just assign!
                        ApplyAssign(hour1Slot, homeroomCt);
                    }
                    continue;
                }

                // CASE 2: Someone else at hour 1, homeroom is elsewhere in home class
                if (homeroomCurrentSlot != null && homeroomCurrentSlot.ClassId == homeClassId)
                {
                    // Simple swap within home class
                    ClassTeacher currentCt = FindTeacherInCandidates(homeroomCurrentSlot.Candidates, currentTeacherId);
                    if (currentCt != null && !IsBusy(currentTeacherId, homeroomCurrentSlot.Day, homeroomCurrentSlot.Hour))
                    {
                        // Swap them
                        UndoAssignForce(hour1Slot);
                        UndoAssignForce(homeroomCurrentSlot);
                        
                        ApplyAssign(hour1Slot, homeroomCt);
                        if (CanAssign(homeroomCurrentSlot, currentCt))
                        {
                            ApplyAssign(homeroomCurrentSlot, currentCt);
                        }
                        continue;
                    }
                }

                // CASE 3: Someone else at hour 1, homeroom is in a DIFFERENT class at hour 1
                HourSlot homeroomHour1Elsewhere = GetBusySlot(teacherId, day, 1);
                if (homeroomHour1Elsewhere != null && homeroomHour1Elsewhere.ClassId != homeClassId)
                {
                    // Homeroom is at hour 1 but in wrong class
                    // Try to swap: current teacher to other class, homeroom to home class
                    ClassTeacher currentInOther = FindTeacherInCandidates(homeroomHour1Elsewhere.Candidates, currentTeacherId);
                    if (currentInOther != null)
                    {
                        UndoAssignForce(hour1Slot);
                        UndoAssignForce(homeroomHour1Elsewhere);
                        
                        ApplyAssign(hour1Slot, homeroomCt);
                        if (CanAssign(homeroomHour1Elsewhere, currentInOther))
                        {
                            ApplyAssign(homeroomHour1Elsewhere, currentInOther);
                        }
                        continue;
                    }
                    
                    // Current can't go to other class - find someone else
                    TryFreeHomeroomFromOtherClass(hour1Slot, homeroomHour1Elsewhere, teacherId, homeroomCt);
                }

                // CASE 4: Someone at hour 1, homeroom is assigned at different hour in same class
                // Already handled by CASE 2 above, but let's try harder
                if (homeroomCurrentSlot != null && homeroomCurrentSlot.ClassId == homeClassId && homeroomCurrentSlot.Hour != 1)
                {
                    // Find ANY slot where current teacher can go
                    for (int k = 0; k < _allSlots.Count; k++)
                    {
                        HourSlot targetSlot = _allSlots[k];
                        if (targetSlot == null) continue;
                        if (targetSlot.ClassId != homeClassId) continue;
                        if (targetSlot.AssignedTeacherId > 0) continue;  // Must be empty
                        if (targetSlot.Day != day) continue;  // Same day
                        
                        ClassTeacher currentInTarget = FindTeacherInCandidates(targetSlot.Candidates, currentTeacherId);
                        if (currentInTarget == null) continue;
                        if (IsBusy(currentTeacherId, targetSlot.Day, targetSlot.Hour)) continue;

                        // Move current to target, then swap homeroom to hour 1
                        int h1Old = hour1Slot.AssignedTeacherId;
                        UndoAssignForce(hour1Slot);
                        
                        if (CanAssign(targetSlot, currentInTarget))
                        {
                            ApplyAssign(targetSlot, currentInTarget);
                            ApplyAssign(hour1Slot, homeroomCt);
                            break;
                        }
                        else
                        {
                            // Rollback
                            ClassTeacher h1Ct = FindTeacherInCandidates(hour1Slot.Candidates, h1Old);
                            if (h1Ct != null) ApplyAssign(hour1Slot, h1Ct);
                        }
                    }
                }
            }
        }
    }

    // Helper: Try to free homeroom from another class so they can go to their home class hour 1
    private void TryFreeHomeroomFromOtherClass(HourSlot homeHour1Slot, HourSlot otherClassSlot, int homeroomTeacherId, ClassTeacher homeroomCt)
    {
        if (otherClassSlot == null || otherClassSlot.Candidates == null) return;

        // Find replacement for other class
        for (int k = 0; k < otherClassSlot.Candidates.Count; k++)
        {
            ClassTeacher replacement = otherClassSlot.Candidates[k];
            if (replacement == null || replacement.TeacherId == homeroomTeacherId) continue;
            if (IsBusy(replacement.TeacherId, otherClassSlot.Day, otherClassSlot.Hour)) continue;

            // Found replacement - do the swap
            UndoAssignForce(otherClassSlot);
            UndoAssignForce(homeHour1Slot);

            if (CanAssign(otherClassSlot, replacement))
            {
                ApplyAssign(otherClassSlot, replacement);
                ApplyAssign(homeHour1Slot, homeroomCt);
                return;
            }
        }
    }

    // =========================================================
    // ENFORCE HOMEROOM AT HOUR 1 (POST-PROCESSING)
    // After all scheduling, ensure homeroom teachers start at hour 1
    // Rule: If homeroom teacher works ANYWHERE at hour 1, she must be in her HOME CLASS at hour 1
    // =========================================================
    private void EnforceHomeroomAtHour1()
    {
        // Get all classes that have a homeroom teacher
        foreach (int teacherId in _homeClassByTeacher.Keys)
        {
            int homeClassId = _homeClassByTeacher[teacherId];

            // Find all hour 1 slots for this class (one per day)
            for (int day = 1; day <= 6; day++)
            {
                // First check: Is homeroom teacher working ANYWHERE at hour 1 on this day?
                HourSlot homeroomHour1Slot = GetBusySlot(teacherId, day, 1);
                if (homeroomHour1Slot == null) continue;  // Homeroom doesn't work at hour 1 on this day

                // Homeroom IS working at hour 1 - make sure it's in her HOME class
                if (homeroomHour1Slot.ClassId == homeClassId)
                {
                    // Already in home class at hour 1 - perfect!
                    continue;
                }

                // Homeroom is in a DIFFERENT class at hour 1 - need to move her to home class
                HourSlot homeHour1Slot = FindSlot(homeClassId, day, 1);
                if (homeHour1Slot == null) continue;  // No hour 1 slot for home class on this day

                // Check if homeroom teacher is in candidates for home class hour 1
                ClassTeacher homeroomCtInHome = FindTeacherInCandidates(homeHour1Slot.Candidates, teacherId);
                
                // Get the teacher currently at home class hour 1
                int currentTeacherAtHome = homeHour1Slot.AssignedTeacherId;

                // STRATEGY 1: Simple swap - homeroom goes to home, current teacher goes to other class
                if (homeroomCtInHome != null && currentTeacherAtHome > 0)
                {
                    ClassTeacher currentInOtherClass = FindTeacherInCandidates(homeroomHour1Slot.Candidates, currentTeacherAtHome);
                    if (currentInOtherClass != null)
                    {
                        // Both can swap - do it!
                        int homeOld = homeHour1Slot.AssignedTeacherId;
                        int homeProf = homeHour1Slot.AssignedProfessionalId;
                        int homeHak = homeHour1Slot.AssignedHakbatza;
                        int homeIhu = homeHour1Slot.AssignedIhud;

                        int otherOld = homeroomHour1Slot.AssignedTeacherId;
                        int otherProf = homeroomHour1Slot.AssignedProfessionalId;
                        int otherHak = homeroomHour1Slot.AssignedHakbatza;
                        int otherIhu = homeroomHour1Slot.AssignedIhud;

                        UndoAssignForce(homeHour1Slot);
                        UndoAssignForce(homeroomHour1Slot);

                        bool canAssignHomeroom = CanAssignIgnoringRemaining(homeHour1Slot, homeroomCtInHome);
                        bool canAssignCurrent = CanAssign(homeroomHour1Slot, currentInOtherClass);

                        if (canAssignHomeroom && canAssignCurrent)
                        {
                            ApplyAssign(homeHour1Slot, homeroomCtInHome);
                            ApplyAssign(homeroomHour1Slot, currentInOtherClass);
                            continue;  // Success!
                        }

                        // Rollback
                        RestoreAssign(homeHour1Slot, homeOld, homeProf, homeHak, homeIhu);
                        RestoreAssign(homeroomHour1Slot, otherOld, otherProf, otherHak, otherIhu);
                    }
                }

                // STRATEGY 2: Find another teacher for the other class, move homeroom to home
                if (homeroomCtInHome != null)
                {
                    // Try to find a replacement for homeroomHour1Slot (the other class)
                    for (int c = 0; c < homeroomHour1Slot.Candidates.Count; c++)
                    {
                        ClassTeacher replacement = homeroomHour1Slot.Candidates[c];
                        if (replacement == null || replacement.TeacherId == teacherId) continue;
                        if (IsBusy(replacement.TeacherId, day, 1)) continue;

                        // Save state
                        int homeOld = homeHour1Slot.AssignedTeacherId;
                        int homeProf = homeHour1Slot.AssignedProfessionalId;
                        int homeHak = homeHour1Slot.AssignedHakbatza;
                        int homeIhu = homeHour1Slot.AssignedIhud;

                        int otherOld = homeroomHour1Slot.AssignedTeacherId;
                        int otherProf = homeroomHour1Slot.AssignedProfessionalId;
                        int otherHak = homeroomHour1Slot.AssignedHakbatza;
                        int otherIhu = homeroomHour1Slot.AssignedIhud;

                        // Free homeroom from other class
                        UndoAssignForce(homeroomHour1Slot);

                        if (CanAssign(homeroomHour1Slot, replacement))
                        {
                            ApplyAssign(homeroomHour1Slot, replacement);

                            // Now try to put homeroom in home class
                            if (currentTeacherAtHome > 0)
                            {
                                // Need to move current teacher somewhere
                                if (TryMoveTeacherToAnotherSlot(homeHour1Slot, currentTeacherAtHome, homeroomCtInHome))
                                {
                                    continue;  // Success!
                                }
                            }
                            else
                            {
                                if (CanAssignIgnoringRemaining(homeHour1Slot, homeroomCtInHome))
                                {
                                    ApplyAssign(homeHour1Slot, homeroomCtInHome);
                                    continue;  // Success!
                                }
                            }

                            // Rollback replacement
                            UndoAssignForce(homeroomHour1Slot);
                        }

                        RestoreAssign(homeroomHour1Slot, otherOld, otherProf, otherHak, otherIhu);
                    }
                }

                // STRATEGY 3: Cross-time swap - find where homeroom can swap within home class
                if (homeroomCtInHome == null && currentTeacherAtHome > 0)
                {
                    // Homeroom NOT in candidates for hour 1 of home class
                    // Try to swap within home class: find a slot where homeroom IS in candidates
                    // and swap with the teacher there
                    TrySwapHomeroomFromOtherClassViaHomeClass(homeHour1Slot, homeroomHour1Slot, homeClassId, teacherId, currentTeacherAtHome, day);
                }
            }
        }
    }

    // Complex swap: Homeroom is in other class at hour 1, need to move to home class
    // But homeroom is NOT in candidates for hour 1 of home class
    // Find another slot in home class where homeroom IS in candidates and do a chain swap
    private void TrySwapHomeroomFromOtherClassViaHomeClass(HourSlot homeHour1Slot, HourSlot homeroomOtherSlot, 
        int homeClassId, int homeroomTeacherId, int currentTeacherAtHome, int day)
    {
        // Find a slot in home class where:
        // 1. Homeroom IS in candidates
        // 2. The assigned teacher can move to hour 1
        // 3. Current hour 1 teacher can move to homeroom's other class
        for (int k = 0; k < _allSlots.Count; k++)
        {
            HourSlot midSlot = _allSlots[k];
            if (midSlot == null) continue;
            if (midSlot.ClassId != homeClassId) continue;
            if (midSlot.Day != day) continue;  // Same day
            if (midSlot.Hour == 1) continue;  // Not hour 1 itself
            if (midSlot.AssignedTeacherId <= 0) continue;  // Must have someone assigned

            // Check if homeroom is in candidates for this slot
            ClassTeacher homeroomInMid = FindTeacherInCandidates(midSlot.Candidates, homeroomTeacherId);
            if (homeroomInMid == null) continue;

            int midTeacherId = midSlot.AssignedTeacherId;

            // Check if mid teacher can go to hour 1 of home class
            ClassTeacher midInHour1 = FindTeacherInCandidates(homeHour1Slot.Candidates, midTeacherId);
            if (midInHour1 == null) continue;

            // Check if mid teacher is free at hour 1 (they're at midSlot currently, so should be free at hour 1)
            // Actually they ARE assigned at midSlot's hour, not hour 1
            // But we need to check if something else blocks them at hour 1
            // After we undo midSlot, they should be free at their current time
            // But at hour 1 they might be teaching elsewhere
            // Let's check after undo

            // Check if current hour 1 teacher can go to homeroom's other class
            ClassTeacher currentInOther = FindTeacherInCandidates(homeroomOtherSlot.Candidates, currentTeacherAtHome);
            if (currentInOther == null) continue;

            // Save all states
            int h1Old = homeHour1Slot.AssignedTeacherId;
            int h1Prof = homeHour1Slot.AssignedProfessionalId;
            int h1Hak = homeHour1Slot.AssignedHakbatza;
            int h1Ihu = homeHour1Slot.AssignedIhud;

            int midOld = midSlot.AssignedTeacherId;
            int midProf = midSlot.AssignedProfessionalId;
            int midHak = midSlot.AssignedHakbatza;
            int midIhu = midSlot.AssignedIhud;

            int otherOld = homeroomOtherSlot.AssignedTeacherId;
            int otherProf = homeroomOtherSlot.AssignedProfessionalId;
            int otherHak = homeroomOtherSlot.AssignedHakbatza;
            int otherIhu = homeroomOtherSlot.AssignedIhud;

            // Try the chain swap:
            // 1. Current hour 1 teacher -> other class (homeroom's old spot)
            // 2. Mid teacher -> hour 1 of home class
            // 3. Homeroom -> mid slot (home class)
            UndoAssignForce(homeHour1Slot);
            UndoAssignForce(midSlot);
            UndoAssignForce(homeroomOtherSlot);

            // Check if mid teacher is free at hour 1 now
            if (!IsBusy(midTeacherId, day, 1))
            {
                bool ok1 = CanAssign(homeroomOtherSlot, currentInOther);
                bool ok2 = CanAssign(homeHour1Slot, midInHour1);
                bool ok3 = CanAssignIgnoringRemaining(midSlot, homeroomInMid);

                if (ok1 && ok2 && ok3)
                {
                    ApplyAssign(homeroomOtherSlot, currentInOther);
                    ApplyAssign(homeHour1Slot, midInHour1);
                    ApplyAssign(midSlot, homeroomInMid);
                    return;  // Success!
                }
            }

            // Rollback
            RestoreAssign(homeHour1Slot, h1Old, h1Prof, h1Hak, h1Ihu);
            RestoreAssign(midSlot, midOld, midProf, midHak, midIhu);
            RestoreAssign(homeroomOtherSlot, otherOld, otherProf, otherHak, otherIhu);
        }
    }

    // Find a slot by classId, day, hour
    private HourSlot FindSlot(int classId, int day, int hour)
    {
        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot slot = _allSlots[i];
            if (slot.ClassId == classId && slot.Day == day && slot.Hour == hour)
            {
                return slot;
            }
        }
        return null;
    }

    // Try to move a teacher from a slot to another slot in the same class
    private bool TryMoveTeacherToAnotherSlot(HourSlot hour1Slot, int otherTeacherId, ClassTeacher homeroomCt)
    {
        // Find another slot in the same class where otherTeacher can be moved
        for (int k = 0; k < _allSlots.Count; k++)
        {
            HourSlot targetSlot = _allSlots[k];
            if (targetSlot == null) continue;
            if (targetSlot.ClassId != hour1Slot.ClassId) continue;
            if (targetSlot.Day == hour1Slot.Day && targetSlot.Hour == hour1Slot.Hour) continue;
            if (targetSlot.AssignedTeacherId > 0) continue;  // Must be empty
            if (targetSlot.Candidates == null) continue;

            // Check if otherTeacher can be assigned here
            ClassTeacher otherCt = FindTeacherInCandidates(targetSlot.Candidates, otherTeacherId);
            if (otherCt == null) continue;

            // Check if otherTeacher is free at this time
            if (IsBusy(otherTeacherId, targetSlot.Day, targetSlot.Hour)) continue;

            // Save hour1Slot
            int oldTeacher = hour1Slot.AssignedTeacherId;
            int oldProf = hour1Slot.AssignedProfessionalId;
            int oldHak = hour1Slot.AssignedHakbatza;
            int oldIhu = hour1Slot.AssignedIhud;

            // Move otherTeacher to targetSlot
            UndoAssignForce(hour1Slot);

            if (CanAssign(targetSlot, otherCt) && CanAssign(hour1Slot, homeroomCt))
            {
                ApplyAssign(targetSlot, otherCt);
                ApplyAssign(hour1Slot, homeroomCt);
                return true;
            }

            RestoreAssign(hour1Slot, oldTeacher, oldProf, oldHak, oldIhu);
        }
        return false;
    }

    // Try to swap homeroom teacher from another class to hour 1 of home class
    private bool TrySwapHomeroomToHour1(HourSlot hour1Slot, HourSlot homeroomCurrentSlot, int homeroomTeacherId, ClassTeacher homeroomCt)
    {
        // The teacher at hour1Slot needs to go somewhere else
        int hour1TeacherId = hour1Slot.AssignedTeacherId;
        if (hour1TeacherId <= 0) return false;

        // Check if hour1Teacher can go to homeroomCurrentSlot's class
        ClassTeacher hour1InOtherClass = FindTeacherInCandidates(homeroomCurrentSlot.Candidates, hour1TeacherId);
        if (hour1InOtherClass == null) return false;

        // Save state
        int h1OldTeacher = hour1Slot.AssignedTeacherId;
        int h1OldProf = hour1Slot.AssignedProfessionalId;
        int h1OldHak = hour1Slot.AssignedHakbatza;
        int h1OldIhu = hour1Slot.AssignedIhud;

        int hrOldTeacher = homeroomCurrentSlot.AssignedTeacherId;
        int hrOldProf = homeroomCurrentSlot.AssignedProfessionalId;
        int hrOldHak = homeroomCurrentSlot.AssignedHakbatza;
        int hrOldIhu = homeroomCurrentSlot.AssignedIhud;

        // Try the swap
        UndoAssignForce(hour1Slot);
        UndoAssignForce(homeroomCurrentSlot);

        if (CanAssign(hour1Slot, homeroomCt) && CanAssign(homeroomCurrentSlot, hour1InOtherClass))
        {
            ApplyAssign(hour1Slot, homeroomCt);
            ApplyAssign(homeroomCurrentSlot, hour1InOtherClass);
            return true;
        }

        // Rollback
        RestoreAssign(hour1Slot, h1OldTeacher, h1OldProf, h1OldHak, h1OldIhu);
        RestoreAssign(homeroomCurrentSlot, hrOldTeacher, hrOldProf, hrOldHak, hrOldIhu);
        return false;
    }

    // Try to swap homeroom with another teacher within the same class
    private bool TrySwapHomeroomWithinClass(HourSlot hour1Slot, int classId, int homeroomTeacherId, ClassTeacher homeroomCt, int hour1TeacherId)
    {
        // Find where homeroom is currently assigned in this class
        for (int k = 0; k < _allSlots.Count; k++)
        {
            HourSlot homeroomSlot = _allSlots[k];
            if (homeroomSlot == null) continue;
            if (homeroomSlot.ClassId != classId) continue;
            if (homeroomSlot.AssignedTeacherId != homeroomTeacherId) continue;

            // Found homeroom's current slot in this class
            // Check if hour1Teacher can be assigned here
            ClassTeacher hour1Ct = FindTeacherInCandidates(homeroomSlot.Candidates, hour1TeacherId);
            if (hour1Ct == null) continue;

            // Check if hour1Teacher is free at this time
            if (IsBusy(hour1TeacherId, homeroomSlot.Day, homeroomSlot.Hour)) continue;

            // Save state
            int h1OldTeacher = hour1Slot.AssignedTeacherId;
            int h1OldProf = hour1Slot.AssignedProfessionalId;
            int h1OldHak = hour1Slot.AssignedHakbatza;
            int h1OldIhu = hour1Slot.AssignedIhud;

            int hrOldTeacher = homeroomSlot.AssignedTeacherId;
            int hrOldProf = homeroomSlot.AssignedProfessionalId;
            int hrOldHak = homeroomSlot.AssignedHakbatza;
            int hrOldIhu = homeroomSlot.AssignedIhud;

            // Swap them
            UndoAssignForce(hour1Slot);
            UndoAssignForce(homeroomSlot);

            if (CanAssign(hour1Slot, homeroomCt) && CanAssign(homeroomSlot, hour1Ct))
            {
                ApplyAssign(hour1Slot, homeroomCt);
                ApplyAssign(homeroomSlot, hour1Ct);
                return true;
            }

            // Rollback
            RestoreAssign(hour1Slot, h1OldTeacher, h1OldProf, h1OldHak, h1OldIhu);
            RestoreAssign(homeroomSlot, hrOldTeacher, hrOldProf, hrOldHak, hrOldIhu);
        }
        return false;
    }

    // =========================================================
    // SPECIAL: FILL HOUR 1 WITH HOMEROOM PRIORITY
    // Ensures homeroom teachers start the day in their classes
    // =========================================================
    private void FillHour1WithHomeroomPriority(List<HourSlot> slots)
    {
        // First pass: Try to assign homeroom teachers (TafkidId == 1) to their classes
        for (int i = 0; i < slots.Count; i++)
        {
            HourSlot slot = slots[i];
            if (slot.AssignedTeacherId > 0) continue;
            if (slot.Candidates == null || slot.Candidates.Count == 0) continue;

            // STRICT: only the registered ManageClassId homeroom can open
            // this class's day. Other TafkidId=1 teachers who happen to
            // teach here cannot stand in (that produced the
            // "wrong homeroom opening another class" bug).
            ClassTeacher homeroomCt = null;
            for (int j = 0; j < slot.Candidates.Count; j++)
            {
                ClassTeacher ct = slot.Candidates[j];
                if (ct != null && ct.TafkidId == 1 && ct.ManageClassId == slot.ClassId)
                {
                    homeroomCt = ct;
                    break;
                }
            }

            if (homeroomCt == null) continue;

            // Check if homeroom teacher is free at this time
            if (!IsBusy(homeroomCt.TeacherId, slot.Day, slot.Hour))
            {
                if (CanAssignIgnoringRemaining(slot, homeroomCt))
                {
                    ApplyAssign(slot, homeroomCt);
                }
            }
        }

        // Second pass: Fill remaining slots with any available teacher
        DirectFill(slots);
    }

    // Can assign ignoring remaining hours check (for emergency/hour 1)
    private bool CanAssignIgnoringRemaining(HourSlot slot, ClassTeacher ct)
    {
        if (slot.Candidates == null || slot.Candidates.Count == 0) return false;
        
        // Check if teacher is in candidates
        bool isInCandidates = false;
        for (int i = 0; i < slot.Candidates.Count; i++)
        {
            if (slot.Candidates[i] != null && slot.Candidates[i].TeacherId == ct.TeacherId)
            {
                isInCandidates = true;
                break;
            }
        }
        if (!isInCandidates) return false;

        if (IsBusy(ct.TeacherId, slot.Day, slot.Hour)) return false;
        if (WouldBreakConsecutive(ct.TeacherId, slot.Day, slot.Hour)) return false;
        if (IsHomeroomLockedToHome(slot, ct)) return false;

        return true;
    }

    // =========================================================
    // STEP 1: DIRECT FILL
    // =========================================================
    private void DirectFill(List<HourSlot> slots)
    {
        // repeat until no progress (because each assignment changes availability)
        // Allow more iterations to catch cascading effects
        bool progress = true;
        int maxIterations = 25;
        int iteration = 0;
        
        while (progress && iteration < maxIterations)
        {
            progress = false;
            iteration++;

            for (int i = 0; i < slots.Count; i++)
            {
                HourSlot slot = slots[i];
                if (slot.AssignedTeacherId > 0) continue;

                ClassTeacher best = ChooseBestDirect(slot);
                if (best != null)
                {
                    ApplyAssign(slot, best);
                    progress = true;
                }
            }
        }
    }

    private ClassTeacher ChooseBestDirect(HourSlot slot)
    {
        if (slot.Candidates == null) return null;

        ClassTeacher best = null;
        int bestScore = Int32.MinValue;

        for (int i = 0; i < slot.Candidates.Count; i++)
        {
            ClassTeacher ct = slot.Candidates[i];
            if (ct == null) continue;

            // STRICT: hour 1 is "day opener" — reserved for the registered
            // homeroom (ManageClassId == ClassId). If no homeroom is available,
            // a subject teacher (TafkidId != 1) may open the day, but never a
            // homeroom-of-another-class — that would steal a class opening
            // from a teacher who isn't connected pedagogically.
            if (slot.Hour == 1 && ct.TafkidId == 1 && ct.ManageClassId != slot.ClassId)
                continue;

            // STRICT: Only assign if teacher has remaining hours for THIS class.
            // No fallback to "borrow" hours from another class — that produces over-fill
            // (a teacher placed in a class they aren't contracted to teach), which the
            // skill flags as false-100%.
            if (!CanAssign(slot, ct)) continue;

            int score = ScoreCandidate(slot, ct);
            if (best == null || score > bestScore)
            {
                best = ct;
                bestScore = score;
            }
        }

        return best;
    }

    private int ScoreCandidate(HourSlot slot, ClassTeacher ct)
    {
        int score = 0;

        // Check if this teacher is THE homeroom teacher for THIS class
        // Use _homeroomByClass which correctly identifies homeroom based on ManageClassId or TafkidId=1
        int homeroomTeacherId;
        bool isHomeroomForThisClass = _homeroomByClass.TryGetValue(slot.ClassId, out homeroomTeacherId) 
                                       && homeroomTeacherId == ct.TeacherId;

        // 1) Homeroom in its own class - strong preference
        if (isHomeroomForThisClass)
            score += 100000;

        // 2) STRONG PREFERENCE: Homeroom teacher at HOUR 1 - they should start the day!
        // Rule: If homeroom teacher works in hour 1, they MUST start the day
        if (isHomeroomForThisClass && slot.Hour == 1)
            score += 500000;  // VERY high priority for hour 1 - must be assigned first!

        // 3) Check if teacher works ONLY in morning hours (1-4)
        // If so, prefer to assign them in morning hours
        bool worksOnlyMorning = WorksOnlyInMorning(ct.TeacherId);
        if (worksOnlyMorning && slot.Hour >= 1 && slot.Hour <= 4)
        {
            score += 30000;  // Bonus for morning-only teachers in morning hours
        }
        else if (worksOnlyMorning && slot.Hour > 4)
        {
            score -= 50000;  // Penalty for morning-only teachers in afternoon
        }

        // 4) More remaining in this class => prefer
        int rem;
        if (_remaining.TryGetValue(Key(slot.ClassId, ct.TeacherId), out rem))
            score += rem * 50;

        // 5) Prefer teacher who is "teacher" (if your flag means something)
        if (ct.IsTeacher) score += 100;

        // 6) Prefer not to split hakbatza/ihud? (small bias)
        if (ct.Hakbatza > 0) score += 5;
        if (ct.Ihud > 0) score += 5;

        // 7) פיזור על פני ימים: אם המורה כבר משבץ שעות בכיתה זו ביום זה,
        //    הענק penalty גדל בריבוע. כך אם יש לו 0 שעות → 0 penalty,
        //    1 שעה → -200, 2 שעות → -800, 3 שעות → -1800.
        //    מורה שזו הפעם היחידה לתפוס את התא יקבל את התא בכל זאת,
        //    כי בונוסים אחרים (homeroom +100000, remaining +50/לכל שעה)
        //    גוברים על ה-penalty. אבל כשיש מועמד אחר עם פחות שעות באותו
        //    יום באותה כיתה — הוא ייבחר.
        int sameDayCount = GetClassDayCount(ct.TeacherId, slot.ClassId, slot.Day);
        if (sameDayCount > 0) score -= 200 * sameDayCount * sameDayCount;

        return score;
    }

    // Check if a teacher works ONLY in morning hours (1-4)
    private bool WorksOnlyInMorning(int teacherId)
    {
        if (!_teacherWorkingHours.ContainsKey(teacherId)) return false;
        
        HashSet<int> workingHours = _teacherWorkingHours[teacherId];
        if (workingHours.Count == 0) return false;

        // Check if ALL working hours are morning hours (1-4)
        // HourId format: day*10 + hour, so hour 1-4 means hourId % 10 is 1-4
        foreach (int hourId in workingHours)
        {
            int hour = hourId % 10;
            if (hour > 4) return false;  // Found an afternoon hour
        }

        return true;  // All hours are morning hours
    }

    // =========================================================
    // STEP 2: FIND AVAILABLE TEACHERS (from all classes at this time)
    // =========================================================
    private void FindAvailableTeachersFill(List<HourSlot> slots)
    {
        // Repeat until no progress
        bool progress = true;
        int maxIterations = 15;
        int iteration = 0;
        
        while (progress && iteration < maxIterations)
        {
            progress = false;
            iteration++;

            for (int i = 0; i < slots.Count; i++)
            {
                HourSlot target = slots[i];
                if (target.AssignedTeacherId > 0) continue;

                // CRITICAL: Only consider teachers who are in the target class's Candidates (TeachList)
                // A teacher can only be assigned to a class if they appear in that class's TeachList
                if (target.Candidates == null || target.Candidates.Count == 0) continue;

                // First, try direct assignment from candidates who are free
                ClassTeacher best = null;
                int bestScore = Int32.MinValue;

                for (int j = 0; j < target.Candidates.Count; j++)
                {
                    ClassTeacher ct = target.Candidates[j];
                    if (ct == null) continue;

                    // Check if teacher is free at this time
                    if (IsBusy(ct.TeacherId, target.Day, target.Hour)) continue;

                    // Check if this teacher can be assigned to target class
                    bool hasRemainingInTarget = HasRemaining(target.ClassId, ct.TeacherId);
                    bool hasRemainingAnywhere = HasRemainingAnywhere(ct.TeacherId);
                    
                    if (!hasRemainingInTarget && !hasRemainingAnywhere) continue;
                    if (WouldBreakConsecutive(ct.TeacherId, target.Day, target.Hour)) continue;
                    if (IsHomeroomLockedToHome(target, ct)) continue;

                    int score = ScoreCandidate(target, ct);
                    if (best == null || score > bestScore)
                    {
                        best = ct;
                        bestScore = score;
                    }
                }

                if (best != null)
                {
                    // STRICT: do NOT pull remaining from another class. If this (Class,Teacher)
                    // doesn't have ClassTeacher.Hour > 0 and is not in a Hakbatza/Ihud, the
                    // teacher isn't supposed to teach this class — assigning them anyway would
                    // be over-fill (false-100%). Per skill rules: report the gap, don't hide it.
                    if (!HasRemaining(target.ClassId, best.TeacherId))
                    {
                        continue;
                    }

                    ApplyAssign(target, best);
                    progress = true;
                    continue; // Success, move to next slot
                }

                // AGGRESSIVE: If no direct assignment, try to FREE UP a slot by moving the current teacher
                // This is the key improvement - move teachers to free up slots for available teachers
                List<HourSlot> busySlotsAtTime = GetBusySlotsAtTime(target.Day, target.Hour);
                for (int k = 0; k < busySlotsAtTime.Count; k++)
                {
                    HourSlot busySlot = busySlotsAtTime[k];
                    if (busySlot.ClassId == target.ClassId) continue;

                    ClassTeacher busyTeacher = GetTeacherFromSlot(busySlot);
                    if (busyTeacher == null) continue;

                    // CRITICAL CHECK: busyTeacher must be in target.Candidates (TeachList)
                    bool isInTargetCandidates = false;
                    ClassTeacher busyTeacherFromTarget = null;
                    for (int checkIdx = 0; checkIdx < target.Candidates.Count; checkIdx++)
                    {
                        if (target.Candidates[checkIdx] != null && target.Candidates[checkIdx].TeacherId == busyTeacher.TeacherId)
                        {
                            isInTargetCandidates = true;
                            busyTeacherFromTarget = target.Candidates[checkIdx];
                            break;
                        }
                    }
                    if (!isInTargetCandidates) continue; // Skip teachers not in TeachList
                    
                    // Use the ClassTeacher from target.Candidates
                    busyTeacher = busyTeacherFromTarget;

                    // Check if busy teacher can be assigned to target (ignoring busy)
                    if (!CanAssignIgnoringBusy(target, busyTeacher)) continue;

                    // Try MULTIPLE alternatives for busySlot, not just one
                    if (busySlot.Candidates != null)
                    {
                        for (int altIdx = 0; altIdx < busySlot.Candidates.Count; altIdx++)
                        {
                            ClassTeacher alt = busySlot.Candidates[altIdx];
                            if (alt == null) continue;
                            if (alt.TeacherId == busyTeacher.TeacherId) continue;

                            if (!CanAssign(busySlot, alt)) continue;

                            // Save old values
                            int oldBusyTeacher = busySlot.AssignedTeacherId;
                            int oldBusyProf = busySlot.AssignedProfessionalId;
                            int oldBusyHak = busySlot.AssignedHakbatza;
                            int oldBusyIhu = busySlot.AssignedIhud;

                            // Do the swap - move busy teacher out
                            UndoAssign(busySlot);
                            ApplyAssign(busySlot, alt);

                            // Now assign target with the freed teacher
                            if (CanAssign(target, busyTeacher))
                            {
                                ApplyAssign(target, busyTeacher);
                                progress = true;
                                break; // Success, move to next target
                            }
                            else
                            {
                                // Rollback
                                UndoAssign(busySlot);
                                RestoreAssign(busySlot, oldBusyTeacher, oldBusyProf, oldBusyHak, oldBusyIhu);
                            }
                        }
                    }
                    
                    if (progress) break; // If we succeeded, move to next target
                }
            }
        }
    }

    private bool HasRemainingAnywhere(int teacherId)
    {
        foreach (string key in _remaining.Keys)
        {
            string[] parts = key.Split('_');
            if (parts.Length == 2)
            {
                int tid = SafeInt(parts[1]);
                if (tid == teacherId)
                {
                    int rem = _remaining[key];
                    if (rem > 0) return true;
                }
            }
        }
        return false;
    }

    private int FindRemainingFromOtherClass(int teacherId)
    {
        int maxRem = 0;
        foreach (string key in _remaining.Keys)
        {
            string[] parts = key.Split('_');
            if (parts.Length == 2)
            {
                int tid = SafeInt(parts[1]);
                if (tid == teacherId)
                {
                    int rem = _remaining[key];
                    if (rem > maxRem) maxRem = rem;
                }
            }
        }
        return maxRem;
    }

    private List<ClassTeacher> FindAvailableTeachersAtTime(int day, int hour, int excludeClassId)
    {
        List<ClassTeacher> result = new List<ClassTeacher>();
        HashSet<int> addedTeacherIds = new HashSet<int>();

        // Go through all slots at this time
        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot slot = _allSlots[i];
            if (slot.Day != day || slot.Hour != hour) continue;
            if (slot.ClassId == excludeClassId) continue; // Don't check the target class itself

            // Check all candidates in this slot
            if (slot.Candidates != null)
            {
                for (int j = 0; j < slot.Candidates.Count; j++)
                {
                    ClassTeacher ct = slot.Candidates[j];
                    if (ct == null) continue;
                    if (ct.TeacherId <= 0) continue;
                    if (addedTeacherIds.Contains(ct.TeacherId)) continue;

                    // Teacher is available if:
                    // 1. Not busy at this time
                    // 2. Has remaining hours somewhere
                    if (!IsBusy(ct.TeacherId, day, hour))
                    {
                        // Check if teacher has remaining in any class
                        if (HasRemainingAnywhere(ct.TeacherId))
                        {
                            result.Add(ct);
                            addedTeacherIds.Add(ct.TeacherId);
                        }
                    }
                }
            }
        }

        // Also check all teachers who have remaining hours but might not be in candidates
        // This finds teachers who work in other classes and can be moved
        foreach (string key in _remaining.Keys)
        {
            string[] parts = key.Split('_');
            if (parts.Length == 2)
            {
                int classId = SafeInt(parts[0]);
                int teacherId = SafeInt(parts[1]);
                
                if (classId == excludeClassId) continue; // Don't check target class
                if (addedTeacherIds.Contains(teacherId)) continue;
                
                int rem = _remaining[key];
                if (rem > 0 && !IsBusy(teacherId, day, hour))
                {
                    // Try to find this teacher in any slot to get full ClassTeacher object
                    ClassTeacher foundCt = FindClassTeacherForTeacher(teacherId, classId);
                    if (foundCt != null)
                    {
                        result.Add(foundCt);
                        addedTeacherIds.Add(teacherId);
                    }
                }
            }
        }

        return result;
    }

    private ClassTeacher FindClassTeacherForTeacher(int teacherId, int classId)
    {
        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot slot = _allSlots[i];
            if (slot.ClassId != classId) continue;
            if (slot.Candidates == null) continue;

            for (int j = 0; j < slot.Candidates.Count; j++)
            {
                ClassTeacher ct = slot.Candidates[j];
                if (ct != null && ct.TeacherId == teacherId)
                {
                    return ct;
                }
            }
        }
        return null;
    }

    // =========================================================
    // STEP 3: SMART SWAP (teacher busy here but can swap)
    // =========================================================
    private void SmartSwapFill(List<HourSlot> slots)
    {
        // Repeat until no progress - allow many iterations for complex swaps
        bool progress = true;
        int maxIterations = 20;
        int iteration = 0;
        
        while (progress && iteration < maxIterations)
        {
            progress = false;
            iteration++;

            // For each empty slot, find teachers who are busy at this time
            // but can be moved to another class at this time
            for (int i = 0; i < slots.Count; i++)
            {
                HourSlot target = slots[i];
                if (target.AssignedTeacherId > 0) continue;

                // CRITICAL: Only consider teachers who are in target.Candidates (TeachList)
                if (target.Candidates == null || target.Candidates.Count == 0) continue;

                // First, try to find a free teacher from candidates
                for (int j = 0; j < target.Candidates.Count; j++)
                {
                    ClassTeacher ct = target.Candidates[j];
                    if (ct == null) continue;

                    // If teacher is free, try direct assignment
                    if (!IsBusy(ct.TeacherId, target.Day, target.Hour))
                    {
                        if (CanAssign(target, ct))
                        {
                            ApplyAssign(target, ct);
                            progress = true;
                            break; // Success, move to next target
                        }
                        continue;
                    }

                    // Teacher is busy at this time - try to move them
                    // Check if teacher can be assigned here (ignoring busy)
                    if (!CanAssignIgnoringBusy(target, ct)) continue;

                    // Find where teacher is currently assigned at this time
                    HourSlot currentSlot = GetBusySlot(ct.TeacherId, target.Day, target.Hour);
                    if (currentSlot == null) continue;

                    // Try to find alternative teacher for current slot
                    // Try ALL alternatives, not just until first success
                    bool swapped = false;
                    for (int altIdx = 0; altIdx < currentSlot.Candidates.Count && !swapped; altIdx++)
                    {
                        ClassTeacher alt = currentSlot.Candidates[altIdx];
                        if (alt == null) continue;
                        if (alt.TeacherId == ct.TeacherId) continue;

                        if (CanAssign(currentSlot, alt))
                        {
                            // Save old values
                            int oldTeacher = currentSlot.AssignedTeacherId;
                            int oldProf = currentSlot.AssignedProfessionalId;
                            int oldHak = currentSlot.AssignedHakbatza;
                            int oldIhu = currentSlot.AssignedIhud;

                            // Do the swap
                            UndoAssign(currentSlot);
                            ApplyAssign(currentSlot, alt);

                            // Now assign target
                            if (CanAssign(target, ct))
                            {
                                ApplyAssign(target, ct);
                                progress = true;
                                swapped = true;
                                break; // Success, move to next target
                            }
                            else
                            {
                                // Rollback
                                UndoAssign(currentSlot);
                                RestoreAssign(currentSlot, oldTeacher, oldProf, oldHak, oldIhu);
                            }
                        }
                    }
                    
                    if (swapped) break; // Success, move to next target
                }

                // Also try to find ANY teacher busy at this time who can swap
                // CRITICAL: Only consider teachers who are in target.Candidates (TeachList)
                if (!progress && target.AssignedTeacherId <= 0)
                {
                    // First check if target has candidates
                    if (target.Candidates == null || target.Candidates.Count == 0) continue;

                    List<HourSlot> busySlotsAtTime = GetBusySlotsAtTime(target.Day, target.Hour);
                    for (int k = 0; k < busySlotsAtTime.Count; k++)
                    {
                        HourSlot busySlot = busySlotsAtTime[k];
                        if (busySlot.ClassId == target.ClassId) continue;

                        ClassTeacher busyTeacher = GetTeacherFromSlot(busySlot);
                        if (busyTeacher == null) continue;

                        // CRITICAL CHECK: busyTeacher must be in target.Candidates (TeachList)
                        bool isInTargetCandidates = false;
                        ClassTeacher busyTeacherFromTarget = null;
                        for (int checkIdx = 0; checkIdx < target.Candidates.Count; checkIdx++)
                        {
                            if (target.Candidates[checkIdx] != null && target.Candidates[checkIdx].TeacherId == busyTeacher.TeacherId)
                            {
                                isInTargetCandidates = true;
                                busyTeacherFromTarget = target.Candidates[checkIdx];
                                break;
                            }
                        }
                        if (!isInTargetCandidates) continue; // Skip teachers not in TeachList
                        
                        // Use the ClassTeacher from target.Candidates
                        busyTeacher = busyTeacherFromTarget;

                        // Check if busy teacher can be assigned to target
                        if (!CanAssignIgnoringBusy(target, busyTeacher)) continue;

                        // Check if target has a candidate that can replace busy teacher
                        for (int m = 0; m < target.Candidates.Count; m++)
                        {
                            ClassTeacher targetCandidate = target.Candidates[m];
                            if (targetCandidate == null) continue;
                            if (targetCandidate.TeacherId == busyTeacher.TeacherId) continue;

                            if (CanAssign(busySlot, targetCandidate))
                            {
                                // Swap them
                                int oldBusyTeacher = busySlot.AssignedTeacherId;
                                int oldBusyProf = busySlot.AssignedProfessionalId;
                                int oldBusyHak = busySlot.AssignedHakbatza;
                                int oldBusyIhu = busySlot.AssignedIhud;

                                UndoAssign(busySlot);
                                ApplyAssign(busySlot, targetCandidate);

                                if (CanAssign(target, busyTeacher))
                                {
                                    ApplyAssign(target, busyTeacher);
                                    progress = true;
                                    break;
                                }
                                else
                                {
                                    UndoAssign(busySlot);
                                    RestoreAssign(busySlot, oldBusyTeacher, oldBusyProf, oldBusyHak, oldBusyIhu);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private List<HourSlot> GetBusySlotsAtTime(int day, int hour)
    {
        List<HourSlot> result = new List<HourSlot>();
        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot slot = _allSlots[i];
            if (slot.Day == day && slot.Hour == hour && slot.AssignedTeacherId > 0)
            {
                result.Add(slot);
            }
        }
        return result;
    }

    private ClassTeacher GetTeacherFromSlot(HourSlot slot)
    {
        if (slot.AssignedTeacherId <= 0) return null;
        if (slot.Candidates == null) return null;

        for (int i = 0; i < slot.Candidates.Count; i++)
        {
            ClassTeacher ct = slot.Candidates[i];
            if (ct != null && ct.TeacherId == slot.AssignedTeacherId)
            {
                return ct;
            }
        }
        return null;
    }

    private ClassTeacher FindAlternativeTeacher(HourSlot slot, int excludeTeacherId)
    {
        if (slot.Candidates == null) return null;

        ClassTeacher best = null;
        int bestScore = Int32.MinValue;

        for (int i = 0; i < slot.Candidates.Count; i++)
        {
            ClassTeacher ct = slot.Candidates[i];
            if (ct == null) continue;
            if (ct.TeacherId == excludeTeacherId) continue;

            if (!CanAssign(slot, ct)) continue;

            int score = ScoreCandidate(slot, ct);
            if (best == null || score > bestScore)
            {
                best = ct;
                bestScore = score;
            }
        }

        return best;
    }

    // =========================================================
    // STEP 4: LOCAL SWAP (2-level)
    // =========================================================
    private void LocalSwapFill(List<HourSlot> slots)
    {
        // Repeat until no progress - try multiple times to catch more swaps
        bool progress = true;
        int maxIterations = 8;
        int iteration = 0;
        
        while (progress && iteration < maxIterations)
        {
            progress = false;
            iteration++;

            // for each empty slot, try:
            // candidate teacher is busy in another slot at same time,
            // move that other slot to alternative teacher, then place candidate here.
            for (int i = 0; i < slots.Count; i++)
            {
                HourSlot target = slots[i];
                if (target.AssignedTeacherId > 0) continue;

                bool solved = TryLocalSwap(target, slots);
                if (solved)
                {
                    progress = true;
                    // After successful swap, try direct fill again
                    DirectFill(slots);
                }
            }
        }
    }

    private bool TryLocalSwap(HourSlot target, List<HourSlot> sameTimeSlots)
    {
        if (target.Candidates == null) return false;

        // Try all candidates, not just the first one that works
        for (int i = 0; i < target.Candidates.Count; i++)
        {
            ClassTeacher ct = target.Candidates[i];
            if (ct == null) continue;

            // need remaining + consecutive; but teacher might be busy
            if (!CanAssignIgnoringBusy(target, ct)) continue;

            HourSlot block = GetBusySlot(ct.TeacherId, target.Day, target.Hour);
            if (block == null)
            {
                // already free -> direct would catch, but safe:
                if (CanAssign(target, ct))
                {
                    ApplyAssign(target, ct);
                    return true;
                }
                continue;
            }

            // Try multiple alternatives for block, not just the best one
            if (block.Candidates != null)
            {
                for (int altIdx = 0; altIdx < block.Candidates.Count; altIdx++)
                {
                    ClassTeacher alt = block.Candidates[altIdx];
                    if (alt == null) continue;
                    if (alt.TeacherId == ct.TeacherId) continue;

                    if (!CanAssign(block, alt)) continue;

                    // save old values before swap
                    int oldBlockTeacher = block.AssignedTeacherId;
                    int oldBlockProf = block.AssignedProfessionalId;
                    int oldBlockHak = block.AssignedHakbatza;
                    int oldBlockIhu = block.AssignedIhud;

                    // do the swap
                    UndoAssign(block);
                    ApplyAssign(block, alt);

                    // now candidate is free
                    if (CanAssign(target, ct))
                    {
                        ApplyAssign(target, ct);
                        return true;
                    }

                    // rollback if failed
                    UndoAssign(block);
                    RestoreAssign(block, oldBlockTeacher, oldBlockProf, oldBlockHak, oldBlockIhu);
                }
            }
        }

        return false;
    }

    // =========================================================
    // STEP 5: DEEP CHAIN (augmenting path up to depth 15)
    // =========================================================
    private void DeepChainFill(List<HourSlot> slots, int depth)
    {
        int visits = 0;

        for (int i = 0; i < slots.Count; i++)
        {
            if (visits > MAX_VISITS_PER_TIME) return;

            HourSlot target = slots[i];
            if (target.AssignedTeacherId > 0) continue;

            HashSet<string> seen = new HashSet<string>();
            if (TryAugment(target, depth, seen, ref visits))
            {
                // once we filled one, try fill more directly
                DirectFill(slots);
            }
        }
    }

    private bool TryAugment(HourSlot target, int depth, HashSet<string> seen, ref int visits)
    {
        if (depth <= 0) return false;
        visits++;
        if (visits > MAX_VISITS_PER_TIME) return false;

        if (target.Candidates == null) return false;

        // try best-first (rough): scan all and take best score first
        // We'll do selection by repeated picking max unused index (simple, no LINQ)
        bool[] used = new bool[target.Candidates.Count];

        for (int pick = 0; pick < target.Candidates.Count; pick++)
        {
            int bestIdx = -1;
            int bestScore = Int32.MinValue;

            for (int i = 0; i < target.Candidates.Count; i++)
            {
                if (used[i]) continue;
                ClassTeacher ct = target.Candidates[i];
                if (ct == null) continue;

                if (!CanAssignIgnoringBusy(target, ct)) continue;

                int sc = ScoreCandidate(target, ct);
                if (bestIdx < 0 || sc > bestScore)
                {
                    bestIdx = i;
                    bestScore = sc;
                }
            }

            if (bestIdx < 0) break;

            used[bestIdx] = true;
            ClassTeacher chosen = target.Candidates[bestIdx];
            if (chosen == null) continue;

            // if free, assign
            if (!IsBusy(chosen.TeacherId, target.Day, target.Hour))
            {
                if (CanAssign(target, chosen))
                {
                    ApplyAssign(target, chosen);
                    return true;
                }
                continue;
            }

            // blocked: try to move blocking slot
            HourSlot block = GetBusySlot(chosen.TeacherId, target.Day, target.Hour);
            if (block == null) continue;

            string k = "T" + chosen.TeacherId + "_D" + target.Day + "_H" + target.Hour + "_B" + block.ClassId;
            if (seen.Contains(k)) continue;
            seen.Add(k);

            // try move block away
            if (TryMoveBlock(block, chosen.TeacherId, depth - 1, seen, ref visits))
            {
                // now teacher should be free
                if (!IsBusy(chosen.TeacherId, target.Day, target.Hour) && CanAssign(target, chosen))
                {
                    ApplyAssign(target, chosen);
                    return true;
                }
            }
        }

        return false;
    }

    private bool TryMoveBlock(HourSlot block, int forbiddenTeacherId, int depth, HashSet<string> seen, ref int visits)
    {
        if (depth <= 0) return false;
        visits++;
        if (visits > MAX_VISITS_PER_TIME) return false;

        int oldTeacher = block.AssignedTeacherId;
        int oldProf = block.AssignedProfessionalId;
        int oldHak = block.AssignedHakbatza;
        int oldIhu = block.AssignedIhud;

        UndoAssign(block);

        // try assign block to alternate teacher
        if (block.Candidates != null)
        {
            for (int i = 0; i < block.Candidates.Count; i++)
            {
                ClassTeacher ct = block.Candidates[i];
                if (ct == null) continue;
                if (ct.TeacherId == forbiddenTeacherId) continue;

                if (!CanAssignIgnoringBusy(block, ct)) continue;

                if (!IsBusy(ct.TeacherId, block.Day, block.Hour))
                {
                    if (CanAssign(block, ct))
                    {
                        ApplyAssign(block, ct);
                        return true;
                    }
                    continue;
                }

                // chain further
                HourSlot next = GetBusySlot(ct.TeacherId, block.Day, block.Hour);
                if (next == null) continue;

                string kk = "M" + ct.TeacherId + "_D" + block.Day + "_H" + block.Hour + "_B" + next.ClassId;
                if (seen.Contains(kk)) continue;
                seen.Add(kk);

                if (TryMoveBlock(next, ct.TeacherId, depth - 1, seen, ref visits))
                {
                    if (!IsBusy(ct.TeacherId, block.Day, block.Hour) && CanAssign(block, ct))
                    {
                        ApplyAssign(block, ct);
                        return true;
                    }
                }
            }
        }

        // rollback
        RestoreAssign(block, oldTeacher, oldProf, oldHak, oldIhu);
        return false;
    }

    // =========================================================
    // CORE CONSTRAINTS
    // =========================================================
    private bool CanAssign(HourSlot slot, ClassTeacher ct)
    {
        // CRITICAL RULE: Teacher can ONLY be assigned if he appears in slot.Candidates (TeachList)
        // A teacher cannot be assigned to a class if he is not in that class's TeachList
        if (slot.Candidates == null || slot.Candidates.Count == 0) return false;

        // לאחר PreScheduleHakbatzas, ה-Hak כבר תוזמן ב-X שעות אטומיות. אסור
        // ל-greedy לבחור CT עם Hakbatza > 0 — זה ירחיב את ה-Hak מעבר ל-Hours
        // הנדרשים. ה-greedy ישתמש רק ב-CT solo (Hakbatza=0/null).
        if (ct.Hakbatza > 0 && _hakbatzaMeta.Count > 0) return false;

        bool isInCandidates = false;
        for (int i = 0; i < slot.Candidates.Count; i++)
        {
            if (slot.Candidates[i] != null && slot.Candidates[i].TeacherId == ct.TeacherId)
            {
                isInCandidates = true;
                break;
            }
        }
        if (!isInCandidates) return false; // Teacher not in TeachList - CANNOT assign

        // NEW SEMANTIC (אפריל 2026): שורה ב-TeacherHours = שעה חסומה / פרטני / שהייה.
        // המורה אינו יכול ללמד בשעה זו — דלג עליה בשיבוץ אוטומטי.
        if (IsTeacherBlockedAtHour(ct.TeacherId, slot.HourId)) return false;
        
        // Ensure remaining hours are initialized for this teacher/class combination.
        // NOTE: BuildModel already SUMs ct.LastTeacherHoursInClass across multiple
        // ClassTeacher rows for the same (Class, Teacher) pair (e.g. solo Hour=3 +
        // solo Hour=1 = total 4 hours required). We MUST NOT downgrade it here.
        // The previous "MIN when key exists" logic caused the engine to leave
        // empty cells when a teacher had multiple solo ClassTeacher rows.
        string rk = Key(slot.ClassId, ct.TeacherId);
        if (!_remaining.ContainsKey(rk))
        {
            int remainingHours = ct.LastTeacherHoursInClass;
            if (remainingHours <= 0) remainingHours = 1;
            _remaining[rk] = remainingHours;
        }
        // else: trust the SUM from BuildModel — don't overwrite.

        // Now check if teacher has remaining hours
        int rem = _remaining[rk];
        if (rem <= 0) return false;

        if (IsBusy(ct.TeacherId, slot.Day, slot.Hour)) return false;
        if (WouldBreakConsecutive(ct.TeacherId, slot.Day, slot.Hour)) return false;

        // Strong rule: homeroom stays in home class while home has remaining
        if (IsHomeroomLockedToHome(slot, ct)) return false;

        // Hakbatza atomicity: if ct is part of a Hakbatza, every other class
        // in the same Hak must accept the same teacher at the same hour. If
        // any partner class can't be propagated to (slot taken by a different
        // teacher / no slot exists / partner has 0 remaining for own class /
        // partner busy elsewhere at this hour), the whole assignment is
        // rejected — otherwise we end up with split Hakbatza like the case
        // of חיים אזרד running in different hours in עדי vs שמרית.
        if (ct.Hakbatza > 0 && !CanPropagateHakbatza(slot, ct)) return false;

        return true;
    }

    // Post-pass: לכל תא ריק, חפש מורה ב-Candidates שיש לו עוד remaining
    // **לכיתה הזו** (ולא חרג מהמכסה), לא busy בשעה, לא ב-FreeDay, לא חסום
    // ב-TeacherHours. אם הדטא לא הגיונית (under-demand גלובלי) — לא נשבץ
    // (תא יישאר ריק, וה-PreCheck יציג את האזהרה).
    private void FillEmptyByGlobalShortage()
    {
        // חישוב Got_total ו-Req_total לכל מורה
        Dictionary<int, int> gotTotal = new Dictionary<int, int>();
        Dictionary<int, int> reqTotal = new Dictionary<int, int>();
        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot s = _allSlots[i];
            if (s.AssignedTeacherId > 0)
            {
                int tid = s.AssignedTeacherId;
                if (gotTotal.ContainsKey(tid)) gotTotal[tid]++;
                else gotTotal[tid] = 1;
            }
        }
        // _extraAssignments גם נספרים
        foreach (var kv in _extraAssignments)
        {
            int tid = kv.Value.TeacherId;
            if (gotTotal.ContainsKey(tid)) gotTotal[tid]++;
            else gotTotal[tid] = 1;
        }
        // Req: solo + Hak.Hours + extras
        try
        {
            DataTable dtReq = Dal.GetDataTable(
                "SELECT t.TeacherId, " +
                "ISNULL((SELECT SUM(ct.Hour) FROM ClassTeacher ct WHERE ct.ConfigurationId=" + _configurationId +
                " AND ct.TeacherId=t.TeacherId AND ct.Hour > 0 AND ct.HakbatzaId IS NULL),0) " +
                "+ ISNULL((SELECT SUM(ht.HoursContribution) FROM HakbatzaTeacher ht INNER JOIN Hakbatza h ON h.HakbatzaId=ht.HakbatzaId " +
                "WHERE h.ConfigurationId=" + _configurationId + " AND ht.TeacherId=t.TeacherId),0) " +
                "+ ISNULL((SELECT SUM(ct.Hour - h.Hours) FROM ClassTeacher ct INNER JOIN Hakbatza h ON h.HakbatzaId=ct.HakbatzaId " +
                "WHERE ct.ConfigurationId=" + _configurationId + " AND ct.TeacherId=t.TeacherId AND ct.Hour > h.Hours),0) AS Req " +
                "FROM Teacher t WHERE t.ConfigurationId=" + _configurationId);
            for (int i = 0; i < dtReq.Rows.Count; i++)
            {
                int tid = ToInt(dtReq.Rows[i]["TeacherId"]);
                int rq = ToInt(dtReq.Rows[i]["Req"]);
                if (tid > 0) reqTotal[tid] = rq;
            }
        }
        catch { return; }

        // חישוב got_in_class פר (T,C)
        Dictionary<string, int> gotInClass = new Dictionary<string, int>();
        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot s = _allSlots[i];
            if (s.AssignedTeacherId > 0)
            {
                string k = Key(s.ClassId, s.AssignedTeacherId);
                if (gotInClass.ContainsKey(k)) gotInClass[k]++;
                else gotInClass[k] = 1;
            }
        }
        // חישוב req_in_class פר (T,C) מ-CT
        Dictionary<string, int> reqInClass = new Dictionary<string, int>();
        try
        {
            DataTable dtReqC = Dal.GetDataTable(
                "SELECT TeacherId, ClassId, ISNULL(SUM(Hour),0) AS Req FROM ClassTeacher " +
                "WHERE ConfigurationId=" + _configurationId + " AND Hour > 0 GROUP BY TeacherId, ClassId");
            for (int i = 0; i < dtReqC.Rows.Count; i++)
            {
                int tid = ToInt(dtReqC.Rows[i]["TeacherId"]);
                int cid = ToInt(dtReqC.Rows[i]["ClassId"]);
                int rq = ToInt(dtReqC.Rows[i]["Req"]);
                if (tid > 0 && cid > 0) reqInClass[Key(cid, tid)] = rq;
            }
        }
        catch { return; }

        // לכל תא ריק, מצא מורה שעוד לא הגיע ל-req גלובלי וב-class
        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot s = _allSlots[i];
            if (s.AssignedTeacherId > 0) continue;
            if (s.Candidates == null) continue;
            ClassTeacher chosen = null;
            int bestShort = 0;
            for (int k = 0; k < s.Candidates.Count; k++)
            {
                ClassTeacher cand = s.Candidates[k];
                if (cand == null) continue;
                // got_in_class < req_in_class
                string rkLocal = Key(s.ClassId, cand.TeacherId);
                int gotC = 0;
                gotInClass.TryGetValue(rkLocal, out gotC);
                int reqC = 0;
                reqInClass.TryGetValue(rkLocal, out reqC);
                if (gotC >= reqC) continue; // המורה השלים בכיתה
                // got_total < req_total
                int got;
                if (!gotTotal.TryGetValue(cand.TeacherId, out got)) got = 0;
                int req;
                if (!reqTotal.TryGetValue(cand.TeacherId, out req)) req = 0;
                int shortage = req - got;
                if (shortage <= 0) continue;
                int fd;
                if (_teacherFreeDay.TryGetValue(cand.TeacherId, out fd) && fd > 0 && fd == s.Day) continue;
                if (IsTeacherBlockedAtHour(cand.TeacherId, s.HourId)) continue;
                if (IsBusy(cand.TeacherId, s.Day, s.Hour)) continue;
                if (IsHomeroomLockedToHome(s, cand)) continue;
                if (shortage > bestShort) { chosen = cand; bestShort = shortage; }
            }
            if (chosen == null) continue;
            s.AssignedTeacherId = chosen.TeacherId;
            s.AssignedProfessionalId = chosen.ProfessionalId;
            s.AssignedHakbatza = 0;
            s.AssignedIhud = 0;
            SetBusy(chosen.TeacherId, s.Day, s.Hour, s);
            GetDaySet(chosen.TeacherId, s.Day).Add(s.Hour);
            IncClassDayCount(chosen.TeacherId, s.ClassId, s.Day, +1);
            string rkPick = Key(s.ClassId, chosen.TeacherId);
            if (gotInClass.ContainsKey(rkPick)) gotInClass[rkPick]++;
            else gotInClass[rkPick] = 1;
            if (gotTotal.ContainsKey(chosen.TeacherId)) gotTotal[chosen.TeacherId]++;
            else gotTotal[chosen.TeacherId] = 1;
        }
    }

    // PreScheduleHakbatzas: לפני ה-greedy, משבץ כל הקבצה כיחידה אטומית.
    // משתמש ב-`_hakbatzaMeta` (נטען מטבלת Hakbatza החדשה) שמספק:
    //   Hours: אורך ההקבצה (X = כמה שעות הקבצה רצה)
    //   Mode: bijection / partial / simple
    //   Classes/Teachers: רשימות מפורשות
    //
    // לכל הקבצה: בוחר X שעות שב-כולן יש slot פנוי בכל הכיתות, וכל המורים
    // זמינים (לא FreeDay, לא TeacherHours-blocked, לא busy מהקבצה אחרת).
    // בכל שעה: bijection (ה-Mode קובע אם מלא או חלקי).
    // הקבצות נסרקות לפי גודל יורד (פחות גמישות → ראשונה).
    private void PreScheduleHakbatzas()
    {
        // אם אין meta — fallback להתנהגות ישנה (לא רץ)
        if (_hakbatzaMeta.Count == 0) return;

        // מיון: partial/bijection ראשונים (יותר מגביל), אחר-כך לפי גודל
        List<string> gkeys = new List<string>(_hakbatzaMeta.Keys);
        gkeys.Sort((a, b) => {
            HakbatzaMeta ma = _hakbatzaMeta[a], mb = _hakbatzaMeta[b];
            int pa = (ma.Mode == "partial") ? 0 : (ma.Mode == "bijection") ? 1 : 2;
            int pb = (mb.Mode == "partial") ? 0 : (mb.Mode == "bijection") ? 1 : 2;
            if (pa != pb) return pa.CompareTo(pb);
            int sa = ma.Classes.Count + ma.Teachers.Count;
            int sb = mb.Classes.Count + mb.Teachers.Count;
            return sb.CompareTo(sa);
        });

        for (int gi = 0; gi < gkeys.Count; gi++)
        {
            string gkey = gkeys[gi];
            HakbatzaMeta meta = _hakbatzaMeta[gkey];
            int X = meta.Hours;
            HashSet<int> Cset = new HashSet<int>(meta.Classes);
            HashSet<int> Tset = new HashSet<int>(meta.Teachers);
            if (X <= 0 || Cset.Count == 0 || Tset.Count == 0) continue;
            // מצא group records (לקבל ClassTeacher לכל זוג מורה-כיתה)
            List<ClassTeacher> group;
            if (!_hakbatzaGroups.TryGetValue(gkey, out group) || group == null || group.Count == 0) continue;

            // אטומיות הקבצה: לאחר שה-PreSchedule משבץ X שעות, ה-greedy לא
            // אמור להוסיף עוד שעות הקבצה (כי הקבצה רצה רק X שעות לפי המודל).
            // בלי זה, _remaining[T,C]>0 גורם ל-greedy להמשיך ולשבץ את אותם
            // CT records של Hak בעוד שעות — והופך הקבצה של 3 שעות ל-6 שעות
            // בלוח. אאפס _remaining[T,C] אחרי השיבוץ למטה.

            // איסוף כל ה-slots פוטנציאליים ב-Cset (אחרי שעה 1 של מחנכים).
            // נארגן לפי HourId ⇒ List<HourSlot> פר Cset.
            Dictionary<int, List<HourSlot>> slotsByHourId = new Dictionary<int, List<HourSlot>>();
            for (int i = 0; i < _allSlots.Count; i++)
            {
                HourSlot s = _allSlots[i];
                if (!Cset.Contains(s.ClassId)) continue;
                if (s.AssignedTeacherId > 0) continue; // כבר תפוס (Hour 1 / קבצה קודמת)
                List<HourSlot> list;
                if (!slotsByHourId.TryGetValue(s.HourId, out list))
                {
                    list = new List<HourSlot>();
                    slotsByHourId[s.HourId] = list;
                }
                list.Add(s);
            }

            // כל HourId ב-slotsByHourId שמכיל slot לכל אחת מ-Cset, וכל מורי Tset
            // זמינים בה (לא FreeDay, לא blocked, לא busy)
            List<int> validHourIds = new List<int>();
            foreach (int hourId in slotsByHourId.Keys)
            {
                List<HourSlot> list = slotsByHourId[hourId];
                if (list.Count < Cset.Count) continue; // לא כל הכיתות מיוצגות
                int day = hourId / 10;
                int hour = hourId % 10;
                // לפחות |Cset| מורים מ-Tset זמינים בשעה הזו
                int avail = 0;
                foreach (int tid in Tset)
                {
                    int fd;
                    if (_teacherFreeDay.TryGetValue(tid, out fd) && fd > 0 && fd == day) continue;
                    if (IsTeacherBlockedAtHour(tid, hourId)) continue;
                    if (IsBusy(tid, day, hour)) continue;
                    avail++;
                }
                if (avail >= Cset.Count) validHourIds.Add(hourId);
            }
            if (validHourIds.Count < X) continue; // לא ניתן לתזמן את ההקבצה אטומית
            // לוקחים את X השעות הראשונות (סדר עולה ⇒ עדיפות לבוקר), אבל מדלגים
            // על שעות ש-bijection חלקי בהן יקרה. אטומיות: או מתזמנים את כל
            // הכיתות בשעה הזו, או אף אחת.
            validHourIds.Sort();
            int scheduled = 0;
            // counter שעוקב אחר כמות השיבוצים שכל מורה כבר קיבל ב-Hak הזה.
            // משמש לrotation מאוזן (לא לתת תמיד לאותו ראשון).
            Dictionary<int, int> hakAssignedCount = new Dictionary<int, int>();
            for (int hiIdx = 0; hiIdx < validHourIds.Count && scheduled < X; hiIdx++)
            {
                int hourId = validHourIds[hiIdx];
                int day = hourId / 10;
                int hour = hourId % 10;
                List<HourSlot> list = slotsByHourId[hourId];
                // pre-flight: לוודא ש-bijection מלא אפשרי בשעה הזו לפני שיבוץ
                bool canSchedule = true;
                {
                    HashSet<int> trial = new HashSet<int>();
                    foreach (HourSlot s in list)
                    {
                        if (s.AssignedTeacherId > 0) { canSchedule = false; break; }
                        bool found = false;
                        if (s.Candidates != null)
                        {
                            for (int k = 0; k < s.Candidates.Count; k++)
                            {
                                ClassTeacher cand = s.Candidates[k];
                                if (cand == null) continue;
                                if (!Tset.Contains(cand.TeacherId)) continue;
                                if (GetGroupKey(cand) != gkey) continue;
                                if (trial.Contains(cand.TeacherId)) continue;
                                int fd2;
                                if (_teacherFreeDay.TryGetValue(cand.TeacherId, out fd2) && fd2 > 0 && fd2 == day) continue;
                                if (IsTeacherBlockedAtHour(cand.TeacherId, hourId)) continue;
                                if (IsBusy(cand.TeacherId, day, hour)) continue;
                                string rk2 = Key(s.ClassId, cand.TeacherId);
                                int rem2;
                                if (!_remaining.TryGetValue(rk2, out rem2) || rem2 <= 0) continue;
                                if (IsHomeroomLockedToHome(s, cand)) continue;
                                trial.Add(cand.TeacherId);
                                found = true;
                                break;
                            }
                        }
                        if (!found) { canSchedule = false; break; }
                    }
                }
                // pre-flight אינו חוסם — שיבוץ אופטימי. כל מה שלא יסתדר
                // יישאר ל-greedy או ל-extras בpartial.
                scheduled++;
                HashSet<int> usedTeachers = new HashSet<int>();
                foreach (HourSlot s in list)
                {
                    if (s.AssignedTeacherId > 0) continue;
                    // round-robin אמיתי: בחירת מורה עם הכי מעט שיבוצי Hak (מ-meta.TeacherHours) שכבר קיבל בHak זה.
                    ClassTeacher chosen = null;
                    int bestPriority = Int32.MaxValue;
                    if (s.Candidates != null)
                    {
                        for (int k = 0; k < s.Candidates.Count; k++)
                        {
                            ClassTeacher cand = s.Candidates[k];
                            if (cand == null) continue;
                            if (!Tset.Contains(cand.TeacherId)) continue;
                            string ckey = GetGroupKey(cand);
                            if (ckey != gkey) continue;
                            if (usedTeachers.Contains(cand.TeacherId)) continue;
                            int fd;
                            if (_teacherFreeDay.TryGetValue(cand.TeacherId, out fd) && fd > 0 && fd == day) continue;
                            if (IsTeacherBlockedAtHour(cand.TeacherId, hourId)) continue;
                            if (IsBusy(cand.TeacherId, day, hour)) continue;
                            string rk = Key(s.ClassId, cand.TeacherId);
                            int rem;
                            if (!_remaining.TryGetValue(rk, out rem) || rem <= 0) continue;
                            if (IsHomeroomLockedToHome(s, cand)) continue;
                            int hakDone;
                            if (!hakAssignedCount.TryGetValue(cand.TeacherId, out hakDone)) hakDone = 0;
                            int contrib;
                            if (!meta.TeacherHours.TryGetValue(cand.TeacherId, out contrib)) contrib = 0;
                            // אם המורה כבר השלים את חלקו ב-Hak — אסור עוד
                            if (hakDone >= contrib) continue;
                            // בחר מי שעוד צריך לקבל הכי הרבה (priority הכי נמוך)
                            int priority = hakDone - contrib;
                            if (priority < bestPriority) { chosen = cand; bestPriority = priority; }
                        }
                    }
                    if (chosen == null) continue;
                    // שיבוץ ישיר (לא דרך ApplyAssign — נעקוף את ApplyHakbatzaPropagation
                    // כי כאן אנחנו ה-scheduler עצמו)
                    s.AssignedTeacherId = chosen.TeacherId;
                    s.AssignedProfessionalId = chosen.ProfessionalId;
                    s.AssignedHakbatza = chosen.Hakbatza;
                    s.AssignedIhud = chosen.Ihud;
                    string rk2 = Key(s.ClassId, chosen.TeacherId);
                    if (_remaining.ContainsKey(rk2) && _remaining[rk2] > 0)
                        _remaining[rk2] = _remaining[rk2] - 1;
                    GetDaySet(chosen.TeacherId, day).Add(hour);
                    SetBusy(chosen.TeacherId, day, hour, s);
                    IncClassDayCount(chosen.TeacherId, s.ClassId, day, +1);
                    usedTeachers.Add(chosen.TeacherId);
                    // עדכון counter rotation
                    if (hakAssignedCount.ContainsKey(chosen.TeacherId)) hakAssignedCount[chosen.TeacherId]++;
                    else hakAssignedCount[chosen.TeacherId] = 1;
                }

                // הערה: הוסר extras code — היה גורם ל-over-assignment של מורים
                // ב-bijection mode וגם איטי. בpartial mode, חוסר-מורים שאינם
                // ב-bijection הוא "פיצול אמיתי" של ה-data model (3 מורים, 2
                // כיתות) — לא ניתן לכפר בו בלי לחרוג מ-Required של מורה אחר.
            }

            // לאחר שיבוץ X שעות הקבצה אטומיות, לאפס _remaining של ה-Hak —
            // אבל לשמור את הסולו של אותו (T,C) אם קיים. אחרת ה-greedy ימשיך
            // לשבץ Hak בעוד שעות (הופך הקבצה של 3 שעות ל-6 שעות בלוח).
            foreach (ClassTeacher cttHak in group)
            {
                if (cttHak == null) continue;
                string rkHak = Key(cttHak.ClassId, cttHak.TeacherId);
                if (!_remaining.ContainsKey(rkHak)) continue;
                int soloHrs = 0;
                string sk = cttHak.ClassId + "_" + cttHak.TeacherId;
                _soloHours.TryGetValue(sk, out soloHrs);
                _remaining[rkHak] = soloHrs;
            }
        }
    }

    // אטומיות הקבצה — מחזיר List of (partnerClassId, partnerCT) אם ניתן
    // ליצור bijection מלא: בכל כיתה אחרת בקבצה (חוץ מ-slot.ClassId) יש
    // partner-teacher **שונה** (לא ct.TeacherId, ולא teacher כבר committed)
    // שזמין ב-slot.HourId (לא FreeDay, לא TeacherHours-blocked, לא busy,
    // יש לו remaining בכיתה הספציפית). מחזיר null אם לא ניתן.
    // משמש את CanAssign (כבדיקה) ו-ApplyHakbatzaPropagation (לביצוע) —
    // שתיהן קוראות לפונקציה זו כדי לוודא ש-CanAssign וה-Apply עקביים.
    private List<KeyValuePair<int, ClassTeacher>> TryFindHakbatzaBijection(HourSlot slot, ClassTeacher ct)
    {
        string gkey = GetGroupKey(ct);
        if (gkey == null) return new List<KeyValuePair<int, ClassTeacher>>();
        List<ClassTeacher> group;
        if (!_hakbatzaGroups.TryGetValue(gkey, out group) || group == null)
            return new List<KeyValuePair<int, ClassTeacher>>();

        HashSet<int> partnerClasses = new HashSet<int>();
        for (int i = 0; i < group.Count; i++)
        {
            ClassTeacher g = group[i];
            if (g == null) continue;
            if (g.ClassId == slot.ClassId) continue;
            partnerClasses.Add(g.ClassId);
        }
        if (partnerClasses.Count == 0)
            return new List<KeyValuePair<int, ClassTeacher>>();

        // committed: מורים שכבר תפוסים ב-bijection (mainSlot ו-partner שנבחרו)
        HashSet<int> committed = new HashSet<int>();
        committed.Add(ct.TeacherId);
        List<KeyValuePair<int, ClassTeacher>> result = new List<KeyValuePair<int, ClassTeacher>>();

        foreach (int pClassId in partnerClasses)
        {
            HourSlot pSlot = FindSlot(pClassId, slot.Day, slot.Hour);
            // אם אין slot — נדלג (לא חוסם, אך לא נתרום ל-bijection)
            if (pSlot == null) continue;
            // אם כבר משובץ ע"י מישהו — אם זה ct או partner, OK; אחרת חוסם
            if (pSlot.AssignedTeacherId > 0)
            {
                if (pSlot.AssignedTeacherId == ct.TeacherId) return null;
                // already taken — לא ניתן להוסיף בו hakbatza partner שונה
                // אבל הקבצה עדיין רצה (השיבוץ הזה לא תופס את ה-Hak בכיתה הזו)
                // אז זה ok — לא נוסיף partner לכיתה הזו, אבל גם לא ניכשל
                continue;
            }
            // חיפוש partner מ-group ל-pClassId שלא committed וזמין
            ClassTeacher chosen = null;
            for (int i = 0; i < group.Count; i++)
            {
                ClassTeacher g = group[i];
                if (g == null || g.ClassId != pClassId) continue;
                if (committed.Contains(g.TeacherId)) continue;
                int pFD;
                if (_teacherFreeDay.TryGetValue(g.TeacherId, out pFD) && pFD > 0 && pFD == slot.Day) continue;
                if (IsTeacherBlockedAtHour(g.TeacherId, slot.HourId)) continue;
                if (IsBusy(g.TeacherId, slot.Day, slot.Hour)) continue;
                string rkP = Key(pClassId, g.TeacherId);
                int remP;
                if (!_remaining.TryGetValue(rkP, out remP) || remP <= 0) continue;
                if (IsHomeroomLockedToHome(pSlot, g)) continue;
                // verify in pSlot.Candidates
                bool inCand = false;
                if (pSlot.Candidates != null)
                {
                    for (int k = 0; k < pSlot.Candidates.Count; k++)
                    {
                        ClassTeacher cand = pSlot.Candidates[k];
                        if (cand != null && cand.TeacherId == g.TeacherId
                            && cand.Hakbatza == g.Hakbatza)
                        { inCand = true; break; }
                    }
                }
                if (!inCand) continue;
                chosen = g;
                break;
            }
            if (chosen == null) return null; // bijection לא אפשרי
            committed.Add(chosen.TeacherId);
            result.Add(new KeyValuePair<int, ClassTeacher>(pClassId, chosen));
        }
        return result;
    }

    private bool CanPropagateHakbatza(HourSlot slot, ClassTeacher ct)
    {
        // לאחר PreScheduleHakbatzas, המעגל הראשי לא משבץ Hak (כי כל הHak slots
        // כבר תפוסים). אם בכל-זאת ה-greedy מנסה, אנו לא חוסמים — Apply יבדוק.
        return true;
    }

    private bool CanAssignIgnoringBusy(HourSlot slot, ClassTeacher ct)
    {
        // Check if has remaining in target class OR anywhere
        bool hasRemainingInTarget = HasRemaining(slot.ClassId, ct.TeacherId);
        bool hasRemainingAnywhere = HasRemainingAnywhere(ct.TeacherId);

        if (!hasRemainingInTarget && !hasRemainingAnywhere) return false;
        if (WouldBreakConsecutive(ct.TeacherId, slot.Day, slot.Hour)) return false;

        if (IsHomeroomLockedToHome(slot, ct)) return false;

        // NEW SEMANTIC (אפריל 2026): TeacherHours = שעה חסומה / פרטני / שהייה.
        // גם בהזזת מורים פנויים, אסור להעביר מורה לשעה שהוא חסום בה.
        if (IsTeacherBlockedAtHour(ct.TeacherId, slot.HourId)) return false;

        return true;
    }

    // SP Assign_GetDataForAssignAuto Table 2 מחזיר רשימה **פוזיטיבית** של
    // שעות שהמורה יכול לעבוד (אחרי סינון TeacherHours חסומות + יום חופשי).
    // לכן: השעה חסומה אם היא לא נמצאת ברשימה הזמינה של המורה.
    private bool IsTeacherBlockedAtHour(int teacherId, int hourId)
    {
        if (_teacherWorkingHours == null || _teacherWorkingHours.Count == 0)
            return false; // אין נתונים בכלל — לא חוסמים (תאימות לאחור)
        HashSet<int> set;
        if (!_teacherWorkingHours.TryGetValue(teacherId, out set))
            return false; // אין נתונים על המורה — לא חוסמים
        return !set.Contains(hourId); // השעה לא ברשימה הזמינה ⇒ חסומה
    }

    private bool HasRemaining(int classId, int teacherId)
    {
        // STRICT: A teacher has remaining hours for THIS class only if they were
        // contracted to teach it (ClassTeacher.Hour > 0 OR Hakbatza/Ihud member).
        // BuildModel only adds rk entries for valid (Class,Teacher) pairs, so a
        // missing key means "not contracted to teach this class" — return false.
        // Falling back to HasRemainingAnywhere produces over-fill (false-100%).
        string rk = Key(classId, teacherId);
        int rem;
        if (!_remaining.TryGetValue(rk, out rem)) return false;
        return rem > 0;
    }

    private bool IsHomeroomLockedToHome(HourSlot slot, ClassTeacher ct)
    {
        if (ct.TafkidId != 1) return false;

        int home;
        if (!_homeClassByTeacher.TryGetValue(ct.TeacherId, out home))
            return false;

        if (home == slot.ClassId) return false;

        int homeRem;
        if (_remaining.TryGetValue(Key(home, ct.TeacherId), out homeRem) && homeRem > 0)
            return true;

        return false;
    }

    private bool WouldBreakConsecutive(int teacherId, int day, int hour)
    {
        HashSet<int> set = GetDaySet(teacherId, day);

        // Count consecutive hours including the current hour
        int count = 1; // Start with current hour
        
        // Count backwards
        for (int h = hour - 1; h > 0 && set.Contains(h); h--) 
        {
            count++;
        }
        
        // Count forwards
        for (int h = hour + 1; h < 30 && set.Contains(h); h++) 
        {
            count++;
        }

        // Only block if it would exceed the limit
        // MAX_CONSECUTIVE is 15, so this should rarely block
        return count > MAX_CONSECUTIVE;
    }

    // הצופה כמה שעות כבר משובץ למורה ת בכיתה ק ביום י. משמש את ScoreCandidate
    // לעודד פיזור שעות לאורך השבוע במקום ריכוזן ביום אחד.
    private int GetClassDayCount(int teacherId, int classId, int day)
    {
        Dictionary<int, Dictionary<int, int>> classMap;
        if (!_teacherClassDayCount.TryGetValue(teacherId, out classMap)) return 0;
        Dictionary<int, int> dayMap;
        if (!classMap.TryGetValue(classId, out dayMap)) return 0;
        int n;
        return dayMap.TryGetValue(day, out n) ? n : 0;
    }

    private void IncClassDayCount(int teacherId, int classId, int day, int delta)
    {
        Dictionary<int, Dictionary<int, int>> classMap;
        if (!_teacherClassDayCount.TryGetValue(teacherId, out classMap))
        {
            classMap = new Dictionary<int, Dictionary<int, int>>();
            _teacherClassDayCount[teacherId] = classMap;
        }
        Dictionary<int, int> dayMap;
        if (!classMap.TryGetValue(classId, out dayMap))
        {
            dayMap = new Dictionary<int, int>();
            classMap[classId] = dayMap;
        }
        int cur;
        dayMap.TryGetValue(day, out cur);
        int next = cur + delta;
        if (next <= 0) dayMap.Remove(day);
        else dayMap[day] = next;
    }

    private HashSet<int> GetDaySet(int teacherId, int day)
    {
        Dictionary<int, HashSet<int>> dayMap;
        if (!_teacherDayHours.TryGetValue(teacherId, out dayMap))
        {
            dayMap = new Dictionary<int, HashSet<int>>();
            _teacherDayHours[teacherId] = dayMap;
        }

        HashSet<int> set;
        if (!dayMap.TryGetValue(day, out set))
        {
            set = new HashSet<int>();
            dayMap[day] = set;
        }

        return set;
    }

    // =========================================================
    // BUSY MAP (no double booking)
    // =========================================================
    private bool IsBusy(int teacherId, int day, int hour)
    {
        Dictionary<int, Dictionary<int, HourSlot>> dmap;
        if (!_busy.TryGetValue(teacherId, out dmap)) return false;

        Dictionary<int, HourSlot> hmap;
        if (!dmap.TryGetValue(day, out hmap)) return false;

        return hmap.ContainsKey(hour);
    }

    private HourSlot GetBusySlot(int teacherId, int day, int hour)
    {
        Dictionary<int, Dictionary<int, HourSlot>> dmap;
        if (!_busy.TryGetValue(teacherId, out dmap)) return null;

        Dictionary<int, HourSlot> hmap;
        if (!dmap.TryGetValue(day, out hmap)) return null;

        HourSlot s;
        if (!hmap.TryGetValue(hour, out s)) return null;
        return s;
    }

    private void SetBusy(int teacherId, int day, int hour, HourSlot slot)
    {
        Dictionary<int, Dictionary<int, HourSlot>> dmap;
        if (!_busy.TryGetValue(teacherId, out dmap))
        {
            dmap = new Dictionary<int, Dictionary<int, HourSlot>>();
            _busy[teacherId] = dmap;
        }

        Dictionary<int, HourSlot> hmap;
        if (!dmap.TryGetValue(day, out hmap))
        {
            hmap = new Dictionary<int, HourSlot>();
            dmap[day] = hmap;
        }

        hmap[hour] = slot;
    }

    private void ClearBusy(int teacherId, int day, int hour)
    {
        Dictionary<int, Dictionary<int, HourSlot>> dmap;
        if (!_busy.TryGetValue(teacherId, out dmap)) return;

        Dictionary<int, HourSlot> hmap;
        if (!dmap.TryGetValue(day, out hmap)) return;

        if (hmap.ContainsKey(hour))
            hmap.Remove(hour);
    }

    // =========================================================
    // APPLY / UNDO / RESTORE
    // =========================================================
    private static string GetHomeroomLogPath()
    {
        try
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            if (string.IsNullOrEmpty(baseDir)) return @"c:\Dev\Sganit\shibutz_homeroom_log.txt";
            string projectDir = Path.GetDirectoryName(baseDir.TrimEnd('\\', '/'));
            if (string.IsNullOrEmpty(projectDir)) return Path.Combine(baseDir, "shibutz_homeroom_log.txt");
            return Path.Combine(projectDir, "shibutz_homeroom_log.txt");
        }
        catch { return @"c:\Dev\Sganit\shibutz_homeroom_log.txt"; }
    }

    private static void LogHomeroom(string msg)
    {
        try
        {
            File.AppendAllText(GetHomeroomLogPath(), DateTime.Now.ToString("HH:mm:ss") + " " + msg + "\r\n");
        }
        catch { }
    }

    private bool IsHomeroomForSlot(HourSlot slot, int teacherId)
    {
        // Day-opener (Hour 1) is reserved for the registered homeroom only.
        // ManageClassId == ClassId is the single source of truth; we no
        // longer fall back to "the TafkidId=1 teacher with the most hours".
        if (slot.Hour != 1 || slot.Candidates == null) return false;
        for (int i = 0; i < slot.Candidates.Count; i++)
        {
            ClassTeacher ct = slot.Candidates[i];
            if (ct != null && ct.TeacherId == teacherId)
            {
                return ct.ManageClassId == slot.ClassId;
            }
        }
        return false;
    }

    private void ApplyAssign(HourSlot slot, ClassTeacher ct)
    {
        if (slot.Candidates == null || slot.Candidates.Count == 0) return;

        // CRITICAL: Never overwrite homeroom at hour 1 (swaps can try to replace them!)
        if (slot.Hour == 1 && slot.AssignedTeacherId > 0 && IsHomeroomForSlot(slot, slot.AssignedTeacherId))
        {
            LogHomeroom(string.Format("ApplyAssign BLOCKED: Class {0} Day {1} - would overwrite homeroom T{2} with T{3}", slot.ClassId, slot.Day, slot.AssignedTeacherId, ct.TeacherId));
            return;
        }

        // STRICT: hour 1 is the day opener — reserved for the registered
        // homeroom (or a subject teacher if the homeroom has no remaining
        // hours). NEVER let a homeroom-of-another-class open this class —
        // that's the pedagogical violation the user asked us to prevent.
        if (slot.Hour == 1 && ct.TafkidId == 1 && ct.ManageClassId != slot.ClassId)
        {
            LogHomeroom(string.Format("ApplyAssign BLOCKED (hour1): T{0} manages class {1}, not {2}", ct.TeacherId, ct.ManageClassId, slot.ClassId));
            return;
        }

        // CRITICAL: Never let a homeroom teacher land in a class that isn't their
        // home while their home class still has remaining hours. Even if a caller
        // (swap chain / fill-empty) skipped CanAssign, this guard fires on the
        // raw write so the homeroom finishes their own contract before fanning out.
        if (IsHomeroomLockedToHome(slot, ct)) return;

        // CRITICAL: Never over-assign - block if no remaining hours
        string rkCheck = Key(slot.ClassId, ct.TeacherId);
        if (_remaining.ContainsKey(rkCheck) && _remaining[rkCheck] <= 0) return;
        
        bool isInCandidates = false;
        for (int i = 0; i < slot.Candidates.Count; i++)
        {
            if (slot.Candidates[i] != null && slot.Candidates[i].TeacherId == ct.TeacherId)
            {
                isInCandidates = true;
                break;
            }
        }
        if (!isInCandidates) return; // Teacher not in TeachList - DO NOT assign
        
        // CanAssign already checked everything - just assign
        slot.AssignedTeacherId = ct.TeacherId;
        slot.AssignedProfessionalId = ct.ProfessionalId;
        slot.AssignedHakbatza = ct.Hakbatza;
        slot.AssignedIhud = ct.Ihud;

        string rk = Key(slot.ClassId, ct.TeacherId);
        if (_remaining.ContainsKey(rk) && _remaining[rk] > 0)
        {
            _remaining[rk] = _remaining[rk] - 1;
        }

        GetDaySet(ct.TeacherId, slot.Day).Add(slot.Hour);
        SetBusy(ct.TeacherId, slot.Day, slot.Hour, slot);
        IncClassDayCount(ct.TeacherId, slot.ClassId, slot.Day, +1);

        // Hakbatza propagation בוצע ב-PreScheduleHakbatzas לפני המעגל הראשי.
        // כאן ApplyAssign של hakbatza-slot יקרה רק אם ה-greedy מנסה לשבץ
        // hakbatza שלא תוזמנה (כיתה אחת בלבד) — הוא ימולא בלי propagation.
    }

    // מפיצה את הקבצת ct לכל ה-partners ב-_hakbatzaGroups[gkey]. מניחה ש-
    // CanPropagateHakbatza החזירה true (אחרת היא תבצע best-effort בלי לקרוס).
    // ה-partner slots מקבלים AssignedTeacherId/AssignedHakbatza ויורד _remaining
    // שלהם. UndoAssign של ה-slot המקורי יבטל את כולם דרך _hakPropagatedSlots.
    private Dictionary<HourSlot, List<HourSlot>> _hakPropagatedSlots = new Dictionary<HourSlot, List<HourSlot>>();
    // hakbatza propagation: משתמש ב-TryFindHakbatzaBijection כדי למצוא bijection
    // מלא, ואז משבץ את ה-partners. אם CanAssign אישר (אומר ש-bijection קיים),
    // Apply ימצא את אותו bijection ויבצע אותו.
    private void ApplyHakbatzaPropagation(HourSlot mainSlot, ClassTeacher ct)
    {
        var bijection = TryFindHakbatzaBijection(mainSlot, ct);
        if (bijection == null || bijection.Count == 0) return;
        List<HourSlot> propagated = null;
        foreach (var kv in bijection)
        {
            int pClassId = kv.Key;
            ClassTeacher chosenPartner = kv.Value;
            HourSlot pSlot = FindSlot(pClassId, mainSlot.Day, mainSlot.Hour);
            if (pSlot == null) continue;
            if (pSlot.AssignedTeacherId > 0) continue; // race protection
            pSlot.AssignedTeacherId = chosenPartner.TeacherId;
            pSlot.AssignedProfessionalId = chosenPartner.ProfessionalId;
            pSlot.AssignedHakbatza = chosenPartner.Hakbatza;
            pSlot.AssignedIhud = chosenPartner.Ihud;
            string rkChosen = Key(pClassId, chosenPartner.TeacherId);
            if (_remaining.ContainsKey(rkChosen) && _remaining[rkChosen] > 0)
                _remaining[rkChosen] = _remaining[rkChosen] - 1;
            GetDaySet(chosenPartner.TeacherId, mainSlot.Day).Add(mainSlot.Hour);
            SetBusy(chosenPartner.TeacherId, mainSlot.Day, mainSlot.Hour, pSlot);
            IncClassDayCount(chosenPartner.TeacherId, pClassId, mainSlot.Day, +1);
            if (propagated == null) propagated = new List<HourSlot>();
            propagated.Add(pSlot);
        }
        if (propagated != null && propagated.Count > 0)
        {
            _hakPropagatedSlots[mainSlot] = propagated;
        }
    }

    private void UndoAssign(HourSlot slot)
    {
        int t = slot.AssignedTeacherId;
        if (t <= 0) return;

        // PROTECTION: Never undo homeroom at hour 1!
        if (IsHomeroomForSlot(slot, t))
        {
            return;
        }

        // אם ה-slot הזה היה main של propagation הקבצה — לבטל קודם את כל ה-
        // partner slots, אחרת הם יישארו תלויים בלי main.
        List<HourSlot> propagated;
        if (_hakPropagatedSlots.TryGetValue(slot, out propagated) && propagated != null)
        {
            for (int i = 0; i < propagated.Count; i++)
            {
                HourSlot pSlot = propagated[i];
                if (pSlot == null || pSlot.AssignedTeacherId <= 0) continue;
                if (IsHomeroomForSlot(pSlot, pSlot.AssignedTeacherId)) continue;
                int pt = pSlot.AssignedTeacherId;
                string pRk = Key(pSlot.ClassId, pt);
                int pRem;
                if (_remaining.TryGetValue(pRk, out pRem))
                    _remaining[pRk] = pRem + 1;
                HashSet<int> pSet = GetDaySet(pt, pSlot.Day);
                if (pSet.Contains(pSlot.Hour)) pSet.Remove(pSlot.Hour);
                ClearBusy(pt, pSlot.Day, pSlot.Hour);
                IncClassDayCount(pt, pSlot.ClassId, pSlot.Day, -1);
                pSlot.AssignedTeacherId = 0;
                pSlot.AssignedProfessionalId = 0;
                pSlot.AssignedHakbatza = 0;
                pSlot.AssignedIhud = 0;
            }
            _hakPropagatedSlots.Remove(slot);
        }

        string rk = Key(slot.ClassId, t);
        int rem;
        if (_remaining.TryGetValue(rk, out rem))
            _remaining[rk] = rem + 1;

        HashSet<int> set = GetDaySet(t, slot.Day);
        if (set.Contains(slot.Hour))
            set.Remove(slot.Hour);

        ClearBusy(t, slot.Day, slot.Hour);
        IncClassDayCount(t, slot.ClassId, slot.Day, -1);

        slot.AssignedTeacherId = 0;
        slot.AssignedProfessionalId = 0;
        slot.AssignedHakbatza = 0;
        slot.AssignedIhud = 0;
    }

    // Alias for compatibility
    private void UndoAssignForce(HourSlot slot)
    {
        UndoAssign(slot);
    }

    // Check if a teacher is the homeroom teacher for a specific class
    private bool IsHomeroomTeacherForClass(int teacherId, int classId)
    {
        // Check if teacher has TafkidId == 1 for this class
        // We stored this info in _homeClassByTeacher during BuildModel
        int homeClass;
        if (_homeClassByTeacher.TryGetValue(teacherId, out homeClass))
        {
            return homeClass == classId;
        }
        return false;
    }

    private void RestoreAssign(HourSlot slot, int teacherId, int profId, int hak, int ihud)
    {
        if (IsBusy(teacherId, slot.Day, slot.Hour)) return;
        
        // CRITICAL: Never overwrite homeroom at hour 1
        if (slot.Hour == 1 && slot.AssignedTeacherId > 0 && IsHomeroomForSlot(slot, slot.AssignedTeacherId))
        {
            LogHomeroom(string.Format("RestoreAssign BLOCKED: Class {0} Day {1} - would overwrite homeroom T{2}", slot.ClassId, slot.Day, slot.AssignedTeacherId));
            return;
        }
        
        slot.AssignedTeacherId = teacherId;
        slot.AssignedProfessionalId = profId;
        slot.AssignedHakbatza = hak;
        slot.AssignedIhud = ihud;

        string rk = Key(slot.ClassId, teacherId);
        int rem;
        if (_remaining.TryGetValue(rk, out rem))
            _remaining[rk] = rem - 1;

        GetDaySet(teacherId, slot.Day).Add(slot.Hour);
        SetBusy(teacherId, slot.Day, slot.Hour, slot);
    }

    // =========================================================
    // SAVE ALWAYS
    // =========================================================
    private int SaveAssignmentsToDatabase_ReturnCount()
    {
        int saved = 0;

        // Track what we've saved to avoid duplicates (ClassId_HourId_TeacherId)
        HashSet<string> savedKeys = new HashSet<string>();

        SqlConnection con = Dal.OpenConnection();
        SqlTransaction tx = null;
        try
        {
            tx = con.BeginTransaction();

            for (int i = 0; i < _allSlots.Count; i++)
            {
                HourSlot s = _allSlots[i];
                if (s.AssignedTeacherId <= 0) continue;

                string key = s.ClassId + "_" + s.HourId + "_" + s.AssignedTeacherId;
                if (savedKeys.Contains(key)) continue;
                savedKeys.Add(key);

                Dal.ExeSpBigNonQuery(
                    con,
                    tx,
                    "Assign_SetAssignAuto",
                    _configurationId,
                    s.AssignedTeacherId,
                    s.HourId,
                    1,
                    s.ClassId,
                    s.AssignedProfessionalId,
                    s.AssignedHakbatza,
                    s.AssignedIhud
                );

                saved++;
            }

            // Also save extras from Hakbatza/Ihud expansion
            foreach (var kv in _extraAssignments)
            {
                ExtraAssignment ea = kv.Value;
                string key = ea.ClassId + "_" + ea.HourId + "_" + ea.TeacherId;
                if (savedKeys.Contains(key)) continue;
                savedKeys.Add(key);

                Dal.ExeSpBigNonQuery(
                    con,
                    tx,
                    "Assign_SetAssignAuto",
                    _configurationId,
                    ea.TeacherId,
                    ea.HourId,
                    1,
                    ea.ClassId,
                    ea.ProfessionalId,
                    ea.Hakbatza,
                    ea.Ihud
                );

                saved++;
            }

            tx.Commit();
            tx = null;
        }
        catch
        {
            if (tx != null)
            {
                try { tx.Rollback(); } catch { }
            }
            throw;
        }
        finally
        {
            if (tx != null) tx.Dispose();
            Dal.CloseConnection(con);
        }

        return saved;
    }

    // =========================================================
    // ERROR ANALYSIS
    // =========================================================
    private string AnalyzeWhyNotAssigned(HourSlot slot)
    {
        if (slot.Candidates == null || slot.Candidates.Count == 0)
        {
            return "אין מועמדים זמינים";
        }

        List<string> details = new List<string>();
        int availableCount = 0;
        List<string> availableTeachers = new List<string>();
        List<string> busyDetails = new List<string>();
        List<string> noRemainingDetails = new List<string>();
        List<string> homeroomLockedDetails = new List<string>();
        List<string> consecutiveBlockedDetails = new List<string>();

        // Analyze each candidate
        for (int i = 0; i < slot.Candidates.Count; i++)
        {
            ClassTeacher ct = slot.Candidates[i];
            if (ct == null) continue;

            string teacherInfo = "מורה " + ct.TeacherId;

            // Check remaining
            bool hasRemainingInTarget = HasRemaining(slot.ClassId, ct.TeacherId);
            bool hasRemainingAnywhere = HasRemainingAnywhere(ct.TeacherId);
            
            if (!hasRemainingInTarget && !hasRemainingAnywhere)
            {
                noRemainingDetails.Add(teacherInfo + " (אין שעות נותרות)");
                continue;
            }

            // Check homeroom lock
            if (IsHomeroomLockedToHome(slot, ct))
            {
                int home;
                if (_homeClassByTeacher.TryGetValue(ct.TeacherId, out home))
                {
                    homeroomLockedDetails.Add(teacherInfo + " (מחנך נעול לכיתה " + home + ")");
                }
                else
                {
                    homeroomLockedDetails.Add(teacherInfo + " (מחנך נעול)");
                }
                continue;
            }

            // Check consecutive
            if (WouldBreakConsecutive(ct.TeacherId, slot.Day, slot.Hour))
            {
                consecutiveBlockedDetails.Add(teacherInfo + " (חוסם רצף)");
                continue;
            }

            // Check busy
            if (IsBusy(ct.TeacherId, slot.Day, slot.Hour))
            {
                HourSlot busySlot = GetBusySlot(ct.TeacherId, slot.Day, slot.Hour);
                if (busySlot != null)
                {
                    busyDetails.Add(teacherInfo + " (תפוס בכיתה " + busySlot.ClassId + ")");
                }
                else
                {
                    busyDetails.Add(teacherInfo + " (תפוס בשעה זו)");
                }
                continue;
            }

            // This teacher is available!
            availableCount++;
            availableTeachers.Add(teacherInfo);
        }

        // Build detailed message
        string msg = "";

        if (availableCount > 0)
        {
            msg = "יש " + availableCount + " מורים זמינים אבל לא שובץ: ";
            for (int i = 0; i < availableTeachers.Count; i++)
            {
                if (i > 0) msg += ", ";
                msg += availableTeachers[i];
            }
            msg += " (באג - צריך לבדוק למה לא שובץ)";
            return msg;
        }

        // No available teachers - explain why
        msg = "אין מורים זמינים. ";

        if (slot.Candidates.Count > 0)
        {
            msg += "נבדקו " + slot.Candidates.Count + " מועמדים: ";
        }

        List<string> allReasons = new List<string>();

        if (noRemainingDetails.Count > 0)
        {
            allReasons.Add(noRemainingDetails.Count + " ללא שעות נותרות (" + string.Join(", ", noRemainingDetails.ToArray()) + ")");
        }

        if (busyDetails.Count > 0)
        {
            allReasons.Add(busyDetails.Count + " תפוסים בשעה זו (" + string.Join(", ", busyDetails.ToArray()) + ")");
        }

        if (homeroomLockedDetails.Count > 0)
        {
            allReasons.Add(homeroomLockedDetails.Count + " מחנכים נעולים (" + string.Join(", ", homeroomLockedDetails.ToArray()) + ")");
        }

        if (consecutiveBlockedDetails.Count > 0)
        {
            allReasons.Add(consecutiveBlockedDetails.Count + " חוסמים רצף (" + string.Join(", ", consecutiveBlockedDetails.ToArray()) + ")");
        }

        if (allReasons.Count > 0)
        {
            for (int i = 0; i < allReasons.Count; i++)
            {
                if (i > 0) msg += " | ";
                msg += allReasons[i];
            }
        }
        else
        {
            msg += "סיבה לא ידועה";
        }

        // Check if there are available teachers from other classes at this time
        List<ClassTeacher> availableFromOther = FindAvailableTeachersAtTime(slot.Day, slot.Hour, slot.ClassId);
        if (availableFromOther != null && availableFromOther.Count > 0)
        {
            msg += " | יש " + availableFromOther.Count + " מורים פנויים מכיתות אחרות בשעה זו";
        }

        return msg;
    }

    private void AddError(HourSlot slot, string msg)
    {
        ShibutzError e = new ShibutzError();
        e.ClassId = slot.ClassId;
        e.Day = slot.Day;
        e.Hour = slot.Hour;
        e.Message = msg;
        e.TeachersMissingHours = new List<int>();
        
        // Count how many hours are missing in this class
        int missingHoursInClass = 0;
        for (int i = 0; i < _allSlots.Count; i++)
        {
            if (_allSlots[i].ClassId == slot.ClassId && _allSlots[i].AssignedTeacherId <= 0)
            {
                missingHoursInClass++;
            }
        }
        
        // If only 1 hour is missing in this class, find a teacher whose quota is not fully filled
        if (missingHoursInClass == 1)
        {
            // Find teachers who have remaining hours in this class but quota not fully filled
            if (slot.Candidates != null && slot.Candidates.Count > 0)
            {
                for (int i = 0; i < slot.Candidates.Count; i++)
                {
                    ClassTeacher ct = slot.Candidates[i];
                    if (ct == null) continue;
                    
                    // Check if teacher has remaining hours in this class
                    bool hasRemainingInTarget = HasRemaining(slot.ClassId, ct.TeacherId);
                    if (hasRemainingInTarget)
                    {
                        // Teacher has remaining hours - quota not fully filled
                        if (!e.TeachersMissingHours.Contains(ct.TeacherId))
                        {
                            e.TeachersMissingHours.Add(ct.TeacherId);
                        }
                    }
                }
            }
            
            // If no teacher found with remaining hours, look for any teacher assigned to this class
            if (e.TeachersMissingHours.Count == 0)
            {
                // Find any teacher who was assigned to this class but quota not fully filled
                for (int i = 0; i < _allSlots.Count; i++)
                {
                    if (_allSlots[i].ClassId == slot.ClassId && _allSlots[i].AssignedTeacherId > 0)
                    {
                        int teacherId = _allSlots[i].AssignedTeacherId;
                        bool hasRemaining = HasRemaining(slot.ClassId, teacherId);
                        if (hasRemaining && !e.TeachersMissingHours.Contains(teacherId))
                        {
                            e.TeachersMissingHours.Add(teacherId);
                            break; // Just need one teacher
                        }
                    }
                }
            }
        }
        else
        {
            // Multiple hours missing - find teachers missing hours in this class
            if (slot.Candidates != null && slot.Candidates.Count > 0)
            {
                for (int i = 0; i < slot.Candidates.Count; i++)
                {
                    ClassTeacher ct = slot.Candidates[i];
                    if (ct == null) continue;
                    
                    // Check if teacher has remaining hours in this class
                    bool hasRemainingInTarget = HasRemaining(slot.ClassId, ct.TeacherId);
                    if (!hasRemainingInTarget)
                    {
                        // Teacher is missing hours in this class
                        if (!e.TeachersMissingHours.Contains(ct.TeacherId))
                        {
                            e.TeachersMissingHours.Add(ct.TeacherId);
                        }
                    }
                }
            }
        }
        
        Errors.Add(e);
    }

    // =========================================================
    // HELPERS
    // =========================================================
    private string Key(int classId, int teacherId)
    {
        return classId + "_" + teacherId;
    }

    private int ToInt(object o)
    {
        if (o == null) return 0;
        int v;
        if (Int32.TryParse(o.ToString(), out v)) return v;
        return 0;
    }

    private int SafeInt(string s)
    {
        int v;
        if (Int32.TryParse(s, out v)) return v;
        return 0;
    }

    // Check if teacher works at the specified hour
    private bool IsTeacherWorkingAtHour(int teacherId, int hourId)
    {
        // If no working hours data loaded, allow assignment (backward compatibility)
        if (_teacherWorkingHours == null || _teacherWorkingHours.Count == 0)
            return true;

        // If teacher has no working hours defined, allow assignment
        if (!_teacherWorkingHours.ContainsKey(teacherId))
            return true;

        // Check if this hourId is in teacher's working hours
        return _teacherWorkingHours[teacherId].Contains(hourId);
    }

    // Remove teacher from all other slots' Candidates at the SAME TIME (same Day+Hour)
    // This ensures that once assigned, teacher cannot be assigned to another class at the same time
    // BUT we keep him available for other hours (for swaps)
    private void RemoveTeacherFromOtherSlots(int teacherId, HourSlot assignedSlot)
    {
        for (int i = 0; i < _allSlots.Count; i++)
        {
            HourSlot otherSlot = _allSlots[i];
            
            // Skip the slot we just assigned
            if (otherSlot == assignedSlot) continue;
            
            // Only remove from slots at the SAME TIME (same Day and Hour)
            // This prevents double-booking at the same time, but allows swaps at different times
            if (otherSlot.Day != assignedSlot.Day || otherSlot.Hour != assignedSlot.Hour) continue;
            
            // Skip if already assigned
            if (otherSlot.AssignedTeacherId > 0) continue;
            
            // Remove teacher from Candidates if present
            if (otherSlot.Candidates != null)
            {
                for (int j = otherSlot.Candidates.Count - 1; j >= 0; j--)
                {
                    ClassTeacher ct = otherSlot.Candidates[j];
                    if (ct != null && ct.TeacherId == teacherId)
                    {
                        otherSlot.Candidates.RemoveAt(j);
                    }
                }
            }
        }
    }
}

// =====================================================
// ENTITIES (do not modify your ClassTeacher)
// =====================================================
public class HourSlot
{
    public int ClassId;
    public int HourId;
    public int Day;
    public int Hour;

    public int AssignedTeacherId;
    public int AssignedProfessionalId;
    public int AssignedHakbatza;
    public int AssignedIhud;

    public List<ClassTeacher> Candidates;
}

public class ShibutzError
{
    public int ClassId;
    public int Day;
    public int Hour;
    public string Message;
    public string ClassName;
    public List<int> TeachersMissingHours;
}

public class ShibutzRunResult
{
    public int SavedCount;
    public int ErrorCount;
}

public class ShibutzLiveStatus
{
    public DateTime StartedAt;
    public long ElapsedMs;
    public bool IsRunning;
    public string CurrentStep;
    public int TotalSlots;
    public int RedSlots;
    public List<ClassProgress> Classes = new List<ClassProgress>();
}

public class ClassProgress
{
    public int ClassId;
    public string ClassName;
    public int TotalSlots;
    public int FilledSlots;
}

public class ExtraAssignment
{
    public int ClassId;
    public int HourId;
    public int Day;
    public int Hour;
    public int TeacherId;
    public int ProfessionalId;
    public int Hakbatza;
    public int Ihud;
}

// =====================================================
// ClassTeacher (as yours, do not modify)
// =====================================================
public class ClassTeacher
{
    public ClassTeacher(string item, int ClassId)
    {
        string[] Teacher = item.Split('-');
        this.TeacherId = Helper.ConvertToInt(Teacher[0]);
        this.TeacherHoursInClass = Helper.ConvertToInt(Teacher[1]);
        this.HardTeacherHoursInClass = Helper.ConvertToInt(Teacher[1]);
        this.LastTeacherHoursInClass = Helper.ConvertToInt(Teacher[1]);
        this.IsTeacher = (Teacher[2] == "0") ? false : true;
        this.Hakbatza = Helper.ConvertToInt(Teacher[3]);
        this.Ihud = Helper.ConvertToInt(Teacher[4]);
        this.ProfessionalId = Helper.ConvertToInt(Teacher[5]);
        this.TafkidId = Helper.ConvertToInt(Teacher[6]);
        this.IsTwoHour = (Teacher[7] == "0") ? false : true;
        // ManageClassId is at index 8 - MUST check if it exists!
        if (Teacher.Length > 8)
        {
            this.ManageClassId = Helper.ConvertToInt(Teacher[8]);
        }
        else
        {
            this.ManageClassId = 0;
        }
        this.ClassId = ClassId;
    }

    public int ClassId;
    public int TeacherId;
    public int LastTeacherHoursInClass;
    public int TeacherHoursInClass;
    public int HardTeacherHoursInClass;
    public bool IsTeacher;
    public int Hakbatza;
    public int Ihud;
    public int ProfessionalId;
    public int TafkidId;
    public bool IsTwoHour;
    public int ManageClassId;

}

// =====================================================
// Helper (as yours)
// =====================================================
public static class Helper
{
    public static int ConvertToInt(string val)
    {
        int res;
        bool isOk = Int32.TryParse(val, out res);

        if (isOk)
            return res;

        return 0;
    }
}
