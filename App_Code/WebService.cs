using System;
using System.Activities.Statements;
using System.Collections;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Data.SqlClient;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.ServiceModel.Web;
using System.Text;
using System.Web;
using System.Web.Configuration;
using System.Web.Script.Serialization;
using System.Web.Security;
using System.Web.Services;

/// <summary>
/// Summary description for WebService
/// </summary>
[WebService(Namespace = "http://tempuri.org/")]
[WebServiceBinding(ConformsTo = WsiProfiles.BasicProfile1_1)]
// To allow this Web Service to be called from script, using ASP.NET AJAX, uncomment the following line. 
[System.Web.Script.Services.ScriptService]
public class WebService : System.Web.Services.WebService
{

    public WebService()
    {


    }








    #region BetKneset


    [WebMethod]
    public void BetKneset_GetIfPending()
    {
        DataTable dt = new DataTable();

        string IsPending = File.ReadAllText(Server.MapPath("~/BetKneset/Pending.txt"));// webConfigApp.AppSettings.Settings["IsPending"].Value;

        dt.Columns.Add("res");

        DataRow dr = dt.NewRow();

        dr[0] = IsPending;

        dt.Rows.Add(dr);
        UpdatePendingWeb(0);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));

    }

   
    [WebMethod]
    public void BetKneset_UpdateHTML()
    {

        string html = GetParams("html");
        string Type = GetParams("Type");

        DataTable dt = Dal.ExeSp("BetKneset_UpdateHTML", Type, 1, html);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));

        //    string pref = GetAllPrev();
        //   string end = GetAllend();
        //  File.WriteAllText(Server.MapPath("~/BetKneset/Screen.html"), pref + html + end);
        //  UpdatePendingWeb(1);



    }

    [WebMethod]
    public void BetKneset_GetHTML()
    {

        string Type = GetParams("Type");
        string IsFromScreen = GetParams("IsFromScreen");

        DataTable dt = Dal.ExeSp("BetKneset_GetHTML", Type, "1", IsFromScreen);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));

        //    string pref = GetAllPrev();
        //   string end = GetAllend();
        //  File.WriteAllText(Server.MapPath("~/BetKneset/Screen.html"), pref + html + end);
        //  UpdatePendingWeb(1);



    }




    private string GetAllend()
    {
        string end = @"
 </div>
    </form>
</body>
</html>
            ";

        return end;
    }

    private string GetAllPrev()
    {
        string prev = @"

        <!DOCTYPE html>
        <head>
            <meta charset='utf-8' />
             <title> בית כנסת - מעגלים </title>
                <script src = '../assets/js/Generic.js'></script>
                <link rel = 'stylesheet' href = '../assets/css/bootstrap-rtl.css'>
                <script type = 'text/javascript' src = '../assets/js/bootstrap.min.js'></script>
                <link href = '../assets/css/rtl-css/style-rtl.css' rel = 'stylesheet' />
                <script src = '../assets/js/lib/jquery-2.1.1.min.js' ></script>
                <script type='text/javascript'>
               

                   setInterval('CheckIfPending()', 60000);

                   $(document).ready(function () {

                   if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                         $('body').css('overflow', 'auto');

                        $('.dvBox').css('width', '99%').css('font-size','60px');
                        $('.dvbadageTzahi,.dvbadageTzahi span').css('font-size','60px');

                        $('.dvZmanim').removeClass('dvZmanim');
                        $('.dvZmanimSP').removeClass('dvZmanimSP');
                        $('.spComment').css('font-size','40px');
                       $('.dvAlertMessage,.dvAlertMessage span div').css('font-size','40px');

                        $('.dvPageTitle').css('font-size','60px');
                        
                        $('.dvAlertMessage').css('width', '99%');
                        $('.dvAlighnRight').removeClass('dvAlighnRight');
               
                        $('div,span').prop('contenteditable', false);

                        $('.dvCotainer,.dvCotainerM1,.dvCotainerM2').height('100%');
                    

                  }else{               

                      $('body').css('overflow', 'hidden');
                    var CurrentHeight = $(document).height();
                    $('.dvCotainer').height(CurrentHeight * 0.95);
                    $('.dvCotainerM1').height(CurrentHeight * 0.95);
                   // $('.dvCotainerM2').height(CurrentHeight * 0.17);
}

                });


              function CheckIfPending() {
                    mydata = Ajax('BetKneset_GetIfPending');
                    if (mydata[0].res == '1') {

                        location.reload();


                    }

                }



                 </script>



               
          </head>
        <body>
        <form id = 'form1'>
        <div class='dvInMain' id= 'dvInMain'>

        ";

        return prev;
    }


    public void UpdatePendingWeb(int val)
    {

        File.WriteAllText(Server.MapPath("~/BetKneset/Pending.txt"), val.ToString());

        //Configuration webConfigApp = WebConfigurationManager.OpenWebConfiguration("~");
        ////Modifying the AppKey from AppValue to AppValue1
        //webConfigApp.AppSettings.Settings["IsPending"].Value = val.ToString();
        ////Save the Modified settings of AppSettings.
        //webConfigApp.Save();
    }

    #endregion

    #region Tunis
    [WebMethod]
    public void Tunis_UpdateHTML()
    {
        try
        {
            string flName = GetParams("flName");
            string flPhone = GetParams("flPhone");
            string flmail = GetParams("flmail");


            SmtpClient client = new SmtpClient("smtp.office365.com", 25);
            client.Credentials = new System.Net.NetworkCredential("dglaw@dgtracking.co.il", "But60041");
            client.EnableSsl = true;


            //var client = new SmtpClient("smtp.gmail.com", 587)
            //{
            //   // UseDefaultCredentials = false,
            //    Credentials = new NetworkCredential("brokeryogev@gmail.com", "tirlulim"),
            //  // 
            //    EnableSsl = true
            //};

            //shay@softwareasi.com
            //dafna@softwareasi.com
            //,shay@softwareasi.com,dafna@softwareasi.com
            string Message = "להלן מידע שהתקבל:" + "<br><br><b>" + "שם ושם משפחה: </b>" + flName + "<br><b>" + "טלפון:</b> " + flPhone + "<br><b>" + "מייל: </b>" + flmail + "<br>";

            MailMessage Msg = new MailMessage("dglaw@dgtracking.co.il", "tzahi556@gmail.com,shay@softwareasi.com,dafna@softwareasi.com");
            Msg.Subject = "בקשה חדשה הגיעה מדף נחיתה" + DateTime.Now.ToString("dd/MM/yyyy HH:mm ");

            Msg.Body = Message;
            Msg.IsBodyHtml = true;

            client.Send(Msg);
        }
        catch (Exception ex)
        {

            Dal.ExeSp("BetKneset_UpdateHTML", 1, 2, ex.InnerException + " " + ex.Message);
        }
        // client.Send("brokeryogev@gmail.com", "tzahi556@gmail.com", "בקשה חדשה הגיעה מדף נחיתה" + DateTime.Now.ToString("dd/MM/yyyy HH:mm "), Message);


        // DataTable dt = Dal.ExeSp("BetKneset_GetHTML", Type, "1", IsFromScreen);
        // HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));

        //    string pref = GetAllPrev();
        //   string end = GetAllend();
        //  File.WriteAllText(Server.MapPath("~/BetKneset/Screen.html"), pref + html + end);
        //  UpdatePendingWeb(1);



    }

    #endregion

    #region Assign


    [WebMethod]
    public void Assign_FillAssignment()
    {

        string StartDate = GetParams("StartDate");
        string EndDate = GetParams("EndDate");
        string OrgUnitCode = GetParams("OrgUnitCode");

        DataTable dt = Dal.ExeSp("Assign_FillAssignment", StartDate, EndDate, OrgUnitCode);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    //[WebMethod]
    //public void Assign_GetAssignment()
    //{

    //    string Date = GetParams("Date");
    //    string OrgUnitCode = GetParams("OrgUnitCode");

    //    DataTable dt = Dal.ExeSp("Assign_GetAssignment", Date, OrgUnitCode);

    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    //}

    [WebMethod]
    public void Assign_GetAssignmentForPortal()
    {

        string Date = GetParams("Date");
        string OrgUnitCode = GetParams("OrgUnitCode");

        DataTable dt = Dal.ExeSp("Assign_GetAssignmentForPortal", Date, OrgUnitCode);

        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    }

    [WebMethod]
    public void Assign_SetEmpForEmptyPosition()
    {

        string SearchDate = GetParams("SearchDate");
        string OrgUnitCode = GetParams("OrgUnitCode");

        DataTable dt = Dal.ExeSp("Assign_SetEmpForEmptyPosition", SearchDate, OrgUnitCode);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Assignment_GetRequiremntsNonAuto()
    {

        string ShiftDate = GetParams("ShiftDate");
        string ShiftCode = GetParams("ShiftCode");
        string OrgUnitCode = GetParams("OrgUnitCode");




        DataTable dt = Dal.ExeSp("Assignment_GetRequiremntsNonAuto", ShiftDate, ShiftCode, OrgUnitCode);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    }

    [WebMethod]
    public void Assignment_InsertRequiremntsNonAutoToAssignment()
    {
        string RequirementId = GetParams("RequirementId");
        string ShiftDate = GetParams("ShiftDate");
        string ShiftCode = GetParams("ShiftCode");
        string OrgUnitCode = GetParams("OrgUnitCode");



        string HarigaId = GetParams("HarigaId");
        string HarigaFree = GetParams("HarigaFree");
        string HadId = GetParams("HadId");
        string HadFree = GetParams("HadFree");



        DataTable dt = Dal.ExeSp("Assignment_InsertRequiremntsNonAutoToAssignment", RequirementId,
            ShiftDate, ShiftCode, OrgUnitCode,
            HarigaId, HarigaFree, HadId, HadFree);

        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    }

    [WebMethod]
    public void Assignment_SetNonAutoPosion()
    {
        string AssignmentId = GetParams("AssignmentId");
        string Type = GetParams("Type");





        DataTable dt = Dal.ExeSp("Assignment_SetNonAutoPosion", AssignmentId, Type);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }




    [WebMethod]
    public void Assignment_SetHoursForWorker()
    {


        string AssignmentId = GetParams("AssignmentId");
        string WorkerHours = GetParams("WorkerHours");
        string Seq = GetParams("Seq");


        DataTable dt = Dal.ExeSp("Assignment_SetHoursForWorker", AssignmentId, WorkerHours, Seq, HttpContext.Current.Request.Cookies["UserData"]["UserId"]);

        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    }

    [WebMethod]
    public void Assignment_InsertManualAssign()
    {
        string TargetAssignmentId = GetParams("TargetAssignmentId");
        string SourceAssignmentId = GetParams("SourceAssignmentId");
        string SourceEmpNo = GetParams("SourceEmpNo");
        string Type = GetParams("Type");


        DataTable dt = Dal.ExeSp("Assignment_InsertManualAssign", TargetAssignmentId, SourceAssignmentId, SourceEmpNo, Type, HttpContext.Current.Request.Cookies["UserData"]["UserId"]);

        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    }


    [WebMethod]
    public void Assignment_GetAddedHours()
    {
        string OrgUnitCode = GetParams("OrgUnitCode");
        string SearchDate = GetParams("SearchDate");

        DataTable dt = Dal.ExeSp("Assignment_GetAddedHours", SearchDate, OrgUnitCode);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    }



    [WebMethod]
    public void Assignment_GetPrivateAssign()
    {
        string EmpNo = GetParams("EmpNo");

        DataTable dt = Dal.ExeSp("Assignment_GetPrivateAssign", EmpNo);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    }



    #endregion

    #region General





    [WebMethod]

    public void Gen_GetTable()
    {

        string TableName = GetParams("TableName");
        string Condition = GetParams("Condition");

        DataTable dt = Dal.ExeSp("Gen_GetTable", TableName, Condition);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));

    }

    //[WebMethod]
    //public void Gen_DeleteTable()
    //{
    //    string TableName = GetParams("TableName");
    //    string ColName = GetParams("ColName");
    //    string Val = GetParams("Val");

    //    DataTable dt = Dal.ExeSp("Gen_DeleteTable", TableName, ColName, Val);
    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));

    //}


    //[WebMethod]
    //public void Gen_GetJobsInArea()
    //{

    //    string AreaId = HttpContext.Current.Request.Form["AreaId"].ToString();

    //    DataTable dt = Dal.ExeSp("Gen_GetJobsInArea", AreaId);

    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    //}


    //[WebMethod]
    //public void Gen_SetJobsInArea()
    //{

    //    string JobId = GetParams("JobId");
    //    string AreaId = GetParams("AreaId");

    //    string Alias = GetParams("Alias");
    //    string Desc = GetParams("Desc");

    //    DataTable dt = Dal.ExeSp("Gen_SetJobsInArea", JobId, AreaId, Desc, Alias);

    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    //}

    //[WebMethod]
    //public void Gen_DeleteJobsInArea()
    //{

    //    string JobId = GetParams("JobId");


    //    DataTable dt = Dal.ExeSp("Gen_DeleteJobsInArea", JobId);

    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    //}



    //[WebMethod]
    //public void Gen_GetShifts()
    //{

    //    string ShiftId = HttpContext.Current.Request.Form["ShiftId"].ToString();

    //    DataTable dt = Dal.ExeSp("Gen_GetShifts", ShiftId);

    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    //}

    //[WebMethod]
    //public void Gen_GetAreaMessages()
    //{

    //    string AreaId = GetParams("AreaId");
    //    string Date = GetParams("Date");
    //    string Mode = GetParams("Mode");

    //    DataTable dt = Dal.ExeSp("Gen_GetAreaMessages", AreaId, Date, Mode);

    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    //}

    //[WebMethod]
    //public void Gen_SetAreaMessages()
    //{

    //    string AreaId = GetParams("AreaId");
    //    string Message = GetParams("Message");
    //    string MessageRoutine = GetParams("MessageRoutine");
    //    string UserId = GetParams("UserId");

    //    DataTable dt = Dal.ExeSp("Gen_SetAreaMessages", AreaId, Message, MessageRoutine, UserId);

    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    //}


    //[WebMethod]
    //public void Gen_GetAllTasksInArea()
    //{

    //    string AreaId = GetParams("AreaId");

    //    DataTable dt = Dal.ExeSp("Gen_GetAllTasksInArea", AreaId);

    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));


    //}


    //[WebMethod]
    //public void Gen_GetUserConfirm()
    //{
    //    string Module = GetParams("Module");
    //    string AreaId = GetParams("AreaId");
    //    string type = GetParams("type");
    //    DataTable dt = Dal.ExeSp("Gen_GetUserConfirm", Module, AreaId, type);
    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    //}
    //[WebMethod]
    //public void Gen_SetUserConfirm()
    //{
    //    string UserId = GetParams("UserId");
    //    string Module = GetParams("Module");
    //    string AreaId = GetParams("AreaId");
    //    DataTable dt = Dal.ExeSp("Gen_SetUserConfirm", UserId, Module, AreaId);
    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    //}
    //[WebMethod]
    //public void Gen_GetAreas()
    //{

    //    string AreaId = GetParams("AreaId");
    //    DataTable dt = Dal.ExeSp("Gen_GetAreas", AreaId);
    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    //}
    //[WebMethod]
    //public void Gen_GetUser()
    //{

    //    string AreaId = GetParams("AreaId");
    //    DataTable dt = Dal.ExeSp("Gen_GetUser", AreaId);
    //    HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    //}



    #endregion

    #region User

    [WebMethod]
    public void User_GetUserEnter()
    {

        string UserName = GetParams("UserName");
        string Password = GetParams("Password");



        DataTable dt = Dal.ExeSp("User_GetUserEnter", UserName, Password);


        if (dt.Rows.Count > 0)
        {
            HttpCookie cookie = new HttpCookie("UserData");
            cookie["UserId"] = dt.Rows[0]["UserId"].ToString();
            cookie["RoleId"] = dt.Rows[0]["RoleId"].ToString();
            cookie["ConfigurationId"] = dt.Rows[0]["ConfigurationId"].ToString();
            cookie["UserName"] = Server.UrlEncode(dt.Rows[0]["UserName"].ToString());
            cookie["HebDate"] = Server.UrlEncode(dt.Rows[0]["HebDate"].ToString());
            cookie["Name"] = Server.UrlEncode(dt.Rows[0]["Name"].ToString());
            cookie["SchoolId"] = dt.Rows[0]["SchoolId"].ToString();

            // FormsAuthentication.RedirectFromLoginPage(dt.Rows[0]["UserName"].ToString(), true);

            cookie.Expires = DateTime.Now.AddYears(90);
            HttpContext.Current.Response.Cookies.Add(cookie);

        }


        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }


    #endregion

    #region SchoolConfig

    [WebMethod]
    public void School_UpdateConfigHours()
    {

        string Hours = GetParams("Hours");

        DataTable dt = Dal.ExeSp("School_UpdateConfigHours", Hours, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"], "", "");
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }


    [WebMethod]
    public void School_UpdateHour()
    {

        string HourId = GetParams("HourId");
        string Mode = GetParams("Mode");

        DataTable dt = Dal.ExeSp("School_UpdateHour", HourId, Mode, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }




    #endregion

    #region Teacher

    [WebMethod]
    public void Teacher_GetTeacherList()
    {

        string TeacherId = GetParams("TeacherId");

        DataTable dt = Dal.ExeSp("Teacher_GetTeacherList", TeacherId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"], "", "");
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Teacher_GetTeacherHours()
    {

        string TeacherId = GetParams("TeacherId");

        DataTable dt = Dal.ExeSp("Teacher_GetTeacherHours", TeacherId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Teacher_SetTeacherHours()
    {

        string TeacherId = GetParams("TeacherId");
        string Type = GetParams("Type");
        string HourId = GetParams("HourId");

        DataTable dt = Dal.ExeSp("Teacher_SetTeacherHours", TeacherId, HourId, Type, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    // שליפה מהירה של שיבוצי מורה ספציפית - חלופה ל-Assign_GetAssignment
    // שמחזירה את כל שיבוצי בית הספר (איטי ~25 שניות).
    [WebMethod]
    public void Teacher_GetAssignmentsForTeacher()
    {
        string TeacherIdRaw = GetParams("TeacherId");
        int teacherId;
        if (!int.TryParse(TeacherIdRaw, out teacherId))
        {
            HttpContext.Current.Response.Write("[]");
            return;
        }
        int configurationId;
        if (!int.TryParse(HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"], out configurationId))
        {
            HttpContext.Current.Response.Write("[]");
            return;
        }
        string sql = "SELECT AssignmentId, HourId, ClassId, TeacherId, ProfessionalId, Hakbatza, Ihud "
                   + "FROM TeacherAssignment "
                   + "WHERE TeacherId = " + teacherId + " AND ConfigurationId = " + configurationId;
        DataTable dt = Dal.GetDataTable(sql);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }





    [WebMethod]
    public void Teacher_DML()
    {

        string TeacherId = GetParams("TeacherId");
        string Tafkid = GetParams("Tafkid");
        string ProfessionalId = GetParams("ProfessionalId");

        string FirstName = GetParams("FirstName");
        string LastName = GetParams("LastName");
        string Email = GetParams("Email");
        string Type = GetParams("Type");
        string Frontaly = GetParams("Frontaly");
        string FreeDay = GetParams("FreeDay");

        string Tz = GetParams("Tz");
        string Shehya = GetParams("Shehya");
        string Partani = GetParams("Partani");




        DataTable dt = Dal.ExeSp("Teacher_DML", TeacherId, Tafkid, FirstName, LastName, Email,
          Frontaly, FreeDay, Tz, Shehya, Partani, ProfessionalId,
            HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"], Type);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Teacher_GetShehyaGroup()
    {

        string HourId = GetParams("HourId");
        string TeacherId = GetParams("TeacherId");
        DataTable dt = Dal.ExeSp("Teacher_GetShehyaGroup", HourId, TeacherId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Teacher_SetGroupShehya()
    {

        string HourId = GetParams("HourId");
        string TeachersIds = GetParams("TeachersIds");

        string ShehyaGroupId = GetParams("ShehyaGroupId");
        string NewGroup = GetParams("NewGroup");

        DataTable dt = Dal.ExeSp("Teacher_SetGroupShehya", HourId, TeachersIds, ShehyaGroupId, NewGroup, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }


    [WebMethod]
    public void Teacher_SetPartani()
    {

        string HourId = GetParams("HourId");
        string TeacherId = GetParams("TeacherId");

        string Type = GetParams("Type");


        DataTable dt = Dal.ExeSp("Teacher_SetPartani", HourId, TeacherId, Type, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }






    // Mark or clear a teacher hour as shehya/partani without forcing a
    // group selection. Replaces any existing non-class assignment so the
    // user can flip between shehya/partani directly. A real class
    // assignment (HourTypeId=1 with a ClassId) is left intact unless
    // Force=1 is passed — in that case the class row is also dropped so
    // the caller can convert a frontaly slot to shehya/partani in one go.
    //   Action: 'shehya' (HourTypeId=3) | 'partani' (HourTypeId=2) | 'clear'
    //   Force:  '1' = also drop class assignment (default 0)
    // Response codes: 0 = success, 1 = generic error, 2 = blocked by
    // existing class assignment (only when Force=0).
    [WebMethod]
    public void Teacher_SetHourType()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int hourId = Helper.ConvertToInt(GetParams("HourId"));
            int teacherId = Helper.ConvertToInt(GetParams("TeacherId"));
            string action = (GetParams("Action") ?? "").ToLowerInvariant();
            bool force = (GetParams("Force") ?? "0") == "1";
            if (hourId <= 0 || teacherId <= 0 || (action != "shehya" && action != "partani" && action != "clear"))
            {
                HttpContext.Current.Response.Clear();
                HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                HttpContext.Current.Response.Write("[{\"res\":1,\"err\":\"missing params\"}]");
                return;
            }

            // Look at the existing row(s) for this hour
            string existSql = @"
SELECT AssignmentId, HourTypeId, ClassId
FROM TeacherAssignment
WHERE ConfigurationId=" + cfgId + @"
  AND TeacherId=" + teacherId + @"
  AND HourId=" + hourId;
            DataTable dt = Dal.GetDataTable(existSql);

            // If the hour is already pinned to a class lesson (HourTypeId=1
            // with a non-null ClassId) we don't silently override it unless
            // Force=1 is set. Otherwise return res=2 so the UI can warn.
            if (!force)
            {
                foreach (DataRow r in dt.Rows)
                {
                    int ht = Helper.ConvertToInt(r["HourTypeId"].ToString());
                    bool hasClass = r["ClassId"] != DBNull.Value;
                    if (ht == 1 && hasClass)
                    {
                        HttpContext.Current.Response.Clear();
                        HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                        HttpContext.Current.Response.Write("[{\"res\":2}]");
                        return;
                    }
                }
            }

            // Drop existing rows. With Force=1 we wipe everything for this
            // (teacher, hour) including class assignments so the slot can
            // be safely replaced.
            string deleteSql = @"
DELETE FROM TeacherAssignment
WHERE ConfigurationId=" + cfgId + @"
  AND TeacherId=" + teacherId + @"
  AND HourId=" + hourId + (force ? "" : @"
  AND ClassId IS NULL");
            Dal.ExecuteNonQuery(deleteSql);

            if (action != "clear")
            {
                int newType = action == "partani" ? 2 : 3;
                string insertSql = @"
INSERT INTO TeacherAssignment (ConfigurationId, TeacherId, HourId, HourTypeId, ClassId, IsAuto)
VALUES (" + cfgId + @", " + teacherId + @", " + hourId + @", " + newType + @", NULL, 0)";
                Dal.ExecuteNonQuery(insertSql);
            }

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("[{\"res\":0}]");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("[{\"res\":1,\"err\":\"" + ex.Message.Replace("\"", "'") + "\"}]");
        }
    }

    [WebMethod]
    public void Teacher_GetTeachersForShehya()
    {

        string HourId = GetParams("HourId");
        string ShehyaGroupId = GetParams("ShehyaGroupId");
        string TeacherId = GetParams("TeacherId");
        DataTable dt = Dal.ExeSp("Teacher_GetTeachersForShehya", HourId, ShehyaGroupId, TeacherId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Teacher_GetAllTeacherHours()
    {

        string TeacherId = GetParams("TeacherId");
        DataTable dt = Dal.ExeSp("Teacher_GetAllTeacherHours", TeacherId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }
    [WebMethod]
    public void Teacher_GetAllMissClass()
    {

        string TeacherId = GetParams("TeacherId");
        DataTable dt = Dal.ExeSp("Teacher_GetAllMissClass", TeacherId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }





    #endregion

    #region Professional
    [WebMethod]
    public void Professional_DML()
    {

        string Type = GetParams("Type");
        string ProfessionalId = GetParams("ProfessionalId");
        string Name = GetParams("Name");
        string isTwoHour = GetParams("isTwoHour");
        DataTable dt = Dal.ExeSp("Professional_DML", Type, ProfessionalId, Name, isTwoHour, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }



    #endregion

    #region Class

    [WebMethod]
    public void Class_GetAllClass()
    {



        DataTable dt = Dal.ExeSp("Class_GetAllClass", HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Class_GetClassStatus()
    {



        DataTable dt = Dal.ExeSp("Class_GetClassStatus", HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Class_GetClassByLayerId()
    {

        string LayerId = GetParams("LayerId");

        DataTable dt = Dal.ExeSp("Class_GetClassByLayerId", LayerId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Class_SetClassData()
    {

        string ClassId = GetParams("ClassId");
        string LayerId = GetParams("LayerId");
        string ClassName = GetParams("ClassName");

        string Seq = GetParams("Seq");
        string mode = GetParams("mode");

        DataTable dt = Dal.ExeSp("Class_SetClassData", ClassId, LayerId,
              ClassName, Seq, mode,
            HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }
    // =========================================================
    // Directly set the Hakbatza number on a ClassTeacher row.
    // Empty or "0" clears the field. Used by the "create / edit group"
    // wizard in TeacherClass. Returns { res: 0 } on success.
    // (Ihud parameter accepted but ignored — Ihud was removed from the
    // model. We force Ihud=NULL so older data is cleaned up over time.)
    // =========================================================
    [WebMethod]
    public void Class_SetGroupNumber()
    {
        string ClassTeacherId = GetParams("ClassTeacherId");
        string Hakbatza = GetParams("Hakbatza");

        if (string.IsNullOrEmpty(ClassTeacherId) || ClassTeacherId == "0")
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("[{\"res\":1,\"err\":\"missing ClassTeacherId\"}]");
            return;
        }

        string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
        int hakVal = Helper.ConvertToInt(string.IsNullOrEmpty(Hakbatza) ? "0" : Hakbatza);
        int ctId = Helper.ConvertToInt(ClassTeacherId);
        int cfgId = Helper.ConvertToInt(cId);

        // Store 0 as NULL to match the data convention used elsewhere
        string hakSql = hakVal > 0 ? hakVal.ToString() : "NULL";
        string sql = "UPDATE ClassTeacher SET Hakbatza=" + hakSql + ", Ihud=NULL" +
                     " WHERE ClassTeacherId=" + ctId + " AND ConfigurationId=" + cfgId;
        Dal.ExecuteNonQuery(sql);

        HttpContext.Current.Response.Clear();
        HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
        HttpContext.Current.Response.Write("[{\"res\":0}]");
    }

    // =========================================================
    // Hakbatza as an independent entity: a numbered group inside a
    // grade level, made of selected classes (where the students come
    // from) and selected teachers (who teach the level groups).
    //
    // We store it inside ClassTeacher because the schema can't be
    // extended — TeacherId=NULL marks an "empty seat" in the hakbatza,
    // and a row with both ClassId and TeacherId is a teacher placed
    // into one of the classes.
    // =========================================================

    // SQL-escape a free-text value for safe inline interpolation. We don't
    // use parameterised queries elsewhere in this file so this stays
    // consistent with the surrounding style; doubling single quotes is
    // sufficient for short user-supplied names.
    private static string EscSql(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Replace("'", "''");
    }

    // Create a new empty hakbatza for a layer with the given classes.
    // Body params: LayerId, ClassIds (CSV "2037,2038,2039"), Name (optional).
    // Returns { Number: <new hakbatza number> }.
    [WebMethod]
    public void Hakbatza_Create()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int layerId = Helper.ConvertToInt(GetParams("LayerId"));
            string classIdsCsv = GetParams("ClassIds") ?? "";
            string name = (GetParams("Name") ?? "").Trim();

            List<int> classIds = new List<int>();
            foreach (string p in classIdsCsv.Split(','))
            {
                int x = Helper.ConvertToInt(p.Trim());
                if (x > 0) classIds.Add(x);
            }
            if (classIds.Count < 2)
            {
                HttpContext.Current.Response.Clear();
                HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                HttpContext.Current.Response.Write("{\"Error\":\"need at least 2 classes\"}");
                return;
            }

            // Allocate the next hakbatza number for this layer.
            string sqlMax = @"
SELECT ISNULL(MAX(ct.Hakbatza),0) AS MaxNum
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ISNULL(ct.Hakbatza,0) > 0";
            DataTable dt = Dal.GetDataTable(sqlMax);
            int nextNum = (dt.Rows.Count > 0 ? Helper.ConvertToInt(dt.Rows[0]["MaxNum"].ToString()) : 0) + 1;

            // Create one ClassTeacher row per class, with TeacherId=NULL
            // marking an "empty seat" the user will fill by dragging
            // teachers into the hakbatza.
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < classIds.Count; i++)
            {
                sb.Append("INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud) VALUES (")
                  .Append(cfgId).Append(", ")
                  .Append(classIds[i]).Append(", NULL, 1, ")
                  .Append(nextNum).Append(", NULL);");
            }
            // Persist the optional friendly name in GroupInfo.
            if (!string.IsNullOrEmpty(name))
            {
                sb.Append("INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name) VALUES (")
                  .Append(cfgId).Append(", ")
                  .Append(layerId).Append(", ")
                  .Append(nextNum).Append(", 'H', N'")
                  .Append(EscSql(name)).Append("');");
            }
            Dal.ExecuteNonQuery(sb.ToString());

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Number\":" + nextNum + "}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // Set/update the friendly name of a Hakbatza or Ihud.
    // Body params: LayerId, Number, Kind ('H' or 'I'), Name.
    [WebMethod]
    public void Group_SetName()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int layerId = Helper.ConvertToInt(GetParams("LayerId"));
            int number = Helper.ConvertToInt(GetParams("Number"));
            string kind = (GetParams("Kind") ?? "H").Trim().ToUpper();
            if (kind != "H" && kind != "I") kind = "H";
            string name = (GetParams("Name") ?? "").Trim();

            string sql = @"
IF EXISTS (SELECT 1 FROM GroupInfo WHERE ConfigurationId=" + cfgId + @" AND LayerId=" + layerId + @" AND Number=" + number + @" AND Kind='" + kind + @"')
  UPDATE GroupInfo SET Name=N'" + EscSql(name) + @"'
  WHERE ConfigurationId=" + cfgId + @" AND LayerId=" + layerId + @" AND Number=" + number + @" AND Kind='" + kind + @"'
ELSE
  INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name) VALUES (" + cfgId + @", " + layerId + @", " + number + @", '" + kind + @"', N'" + EscSql(name) + @"')";
            Dal.ExecuteNonQuery(sql);

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"res\":0}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // Returns every hakbatza in the configuration: number, layer,
    // class list, and teacher list. Two rows of the same hakbatza
    // number in the same layer share a group.
    [WebMethod]
    public void Hakbatza_GetAll()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            string sql = @"
SELECT
  ct.ClassTeacherId,
  ct.Hakbatza,
  ct.ClassId,
  c.Name AS ClassName,
  ISNULL(c.LayerId,0) AS LayerId,
  ISNULL(ct.TeacherId, 0) AS TeacherId,
  ISNULL(t.FirstName,'') + ' ' + ISNULL(t.LastName,'') AS TeacherName,
  ISNULL(gi.Name, '') AS Name
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
LEFT JOIN Teacher t ON t.TeacherId = ct.TeacherId
LEFT JOIN GroupInfo gi
  ON gi.ConfigurationId = ct.ConfigurationId
 AND gi.LayerId = c.LayerId
 AND gi.Number = ct.Hakbatza
 AND gi.Kind = 'H'
WHERE ct.ConfigurationId=" + cfgId + @"
  AND ISNULL(ct.Hakbatza,0) > 0
ORDER BY c.LayerId, ct.Hakbatza, c.Name, TeacherName";
            DataTable dt = Dal.GetDataTable(sql);
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("[{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}]");
        }
    }

    // Add a teacher to a hakbatza. A hakbatza spans multiple classes
    // and groups level-streams across them, so each teacher in the
    // hakbatza is associated with EVERY class in the group — not just
    // one. We therefore insert (or fill an empty placeholder) one row
    // per participating class.
    // Body params: LayerId, Number, TeacherId.
    [WebMethod]
    public void Hakbatza_AddTeacher()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int layerId = Helper.ConvertToInt(GetParams("LayerId"));
            int number = Helper.ConvertToInt(GetParams("Number"));
            int teacherId = Helper.ConvertToInt(GetParams("TeacherId"));
            if (number <= 0 || teacherId <= 0)
            {
                HttpContext.Current.Response.Clear();
                HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                HttpContext.Current.Response.Write("{\"Error\":\"missing params\"}");
                return;
            }

            // Find every class participating in this hakbatza. The shared
            // hour value (used for new rows) comes from any existing row
            // so a freshly added teacher inherits the lesson length.
            string sqlClasses = @"
SELECT DISTINCT ct.ClassId, ISNULL(MAX(ct.Hour),1) AS Hour
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ct.Hakbatza=" + number + @"
GROUP BY ct.ClassId";
            DataTable dtClasses = Dal.GetDataTable(sqlClasses);
            if (dtClasses.Rows.Count == 0)
            {
                HttpContext.Current.Response.Clear();
                HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                HttpContext.Current.Response.Write("{\"Error\":\"hakbatza not found\"}");
                return;
            }

            // Look at the existing rows so we can decide per-class:
            //   - Already has a row for this teacher → skip
            //   - Has an empty placeholder (TeacherId IS NULL) → fill it
            //   - Otherwise → insert a new row
            string sqlExisting = @"
SELECT ct.ClassId, ct.ClassTeacherId, ct.TeacherId, ISNULL(ct.Hour,1) AS Hour
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ct.Hakbatza=" + number;
            DataTable dtExisting = Dal.GetDataTable(sqlExisting);

            // Build per-class plans
            Dictionary<int, List<DataRow>> rowsByClass = new Dictionary<int, List<DataRow>>();
            foreach (DataRow er in dtExisting.Rows)
            {
                int cid = Helper.ConvertToInt(er["ClassId"].ToString());
                if (!rowsByClass.ContainsKey(cid)) rowsByClass[cid] = new List<DataRow>();
                rowsByClass[cid].Add(er);
            }

            StringBuilder sb = new StringBuilder();
            foreach (DataRow cr in dtClasses.Rows)
            {
                int classId = Helper.ConvertToInt(cr["ClassId"].ToString());
                int hour = Helper.ConvertToInt(cr["Hour"].ToString());
                List<DataRow> rows = rowsByClass.ContainsKey(classId) ? rowsByClass[classId] : new List<DataRow>();

                // Already in this class? skip.
                bool alreadyHere = false;
                foreach (DataRow r in rows)
                {
                    if (r["TeacherId"] != DBNull.Value &&
                        Helper.ConvertToInt(r["TeacherId"].ToString()) == teacherId)
                    {
                        alreadyHere = true; break;
                    }
                }
                if (alreadyHere) continue;

                // Try to fill an empty placeholder
                int filledRowId = 0;
                foreach (DataRow r in rows)
                {
                    if (r["TeacherId"] == DBNull.Value)
                    {
                        filledRowId = Helper.ConvertToInt(r["ClassTeacherId"].ToString());
                        break;
                    }
                }

                if (filledRowId > 0)
                {
                    sb.Append("UPDATE ClassTeacher SET TeacherId=").Append(teacherId)
                      .Append(" WHERE ClassTeacherId=").Append(filledRowId).Append(";");
                }
                else
                {
                    sb.Append("INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud) VALUES (")
                      .Append(cfgId).Append(", ")
                      .Append(classId).Append(", ")
                      .Append(teacherId).Append(", ")
                      .Append(hour).Append(", ")
                      .Append(number).Append(", NULL);");
                }
            }
            if (sb.Length > 0) Dal.ExecuteNonQuery(sb.ToString());

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"res\":0}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // Remove a teacher from a hakbatza. Since a teacher in a hakbatza is
    // present in EVERY participating class, removal must wipe every row.
    // We keep at least one placeholder row per class (TeacherId=NULL) so
    // the class membership is preserved for future drags.
    [WebMethod]
    public void Hakbatza_RemoveTeacher()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int layerId = Helper.ConvertToInt(GetParams("LayerId"));
            int number = Helper.ConvertToInt(GetParams("Number"));
            int teacherId = Helper.ConvertToInt(GetParams("TeacherId"));

            // List rows per class for this hakbatza so we can decide whether
            // to NULL-out the teacher (keeping the class membership) or
            // delete the row entirely (when other teachers still anchor the
            // class).
            string sqlClass = @"
SELECT ct.ClassTeacherId, ct.ClassId, ct.TeacherId
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ct.Hakbatza=" + number;
            DataTable dt = Dal.GetDataTable(sqlClass);

            Dictionary<int, List<DataRow>> rowsByClass = new Dictionary<int, List<DataRow>>();
            foreach (DataRow r in dt.Rows)
            {
                int cid = Helper.ConvertToInt(r["ClassId"].ToString());
                if (!rowsByClass.ContainsKey(cid)) rowsByClass[cid] = new List<DataRow>();
                rowsByClass[cid].Add(r);
            }

            StringBuilder sb = new StringBuilder();
            foreach (KeyValuePair<int, List<DataRow>> kv in rowsByClass)
            {
                List<DataRow> rows = kv.Value;
                int teacherRowId = 0;
                int otherTeacherRows = 0;
                int placeholderRows = 0;
                foreach (DataRow r in rows)
                {
                    if (r["TeacherId"] == DBNull.Value)
                    {
                        placeholderRows++;
                    }
                    else
                    {
                        int tid = Helper.ConvertToInt(r["TeacherId"].ToString());
                        if (tid == teacherId)
                            teacherRowId = Helper.ConvertToInt(r["ClassTeacherId"].ToString());
                        else
                            otherTeacherRows++;
                    }
                }
                if (teacherRowId == 0) continue;

                if (otherTeacherRows > 0 || placeholderRows > 0)
                {
                    // The class still has other anchors — drop the teacher's row.
                    sb.Append("DELETE FROM ClassTeacher WHERE ClassTeacherId=").Append(teacherRowId).Append(";");
                }
                else
                {
                    // Last row for this class — keep it as a placeholder.
                    sb.Append("UPDATE ClassTeacher SET TeacherId=NULL WHERE ClassTeacherId=").Append(teacherRowId).Append(";");
                }
            }
            if (sb.Length > 0) Dal.ExecuteNonQuery(sb.ToString());

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"res\":0}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // Delete a hakbatza completely (and the empty seats / teacher rows
    // that belonged to it).
    [WebMethod]
    public void Hakbatza_Delete()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int layerId = Helper.ConvertToInt(GetParams("LayerId"));
            int number = Helper.ConvertToInt(GetParams("Number"));

            // Drop placeholder rows (TeacherId IS NULL) entirely, and clear
            // Hakbatza on rows that had a real teacher (so we don't delete
            // independent ClassTeacher rows that just happen to share the
            // hakbatza number).
            string sql = @"
DELETE ct FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ct.Hakbatza=" + number + @"
  AND ct.TeacherId IS NULL;

UPDATE ct SET ct.Hakbatza=NULL
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ct.Hakbatza=" + number + @";

DELETE FROM GroupInfo
WHERE ConfigurationId=" + cfgId + @"
  AND LayerId=" + layerId + @"
  AND Number=" + number + @"
  AND Kind='H';";
            Dal.ExecuteNonQuery(sql);

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"res\":0}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // =========================================================
    // Ihud (Class Union): two classes share the same teacher in the
    // same hour. Stored as ClassTeacher rows with the same Ihud number,
    // each row pointing to a different ClassId. The "responsible teacher"
    // is set on every row, so the same TeacherId appears in each.
    //
    // Differences from Hakbatza:
    //   - Always exactly ONE teacher (the responsible). Hakbatza can
    //     have many teachers (level groups).
    //   - Each row in the Ihud already knows its TeacherId.
    //   - When the user changes the teacher we update every row in the
    //     group so they stay in sync.
    // =========================================================

    // Create a new Ihud for selected classes with a single responsible
    // teacher. Body: LayerId, ClassIds (CSV), TeacherId, Name (optional).
    [WebMethod]
    public void Ihud_Create()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int layerId = Helper.ConvertToInt(GetParams("LayerId"));
            string classIdsCsv = GetParams("ClassIds") ?? "";
            int teacherId = Helper.ConvertToInt(GetParams("TeacherId"));
            string name = (GetParams("Name") ?? "").Trim();

            List<int> classIds = new List<int>();
            foreach (string p in classIdsCsv.Split(','))
            {
                int x = Helper.ConvertToInt(p.Trim());
                if (x > 0) classIds.Add(x);
            }
            if (classIds.Count < 2)
            {
                HttpContext.Current.Response.Clear();
                HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                HttpContext.Current.Response.Write("{\"Error\":\"need at least 2 classes\"}");
                return;
            }
            if (teacherId <= 0)
            {
                HttpContext.Current.Response.Clear();
                HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                HttpContext.Current.Response.Write("{\"Error\":\"missing responsible teacher\"}");
                return;
            }

            // Allocate next Ihud number (per layer)
            string sqlMax = @"
SELECT ISNULL(MAX(ct.Ihud),0) AS MaxNum
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ISNULL(ct.Ihud,0) > 0";
            DataTable dt = Dal.GetDataTable(sqlMax);
            int nextNum = (dt.Rows.Count > 0 ? Helper.ConvertToInt(dt.Rows[0]["MaxNum"].ToString()) : 0) + 1;

            // Insert one row per class — same teacher, same Ihud.
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < classIds.Count; i++)
            {
                sb.Append("INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud) VALUES (")
                  .Append(cfgId).Append(", ")
                  .Append(classIds[i]).Append(", ")
                  .Append(teacherId).Append(", 1, NULL, ")
                  .Append(nextNum).Append(");");
            }
            if (!string.IsNullOrEmpty(name))
            {
                sb.Append("INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name) VALUES (")
                  .Append(cfgId).Append(", ")
                  .Append(layerId).Append(", ")
                  .Append(nextNum).Append(", 'I', N'")
                  .Append(EscSql(name)).Append("');");
            }
            Dal.ExecuteNonQuery(sb.ToString());

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Number\":" + nextNum + "}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // List all Ihud groups for the current configuration.
    [WebMethod]
    public void Ihud_GetAll()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            string sql = @"
SELECT
  ct.ClassTeacherId,
  ct.Ihud,
  ct.ClassId,
  c.Name AS ClassName,
  ISNULL(c.LayerId,0) AS LayerId,
  ISNULL(ct.TeacherId,0) AS TeacherId,
  ISNULL(t.FirstName,'') + ' ' + ISNULL(t.LastName,'') AS TeacherName,
  ISNULL(ct.Hour,1) AS Hour,
  ISNULL(gi.Name, '') AS Name
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
LEFT JOIN Teacher t ON t.TeacherId = ct.TeacherId
LEFT JOIN GroupInfo gi
  ON gi.ConfigurationId = ct.ConfigurationId
 AND gi.LayerId = c.LayerId
 AND gi.Number = ct.Ihud
 AND gi.Kind = 'I'
WHERE ct.ConfigurationId=" + cfgId + @"
  AND ISNULL(ct.Ihud,0) > 0
ORDER BY c.LayerId, ct.Ihud, c.Name";
            DataTable dt = Dal.GetDataTable(sql);
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("[{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}]");
        }
    }

    // Change the responsible teacher of an Ihud (updates every row).
    [WebMethod]
    public void Ihud_SetTeacher()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int layerId = Helper.ConvertToInt(GetParams("LayerId"));
            int number = Helper.ConvertToInt(GetParams("Number"));
            int teacherId = Helper.ConvertToInt(GetParams("TeacherId"));
            if (number <= 0 || teacherId <= 0)
            {
                HttpContext.Current.Response.Clear();
                HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                HttpContext.Current.Response.Write("{\"Error\":\"missing params\"}");
                return;
            }

            string sql = @"
UPDATE ct SET ct.TeacherId=" + teacherId + @"
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ct.Ihud=" + number;
            Dal.ExecuteNonQuery(sql);

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"res\":0}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // Update the hour count of every row in the Ihud (so the union
    // of classes shares the same hours-per-week value).
    [WebMethod]
    public void Ihud_SetHour()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int layerId = Helper.ConvertToInt(GetParams("LayerId"));
            int number = Helper.ConvertToInt(GetParams("Number"));
            int hour = Helper.ConvertToInt(GetParams("Hour"));
            if (number <= 0 || hour < 0)
            {
                HttpContext.Current.Response.Clear();
                HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                HttpContext.Current.Response.Write("{\"Error\":\"missing params\"}");
                return;
            }

            string sql = @"
UPDATE ct SET ct.Hour=" + hour + @"
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ct.Ihud=" + number;
            Dal.ExecuteNonQuery(sql);

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"res\":0}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // Update the hour count of every row in a Hakbatza, keeping the
    // shared lesson length consistent across the participating classes.
    [WebMethod]
    public void Hakbatza_SetHour()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int layerId = Helper.ConvertToInt(GetParams("LayerId"));
            int number = Helper.ConvertToInt(GetParams("Number"));
            int hour = Helper.ConvertToInt(GetParams("Hour"));
            if (number <= 0 || hour < 0)
            {
                HttpContext.Current.Response.Clear();
                HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                HttpContext.Current.Response.Write("{\"Error\":\"missing params\"}");
                return;
            }

            string sql = @"
UPDATE ct SET ct.Hour=" + hour + @"
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ct.Hakbatza=" + number;
            Dal.ExecuteNonQuery(sql);

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"res\":0}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // Delete an Ihud completely (all its rows).
    [WebMethod]
    public void Ihud_Delete()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int layerId = Helper.ConvertToInt(GetParams("LayerId"));
            int number = Helper.ConvertToInt(GetParams("Number"));

            string sql = @"
DELETE ct FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND c.LayerId=" + layerId + @"
  AND ct.Ihud=" + number + @";

DELETE FROM GroupInfo
WHERE ConfigurationId=" + cfgId + @"
  AND LayerId=" + layerId + @"
  AND Number=" + number + @"
  AND Kind='I';";
            Dal.ExecuteNonQuery(sql);

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"res\":0}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // Returns the classes a given teacher is assigned to (regular
    // assignment, hakbatza, or ihud). Used by TeacherHours to limit the
    // class-picker options to classes the teacher is actually linked to.
    [WebMethod]
    public void Teacher_GetClassesForTeacher()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            int teacherId = Helper.ConvertToInt(GetParams("TeacherId"));
            if (teacherId <= 0)
            {
                HttpContext.Current.Response.Clear();
                HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
                HttpContext.Current.Response.Write("[]");
                return;
            }
            string sql = @"
SELECT DISTINCT
  c.ClassId,
  c.Name AS ClassName,
  c.LayerId,
  ISNULL(ct.Hakbatza,0) AS Hakbatza,
  ISNULL(ct.Ihud,0) AS Ihud
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId=" + cfgId + @"
  AND ct.TeacherId=" + teacherId + @"
ORDER BY c.LayerId, c.Name";
            DataTable dt = Dal.GetDataTable(sql);
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("[{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}]");
        }
    }

    // Returns the maximum-hours-per-week per class for the active
    // configuration: the count of SchoolHours rows that are not
    // shehya-only. Used by the UI to render "X / Max" indicators.
    [WebMethod]
    public void Class_GetMaxHours()
    {
        try
        {
            string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cfgId = Helper.ConvertToInt(cId);
            string sql = @"
SELECT COUNT(*) AS MaxHours
FROM SchoolHours
WHERE ConfigurationId=" + cfgId + @"
  AND ISNULL(IsOnlyShehya,0)=0";
            DataTable dt = Dal.GetDataTable(sql);
            int max = dt.Rows.Count > 0 ? Helper.ConvertToInt(dt.Rows[0]["MaxHours"].ToString()) : 0;

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"MaxHours\":" + max + "}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // =========================================================
    // Returns the list of Hakbatza groups across all classes of the
    // current configuration. Used by UI to show a groups summary and to
    // suggest existing numbers when editing. Returns an array of rows:
    //   { Kind: "H", Number, ClassId, ClassName, TeacherId,
    //     TeacherName, ClassTeacherId, Hour }
    // (Ihud was removed from the model.)
    // =========================================================
    [WebMethod]
    public void Class_GetGroups()
    {
        string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
        int cfgId = Helper.ConvertToInt(cId);
        string sql = @"
SELECT
  'H' AS Kind,
  ct.Hakbatza AS Number,
  ct.ClassId,
  c.ClassName,
  ct.TeacherId,
  ISNULL(t.FirstName,'') + ' ' + ISNULL(t.LastName,'') AS TeacherName,
  ct.ClassTeacherId,
  ct.Hour
FROM ClassTeacher ct
JOIN Class c ON c.ClassId = ct.ClassId
LEFT JOIN Teacher t ON t.TeacherId = ct.TeacherId
WHERE ct.ConfigurationId = " + cfgId + @"
  AND ISNULL(ct.Hakbatza,0) > 0
ORDER BY Number, c.ClassName, TeacherName";
        DataTable dt = Dal.GetDataTable(sql);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    // =========================================================
    // Validates Hakbatza/Ihud groups and returns any problems that would
    // prevent the auto-scheduler from placing them together. Current checks:
    //   - Free-day intersection (do all members have at least one common
    //     working day across the 5-day week?)
    //   - Hakbatza uniqueness (does every member of a Hakbatza group
    //     actually teach the same class?)
    //   - Ihud spread (does the Ihud span >1 class? if only 1 it's really
    //     a Hakbatza)
    // Returns an array of { Kind, Number, Severity, Message, MemberCount }.
    // =========================================================
    [WebMethod]
    public void Class_ValidateGroups()
    {
        try
        {
        if (HttpContext.Current.Request.Cookies["UserData"] == null)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("[]");
            return;
        }
        string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
        int cfgId = Helper.ConvertToInt(cId);

        string sql = @"
SELECT
  ct.ClassTeacherId, ct.ClassId, ct.TeacherId,
  ISNULL(ct.Hakbatza,0) AS Hakbatza,
  c.ClassName,
  ISNULL(c.LayerId,0) AS LayerId,
  ISNULL(t.FirstName,'') + ' ' + ISNULL(t.LastName,'') AS TeacherName,
  ISNULL(t.FreeDay,0) AS FreeDay
FROM ClassTeacher ct
JOIN Class c ON c.ClassId = ct.ClassId
LEFT JOIN Teacher t ON t.TeacherId = ct.TeacherId
WHERE ct.ConfigurationId = " + cfgId + @"
  AND ISNULL(ct.Hakbatza,0) > 0";
        DataTable dt = Dal.GetDataTable(sql);

        // Group rows by Hakbatza key. Hakbatza is keyed by LayerId
        // (a "shchava" / grade level) so a single hakbatza spans the
        // selected classes in that grade — matching how Israeli schools
        // run level-grouped lessons in math/English.
        Dictionary<string, List<DataRow>> groups = new Dictionary<string, List<DataRow>>();
        Dictionary<string, int> numberByKey = new Dictionary<string, int>();
        foreach (DataRow r in dt.Rows)
        {
            int hak = Helper.ConvertToInt(r["Hakbatza"].ToString());
            if (hak > 0)
            {
                string k = "H_" + r["LayerId"].ToString() + "_" + hak;
                if (!groups.ContainsKey(k)) { groups[k] = new List<DataRow>(); numberByKey[k] = hak; }
                groups[k].Add(r);
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.Append("[");
        bool first = true;
        foreach (KeyValuePair<string, List<DataRow>> kv in groups)
        {
            int number = numberByKey[kv.Key];
            List<DataRow> members = kv.Value;

            // Check 1: common working day (1..5 are school days)
            HashSet<int> workingDaysIntersect = null;
            foreach (DataRow m in members)
            {
                int freeDay = Helper.ConvertToInt(m["FreeDay"].ToString());
                HashSet<int> working = new HashSet<int>();
                for (int d = 1; d <= 5; d++) if (d != freeDay) working.Add(d);
                if (workingDaysIntersect == null) workingDaysIntersect = working;
                else workingDaysIntersect.IntersectWith(working);
            }
            int commonDays = workingDaysIntersect != null ? workingDaysIntersect.Count : 0;

            string severity = "ok";
            string message = "";
            if (commonDays == 0)
            {
                severity = "error";
                message = "אין יום משותף לכל חברי הקבוצה (ימי חופשי חוסמים הכל)";
            }
            else if (commonDays <= 2)
            {
                severity = "warning";
                message = "רק " + commonDays + " ימים משותפים לכל החברים — סיכון גבוה";
            }

            // Hakbatza coherence — every member must share the same LayerId.
            // We already key by layer so a mixed-layer group can't form
            // here, but if a manual edit slipped through (e.g. via Gen_DML)
            // the layers set will give it away.
            HashSet<string> layers = new HashSet<string>();
            foreach (DataRow m in members) layers.Add(m["LayerId"].ToString());
            if (layers.Count > 1)
            {
                severity = "error";
                string extra = "הקבצה כוללת מורים מ-" + layers.Count + " שכבות שונות — הקבצה צריכה להיות בתוך שכבה אחת";
                message = string.IsNullOrEmpty(message) ? extra : (message + " · " + extra);
            }

            if (!first) sb.Append(",");
            first = false;
            sb.Append("{");
            sb.Append("\"Kind\":\"H\",");
            sb.Append("\"Number\":").Append(number).Append(",");
            sb.Append("\"MemberCount\":").Append(members.Count).Append(",");
            sb.Append("\"CommonDays\":").Append(commonDays).Append(",");
            sb.Append("\"Severity\":\"").Append(severity).Append("\",");
            sb.Append("\"Message\":\"").Append(message.Replace("\"", "'")).Append("\"");
            sb.Append("}");
        }
        sb.Append("]");

        HttpContext.Current.Response.Clear();
        HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
        HttpContext.Current.Response.Write(sb.ToString());
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.StatusCode = 200;
            string msg = (ex.Message ?? "").Replace("\"", "'").Replace("\n", " ").Replace("\r", " ");
            HttpContext.Current.Response.Write("[{\"Kind\":\"E\",\"Number\":0,\"MemberCount\":0,\"CommonDays\":0,\"Severity\":\"error\",\"Message\":\"" + msg + "\"}]");
        }
    }

    [WebMethod]
    public void Class_SetTeacherToClass()
    {

        string ClassId = GetParams("ClassId");
        string TeacherId = GetParams("TeacherId");
        string Hour = GetParams("Hour");

        string TargetHakbatza = GetParams("TargetHakbatza");
        string SourceHakbatza = GetParams("SourceHakbatza");
        string TargetIhud = GetParams("TargetIhud");
        string SourceIhud = GetParams("SourceIhud");
        string TargetClassTeacherId = GetParams("TargetClassTeacherId");
        string SourceClassTeacherId = GetParams("SourceClassTeacherId");
        string Type = GetParams("Type");


        DataTable dt = Dal.ExeSp("Class_SetTeacherToClass", ClassId, TeacherId, Hour,
            TargetHakbatza, SourceHakbatza, TargetIhud, SourceIhud,
            TargetClassTeacherId, SourceClassTeacherId, Type,
            HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);


        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    #endregion

    #region Assign



    // Serialise concurrent Assign_ShibutzAuto calls per configuration. Running
    // two in parallel leads to one deleting rows the other is reading, leaving
    // "0 saved" even though data exists. We lock on an object kept per
    // configId and refuse concurrent calls while a run is in progress.
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, object>
        _shibutzRunLocks = new System.Collections.Concurrent.ConcurrentDictionary<int, object>();

    [WebMethod(EnableSession = true)]
    public void Assign_ShibutzAuto()
    {
        // Use a per-configuration lock so only one scheduler can run at a
        // time. Concurrent runs race on DeleteAssignAuto / Save and lead to
        // empty results. Additional calls block until the first completes.
        int configurationId = Helper.ConvertToInt(
            HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]
        );
        object lockObj = _shibutzRunLocks.GetOrAdd(configurationId, _ => new object());
        lock (lockObj)
        {
        try
    {
        // Reset live progress status at the very beginning
        Shibutz.ResetLiveStatus(configurationId);

        // CRITICAL: Delete existing auto-assignments BEFORE running - prevents duplicates
        Dal.ExeSp("Assign_DeleteAssignAuto", "1", HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);

        DataSet ds = Dal.ExeDataSetSp("Assign_GetInitDataForShibutz", configurationId);

        Shibutz sh = new Shibutz(ds, configurationId);

        ShibutzRunResult r = sh.StartShibutz_SaveAlways();
        Shibutz.MarkLiveDone(configurationId);
        int saved = r.SavedCount;
        int reds = r.ErrorCount;

            // Persist progress log for UI
            try
            {
                if (HttpContext.Current != null && HttpContext.Current.Session != null)
                {
                    HttpContext.Current.Session["ShibutzProgressLog"] = sh.ProgressLog;
                }
            }
            catch { }

            // Store errors in session for JavaScript to retrieve - ALWAYS store, even if empty
            if (HttpContext.Current != null && HttpContext.Current.Session != null)
            {
                // Make sure we store the errors list - use the one from the Shibutz object
                // IMPORTANT: Get the errors AFTER StartShibutz_SaveAlways() completes
                List<ShibutzError> errorsToStore = sh.Errors != null ? sh.Errors : new List<ShibutzError>();
                
                // Verify we have the errors
                if (errorsToStore.Count != reds)
                {
                    // If counts don't match, use the count from the result
                    // This shouldn't happen, but let's be safe
                }
                
                HttpContext.Current.Session["ShibutzErrors"] = errorsToStore;
                HttpContext.Current.Session["ShibutzSavedCount"] = saved;
                HttpContext.Current.Session["ShibutzErrorCount"] = reds;
            }

            if (HttpContext.Current != null && HttpContext.Current.Response != null && ds != null && ds.Tables != null && ds.Tables.Count > 0)
            {
        HttpContext.Current.Response.Write(ConvertDataTabletoString(ds.Tables[0]));
    }
        }
        catch (Exception ex)
        {
            // Log error and return empty result
            try
            {
                if (HttpContext.Current != null && HttpContext.Current.Session != null)
                {
                    HttpContext.Current.Session["ShibutzErrors"] = new List<ShibutzError>();
                    HttpContext.Current.Session["ShibutzSavedCount"] = 0;
                    HttpContext.Current.Session["ShibutzErrorCount"] = 0;
                }
            }
            catch
            {
                // Ignore session errors
            }
            
            DataTable dt = new DataTable();
            if (HttpContext.Current != null && HttpContext.Current.Response != null)
            {
                HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
            }
        }
        } // end lock
    }

    [WebMethod(EnableSession = true)]
    public void Assign_ShibutzFixMissing()
    {
        try
        {
            int configurationId = Helper.ConvertToInt(
                HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]
            );

            // Load the init data (slots + candidates)
            DataSet ds = Dal.ExeDataSetSp("Assign_GetInitDataForShibutz", configurationId);

            // Load EXISTING assignments from DB (don't delete them!)
            DataTable existingAssignments = Dal.ExeSp("Assign_GetAssignment", "0", configurationId);

            // Build the model
            Shibutz sh = new Shibutz(ds, configurationId);

            // Run fix: load existing, fill only reds
            ShibutzRunResult r = sh.FixMissingSlots_SaveAlways(existingAssignments);
            int saved = r.SavedCount;
            int reds = r.ErrorCount;

            if (HttpContext.Current != null && HttpContext.Current.Session != null)
            {
                List<ShibutzError> errorsToStore = sh.Errors != null ? sh.Errors : new List<ShibutzError>();
                HttpContext.Current.Session["ShibutzErrors"] = errorsToStore;
                HttpContext.Current.Session["ShibutzSavedCount"] = saved;
                HttpContext.Current.Session["ShibutzErrorCount"] = reds;
            }

            if (HttpContext.Current != null && HttpContext.Current.Response != null && ds != null && ds.Tables != null && ds.Tables.Count > 0)
            {
                HttpContext.Current.Response.Write(ConvertDataTabletoString(ds.Tables[0]));
            }
        }
        catch (Exception ex)
        {
            try
            {
                if (HttpContext.Current != null && HttpContext.Current.Session != null)
                {
                    HttpContext.Current.Session["ShibutzErrors"] = new List<ShibutzError>();
                    HttpContext.Current.Session["ShibutzSavedCount"] = 0;
                    HttpContext.Current.Session["ShibutzErrorCount"] = 0;
                }
            }
            catch { }

            DataTable dt = new DataTable();
            if (HttpContext.Current != null && HttpContext.Current.Response != null)
            {
                HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
            }
        }
    }

    [WebMethod(EnableSession = true)]
    public void Assign_GetShibutzErrors()
    {
        try
        {
            List<ShibutzError> errors = HttpContext.Current.Session["ShibutzErrors"] as List<ShibutzError>;
            int savedCount = HttpContext.Current.Session["ShibutzSavedCount"] != null ? 
                (int)HttpContext.Current.Session["ShibutzSavedCount"] : 0;
            int errorCount = HttpContext.Current.Session["ShibutzErrorCount"] != null ? 
                (int)HttpContext.Current.Session["ShibutzErrorCount"] : 0;

            DataTable dtErrors = new DataTable();
            dtErrors.Columns.Add("ClassId", typeof(int));
            dtErrors.Columns.Add("ClassName", typeof(string));
            dtErrors.Columns.Add("Day", typeof(int));
            dtErrors.Columns.Add("Hour", typeof(int));
            dtErrors.Columns.Add("Message", typeof(string));
            dtErrors.Columns.Add("TeachersMissingHours", typeof(string));
            dtErrors.Columns.Add("SavedCount", typeof(int));
            dtErrors.Columns.Add("ErrorCount", typeof(int));

            // Get class names for all class IDs
            Dictionary<int, string> classNames = new Dictionary<int, string>();
            // Get teacher names for all teacher IDs
            Dictionary<int, string> teacherNames = new Dictionary<int, string>();
            if (errors != null && errors.Count > 0)
            {
                List<int> classIds = new List<int>();
                List<int> teacherIds = new List<int>();
                for (int i = 0; i < errors.Count; i++)
                {
                    if (errors[i] != null && errors[i].ClassId > 0)
                    {
                        if (!classIds.Contains(errors[i].ClassId))
                        {
                            classIds.Add(errors[i].ClassId);
                        }
                    }
                    // Collect teacher IDs from TeachersMissingHours
                    if (errors[i] != null && errors[i].TeachersMissingHours != null)
                    {
                        for (int j = 0; j < errors[i].TeachersMissingHours.Count; j++)
                        {
                            int tid = errors[i].TeachersMissingHours[j];
                            if (tid > 0 && !teacherIds.Contains(tid))
                            {
                                teacherIds.Add(tid);
                            }
                        }
                    }
                }
                
                // Get class names from database
                if (classIds.Count > 0)
                {
                    DataTable dtClasses = Dal.ExeSp("Class_GetAllClass", HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
                    if (dtClasses != null && dtClasses.Rows.Count > 0)
                    {
                        for (int i = 0; i < dtClasses.Rows.Count; i++)
                        {
                            int cid = 0;
                            if (dtClasses.Rows[i]["ClassId"] != null)
                            {
                                int.TryParse(dtClasses.Rows[i]["ClassId"].ToString(), out cid);
                            }
                            string cname = dtClasses.Rows[i]["ClassName"] != null ? dtClasses.Rows[i]["ClassName"].ToString() : "";
                            if (cid > 0 && !string.IsNullOrEmpty(cname))
                            {
                                classNames[cid] = cname;
                            }
                        }
                    }
                }
                
                // Get teacher names from database
                if (teacherIds.Count > 0)
                {
                    DataTable dtTeachers = Dal.ExeSp("Teacher_GetTeacherList", "", HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"], "", "");
                    if (dtTeachers != null && dtTeachers.Rows.Count > 0)
                    {
                        for (int i = 0; i < dtTeachers.Rows.Count; i++)
                        {
                            int tid = 0;
                            if (dtTeachers.Rows[i]["TeacherId"] != null)
                            {
                                int.TryParse(dtTeachers.Rows[i]["TeacherId"].ToString(), out tid);
                            }
                            string tname = "";
                            if (dtTeachers.Rows[i]["FullText"] != null)
                            {
                                tname = dtTeachers.Rows[i]["FullText"].ToString();
                            }
                            else if (dtTeachers.Rows[i]["FirstName"] != null && dtTeachers.Rows[i]["LastName"] != null)
                            {
                                tname = dtTeachers.Rows[i]["FirstName"].ToString() + " " + dtTeachers.Rows[i]["LastName"].ToString();
                            }
                            if (tid > 0 && !string.IsNullOrEmpty(tname))
                            {
                                teacherNames[tid] = tname;
                            }
                        }
                    }
                }
            }

            // Add all error rows
            if (errors != null && errors.Count > 0)
            {
                for (int i = 0; i < errors.Count; i++)
                {
                    ShibutzError err = errors[i];
                    if (err != null)
                    {
                        DataRow dr = dtErrors.NewRow();
                        dr["ClassId"] = err.ClassId;
                        dr["ClassName"] = classNames.ContainsKey(err.ClassId) ? classNames[err.ClassId] : ("כיתה " + err.ClassId);
                        dr["Day"] = err.Day;
                        dr["Hour"] = err.Hour;
                        // Fix encoding for Hebrew messages - ensure UTF-8
                        string message = err.Message != null ? err.Message : "";
                        // Replace teacher IDs with names in message
                        if (!string.IsNullOrEmpty(message) && teacherNames.Count > 0)
                        {
                            // Replace "מורה X" with teacher name
                            foreach (int tid in teacherNames.Keys)
                            {
                                string teacherIdStr = "מורה " + tid;
                                string teacherName = teacherNames[tid];
                                message = message.Replace(teacherIdStr, teacherName);
                            }
                        }
                        // Ensure the message is properly encoded as UTF-8
                        if (!string.IsNullOrEmpty(message))
                        {
                            // Convert to UTF-8 bytes and back to ensure proper encoding
                            byte[] messageBytes = System.Text.Encoding.UTF8.GetBytes(message);
                            message = System.Text.Encoding.UTF8.GetString(messageBytes);
                        }
                        dr["Message"] = message;
                        
                        // Build teachers missing hours list
                        string teachersMissingHoursStr = "";
                        if (err.TeachersMissingHours != null && err.TeachersMissingHours.Count > 0)
                        {
                            List<string> teacherNamesList = new List<string>();
                            for (int j = 0; j < err.TeachersMissingHours.Count; j++)
                            {
                                int tid = err.TeachersMissingHours[j];
                                if (teacherNames.ContainsKey(tid))
                                {
                                    teacherNamesList.Add(teacherNames[tid]);
                                }
                                else
                                {
                                    teacherNamesList.Add("מורה " + tid);
                                }
                            }
                            teachersMissingHoursStr = string.Join(", ", teacherNamesList.ToArray());
                        }
                        dr["TeachersMissingHours"] = teachersMissingHoursStr;
                        
                        dr["SavedCount"] = savedCount;
                        dr["ErrorCount"] = errorCount;
                        dtErrors.Rows.Add(dr);
                    }
                }
            }
            
            // Always add a summary row with counts at the END (so JavaScript can get counts even if no errors)
            // This row has ClassId=0 to mark it as summary
            DataRow summaryRow = dtErrors.NewRow();
            summaryRow["ClassId"] = 0;
            summaryRow["ClassName"] = "";
            summaryRow["Day"] = 0;
            summaryRow["Hour"] = 0;
            summaryRow["Message"] = "";
            summaryRow["TeachersMissingHours"] = "";
            summaryRow["SavedCount"] = savedCount;
            summaryRow["ErrorCount"] = errorCount;
            dtErrors.Rows.Add(summaryRow);

            // Set encoding for Hebrew text - MUST be set before writing
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Charset = "utf-8";
            HttpContext.Current.Response.ContentEncoding = System.Text.Encoding.UTF8;
            
            // Use ConvertDataTabletoString which handles encoding properly
            string jsonResult = ConvertDataTabletoString(dtErrors);
            HttpContext.Current.Response.Write(jsonResult);
        }
        catch (Exception ex)
        {
            // Return empty result on error
            DataTable dtErrors = new DataTable();
            dtErrors.Columns.Add("ClassId", typeof(int));
            dtErrors.Columns.Add("ClassName", typeof(string));
            dtErrors.Columns.Add("Day", typeof(int));
            dtErrors.Columns.Add("Hour", typeof(int));
            dtErrors.Columns.Add("Message", typeof(string));
            dtErrors.Columns.Add("TeachersMissingHours", typeof(string));
            dtErrors.Columns.Add("SavedCount", typeof(int));
            dtErrors.Columns.Add("ErrorCount", typeof(int));
            
            DataRow summaryRow = dtErrors.NewRow();
            summaryRow["ClassId"] = 0;
            summaryRow["ClassName"] = "";
            summaryRow["Day"] = 0;
            summaryRow["Hour"] = 0;
            summaryRow["Message"] = "";
            summaryRow["TeachersMissingHours"] = "";
            summaryRow["SavedCount"] = 0;
            summaryRow["ErrorCount"] = 0;
            dtErrors.Rows.Add(summaryRow);
            
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dtErrors));
        }
    }

   

    
    // =========================================================
    // Summary: how many weekly-schedule slots remain EMPTY.
    // A slot is (ClassId, HourId) where the class would have a lesson
    // but no teacher is assigned. This is the only error the admin
    // actually sees in the schedule grid.
    // =========================================================
    [WebMethod(EnableSession = true)]
    public void Assign_GetEmptySlotsCount()
    {
        try
        {
            string configId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cId = Helper.ConvertToInt(configId);
            string sql = @"
SELECT COUNT(*) AS EmptySlots FROM (
  SELECT c.ClassId, sh.HourId
  FROM Class c
  CROSS JOIN SchoolHours sh
  WHERE c.ConfigurationId = " + cId + @"
    AND sh.ConfigurationId = " + cId + @"
    AND (sh.IsOnlyShehya = 0 OR sh.IsOnlyShehya IS NULL)
  EXCEPT
  SELECT DISTINCT ClassId, HourId
  FROM TeacherAssignment
  WHERE ConfigurationId = " + cId + @" AND HourTypeId = 1
) e";
            DataTable dt = Dal.GetDataTable(sql);
            int empty = 0;
            if (dt.Rows.Count > 0) empty = Helper.ConvertToInt(dt.Rows[0]["EmptySlots"].ToString());
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"EmptySlots\":" + empty + "}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }



    // =========================================================
    // Live progress polling (no Session) - used while Assign_ShibutzAuto
    // is still running. Returns a snapshot: elapsed, current step,
    // total/red slot counts, per-class fill progress.
    // SessionState=Disabled so this doesn't block on the long-running request.
    // =========================================================
    // Signals the running scheduler to abort at the next safe checkpoint.
    // Does NOT block — returns immediately. The running Assign_ShibutzAuto
    // request will finish normally (with partial results) and the client
    // will see a regular response.
    [WebMethod]
    public void Assign_CancelShibutz()
    {
        try
        {
            int cId = Helper.ConvertToInt(HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
            Shibutz.RequestCancel(cId);
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Cancelled\":true}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    [WebMethod]
    public void Assign_GetShibutzLiveStatus()
    {
        try
        {
            int cId = Helper.ConvertToInt(HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
            ShibutzLiveStatus s = Shibutz.GetLiveStatus(cId);
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.ContentEncoding = System.Text.Encoding.UTF8;
            if (s == null)
            {
                HttpContext.Current.Response.Write("{\"IsRunning\":false}");
                return;
            }

            var sb = new System.Text.StringBuilder();
            sb.Append("{");
            sb.Append("\"IsRunning\":").Append(s.IsRunning ? "true" : "false");
            sb.Append(",\"ElapsedMs\":").Append(s.ElapsedMs);
            sb.Append(",\"TotalSlots\":").Append(s.TotalSlots);
            sb.Append(",\"RedSlots\":").Append(s.RedSlots);
            string step = s.CurrentStep ?? "";
            sb.Append(",\"CurrentStep\":\"").Append(step.Replace("\\", "\\\\").Replace("\"", "\\\"")).Append("\"");
            sb.Append(",\"Classes\":[");
            if (s.Classes != null)
            {
                for (int i = 0; i < s.Classes.Count; i++)
                {
                    ClassProgress cp = s.Classes[i];
                    if (i > 0) sb.Append(",");
                    sb.Append("{");
                    sb.Append("\"ClassId\":").Append(cp.ClassId);
                    string cn = cp.ClassName ?? "";
                    sb.Append(",\"ClassName\":\"").Append(cn.Replace("\\", "\\\\").Replace("\"", "\\\"")).Append("\"");
                    sb.Append(",\"TotalSlots\":").Append(cp.TotalSlots);
                    sb.Append(",\"FilledSlots\":").Append(cp.FilledSlots);
                    sb.Append("}");
                }
            }
            sb.Append("]}");
            HttpContext.Current.Response.Write(sb.ToString());
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // =========================================================
    // Shibutz progress log - returns step-by-step activity from the
    // last run for the UI to display to the admin ("איך זה עבד")
    // =========================================================
    [WebMethod(EnableSession = true)]
    public void Assign_GetShibutzProgress()
    {
        try
        {
            List<string> log = HttpContext.Current.Session["ShibutzProgressLog"] as List<string>;
            DataTable dt = new DataTable();
            dt.Columns.Add("Step", typeof(int));
            dt.Columns.Add("Message", typeof(string));
            if (log != null)
            {
                for (int i = 0; i < log.Count; i++)
                {
                    DataRow row = dt.NewRow();
                    row["Step"] = i + 1;
                    row["Message"] = log[i];
                    dt.Rows.Add(row);
                }
            }
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
        catch (Exception ex)
        {
            DataTable dt = new DataTable();
            dt.Columns.Add("Error", typeof(string));
            DataRow r = dt.NewRow();
            r["Error"] = ex.Message;
            dt.Rows.Add(r);
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
    }

    // =========================================================
    // Report-style diagnostic: returns missing teacher/class assignments
    // directly from the DB without relying on session state. Used by
    // AssignAuto.tsx to show a user-facing diagnostic after a run.
    // Returns: ClassId, ClassName, TeacherId, TeacherName, Required, Assigned, Missing,
    //          Hakbatza, Ihud, FreeDay, IsHomeroom, Reason
    // =========================================================
    [WebMethod(EnableSession = true)]
    public void Assign_GetShibutzDiagnostic()
    {
        try
        {
            string configId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cIdForDiag = Helper.ConvertToInt(configId);
            string sql = @"
SELECT
  ct.ClassId,
  c.Name AS ClassName,
  ct.TeacherId,
  ISNULL(t.FirstName,'') + ' ' + ISNULL(t.LastName,'') AS TeacherName,
  ct.Hour AS Required,
  ISNULL(ta.Assigned, 0) AS Assigned,
  (ct.Hour - ISNULL(ta.Assigned, 0)) AS Missing,
  ISNULL(ct.Hakbatza, 0) AS Hakbatza,
  ISNULL(ct.Ihud, 0) AS Ihud,
  ISNULL(t.FreeDay, 0) AS FreeDay,
  CASE WHEN t.ManageClassId = ct.ClassId THEN 1 ELSE 0 END AS IsHomeroom,
  (SELECT SUM(Hour) FROM ClassTeacher WHERE TeacherId=ct.TeacherId AND ConfigurationId=" + cIdForDiag + @") AS TotalRequiredAllClasses,
  -- Total work hours defined in TeacherHours (including hours that don't exist in SchoolHours)
  (SELECT COUNT(*) FROM TeacherHours WHERE TeacherId=ct.TeacherId AND ConfigurationId=" + cIdForDiag + @") AS DefinedHourSlots,
  -- Only count hours that EXIST in SchoolHours (and aren't shehya-only)
  (SELECT COUNT(*) FROM TeacherHours th
     INNER JOIN SchoolHours sh ON sh.HourId = th.HourId AND sh.ConfigurationId = th.ConfigurationId
     WHERE th.TeacherId = ct.TeacherId
       AND th.ConfigurationId = " + cIdForDiag + @"
       AND (sh.IsOnlyShehya = 0 OR sh.IsOnlyShehya IS NULL)) AS AvailableHourSlots
FROM ClassTeacher ct
LEFT JOIN (
  SELECT ClassId, TeacherId, COUNT(*) AS Assigned
  FROM TeacherAssignment
  WHERE ConfigurationId=" + cIdForDiag + @" AND HourTypeId=1
  GROUP BY ClassId, TeacherId
) ta ON ta.ClassId=ct.ClassId AND ta.TeacherId=ct.TeacherId
LEFT JOIN Teacher t ON t.TeacherId=ct.TeacherId
LEFT JOIN Class c ON c.ClassId=ct.ClassId
WHERE ct.ConfigurationId=" + cIdForDiag + @"
  AND (ct.Hour - ISNULL(ta.Assigned, 0)) > 0
ORDER BY Missing DESC, ct.ClassId, ct.TeacherId
";
            DataTable dt = Dal.GetDataTable(sql);
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Charset = "utf-8";
            HttpContext.Current.Response.ContentEncoding = System.Text.Encoding.UTF8;
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
        catch (Exception ex)
        {
            DataTable dt = new DataTable();
            dt.Columns.Add("ErrorMessage", typeof(string));
            DataRow r = dt.NewRow();
            r["ErrorMessage"] = ex.Message;
            dt.Rows.Add(r);
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
    }

    // =========================================================
    // Teacher capacity report: highlights teachers whose required hours
    // across all classes exceed their available working hours. The admin
    // must either add working hours OR reduce required hours.
    // =========================================================
    [WebMethod(EnableSession = true)]
    public void Assign_GetTeacherCapacityReport()
    {
        try
        {
            string configId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cId = Helper.ConvertToInt(configId);
            string sql = @"
SELECT
  t.TeacherId,
  ISNULL(t.FirstName,'') + ' ' + ISNULL(t.LastName,'') AS TeacherName,
  ISNULL((SELECT SUM(Hour) FROM ClassTeacher WHERE TeacherId=t.TeacherId AND ConfigurationId=" + cId + @"), 0) AS TotalRequired,
  ISNULL((SELECT COUNT(*) FROM TeacherHours WHERE TeacherId=t.TeacherId AND ConfigurationId=" + cId + @"), 0) AS AvailableHourSlots,
  ISNULL(t.FreeDay, 0) AS FreeDay,
  ISNULL(t.ManageClassId, 0) AS ManageClassId
FROM Teacher t
WHERE t.ConfigurationId=" + cId + @"
  AND ISNULL((SELECT SUM(Hour) FROM ClassTeacher WHERE TeacherId=t.TeacherId AND ConfigurationId=" + cId + @"), 0) > 0
  AND ISNULL((SELECT SUM(Hour) FROM ClassTeacher WHERE TeacherId=t.TeacherId AND ConfigurationId=" + cId + @"), 0) >=
      ISNULL((SELECT COUNT(*) FROM TeacherHours WHERE TeacherId=t.TeacherId AND ConfigurationId=" + cId + @"), 0) - 1
ORDER BY (TotalRequired - AvailableHourSlots) DESC";
            DataTable dt = Dal.GetDataTable(sql);
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
        catch (Exception ex)
        {
            DataTable dt = new DataTable();
            dt.Columns.Add("ErrorMessage", typeof(string));
            DataRow r = dt.NewRow();
            r["ErrorMessage"] = ex.Message;
            dt.Rows.Add(r);
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
    }

    // =========================================================
    // Lists teachers who still have free working hours after the
    // schedule is built — i.e. TeacherHours rows that didn't end up
    // in TeacherAssignment. Shown in the post-run report so the admin
    // can see which teachers have unused capacity. Each row carries a
    // CSV of the unassigned HourIds; the client splits it into
    // day/hour pairs (HourId is dayDigit + sequence).
    // =========================================================
    [WebMethod(EnableSession = true)]
    public void Assign_GetTeacherUnusedHours()
    {
        try
        {
            string configId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cId = Helper.ConvertToInt(configId);
            string sql = @"
SELECT
  t.TeacherId,
  ISNULL(t.FirstName,'') + ' ' + ISNULL(t.LastName,'') AS TeacherName,
  -- Working hours that actually correspond to a real, non-shehya school slot
  defined.DefinedHours,
  -- Slots already taken by a real assignment (HourTypeId = 1)
  ISNULL(used.UsedHours, 0) AS UsedHours,
  defined.DefinedHours - ISNULL(used.UsedHours, 0) AS UnusedHours,
  -- CSV of free HourIds, sorted; client splits into day/hour for display
  STUFF((
    SELECT ',' + CAST(th.HourId AS VARCHAR(10))
    FROM TeacherHours th
    INNER JOIN SchoolHours sh
      ON sh.HourId = th.HourId AND sh.ConfigurationId = th.ConfigurationId
    WHERE th.TeacherId = t.TeacherId
      AND th.ConfigurationId = " + cId + @"
      AND (sh.IsOnlyShehya = 0 OR sh.IsOnlyShehya IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM TeacherAssignment ta
        WHERE ta.TeacherId = th.TeacherId
          AND ta.HourId = th.HourId
          AND ta.ConfigurationId = th.ConfigurationId
          AND ta.HourTypeId = 1
      )
    ORDER BY th.HourId
    FOR XML PATH(''), TYPE
  ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS UnusedHourIds
FROM Teacher t
INNER JOIN (
  SELECT th.TeacherId, COUNT(*) AS DefinedHours
  FROM TeacherHours th
  INNER JOIN SchoolHours sh
    ON sh.HourId = th.HourId AND sh.ConfigurationId = th.ConfigurationId
  WHERE th.ConfigurationId = " + cId + @"
    AND (sh.IsOnlyShehya = 0 OR sh.IsOnlyShehya IS NULL)
  GROUP BY th.TeacherId
) defined ON defined.TeacherId = t.TeacherId
LEFT JOIN (
  SELECT TeacherId, COUNT(DISTINCT HourId) AS UsedHours
  FROM TeacherAssignment
  WHERE ConfigurationId = " + cId + @" AND HourTypeId = 1
  GROUP BY TeacherId
) used ON used.TeacherId = t.TeacherId
WHERE t.ConfigurationId = " + cId + @"
  AND defined.DefinedHours - ISNULL(used.UsedHours, 0) > 0
ORDER BY UnusedHours DESC, TeacherName";
            DataTable dt = Dal.GetDataTable(sql);
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Charset = "utf-8";
            HttpContext.Current.Response.ContentEncoding = System.Text.Encoding.UTF8;
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
        catch (Exception ex)
        {
            DataTable dt = new DataTable();
            dt.Columns.Add("ErrorMessage", typeof(string));
            DataRow r = dt.NewRow();
            r["ErrorMessage"] = ex.Message;
            dt.Rows.Add(r);
            HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
    }

    // =========================================================
    // Force-assign Smart: tries FIRST to displace another teacher
    // from a conflicting slot if the missing teacher CAN teach that slot
    // but an unrelated teacher is currently there. Falls back to the
    // simple force logic otherwise.
    // =========================================================

    // =========================================================
    // Analyze current scheduling gaps and return concrete
    // resolution proposals the admin can approve (or reject).
    //
    // Returns JSON:
    // {
    //   TotalMissing: int,
    //   AffectedTeachers: int,
    //   Proposals: {
    //     ClearFreeDayTeachers:   [ {TeacherId, Name, FreeDay, Missing}, ... ],
    //     ReduceClassTeacherRows: [ {ClassTeacherKey, ClassName, TeacherName, From, To}, ... ],
    //     SyncHakbatzaFreeDay:    [ {GroupKey, MajorityFreeDay, Members: [...] }, ... ]
    //   }
    // }
    // =========================================================
    [WebMethod(EnableSession = true)]
    public void Assign_GetConflictResolutions()
    {
        try
        {
            string configId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cId = Helper.ConvertToInt(configId);

            // Reuse the diagnostic query (unmet ClassTeacher requirements).
            // Pull LayerId so Hakbatza groups can be keyed by grade level.
            string sqlDiag = @"
SELECT ct.ClassId, ct.TeacherId,
  ISNULL(c.Name,'') AS ClassName,
  ISNULL(c.LayerId,0) AS LayerId,
  ISNULL(t.FirstName,'')+' '+ISNULL(t.LastName,'') AS TeacherName,
  ct.Hour AS Required,
  ISNULL(ta.Assigned,0) AS Assigned,
  ct.Hour - ISNULL(ta.Assigned,0) AS Missing,
  ISNULL(t.FreeDay,0) AS FreeDay,
  ISNULL(ct.Hakbatza,0) AS Hakbatza
FROM ClassTeacher ct
LEFT JOIN (
  SELECT ClassId, TeacherId, COUNT(*) AS Assigned
  FROM TeacherAssignment
  WHERE ConfigurationId=" + cId + @" AND HourTypeId=1
  GROUP BY ClassId, TeacherId
) ta ON ta.ClassId=ct.ClassId AND ta.TeacherId=ct.TeacherId
LEFT JOIN Teacher t ON t.TeacherId=ct.TeacherId
LEFT JOIN Class c ON c.ClassId=ct.ClassId
WHERE ct.ConfigurationId=" + cId + @"
  AND (ct.Hour - ISNULL(ta.Assigned,0)) > 0";
            DataTable dt = Dal.GetDataTable(sqlDiag);

            // Build proposals
            HashSet<int> seenTeachers = new HashSet<int>();
            List<string> clearFreeDay = new List<string>();
            List<string> reduceCT = new List<string>();
            // Hakbatza groups: key = "classId_hakbatza" OR "ihud_X"
            Dictionary<string, List<int[]>> hakGroups = new Dictionary<string, List<int[]>>();
            int totalMissing = 0;
            for (int i = 0; i < dt.Rows.Count; i++)
            {
                int classId = Helper.ConvertToInt(dt.Rows[i]["ClassId"].ToString());
                int teacherId = Helper.ConvertToInt(dt.Rows[i]["TeacherId"].ToString());
                string className = dt.Rows[i]["ClassName"].ToString();
                string teacherName = dt.Rows[i]["TeacherName"].ToString().Trim();
                int required = Helper.ConvertToInt(dt.Rows[i]["Required"].ToString());
                int assigned = Helper.ConvertToInt(dt.Rows[i]["Assigned"].ToString());
                int missing = Helper.ConvertToInt(dt.Rows[i]["Missing"].ToString());
                int freeDay = Helper.ConvertToInt(dt.Rows[i]["FreeDay"].ToString());
                int hak = Helper.ConvertToInt(dt.Rows[i]["Hakbatza"].ToString());
                int layerId = Helper.ConvertToInt(dt.Rows[i]["LayerId"].ToString());
                totalMissing += missing;

                // Proposal 1: clear FreeDay for teachers with missing hours (unique per teacher)
                if (freeDay >= 1 && freeDay <= 6 && !seenTeachers.Contains(teacherId))
                {
                    seenTeachers.Add(teacherId);
                    int teacherMissingTotal = 0;
                    for (int k = 0; k < dt.Rows.Count; k++)
                    {
                        if (Helper.ConvertToInt(dt.Rows[k]["TeacherId"].ToString()) == teacherId)
                            teacherMissingTotal += Helper.ConvertToInt(dt.Rows[k]["Missing"].ToString());
                    }
                    clearFreeDay.Add(
                        "{\"TeacherId\":" + teacherId +
                        ",\"Name\":\"" + Esc(teacherName) + "\"" +
                        ",\"FreeDay\":" + freeDay +
                        ",\"Missing\":" + teacherMissingTotal + "}");
                }

                // Proposal 2: reduce ClassTeacher row to what's actually achievable
                reduceCT.Add(
                    "{\"ClassId\":" + classId +
                    ",\"TeacherId\":" + teacherId +
                    ",\"ClassName\":\"" + Esc(className) + "\"" +
                    ",\"TeacherName\":\"" + Esc(teacherName) + "\"" +
                    ",\"From\":" + required +
                    ",\"To\":" + assigned +
                    ",\"Delta\":" + missing + "}");

                // Proposal 3: hakbatza groups to sync.
                // Hakbatza is keyed by LayerId (grade level), not ClassId,
                // so all teachers in the same hakbatza across the grade
                // share the same group.
                string gk = hak > 0 ? ("H_" + layerId + "_" + hak) : null;
                if (gk != null)
                {
                    if (!hakGroups.ContainsKey(gk)) hakGroups[gk] = new List<int[]>();
                    hakGroups[gk].Add(new int[] { teacherId, freeDay });
                }
            }

            // Build hakbatza sync proposal (only groups with 2+ distinct FreeDays)
            List<string> syncHak = new List<string>();
            foreach (var kv in hakGroups)
            {
                HashSet<int> fds = new HashSet<int>();
                foreach (var m in kv.Value) fds.Add(m[1]);
                if (fds.Count < 2) continue;       // already synced
                // majority / mode FreeDay (ignore 0 = no free day when possible)
                Dictionary<int, int> counts = new Dictionary<int, int>();
                foreach (var m in kv.Value)
                {
                    if (!counts.ContainsKey(m[1])) counts[m[1]] = 0;
                    counts[m[1]]++;
                }
                int best = -1, bestCnt = -1;
                foreach (var c in counts) if (c.Value > bestCnt) { bestCnt = c.Value; best = c.Key; }

                System.Text.StringBuilder members = new System.Text.StringBuilder();
                members.Append("[");
                for (int i = 0; i < kv.Value.Count; i++)
                {
                    if (i > 0) members.Append(",");
                    members.Append("{\"TeacherId\":").Append(kv.Value[i][0])
                           .Append(",\"FreeDay\":").Append(kv.Value[i][1]).Append("}");
                }
                members.Append("]");

                syncHak.Add("{\"GroupKey\":\"" + Esc(kv.Key) + "\"" +
                            ",\"MajorityFreeDay\":" + best +
                            ",\"Members\":" + members.ToString() + "}");
            }

            var sb = new System.Text.StringBuilder();
            sb.Append("{\"TotalMissing\":").Append(totalMissing);
            sb.Append(",\"AffectedTeachers\":").Append(seenTeachers.Count);
            sb.Append(",\"Proposals\":{");
            sb.Append("\"ClearFreeDayTeachers\":[").Append(string.Join(",", clearFreeDay.ToArray())).Append("]");
            sb.Append(",\"ReduceClassTeacherRows\":[").Append(string.Join(",", reduceCT.ToArray())).Append("]");
            sb.Append(",\"SyncHakbatzaFreeDay\":[").Append(string.Join(",", syncHak.ToArray())).Append("]");
            sb.Append("}}");

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.ContentEncoding = System.Text.Encoding.UTF8;
            HttpContext.Current.Response.Write(sb.ToString());
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // Apply the admin-approved resolutions: takes 3 boolean flags
    // (ClearFreeDay / ReduceCT / SyncHakbatza) and performs the corresponding
    // UPDATEs. Returns the counts actually changed.
    [WebMethod(EnableSession = true)]
    public void Assign_ApplyConflictResolutions()
    {
        try
        {
            string configId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cId = Helper.ConvertToInt(configId);

            bool doClearFD = GetParams("ClearFreeDay") == "1";
            bool doReduceCT = GetParams("ReduceCT") == "1";
            bool doSyncHak = GetParams("SyncHakbatza") == "1";

            int clearedFD = 0, reducedCT = 0, syncedFD = 0;

            // 1. Clear FreeDay for teachers who still have missing hours
            if (doClearFD)
            {
                string sqlClear = @"
UPDATE Teacher
SET FreeDay = NULL
WHERE ConfigurationId=" + cId + @"
  AND ISNULL(FreeDay,0) BETWEEN 1 AND 6
  AND TeacherId IN (
    SELECT DISTINCT ct.TeacherId
    FROM ClassTeacher ct
    LEFT JOIN (
      SELECT ClassId, TeacherId, COUNT(*) AS Asgn
      FROM TeacherAssignment
      WHERE ConfigurationId=" + cId + @" AND HourTypeId=1
      GROUP BY ClassId, TeacherId
    ) ta ON ta.ClassId=ct.ClassId AND ta.TeacherId=ct.TeacherId
    WHERE ct.ConfigurationId=" + cId + @"
      AND (ct.Hour - ISNULL(ta.Asgn,0)) > 0
  )";
                clearedFD = Dal.ExecuteNonQuery(sqlClear);
            }

            // 2. Reduce ClassTeacher.Hour to match what was actually assigned
            if (doReduceCT)
            {
                string sqlReduce = @"
UPDATE ct
SET Hour = ct.Hour - (ct.Hour - ISNULL(ta.Asgn,0))
FROM ClassTeacher ct
LEFT JOIN (
  SELECT ClassId, TeacherId, COUNT(*) AS Asgn
  FROM TeacherAssignment
  WHERE ConfigurationId=" + cId + @" AND HourTypeId=1
  GROUP BY ClassId, TeacherId
) ta ON ta.ClassId=ct.ClassId AND ta.TeacherId=ct.TeacherId
WHERE ct.ConfigurationId=" + cId + @"
  AND (ct.Hour - ISNULL(ta.Asgn,0)) > 0";
                reducedCT = Dal.ExecuteNonQuery(sqlReduce);
            }

            // 3. Sync FreeDay within hakbatza/ihud groups to the majority value
            if (doSyncHak)
            {
                string sqlGroups = @"
SELECT ct.ClassId, ct.TeacherId, ISNULL(t.FreeDay,0) AS FD,
  ISNULL(ct.Hakbatza,0) AS Hak,
  ISNULL(c.LayerId,0) AS LayerId
FROM ClassTeacher ct
INNER JOIN Teacher t ON t.TeacherId=ct.TeacherId
LEFT JOIN Class c ON c.ClassId=ct.ClassId
WHERE ct.ConfigurationId=" + cId + @"
  AND ISNULL(ct.Hakbatza,0) > 0";
                DataTable dtG = Dal.GetDataTable(sqlGroups);
                Dictionary<string, List<int[]>> groups = new Dictionary<string, List<int[]>>();
                for (int i = 0; i < dtG.Rows.Count; i++)
                {
                    int teacherId = Helper.ConvertToInt(dtG.Rows[i]["TeacherId"].ToString());
                    int fd = Helper.ConvertToInt(dtG.Rows[i]["FD"].ToString());
                    int hak = Helper.ConvertToInt(dtG.Rows[i]["Hak"].ToString());
                    int layerId = Helper.ConvertToInt(dtG.Rows[i]["LayerId"].ToString());
                    // Hakbatza keyed by LayerId so a sync covers the
                    // whole grade level, not just one class.
                    string gk = "H_" + layerId + "_" + hak;
                    if (!groups.ContainsKey(gk)) groups[gk] = new List<int[]>();
                    groups[gk].Add(new int[] { teacherId, fd });
                }
                foreach (var kv in groups)
                {
                    // pick majority FreeDay
                    Dictionary<int, int> cnts = new Dictionary<int, int>();
                    foreach (var m in kv.Value)
                    {
                        if (!cnts.ContainsKey(m[1])) cnts[m[1]] = 0;
                        cnts[m[1]]++;
                    }
                    if (cnts.Count < 2) continue; // already synced
                    int best = 0, bestCnt = -1;
                    foreach (var c in cnts) if (c.Value > bestCnt) { bestCnt = c.Value; best = c.Key; }
                    foreach (var m in kv.Value)
                    {
                        if (m[1] == best) continue;
                        string sqlU = best >= 1 && best <= 6
                            ? "UPDATE Teacher SET FreeDay=" + best + " WHERE TeacherId=" + m[0] + " AND ConfigurationId=" + cId
                            : "UPDATE Teacher SET FreeDay=NULL WHERE TeacherId=" + m[0] + " AND ConfigurationId=" + cId;
                        try { syncedFD += Dal.ExecuteNonQuery(sqlU); } catch { }
                    }
                }
            }

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write(
                "{\"ClearedFreeDay\":" + clearedFD +
                ",\"ReducedClassTeacher\":" + reducedCT +
                ",\"SyncedHakbatzaFreeDay\":" + syncedFD + "}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    private static string Esc(string s)
    {
        if (s == null) return "";
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", " ").Replace("\r", " ");
    }

    [WebMethod(EnableSession = true)]
    public void Assign_ShibutzForceSmart()
    {
        try
        {
            string configId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cId = Helper.ConvertToInt(configId);

            string sqlMissing = @"
SELECT ct.ClassId, ct.TeacherId, (ct.Hour - ISNULL(ta.Assigned, 0)) AS Missing,
       ISNULL(ct.Hakbatza, 0) AS Hakbatza, ISNULL(ct.Ihud, 0) AS Ihud
FROM ClassTeacher ct
LEFT JOIN (
  SELECT ClassId, TeacherId, COUNT(*) AS Assigned
  FROM TeacherAssignment
  WHERE ConfigurationId=" + cId + @" AND HourTypeId=1
  GROUP BY ClassId, TeacherId
) ta ON ta.ClassId=ct.ClassId AND ta.TeacherId=ct.TeacherId
WHERE ct.ConfigurationId=" + cId + @"
  AND (ct.Hour - ISNULL(ta.Assigned, 0)) > 0";
            DataTable dtMissing = Dal.GetDataTable(sqlMissing);

            int forced = 0;
            int displaced = 0;
            SqlConnection con = Dal.OpenConnection();
            try
            {
                for (int i = 0; i < dtMissing.Rows.Count; i++)
                {
                    int classId = Helper.ConvertToInt(dtMissing.Rows[i]["ClassId"].ToString());
                    int teacherId = Helper.ConvertToInt(dtMissing.Rows[i]["TeacherId"].ToString());
                    int missing = Helper.ConvertToInt(dtMissing.Rows[i]["Missing"].ToString());
                    int hak = Helper.ConvertToInt(dtMissing.Rows[i]["Hakbatza"].ToString());
                    int ihu = Helper.ConvertToInt(dtMissing.Rows[i]["Ihud"].ToString());

                    // Get teacher's professional id
                    DataTable dtProf = Dal.GetDataTable("SELECT TOP 1 ProfessionalId FROM Teacher WHERE TeacherId=" + teacherId);
                    int prof = 0;
                    if (dtProf.Rows.Count > 0) prof = Helper.ConvertToInt(dtProf.Rows[0]["ProfessionalId"].ToString());

                    int remainingToFill = missing;

                    // Stage 1: simple force (empty slot)
                    string sqlEmptySlots = @"
SELECT sh.HourId FROM SchoolHours sh
INNER JOIN TeacherHours th ON th.HourId=sh.HourId AND th.TeacherId=" + teacherId + @" AND th.ConfigurationId=" + cId + @"
WHERE sh.ConfigurationId=" + cId + @" AND (sh.IsOnlyShehya=0 OR sh.IsOnlyShehya IS NULL)
  AND NOT EXISTS (SELECT 1 FROM TeacherAssignment ta WHERE ta.ConfigurationId=" + cId + @" AND ta.HourId=sh.HourId AND ta.ClassId=" + classId + @" AND ta.HourTypeId=1)
  AND NOT EXISTS (SELECT 1 FROM TeacherAssignment ta2 WHERE ta2.ConfigurationId=" + cId + @" AND ta2.TeacherId=" + teacherId + @" AND ta2.HourId=sh.HourId AND ta2.HourTypeId=1)
ORDER BY sh.HourId";
                    DataTable dtEmpty = Dal.GetDataTable(sqlEmptySlots);
                    for (int s = 0; s < dtEmpty.Rows.Count && remainingToFill > 0; s++)
                    {
                        int hourId = Helper.ConvertToInt(dtEmpty.Rows[s]["HourId"].ToString());
                        Dal.ExeSpBig(con, "Assign_SetAssignAuto", cId, teacherId, hourId, 1, classId, prof, hak, ihu);
                        forced++;
                        remainingToFill--;
                    }

                    if (remainingToFill <= 0) continue;

                    // Stage 2: displace another teacher from a conflicting slot
                    // Find slots (classId, hourId) where: teacher X works at that hour,
                    // the slot is filled by a different teacher Y, and teacher Y has
                    // alternatives.
                    string sqlConflict = @"
SELECT sh.HourId, ta.TeacherId AS BusyTeacher, ta.AssignmentId
FROM SchoolHours sh
INNER JOIN TeacherHours th ON th.HourId=sh.HourId AND th.TeacherId=" + teacherId + @" AND th.ConfigurationId=" + cId + @"
INNER JOIN TeacherAssignment ta ON ta.HourId=sh.HourId AND ta.ClassId=" + classId + @" AND ta.ConfigurationId=" + cId + @" AND ta.HourTypeId=1
WHERE sh.ConfigurationId=" + cId + @"
  AND ta.TeacherId <> " + teacherId + @"
  AND NOT EXISTS (SELECT 1 FROM TeacherAssignment ta2 WHERE ta2.ConfigurationId=" + cId + @" AND ta2.TeacherId=" + teacherId + @" AND ta2.HourId=sh.HourId AND ta2.HourTypeId=1)
ORDER BY sh.HourId";
                    DataTable dtConflict = Dal.GetDataTable(sqlConflict);
                    for (int s = 0; s < dtConflict.Rows.Count && remainingToFill > 0; s++)
                    {
                        int hourId = Helper.ConvertToInt(dtConflict.Rows[s]["HourId"].ToString());
                        int busyTeacherId = Helper.ConvertToInt(dtConflict.Rows[s]["BusyTeacher"].ToString());
                        int assignmentId = Helper.ConvertToInt(dtConflict.Rows[s]["AssignmentId"].ToString());

                        // Don't displace homeroom teacher at hour 1 of own class (sacred)
                        DataTable dtHomeroom = Dal.GetDataTable("SELECT TOP 1 ManageClassId FROM Teacher WHERE TeacherId=" + busyTeacherId);
                        if (dtHomeroom.Rows.Count > 0)
                        {
                            int mcId = Helper.ConvertToInt(dtHomeroom.Rows[0]["ManageClassId"].ToString());
                            if (mcId == classId && (hourId % 10) == 1) continue;
                        }

                        // Delete the blocker
                        Dal.ExecuteNonQuery("DELETE FROM TeacherAssignment WHERE AssignmentId=" + assignmentId);
                        // Insert the missing teacher
                        Dal.ExeSpBig(con, "Assign_SetAssignAuto", cId, teacherId, hourId, 1, classId, prof, hak, ihu);
                        forced++;
                        displaced++;
                        remainingToFill--;
                    }
                }
            }
            finally { Dal.CloseConnection(con); }

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Forced\":" + forced + ",\"Displaced\":" + displaced + "}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // =========================================================
    // Force-assign: relaxed version that tries to stuff any remaining
    // missing teacher/class pair into the first free (teacher-hour, class-slot)
    // without respecting consecutive / lock constraints.
    // =========================================================
    [WebMethod(EnableSession = true)]
    public void Assign_ShibutzForce()
    {
        try
        {
            string configId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cId = Helper.ConvertToInt(configId);

            // Find all (ClassId, TeacherId) that still need hours
            string sql = @"
SELECT ct.ClassId, ct.TeacherId, (ct.Hour - ISNULL(ta.Assigned, 0)) AS Missing
FROM ClassTeacher ct
LEFT JOIN (
  SELECT ClassId, TeacherId, COUNT(*) AS Assigned
  FROM TeacherAssignment
  WHERE ConfigurationId=" + cId + @" AND HourTypeId=1
  GROUP BY ClassId, TeacherId
) ta ON ta.ClassId=ct.ClassId AND ta.TeacherId=ct.TeacherId
WHERE ct.ConfigurationId=" + cId + @"
  AND (ct.Hour - ISNULL(ta.Assigned, 0)) > 0";
            DataTable dtMissing = Dal.GetDataTable(sql);

            int forced = 0;
            SqlConnection con = Dal.OpenConnection();
            try
            {
                for (int i = 0; i < dtMissing.Rows.Count; i++)
                {
                    int classId = Helper.ConvertToInt(dtMissing.Rows[i]["ClassId"].ToString());
                    int teacherId = Helper.ConvertToInt(dtMissing.Rows[i]["TeacherId"].ToString());
                    int missing = Helper.ConvertToInt(dtMissing.Rows[i]["Missing"].ToString());

                    // Find hours this teacher works AND class has a slot, and class is not already assigned
                    string sqlSlots = @"
SELECT TOP " + missing + @" sh.HourId
FROM SchoolHours sh
INNER JOIN TeacherHours th ON th.HourId = sh.HourId AND th.TeacherId = " + teacherId + @" AND th.ConfigurationId = " + cId + @"
WHERE sh.ConfigurationId = " + cId + @"
  AND (sh.IsOnlyShehya = 0 OR sh.IsOnlyShehya IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM TeacherAssignment ta
    WHERE ta.ConfigurationId = " + cId + @"
      AND ta.HourId = sh.HourId
      AND ta.ClassId = " + classId + @"
      AND ta.HourTypeId = 1
      AND ta.TeacherId = " + teacherId + @"
  )
  AND NOT EXISTS (
    SELECT 1 FROM TeacherAssignment ta2
    WHERE ta2.ConfigurationId = " + cId + @"
      AND ta2.HourId = sh.HourId
      AND ta2.ClassId = " + classId + @"
      AND ta2.HourTypeId = 1
  )
ORDER BY sh.HourId";
                    DataTable dtSlots = Dal.GetDataTable(sqlSlots);
                    for (int s = 0; s < dtSlots.Rows.Count; s++)
                    {
                        int hourId = Helper.ConvertToInt(dtSlots.Rows[s]["HourId"].ToString());
                        // Get ProfessionalId/Hakbatza/Ihud from ClassTeacher if possible
                        string sqlInfo = "SELECT TOP 1 Hakbatza, Ihud FROM ClassTeacher WHERE ClassId=" + classId + " AND TeacherId=" + teacherId + " AND ConfigurationId=" + cId;
                        DataTable dtInfo = Dal.GetDataTable(sqlInfo);
                        int hak = 0, ihu = 0;
                        if (dtInfo.Rows.Count > 0)
                        {
                            hak = Helper.ConvertToInt(dtInfo.Rows[0]["Hakbatza"].ToString());
                            ihu = Helper.ConvertToInt(dtInfo.Rows[0]["Ihud"].ToString());
                        }
                        string sqlProf = "SELECT TOP 1 ProfessionalId FROM Teacher WHERE TeacherId=" + teacherId;
                        DataTable dtProf = Dal.GetDataTable(sqlProf);
                        int prof = 0;
                        if (dtProf.Rows.Count > 0) prof = Helper.ConvertToInt(dtProf.Rows[0]["ProfessionalId"].ToString());

                        Dal.ExeSpBig(con, "Assign_SetAssignAuto", cId, teacherId, hourId, 1, classId, prof, hak, ihu);
                        forced++;
                    }
                }
            }
            finally { Dal.CloseConnection(con); }

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Forced\":" + forced + "}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    // =========================================================
    // Fill ALL remaining empty cells in the schedule grid with
    // any available teacher, ignoring ClassTeacher demand.
    // For each (ClassId, HourId) that's empty:
    //   1. Prefer the homeroom teacher of that class (if free and has TeacherHours at that hour).
    //   2. Else pick the least-loaded teacher with TeacherHours at that hour and free at (Day, Hour).
    // Used as a final pass after Assign_ShibutzAuto so the school grid has no "אין שיבוץ" cells.
    // =========================================================
    [WebMethod(EnableSession = true)]
    public void Assign_FillEmptySlots()
    {
        try
        {
            string configId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
            int cId = Helper.ConvertToInt(configId);

            // 1) Find all empty cells: every (Class, SchoolHours) without a TeacherAssignment of HourTypeId=1.
            string sqlEmpty = @"
SELECT c.ClassId, sh.HourId, ISNULL(t.TeacherId, 0) AS HomeroomTeacherId
FROM Class c
CROSS JOIN SchoolHours sh
LEFT JOIN Teacher t ON t.ManageClassId = c.ClassId AND t.ConfigurationId = " + cId + @"
WHERE c.ConfigurationId = " + cId + @"
  AND sh.ConfigurationId = " + cId + @"
  AND (sh.IsOnlyShehya = 0 OR sh.IsOnlyShehya IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM TeacherAssignment ta
    WHERE ta.ConfigurationId = " + cId + @"
      AND ta.HourId = sh.HourId
      AND ta.ClassId = c.ClassId
      AND ta.HourTypeId = 1
  )
ORDER BY c.ClassId, sh.HourId";
            DataTable dtEmpty = Dal.GetDataTable(sqlEmpty);

            int filled = 0;
            int stillEmpty = 0;
            SqlConnection con = Dal.OpenConnection();
            SqlTransaction tx = null;
            try
            {
                tx = con.BeginTransaction();

                for (int i = 0; i < dtEmpty.Rows.Count; i++)
                {
                    int classId = Helper.ConvertToInt(dtEmpty.Rows[i]["ClassId"].ToString());
                    int hourId = Helper.ConvertToInt(dtEmpty.Rows[i]["HourId"].ToString());
                    int homeroomId = Helper.ConvertToInt(dtEmpty.Rows[i]["HomeroomTeacherId"].ToString());

                    // 2) Pick a teacher: homeroom first if available, else least-loaded teacher.
                    string sqlPick = @"
SELECT TOP 1 t.TeacherId, t.ProfessionalId,
  CASE WHEN t.ManageClassId = " + classId + @" THEN 0 ELSE 1 END AS HomeroomRank,
  ISNULL((SELECT COUNT(*) FROM TeacherAssignment ta2
          WHERE ta2.TeacherId = t.TeacherId AND ta2.ConfigurationId = " + cId + @"), 0) AS LoadCount
FROM Teacher t
INNER JOIN TeacherHours th ON th.TeacherId = t.TeacherId AND th.HourId = " + hourId + @" AND th.ConfigurationId = " + cId + @"
WHERE t.ConfigurationId = " + cId + @"
  AND NOT EXISTS (
    SELECT 1 FROM TeacherAssignment tb
    WHERE tb.ConfigurationId = " + cId + @"
      AND tb.HourId = " + hourId + @"
      AND tb.TeacherId = t.TeacherId
  )
ORDER BY HomeroomRank ASC, LoadCount ASC, t.TeacherId ASC";
                    DataTable dtPick = Dal.GetDataTable(con, tx, sqlPick);
                    if (dtPick.Rows.Count == 0)
                    {
                        stillEmpty++;
                        continue;
                    }

                    int teacherId = Helper.ConvertToInt(dtPick.Rows[0]["TeacherId"].ToString());
                    int prof = Helper.ConvertToInt(dtPick.Rows[0]["ProfessionalId"].ToString());

                    Dal.ExeSpBigNonQuery(con, tx, "Assign_SetAssignAuto", cId, teacherId, hourId, 1, classId, prof, 0, 0);
                    filled++;
                    // unused homeroomId - prefix-compiler hint
                    if (homeroomId == 0) { /* class without homeroom - covered by HomeroomRank ordering */ }
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

            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Filled\":" + filled + ",\"StillEmpty\":" + stillEmpty + "}");
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
        }
    }

    [WebMethod]
    public void Assign_GetDataForAssignAuto()
    {



        string LayerId = GetParams("LayerId");
        DataSet ds = Dal.ExeDataSetSp("Assign_GetDataForAssignAuto", LayerId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);


        AssignAuto aa = new AssignAuto(ds);
        bool isFinish = aa.StartAssign();

        //int counter = 0;
        //if (isFinish)
        //{
        //    DataTable dt = Dal.ExeSp("Class_GetClassStatus", HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        //    foreach (DataRow item in dt.Rows)
        //    {
        //        if (item["ClassId"].ToString() != "" && item["ClassHour"].ToString() != "38")
        //        {
        //            counter++;

        //            // Assign_GetDataForAssignAuto();

        //        }

        //    }

        //  //  if(counter!=0) Assign_GetDataForAssignAuto();
        //}

        HttpContext.Current.Response.Write(ConvertDataTabletoString(ds.Tables[0]));
    }

    [WebMethod]
    public void Assign_DeleteAssignAuto()
    {


        string IsAuto = GetParams("IsAuto");
        DataTable dt = Dal.ExeSp("Assign_DeleteAssignAuto", IsAuto, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);

        //  AssignAuto aa = new AssignAuto(ds);
        // aa.StartAssign();


        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }





    [WebMethod]
    public void Assign_GetFreeTeacher()
    {


        string ClassId = GetParams("ClassId");
        DataTable dt = Dal.ExeSp("Assign_GetFreeTeacher", ClassId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    // =========================================================
    // Returns teachers who are a plausible fit for at least ONE
    // empty (ClassId, HourId) slot in the current configuration.
    // A "fit" means: the teacher teaches that class (row in
    // ClassTeacher), has that hour in TeacherHours (i.e., works
    // at that time), and is not already assigned somewhere else
    // at the same hour. Used by the "הצג הכל" shortcut in the
    // Assign page so the dock never lists irrelevant teachers.
    // =========================================================
    [WebMethod]
    public void Assign_GetFreeTeachersForEmpty()
    {
        try
        {
        if (HttpContext.Current.Request.Cookies["UserData"] == null)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("[]");
            return;
        }
        string cId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
        int cfgId = Helper.ConvertToInt(cId);

        // Pre-aggregated set approach avoids O(teachers × classes × hours)
        // nested NOT EXISTS — the previous version timed out.
        string sql = @"
;WITH filled AS (
  SELECT DISTINCT ClassId, HourId FROM TeacherAssignment
  WHERE ConfigurationId = " + cfgId + @" AND HourTypeId = 1
),
busyTeacher AS (
  SELECT DISTINCT TeacherId, HourId FROM TeacherAssignment
  WHERE ConfigurationId = " + cfgId + @" AND HourTypeId = 1
)
SELECT DISTINCT
  t.TeacherId,
  ISNULL(t.FirstName,'') + ' ' + ISNULL(t.LastName,'') AS TeacherName,
  '' AS FreeHour
FROM Teacher t
INNER JOIN ClassTeacher ct
  ON ct.TeacherId = t.TeacherId
 AND ct.ConfigurationId = t.ConfigurationId
INNER JOIN TeacherHours th
  ON th.TeacherId = t.TeacherId
 AND th.ConfigurationId = t.ConfigurationId
INNER JOIN SchoolHours sh
  ON sh.HourId = th.HourId
 AND sh.ConfigurationId = t.ConfigurationId
 AND (sh.IsOnlyShehya = 0 OR sh.IsOnlyShehya IS NULL)
LEFT JOIN filled f
  ON f.ClassId = ct.ClassId AND f.HourId = th.HourId
LEFT JOIN busyTeacher bt
  ON bt.TeacherId = t.TeacherId AND bt.HourId = th.HourId
WHERE t.ConfigurationId = " + cfgId + @"
  AND f.ClassId IS NULL    -- (class, hour) slot is empty
  AND bt.TeacherId IS NULL -- teacher isn't busy elsewhere at that hour
ORDER BY TeacherName";
        DataTable dt = Dal.GetDataTable(sql);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
        }
        catch (Exception ex)
        {
            HttpContext.Current.Response.Clear();
            HttpContext.Current.Response.ContentType = "application/json; charset=utf-8";
            HttpContext.Current.Response.Write("[{\"Error\":\"" + ex.Message.Replace("\"", "'") + "\"}]");
        }
    }
    [WebMethod]
    public void Assign_GetAssignment()
    {


        string LayerId = GetParams("LayerId");
        DataTable dt = Dal.ExeSp("Assign_GetAssignment", LayerId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Assign_SetConfiguration()
    {
        string MaxHourInShibutz = GetParams("MaxHourInShibutz");
        string MinForPitzul = GetParams("MinForPitzul");


        DataTable dt = Dal.ExeSp("Assign_SetConfiguration", MaxHourInShibutz, MinForPitzul, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Assign_GetAllTeacherOptional()
    {
        string ClassId = GetParams("ClassId");
        string HourId = GetParams("HourId");


        DataTable dt = Dal.ExeSp("Assign_GetAllTeacherOptional", ClassId, HourId, HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }

    [WebMethod]
    public void Assign_GetTeacherHoursPerClass()
    {
        string teacherId = GetParams("TeacherId");
        string configId = HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"];
        int tid = 0;
        int.TryParse(teacherId, out tid);
        if (tid <= 0)
        {
            HttpContext.Current.Response.Write("[]");
            return;
        }
        try
        {
            DataTable dt = Dal.ExeSp("Assign_GetTeacherHoursPerClass", tid, configId);
            if (dt != null && dt.Rows.Count > 0)
            {
                HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
                return;
            }
        }
        catch { }
        try
        {
            DataSet ds = Dal.ExeDataSetSp("Assign_GetInitDataForShibutz", configId);
            DataTable slots = ds.Tables.Count > 0 ? ds.Tables[0] : null;
            Dictionary<int, string> classNames = new Dictionary<int, string>();
            if (slots != null && slots.Columns.Contains("ClassId") && slots.Columns.Contains("Name"))
                foreach (DataRow r in slots.Rows)
                {
                    int cid;
                    if (int.TryParse(r["ClassId"].ToString(), out cid) && !classNames.ContainsKey(cid) && r["Name"] != null && r["Name"] != DBNull.Value)
                        classNames[cid] = r["Name"].ToString();
                }
            Dictionary<string, int> expected = new Dictionary<string, int>();
            if (slots != null && slots.Columns.Contains("ClassId") && slots.Columns.Contains("TeachList"))
            {
                foreach (DataRow row in slots.Rows)
                {
                    int classId;
                    if (!int.TryParse(row["ClassId"].ToString(), out classId)) continue;
                    string teachList = (row["TeachList"] == null || row["TeachList"] == DBNull.Value) ? "" : row["TeachList"].ToString();
                    if (string.IsNullOrEmpty(teachList)) continue;
                    foreach (string item in teachList.Split(','))
                    {
                        string t = item.Trim();
                        if (string.IsNullOrEmpty(t)) continue;
                        string[] parts = t.Split('-');
                        if (parts.Length < 2) continue;
                        int tId = 0, hours = 0;
                        int.TryParse(parts[0], out tId);
                        int.TryParse(parts[1], out hours);
                        if (tId != tid) continue;
                        string key = classId + "_" + tId;
                        if (!expected.ContainsKey(key) || expected[key] < hours) expected[key] = hours;
                    }
                }
            }
            DataTable assign = Dal.ExeSp("Assign_GetAssignment", "0", configId);
            Dictionary<string, int> assigned = new Dictionary<string, int>();
            if (assign != null && assign.Columns.Contains("TeacherId") && assign.Columns.Contains("ClassId"))
            {
                foreach (DataRow r in assign.Rows)
                {
                    int rTid;
                    if (!int.TryParse(r["TeacherId"].ToString(), out rTid) || rTid != tid) continue;
                    int cId;
                    if (!int.TryParse(r["ClassId"].ToString(), out cId)) continue;
                    string key = cId + "_" + rTid;
                    if (!assigned.ContainsKey(key)) assigned[key] = 0;
                    assigned[key]++;
                }
            }
            DataTable result = new DataTable();
            result.Columns.Add("TeacherId", typeof(int));
            result.Columns.Add("TeacherName", typeof(string));
            result.Columns.Add("ClassId", typeof(int));
            result.Columns.Add("ClassName", typeof(string));
            result.Columns.Add("ExpectedHours", typeof(int));
            result.Columns.Add("AssignedHours", typeof(int));
            DataTable teacherData = Dal.ExeSp("Teacher_GetAllTeacherHours", teacherId, configId);
            string teacherName = "";
            if (teacherData != null && teacherData.Rows.Count > 0 && teacherData.Columns.Contains("TeacherName"))
                teacherName = teacherData.Rows[0]["TeacherName"].ToString();
            HashSet<int> classIds = new HashSet<int>();
            foreach (string k in expected.Keys) { string[] p = k.Split('_'); if (p.Length >= 2) classIds.Add(int.Parse(p[0])); }
            foreach (string k in assigned.Keys) { string[] p = k.Split('_'); if (p.Length >= 2) classIds.Add(int.Parse(p[0])); }
            foreach (int cId in classIds)
            {
                string key = cId + "_" + tid;
                int exp = expected.ContainsKey(key) ? expected[key] : 0;
                int ass = assigned.ContainsKey(key) ? assigned[key] : 0;
                if (exp <= 0 && ass <= 0) continue;
                DataRow dr = result.NewRow();
                dr["TeacherId"] = tid;
                dr["TeacherName"] = teacherName;
                dr["ClassId"] = cId;
                dr["ClassName"] = classNames.ContainsKey(cId) ? classNames[cId] : cId.ToString();
                dr["ExpectedHours"] = exp;
                dr["AssignedHours"] = ass;
                result.Rows.Add(dr);
            }
            HttpContext.Current.Response.Write(ConvertDataTabletoString(result));
        }
        catch
        {
            HttpContext.Current.Response.Write("[]");
        }
    }





    [WebMethod]
    public void HourExtra_DML()
    {
        string Type = GetParams("Type");
        string HourExtraId = GetParams("HourExtraId");
        string TeacherId = GetParams("TeacherId");
        string ClassId = GetParams("ClassId");
        string DayId = GetParams("DayId");
        string HourExtra = GetParams("HourExtra");

        DataTable dt = Dal.ExeSp("HourExtra_DML", Type, HourExtraId,
            TeacherId, ClassId, DayId, HourExtra,
            HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }



    [WebMethod]
    public void Assign_SetAssignManual()
    {




        string Type = GetParams("Type");

        string SourceId = GetParams("SourceId");
        string SourceTeacherId = GetParams("SourceTeacherId");
        string SourceClassId = GetParams("SourceClassId");
        string SourceHourId = GetParams("SourceHourId");
        string SourceProfessionalId = GetParams("SourceProfessionalId");
        string SourceHakbatza = GetParams("SourceHakbatza");
        string SourceIhud = GetParams("SourceIhud");

        string TargetId = GetParams("TargetId");
        string TargetTeacherId = GetParams("TargetTeacherId");
        string TargetClassId = GetParams("TargetClassId");
        string TargetHourId = GetParams("TargetHourId");
        string TargetProfessionalId = GetParams("TargetProfessionalId");
        string TargetHakbatza = GetParams("TargetHakbatza");
        string TargetIhud = GetParams("TargetIhud");



        DataTable dt = Dal.ExeSp("Assign_SetAssignManual", Type,
            SourceId, SourceTeacherId, SourceClassId, SourceHourId, SourceProfessionalId, SourceHakbatza, SourceIhud,
           TargetId, TargetTeacherId, TargetClassId, TargetHourId, TargetProfessionalId, TargetHakbatza, TargetIhud,
            HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);
        HttpContext.Current.Response.Write(ConvertDataTabletoString(dt));
    }



    #endregion

    #region Upload

    [WebMethod]
    public void UploadFile()
    {
        string SchoolId = GetParams("SchoolId");
        string path = HttpContext.Current.Server.MapPath("~/assets/images/SchoolLogo/");

        string[] fileEntries = Directory.GetFiles(path);
        foreach (string fileName in fileEntries)
        {
            if (fileName.Contains(SchoolId + "_"))
            {
                try
                {
                    File.Delete(fileName);

                }
                catch (Exception ex)
                {

                }
            }

        }






        var httpPostedFile = HttpContext.Current.Request.Files["File"];

        httpPostedFile.SaveAs(path + SchoolId + "_.png");


    }


    [WebMethod]
    public void DeleteFile()
    {

        string SchoolId = GetParams("SchoolId");
        string path = HttpContext.Current.Server.MapPath("~/assets/images/SchoolLogo/");

        string[] fileEntries = Directory.GetFiles(path);
        foreach (string fileName in fileEntries)
        {
            if (fileName.Contains(SchoolId + "_"))
            {
                try
                {
                    File.Delete(fileName);

                }
                catch (Exception ex)
                {

                }
            }

        }

    }


    #endregion


    private bool GetParamsIfExist(string Param)
    {
        try
        {
            HttpContext.Current.Request.Form[Param].ToString();
            return true;

        }
        catch (Exception ex)
        {


            return false;
        }
    }

    private string GetParamsValueIfExist(string Param)
    {
        try
        {

            return HttpContext.Current.Request.Form[Param].ToString();

        }
        catch (Exception ex)
        {


            return "";
        }
    }

    private string GetParams(string Param)
    {
        return HttpContext.Current.Request.Form[Param].ToString();
    }

    public static string ConvertDataTabletoString(DataTable dt)
    {
        System.Web.Script.Serialization.JavaScriptSerializer serializer = new System.Web.Script.Serialization.JavaScriptSerializer();
        List<Dictionary<string, object>> rows = new List<Dictionary<string, object>>();
        Dictionary<string, object> row;
        foreach (DataRow dr in dt.Rows)
        {
            row = new Dictionary<string, object>();
            foreach (DataColumn col in dt.Columns)
            {
                object value = dr[col];
                // Ensure Hebrew strings are properly encoded
                if (value != null && value is string)
                {
                    string strValue = value.ToString();
                    // Keep the string as-is - JavaScriptSerializer will handle UTF-8 encoding
                    row.Add(col.ColumnName, strValue);
                }
                else
                {
                    row.Add(col.ColumnName, value);
                }
            }
            rows.Add(row);
        }
        return serializer.Serialize(rows);
    }

}
