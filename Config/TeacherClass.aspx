<%@ Page Title="" Language="C#" MasterPageFile="~/MasterPage/MasterPage.master" AutoEventWireup="true"
    CodeFile="TeacherClass.aspx.cs" Inherits="Config_TeacherClass" %>

<asp:Content ID="Content1" ContentPlaceHolderID="head" runat="Server">
    <script type="text/javascript" src="../assets/js/jquery-ui.js"></script>
    <link href="../assets/css/jquery-ui.css" rel="stylesheet" type="text/css" />
    <script type="text/javascript">

        var LayerId = "";

        $(document).ready(function () {
            InitCombos();
            InitTeacherList();
            InitClass();
            InitEVENTS();
            

        });


        function InitCombos() {

            GetComboItems("Tafkid", "", "#ddlTafkid", "TafkidId", "Name");
            //GetComboItems("Tafkid", "ConfigurationId=" + ConfigurationId, "#ddlTafkid", "TafkidId", "Name");
            GetComboItems("Professional", "ConfigurationId=" + ConfigurationId, "#ddlProfessional", "ProfessionalId", "Name");


        }

        function InitEVENTS() {

            $("input[name=layer]:radio").change(function () {

                InitClass();
            });


            DefineRightClickEVENT();
        }

        //******************* Teacher********

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

            var CurrentTeacherId = $(Obj).attr("id").replace("dvTeacher_", "");


            $("#dvPrintContainer").html("");

            var Template;



            var Data = Ajax("Teacher_GetAllTeacherHours", "TeacherId=" + CurrentTeacherId);

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

            $("#spModalTitleTeacherName").html("שעות למורה - " + Data[0].TeacherName);
            $("#ModalTeacherHour").modal();

        }



        //function OpenTeacherHours(Obj,type) {

        //    var CurrentTeacherId = $(Obj).attr("id").replace("dvTeacher_", "");


        //    $("#dvPrintContainer").html("");

        //    var Template;

           

        //    var Data = Ajax("Teacher_GetAllTeacherHours", "TeacherId=" + CurrentTeacherId);

        //    var PrevTeacherId = "";

        //    var PrevDayId = "";

        //    var DayContainer = "";



        //    for (var i = 0; i < Data.length; i++) {

        //        var DayId = (Data[i].HourId).toString().substring(0, 1);
        //        //var DayId2 = (TargetObj.HourId).toString().substring(0, 1);

        //        if (PrevTeacherId != Data[i].TeacherId) {

        //            Template = $("#dvPrintTemplate").html();
        //            Template = Template.replace("@TeacherName", Data[i].TeacherName);
        //            Template = Template.replace(/@TeacherId/g, Data[i].TeacherId);

        //            $("#dvPrintContainer").append(Template);
        //            PrevTeacherId = Data[i].TeacherId;




        //        }



        //        var className = (Data[i].ClassNameAssign) ? Data[i].ClassNameAssign : "";
        //        var ProfessionalName = (Data[i].Professional) ? Data[i].Professional : "";
        //        var isWork = Data[i].isWork;

        //        var addClass = "";
        //        if (isWork) {

        //            addClass = "emptyHour";
        //        }


        //        DayContainer = "<div class='teacherRub "+addClass+"'>" + className + "</div><div class='teacherPro'>"
        //            + ProfessionalName + "</div>";

        //        //<div class=''>" + Data[i].Professional + "</div>";
        //        $("#dvTeachHour_" + PrevTeacherId + "_" + DayId).append(DayContainer);

        //    }

        //    $("#spModalTitleTeacherName").html("שעות למורה - " + Data[0].TeacherName);
        //    $("#ModalTeacherHour").modal();

        //}



        function InitTeacherList() {




            var teacherData = Ajax("Teacher_GetTeacherList", "TeacherId=-99");

            var TeachHTML = "";

            $("#dvTeacherContainer").html("");

            var PrevTafkidId = "";

            for (var i = 0; i < teacherData.length; i++) {



                if (PrevTafkidId != teacherData[i].TafkidId) {

                    PrevTafkidId = teacherData[i].TafkidId;
                    $("#dvTeacherContainer").append("<div style='clear:both'></div>");


                }


                TeachHTML = $("#dvTeacherTemplate").html();
                TeachHTML = TeachHTML.replace(/@Name/g, teacherData[i].FullText);
                TeachHTML = TeachHTML.replace(/@TeacherId/g, teacherData[i].TeacherId);

                var theme = "primary";
                if (teacherData[i].TafkidId == "2") {

                    theme = "success";//מורה מקצועי
                }
                if (teacherData[i].TafkidId == "3") {

                    theme = "danger";// קרן קרב
                }
                TeachHTML = TeachHTML.replace(/@theme/g, theme);



                $("#dvTeacherContainer").append(TeachHTML);




            }

            DefineDragAndDropEvents();

        }


        function SetTeacherData(TeacherId, Type) {

            SelectedTeacherId = TeacherId;
            OpenUpdateTeacher(Type);
        }


        var SelectedType = "";
        var SelectedTeacherId = "";

        function OpenUpdateTeacher(Type) {


            SelectedType = Type;

            // עדכון
            if (Type == "1") {


                var TeacherData = Ajax("Teacher_GetTeacherList", "TeacherId=" + SelectedTeacherId);


                $("#ddlTafkid").val(TeacherData[0].TafkidId);
                $("#ddlProfessional").val(TeacherData[0].ProfessionalId);
                

                $("#txtFirstName").val(TeacherData[0].FirstName);
                $("#txtLastName").val(TeacherData[0].LastName);
                $("#txtEmail").val(TeacherData[0].Email);
                $("#txtFrontaly").val(TeacherData[0].Frontaly);
                $("#ddlFreeDay").val(TeacherData[0].FreeDay);

                $("#txtTz").val(TeacherData[0].Tz);
                $("#txtShehya").val(TeacherData[0].Shehya)
                $("#txtPartani").val(TeacherData[0].Partani);



                $("#spModalTitleTeacher").html("עדכון פרטי מורה - " + TeacherData[0].FirstName + " " + TeacherData[0].LastName);
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

                $("#spModalTitleTeacher").html(" הוספת מורה חדש/ה ");
                $("#ModalTeacher").modal();
            }




        }

        function DeleteTeacher() {


            bootbox.confirm("האם אתה בטוח שברצונך למחוק מורה עם השיבוצים שלו?", function (result) {
                if (result) {
                    SelectedType = 3;
                    SaveData();
                    // resetTeacher();

                }
            });


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
            //if (SelectedType == "2") SelectedTeacherId = res[0].TeacherId;


            //InitAutoComplete();

            // UpdateSelectedFromData();

            //BuildTeacherLooz();

            $("#ModalTeacher").modal("hide");

            InitTeacherList();

        }

        //***********************************


        //******************* class**********
        function InitClass() {



            $("#dvClassContainer").html("");
            LayerId = $("input[name='layer']:checked").val();



            var mydata = Ajax("Class_GetClassByLayerId", "LayerId=" + LayerId);
            var PrevClassId = "";
            var ClassHtml = "";


            for (var i = 0; i < mydata.length; i++) {
                if (mydata[i].ClassId != PrevClassId) {

                    ClassHtml = $("#dvClassTemplate").html();

                   
                    ClassHtml = ClassHtml.replace(/@ClassCountHour/g, mydata[i].ClassCountHour);
                    ClassHtml = ClassHtml.replace(/@ClassId/g, mydata[i].ClassId);
                    ClassHtml = ClassHtml.replace(/@ClassName/g, mydata[i].ClassName);
                    ClassHtml = ClassHtml.replace(/@ClassFOREdit/g, mydata[i].ClassFOREdit);

                    ClassHtml = ClassHtml.replace(/@Seq/g, mydata[i].Seq);
                    $("#dvClassContainer").append(ClassHtml);


                    PrevClassId = mydata[i].ClassId;
                }


                if (mydata[i].ClassTeacherId > "0") {


                    var Hakbatza = mydata[i].Hakbatza;


                    var TeacherInClassHTML = $("#dvTeacherInClassTemplate").html();
                    TeacherInClassHTML = TeacherInClassHTML.replace(/@ClassId/g, mydata[i].ClassId);
                    TeacherInClassHTML = TeacherInClassHTML.replace(/@TeacherId/g, mydata[i].TeacherId);

                    var TeacherName = mydata[i].TeacherName;
                    if (Hakbatza) {

                        var j = i;
                        while (mydata[j + 1] && Hakbatza == mydata[j + 1].Hakbatza && PrevClassId == mydata[j+1].ClassId) {
                            TeacherName = TeacherName + "<br>" + mydata[j + 1].TeacherName;
                            j++;
                        }

                        i = j;


                    }

                    if (mydata[i].Ihud) {
                        TeacherName = "<u>" + TeacherName + "</u>";
                    }
                    TeacherInClassHTML = TeacherInClassHTML.replace(/@TeacherName/g, TeacherName);
                    TeacherInClassHTML = TeacherInClassHTML.replace(/@Hakbatza/g, mydata[i].Hakbatza);
                    TeacherInClassHTML = TeacherInClassHTML.replace(/@Ihud/g, mydata[i].Ihud);
                    TeacherInClassHTML = TeacherInClassHTML.replace(/@ClassTeacherId/g, mydata[i].ClassTeacherId);
                    TeacherInClassHTML = TeacherInClassHTML.replace(/@Hour/g, (mydata[i].Hour) ? mydata[i].Hour : "");

                    var theme = "primary";
                    if (mydata[i].TafkidId == "2") {

                        theme = "success";//מורה מקצועי
                    }
                    if (mydata[i].TafkidId == "3") {

                        theme = "danger";// קרן קרב
                    }
                    TeacherInClassHTML = TeacherInClassHTML.replace(/@theme/g, theme);



                    
                    $("#dvClassCotainTeacher_" + PrevClassId).append(TeacherInClassHTML);


                   

                   // var p = $("#dv_" + mydata[i].ClassId + "_" + mydata[i].TeacherId);
                   // var position = p.position();
                   //// alert(position.top);


                   // if (mydata[i].Ihud) {
                   //     $("#dvClassCotainTeacher_" + PrevClassId).append(
                   //         "<svg width='600'  style='position:absolute'><line x1='0' y1='50' x2='650' y2='70' stroke='black'/></svg>"
                   //     );


                   // }
                   // if (isHakbatza) i++;

                }

              




            }


            DefineDragAndDropEvents();
        }


        var SelectedClassId = "";
        var SelectedMode = "";
        function OpenClassWindow(ClassId, ClassName, Seq, mode) {






            SelectedClassId = ClassId;
            SelectedMode = mode;

            if (mode == 1) {
                $("#spModalTitle").html("כיתה חדשה");
            } else {

                $("#spModalTitle").html(ClassName);
            }


            $("#txtClassName").val(ClassName);
            $("#txtSeq").val(Seq);

            $("#ModalClass").modal();



        }

        function DeleteClass(ClassId) {


            bootbox.confirm("האם אתה בטוח שברצונך למחוק כיתה עם כל המורים המשוייכים לה?", function (result) {
                if (result) {

                    SelectedMode = 3;
                    SelectedClassId = ClassId;

                    SaveClassData();
                    return;
                }
            });


        }

        function SaveClassData() {

            var ClassName = $("#txtClassName").val();
            var Seq = $("#txtSeq").val();


            if (SelectedMode != "3") {

                if (!ClassName) {
                    bootbox.alert("לא ניתן לעדכן כיתה ללא שם");
                    return;
                }

                if (!Seq || isNaN(Seq)) {
                    bootbox.alert("לא ניתן לעדכן כיתה ללא מספר");
                    return;
                }

            }

            Ajax("Class_SetClassData", "ClassId=" + SelectedClassId + "&LayerId=" + LayerId
                  + "&ClassName=" + ClassName + "&Seq=" + Seq + "&mode=" + SelectedMode
                );

            InitClass();

            $("#ModalClass").modal('hide');



        }
        //***********************************
        function DefineDragAndDropEvents() {
            $(".draggable").draggable({
                // cancel: ".borrowStyleNoDrag",
                helper: "clone",
                cursor: "move",

                appendTo: "body",
                zIndex: 10000,


              //  revert: true,
                start: function (event, ui) {
                    // alert($(this).attr("class"));
                    ui.helper.width($(this).width());
                   
                   
                }


            });
            $(".droppable").droppable({
              //  cancel: ".innerTeacher",
                greedy: true,
                accept: ".draggable",
                drop: function (event, ui) {

                   
                    var TargetId = $(this).attr("id");
                    var SourceId = ui.draggable.attr("id");

                    var TargetHakbatza = GetEmptyIfNull($(this).attr("Hakbatza"));
                   

                    var SourceHakbatza = GetEmptyIfNull(ui.draggable.attr("Hakbatza"));

                    var TargetIhud = GetEmptyIfNull($(this).attr("Ihud"));
                    var SourceIhud = GetEmptyIfNull(ui.draggable.attr("Ihud"));

                    var TargetClassTeacherId = GetEmptyIfNull($(this).attr("ClassTeacherId"));
                    var SourceClassTeacherId = GetEmptyIfNull(ui.draggable.attr("ClassTeacherId"));


                    var Hour = "";

                    var Type = "1";
                    
                    //Source = Teacher
                    //Target = class

                    //-- 1 הכנסה מריק
                    //-- 3 הכנסה להקבצה
                    //-- 2 איחוד
                    //-- 4 עדכון שעות
                    //-- 5 מחיקה

                    TargetId = TargetId.replace("dvClassCotainTeacher_", "");
                    SourceId = SourceId.replace("dvTeacher_", "");
                  
                    // אם מדובר במחיקה
                    if (TargetId == "dvTeacherContainerFORDelete") {

                        var firstIndex =  SourceId.indexOf('_');
                        var lastindex = SourceId.lastIndexOf('_');
                        TargetId = SourceId.substring(firstIndex + 1, lastindex);
                        SourceId = SourceId.substring(lastindex+1);
                        
                        
                     
                        
                        Type = "5";


                    }
                   

                 //   var TeacherIdHakbatza = "";

                    //הקבצות
                    if (TargetId.indexOf("dv_") != "-1") {
                        var firstIndex = TargetId.indexOf('_');
                        var lastindex = TargetId.lastIndexOf('_');

                        //שאליו מוסיפים את החדש מוצא את המורה
                      //  TargetClassTeacherId = TargetId.substring(lastindex + 1);

                        if (SourceId == TargetId.substring(lastindex + 1)) return;

                        // מוצא את הכיתה
                        TargetId = TargetId.substring(firstIndex + 1, lastindex); 

                        //SourceId - מורה 

                      //  alert(TargetClassTeacherId +" "+ SourceId);

                       // alert();

                        Type = "3";
                    }


                    //העתקת מורים בין הכיתות 
                    if (SourceId.indexOf("dv_") != "-1") {

                      //  

                        var firstIndex = SourceId.indexOf('_');
                        var lastindex = SourceId.lastIndexOf('_');


                        TargetHakbatza= SourceId.substring(firstIndex + 1, lastindex);
                        // קומבינה מכניס כאן את כיתת מקור 

                        SourceId = SourceId.substring(lastindex + 1);
                        // כאן מכניס את המורה בטרגת יש את הכיתה שמעתיק אליה

                        //אם כיתת מקור שווה לכיתת יעד 
                        if (TargetHakbatza == TargetId || SourceHakbatza == GetEmptyIfNull($(this).attr("Hakbatza"))) {

                            return;
                        };
                        

                       // alert(TargetHakbatza+" "+TargetId);

                        // מוצא את הכיתה
                       // TargetId = כיתה יעד
                       // alert(Source);

                         Type = "2";
                    }
                  

                   

                   
                   var errMes =  Ajax("Class_SetTeacherToClass", "ClassId=" + TargetId + "&TeacherId=" + SourceId + "&Hour=" + Hour 
                     + "&TargetHakbatza=" + TargetHakbatza + "&SourceHakbatza=" + SourceHakbatza
                     + "&TargetIhud=" + TargetIhud + "&SourceIhud=" + SourceIhud
                     + "&TargetClassTeacherId=" + TargetClassTeacherId + "&SourceClassTeacherId=" + SourceClassTeacherId
                     + "&Type=" + Type

                     );


                   if (errMes[0].res == 0) {
                       InitClass();
                   }

                  


                    
                }

            });
        }

       

        function SetHourToTeacherInClass(ClassId,TeacherId,Hour,Ihud,ClassTeacherId,Hakbatza){
            
            if (!$.isNumeric(Hour)) {

                bootbox.alert("שדה רק למספרים");
                return;

            }


            var errMes = Ajax("Class_SetTeacherToClass", "ClassId=" + ClassId + "&TeacherId=" + TeacherId + "&Hour=" + Hour
                    + "&TargetHakbatza=&SourceHakbatza=" + Hakbatza + "&TargetIhud=&SourceIhud=" + Ihud
                    + "&TargetClassTeacherId=&SourceClassTeacherId="+ ClassTeacherId
                    + "&Type=4"

                    );

            if (errMes[0].res == 1) {
                bootbox.alert("לא ניתן להוסיף שעות מעבר לשעות המוגדרות למורה");
            }

          //  if (errMes[0].res == 0) {
                InitClass();
            //}


        }





    </script>
</asp:Content>
<asp:Content ID="Content2" ContentPlaceHolderID="ContentPlaceHolder1" runat="Server">



   




    <div class="col-md-9">
        <div class="row dvWeek">
            <div class="panel panel-info">
                <div class="panel-heading">


                    <label class="radio-inline">
                        <input type="radio" name="layer" checked value="1">
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

                    <div class="btn btn-success btn-round btn-xs" style="float: left; margin-right: 2px" onclick="OpenClassWindow('','','',1);">
                        הוסף כיתה לשכבה המסומנת
                    </div>


                </div>
                <div class="panel-body" style=" overflow: auto">

                    <div id="dvClassContainer" class="droppable">
                    </div>





                </div>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="row dvWeek">
            <div class="panel panel-info">
                <div class="panel-heading">
                    <%--<h3 class="panel-title" >&nbsp;מורים 
                    </h3>--%>
                    <div style="padding: 1px">
                        מורים

                    <div class="btn btn-success btn-round btn-xs" style="float: left; margin-right: 2px" 
                        onclick="OpenUpdateTeacher(2);">
                        הוסף מורה
                    </div>
                    </div>
                </div>
                <div class="panel-body droppable" id="dvTeacherContainerFORDelete" style="height: 700px; overflow: auto">

                    <div id="dvTeacherContainer">
                    </div>


                </div>
            </div>
        </div>
    </div>



    <%-- טמפלט של מורה מסויים --%>
    <div id="dvTeacherTemplate" style="display: none">
        <div class="btn btn-@theme btn-round draggable selected" id="dvTeacher_@TeacherId" style="float: right; margin: 2px"
            onclick="SetTeacherData(@TeacherId,1)">
            @Name  
        </div>
    </div>


    <%-- טמפלט של מורה בתוך כיתה מסויים --%>
    <div id="dvTeacherInClassTemplate" style="display: none">
        <div id="dv_@ClassId_@TeacherId" Hakbatza="@Hakbatza" ClassTeacherId="@ClassTeacherId" Ihud="@Ihud" class="draggable droppable" style="margin-bottom:3px;">
            <div class="btn btn-@theme btn-round" style="width: 65%; margin-left: 2px">
                @TeacherName
            </div>
            <input type="text" id="txt_@ClassId_@TeacherId" style="width: 33%; float: left;"
                class="form-control" value="@Hour" onchange="SetHourToTeacherInClass(@ClassId,@TeacherId,this.value,@Ihud,@ClassTeacherId,@Hakbatza);">
        </div>
    </div>

    <%-- טמפלט של כיתה מסויים --%>
    <div id="dvClassTemplate" style="display: none">
        <div class="col-md-3"  >

            <div>סה"כ שעות - <span class="spTotal">@ClassCountHour</span></div>

            <div class="row dvWeek" style="width: 100%">
                <div class="panel panel-primary">
                    <div class="panel-heading">
                        <h3 class="panel-title">@ClassName
                                        
                            <div class="btn btn-danger btn-round btn-xs" style="float: left; margin-right: 2px" onclick='DeleteClass(@ClassId);'>
                                X
                            </div>

                            <div class="btn btn-success btn-round btn-xs" style="float: left;" onclick='OpenClassWindow(@ClassId,"@ClassFOREdit",@Seq,2);'>
                                ערוך
                            </div>
                        </h3>
                    </div>
                    <div class="panel-body droppable" style="height: 700px" id="dvClassCotainTeacher_@ClassId">
                    </div>
                </div>
            </div>
        </div>
    </div>



    <%-- חלון מודלי של כיתה --%>
    <div class="modal fade" id="ModalClass" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
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
                            <label>שם כיתה</label>
                            <input type="text" placeholder="" id="txtClassName" name="txtClassName"
                                class="form-control">
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="form-group">
                            <label>מספר כיתה</label>

                            <input type="text" placeholder="" id="txtSeq" name="txtSeq"
                                class="form-control">
                        </div>
                    </div>






                    <div class="col-md-12" style="text-align: left">

                        <br />

                        <button type="button" class="btn btn-info btn-round" onclick="SaveClassData()">
                            <i class="glyphicon glyphicon-edit"></i>&nbsp; <span>עדכן פרטי כיתה</span>
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

    <%-- חלון מודלי של מורה --%>
    <div class="modal fade" id="ModalTeacher" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header label-info">
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">
                        &times;</button>
                    <h4 class="modal-title" id="spModalTitleTeacher"></h4>
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
                        <input type="text" placeholder="" id="txtFrontaly" name="txtFrontaly"
                            class="form-control">
                    </div>


                    <div class="col-md-4">
                        <label>שעות שהייה </label>
                        <input type="text" placeholder="" id="txtShehya" name="txtShehya"
                            class="form-control">
                    </div>


                    <div class="col-md-4">
                        <label>שעות פרטני</label>
                        <input type="text" placeholder="" id="txtPartani" name="txtPartani"
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
                        <button type="button" class="btn btn-danger btn-round" onclick="DeleteTeacher()">
                            <i class="glyphicon glyphicon-edit"></i>&nbsp; <span>מחק מורה</span>
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

     <%-- חלון מודלי של שעות מורה מורה --%>
    <div class="modal fade" id="ModalTeacherHour" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header label-info">
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">
                        &times;</button>
                    <h4 class="modal-title" id="spModalTitleTeacherName"></h4>
                </div>
                <div class="modal-body" >

                   <div id="dvPrintContainer">



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
        <li><a id="li1" tabindex="-1" href="#">הצג מערכת מורה</a></li>
      
        <li class="divider"></li>
        <li><a tabindex="-1" href="#">סגור</a></li>
    </ul>


      <div id="dvPrintTemplate" style="display: none">
          <style>

           .emptyHour{
               background-color:gainsboro;

           }
           
                .dvtitlePrint{

                    text-align:center;
                    font-style:italic;
                    font-family:David;
                    font-size:50px;


                }

                td{

                    
                }

                table
                {
                    border-collapse:collapse;
                    table-layout:fixed;
                  

                }
                .shiftTitle
                {
                    text-align: center;
                  
                  
                    color:white;
                    font-family:David;
                    font-size:18px;
                    font-weight:bold;
                    height:20px;
                      background-color: #428bca !important;
                     border:solid 1px black;

                }

                .dvTeacherName{
                     font-family:David;
                     font-style:italic;
                    font-size:30px;
                    font-weight:bold;
                   
                    padding-top:40px;
                    padding:10px;


                }
            
               
            
                .shiftWorker
                {
                   
                   
                    vertical-align: top;
                    padding-bottom: 10px;
                   
                    font-size: 12px;
                }
            
              
            
              
            
                

                .teacherRub
                {
                    height:40px;
                   
                    font-family:David;
                    font-size:14px;
                    padding:1px;
                    border:solid 1px silver;
                    font-weight:bold;
                 
                }
                .teacherPro{

                    text-align:left;
                    font-family:David;
                    font-size:12px;
                  
                    font-style:italic;
                    font-weight:lighter;
                    position:relative;
                }
            
          
        </style>



      
      
        <table cellpadding="3" cellspacing="1" width="100%" border="0">
          
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
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_1">
                  
                </td>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_2">
                   
                </td>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_3">
                   
                </td>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_4">
                   
                </td>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_5">
                   
                </td>
                <td class="shiftWorker" id="dvTeachHour_@TeacherId_6">
                   
                </td>
                
            </tr>
           
           
           
        </table>
    </div>

    



</asp:Content>
