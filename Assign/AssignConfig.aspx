<%@ Page Title="" Language="C#" MasterPageFile="~/MasterPage/MasterPage.master" AutoEventWireup="true"
    CodeFile="AssignConfig.aspx.cs" Inherits="Assign_AssignConfig" %>

<asp:Content ID="Content1" ContentPlaceHolderID="head" runat="Server">

    <style>
        .btn-file {
            position: relative;
            overflow: hidden;
        }

            .btn-file input[type=file] {
                position: absolute;
                top: 0;
                right: 0;
                min-width: 100%;
                min-height: 100%;
                font-size: 100px;
                text-align: right;
                filter: alpha(opacity=0);
                opacity: 0;
                background: red;
                cursor: inherit;
                display: block;
            }

        input[readonly] {
            background-color: white !important;
            cursor: text !important;
        }


        .Disable {
            background: lightgray;
            border: solid 1px gray;
        }
    </style>

    <script type="text/javascript">

        var mydata;


        $(document).ready(function () {
             //var Data = Ajax("Class_GetAllClass");
             //BuildCombo(Data, "#ddlClass,#ddlLayer", "ClassId", "ClassName");

            var TeacherData = Ajax("Teacher_GetTeacherList", "TeacherId=");
            BuildCombo(TeacherData, "#ddlTeacher", "TeacherId", "FullText");

            GetComboItems("Days","", "#ddlDays", "DayId", "Name");



            GetComboItems("Layer", "", "#ddlLayer", "LayerId", "Name");

            AjaxAsync("Gen_GetTable", "TableName=Configuration&Condition=ConfigurationId=" + ConfigurationId,
                function (px) {

                    $("#txtRetzef").val(px[0].MaxHourInShibutz);
                    $("#txtMin").val(px[0].MinForPitzul);
                    SchoolId = px[0].SchoolId;
                });

            $('#fileUpload1').on('change', function () {
                var filePath = $(this).val().split('\\').pop();
                $('#txtUploadFile1').val(filePath);
            });



            if (RoleId != "1") {

                $('#dvLogo').hide();
            }



        });


        function SaveData() {

            var MaxHourInShibutz = $("#txtRetzef").val();
            var MinForPitzul = $("#txtMin").val();

            if (isNaN(MinForPitzul) || isNaN(MaxHourInShibutz)) {
                bootbox.alert("לא ניתן לעדכן מספר");
                return;
            }

            Ajax("Assign_SetConfiguration", "MaxHourInShibutz=" + MaxHourInShibutz + "&MinForPitzul=" + MinForPitzul);

        }


        var ObjUpload = "";
        function UploadFile(Obj, Seq) {


            //  ObjUpload = Obj;

            //  $(Obj).html("<img src='../assets/img/ajax-loader.gif' />");


            var data = new FormData();

            var files = $("#fileUpload" + Seq).get(0).files;

            if (files.length > 0) {



                data.append("SchoolId", SchoolId);
                data.append("File", files[0]);

            }

            var ajaxRequest = $.ajax({
                type: "POST",
                url: "../WebService.asmx/UploadFile",
                contentType: false,
                processData: false,
                data: data,

                success: function (data) {
                    //if (Seq == "1") {
                    //    $('#imgLogo').prop("src", "../Docs/" + GroupId + "_" + TypeId + "/1_Logo.png");
                    //}

                    //setTimeout("AjaxAsync()", 2000);
                    //  alert();
                    // $('#imgLogo').prop("src","../assets/images/SchoolLogo/" + SchoolId + "_.png");
                    location.reload();
                },

                error: function () {
                    bootbox.alert("Upload Not Correct...");
                    //  setTimeout("AjaxAsync()", 2000);

                }

            });


        }

        function DeleteFile(Seq) {

            bootbox.confirm("האם אתה בטוח שברצונך למחוק הלוגו?", function (result) {


                var res = Ajax("DeleteFile", "SchoolId=" + SchoolId);
                $('#txtUploadFile1').val("");
                location.reload();
                //if (Seq == "1") {
                //    $('#imgLogo').prop("src", "../assets/img/find_user.png");
                //}

            });

        }

        function DoAssign() {

          
            IsStop = false;
            $('#dvAlert').hide();
            var x = Ajax("Assign_ShibutzAuto");
            UpdateClassStatus();
            $('#dvAlert').show();
        }



        function DoManualAssign() {
           
            $('#dvAlert').hide();
            Ajax("Assign_GetDataForAssignAuto", "LayerId=" + $('#ddlLayer').val());

            UpdateClassStatus();
           
        }


        function StopBuildShibutz(px) {

          
            




            UpdateClassStatus();

           // var isRight = true;

           // var Data = Ajax("Class_GetClassStatus");
           // for (var i = 0; i < Data.length; i++) {


           //     var HourSchool = Data[i].HourSchool;
           //     var ClassHour = Data[i].ClassHour;
           //     var LayerId = Data[i].LayerId;

           //     if (HourSchool != ClassHour && LayerId == $('#ddlLayer').val()) isRight = false;

           // }

           //if (!isRight && !IsStop) DoAssign();









        }



        var IsStop = false;
        function DeleteAssign() {

            $("#ModalDeleteType").modal();


            //IsStop = true;
            //bootbox.confirm("שים לב, לחיצה על כפתור אישור תמחק את כל נתוני השיבוץ...", function (result) {

              
            //    Ajax("Assign_DeleteAssignAuto", "LayerId=" + $("#ddlLayer").val());
            //    UpdateClassStatus();
            //});

            //
        }

        function DeleteType(action) {

            if (action == -1) return;
            var AddALERT = (action == 1) ? " האוטמטי ": " כולל הגדרות שהייה פרטני ונעיצה "
            bootbox.confirm("שים לב, לחיצה על כפתור אישור תמחק את כל נתוני השיבוץ " + AddALERT, function (result) {

                if (result) {
                    Ajax("Assign_DeleteAssignAuto", "IsAuto=" + action);
                    UpdateClassStatus();
                }
            });

        }



        function OpenExtra() {

            BuildExtraTable();
            $("#ModalExtra").modal();
        }



        function BuildExtraTable() {
            $("#dvExtraContainer").html("");
            var ReqHtml = "";

            mydata = Ajax("HourExtra_DML", "Type=0&HourExtraId=&TeacherId=&ClassId=&DayId=&HourExtra=");
          
           


            for (var i = 0; i < mydata.length; i++) {

                ReqHtml = $("#dvExtraTemplate").html();

                ReqHtml = ReqHtml.replace(/@FullName/g, IsNullDB(mydata[i].FullName));
                ReqHtml = ReqHtml.replace("@ClassName", IsNullDB(mydata[i].ClassName));
                ReqHtml = ReqHtml.replace("@Day", IsNullDB(mydata[i].Day));

                ReqHtml = ReqHtml.replace("@HourExtra", IsNullDB(mydata[i].HourExtra));
                ReqHtml = ReqHtml.replace("@HourExtraId", IsNullDB(mydata[i].HourExtraId));
              

                $("#dvExtraContainer").append(ReqHtml);


            }


        }

        function SaveExtra() {


            var TeacherId = $("#ddlTeacher").val();
            var ClassId = $("#ddlClass").val();
            var DayId = $("#ddlDays").val();
            var HourExtra = $("#txtExtra").val();



            Ajax("HourExtra_DML", "Type=1&HourExtraId=&TeacherId=" + TeacherId + "&ClassId=" + ClassId + "&DayId=" + DayId +
                "&HourExtra=" + HourExtra);
            BuildExtraTable();


        }


        function DeleteExtra(HourExtraId) {

            Ajax("HourExtra_DML", "Type=2&HourExtraId=" + HourExtraId + "&TeacherId=&ClassId=&DayId=&HourExtra=");
            BuildExtraTable();

        }

        function StopShibutz() {

            location.reload();
            $('#ddlLayer').val("1004");
        }


    </script>
</asp:Content>
<asp:Content ID="Content2" ContentPlaceHolderID="ContentPlaceHolder1" runat="Server">


    <div class="col-md-12">
        <div class="row dvWeek">
            <div class="panel panel-info">
                <div class="panel-heading">
                    <h3 class="panel-title">&nbsp;הגדרת כלליות לשיבוץ אוטמטי 
                    </h3>
                </div>
                <div class="panel-body">
                    <div class="col-md-3">
                        <div class="input-group ls-group-input">
                            <span class="input-group-addon">מקסימום שעות למורה ביום</span>
                            <input type="text" id="txtRetzef" class="form-control">
                        </div>
                    </div>

                    <div class="col-md-3">
                        חוץ מ  <a href="#" onclick="OpenExtra()">לחץ כאן...</a>
                    </div>

                    <div class="clearfix"></div>
                    <div class="col-md-4">
                        <div class="input-group ls-group-input">
                            <span class="input-group-addon">מינימום שעות לפיצול בימים</span>
                            <input type="text" id="txtMin" class="form-control">
                        </div>
                    </div>

                    <div class="col-md-4">
                        <button type="button" class="btn btn-info btn-round" onclick="SaveData()">
                            <i class="glyphicon glyphicon-edit"></i>&nbsp; <span>שמור </span>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    </div>

    <div class="col-md-12" id="dvLogo">
        <div class="row">
            <div class="panel panel-info">
                <div class="panel-heading">
                    <h3 class="panel-title">&nbsp;לוגו בית ספר 
                    </h3>
                </div>
                <div class="panel-body">


                    <div class="col-sm-3">
                        <div class="input-group dvUploadPublic" style="">
                            <span class="input-group-btn">
                                <span class="btn btn-primary btn-file">בחר לוגו
                            <input id="fileUpload1" type="file" />
                                </span></span>
                            <input type="text" id="txtUploadFile1" style="direction: ltr" class="form-control" readonly>
                        </div>
                    </div>
                    <div class="col-sm-3 dvUploadPublic">
                        <button type="button" class="btn btn-success btn-round" onclick="UploadFile(this,'1')">
                            העלה לוגו
                        </button>
                        <button type="button" class="btn btn-info btn-round" onclick="DeleteFile('1')">
                            מחק
                        </button>

                    </div>




                </div>
            </div>
        </div>
    </div>





    <div class="col-md-12">
        <div class="row">
            <div class="panel panel-info">
                <div class="panel-heading">
                    <h3 class="panel-title">&nbsp;שיבוץ אוטמטי 
                    </h3>
                </div>
                <div class="panel-body">

                    <div class="col-md-12" style="font-size: 18px; color: brown; font-weight: bold">
                        שים לב!!! שיבוץ אוטמטי מוחק את כל השיבוצים שנעשו עד כה.
                          <br />
                        <br />
                    </div>

                <%--    <div class="col-md-4">
                        <div class="input-group ls-group-input">
                            <span class="input-group-addon">בחר שכבה לשיבוץ</span>
                            <select id="ddlLayer" class="form-control">
                              <option value="0">הכל</option>
                            </select>
                        </div>


                    </div>--%>

                    <div class="col-md-4">

                        <div class="btn btn-primary btn-round" style="width: 100%; font-size: 20px; font-weight: bold" onclick="DoAssign()">
                            שבץ אוטמטית
                        </div>
                    </div>
                  <%--  <div class="col-md-2">

                        <div class="btn btn-primary btn-round" style="width: 100%; font-size: 20px; font-weight: bold" onclick="DoManualAssign()">
                            שבץ ידנית
                        </div>
                    </div>--%>

                    <div class="col-md-2">

                        <div class="btn btn-danger btn-round" style="width: 100%; font-size: 20px; font-weight: bold" onclick="DeleteAssign()">
                            מחק שיבוץ!!! 
                        </div>

                      <%--   <div class="btn btn-danger btn-round" style="" onclick="StopShibutz()">
                            עצור שיבוץ!!! 
                        </div>--%>
                    </div>

                    <div class="col-md-12" id="dvAlert" style="font-size: 28px; color: brown; font-weight: bold; display: none; text-align: center">
                        שיבוץ אוטמטי לשכבה בוצע בהצלחה!! 
                          <br />
                        <br />
                    </div>


                </div>
            </div>
        </div>
    </div>


    <div class="modal fade" id="ModalExtra" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header label-info">
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">
                        &times;</button>
                    <h4 class="modal-title">רשימת מורים המורשים לעבוד יותר מ2 שעות
                    </h4>
                </div>
                <div class="modal-body" id="Div13">

                     <div class="col-md-12">

                        <div class="col-md-3">
                           <b><u>שם מורה</u></b>
                        </div>

                        <div class="col-md-3">
                           <b> <u>שם כיתה</u></b>
                        </div>

                        <div class="col-md-2">
                            <b> <u>יום בשבוע</u></b>
                        </div>

                        <div class="col-md-3">
                            <b> <u>שעות</u></b>
                        </div>



                        <div class="col-md-1">
                             <b> <u>&nbsp;</u></b>
                        </div>





                    </div>

                      <div class="clear">
                        &nbsp;
                    </div>

                     <div class="col-md-12">

                        <div class="col-md-3">
                            <div class="input-group ls-group-input">
                                <select id="ddlTeacher" class="form-control">
                                    <option value="0">-- בחר מורה -- </option>
                                </select>
                            </div>
                        </div>

                        <div class="col-md-3">
                            <div class="input-group ls-group-input">
                                <select id="ddlClass" class="form-control">
                                    <option value="0">-- בחר כיתה -- </option>
                                </select>
                            </div>
                        </div>

                        <div class="col-md-2">
                            <div class="input-group ls-group-input">
                                <select id="ddlDays" class="form-control">
                                    <option value="0">-- בחר יום -- </option>
                                </select>
                            </div>
                        </div>

                        <div class="col-md-3">
                            <div class="input-group ls-group-input">
                                <span class="input-group-addon">שעות למורה</span>
                                <input type="text" id="txtExtra" class="form-control">
                            </div>
                        </div>



                        <div class="col-md-1">
                            <div class="btn btn-primary btn-round" onclick="SaveExtra()">
                                הוסף
                            </div>
                        </div>





                    </div>

                     
                     <div id="dvExtraContainer">


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

     <div class="modal fade" id="ModalDeleteType" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-xs">
            <div class="modal-content">
                <div class="modal-header label-info">
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">
                        &times;</button>
                    <h4 class="modal-title">בחירת סוג מחיקה
                    </h4>
                </div>
                <div class="modal-body" id="Div123">

                       <button type="button" class="btn btn-info " data-dismiss="modal" onclick="DeleteType(-1)">
                        ביטול</button>

                      <button type="button" class="btn btn-danger " data-dismiss="modal" onclick="DeleteType(0)">
                        מחיקה מלאה</button>

                      <button type="button" class="btn btn-danger " data-dismiss="modal" onclick="DeleteType(1)">
                        מחיקה של אוטמטי</button>

                    <div class="clear">
                        &nbsp;
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


    <div id="dvExtraTemplate" style="display: none">
         <div class="col-md-12">

                        <div class="col-md-3">
                            @FullName
                        </div>

                        <div class="col-md-3">
                            @ClassName
                        </div>

                        <div class="col-md-2">
                            @Day
                        </div>

                        <div class="col-md-3">
                            @HourExtra
                        </div>



                        <div class="col-md-1">
                            <div class="btn btn-danger btn-round" onclick="DeleteExtra(@HourExtraId)">
                                מחק
                            </div>
                        </div>





                    </div>


    </div>



</asp:Content>
