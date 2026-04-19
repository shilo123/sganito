<%@ page language="C#" autoeventwireup="true" inherits="BetKneset_BetKneset, App_Web_z5sp4oli" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
    <title>בית כנסת - מעגלים</title>

    <script src="../assets/js/Generic.js"></script>
    <link rel="stylesheet" href="../assets/css/bootstrap-rtl.css">
    <script type="text/javascript" src="../assets/js/bootstrap.min.js"></script>
    <link href="../assets/css/rtl-css/style-rtl.css" rel="stylesheet" />
    <style>
        .btn-warning:hover {
            color: #fff;
            background-color: #f0ad4e;
            border-color: #eea236;
        }

        .btn-info:hover {
            color: #fff;
            background-color: #5bc0de;
            border-color: #46b8da;
        }

        .btn-default:hover {
            color: #428bca;
            background-color: #fff;
            border-color: #ccc;
        }


        .btn-default:focus {
            color: #428bca;
            background-color: #fff;
            border-color: #ccc;
        }
    </style>
    <script src="../assets/js/lib/jquery-2.1.1.min.js"></script>

    <script type="text/javascript">


        var CurrentId = "";
      

        $(document).ready(function () {

           
            LoadData(0);
           

               


             
        });

        function LoadData(TypeId) {
            var Data = Ajax("BetKneset_GetHTML", "Type="+TypeId+"&IsFromScreen=0");
          
            if (Data[0]) {
                $("#dvInMain").html(Data[0].BetHTML);
                $(".dvMainbuttons").css("display", "");

                $(".dvGroupButton").hide();

                $("#dvDeleteALERT").hide();
                $(".navigation,#left-navigation").hide();
                $("#min-wrapper").css("padding", "0px");

                $("#ddlType").val(Data[0].TypeId);


                $('#dvInMain div,span').click(function () {
                    var elem = $(this);
                    var style = elem.css('font-size');

                    var elemId = elem.attr("id");

                    if (elemId) {
                        CurrentId = elemId;
                        SetAbsoulteAddFont(this);
                        var elemVal = $(this).text();

                    }

                });
            }
            else {
                $("#dvInMain").html("");
            }

        }

        function SetAbsoulteAddFontFromNew(elem) {
            var elemId = $(elem).attr("id");


            CurrentId = elemId;
            SetAbsoulteAddFont(elem);

        }

        function SetAbsoulteAddFont(el) {
            $(".dvGroupButton").hide();
            // .position() uses position relative to the offset parent, 
            var pos = $(el).position();

            // .outerWidth() takes into account border and padding.
            var width = $(el).offset().left - $(window).scrollLeft();

            var topE = $(el).offset().top - $(window).scrollTop();

            var elWidth = $(el).width();

            try {
                var number = eval(CurrentId.replace("dv", ""));
                if (number > 27 && number < 45) {
                   // elWidth = elWidth - 50;
                }



                $("#dvDeleteALERT").hide();
            } catch (e) {

                $("#dvDeleteALERT").show();
                if (CurrentId == "dvLargeImage") $("#dvDeleteALERT").hide();

            }





            $(".dvGroupButton").css({
                position: "absolute",
                top: (topE) + "px",
                left: (width + elWidth + 15) + "px"
            }).show();

        }


        function AddRemoveFont(dir) {

            var selection = window.getSelection();
            if (selection && $.trim(selection) != "" && dir < 5) {
                savedRange = selection.getRangeAt(0);
                wrapper = document.createElement('span');
                savedRange.surroundContents(wrapper);
                selection.selectAllChildren(wrapper);

                if (dir == 1) {

                    var originalSize = $(wrapper).css('font-size');

                    $(wrapper).css('font-size', parseFloat(originalSize) + 1);

                } else if (dir == 2) {
                    var originalSize = $(wrapper).css('font-size');

                    $(wrapper).css('font-size', parseFloat(originalSize) - 1);

                }

                else if (dir == 3) {
                    var originalSize = $(wrapper).css('margin-right');

                    $(wrapper).css('margin-right', parseFloat(originalSize) - 3);

                }

                else if (dir == 4) {
                    var originalSize = $(wrapper).css('margin-right');

                    $(wrapper).css('margin-right', parseFloat(originalSize) + 3);

                }


                return;




            }




            //up
            if (dir == 1) {

                var originalSize = $('#' + CurrentId).css('font-size');

                $('#' + CurrentId).css('font-size', parseFloat(originalSize) + 1);

            } else if (dir == 2) {
                var originalSize = $('#' + CurrentId).css('font-size');

                $('#' + CurrentId).css('font-size', parseFloat(originalSize) - 1);

            }

            else if (dir == 3) {
                var originalSize = $('#' + CurrentId).css('margin-right');

                $('#' + CurrentId).css('margin-right', parseFloat(originalSize) - 3);

            }

            else if (dir == 4) {
                var originalSize = $('#' + CurrentId).css('margin-right');

                $('#' + CurrentId).css('margin-right', parseFloat(originalSize) + 3);

            }

            else if (dir == 5) {
                $(".dvGroupButton").hide();
            }

                // רק להודעות מחיקה של הודעה 
            else if (dir == 6) {
                //var DelObj = $("#" + CurrentId);
                $("#" + CurrentId).remove();


            }
                // רק להודעות הוספה של הודעה 
            else if (dir == 7) {

                var Html = $(".dvAlertTemplate").html();
                var nextId = $("div[id^='dvMessage']").length;
                Html = Html.replace("@Id", nextId);
                if (IsRight) {

                    $(".dvAlertRight").append(Html);

                    IsRight = false;
                } else {

                    $(".dvAlertLeft").append(Html);

                    IsRight = true;


                }


            }

        }

        var IsRight = true;

        function SaveData() {


            var TypeId = $("#ddlType").val();
            $(".dvMainbuttons").css("display", "none");
            var textD = $("#dvInMain").html().replace(/&nbsp;/g," ");

            // alert(html);
            var Data = Ajax("BetKneset_UpdateHTML", "Type=" + TypeId + "&html=" + textD);

            $(".dvMainbuttons").css("display", "");


            if(Data[0].res=="1")
            alert("הלוח נשמר בהצלחה !!");

        }

        function changeLooz() {
            var TypeId = $("#ddlType").val();
           
            LoadData(TypeId);

            $("#ddlType").val(TypeId);
          //  alert();

        }


    </script>
</head>
<body>
    <form id="form1" runat="server">
        <div class="dvGroupButton" id="dvGroupButton">

            <div class="btn btn-primary btn-xs btn-round dvButtonFont" onclick="AddRemoveFont(1)">
                +
            </div>

            <div class="btn btn-primary btn-xs btn-round dvButtonFont" onclick="AddRemoveFont(2)">
                -
            </div>
            <div class="btn btn-primary btn-xs btn-round dvButtonFont" onclick="AddRemoveFont(3)">
                <<
            </div>

            <div class="btn btn-primary btn-xs btn-round dvButtonFont" onclick="AddRemoveFont(4)">
                >> 
            </div>



            <div id="dvDeleteALERT" title="מחק הודעה" class="btn btn-success btn-xs btn-round dvButtonFont" onclick="AddRemoveFont(6)">
                מ
            </div>

            <%--  <div class="btn btn-danger btn-xs btn-round dvButtonFont" onclick="AddRemoveFont(5)">
           
        </div>--%>

            <div class="btn btn-danger btn-xs btn-round dvButtonFont" onclick="AddRemoveFont(5)">
                x
            </div>
        </div>



        <div class="dvInMain" id="dvInMain" runat="server" >
          
        
        </div>




        <div class="dvAlertTemplate" style="display: none">
            <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage@Id"
                onclick="SetAbsoulteAddFontFromNew(this)" contenteditable="true">
            </div>
            <div class="col-md-12"></div>
        </div>
    </form>
</body>
</html>
