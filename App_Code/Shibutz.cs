using System;
using System.Activities.Statements;
using System.Collections;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;

public class Shibutz
{
    // ====== CONFIG ======
    private const int MAX_CONSECUTIVE = 15;      // כמעט לא מגביל (כמו שביקשת)
    private const int CHAIN_DEPTH = 15;          // עומק שרשרת הזזות
    private const int MAX_VISITS_PER_TIME = 4000;

    private readonly int _configurationId;

    private readonly List<HourSlot> _allSlots = new List<HourSlot>();

    // Remaining per (ClassId, TeacherId) based on ct.LastTeacherHoursInClass
    private readonly Dictionary<string, int> _remaining = new Dictionary<string, int>();

    // Teacher busy per (Day,Hour) => assigned slot (מונע כפילות מורה באותה שעה)
    private readonly Dictionary<int, Dictionary<int, Dictionary<int, HourSlot>>> _busy =
        new Dictionary<int, Dictionary<int, Dictionary<int, HourSlot>>>();

    // Teacher hours set per day for consecutive
    private readonly Dictionary<int, Dictionary<int, HashSet<int>>> _teacherDayHours =
        new Dictionary<int, Dictionary<int, HashSet<int>>>();

    // TeacherId -> HomeClassId (TafkidId==1)
    private readonly Dictionary<int, int> _homeClassByTeacher = new Dictionary<int, int>();

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

        // group by time (Day,Hour)
        Dictionary<int, List<HourSlot>> byTime = BuildTimeBuckets();

        // time order: hour 1 first, then hour 2..., inside each hour days
        List<int> timeKeys = new List<int>(byTime.Keys);
        timeKeys.Sort();

        for (int i = 0; i < timeKeys.Count; i++)
        {
            List<HourSlot> slots = byTime[timeKeys[i]];

            // (1) Direct fill (retry simple)
            DirectFill(slots);

            // (2) Local swaps
            LocalSwapFill(slots);

            // (3) Deep chain (augmenting path) depth 15
            DeepChainFill(slots, CHAIN_DEPTH);
        }

        // Build errors for remaining reds
        Errors.Clear();
        for (int i = 0; i < _allSlots.Count; i++)
        {
            if (_allSlots[i].AssignedTeacherId <= 0)
                AddError(_allSlots[i], "לא שובץ");
        }

        // Save always (only assigned)
        int saved = SaveAssignmentsToDatabase_ReturnCount();

        ShibutzRunResult r = new ShibutzRunResult();
        r.SavedCount = saved;
        r.ErrorCount = Errors.Count;
        return r;
    }

    // =========================================================
    // BUILD MODEL
    // =========================================================
    private void BuildModel(DataSet ds)
    {
        _allSlots.Clear();
        _remaining.Clear();
        _homeClassByTeacher.Clear();
        Errors.Clear();

        if (ds == null || ds.Tables.Count == 0 || ds.Tables[0] == null)
            return;

        DataTable t = ds.Tables[0];

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
                    string item = parts[i];
                    if (string.IsNullOrEmpty(item)) continue;

                    // *** ClassTeacher כמו אצלך, לא נוגעים ***
                    ClassTeacher ct = new ClassTeacher(item, classId);
                    if (ct == null) continue;
                    if (ct.TeacherId <= 0) continue;

                    slot.Candidates.Add(ct);

                    string rk = Key(classId, ct.TeacherId);
                    if (!_remaining.ContainsKey(rk))
                        _remaining[rk] = ct.LastTeacherHoursInClass;

                    if (ct.TafkidId == 1 && !_homeClassByTeacher.ContainsKey(ct.TeacherId))
                        _homeClassByTeacher[ct.TeacherId] = ct.ClassId;
                }
            }

            _allSlots.Add(slot);
        }
    }

    private void ResolveDayHour(int hourId, out int day, out int hour)
    {
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
            map[k].Sort(CompareHardFirst);

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
    // STEP 1: DIRECT FILL
    // =========================================================
    private void DirectFill(List<HourSlot> slots)
    {
        // repeat until no progress (because each assignment changes availability)
        bool progress = true;
        while (progress)
        {
            progress = false;

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

        // 1) Homeroom in its own class - very strong preference
        int home;
        if (_homeClassByTeacher.TryGetValue(ct.TeacherId, out home) && home == slot.ClassId)
            score += 100000;

        // 2) More remaining in this class => prefer
        int rem;
        if (_remaining.TryGetValue(Key(slot.ClassId, ct.TeacherId), out rem))
            score += rem * 50;

        // 3) Prefer teacher who is "teacher" (if your flag means something)
        if (ct.IsTeacher) score += 100;

        // 4) Prefer not to split hakbatza/ihud? (small bias)
        if (ct.Hakbatza > 0) score += 5;
        if (ct.Ihud > 0) score += 5;

        return score;
    }

    // =========================================================
    // STEP 2: LOCAL SWAP (2-level)
    // =========================================================
    private void LocalSwapFill(List<HourSlot> slots)
    {
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
                // after success, also run direct fill again (new possibilities)
                DirectFill(slots);
            }
        }
    }

    private bool TryLocalSwap(HourSlot target, List<HourSlot> sameTimeSlots)
    {
        if (target.Candidates == null) return false;

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

            // try reassign block to another teacher (direct)
            ClassTeacher alt = ChooseBestDirect(block);
            if (alt == null) continue;

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
            UndoAssign(target);
        }

        return false;
    }

    // =========================================================
    // STEP 3: DEEP CHAIN (augmenting path up to depth 15)
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
        if (!HasRemaining(slot.ClassId, ct.TeacherId)) return false;
        if (IsBusy(ct.TeacherId, slot.Day, slot.Hour)) return false;
        if (WouldBreakConsecutive(ct.TeacherId, slot.Day, slot.Hour)) return false;

        // Strong rule: homeroom stays in home class while home has remaining
        if (IsHomeroomLockedToHome(slot, ct)) return false;

        return true;
    }

    private bool CanAssignIgnoringBusy(HourSlot slot, ClassTeacher ct)
    {
        if (!HasRemaining(slot.ClassId, ct.TeacherId)) return false;
        if (WouldBreakConsecutive(ct.TeacherId, slot.Day, slot.Hour)) return false;

        if (IsHomeroomLockedToHome(slot, ct)) return false;

        return true;
    }

    private bool HasRemaining(int classId, int teacherId)
    {
        int rem;
        if (!_remaining.TryGetValue(Key(classId, teacherId), out rem)) return false;
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

        int count = 1;
        for (int h = hour - 1; h > 0 && set.Contains(h); h--) count++;
        for (int h = hour + 1; h < 30 && set.Contains(h); h++) count++;

        return count > MAX_CONSECUTIVE;
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
    private void ApplyAssign(HourSlot slot, ClassTeacher ct)
    {
        slot.AssignedTeacherId = ct.TeacherId;
        slot.AssignedProfessionalId = ct.ProfessionalId;
        slot.AssignedHakbatza = ct.Hakbatza;
        slot.AssignedIhud = ct.Ihud;

        string rk = Key(slot.ClassId, ct.TeacherId);
        _remaining[rk] = _remaining[rk] - 1;

        GetDaySet(ct.TeacherId, slot.Day).Add(slot.Hour);
        SetBusy(ct.TeacherId, slot.Day, slot.Hour, slot);
    }

    private void UndoAssign(HourSlot slot)
    {
        int t = slot.AssignedTeacherId;
        if (t <= 0) return;

        string rk = Key(slot.ClassId, t);
        int rem;
        if (_remaining.TryGetValue(rk, out rem))
            _remaining[rk] = rem + 1;

        HashSet<int> set = GetDaySet(t, slot.Day);
        if (set.Contains(slot.Hour))
            set.Remove(slot.Hour);

        ClearBusy(t, slot.Day, slot.Hour);

        slot.AssignedTeacherId = 0;
        slot.AssignedProfessionalId = 0;
        slot.AssignedHakbatza = 0;
        slot.AssignedIhud = 0;
    }

    private void RestoreAssign(HourSlot slot, int teacherId, int profId, int hak, int ihud)
    {
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

        SqlConnection con = Dal.OpenConnection();
        try
        {
            for (int i = 0; i < _allSlots.Count; i++)
            {
                HourSlot s = _allSlots[i];
                if (s.AssignedTeacherId <= 0) continue;

                Dal.ExeSpBig(
                    con,
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
        }
        finally
        {
            Dal.CloseConnection(con);
        }

        return saved;
    }

    // =========================================================
    // ERRORS
    // =========================================================
    private void AddError(HourSlot slot, string msg)
    {
        ShibutzError e = new ShibutzError();
        e.ClassId = slot.ClassId;
        e.Day = slot.Day;
        e.Hour = slot.Hour;
        e.Message = msg;
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
}

// =====================================================
// ENTITIES (לא נוגעים ב-ClassTeacher שלך)
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
}

public class ShibutzRunResult
{
    public int SavedCount;
    public int ErrorCount;
}




#region SUPPORT CLASSES (כמו אצלך, כמעט ללא שינוי)

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
}

public class TempTransferObj
{
    public TempTransferObj(int HourId, int ClassId, int TeacherId)
    {
        this.HourId = HourId;
        this.ClassId = ClassId;
        this.TeacherId = TeacherId;
    }
    public int HourId;
    public int ClassId;
    public int TeacherId;
}

public class HourSchool
{
    public HourSchool(DataRow row)
    {
        this.ClassId = Helper.ConvertToInt(row["ClassId"].ToString());
        this.HourId = Helper.ConvertToInt(row["HourId"].ToString());
        this.Day = Helper.ConvertToInt(row["HourId"].ToString().Substring(0, 1));
        this.Hour = Helper.ConvertToInt(row["HourId"].ToString().Substring(1, 1));
        this.TeacherNaatz = row["TeacherNaatz"].ToString();

        this.TeacherOptional = new List<ClassTeacher>();
        this.SelectedTeacherIds = new List<int>();
    }

    public int HourId;
    public int Day;
    public int Hour;
    public int ClassId;
    public string TeacherNaatz;
    public int SelectedHakbatza;
    public int SelectedIhud;

    public List<ClassTeacher> TeacherOptional;
    public List<int> SelectedTeacherIds;
    public bool IsHasHakbatza;
    public bool IsHasIhud;

    public void AddClassTeacher(ClassTeacher ct)
    {
        this.TeacherOptional.Add(ct);
    }

    public void AddSelectedTeacher(int SelectedTeacherId)
    {
        this.SelectedTeacherIds.Add(SelectedTeacherId);
    }
}

public class Configuration
{
    public int MaxHourInShibutz;
    public int MinForPitzul;
    public int MinTeacherInmor;
    public int ConfigurationId;

    public List<HourExtra> HourExtraList;

    public Configuration(DataRow row)
    {
        this.MaxHourInShibutz = Helper.ConvertToInt(row["MaxHourInShibutz"].ToString());
        this.MinForPitzul = Helper.ConvertToInt(row["MinForPitzul"].ToString());
        this.MinTeacherInmor = Helper.ConvertToInt(row["MinTeacherInmor"].ToString());
        this.HourExtraList = new List<HourExtra>();
        this.ConfigurationId = Helper.ConvertToInt(row["ConfigurationId"].ToString());
    }

    public void AddHourExtra(HourExtra he)
    {
        this.HourExtraList.Add(he);
    }
}

public class TempTeachersObj
{
    public int TeacherId;
    public int ClassId;
    public int TeacherFree;
    public int TeacherHourWork;
    public int TeacherInDay;
    public bool IsOk;

    public ClassTeacher ctObj;
    public TempTeachersObj() { }
}

public class LastSelectedTeacherObj
{
    public int TeacherId;
    public int ClassId;
    public int Hour;
    public int Day;

    public LastSelectedTeacherObj() { }
}

public class HourExtra
{
    public HourExtra(DataRow row)
    {
        this.TeacherId = Helper.ConvertToInt(row["TeacherId"].ToString());
        this.ClassId = Helper.ConvertToInt(row["ClassId"].ToString());
        this.DayId = Helper.ConvertToInt(row["DayId"].ToString());
        this.HourExtraHour = Helper.ConvertToInt(row["HourExtra"].ToString());
    }

    public int TeacherId;
    public int ClassId;
    public int DayId;
    public int HourExtraHour;
}

public class HakbatzaIhud
{
    public HakbatzaIhud(DataRow row)
    {
        this.Type = Helper.ConvertToInt(row["Type"].ToString());
        this.Counter = Helper.ConvertToInt(row["Counter"].ToString());
        this.ClassId = Helper.ConvertToInt(row["ClassId"].ToString());
        this.Id = Helper.ConvertToInt(row["Id"].ToString());
        this.Hour = Helper.ConvertToInt(row["Hour"].ToString());
        this.CounterSet = 0;
    }

    public int Type;
    public int Counter;
    public int ClassId;
    public int Id;
    public int CounterSet;
    public int Hour;
}

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

public static class EnumerableHelper<E>
{
    private static Random r;

    static EnumerableHelper()
    {
        r = new Random();
    }

    public static T Random<T>(IEnumerable<T> input)
    {
        return input.ElementAt(r.Next(input.Count()));
    }
}

public static class EnumerableExtensions
{
    public static T Random<T>(this IEnumerable<T> input)
    {
        return EnumerableHelper<T>.Random(input);
    }
}

#endregion
