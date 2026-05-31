using System;
using System.Collections.Generic;
using System.Web;

/// <summary>
/// הגנת brute-force על מסכי ההתחברות (Admin_Login / User_GetUserEnter).
/// סופר ניסיונות כושלים לפי (שם משתמש + כתובת IP) בחלון זמן, ונועל זמנית
/// לאחר חריגה מהסף. מימוש in-memory (Dictionary + lock) — מתאים למופע IIS יחיד;
/// בפריסה מרובת-שרתים יש לעבור ל-cache מבוזר. נכשל "פתוח" (לא חוסם) במקרה חריג
/// כדי לא לשבור התחברות לגיטימית.
/// </summary>
public static class LoginThrottle
{
    private const int MAX_FAILURES = 5;                 // ניסיונות כושלים מותרים בחלון
    private static readonly TimeSpan WINDOW   = TimeSpan.FromMinutes(15); // חלון ספירה
    private static readonly TimeSpan LOCKOUT  = TimeSpan.FromMinutes(15); // משך נעילה לאחר חריגה

    private class Entry
    {
        public int Failures;
        public DateTime WindowStart;
        public DateTime LockedUntil;
    }

    private static readonly object _lock = new object();
    private static readonly Dictionary<string, Entry> _map = new Dictionary<string, Entry>();

    private static string KeyFor(string userName)
    {
        string ip = "";
        try
        {
            HttpContext ctx = HttpContext.Current;
            if (ctx != null && ctx.Request != null)
                ip = ctx.Request.UserHostAddress ?? "";
        }
        catch { }
        return (userName ?? "").Trim().ToLowerInvariant() + "|" + ip;
    }

    /// <summary>מחזיר true אם ההתחברות עבור (משתמש+IP) נעולה כרגע.</summary>
    public static bool IsBlocked(string userName)
    {
        try
        {
            lock (_lock)
            {
                Entry e;
                if (!_map.TryGetValue(KeyFor(userName), out e)) return false;
                return e.LockedUntil > DateTime.UtcNow;
            }
        }
        catch { return false; } // נכשל פתוח
    }

    /// <summary>רושם ניסיון כושל; נועל אם עברו את הסף בתוך החלון.</summary>
    public static void RecordFailure(string userName)
    {
        try
        {
            lock (_lock)
            {
                string key = KeyFor(userName);
                DateTime now = DateTime.UtcNow;
                Entry e;
                if (!_map.TryGetValue(key, out e))
                {
                    e = new Entry { Failures = 0, WindowStart = now, LockedUntil = DateTime.MinValue };
                    _map[key] = e;
                }
                // אם החלון פג — מתחילים ספירה מחדש
                if (now - e.WindowStart > WINDOW)
                {
                    e.WindowStart = now;
                    e.Failures = 0;
                }
                e.Failures++;
                if (e.Failures >= MAX_FAILURES)
                {
                    e.LockedUntil = now + LOCKOUT;
                }
                // ניקוי עצל של רשומות ישנות כדי שה-Dictionary לא יגדל ללא גבול
                if (_map.Count > 5000) CleanupExpired(now);
            }
        }
        catch { }
    }

    /// <summary>מאפס את המונה לאחר התחברות מוצלחת.</summary>
    public static void RecordSuccess(string userName)
    {
        try
        {
            lock (_lock) { _map.Remove(KeyFor(userName)); }
        }
        catch { }
    }

    private static void CleanupExpired(DateTime now)
    {
        var dead = new List<string>();
        foreach (var kv in _map)
        {
            if (kv.Value.LockedUntil < now && (now - kv.Value.WindowStart) > WINDOW)
                dead.Add(kv.Key);
        }
        foreach (var k in dead) _map.Remove(k);
    }
}
