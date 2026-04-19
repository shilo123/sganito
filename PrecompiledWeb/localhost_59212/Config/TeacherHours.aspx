<%@ page title="" language="C#" masterpagefile="~/MasterPage/MasterPage.master" autoeventwireup="true" inherits="Config_TeacherHours, App_Web_scaj0hwx" %>

<asp:Content ID="Content1" ContentPlaceHolderID="head" runat="Server">
    <script type="text/javascript" src="../assets/js/jquery-ui.js"></script>
    <link href="../assets/css/jquery-ui.css" rel="stylesheet" type="text/css" />
    <link href="../assets/css/rtl-css/typeahead.js-bootstrap.css" rel="stylesheet" type="text/css" />


    <link rel="stylesheet" href="../assets/css/plugins/icheck/skins/all.css">


    <script src="../assets/js/icheck.min.js"></script>
    <script src="../assets/js/bootstrap3-typeahead.min.js" type="text/javascript"></script>
    <script src="../assets/js/DownloadWord/FileSaver.js"></script>
    <script src="../assets/js/DownloadWord/jquery.wordexport.js"></script>

    <script type="text/javascript">

        var mydata;
        var TeacherData;
        var SelectedTeacherId = "";
        var SelectedFirstName = "";
        var SelectedLastName = "";
        var SelectedTafkidId = "";
        var SelectedEmail = "";


        var SelectedFreeDay = "";
        var SelectedFrontaly = "";
        var SelectedTz = "";
        var SelectedShehya = "";
        var SelectedPartani = "";
        var SelectedProfessionalId = "";
        var SelectedType = "";


        $(document).ready(function () {



            $('input.typeahead').focus();

            // mydata = Ajax("Gen_GetTable", "TableName=SchoolHours&Condition=ConfigurationId=" + ConfigurationId);

            $('#dvAllDays').hide();

            // 

            GetComboItems("Tafkid", "", "#ddlTafkid", "TafkidId", "Name");
            GetComboItems("Professional", "ConfigurationId=" + ConfigurationId, "#ddlProfessional", "ProfessionalId", "Name");

            $('input.typeahead').change(function () {

                if (!$('input.typeahead').val()) {
                    resetTeacher();
                }

            });

            $('input.typeahead').keyup(function (e) {

                if (e.keyCode == 8) {
                    resetTeacher();
                }

                //if (!$(this).val())
                //    resetTeacher();
                //if (!$('input.typeahead').val()) {

                //}

            });





            InitAutoComplete();


            //for dev
            //  SelectedTeacherId = 1;
            // BuildTeacherLooz();
            //



            $('input[type=radio][name=checkUncheck]').change(function () {

                if (this.value == "checkAll") {
                    $('.icheck-blue').prop("checked", true);

                } else {
                    $('.icheck-blue').prop("checked", false);
                }

                $('input.icheck-blue').iCheck({
                    checkboxClass: 'icheckbox_flat-blue',
                    radioClass: 'iradio_flat-blue',
                    increaseArea: '20%' // optional
                });

            });

            BuildTeacherTable();



        });


        function OpenTeacherData(Name,Id) {

            //InitAutoComplete();
            $('input.typeahead').val(Name);
           
            for (var i = 0; i < TeacherData.length; i++) {

                if (TeacherData[i].TeacherId == Id) {
                    item = TeacherData[i];

                    SelectedTeacherId = item.TeacherId;
                    SelectedFirstName = item.FirstName;
                    SelectedLastName = item.LastName;
                    SelectedTafkidId = item.TafkidId;
                    SelectedEmail = item.Email;
                    SelectedFreeDay = item.FreeDay;
                    SelectedFrontaly = item.Frontaly;
                    SelectedProfessionalId = item.ProfessionalId;
                    SelectedTz = item.Tz;
                    SelectedShehya = item.Shehya;
                    SelectedPartani = item.Partani;
                    BuildTeacherLooz();

                    break;

                }
            }

          //  alert(Id);

          




        }


        function BuildTeacherTable() {



            $("#dvReqContainer").html("");
            var ReqHtml = "";

            mydata = TeacherData;



            for (var i = 0; i < mydata.length; i++) {

                ReqHtml = $("#dvReqTemplate").html();

                ReqHtml = ReqHtml.replace(/@TeacherId/g, IsNullDB(mydata[i].TeacherId));
                ReqHtml = ReqHtml.replace(/@FullText/g, IsNullDB(mydata[i].FullText));
                ReqHtml = ReqHtml.replace("@Tafkid", IsNullDB(mydata[i].Tafkid));
                ReqHtml = ReqHtml.replace("@Professional", IsNullDB(mydata[i].Professional));

                ReqHtml = ReqHtml.replace("@FreeDay", getDayInWeekString(IsNullDB(mydata[i].FreeDay)));
                ReqHtml = ReqHtml.replace("@Shehya", IsNullDB(mydata[i].Shehya));
                ReqHtml = ReqHtml.replace("@Partani", IsNullDB(mydata[i].Partani));


                $("#dvReqContainer").append(ReqHtml);


            }


        }


        function resetTeacher() {
            $('input.typeahead').val("");
            SelectedTeacherId = "";
            $('.spTeacherName').text("");
            BuildTeacherLooz();

        }

        function InitAutoComplete() {

            TeacherData = Ajax("Teacher_GetTeacherList", "TeacherId=");
            $('input.typeahead').typeahead({
                items: 15,
                source: function (query, process) {
                    states = [];
                    map = {};


                    $.each(TeacherData, function (i, state) {
                        map[state.FullText] = state;
                        states.push(state.FullText);
                    });

                    process(states);
                },

                updater: function (item) {
                   
                    SelectedTeacherId = map[item].TeacherId;
                    SelectedFirstName = map[item].FirstName;
                    SelectedLastName = map[item].LastName;
                    SelectedTafkidId = map[item].TafkidId;
                    SelectedEmail = map[item].Email;
                    SelectedFreeDay = map[item].FreeDay;
                    SelectedFrontaly = map[item].Frontaly;
                    SelectedProfessionalId = map[item].ProfessionalId;
                    SelectedTz = map[item].Tz;
                    SelectedShehya = map[item].Shehya;
                    SelectedPartani = map[item].Partani;
                    BuildTeacherLooz();
                    return item;
                }


            });

        }

        function BuildTeacherLooz() {

            if (SelectedTeacherId) {
                $('.spTeacherName').text(SelectedFirstName + " " + SelectedLastName);


                $('#spFrontalyTotals').text(SelectedFrontaly);

                BuildMatrixHours();

                $('#dvAllDays').show();
            } else {

                $('#dvAllDays').hide();

            }
        }

        function BuildMatrixHours() {


            $("#dv1,#dv2,#dv3,#dv4,#dv5,#dv6").html("");


            var mydata = Ajax("Teacher_GetTeacherHours", "TeacherId=" + SelectedTeacherId);

            for (var i = 0; i < mydata.length; i++) {

                var HourId = mydata[i].HourId;
                var HourTypeId = mydata[i].HourTypeId;
                var HourType = mydata[i].HourType;
                //   var Comment = mydata[i].Comment;
                var HourOnly = HourId.toString().substring(1);
                var dvDay = HourId.toString().substring(0, 1);

                var ClassNameAssign = mydata[i].ClassNameAssign;

                //  var className = (mydata[i].ClassNameAssign) ? mydata[i].ClassNameAssign : "";
                var classHalf = (mydata[i].className) ? mydata[i].className : "";
                var j = i;

                while (mydata[j + 1] && mydata[j].ClassId != mydata[j + 1].ClassId
                    && mydata[j].HourId == mydata[j + 1].HourId) {



                    classHalf += "/" + mydata[j + 1].className;

                    j++;

                    ClassNameAssign = classHalf;
                }







                var Professional = mydata[i].Professional;

                if (HourTypeId == 1) {

                    if (!Professional) {
                        Professional = "מקצוע";

                    }
                    HourType = ClassNameAssign + " - " + Professional;

                }


                $("#dv" + dvDay).append("<div HourTypeId=" + HourTypeId + "  class='dv_HourTypeId_" + HourTypeId + "' id=" + HourId + "><span class='spSeqNumber'>" + HourOnly + ") "
                    + "<span HourTypeId=" + HourTypeId + " id='spHourType_" + HourId + "'>" + HourType + "</span></span>&nbsp;</div>");

                i = j;

            }

            InitSelectableNGN(mydata, "HourIdTeacaher");

            DefineRightClickEVENT();
        }

        function CallBackAdd(ObjId) {


            var mydata = Ajax("Teacher_SetTeacherHours", "TeacherId=" + SelectedTeacherId + "&HourId=" + ObjId + "&Type=1");

            DefineRightClickEVENT();

            return true;

        }

        function CallBackRemove(ObjId) {

            if ($("#spHourType_" + ObjId).text())
                return false;


            var mydata = Ajax("Teacher_SetTeacherHours", "TeacherId=" + SelectedTeacherId + "&HourId=" + ObjId + "&Type=2");

            DefineRightClickEVENT();

            return true;

        }


        function OpenUpdateTeacher(Type) {

            if (!SelectedTeacherId && Type != "2") {
                bootbox.alert("חובה לבחור מורה בכדי לעדכן נתונים");
                return;
            }

            SelectedType = Type;

            // עדכון
            if (Type == "1") {

                $("#ddlTafkid").val(SelectedTafkidId);
                $("#ddlProfessional").val(SelectedProfessionalId);


                $("#txtFirstName").val(SelectedFirstName);
                $("#txtLastName").val(SelectedLastName);
                $("#txtEmail").val(SelectedEmail);
                $("#txtFrontaly").val(SelectedFrontaly);
                $("#ddlFreeDay").val(SelectedFreeDay);

                $("#txtTz").val(SelectedTz);
                $("#txtShehya").val(SelectedShehya)
                $("#txtPartani").val(SelectedPartani);



                $("#spModalTitle").html("עדכון פרטי מורה - " + SelectedFirstName + " " + SelectedLastName);
                $("#ModalTeacher").modal();
            }

            // הוספה
            if (Type == "2") {



                $("#ddlTafkid").val("0");
                $("#ddlProfessional").val("0");
                $("#txtFirstName").val("");
                $("#txtLastName").val("");
                $("#txtEmail").val("");
                $("#txtFrontaly").val("");
                $("#ddlFreeDay").val("0");

                $("#txtTz").val("");
                $("#txtShehya").val("")
                $("#txtPartani").val("");

                $("#spModalTitle").html(" הוספת מורה חדש/ה ");
                $("#ModalTeacher").modal();
            }

            //מחיקה
            if (Type == "3") {
                // bootbox.confirm("האם אתה בטוח שברצונך למחוק מורה עם השיבוצים שלו?", ConfirmDelete);

                bootbox.confirm("האם אתה בטוח שברצונך למחוק מורה עם השיבוצים שלו?", function (result) {
                    if (result) {

                        SaveData();
                        resetTeacher();

                    }
                });

            }


        }

        function SaveData() {




            var Tafkid = $("#ddlTafkid").val();
            var FirstName = $("#txtFirstName").val();
            var LastName = $("#txtLastName").val();
            var Email = $("#txtEmail").val();
            var Frontaly = $("#txtFrontaly").val();
            var FreeDay = $("#ddlFreeDay").val();

            var Tz = $("#txtTz").val();

            var Shehya = $("#txtShehya").val();
            var Partani = $("#txtPartani").val();

            var ProfessionalId = $("#ddlProfessional").val();

            //   alert(Frontaly + ' ' + FreeDay);

            if (SelectedType != "3" && (Tafkid == "0" || !FirstName || !LastName || !Frontaly)) {
                bootbox.alert("בחירת תפקיד שם ושם משפחה והגדרות שעות פרונטלי הינם שדות חובה");
                return;
            }


            var res = Ajax("Teacher_DML", "TeacherId=" + SelectedTeacherId + "&Tafkid=" + Tafkid
                + "&FirstName=" + FirstName + "&LastName=" + LastName + "&Email=" + Email
                + "&Frontaly=" + Frontaly + "&FreeDay=" + FreeDay

                + "&Tz=" + Tz + "&Shehya=" + Shehya + "&Partani=" + Partani + "&ProfessionalId=" + ProfessionalId

                + "&Type=" + SelectedType);

            // אם חדש
            if (SelectedType == "2") SelectedTeacherId = res[0].TeacherId;


            InitAutoComplete();

            UpdateSelectedFromData();

            BuildTeacherLooz();

            $("#ModalTeacher").modal("hide");

            BuildTeacherTable();

        }

        function UpdateSelectedFromData() {

            for (var i = 0; i < TeacherData.length; i++) {

                if (SelectedTeacherId == TeacherData[i].TeacherId) {


                    SelectedTeacherId = TeacherData[i].TeacherId;
                    SelectedFirstName = TeacherData[i].FirstName;
                    SelectedLastName = TeacherData[i].LastName;
                    SelectedTafkidId = TeacherData[i].TafkidId;
                    SelectedProfessionalId = TeacherData[i].ProfessionalId;
                    SelectedEmail = TeacherData[i].Email;
                    SelectedFrontaly = TeacherData[i].Frontaly;
                    SelectedFreeDay = TeacherData[i].FreeDay;

                    SelectedTz = TeacherData[i].Tz;
                    SelectedShehya = TeacherData[i].Shehya;
                    SelectedPartani = TeacherData[i].Partani;




                    $('#spFrontalyTotals').text(SelectedFrontaly);

                    $('input.typeahead').val(SelectedFirstName + " " + SelectedLastName);





                }



            }





        }


        function DefineRightClickEVENT() {
            //שעה רגילה לא צריך
            $(".selected:not(.dv_HourTypeId_1)").contextMenu({
                menuSelector: "#contextMenuAbsence",
                menuSelected: function (invokedOn, selectedMenu) {

                    //e.cancelBubble = true;
                    var Obj = invokedOn[0];

                    //  alert($(Obj).attr("id"));



                    var MenuId = selectedMenu[0].id;

                    switch (MenuId) {
                        case "li1":
                            OpenShyaPartani(Obj, 1);
                            break;
                        case "li2":
                            SetPartani(Obj, 1);
                            break;
                        case "li3":
                            SetPartani(Obj, 2);
                            break;

                        default:
                            break;


                    }

                }
            });

        }

        var SelectedHourId = "";


        function SetPartani(Obj, Type) {

            if (SelectedTafkidId == 3) {
                bootbox.alert("לא ניתן להגדיר שעות שהייה פרטני לקרן קרב");
                return;
            }

            var HourId = $(Obj).attr("id").replace("spHourType_", "");
            SelectedHourId = HourId;

            //  alert(SelectedTeacherId);
            var errMes = Ajax("Teacher_SetPartani", "HourId=" + SelectedHourId + "&TeacherId=" + SelectedTeacherId + "&Type=" + Type);
            if (errMes[0].res == 0) {
                BuildTeacherLooz();
            }
            if (errMes[0].res == 1) {
                bootbox.alert("מורה משובץ לשעה זו");
            }

            if (errMes[0].res == 2) {
                bootbox.alert("נגמרה הקצאת שעות פרטני למורה");
            }

        }


        function OpenShyaPartani(Obj, Type) {



            if ($(Obj).attr("HourTypeId") == 2) {
                bootbox.alert("מורה משובץ לשעה זו");
                return;

            }

            if (SelectedTafkidId == 3) {
                bootbox.alert("לא ניתן להגדיר שעות שהייה פרטני לקרן קרב");
                return;
            }

            $("input:radio").attr("checked", false);
            $("#txtGroup").val("");


            var HourId = $(Obj).attr("id").replace("spHourType_", "");
            SelectedHourId = HourId;
            // רשימת קבוצות לשעה זו
            $("#ddlShyaGroup").html('<option value="0">-- בחר קבוצה --</option>');

            var dataGroupSheya = Ajax("Teacher_GetShehyaGroup", "HourId=" + HourId + "&TeacherId=" + SelectedTeacherId);

            BuildCombo(dataGroupSheya, "#ddlShyaGroup", "ShehyaGroupId", "Name");

            if (dataGroupSheya[0]) {

                $("#ddlShyaGroup").val(dataGroupSheya[0].TeacherShehyaGroupId);

            }

            BuildTeachersForSheya();


            $("#spTitleName").text("הגדרות שהייה ל" + getDayAndHour(HourId));


            $("#ModalShya").modal();

        }


        function BuildTeachersForSheya() {
            // בניית מורים רלוונטיים
            var ShehyaGroupId = $("#ddlShyaGroup").val();


            var dataTeachersAdd = Ajax("Teacher_GetTeachersForShehya", "HourId=" + SelectedHourId
                + "&ShehyaGroupId=" + ShehyaGroupId + "&TeacherId=" + SelectedTeacherId);


            //if (dataTeachersAdd.length == 0) {


            //    return;
            //}

            $("#dvTeacherContainer").html('');
            var EmpHtml = "";




            for (var i = 0; i < dataTeachersAdd.length; i++) {


                var TeacherId = dataTeachersAdd[i].TeacherId;
                var fullName = dataTeachersAdd[i].fullName;
                var ShehyaGroupId = dataTeachersAdd[i].ShehyaGroupId;

                //alert(fullName);
                EmpHtml = $("#dvTeachTemplate").html();
                EmpHtml = EmpHtml.replace("@fullName", fullName);
                EmpHtml = EmpHtml.replace("@TeacherId", TeacherId);

                EmpHtml = EmpHtml.replace("@checin", (ShehyaGroupId > '0') ? 'checked' : 'false');

                $("#dvTeacherContainer").append(EmpHtml);


            }


            $('input.icheck-blue').iCheck({
                checkboxClass: 'icheckbox_flat-blue',
                radioClass: 'iradio_flat-blue',
                increaseArea: '20%' // optional
            });


        }


        //function OpenNewGroup() {

        //    var groupName = $("#txtGroup").val();

        //    if (!groupName) {

        //        bootbox.alert("חובה להקליד שם של קבוצה חדשה");


        //    } else {


        //       var res= Ajax("School_SetGroup", "groupName=" + groupName + "&groupId=0");
        //    }



        // }


        function SaveSheya() {

            var ShehyaGroupId = $("#ddlShyaGroup").val();
            var NewGroup = $("#txtGroup").val();
            var TeachersIds = "0";

            $("input.icheck-blue").each(function () {

                if (this.checked) {
                    var ObjId = $(this).attr("id").replace("ch_", "").replace("@TeacherId", "0");

                    TeachersIds = TeachersIds + "," + ObjId;


                }


            });

            if (ShehyaGroupId == "0" && !NewGroup) {
                bootbox.alert("חובה לבחור קבוצה או קבוצה חדשה");
                return;

            }

            Ajax("Teacher_SetGroupShehya", "HourId=" + SelectedHourId
                + "&TeachersIds=" + TeachersIds + "&ShehyaGroupId=" + ShehyaGroupId + "&NewGroup=" + NewGroup);

            BuildTeacherLooz();
            bootbox.alert("נתונים עודכנו בהצלחה!");

            // alert(SelectedHourId);



        }


        function PrintTeacher(type) {

            SetPrintContainer(type,0);



            var Html = $("#dvPrintContainer").html();
            PrintDiv(Html);

        }


        function SetPrintContainer(type, moduleFrom) {

           
            $("#dvPrintContainer").html("");

            var Template;// = $("#dvPrintTemplate").html();

            var TeacherId = (type) ? SelectedTeacherId : "";

            var Data = Ajax("Teacher_GetAllTeacherHours", "TeacherId=" + TeacherId);

            var PrevTeacherId = "";

            var PrevDayId = "";

            var DayContainer = "";



            for (var i = 0; i < Data.length; i++) {

                var DayId = (Data[i].HourId).toString().substring(0, 1);
                //var DayId2 = (TargetObj.HourId).toString().substring(0, 1);

                if (PrevTeacherId != Data[i].TeacherId) {

                    Template = $("#dvPrintTemplate").html();
                    Template = Template.replace("@TeacherName", Data[i].TeacherName);
                    Template = Template.replace(/@TeacherId/g, Data[i].TeacherId);

                     Template = Template.replace(/@pageBreak/g,(moduleFrom==0 || SelectedTeacherId)?"":" <br style='page-break-after: always'>");
                     


                    $("#dvPrintContainer").append(Template);
                    PrevTeacherId = Data[i].TeacherId;




                }

                var className = (Data[i].ClassNameAssign) ? Data[i].ClassNameAssign : "";
                var classHalf = (Data[i].className) ? Data[i].className : "";
                var j = i;

                while (Data[j + 1] && Data[j].ClassId != Data[j + 1].ClassId
                    && Data[j].HourId == Data[j + 1].HourId) {

                    classHalf += "/" + Data[j + 1].className;

                    j++;

                    className = classHalf;
                }




                var ProfessionalName = (Data[i].Professional) ? Data[i].Professional : "";
                var HourTypeId = (Data[i].HourTypeId) ? Data[i].HourTypeId : "";
                var HourType = (Data[i].HourType) ? Data[i].HourType : "";
                var SheyaGroupName = (Data[i].SheyaGroupName) ? Data[i].SheyaGroupName : "";

                if (HourTypeId == "2" || HourTypeId == "3") {

                    className = HourType;


                }

                if (HourTypeId == "3") {

                    ProfessionalName = SheyaGroupName;

                }



                if (!className) className = "&nbsp;";
                if (!ProfessionalName) ProfessionalName = "&nbsp;";


               
                //זה word
                if (moduleFrom == 1)
                {
                    DayContainer = "<table cellpadding='0' cellspacing='0' width='100%' ><tr><td class='teacherRub'>" + className + "<div class='teacherPro'>"
                        + ProfessionalName + "</div></td></tr></table>";
                }
               else
               {
                  
                    DayContainer = "<div class='teacherRub'>" + className + "<div class='teacherPro'>"
                        + ProfessionalName + "</div></div>";
                }
                //<div class=''>" + Data[i].Professional + "</div>";
                $("#dv_" + PrevTeacherId + "_" + DayId).append(DayContainer);

                i = j;

            }




        }


        function CreateWord() {
            SetPrintContainer(1,1);



            var Html = "";

              
                 
            Html += $("#dvPrintContainer").html();

          

           $("<div>" + Html + "</div>").wordExport("רשימת מערכות למורים");
        

        }



    </script>
</asp:Content>
<asp:Content ID="Content2" ContentPlaceHolderID="ContentPlaceHolder1" runat="Server">
  
    <div class="col-md-12">
        <div class="row dvWeek">
            <div class="panel panel-info">
                <div class="panel-heading">
                    <h3 class="panel-title">&nbsp;בחירת מורה 
                    </h3>
                </div>
                <div class="panel-body">
                    <div class="col-md-2">
                        <input type="text" class="form-control typeahead" spellcheck="false" autocomplete="off"
                            placeholder="חיפוש  שם או שם משפחה">
                    </div>


                    <div class="col-md-2" style="text-align: left">
                        <div class="btn btn-info btn-round" onclick="OpenUpdateTeacher(1)">
                            <i class="glyphicon glyphicon-edit"></i>&nbsp; <span>עדכן מורה</span>
                        </div>
                    </div>

                    <div class="col-md-2" style="text-align: left">
                        <div class="btn btn-primary btn-round" onclick="OpenUpdateTeacher(2)">
                            <i class="glyphicon glyphicon-plus"></i>&nbsp; <span>הוסף מורה</span>
                        </div>
                    </div>

                    <div class="col-md-2" style="text-align: left">
                        <div class="btn btn-danger btn-round" onclick="OpenUpdateTeacher(3)">
                            <i class="glyphicon glyphicon-remove"></i>&nbsp; <span>מחק מורה</span>
                        </div>
                    </div>

                     <div class="col-md-2" style="text-align: left">
                        <div class="btn btn-success btn-round" onclick="PrintTeacher(1)">
                            <i class="glyphicon glyphicon-print"></i>&nbsp; <span>הדפס מערכת מורה נוכחי</span>
                        </div>
                    </div>

                   <%-- --%>


                    <div class="col-md-2" style="text-align: left">
                        <div class="btn btn-success btn-round" onclick="PrintTeacher()">
                            <i class="glyphicon glyphicon-print"></i>&nbsp; <span>הדפס מערכת כל המורים</span>
                        </div>
                    </div>


                       <div class="col-md-12" style="text-align: left">
                           <div class="btn btn-primary btn-round " style="" onclick="CreateWord();">
                        ייצא לWord &nbsp;&nbsp;&nbsp;&nbsp;<i class="fa fa-file-word-o"></i>
                    </div>
                      </div>

                </div>
            </div>
        </div>
    </div>

    <div class="col-md-12" id="dvAllDays">
        <div class="row dvWeek">
            <div class="panel panel-info">
                <div class="panel-heading">
                    <h3 class="panel-title">&nbsp; שעות למורה- <span class="spTeacherName"></span>
                    </h3>
                </div>
                <div class="panel-body">
                    <div class="col-md-10">
                        <h5 style="font-style: italic">בחר שעות ע"י לחיצה וגרירה , לביטול לחץ וגרור שוב.</h5>
                    </div>
                    <div class="col-md-2" style="text-align: left">
                        <div class="btn btn-info btn-round" style="margin: 1px;">
                            סה"כ שעות פרונטלי <span class="badge" id="spFrontalyTotals">0</span>
                        </div>
                    </div>
                    <div class="dvDaysCotainer">
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">&nbsp; יום ראשון
                                    </h3>
                                </div>
                                <div class="panel-body" id="dv1">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">&nbsp; יום שני
                                    </h3>
                                </div>
                                <div class="panel-body" id="dv2">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">&nbsp; יום שלישי
                                    </h3>
                                </div>
                                <div class="panel-body" id="dv3">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">&nbsp; יום רביעי
                                    </h3>
                                </div>
                                <div class="panel-body" id="dv4">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">&nbsp; יום חמישי
                                    </h3>
                                </div>
                                <div class="panel-body" id="dv5">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">&nbsp; יום שישי
                                    </h3>
                                </div>
                                <div class="panel-body" id="dv6">
                                </div>
                            </div>
                        </div>
                        <div class="clear">
                            &nbsp;
                        </div>
                    </div>
                   
                 
                    
                 
                </div>

                 
            </div>
        </div>
    </div>

     <div class="col-md-12" >
    <div id="dvTeacherTable" style="padding-top:20px;">
                      
                        <div class="col-md-2 dvRequireTitle">
                           שם מורה
                        </div>
                        <div class="col-md-2 dvRequireTitle">
                           תפקיד
                        </div>
                        <div class="col-md-2 dvRequireTitle">
                            מקצוע
                        </div>
                        <div class="col-md-2 dvRequireTitle">
                          יום חופשי
                        </div>
                      
                        <div class="col-md-2 dvRequireTitle">
                           שעות שהייה
                        </div>
                        <div class="col-md-1 dvRequireTitle">
                          שעות פרטני
                        </div>
                       
                        <div class="col-md-1 dvRequireTitle">
                           &nbsp;
                        </div>
                        <div id="dvReqContainer" class="dvPanelReq clear">
                        </div>

                    </div>
    </div>

    <%-- חלון מודלי של מורה --%>
    <div class="modal fade" id="ModalTeacher" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header label-info">
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">
                        &times;</button>
                    <h4 class="modal-title" id="spModalTitle"></h4>
                </div>
                <div class="modal-body" id="Div14">


                     <div class="col-md-4">
                        <div class="form-group">
                            <label>ת"ז</label>
                            <input type="text" placeholder="" id="txtTz" name="txtTz"
                                class="form-control">
                        </div>
                    </div>


                    <div class="col-md-4">
                        <div class="form-group">
                            <label>שם פרטי</label>
                            <input type="text" placeholder="" id="txtFirstName" name="txtFirstName"
                                class="form-control">
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="form-group">
                             <label>שם משפחה</label>
                            <input type="text" placeholder="" id="txtLastName" name="txtLastName"
                                class="form-control">
                        </div>
                    </div>

                     <div class="col-md-4">
                        <div class="form-group">
                             <label>תפקיד</label>
                            <select id="ddlTafkid" class="form-control">
                                <option value="0">-- בחר תפקיד --</option>
                            </select>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="form-group">
                             <label>אימייל</label>
                            <input type="text" placeholder="" id="txtEmail" name="txtEmail"
                                class="form-control">
                        </div>
                    </div>

                     <div class="col-md-4">
                        <div class="form-group">
                             <label>יום חופשי</label>
                            <select id="ddlFreeDay" class="form-control">
                                <option value="0">--בחר יום חופשי --</option>
                                 <option value="1">יום ראשון</option>
                                 <option value="2">יום שני</option>
                                 <option value="3">יום שלישי</option>
                                 <option value="4">יום רביעי</option>
                                 <option value="5">יום חמישי</option>
                                 <option value="6">יום שישי</option>
                            </select>
                        </div>
                    </div>
                   

                      <div class="col-md-4">
                           <label>שעות פרונטלי</label>
                       <input type="text" placeholder=""  id="txtFrontaly" name="txtFrontaly"
                                class="form-control">
                      </div>


                         <div class="col-md-4">
                           <label> שעות שהייה </label>
                       <input type="text" placeholder=""  id="txtShehya" name="txtShehya"
                                class="form-control">
                      </div>


                       <div class="col-md-4">
                           <label>שעות פרטני</label>
                       <input type="text" placeholder=""  id="txtPartani" name="txtPartani"
                                class="form-control">
                      </div>


                      <div style="">&nbsp;</div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>מקצוע (ברירת מחדל)</label>
                            <select id="ddlProfessional" class="form-control">
                                <option value="0">-- בחר מקצוע --</option>
                            </select>
                        </div>
                    </div>

                    <div class="col-md-12" style="text-align: left">

                        <br />

                        <button type="button" class="btn btn-info btn-round" onclick="SaveData()">
                            <i class="glyphicon glyphicon-edit"></i>&nbsp; <span>עדכן פרטי מורה</span>
                        </button>
                    </div>
                    <div class="clear">
                        &nbsp;
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-info btn-xs" data-dismiss="modal">
                        סגור</button>
                </div>
            </div>
        </div>
    </div>

    <%-- חלון מודלי של שהייה --%>
    <div class="modal fade" id="ModalShya" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header label-info">
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">
                        &times;</button>
                    <h4 class="modal-title">
                        <span id="spTitleName"></span>
                    </h4>
                </div>
                <div class="modal-body" id="Div13">

                    <div class="col-md-4">
                        <select id="ddlShyaGroup" class="form-control" onchange="BuildTeachersForSheya()">
                            <option value="0">-- בחר קבוצה --</option>
                        </select>

                    </div>
                    <div class="col-md-4">

                        <input id="txtGroup" class="form-control" placeholder="קבוצה חדשה" type="text" />
                    </div>


                  <%--    <div class="col-md-2">
                      <div class="btn btn-primary btn-round" onclick="OpenNewGroup()">
                            <i class="glyphicon glyphicon-plus"></i>&nbsp; <span>הוסף קבוצה</span>
                        </div>
                          </div>

                    <div class="col-md-2">
                        <button type="button" class="btn btn-danger btn-round" onclick="DeleteGroup()">
                            <i class="glyphicon glyphicon-edit"></i>&nbsp; <span>מחק קבוצה </span>
                        </button>
                    </div>--%>



                    <div class="clear">
                        &nbsp;
                    </div>


                    <div class="col-md-12">
                        <%--   <textarea placeholder="טקסט חופשי" class="form-control" id="txtFreeHariga" name="txtFreeHariga"></textarea>--%>
                        <%--    <select id="Select1" class="form-control">
                            <option value="0">מורים</option>
                        </select>
                        --%>


                        <div class="panel panel-default">
                            <div class="panel-heading">
                              <span style="font-weight:bold"> רשימת מורים &nbsp; &nbsp;</span>
                              <label class="radio-inline"> <input type="radio" name="checkUncheck" id="Clear" value="checkAll"> סמן הכל </label>
                              <label class="radio-inline"> <input type="radio" name="checkUncheck" id="Cloudy" value="UncheckAll"> בטל הכל </label>
                         
                            </div>
                            <div class="panel-body">
                                <div class="row" id="dvTeacherContainer">
                                   
                                 
                                </div>
                            </div>
                        </div>





                    </div>


                    <div class="clear">
                        &nbsp;
                    </div>

                    <div class="col-md-12" style="text-align: left">
                        <button type="button" class="btn btn-info btn-round" onclick="SaveSheya()">
                            <i class="glyphicon glyphicon-edit"></i>&nbsp; <span>שמור </span>
                        </button>
                    </div>
                    <div class="clear">
                        &nbsp;
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-info btn-xs" data-dismiss="modal">
                        סגור</button>
                </div>
            </div>
        </div>
    </div>


    <ul id="contextMenuAbsence" class="dropdown-menu dropdown-menu-right" role="menu"
        style="display: none;">
        <li><a id="li1" tabindex="-1" href="#">הגדרת שהייה</a></li>
       <li><a id="li2" tabindex="-1" href="#">הגדרת פרטני </a></li> 
        <li><a id="li3" tabindex="-1" href="#">ביטול פרטני </a></li> 
        <li class="divider"></li>
        <li><a tabindex="-1" href="#">סגור</a></li>
    </ul>
    <div id="dvTeachTemplate" style="display: none">

        <div style="padding: 5px; width: 12%; float: right">
            <label class="checkbox">
                <input class="icheck-blue" type="checkbox" @checin  id="ch_@TeacherId" value="option1">
                @fullName
            </label>
        </div>
    </div>

     <div id="dvReqTemplate" style="display: none">
        <div class="col-md-2 dvRequireDetails">
            <a href="#" onclick="OpenTeacherData('@FullText',@TeacherId)">@FullText</a>    
        </div>
        <div class="col-md-2 dvRequireDetails">
            @Tafkid
        </div>
        <div class="col-md-2 dvRequireDetails">
            @Professional
        </div>
        <div class="col-md-2 dvRequireDetails">
            @FreeDay
        </div>
     
        <div class="col-md-2 dvRequireDetails">
            @Shehya
        </div>
        <div class="col-md-1 dvRequireDetails">
            @Partani
        </div>

      
        <div class="col-md-1 dvRequireDetails">
           &nbsp;
          <%--  <div class="btn btn-primary btn-xs" style="width: 45%" onclick='EditRequirement("@RequirementId", "@DateTypeCode","@ShiftCode", "@QualificationCode", "@EmpQuantity","@Seq", "@RequirementDesc", "@RequirementAbb","@ObligatoryAssignment", "@ObligatoryCheck","@BeginDate", "@EndDate","@RequirementType","@IsAssignAuto")'>
                ערוך</div>
       
            <div class="btn btn-danger btn-xs" style="width: 45%" onclick='DeleteRequirement("@RequirementId")'>
               מחק</div>--%>
        </div>

    </div>

     <div id="dvPrintTemplate" style="display: none">
       
       
         <style>

             table {
                direction: rtl;
                border: solid 1px gray;
               
            }

            .dvtitlePrint {
                text-align: center;
                font-style: italic;
                font-family: David;
                font-size: 40px;
            }

            .shiftTitle {
                text-align: center;
                background-color: #428bca !important;
                border: solid 1px black;
               
                font-family: David;
                font-size: 18px;
                font-weight: bold;
                height: 30px;
                color: white;
               
            }

            .dvTeacherName {
                font-family: David;
                font-style: italic;
                font-size: 30px;
                font-weight: bold;
                padding-top: 40px;
                padding: 10px;
                height: 30px;
                text-align: right;
            }

            .shiftWorker {
                vertical-align: top;
                padding-bottom: 10px;
                font-size: 12px;
            }


            .teacherRub {
                height: 40px;
                font-family: David;
                font-size: 13px;
                padding: 4px;
                margin:0px;
                border: solid 1px silver;
                font-weight: bold;
                vertical-align:top;
            }

            .teacherPro {
                text-align: left;
                font-family: David;
                font-size: 13px;
                padding-top: 10px;
                font-style: italic;
                font-weight: lighter;
                position: relative;
            }


            @media print {

                .dvtitlePrint {
                    text-align: center;
                    font-style: italic;
                    font-family: David;
                    font-size: 50px;
                }

                table {
                    border-collapse: collapse;
                    table-layout: fixed;
                    page-break-after: always;
                }

                .shiftTitle {
                    text-align: center;
                    background-color: #428bca !important;
                    border: solid 1px black;
                    -webkit-print-color-adjust: exact;
                    font-family: David;
                    font-size: 18px;
                    font-weight: bold;
                    height: 40px;
                }

                .dvTeacherName {
                    font-family: David;
                    font-style: italic;
                    font-size: 30px;
                    font-weight: bold;
                    padding-top: 40px;
                    padding: 10px;
                }



                .shiftWorker {
                    vertical-align: top;
                    padding-bottom: 10px;
                    font-size: 12px;
                }







                .teacherRub {
                    height: 50px;
                    font-family: David;
                    font-size: 20px;
                    padding: 4px;
                    border: solid 1px silver;
                    font-weight: bold;
                }

                .teacherPro {
                    text-align: left;
                    font-family: David;
                    font-size: 15px;
                    padding-top: 10px;
                    font-style: italic;
                    font-weight: lighter;
                    position: relative;
                }
            }
        </style>

       
        <div class='dvtitlePrint'>מערכת שעות מורים</div>
        <div class="dvTeacherName">@TeacherName</div>
        <br />
        <table cellpadding="0" cellspacing="0" width="100%" border="0">
          
            <tr>
                <td class="shiftTitle">
                    יום ראשון
                </td>
                <td class="shiftTitle">
                    יום שני
                </td>
                <td class="shiftTitle">
                    יום שלישי
                </td>
                <td class="shiftTitle">
                    יום רביעי
                </td>
                <td class="shiftTitle">
                    יום חמישי
                </td>
                <td class="shiftTitle">
                    יום שישי
                </td>
                
            </tr>
            <tr>
                <td class="shiftWorker" id="dv_@TeacherId_1">
                 
                </td>
                <td class="shiftWorker" id="dv_@TeacherId_2">
                </td>
                <td class="shiftWorker" id="dv_@TeacherId_3">
                   
                </td>
                <td class="shiftWorker" id="dv_@TeacherId_4">
                   
                </td>
                <td class="shiftWorker" id="dv_@TeacherId_5">
                   
                </td>
                <td class="shiftWorker" id="dv_@TeacherId_6">
                   
                </td>
                
            </tr>
           
           
           
        </table>

         @pageBreak 

       
          
    </div>

     <div id="dvPrintContainer"  style="display: none;">
      

     </div>





</asp:Content>
