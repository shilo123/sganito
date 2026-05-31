using System;
using System.Web;
using System.Configuration;
using System.Security.Cryptography;
using System.Text;

/// <summary>
/// כלי עזר מרכזי לחתימת HMAC-SHA256 ואימות עוגיות זהות (AdminData / UserData).
/// מטרה: לחסום זיוף זהות בצד הלקוח (SchoolId / RoleId / AdminId) שכן עוגיות אלה
/// נשלחות מהדפדפן וניתנות לעריכה. הלוגיקה מרוכזת כאן כדי ש-WebService ו-Global.asax
/// ישתמשו בדיוק באותו אלגוריתם ומפתח.
/// </summary>
public static class AuthCookie
{
    // מפתח ברירת מחדל — נופלים אליו רק אם AppSettings["AuthSecret"] חסר, כדי לא
    // לשבור את הפלואו. חובה להגדיר AuthSecret אמיתי בפרודקשן.
    private const string AUTH_SECRET_DEFAULT =
        "Sganit_a7F3kq9Lz2RxV8nP_doNotShipThisDefault_setAuthSecretInWebConfig";

    private static string GetAuthSecret()
    {
        string s = ConfigurationManager.AppSettings["AuthSecret"];
        return string.IsNullOrEmpty(s) ? AUTH_SECRET_DEFAULT : s;
    }

    /// <summary>מחשב חתימת HMAC-SHA256 (Base64) על מחרוזת נתונים.</summary>
    public static string Sign(string data)
    {
        using (var h = new HMACSHA256(Encoding.UTF8.GetBytes(GetAuthSecret())))
        {
            byte[] hash = h.ComputeHash(Encoding.UTF8.GetBytes(data ?? ""));
            return Convert.ToBase64String(hash);
        }
    }

    /// <summary>השוואה בזמן קבוע (מונע timing attacks על אימות החתימה).</summary>
    public static bool Equal(string a, string b)
    {
        if (a == null || b == null || a.Length != b.Length) return false;
        int diff = 0;
        for (int i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }

    // ---------- AdminData ----------
    public static string AdminPayload(string adminId)
    {
        return "AdminId=" + adminId;
    }

    // ---------- UserData ----------
    // החתימה מכסה רק את שדות הזהות הרגישים (אלה שמשפיעים על הרשאות וסקופ tenant).
    public static string UserDataPayload(HttpCookie c)
    {
        if (c == null) return "";
        return "UserId=" + c["UserId"] +
               "&RoleId=" + c["RoleId"] +
               "&SchoolId=" + c["SchoolId"] +
               "&ConfigurationId=" + c["ConfigurationId"];
    }

    /// <summary>חותם עוגיית UserData נתונה (מוסיף/מעדכן את שדה Sig). לקרוא לפני Response.Cookies.Add.</summary>
    public static void SignUserData(HttpCookie c)
    {
        if (c == null) return;
        c["Sig"] = Sign(UserDataPayload(c));
    }

    /// <summary>אימות חתימת UserData. מחזיר false אם חסרה/שגויה (זיוף או עוגייה ישנה ללא חתימה).</summary>
    public static bool VerifyUserData(HttpCookie c)
    {
        if (c == null) return false;
        return Equal(Sign(UserDataPayload(c)), c["Sig"]);
    }

    /// <summary>
    /// האם לאכוף את חתימת UserData (לפסול עוגיות לא-חתומות/מזויפות).
    /// ברירת מחדל: כבוי — כדי לאפשר מעבר הדרגתי (סשנים ישנים נחתמים מחדש בהתחברות
    /// הבאה) ולמנוע NRE במתודות שאינן בודקות null על העוגייה. להפעיל ב-cutover.
    /// </summary>
    public static bool EnforceUserData()
    {
        string v = ConfigurationManager.AppSettings["EnforceUserDataSignature"];
        return string.Equals(v, "true", StringComparison.OrdinalIgnoreCase);
    }
}
