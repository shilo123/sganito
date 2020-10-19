<%@ Page Title="" Language="C#" MasterPageFile="~/MasterPage/MasterPageEmpty.master" AutoEventWireup="true" CodeFile="AssignMatrix.aspx.cs" Inherits="Assign_AssignMatrix" %>

<asp:Content ID="Content1" ContentPlaceHolderID="head" runat="Server">
    <script src="../assets/js/icheck.min.js"></script>
    <link rel="stylesheet" href="../assets/css/plugins/icheck/skins/all.css">
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
        $(document).ready(function () {


            // for dev
            //FillData();


            FillClassModal();
            InitFreeTeacher("");

            $(".modal").draggable({
                handle: ".modal-header"
            });




        });

        function InitFreeTeacher(ClassId) {

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

        function FillClassModal() {

            var data = Ajax("Class_GetAllClass", "ConfigurationId=" + ConfigurationId);

            var EmpHtml = "";


            var prevLayerId = "0";

            for (var i = 0; i < data.length; i++) {


                if (prevLayerId != data[i].LayerId) {

                    $("#dvClassContainer").append("<div class='clear'></div>");
                    prevLayerId = data[i].LayerId;

                }

                //alert(fullName);
                EmpHtml = $("#dvClassComboTemplate").html();
                EmpHtml = EmpHtml.replace("@ClassName", data[i].ClassName);
                EmpHtml = EmpHtml.replace("@ClassId", data[i].ClassId);
                EmpHtml = EmpHtml.replace("@icheck-blue", "icheck-blue");


                // EmpHtml = EmpHtml.replace("@checin", (ShehyaGroupId > '0') ? 'checked' : 'false');

                $("#dvClassContainer").append(EmpHtml);


            }

            $('input[type=radio][name=checkUncheck]').change(function () {

                if (this.value == "checkAll")
                    $('.icheck-blue').prop("checked", true);

                else
                    $('.icheck-blue').prop("checked", false);


                $('input.icheck-blue').iCheck({
                    checkboxClass: 'icheckbox_flat-blue',
                    radioClass: 'iradio_flat-blue',
                    increaseArea: '20%' // optional
                });




            });

            $('input.icheck-blue').iCheck({
                checkboxClass: 'icheckbox_flat-blue',
                radioClass: 'iradio_flat-blue',
                increaseArea: '20%' // optional
            });





        }

        function FillData() {


            $(".removeClass").remove();

            var Data = Ajax("Assign_GetAssignment", "LayerId=0");
            var PrevClassId = "";
            var PrevDayId = "";

            var ClassCounter = 0;
            for (var i = 0; i < Data.length; i++) {


                var DayId = (Data[i].HourId).toString().substr(0, 1);


                var ClassId = Data[i].ClassId;
                // for dev 
                if (jQuery.inArray(ClassId.toString(), ClassArray) == -1) continue;


                if (DayId != PrevDayId || ClassId != PrevClassId) {
                    ClassCounter = 0;

                    var ClassHtml = $("#dvClassTemplate").html();
                    ClassHtml = ClassHtml.replace(/@ClassId/g, ClassId);
                    ClassHtml = ClassHtml.replace(/@DayId/g, DayId);
                    ClassHtml = ClassHtml.replace(/@AddClass/g, "removeClass");


                    if (DayId == 1)
                        ClassHtml = ClassHtml.replace(/@ClassName/g, Data[i].classHalf);
                    else
                        ClassHtml = ClassHtml.replace(/@ClassName/g, "");
                    $("#dvDay_" + DayId).append(ClassHtml);



                    PrevDayId = DayId;
                    PrevClassId = ClassId;

                }

                var TeachHtml = $("#dvAssignTemplate").html();
                // TeachHtml = TeachHtml.replace(/@theme/g, "primary");
                var TeacherName = (Data[i].TeacherName) ? Data[i].TeacherName : "&nbsp;";
                TeachHtml = TeachHtml.replace(/@theme/g, ((Data[i].AssignmentId) ? "btnTeacherMatrix" : "btnTeacherMatrixEmpty"));
                TeachHtml = TeachHtml.replace(/@YesNoDragg/g, ((Data[i].AssignmentId) ? "draggable" : ""));


                TeachHtml = TeachHtml.replace(/@ProfessionalId/g, GetEmptyIfNull(Data[i].ProfessionalId));
                TeachHtml = TeachHtml.replace(/@Professional/g, (Data[i].Professional) ? (Data[i].Professional + " -") : "");
                TeachHtml = TeachHtml.replace(/@ClassId/g, GetEmptyIfNull(Data[i].ClassId));
                TeachHtml = TeachHtml.replace(/@Hakbatza/g, GetEmptyIfNull(Data[i].Hakbatza));
                TeachHtml = TeachHtml.replace(/@Ihud/g, GetEmptyIfNull(Data[i].Ihud));
                TeachHtml = TeachHtml.replace(/@HourId/g, GetEmptyIfNull(Data[i].HourId));
                TeachHtml = TeachHtml.replace(/@TeacherId/g, GetEmptyIfNull(Data[i].TeacherId));
                TeachHtml = TeachHtml.replace(/@LayerId/g, GetEmptyIfNull(Data[i].LayerId));
                TeachHtml = TeachHtml.replace(/@AssignmentId/g, GetEmptyIfNull(Data[i].AssignmentId));






                var j = i;

                while (Data[j + 1] && Data[j].ClassId == Data[j + 1].ClassId
                    && Data[j].HourId == Data[j + 1].HourId) {

                    TeacherName += "/" + Data[j + 1].TeacherName;   // "<span id='dvTeacherHour_" + Data[j + 1].TeacherId + "' class='selected'>" + Data[j + 1].TeacherName + "</span>";

                    j++;
                }

                if (GetEmptyIfNull(Data[i].Ihud)) {

                    // TeacherName = "<u>" + TeacherName + "</u>";
                }

                i = j;

                TeachHtml = TeachHtml.replace(/@TeacherName/g, TeacherName);

                $("#dv_" + ClassId + "_" + DayId).append(TeachHtml);


                ClassCounter = ClassCounter + 1;



                $("#dvDay_" + DayId).css("height", 17 * ClassCounter);

                if (DayId == 1) $("#dvDay_1").css("height", 17 * (ClassCounter + 1));


            }


            var WidthPercent = 98.0 / ClassArray.length;


            $(".dvMarixTable").css("width", WidthPercent + "%");

            DefineDragAndDropEvents();
            DefineRightClickEVENT();
        }

        function OpenClass() {


            $("#ModalClass").modal();
        }

        var ClassArray = [];
        function SaveClass() {
            ClassArray = [];
            var ClassIds = "0";

            $("input.icheck-blue").each(function () {

                if (this.checked) {
                    var ObjId = $(this).attr("id").replace("ch_", "").replace("@ClassId", "0");
                    ClassArray.push(ObjId);
                    // ClassIds = ClassIds + "," + ObjId;

                }

            });




            FillData();
            $("#ModalClass").modal('hide');



        }

        var YellowTeacherName = "";

        function LightTeacher(TeacherName) {

            if ($.trim(TeacherName)) {

                YellowTeacherName = TeacherName;
                $(".btnTeacherMatrix").css("background", "#428bca").css("color", "white").css("border", "0");

                $(".dvTeacherBlue:contains(" + TeacherName + ")").animate({ backgroundColor: "#ffff00" }, 'slow').css("color", "#428bca").css({ "border-color": "#428bca", "border-width": "1px", "border-style": "solid" });
            }
        }

        function GetObject(Obj, Type) {

            if (Type == 2) {

                var eTop = Obj.offset().top;
                var eLeft = Obj.offset().left;
                //var rect2 = getRectangle($("#dvProContainer"));
                var rect = getRectangle($("#dvTeacherContainer"));
                if (inCoords(eLeft, eTop, rect)) {

                    return false;

                }
            }



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

                    ui.helper.width($(this).width());



                }


            });
            $(".droppable").droppable({
                //  cancel: ".innerTeacher",
                //  greedy: true,
                accept: ".draggable",

                drop: function (event, ui) {
                    // alert();
                    var SourceObj = GetObject(ui.draggable, 1);


                    var TargetObj = GetObject($(this), 2);

                    //  alert(SourceObj.ObjId + ' ' + SourceObj.HourId);
                    //   alert(TargetObj.ClassId + ' ' + TargetObj.HourId);
                    if (!TargetObj) return;

                    var Type = "";




                    //שיבוץ מורה לעמדה ריקה או רק עם מקצוע
                    if (SourceObj.ObjId.indexOf("dvTeacher_") != "-1" && !TargetObj.TeacherId) {

                        SourceObj.ObjId = SourceObj.ObjId.replace("dvTeacher_", "");
                        Type = 1;



                    }




                    ////שיבוץ מקצוע לעמדה ריקה או רק עם מורה
                    //if (SourceObj.ObjId.indexOf("dvProfessional_") != "-1") {
                    //    SourceObj.ObjId = SourceObj.ObjId.replace("dvProfessional_", "");
                    //    Type = 2;


                    //}




                    //שיבוץ מורה לעמדה ריקה משיבוץ קיים
                    else if (SourceObj.TeacherId && !TargetObj.TeacherId && TargetObj.ObjId.indexOf("dvTeacherContainer") == "-1") {

                        SourceObj.ObjId = SourceObj.TeacherId;
                        Type = 7;
                        //  alert(SourceObj.ObjId);

                    }

                    //מחיקת מורה משיבוץ ומקצוע
                    else if (TargetObj.ObjId.indexOf("dvTeacherContainer") != "-1") {
                        TargetObj.ObjId = "";
                        Type = 3;



                    }


                    //// הורדת מקצוע
                    //if (TargetObj.ObjId.indexOf("dvProContainer") != "-1") {
                    //    TargetObj.ObjId = "";
                    //    Type = 4;

                    //}


                    ////שיבוץ מורה לעמדה תפוסה הווה אומר הקבצה 
                    //if (SourceObj.ObjId.indexOf("dvTeacher_") != "-1" && TargetObj.TeacherId) {

                    //    SourceObj.ObjId = SourceObj.ObjId.replace("dvTeacher_", "");
                    //    Type = 5;

                    //}

                    //// 
                    //if (SourceObj.HourId == TargetObj.HourId && SourceObj.LayerId == TargetObj.LayerId &&
                    //    !TargetObj.TeacherId && !TargetObj.ProfessionalId && SourceObj.TeacherId) {

                    //    Type = 6;

                    //}





                    if (!Type) return;



                    var errMessage = SetDataTODB(Type, SourceObj, TargetObj);
                    if (errMessage == 0) {
                        //  alert(errMessage);

                        // RefreshClass(SourceObj, TargetObj);

                        if (Type == 1 || Type == 3 || Type == 5) InitFreeTeacher('');

                        FillData();

                        LightTeacher(YellowTeacherName);
                        // DefineDragAndDropEvents();
                        // DefineRightClickEVENT();


                    } else {

                        if (errMessage == 2) {


                            bootbox.alert("מורה כבר משובץ לשעה זו");

                        }
                        if (errMessage == 3) {


                            bootbox.alert("מורה לא מוגדר\ת לעבוד בשעה זו");

                        }
                        if (errMessage == 4) {


                            bootbox.alert("המורה עברה את השעות שהוקצה לה לכיתה זו או לא אמורה ללמד בכיתה זו");

                        }


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
                            OpenTeacherMiss(Obj)

                            // SetPartani(Obj, 1);
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

        function OpenTeacherMiss(Obj) {

            var CurrentTeacherId = $(Obj).attr("id").replace("dvTeacherHour_", "");
            CurrentTeacherId = CurrentTeacherId.replace("dvTeacher_", "");

            var Data = Ajax("Teacher_GetAllMissClass", "TeacherId=" + CurrentTeacherId);
            var alertText = "";


            for (var i = 0; i < Data.length; i++) {
                alertText += Data[i].ClassName + ' ------ ' + Data[i].Diff + " שעות <br\><br\>";
            }

            if (!alertText) alertText = "אין למורה שעות חסרות בכיתות.";

            bootbox.alert(alertText);
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

        function CloseModal(TeacherId) {


            $("#ModalTeacherHour_" + TeacherId).remove();
            // $("#ModalTeacherHour_" + TeacherId).modal('toggle');
        }
    </script>


</asp:Content>
<asp:Content ID="Content2" ContentPlaceHolderID="ContentPlaceHolder1" runat="Server">


    <%-- חלון מודלי של שעות מורה מורה --%>
    <div id="dvModalTemplate" style="display: none">


        <div id="ModalTeacherHour_@TeacherId" title="שעות למורה - @TeacherName">
            <div id="dvPrintContainer_@TeacherId">
            </div>

        </div>
    </div>
   
    
    <div style="overflow: auto">

        <div id="dvDay_1">
            <div class="dvMatrixDayCell">
                א
            </div>


        </div>
        <div class="clear"></div>
        <div id="dvDay_2">
            <div class="dvMatrixDayCell">
                ב
            </div>
        </div>
        <div class="clear"></div>
        <div id="dvDay_3">
            <div class="dvMatrixDayCell">
                ג  
            </div>
        </div>
        <div class="clear"></div>

        <div id="dvDay_4">
            <div class="dvMatrixDayCell">
                ד
            </div>
        </div>
        <div class="clear"></div>

        <div id="dvDay_5">
            <div class="dvMatrixDayCell">
                ה
            </div>
        </div>
        <div class="clear"></div>
        <div id="dvDay_6">
            <div class="dvMatrixDayCell">
                ו
            </div>
        </div>

        <div class="clear"></div>
    </div>

    <div id="dvFreeTeacher" class="dvFreeTeacher" style="float: right">


        <div class="form-group" style="padding: 1px">


            <div id="dvTeacherContainer" class="droppable" style="float: right; width: 100%; border: solid 1px red">
            </div>

            <div id="ddlProfessional" style="float: right" class="btn btn-primary btn-sm" onclick="OpenClass()">
                בחירת כיתות
            </div>
        </div>

    </div>

    <%-- חלון מודלי של כיתות --%>
    <div class="modal fade" id="ModalClass" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header label-info">
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">
                        &times;</button>
                    <h4 class="modal-title">
                        <span id="spTitleName">בחירת כיתות לתצוגה</span>
                    </h4>
                </div>
                <div class="modal-body" id="Div13">
                    <div class="col-md-12">
                        <div class="panel panel-default">
                            <div class="panel-heading">
                                <span style="font-weight: bold">רשימת כיתות &nbsp; &nbsp;</span>
                                <label class="radio-inline">
                                    <input type="radio" name="checkUncheck" id="Clear" value="checkAll">
                                    סמן הכל
                                </label>
                                <label class="radio-inline">
                                    <input type="radio" name="checkUncheck" id="Cloudy" value="UncheckAll">
                                    בטל הכל
                                </label>

                            </div>
                            <div class="panel-body">
                                <div class="row" id="dvClassContainer">
                                </div>
                            </div>
                        </div>

                    </div>




                    <div class="col-md-12" style="text-align: left">
                        <button type="button" class="btn btn-info btn-round" onclick="SaveClass();">
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




    <%--<div class="modal fade ModalTeacherHour_@TeacherId modalTeacher" id="ModalTeacherHour_@TeacherId">
            <div class="modal-dialog " style="padding: 0px; margin: 0px;">
                <div class="modal-content">
                    <div class="label-info" style="height: 20px;color: white; font-weight: bold">

                        <span id="spModalTitleTeacherName_@TeacherId"></span>
                    </div>
                    <div class="modal-body" style="padding: 0px; margin: 1px">

                        <div id="dvPrintContainer_@TeacherId">
                        </div>

                        <div style="width: 350px; text-align: left">
                            <button type="button" class="btn btn-info btn-xs" onclick="CloseModal(@TeacherId)">
                                סגור</button>

                        </div>

                    </div>

                </div>
            </div>
        </div>
    --%>

    <div id="dvModalReal">
    </div>


    <ul id="contextMenuAbsence" class="dropdown-menu dropdown-menu-right" role="menu"
        style="display: none;">
        <li><a id="li1" tabindex="-1" href="#">הצג מערכת מורה</a></li>
        <li><a id="li2" tabindex="-1" href="#">כיתות חסרות למורה</a></li>
        <li class="divider"></li>
        <li><a tabindex="-1" href="#">סגור</a></li>
    </ul>


    <%-- טמפלט של כיתה מסויים --%>
    <div id="dvClassComboTemplate" style="display: none">

        <div style="padding: 5px; width: 20%; float: right">
            <label class="checkbox">
                <input class="@icheck-blue" type="checkbox" id="ch_@ClassId" value="option1">
                @ClassName
            </label>
        </div>
    </div>

    <%-- טמפלט של כיתה מסויים --%>
    <div id="dvClassTemplate" style="display: none">
        <div class="dvMarixTable @AddClass">
            <div class="dvClassTitle">@ClassName</div>
            <div class=" dvMarix_@DayId" id="dv_@ClassId_@DayId">
            </div>

        </div>
    </div>

    <%-- טמפלט של מורה מסויים --%>
    <div id="dvTeacherTemplate" style="display: none">
        <div class="btn btn-success btn-xs draggable selected" id="dvTeacher_@TeacherId" teacherid="@TeacherId" style="float: right; margin: 2px"
            onclick="SetTeacherData(@TeacherId,1)">
            @Name (@FreeHour) 
        </div>
    </div>


    <%-- טמפלט של שיבוץ מסויים --%>
    <div id="dvAssignTemplate" style="display: none">
        <div class="droppable @YesNoDragg @theme dvTeacherBlue selected" onclick="LightTeacher('@TeacherName');" style="z-index: 10" id="@AssignmentId"
            professionalid="@ProfessionalId" professional="@Professional"
            teacherid="@TeacherId" teachername="@TeacherName" classid="@ClassId" hourid="@HourId"
            hakbatza="@Hakbatza" ihud="@Ihud" layerid="@LayerId">
            <span id='dvTeacherHour_@TeacherId'>@TeacherName</span>
        </div>

    </div>

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
</asp:Content>


<%--
  <div id="dvPrintTemplate" style="display: none">
            <style>
                .emptyHour {
                    background-color: gainsboro;
                }

                .dvtitlePrint {
                    text-align: center;
                    font-style: italic;
                    font-family: David;
                    font-size: 50px;
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
                    font-size: 18px;
                    font-weight: bold;
                    height: 20px;
                    background-color: #428bca !important;
                    border: solid 1px black;
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
                    height: 40px;
                    font-family: David;
                    font-size: 14px;
                    padding: 1px;
                    border: solid 1px silver;
                    font-weight: bold;
                }

                .teacherPro {
                    text-align: left;
                    font-family: David;
                    font-size: 12px;
                    font-style: italic;
                    font-weight: lighter;
                    position: relative;
                }
            </style>




    <table cellpadding="3" cellspacing="1" width="100%" border="0">

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
    </div>--%>
