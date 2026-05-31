using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Net.Mail;
using System.Configuration;

/// <summary>
/// Summary description for SendEmail
/// </summary>
public static class SendEmail
{
    //public SendEmail()
    //{
    //    //
    //    // TODO: Add constructor logic here
    //    //
    //}


    public static void SendEmailExecute(string Area,string WorkerName, string ShiftCode,string Date,
        string Creator, string Reason, string Comment, string AddEmail1, string AddEmail2, string OrgUnitCode)
    {
        SmtpClient SmtpServer = new SmtpClient();
        MailMessage actMSG = new MailMessage();

        // הגדרות SMTP נקראות מ-web.config (appSettings). נשמרים ערכי ברירת מחדל זהים למקור
        // כדי לשמור על התנהגות קיימת גם אם המפתחות חסרים (שליחת המייל אחרת תיכשל בשקט).
        string smtpHost = ConfigurationManager.AppSettings["Smtp.Host"] ?? "EX-ASHDOD.paz.local";
        int smtpPort;
        if (!int.TryParse(ConfigurationManager.AppSettings["Smtp.Port"], out smtpPort)) smtpPort = 25;
        string mail_user = ConfigurationManager.AppSettings["Smtp.User"] ?? "wrk_mirkam";
        string mail_pass = ConfigurationManager.AppSettings["Smtp.Password"] ?? "mp123$";
        string mail_from = ConfigurationManager.AppSettings["Smtp.From"] ?? "wrk_mirkam@pazar.co.il";

        SmtpServer.Host = smtpHost;
        SmtpServer.Port = smtpPort;
        SmtpServer.UseDefaultCredentials = false;

        string ManagerName = "";

        SmtpServer.Credentials = new System.Net.NetworkCredential(mail_user, mail_pass);


        actMSG.IsBodyHtml = true;



        actMSG.Subject = "קריאה מיוחדת - " + Area + " - " + WorkerName;
        actMSG.Body = String.Format("{0}", "<div  style='direction:rtl; font-family: Arial, Helvetica, sans-serif;'>"
                                            + " שלום רב, " + ManagerName + "<br>"
                                           // + "היום הגיע תאריך סיום משוער למעקף שהגדרת בתאריך - <b>" + WriteDate + "</b><br><br>"
                                            + "<b><u> להלן פרטי קריאה מיוחדת: </u></b><br><br>"

                                            + "<b>תאריך: </b>" + Date + "<br>" 
                                            + "<b>אזור: </b>" + Area + "<br>"
                                            + "<b>משמרת: </b>" + ShiftCode + "<br>"
                                            + "<b>שם עובד: </b>" + WorkerName + "<br>"
                                            + "<b>יוזם: </b>" + Creator + "<br>"
                                            + "<b>סיבה: </b>" + Reason + "<br>"
                                            
                                            + "<b>הערות: </b>" + Comment + "<br><br>"
                                            + "<font style='color:red;'>מייל זה הינו אוטמטי ולא ניתן להשבה!</font>"
                                            + "</div><br>");

      
       
        actMSG.To.Add("hzachiel@pazar.co.il");
        
        actMSG.To.Add("eavivit@pazar.co.il");



        // *********************** פרודקשן *****************
        
        //actMSG.To.Add("Mavner@pazar.co.il");
        
        //// אזורים ללא תומר
        //if (OrgUnitCode != "20000011" && OrgUnitCode !="20000016" && OrgUnitCode !="20000017")  
        //{
        //    actMSG.To.Add("mtomer@pazar.co.il");

        //}


        //if (!string.IsNullOrEmpty(AddEmail1))
        //{
        //    actMSG.To.Add(AddEmail1);
        //}


        //if (!string.IsNullOrEmpty(AddEmail2))
        //{
        //    actMSG.To.Add(AddEmail2);
        //}

        // *********************** פרודקשן *****************


        actMSG.From = new MailAddress(mail_from);

        SmtpServer.Send(actMSG);
        actMSG.Dispose();
    }
}