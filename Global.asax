<%@ Application Language="C#" %>
<script runat="server">
    // אבטחה (multi-tenant): אכיפת חתימת HMAC על עוגיית UserData.
    // כאשר EnforceUserDataSignature=true ב-web.config, עוגייה הנושאת זהות
    // (UserId/SchoolId) ללא חתימה תקפה — מזויפת או ישנה מלפני הוספת החתימה —
    // מוסרת מהבקשה, כך ש-WebMethods אינם סומכים על זהות שלא אומתה בשרת.
    // כשהדגל כבוי (ברירת מחדל) זהו no-op מוחלט, כדי לאפשר מעבר הדרגתי.
    void Application_BeginRequest(object sender, EventArgs e)
    {
        if (!AuthCookie.EnforceUserData()) return;

        HttpRequest req = HttpContext.Current.Request;
        HttpCookie ud = req.Cookies["UserData"];
        if (ud == null) return;

        bool hasIdentity = !string.IsNullOrEmpty(ud["UserId"]) || !string.IsNullOrEmpty(ud["SchoolId"]);
        if (!hasIdentity) return;

        if (!AuthCookie.VerifyUserData(ud))
        {
            // אבטחה: זהות שלא אומתה (מזויפת/ישנה) — מנטרלים את שדות הזהות הרגישים
            // למפתח לא-קיים (0) במקום להסיר את העוגייה. כך מתודות שאינן בודקות null
            // יסנכרנו ל-tenant לא קיים ויחזירו ריק (בלי דליפה ובלי NullReferenceException).
            ud["UserId"] = "0";
            ud["RoleId"] = "0";
            ud["SchoolId"] = "0";
            ud["ConfigurationId"] = "0";
        }
    }
</script>
