<%@ page title="" language="C#" masterpagefile="~/MasterPage/MasterPage.master" autoeventwireup="true" inherits="Assign_AssignConfig, App_Web_kdr21h4h" %>

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

        /* Loading overlay during automatic scheduling - Professional rich animation */
        #shibutzLoadingOverlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.65);
            z-index: 9999;
            justify-content: center;
            align-items: center;
        }
        #shibutzLoadingOverlay.active {
            display: flex;
        }
        .shibutz-loading-box {
            background: linear-gradient(135deg, #fff 0%, #f8fbff 100%);
            border-radius: 16px;
            padding: 45px 55px;
            text-align: center;
            box-shadow: 0 15px 50px rgba(0,0,0,0.25), 0 0 0 1px rgba(33,150,243,0.1);
            max-width: 400px;
            direction: rtl;
            position: relative;
            overflow: hidden;
        }
        .shibutz-loading-box::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #2196F3, #03A9F4, #00BCD4, #2196F3);
            background-size: 200% 100%;
            animation: shibutz-shimmer 2s linear infinite;
        }
        @keyframes shibutz-shimmer {
            0% { background-position: 100% 0; }
            100% { background-position: -100% 0; }
        }
        .shibutz-loader-wrap {
            position: relative;
            margin: 0 auto 28px;
            width: 120px;
            height: 120px;
        }
        .shibutz-loader-rings {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 3px solid transparent;
            border-top-color: #2196F3;
            animation: shibutz-spin 1s linear infinite;
        }
        .shibutz-loader-rings:nth-child(2) {
            width: 85%;
            height: 85%;
            top: 7.5%;
            left: 7.5%;
            border-top-color: #03A9F4;
            animation-duration: 1.2s;
            animation-direction: reverse;
        }
        .shibutz-loader-rings:nth-child(3) {
            width: 70%;
            height: 70%;
            top: 15%;
            left: 15%;
            border-top-color: #00BCD4;
            animation-duration: 0.8s;
        }
        .shibutz-schedule-grid {
            position: absolute;
            width: 48px;
            height: 48px;
            top: 50%;
            left: 50%;
            margin: -24px 0 0 -24px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(4, 1fr);
            gap: 3px;
        }
        .shibutz-schedule-cell {
            background: #e3f2fd;
            border-radius: 2px;
            animation: shibutz-cell-pulse 1.5s ease-in-out infinite;
        }
        .shibutz-schedule-cell:nth-child(1) { animation-delay: 0s; }
        .shibutz-schedule-cell:nth-child(2) { animation-delay: 0.1s; }
        .shibutz-schedule-cell:nth-child(3) { animation-delay: 0.2s; }
        .shibutz-schedule-cell:nth-child(4) { animation-delay: 0.3s; }
        .shibutz-schedule-cell:nth-child(5) { animation-delay: 0.15s; }
        .shibutz-schedule-cell:nth-child(6) { animation-delay: 0.25s; }
        .shibutz-schedule-cell:nth-child(7) { animation-delay: 0.35s; }
        .shibutz-schedule-cell:nth-child(8) { animation-delay: 0.05s; }
        .shibutz-schedule-cell:nth-child(9) { animation-delay: 0.2s; }
        .shibutz-schedule-cell:nth-child(10) { animation-delay: 0.3s; }
        .shibutz-schedule-cell:nth-child(11) { animation-delay: 0.4s; }
        .shibutz-schedule-cell:nth-child(12) { animation-delay: 0.1s; }
        .shibutz-schedule-cell:nth-child(13) { animation-delay: 0.25s; }
        .shibutz-schedule-cell:nth-child(14) { animation-delay: 0.35s; }
        .shibutz-schedule-cell:nth-child(15) { animation-delay: 0.15s; }
        .shibutz-schedule-cell:nth-child(16) { animation-delay: 0.3s; }
        @keyframes shibutz-cell-pulse {
            0%, 100% { background: #e3f2fd; transform: scale(0.9); opacity: 0.7; }
            50% { background: #2196F3; transform: scale(1.1); opacity: 1; }
        }
        @keyframes shibutz-spin {
            to { transform: rotate(360deg); }
        }
        .shibutz-loading-title {
            font-size: 20px;
            font-weight: bold;
            background: linear-gradient(90deg, #1565C0, #03A9F4, #1565C0);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: shibutz-title-shine 2.5s linear infinite;
            margin-bottom: 10px;
        }
        @keyframes shibutz-title-shine {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
        }
        .shibutz-loading-sub {
            font-size: 14px;
            color: #607D8B;
            margin-bottom: 18px;
        }
        .shibutz-progress-bar {
            height: 4px;
            background: #e0e0e0;
            border-radius: 2px;
            overflow: hidden;
        }
        .shibutz-progress-fill {
            height: 100%;
            width: 100%;
            background: linear-gradient(90deg, transparent 0%, #2196F3 30%, #00BCD4 70%, transparent 100%);
            background-size: 200% 100%;
            border-radius: 2px;
            animation: shibutz-progress 1.8s ease-in-out infinite;
        }
        @keyframes shibutz-progress {
            0% { background-position: 100% 0; }
            100% { background-position: -100% 0; }
        }
        .shibutz-loading-dots {
            display: inline-block;
            animation: shibutz-dots 1.4s ease-in-out infinite;
        }
        @keyframes shibutz-dots {
            0%, 80%, 100% { opacity: 0.3; }
            40% { opacity: 1; }
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

        function ShowLastErrorsReport() {
            // Get last errors from session using the same Ajax helper as DoAssign
            try {
                console.log("Fetching last errors report from session...");
                var errorsResult = Ajax("Assign_GetShibutzErrors");
                console.log("Errors result type:", typeof errorsResult);
                console.log("Errors result:", JSON.stringify(errorsResult));
                
                // ASP.NET Web Service returns {d: "..."} format
                var errorsData = null;
                if (errorsResult) {
                    if (errorsResult.d) {
                        // ASP.NET wraps response in {d: "..."}
                        try {
                            if (typeof errorsResult.d === 'string') {
                                errorsData = JSON.parse(errorsResult.d);
                            } else {
                                errorsData = errorsResult.d;
                            }
                        } catch (e) {
                            console.log("Failed to parse errorsResult.d as JSON:", e, "Raw value:", errorsResult.d);
                            errorsData = errorsResult.d;
                        }
                    } else if (Array.isArray(errorsResult)) {
                        // Direct array response
                        errorsData = errorsResult;
                    } else if (typeof errorsResult === 'string') {
                        // String response - try to parse
                        try {
                            errorsData = JSON.parse(errorsResult);
                        } catch (e) {
                            console.log("Failed to parse errorsResult as JSON:", e, "Raw value:", errorsResult);
                        }
                    } else {
                        console.log("Unexpected errorsResult format:", typeof errorsResult, errorsResult);
                    }
                } else {
                    console.log("errorsResult is null or undefined");
                }
                
                var savedCount = 0;
                var errorCount = 0;
                var errors = [];
                
                if (errorsData && errorsData.length > 0) {
                    console.log("Parsed data - total rows:", errorsData.length);
                    console.log("First row sample:", JSON.stringify(errorsData[0]));
                    
                    // Get counts from LAST row (summary row with ClassId=0)
                    var lastRow = errorsData[errorsData.length - 1];
                    savedCount = lastRow.SavedCount || 0;
                    errorCount = lastRow.ErrorCount || 0;
                    
                    console.log("Summary from last row - savedCount:", savedCount, "errorCount:", errorCount);
                    
                    // Filter out summary rows (ClassId = 0) - keep only actual errors
                    for (var i = 0; i < errorsData.length; i++) {
                        if (errorsData[i].ClassId > 0) {
                            errors.push(errorsData[i]);
                        }
                    }
                    
                    console.log("Filtered errors count:", errors.length, "errorCount from server:", errorCount);
                } else {
                    console.log("No errors data returned or empty array");
                }
                
                // Show modal even if empty (to show summary)
                ShowErrorsModal(errors, savedCount, errorCount);
            } catch (e) {
                console.log("Error fetching last errors report:", e);
                alert("לא ניתן לטעון את דוח השגיאות האחרון: " + e.message);
            }
        }

        function DoFixMissing() {
            IsStop = false;
            $('#dvAlert').hide();
            $('#shibutzLoadingOverlay').addClass('active');
            $('.shibutz-loading-title').html('מתקן חוסרים באמצעות הזזות<span class="shibutz-loading-dots">...</span>');

            $.ajax({
                type: "POST",
                url: "../WebService.asmx/Assign_ShibutzFixMissing",
                data: {},
                async: true,
                dataType: "json",
                success: function (data) {
                    setTimeout(function() {
                        try {
                            var errorsResult = Ajax("Assign_GetShibutzErrors");
                            var errorsData = null;
                            if (errorsResult) {
                                if (errorsResult.d) {
                                    try {
                                        errorsData = typeof errorsResult.d === 'string' ? JSON.parse(errorsResult.d) : errorsResult.d;
                                    } catch (e) { errorsData = errorsResult.d; }
                                } else if (Array.isArray(errorsResult)) {
                                    errorsData = errorsResult;
                                } else if (typeof errorsResult === 'string') {
                                    try { errorsData = JSON.parse(errorsResult); } catch (e) { }
                                }
                            }

                            var savedCount = 0, errorCount = 0, errors = [];
                            if (errorsData && errorsData.length > 0) {
                                var lastRow = errorsData[errorsData.length - 1];
                                savedCount = lastRow.SavedCount || 0;
                                errorCount = lastRow.ErrorCount || 0;
                                for (var i = 0; i < errorsData.length; i++) {
                                    if (errorsData[i].ClassId > 0) errors.push(errorsData[i]);
                                }
                            }

                            if (errors.length > 0) {
                                ShowErrorsModal(errors, savedCount, errorCount);
                            } else if (errorCount > 0) {
                                ShowErrorsModal([], savedCount, errorCount);
                            } else {
                                ShowSuccessModal(savedCount);
                            }
                        } catch (e) {
                            ShowSuccessModal(0);
                        }
                        $('#shibutzLoadingOverlay').removeClass('active');
                        $('.shibutz-loading-title').html('מבצע שיבוץ אוטומטי<span class="shibutz-loading-dots">...</span>');
                    }, 500);
                    UpdateClassStatus();
                    $('#dvAlert').show();
                },
                error: function (request, status, error) {
                    $('#shibutzLoadingOverlay').removeClass('active');
                    $('.shibutz-loading-title').html('מבצע שיבוץ אוטומטי<span class="shibutz-loading-dots">...</span>');
                    bootbox.alert("אירעה שגיאה בזמן תיקון חוסרים. אנא נסה שוב.");
                },
                complete: function () {
                    $('#shibutzLoadingOverlay').removeClass('active');
                }
            });
        }

        function DoAssign() {
            IsStop = false;
            $('#dvAlert').hide();
            $('#shibutzLoadingOverlay').addClass('active');

            $.ajax({
                type: "POST",
                url: "../WebService.asmx/Assign_ShibutzAuto",
                data: {},
                async: true,
                dataType: "json",
                success: function (data) {
                    setTimeout(function() {
                        try {
                            console.log("Fetching errors from session...");
                            var errorsResult = Ajax("Assign_GetShibutzErrors");
                    console.log("Errors result type:", typeof errorsResult);
                    console.log("Errors result:", JSON.stringify(errorsResult));
                    
                    // ASP.NET Web Service returns {d: "..."} format
                    var errorsData = null;
                    if (errorsResult) {
                        if (errorsResult.d) {
                            // ASP.NET wraps response in {d: "..."}
                            try {
                                if (typeof errorsResult.d === 'string') {
                                    errorsData = JSON.parse(errorsResult.d);
                                } else {
                                    errorsData = errorsResult.d;
                                }
                            } catch (e) {
                                console.log("Failed to parse errorsResult.d as JSON:", e, "Raw value:", errorsResult.d);
                                errorsData = errorsResult.d;
                            }
                        } else if (Array.isArray(errorsResult)) {
                            // Direct array response
                            errorsData = errorsResult;
                        } else if (typeof errorsResult === 'string') {
                            // String response - try to parse
                            try {
                                errorsData = JSON.parse(errorsResult);
                            } catch (e) {
                                console.log("Failed to parse errorsResult as JSON:", e, "Raw value:", errorsResult);
                            }
                        } else {
                            console.log("Unexpected errorsResult format:", typeof errorsResult, errorsResult);
                        }
                    } else {
                        console.log("errorsResult is null or undefined");
                    }
                    
                    var savedCount = 0;
                    var errorCount = 0;
                    var errors = [];
                    
                    if (errorsData && errorsData.length > 0) {
                        console.log("Parsed data - total rows:", errorsData.length);
                        console.log("First row sample:", JSON.stringify(errorsData[0]));
                        
                        // Get counts from LAST row (summary row with ClassId=0)
                        var lastRow = errorsData[errorsData.length - 1];
                        savedCount = lastRow.SavedCount || 0;
                        errorCount = lastRow.ErrorCount || 0;
                        
                        console.log("Summary from last row - savedCount:", savedCount, "errorCount:", errorCount);
                        
                        // Filter out summary rows (ClassId = 0) - keep only actual errors
                        for (var i = 0; i < errorsData.length; i++) {
                            if (errorsData[i].ClassId > 0) {
                                errors.push(errorsData[i]);
                                // Log first error message to check encoding
                                if (i === 0 && errorsData[i].Message) {
                                    console.log("First error message raw:", errorsData[i].Message);
                                    console.log("First error message char codes:", 
                                        Array.from(errorsData[i].Message).map(function(c) { return c.charCodeAt(0); }));
                                }
                            }
                        }
                        
                        console.log("Filtered errors count:", errors.length, "errorCount from server:", errorCount);
                    } else {
                        console.log("No errors data returned or empty array");
                    }
                    
                    // Always show modal - with errors or success message
                    if (errors.length > 0) {
                        // We have actual errors - show errors modal
                        console.log("Showing errors modal with", errors.length, "errors");
                        ShowErrorsModal(errors, savedCount, errorCount);
                    } else if (errorCount > 0) {
                        // Server says there are errors but we didn't get them - show empty errors modal
                        console.log("Server reports", errorCount, "errors but none received - showing empty errors modal");
                        ShowErrorsModal([], savedCount, errorCount);
                    } else if (savedCount > 0) {
                        // No errors and has saved hours - show success modal
                        console.log("Showing success modal with savedCount:", savedCount);
                        ShowSuccessModal(savedCount);
                    } else {
                        // No data at all - but if we have 0 saved and 0 errors, maybe there's a problem
                        // Check if there are actually unassigned hours by looking at the page
                        console.log("No data returned - savedCount:", savedCount, "errorCount:", errorCount);
                        if (savedCount == 0 && errorCount == 0) {
                            // This is suspicious - no hours saved and no errors reported
                            // Show a warning instead of success
                            console.log("Warning: No hours saved and no errors reported - this might indicate a problem");
                            ShowErrorsModal([], 0, 0);
                        } else {
                            ShowSuccessModal(savedCount);
                        }
                    }
                } catch (e) {
                    console.log("Error getting shibutz errors:", e);
                    ShowSuccessModal(0);
                }
                $('#shibutzLoadingOverlay').removeClass('active');
            }, 500);
                UpdateClassStatus();
                $('#dvAlert').show();
                },
                error: function (request, status, error) {
                    $('#shibutzLoadingOverlay').removeClass('active');
                    bootbox.alert("אירעה שגיאה בזמן ביצוע השיבוץ. אנא נסה שוב.");
                },
                complete: function () {
                    $('#shibutzLoadingOverlay').removeClass('active');
                }
            });
        }

        function ShowErrorsModal(errors, savedCount, errorCount) {
            var dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];
            
            var html = '<div class="container-fluid">';
            html += '<div class="row">';
            html += '<div class="col-md-12">';
            html += '<div class="alert alert-info" style="margin-bottom: 15px;">';
            html += '<strong>סיכום:</strong> שובצו ' + (savedCount || 0) + ' שעות, ' + (errorCount || errors.length) + ' שגיאות';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            
            html += '<div class="row">';
            html += '<div class="col-md-12">';
            html += '<table class="table table-bordered table-hover table-striped" style="margin-bottom: 0;">';
            html += '<thead>';
            html += '<tr class="danger">';
            html += '<th style="text-align: center; width: 80px;">כיתה</th>';
            html += '<th style="text-align: center; width: 100px;">יום</th>';
            html += '<th style="text-align: center; width: 80px;">שעה</th>';
            html += '<th>סיבת השגיאה</th>';
            html += '<th style="text-align: center; width: 200px;">מורים שחסרים שעות</th>';
            html += '</tr>';
            html += '</thead>';
            html += '<tbody>';
            
            if (errors.length > 0) {
                for (var i = 0; i < errors.length; i++) {
                    var error = errors[i];
                    var dayName = dayNames[error.Day - 1] || ("יום " + error.Day);
                    var className = error.ClassName || ("כיתה " + error.ClassId);
                    
                    // Log to console for debugging
                    console.log("Error " + i + ":", {
                        ClassId: error.ClassId,
                        ClassName: className,
                        Day: error.Day,
                        Hour: error.Hour,
                        Message: error.Message,
                        MessageLength: error.Message ? error.Message.length : 0,
                        MessageType: typeof error.Message
                    });
                    
                    var teachersMissingHours = error.TeachersMissingHours || "";
                    
                    html += '<tr>';
                    html += '<td style="text-align: center;"><strong>' + className + '</strong></td>';
                    html += '<td style="text-align: center;">' + dayName + '</td>';
                    html += '<td style="text-align: center;">' + error.Hour + '</td>';
                    html += '<td style="direction: rtl; text-align: right;">' + error.Message + '</td>';
                    html += '<td style="direction: rtl; text-align: right;">' + (teachersMissingHours || "אין") + '</td>';
                    html += '</tr>';
                }
            } else if (errorCount > 0) {
                // Server reports errors but we didn't get them
                html += '<tr>';
                html += '<td colspan="5" style="text-align: center; direction: rtl;">';
                html += 'השרת דיווח על ' + errorCount + ' שגיאות, אך הפרטים לא התקבלו. אנא בדוק את הקונסול לפרטים נוספים.';
                html += '</td>';
                html += '</tr>';
            } else if (savedCount == 0 && errorCount == 0) {
                // No hours saved and no errors - suspicious
                html += '<tr>';
                html += '<td colspan="5" style="text-align: center; direction: rtl;">';
                html += 'לא שובצו שעות ולא דווחו שגיאות. ייתכן שיש בעיה בתהליך השיבוץ. אנא בדוק את הקונסול לפרטים נוספים.';
                html += '</td>';
                html += '</tr>';
            }
            
            html += '</tbody>';
            html += '</table>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            
            bootbox.dialog({
                title: '<i class="fa fa-exclamation-triangle"></i> דוח שגיאות שיבוץ',
                message: html,
                size: 'large',
                buttons: {
                    ok: {
                        label: "סגור",
                        className: "btn-info",
                        callback: function() {
                            return true;
                        }
                    }
                }
            });
        }

        function ShowSuccessModal(savedCount) {
            var html = '<div class="container-fluid">';
            html += '<div class="row">';
            html += '<div class="col-md-12">';
            html += '<div class="alert alert-success" style="margin-bottom: 15px; text-align: center; font-size: 18px;">';
            html += '<strong>שיבוץ הושלם בהצלחה!</strong><br/>';
            html += 'שובצו ' + (savedCount || 0) + ' שעות';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            
            bootbox.dialog({
                title: '<i class="fa fa-check-circle"></i> שיבוץ אוטומטי',
                message: html,
                size: 'medium',
                buttons: {
                    ok: {
                        label: "סגור",
                        className: "btn-success",
                        callback: function() {
                            return true;
                        }
                    }
                }
            });
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

    <div id="shibutzLoadingOverlay">
        <div class="shibutz-loading-box">
            <div class="shibutz-loader-wrap">
                <div class="shibutz-loader-rings"></div>
                <div class="shibutz-loader-rings"></div>
                <div class="shibutz-loader-rings"></div>
                <div class="shibutz-schedule-grid">
                    <div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div>
                    <div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div>
                    <div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div>
                    <div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div><div class="shibutz-schedule-cell"></div>
                </div>
            </div>
            <div class="shibutz-loading-title">מבצע שיבוץ אוטומטי<span class="shibutz-loading-dots">...</span></div>
            <div class="shibutz-loading-sub">אנא המתן, התהליך עשוי לקחת מספר שניות</div>
            <div class="shibutz-progress-bar"><div class="shibutz-progress-fill"></div></div>
        </div>
    </div>

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
                        <div class="input-group dvUploadPublic">
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

                    <div class="col-md-3">

                        <div class="btn btn-primary btn-round" style="width: 100%; font-size: 20px; font-weight: bold" onclick="DoAssign()">
                            שבץ אוטמטית
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="btn btn-warning btn-round" style="width: 100%; font-size: 18px; font-weight: bold; color: #fff;" onclick="DoFixMissing()">
                            תקן חוסרים (הזזות)
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
                    
                    <div class="col-md-2">
                        <div class="btn btn-info btn-round" style="width: 100%; font-size: 18px; font-weight: bold" onclick="ShowLastErrorsReport()">
                            הצג דוח שגיאות אחרון
                        </div>
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

    <!-- Errors Modal (will be created dynamically) -->

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
                            <div class="btn btn-danger btn-round" onclick="DeleteExtra('@HourExtraId')">
                                מחק
                            </div>
                        </div>





                    </div>


    </div>



</asp:Content>
