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



    [WebMethod(EnableSession = true)]
    public void Assign_ShibutzAuto()
    {
        try
    {
        // to do add paremter ConfigId

        int configurationId = Helper.ConvertToInt(
        HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]
      );

        // CRITICAL: Delete existing auto-assignments BEFORE running - prevents duplicates
        Dal.ExeSp("Assign_DeleteAssignAuto", "1", HttpContext.Current.Request.Cookies["UserData"]["ConfigurationId"]);

        DataSet ds = Dal.ExeDataSetSp("Assign_GetInitDataForShibutz", configurationId);

        Shibutz sh = new Shibutz(ds, configurationId);

        ShibutzRunResult r = sh.StartShibutz_SaveAlways();
        int saved = r.SavedCount;
        int reds = r.ErrorCount;

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
