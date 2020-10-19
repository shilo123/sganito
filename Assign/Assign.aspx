<%@ Page Title="" Language="C#" MasterPageFile="~/MasterPage/MasterPage.master" AutoEventWireup="true"
    CodeFile="Assign.aspx.cs" Inherits="Assign_Assign" %>

<asp:Content ID="Content1" ContentPlaceHolderID="head" runat="Server">
    <script type="text/javascript" src="../assets/js/jquery-ui.js"></script>
    <link href="../assets/css/jquery-ui.css" rel="stylesheet" type="text/css" />

    <style>
        /*.modal-backdrop {
            display: none;
        }

        .modal-open .modalTeacher {
            left: 1000px;
            top: 30px;
            position: absolute;
            width: 360px;
            height: 340px;
            margin: 0 auto;
            overflow: hidden;
        }*/


        .ui-dialog .ui-dialog-titlebar {
           /* or whatever you want */
            font-size:12px;
            color:white;
            font-weight:bold;
            direction:rtl;
            padding:1px;
            
    

        }

       

        .ui-dialog .ui-dialog-titlebar-close{
            right:29em;
        }

        .myPosition {
            position: fixed;
            z-index:5000;
         }

    </style>

    <script type="text/javascript">

        var LayerId = "0";
        var SelectedClassId = "";
        $(document).ready(function () {
            //  InitCombos();

            InitProfessional();
            InitFreeTeacher("");
            InitData();
            //  InitClass();
            InitEVENTS();
            $(".modal").draggable({
                handle: ".modal-header"
            });

        });


        function InitFreeTeacher(ClassId) {
            SelectedClassId = ClassId;
            $("#dvTeacherContainer").html("");

            var TeacherData = Ajax("Assign_GetFreeTeacher", "ClassId=" + ClassId);

            var TeacherHtml = "";
            for (var i = 0; i < TeacherData.length; i++) {

                TeacherHtml = $("#dvTeacherTemplate").html();

                TeacherHtml = TeacherHtml.replace(/@Name/g, TeacherData[i].TeacherName);
                TeacherHtml = TeacherHtml.replace(/@TeacherId/g, TeacherData[i].TeacherId);
                TeacherHtml = TeacherHtml.replace(/@FreeHour/g, TeacherData[i].FreeHour);
                $("#dvTeacherContainer").append(TeacherHtml);

            }

            DefineDragAndDropEvents();
            DefineRightClickEVENT();
        }


        function InitProfessional() {

            var ProData = Ajax("Gen_GetTable", "TableName=Professional&Condition=ConfigurationId=" + ConfigurationId);

            var ProHtml = "";
            for (var i = 0; i < ProData.length; i++) {

                ProHtml = $("#dvProTemplate").html();

                ProHtml = ProHtml.replace(/@Name/g, ProData[i].Name);
                ProHtml = ProHtml.replace(/@ProfessionalId/g, ProData[i].ProfessionalId);
                $("#dvProContainer").append(ProHtml);

            }

        }

        function InitEVENTS() {

            $("input[name=layer]:radio").change(function () {
                LayerId = $("input[name='layer']:checked").val();
                InitData();
            });

        }


        function InitData() {

            $("#dvAllWeekContainer").html("");
            // LayerId = $("input[name='layer']:checked").val();
            var Data = Ajax("Assign_GetAssignment", "LayerId=" + LayerId);
            var WeekHtml = "";
            var Html = "";
            var ClassId = "";
            for (var i = 0; i < Data.length; i++) {


                if (Data[i].ClassId != ClassId) {

                    WeekHtml = $("#dvWeekClassTemplate").html();
                    WeekHtml = WeekHtml.replace(/@ClassName/g, Data[i].ClassName);
                    WeekHtml = WeekHtml.replace(/@ClassId/g, Data[i].ClassId);

                    $("#dvAllWeekContainer").append(WeekHtml);

                    ClassId = Data[i].ClassId;

                }



                Html = $("#dvAssignTemplate").html();

                var theme = "danger";
                if (Data[i].AssignmentId) {
                    theme = "primary";
                    if (Data[i].IsAuto == 1) theme = "info";
                }

                Html = Html.replace(/@theme/g, theme);


                var TeacherTemp = "<span id='dvTeacherHour_" + Data[i].TeacherId + "' class='selected'>" + Data[i].TeacherName + "</span>";
                var TeacherName = (Data[i].TeacherName) ? TeacherTemp : "&nbsp;";

                var j = i;

                while (Data[j + 1] && Data[j].ClassId == Data[j + 1].ClassId
                    && Data[j].HourId == Data[j + 1].HourId) {

                    TeacherName += "/" + "<span id='dvTeacherHour_" + Data[j + 1].TeacherId + "' class='selected'>" + Data[j + 1].TeacherName + "</span>";

                    j++;
                }

                if (GetEmptyIfNull(Data[i].Ihud)) {

                    TeacherName = "<u>" + TeacherName + "</u>";
                }


                Html = Html.replace(/@TeacherName/g, TeacherName);
                Html = Html.replace(/@ProfessionalId/g, GetEmptyIfNull(Data[i].ProfessionalId));
                Html = Html.replace(/@Professional/g, (Data[i].Professional) ? (Data[i].Professional + " -") : "");
                Html = Html.replace(/@ClassId/g, GetEmptyIfNull(Data[i].ClassId));
                Html = Html.replace(/@Hakbatza/g, GetEmptyIfNull(Data[i].Hakbatza));
                Html = Html.replace(/@Ihud/g, GetEmptyIfNull(Data[i].Ihud));
                Html = Html.replace(/@HourId/g, GetEmptyIfNull(Data[i].HourId));
                Html = Html.replace(/@TeacherId/g, GetEmptyIfNull(Data[i].TeacherId));
                Html = Html.replace(/@LayerId/g, GetEmptyIfNull(Data[i].LayerId));


                Html = Html.replace(/@AssignmentId/g, GetEmptyIfNull(Data[i].AssignmentId));
                Html = Html.replace(/@YesNoDragg/g, ((Data[i].AssignmentId) ? "draggable" : ""));

                var DayId = (Data[i].HourId).toString().substring(0, 1);
                $("#dv_" + ClassId + "_" + DayId).append(Html);

                i = j;


            }



            $("#dvAllWeekContainer").append("<div class='col-md-12' style='height: 170px;'>&nbsp;</div>");


            DefineDragAndDropEvents();
            DefineRightClickEVENT();
        }

        function SetMissTeacher(ClassId) {

            InitFreeTeacher(ClassId);

        }


        function DefineDragAndDropEvents() {

            $(".draggable").draggable({
                // cancel: ".borrowStyleNoDrag",
                helper: "clone",
                cursor: "move",
                //  revert: true,
                appendTo: "body",
                zIndex: 1000,


                //  revert: true,
                start: function (event, ui) {
                    // alert($(this).attr("id"));
                    ui.helper.width($(this).width());



                }


            });
            $(".droppable").droppable({
                //  cancel: ".innerTeacher",
                //  greedy: true,
                accept: ".draggable",

                drop: function (event, ui) {

                    var SourceObj = GetObject(ui.draggable, 1);
                    var TargetObj = GetObject($(this), 2);
                    if (!TargetObj) return;

                    var Type = "";




                    //שיבוץ מורה לעמדה ריקה או רק עם מקצוע
                    if (SourceObj.ObjId.indexOf("dvTeacher_") != "-1" && !TargetObj.TeacherId) {

                        SourceObj.ObjId = SourceObj.ObjId.replace("dvTeacher_", "");
                        Type = 1;

                    }

                    //שיבוץ מקצוע לעמדה ריקה או רק עם מורה
                    if (SourceObj.ObjId.indexOf("dvProfessional_") != "-1") {
                        SourceObj.ObjId = SourceObj.ObjId.replace("dvProfessional_", "");
                        Type = 2;


                    }

                    //מחיקת מורה משיבוץ ומקצוע
                    if (TargetObj.ObjId.indexOf("dvTeacherContainer") != "-1") {
                        TargetObj.ObjId = "";
                        Type = 3;

                    }

                    // הורדת מקצוע
                    if (TargetObj.ObjId.indexOf("dvProContainer") != "-1") {
                        TargetObj.ObjId = "";
                        Type = 4;

                    }


                    //שיבוץ מורה לעמדה תפוסה הווה אומר הקבצה 
                    if (SourceObj.ObjId.indexOf("dvTeacher_") != "-1" && TargetObj.TeacherId) {

                        SourceObj.ObjId = SourceObj.ObjId.replace("dvTeacher_", "");
                        Type = 5;

                    }

                    // 
                    if (SourceObj.HourId == TargetObj.HourId && SourceObj.LayerId == TargetObj.LayerId &&
                        !TargetObj.TeacherId && !TargetObj.ProfessionalId && SourceObj.TeacherId) {

                        Type = 6;

                    }





                    if (!Type) return;

                    var errMessage = SetDataTODB(Type, SourceObj, TargetObj);
                    if (errMessage == 0) {


                        RefreshClass(SourceObj, TargetObj);

                        if (Type == 1 || Type == 3 || Type == 5) InitFreeTeacher(SelectedClassId);


                        DefineDragAndDropEvents();
                        DefineRightClickEVENT();
                    } else {

                        if (errMessage == 2) {


                            bootbox.alert("מורה כבר משובץ לשעה זו");
                            //10.211.21.45
                        }
                        if (errMessage == 3) {


                            bootbox.alert("מורה לא מוגדר\ת לעבוד בשעה זו");

                        }
                        if (errMessage == 4) {


                            bootbox.alert("המורה עברה את השעות שהוקצה לה לכיתה זו");

                        }


                        //if (errMessage == 4) {


                        //    bootbox.alert("לא ניתן לאחד מאחר ואחד המורים לא נוגדר לעבוד בשעה זו.");

                        //}

                    }





                }

            });
        }


        function SetDataTODB(Type, SourceObj, TargetObj) {

            var res = Ajax("Assign_SetAssignManual", "Type=" + Type
                + "&SourceId=" + SourceObj.ObjId + "&SourceTeacherId=" + SourceObj.TeacherId
                + "&SourceClassId=" + SourceObj.ClassId + "&SourceHourId=" + SourceObj.HourId
                + "&SourceProfessionalId=" + SourceObj.ProfessionalId + "&SourceHakbatza=" + SourceObj.Hakbatza
                + "&SourceIhud=" + SourceObj.Ihud
                + "&TargetId=" + TargetObj.ObjId + "&TargetTeacherId=" + TargetObj.TeacherId
                + "&TargetClassId=" + TargetObj.ClassId + "&TargetHourId=" + TargetObj.HourId
                + "&TargetProfessionalId=" + TargetObj.ProfessionalId + "&TargetHakbatza=" + TargetObj.Hakbatza
                + "&TargetIhud=" + TargetObj.Ihud

            );

            return res[0].res;



        }


        function RefreshClass(SourceObj, TargetObj) {

            var DayId1 = (SourceObj.HourId).toString().substring(0, 1);
            var DayId2 = (TargetObj.HourId).toString().substring(0, 1);


            $("#dv_" + SourceObj.ClassId + "_" + DayId1).html("");
            $("#dv_" + TargetObj.ClassId + "_" + DayId2).html("");


            var Data = Ajax("Assign_GetAssignment", "LayerId=" + LayerId);

            var Html = "";
            var ClassId = "";
            var DayId = "";
            var Ihud = (SourceObj.Ihud) ? SourceObj.Ihud : "0";

            var IhudObjs = "";
            if (Ihud != "0") {

                IhudObjs = $("div[ihud='" + Ihud + "']").attr("id");


            }

            var ObjHtml = "";
            for (var i = 0; i < Data.length; i++) {

                ClassId = Data[i].ClassId;
                DayId = (Data[i].HourId).toString().substring(0, 1);


                if ((DayId == DayId1 && ClassId == SourceObj.ClassId) ||
                    (DayId == DayId2 && ClassId == TargetObj.ClassId)) {
                    ObjHtml = GetHtmlAssign(Data, i, ClassId, DayId);
                    $("#dv_" + Data[i].ClassId + "_" + DayId).append(ObjHtml.Html);
                    i = ObjHtml.Jinc;

                }
                else if (Data[i].Ihud || Data[i].AssignmentId == IhudObjs) {
                    ObjHtml = GetHtmlAssign(Data, i, ClassId, DayId);
                    $("#" + Data[i].AssignmentId).replaceWith(ObjHtml.Html);
                    i = ObjHtml.Jinc;

                }


            }




        }


        function GetHtmlAssign(Data, i, ClassId, DayId) {


            Html = $("#dvAssignTemplate").html();

            var theme = "danger";
            if (Data[i].AssignmentId) {
                theme = "primary";
                if (Data[i].IsAuto == 1) theme = "info";
            }

            Html = Html.replace(/@theme/g, theme);

            //  Html = Html.replace(/@theme/g, ((Data[i].AssignmentId) ? "primary" : "danger"));

            var TeacherTemp = "<span id='dvTeacherHour_" + Data[i].TeacherId + "' class='selected'>" + Data[i].TeacherName + "</span>";
            var TeacherName = (Data[i].TeacherName) ? TeacherTemp : "&nbsp;";

            var j = i;

            while (Data[j + 1] && Data[j].ClassId == Data[j + 1].ClassId
                && Data[j].HourId == Data[j + 1].HourId) {

                TeacherName += "/" + "<span id='dvTeacherHour_" + Data[j + 1].TeacherId + "' class='selected'>" + Data[j + 1].TeacherName + "</span>";

                j++;
            }

            if (GetEmptyIfNull(Data[i].Ihud)) {

                TeacherName = "<u>" + TeacherName + "</u>";
            }



            Html = Html.replace(/@TeacherName/g, TeacherName);
            Html = Html.replace(/@ProfessionalId/g, GetEmptyIfNull(Data[i].ProfessionalId));
            Html = Html.replace(/@Professional/g, (Data[i].Professional) ? (Data[i].Professional + " -") : "");
            Html = Html.replace(/@ClassId/g, GetEmptyIfNull(Data[i].ClassId));
            Html = Html.replace(/@Hakbatza/g, GetEmptyIfNull(Data[i].Hakbatza));
            Html = Html.replace(/@Ihud/g, GetEmptyIfNull(Data[i].Ihud));
            Html = Html.replace(/@HourId/g, GetEmptyIfNull(Data[i].HourId));
            Html = Html.replace(/@TeacherId/g, GetEmptyIfNull(Data[i].TeacherId));
            Html = Html.replace(/@AssignmentId/g, GetEmptyIfNull(Data[i].AssignmentId));
            Html = Html.replace(/@LayerId/g, GetEmptyIfNull(Data[i].LayerId));
            Html = Html.replace(/@YesNoDragg/g, ((Data[i].AssignmentId) ? "draggable" : ""));






            return {
                Html: Html,

                Jinc: j,

            };

        }


        function GetObject(Obj, Type) {

            if (Type == 2) {

                var eTop = Obj.offset().top;
                var eLeft = Obj.offset().left;
                var rect = getRectangle($("#dvProContainer"));
                var rect2 = getRectangle($("#dvTeacherContainer"));
                if (inCoords(eLeft, eTop, rect) || inCoords(eLeft, eTop, rect2)) {

                    return false;

                }
            }

            //alert(Obj.attr("ProfessionalId"));

            return {
                ObjId: GetEmptyIfNull(Obj.attr("id")),

                TeacherId: GetEmptyIfNull(Obj.attr("TeacherId")),
                TeacherName: GetEmptyIfNull(Obj.attr("TeacherName")),
                ClassId: GetEmptyIfNull(Obj.attr("ClassId")),
                HourId: GetEmptyIfNull(Obj.attr("HourId")),
                ProfessionalId: GetEmptyIfNull(Obj.attr("ProfessionalId")),
                Professional: GetEmptyIfNull(Obj.attr("Professional")),
                Hakbatza: GetEmptyIfNull(Obj.attr("Hakbatza")),
                Ihud: GetEmptyIfNull(Obj.attr("Ihud")),
                LayerId: GetEmptyIfNull(Obj.attr("LayerId")),

            };


        }
        //ProfessionalId ="@ProfessionalId" TeacherId="@TeacherId" ClassId="@ClassId" HourId="@HourId"
        //Hakbatza="@Hakbatza" Ihud="@Ihud"

        function getRectangle(obj) {

            var off = obj.offset();

            return {
                top: off.top,
                left: off.left,
                height: obj.outerHeight(),
                width: obj.outerWidth()
            };
        }

        function inCoords(x, y, rect) {

            if ((x > rect.left && x < (rect.left + rect.width))
                && (y > rect.top && y < (rect.top + rect.height)))
                return true;

            return false;
        }


        //***************************** 
        function DefineRightClickEVENT() {

            $(".selected").contextMenu({
                menuSelector: "#contextMenuAbsence",
                menuSelected: function (invokedOn, selectedMenu) {

                    var Obj = invokedOn[0];

                    var MenuId = selectedMenu[0].id;

                    switch (MenuId) {
                        case "li1":
                            OpenTeacherHours(Obj, 1);
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

            function OpenTeacherHours(Obj, type) {

            var CurrentTeacherId = $(Obj).attr("id").replace("dvTeacherHour_", "");

            CurrentTeacherId = CurrentTeacherId.replace("dvTeacher_", "");


           

            $("#dvPrintContainer_" + CurrentTeacherId).html("");

            var Template;



            var Data = Ajax("Teacher_GetAllTeacherHours", "TeacherId=" + CurrentTeacherId);

             var ModalT = $("#dvModalTemplate").html();
            ModalT = ModalT.replace(/@TeacherId/g, CurrentTeacherId);
            ModalT = ModalT.replace(/@TeacherName/g, Data[0].TeacherName);
            $("#dvModalReal").append(ModalT);



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

                    $("#dvPrintContainer_" + CurrentTeacherId).append(Template);
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

                var isWork = Data[i].isWork;

                var addClass = "";
                if (isWork) {

                    addClass = "emptyHour";
                }


                DayContainer = "<div class='teacherRub " + addClass + "'>" + className
                    + "<div class='teacherPro'>" + ProfessionalName + "</div></div>";


                $("#dvTeachHour_" + PrevTeacherId + "_" + DayId).append(DayContainer);


                i = j;

            }

            

            $("#ModalTeacherHour_" + CurrentTeacherId).dialog({
                width: 380,
                dialogClass: 'myPosition'
            });
            $(".ui-dialog-titlebar-close").html("<span style='color:black'>X</span>");
           

        }



        function PrintSchool() {
            // $("#dvPrintContainer").html("");
            $("#dvPrintClassContainer").html("");

            var Template;// = $("#dvPrintTemplate").html();

            //  var TeacherId = (type) ? SelectedTeacherId : "";

            var Data = Ajax("Assign_GetAssignment", "LayerId=" + LayerId);

            var PrevClassId = "";

            var PrevDayId = "";

            var DayContainer = "";



            for (var i = 0; i < Data.length; i++) {

                var DayId = (Data[i].HourId).toString().substring(0, 1);
                //var DayId2 = (TargetObj.HourId).toString().substring(0, 1);

                if (PrevClassId != Data[i].ClassId) {

                    Template = $("#dvPrintClassTemplate").html();
                    Template = Template.replace("@ClassName", Data[i].ClassName);
                    Template = Template.replace(/@ClassIdPrint/g, Data[i].ClassId);

                    $("#dvPrintClassContainer").append(Template);
                    PrevClassId = Data[i].ClassId;

                    // $("#dv_" + PrevClassId + "_" + DayId).append("sdsdsd");
                }

                var ProfessionalName = (Data[i].Professional) ? Data[i].Professional : "";

                //var className = (Data[i].ClassName) ? Data[i].ClassName: "";
                //var classHalf = (Data[i].classHalf) ? Data[i].classHalf : "";
                //var j = i;

                //while (Data[j + 1] && Data[j].ClassId != Data[j + 1].ClassId
                //    && Data[j].HourId == Data[j + 1].HourId) {

                //    classHalf += "/" + Data[j + 1].classHalf;

                //    j++;

                //    className = classHalf;
                //}





                //    var HourTypeId = (Data[i].HourTypeId) ? Data[i].HourTypeId : "";
                //    var HourType = (Data[i].HourType) ? Data[i].HourType : "";
                // var SheyaGroupName = (Data[i].SheyaGroupName) ? Data[i].SheyaGroupName : "";

                //if (HourTypeId == "2" || HourTypeId == "3") {

                //    className = HourType;


                //}

                //if (HourTypeId == "3") {

                //   // ProfessionalName = SheyaGroupName;

                //}

                var TeacherName = (Data[i].TeacherName) ? Data[i].TeacherName : "";

                var j = i;

                while (Data[j + 1] && Data[j].ClassId == Data[j + 1].ClassId
                    && Data[j].HourId == Data[j + 1].HourId) {

                    TeacherName += " / " + Data[j + 1].TeacherName;

                    j++;
                }

                if (GetEmptyIfNull(Data[i].Ihud)) {

                    TeacherName = "<u>" + TeacherName + "</u>";
                }


                DayContainer = "<div class='teacherRub'>" + TeacherName + "<div class='teacherPro'>"
                    + ProfessionalName + "</div></div>";

                //<div class=''>" + Data[i].Professional + "</div>";
                $("#dvClass_" + PrevClassId + "_" + DayId).append(DayContainer);

                i = j;

            }

            var Html = $("#dvPrintClassContainer").html();
            PrintDiv(Html);


        }

        function GetAllOptionalTeacher(AssignmentId, HourId, ClassId) {

            if (!AssignmentId) {


                //var CurrentTeacherId = $(Obj).attr("id").replace("dvTeacherHour_", "");
                //CurrentTeacherId = CurrentTeacherId.replace("dvTeacher_", "");

                var Data = Ajax("Assign_GetAllTeacherOptional", "ClassId=" + ClassId + "&HourId=" + HourId);
                var alertText = "";

                var PrevHakbatza = "";
                for (var i = 0; i < Data.length; i++) {

                    //var Hakbatza = GetEmptyIfNull(Data[i].Hakbatza);
                    var TeacherName = GetEmptyIfNull(Data[i].Name);
                    //var TeacherAdded = GetEmptyIfNull(Data[i].NameOther);

                    alertText += TeacherName + "<br\><br\>";


                    //if (Hakbatza) {

                    //    for (var j = i; j < Data.length; j++) {

                    //        if (Hakbatza == GetEmptyIfNull(Data[j].Hakbatza)) {

                    //            alertText += GetEmptyIfNull(Data[j].NameOther) + " , ";

                    //        }

                    //        else {

                    //           break;
                    //        }


                    //    }

                    //    i = j -1;
                    //    alertText += "<br\><br\>";

                    //} else {
                    //    alertText += TeacherName +  "<br\><br\>";

                    //}

                }

                // alertText = "אין למורה שעות חסרות בכיתות.";

                bootbox.alert(alertText);
            }
        }

    </script>
</asp:Content>
<asp:Content ID="Content2" ContentPlaceHolderID="ContentPlaceHolder1" runat="Server">

    <div class="col-md-12">
        <div class="row dvWeek">
            <div class="panel panel-info">
                <div class="panel-heading">

                    <label class="radio-inline">
                        <input type="radio" name="layer" checked value="0">
                        הכל
                    </label>
                    <label class="radio-inline">
                        <input type="radio" name="layer" value="1">
                        שכבה א'
                    </label>
                    <label class="radio-inline">
                        <input type="radio" name="layer" value="2">
                        שכבה ב'
                    </label>
                    <label class="radio-inline">
                        <input type="radio" name="layer" value="3">
                        שכבה ג'
                    </label>
                    <label class="radio-inline">
                        <input type="radio" name="layer" value="4">
                        שכבה ד'
                    </label>
                    <label class="radio-inline">
                        <input type="radio" name="layer" value="5">
                        שכבה ה'
                    </label>
                    <label class="radio-inline">
                        <input type="radio" name="layer" value="6">
                        שכבה ו'
                    </label>

                    <div class="btn btn-primary btn-round btn-xs" style="float: left; margin-right: 2px" onclick="PrintSchool();">
                        הדפס מערכת <i class="fa fa-print"></i>
                    </div>


                    <div class="btn btn-primary btn-round btn-xs" style="float: left; margin-right: 2px" onclick="OpenClassWindow('','','',1);">
                        ייצא לאקסל <i class="fa fa-file-excel-o"></i>
                    </div>


                </div>
                <div class="panel-body" id="dvAllWeekContainer">
                </div>

            </div>
        </div>
    </div>


    <div style="position: fixed; bottom: 0px; width: 100%; margin-right: 10px; z-index: 1000">

        <div class="col-md-4">
            <div class="row">
                <div class="panel panel-primary" style="padding: 1px; margin-bottom: 0">
                    <div class="panel-heading">
                        <h3 class="panel-title">

                            <b>מורים פנויים - ניתן לגרור מורים לשעות ללא מורה.</b> &nbsp; <a style="cursor: pointer" onclick="InitFreeTeacher('')">הצג הכל...</a>
                        </h3>
                    </div>
                    <div class="panel-body droppable" style="height: 150px; overflow: auto" id="dvTeacherContainer">
                    </div>
                </div>
            </div>
        </div>


        <div class="col-md-6">
            <div class="row">
                <div class="panel panel-primary" style="padding: 1px; margin-bottom: 0">
                    <div class="panel-heading">
                        <h3 class="panel-title">

                            <b>מקצועות - ניתן לגרור מקצועות לשעות ללא מקצוע.</b>
                        </h3>
                    </div>
                    <div class="panel-body droppable" style="height: 150px; overflow: auto" id="dvProContainer">
                    </div>
                </div>
            </div>
        </div>

    </div>


    <%-- טמפלט של שבוע מסויים --%>
    <div id="dvWeekClassTemplate" style="display: none">

        <div class="col-md-12">
            <div class="btn btn-primary btn-round" onclick="SetMissTeacher(@ClassId)">
                <b>@ClassName</b>
            </div>
        </div>
        <div class="col-md-2">
            <div class="panel panel-info">
                <div class="panel-heading dvClassDayTitle">
                    <h3 class="panel-title">
                        <b>יום ראשון</b>
                    </h3>
                </div>
                <div class="panel-body dvClassDayBody" id="dv_@ClassId_1">
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="panel panel-info">
                <div class="panel-heading dvClassDayTitle">
                    <h3 class="panel-title">
                        <b>יום שני</b>
                    </h3>
                </div>
                <div class="panel-body dvClassDayBody" id="dv_@ClassId_2">
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="panel panel-info">
                <div class="panel-heading dvClassDayTitle">
                    <h3 class="panel-title">
                        <b>יום שלישי</b>
                    </h3>
                </div>
                <div class="panel-body dvClassDayBody" id="dv_@ClassId_3">
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="panel panel-info">
                <div class="panel-heading dvClassDayTitle">
                    <h3 class="panel-title">
                        <b>יום רביעי</b>
                    </h3>
                </div>
                <div class="panel-body dvClassDayBody" id="dv_@ClassId_4">
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="panel panel-info">
                <div class="panel-heading dvClassDayTitle">
                    <h3 class="panel-title">
                        <b>יום חמישי</b>
                    </h3>
                </div>
                <div class="panel-body dvClassDayBody" id="dv_@ClassId_5">
                </div>
            </div>
        </div>
        <div class="col-md-2">
            <div class="panel panel-info">
                <div class="panel-heading dvClassDayTitle">
                    <h3 class="panel-title">
                        <b>יום שישי</b>
                    </h3>
                </div>
                <div class="panel-body dvClassDayBody" id="dv_@ClassId_6">
                </div>
            </div>
        </div>

    </div>






    <%-- טמפלט של מקצוע מסויים --%>
    <div id="dvProTemplate" style="display: none">
        <div class="btn btn-primary btn-round draggable" id="dvProfessional_@ProfessionalId" style="float: right; margin: 2px">
            @Name  
        </div>
    </div>
    <%-- טמפלט של מורה מסויים --%>
    <div id="dvTeacherTemplate" style="display: none">
        <div class="btn btn-success btn-round draggable selected" id="dvTeacher_@TeacherId" teacherid="@TeacherId" style="float: right; margin: 2px"
            onclick="SetTeacherData(@TeacherId,1)">
            @Name (@FreeHour) 
        </div>
    </div>

    <%-- טמפלט של שיבוץ מסויים --%>
    <div id="dvAssignTemplate" style="display: none">
        <div class="btn btn-@theme btnWorker droppable @YesNoDragg" style="z-index: 10" id="@AssignmentId" onclick="GetAllOptionalTeacher('@AssignmentId',@HourId,@ClassId)"
            professionalid="@ProfessionalId" professional="@Professional"
            teacherid="@TeacherId" teachername="@TeacherName" classid="@ClassId" hourid="@HourId"
            hakbatza="@Hakbatza" ihud="@Ihud" layerid="@LayerId">
            <span style="font-weight: bold">@Professional</span>
            @TeacherName
        </div>

    </div>
    
   
    <%-- חלון מודלי של שעות מורה מורה --%>
    <div id="dvModalTemplate" style="display: none">


        <div id="ModalTeacherHour_@TeacherId" title="שעות למורה - @TeacherName">
            <div id="dvPrintContainer_@TeacherId">
            </div>

        </div>
    </div>
   

    <div id="dvModalReal">
    </div>


    <ul id="contextMenuAbsence" class="dropdown-menu dropdown-menu-right" role="menu"
        style="display: none;">
        <li><a id="li1" tabindex="-1" href="#">הצג מערכת מורה</a></li>

        <li class="divider"></li>
        <li><a tabindex="-1" href="#">סגור</a></li>
    </ul>


    <div id="dvPrintTemplate" style="display: none">
        <style>
            .emptyHour {
                background-color: gainsboro;
            }

            .dvtitlePrint {
                text-align: center;
                font-style: italic;
                font-family: David;
                font-size: 20px;
            }

            td {
            }

            table {
                border-collapse: collapse;
                table-layout: fixed;
            }

            .shiftTitle {
                text-align: center;
                color: white;
                font-family: David;
                font-size: 12px;
                font-weight: bold;
                height: 10px;
                background-color: #428bca !important;
                border: solid 1px black;
            }

            .dvTeacherName {
                font-family: David;
                font-style: italic;
                font-size: 10px;
                font-weight: bold;
                padding-top: 3px;
                padding: 3px;
            }



            .shiftWorker {
                vertical-align: top;
                padding-bottom: 3px;
                font-size: 12px;
            }







            .teacherRub {
                height: 30px;
                font-family: David;
                font-size: 11px;
                padding: 1px;
                border: solid 1px silver;
            }

            .teacherPro {
                text-align: left;
                font-family: David;
                font-size: 7px;
                font-style: italic;
                font-weight: lighter;
                position: relative;
            }
        </style>




        <table cellpadding="3" cellspacing="1" width="350px" border="0">

            <tr>
                <td class="shiftTitle">יום ראשון
                </td>
                <td class="shiftTitle">יום שני
                </td>
                <td class="shiftTitle">יום שלישי
                </td>
                <td class="shiftTitle">יום רביעי
                </td>
                <td class="shiftTitle">יום חמישי
                </td>
                <td class="shiftTitle">יום שישי
                </td>

            </tr>
            <tr>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_1"></td>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_2"></td>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_3"></td>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_4"></td>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_5"></td>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_6"></td>

            </tr>



        </table>
    </div>
    

    <%-- הדפסה של כל הכיתות--%>
    <div id="dvPrintClassTemplate" style="display: none">
        <style>
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


        <div class='dvtitlePrint'>מערכת שעות בית ספר</div>
        <div class="dvTeacherName">@ClassName</div>
        <br />
        <table cellpadding="0" cellspacing="0" width="100%" border="0">

            <tr>
                <td class="shiftTitle">יום ראשון
                </td>
                <td class="shiftTitle">יום שני
                </td>
                <td class="shiftTitle">יום שלישי
                </td>
                <td class="shiftTitle">יום רביעי
                </td>
                <td class="shiftTitle">יום חמישי
                </td>
                <td class="shiftTitle">יום שישי
                </td>

            </tr>
            <tr>
                <td class="shiftWorker" id="dvClass_@ClassIdPrint_1"></td>
                <td class="shiftWorker" id="dvClass_@ClassIdPrint_2"></td>
                <td class="shiftWorker" id="dvClass_@ClassIdPrint_3"></td>
                <td class="shiftWorker" id="dvClass_@ClassIdPrint_4"></td>
                <td class="shiftWorker" id="dvClass_@ClassIdPrint_5"></td>
                <td class="shiftWorker" id="dvClass_@ClassIdPrint_6"></td>

            </tr>



        </table>
    </div>

    <div id="dvPrintClassContainer" style="display: none">
    </div>


</asp:Content>
