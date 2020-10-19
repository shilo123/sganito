<%@ Page Language="C#" AutoEventWireup="true" CodeFile="BetKneset.aspx.cs" Inherits="BetKneset_BetKneset" %>

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

            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {


                
               $('.dvBox').css('height', "");
                //$('body').css('overflow', 'auto');

                //$('.dvBox').css('width', '99%').css('font-size', '60px');
                //$('.dvbadageTzahi,.dvbadageTzahi span').css('font-size', '60px');

                //$('.dvZmanim').removeClass('dvZmanim');
                //$('.dvZmanimSP').removeClass('dvZmanimSP');
                //$('.spComment').css('font-size', '40px');
                //$('.dvAlertMessage,.dvAlertMessage span div').css('font-size', '40px');

                //$('.dvPageTitle').css('font-size', '60px');

                //$('.dvAlertMessage').css('width', '99%');
                //$('.dvAlighnRight').removeClass('dvAlighnRight');

               

                //$('.dvCotainer,.dvCotainerM1,.dvCotainerM2').height('100%');


            } else {
              //  SETHeight();

            }
          






        });

        function LoadData(TypeId) {
           var Data = Ajax("BetKneset_GetHTML", "Type=" + TypeId + "&IsFromScreen=0");

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
                      elWidth = elWidth - 50;
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
            var textD = $("#dvInMain").html().replace(/&nbsp;/g, " ");

            // alert(html);
            var Data = Ajax("BetKneset_UpdateHTML", "Type=" + TypeId + "&html=" + textD);

            $(".dvMainbuttons").css("display", "");


            if (Data[0].res == "1")
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



        <div class="dvInMain" id="dvInMain" runat="server">
            
               <div class="">
                <div class="col-md-4" style="padding: 2px">
                    <div class="col-md-12 btn btn-info btn-round dvBox dvCotainer" style="height: 783.5px;">
                        <div class="dvBasad" contenteditable="true">בס"ד אלול תשע"ח</div>
                        <div class="imgStyle">
                            <img src="../assets/images/tfila.png">
                        </div>
                        <div class="dvPageTitle">זמני תפילות חול</div>
                        <br>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="28">שחרית מנין א':</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv1" style="font-size: 22px;">5:30<br></span></div>
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv30">ימים ב' וה': </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv2" style="font-size: 22px;">5:25</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv32">שחרית מנין ב': </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv3" style="font-size: 22px;">6:15</span></div>
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv33">ימים ב' וה': </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv4" style="font-size: 23px;">6:10</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv34">שחרית מנין ג': </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv5" style="font-size: 22px;">6:40</span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv6" style="font-size: 17px;">משכן ידידיה</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv35">שחרית מנין ד': </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" id="dv7" contenteditable="true" style="font-size: 15px;"><span style="font-size: 22px;">7:30</span><br></span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv8" style="font-size: 18px;">בבית המדרש</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv36">שחרית נץ: </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv9" style="font-size: 22px;">5:25</span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv10" style="font-size: 17px;">משכן ידידיה</span></div>
                        </div>
                        <div class="col-md-12">------------------------------------------</div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv37">שחרית(שישי):</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv11" style="font-size: 23px;">8:15</span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv12" style="font-size: 18px;">בבית המדרש</span></div>
                        </div>
                        <div class="col-md-12">------------------------------------------</div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv38">מנחה: </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv13" style="font-size: 22px;">13:00</span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv14" style="font-size: 17px; margin-right: 3px;">משכן ידידיה</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv44">מנחה: </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" id="dv15" contenteditable="true" style="font-size: 20px;"><span style="font-size: 24px;"><span style="font-size: 25px;"><span style="font-size: 24px;"><span style="font-size: 23px;"><span style="font-size: 24px;"><span style="font-size: 23px;">16:30</span></span></span></span></span></span></span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv16" style="font-size: 16px; margin-right: 3px;">שיעור משנה יומית</span></div>
                        </div>
                        <div class="col-md-12">------------------------------------------</div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv39">ערבית: </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv17" style="font-size: 21px;"><span style="font-size: 22px;"><span style="font-size: 23px;">17:30</span></span></span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv18" style="font-size: 16px;">שיעור לאחר התפילה</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                    <div class="col-md-4 dvZmanim" contenteditable="true" id="dv40">ערבית: </div>
                    <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv19" style="font-size: 22px;">20:00</span></div>
                    <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv20" style="font-size: 16px;">בית כנסת בגבעה</span></div>
                </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv41">כולל ערב: </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv21" style="font-size: 22px;">20:00</span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv22" style="font-size: 19px;">משכן ידידה</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv42">ערבית: </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv23" style="font-size: 22px;"><u>20:00</u></span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv24" style="font-size: 19px;">משכן ידידיה</span></div>
                        </div>
                        <div class="col-md-12" id="dv46" contenteditable="true" style="margin-top:10px;">
                            ברכת החודש
                        </div>
                        <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dv43" contenteditable="true" style="font-size: 22px; margin-right: 0px;"><br></div>
                    </div>
                </div>
                <div class="col-md-4" style="padding: 2px">
                    <div class="col-md-12 btn btn-warning btn-round dvBox dvCotainerM1" style="height: 783.5px;">
                        <div class="dvPageTitle dvMainbuttons" style="display: none;">
                            <div class="btn btn-default btn-round mennageButton dvMainbuttons" style="display: none;">
                                <select id="ddlType" class="form-control " onchange="changeLooz();">
                                    <option value="1">שבת</option>
                                    <option value="2">חג פסח</option>
                                    <option value="3">שביעי של פסח</option>
                                    <option value="4">חג עצמאות</option>
                                    <option value="5">חג שבועות</option>
                                    <option value="6">ראש השנה</option>
                                    <option value="7">יום הכיפורים</option>
                                    <option value="8">חג סוכות</option>
                                    <option value="9">שמחת תורה</option>
                                </select>
                            </div>
                            <div class="btn btn-success btn-round mennageButton dvMainbuttons" onclick="AddRemoveFont(7)" style="display: none;">
                                הוסף הודעה
                            </div>
                            <div class="btn btn-primary btn-round dvMainbuttons" onclick="SaveData()" style="display: none;">
                                שמור לוח
                            </div>
                        </div>
                        <div class="col-md-6 dvAlertRight" style="padding: 1px; margin: 0px">
                            <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage1" contenteditable="true" style="font-size: 15px;"><span style="font-size: 29px;"><span style="font-size: 28px;"><span style="font-size: 27px;"><span style="font-size: 26px;"><span style="font-size: 25px;"><span style="font-size: 24px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><b><span style="font-size: 23px;"><span style="font-size: 22px;"><span style="font-size: 21px;"><span style="font-size: 20px;"><span style="font-size: 19px;"><span style="font-size: 18px;"><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="font-size: 21px;"><span style="font-size: 22px;"><span style="font-size: 23px;"><u>יום שבת </u></span></span></span></span></span></span></span></span></span></span></span></b></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span><div><span style="font-size: 20px;"><span style="font-size: 19px;"><span style="font-size: 18px;"><span style="font-size: 17px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;">שיעור</span></span></span></span></span></span></span> <b><span style="font-size: 18px;"><span style="font-size: 19px;"><span style="font-size: 20px;">בפרשת שבוע </span></span></span></b></span></span></span></span></div><div><span style="font-size: 17px;">      <span style="font-size: 18px;"><span style="font-size: 19px;"><span style="font-size: 20px;"><b>  השבת בשעה                      13:45</b></span></span></span></span></div><div><span style="font-size: 20px;"><span style="font-size: 19px;"><span style="font-size: 18px;"><span style="font-size: 17px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;">שיעור <b><span style="font-size: 18px;"><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="font-size: 21px;">בן איש חי</span></span></span></span></b> </span></span></span></span></span></span></span></span></span></span></span></div><div><span style="font-size: 20px;"><span style="font-size: 19px;"><span style="font-size: 18px;"><span style="font-size: 17px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;">בשעה</span></span></span></span></span></span></span> </span></span></span></span></span><b><span style="font-size: 18px;"><span style="font-size: 17px;"><span style="font-size: 18px;"><span style="font-size: 19px;"><span style="font-size: 20px;">13:50</span></span></span></span></span></b></span></span></span></span></div></div>
                            <div class="col-md-12"></div>
                            <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage2" onclick="SetAbsoulteAddFontFromNew(this)" contenteditable="true"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="font-size: 19px;"><span style="font-size: 20px;"><b><u>כולל יום השישי </u></b></span></span></span></span></span></span></span></span></span></span></span><div><b><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="font-size: 21px;">8:30 </span></span></span></b>  <b><span style="font-size: 19px;">" עין  יעקב "</span></b></div><div><b><span style="font-size: 19px;">9:30 </span></b> <b><span style="font-size: 19px;">" הלכות שבת "</span></b></div></div>
                            <div class="col-md-12"></div>
                            <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage3" onclick="SetAbsoulteAddFontFromNew(this)" contenteditable="true" style="font-size: 20px;"><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="font-size: 21px;"><b><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><u>כולל בוקר</u></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></b></span></span></span> <div><span style="font-size: 19px;"><b><span style="font-size: 20px;"><span style="font-size: 21px;">11:00</span></span></b></span><b> שיעורי תורה </b></div><div><b><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="font-size: 21px;">13:00</span></span></span></b> <b>תפילת  מנחה </b></div></div>
                            <div class="col-md-12"></div>
                            <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage6" onclick="SetAbsoulteAddFontFromNew(this)" contenteditable="true" style="margin-right: 0px;"><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><b><u>שיעור בצורבא מרבנן </u></b></span></span></span></span></span></span><div><b><span style="font-size: 19px;">ביום </span><span style="font-size: 22px;">שלישי </span></b>שיעור  בנושא במשכן ידידיה </div><div><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;">בשעה</span></span></span></span></span></span></span></span><b><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="font-size: 21px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;">20:30</span></span></span></span></span></span></span></span></b></div></div>
                            <div class="col-md-12"></div>

                           

                        
            
            <div class="col-md-12"></div>
        </div>
                        <div class="col-md-6 dvAlertLeft" style="padding: 1px; margin: 0px">


                            <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage5" onclick="SetAbsoulteAddFontFromNew(this)" contenteditable="true"><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><b><u>שיעור לנשים</u></b></span></span></span></span></span></span></span></span></span></span></span><div>ביום שבת במשכן ידידיה </div><div>         <b><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="font-size: 21px;">     בשעה 15:20</span></span></span></b></div></div>
                            <div class="col-md-12"></div>
                            <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage5" onclick="SetAbsoulteAddFontFromNew(this)" contenteditable="true"><span style="font-size: 19px;"><span style="font-size: 20px;"><b><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><u>שיעורי דף היומי </u></span></span></span></span></span></span></span></b></span></span><div><span style="font-size: 19px;"><b> יום שבת </b></span>בשעה <b><span style="font-size: 19px;"><span style="font-size: 20px;">13:30</span></span></b></div><div><b><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><u>יום חול</u></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></span></b></div><div><b><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="font-size: 21px;"><span style="font-size: 22px;">  19:15 משכן ידידיה</span></span></span></span></b></div></div>
                            <div class="col-md-12"></div>
                            <div class="col-md-12"></div>
                            <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage8" onclick="SetAbsoulteAddFontFromNew(this)" contenteditable="true" style="margin-right: 0px;"><b><span style="font-size: 19px;">ביום שבת אחרי תפילת   שחרית נץ יש שיעור</span></b><div><b><span style="font-size: 19px;">      <span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;">בפרשת שבוע </span></span></span></span></span></span></span>.</span></b><br></div></div>
                            <div class="col-md-12"></div>
                          
                        
            <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage9" onclick="SetAbsoulteAddFontFromNew(this)" contenteditable="true"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;">לא לשכוח בתפילה </span></span></span></span></span><div><b><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="margin-right: 3px;"><span style="font-size: 19px;"><span style="font-size: 20px;"><span style="font-size: 21px;">ברך עלינו!</span></span></span></span></span></span></span></span></span></span></span></span></span></span></b></div></div>
            <div class="col-md-12"></div>
        </div>
                    </div>

                </div>
                <div class="col-md-4" style="padding: 2px">
                    <div class="col-md-12 btn btn-info btn-round dvBox dvCotainer" style="height: 783.5px;">
                        <div class="dvBasad" id="dvBasad" contenteditable="true">בס"ד   אלול תשע"ח</div>
                        <div class="imgStyle">
                            <img src="../assets/images/shabat.png" width="130px">
                        </div>
                        <div class="dvPageTitle" id="dv60" contenteditable="true" style="margin-right: -27px;">שבת "תולדות "</div>
                        <div class="col-md-12 dvSubTitle" id="dv61" contenteditable="true">ערב שבת</div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv62" style="margin-right: -3px;">מנחה גדולה:</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv63" style="font-size: 22px; margin-right: 3px;">13:15</span></div>
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv64">מנחה: </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv65" style="font-size: 21px;">16:25</span></div>
                        </div>
                        <div class="col-md-12"><span class="spComment" id="dv66" contenteditable="true" style="font-size: 20px;"><br></span></div>
                        <div class="col-md-12 dvSubTitle" contenteditable="true" id="dv67">יום שבת</div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv68">נץ (פתיחה): </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv69" style="font-size: 22px;">5:13</span></div>
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv70">נץ(הודו):</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv71" style="font-size: 22px;">5:30</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv72">שחרית: </div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv73" style="font-size: 22px;">7:45</span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv74" style="font-size: 18px;">שיעור - תרי"ג  </span></div>
                        </div>
                        <div class="col-md-12">------------------------------------------</div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv75">מנחה א':</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv76" style="font-size: 22px;">12:30</span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv77" style="font-size: 18px;"></span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv78">מנחה ב':</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv79" style="font-size: 22px;">13:15</span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv80"><span style="font-size: 18px;">שיעור בן איש חי</span><br></span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv87">מנחה ג':</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv88" style="font-size: 22px;">15:15</span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv89"></span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-6 dvZmanim" contenteditable="true" id="dv84">תהילים ילדים:</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv85" style="font-size: 21px;">15:00</span></div>
                            <div class="col-md-4 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv86" style="font-size: 17px;">יהודה חורב</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-6 dvZmanim" contenteditable="true" id="dv90" style="font-size: 24px;">אבות ובנים:</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv91" style="font-size: 21px;">15:30</span></div>
                            <div class="col-md-4 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv92" style="font-size: 16px;">יואל חדאד</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv93">מנחה ד':</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv94" style="font-size: 22px;"><u>15:45</u></span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv95"></span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-6 dvZmanim" contenteditable="true" id="dv96">שיעור:</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv97" style="font-size: 21px;">16:15</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-2 dvMessage"><u><b>נושא:</b></u></div>
                            <div style="text-align: center; margin-right: -27px; font-size: 31px;" class="col-md-10 dvMessage" contenteditable="true" id="dv98"><span style="font-size: 27px;">ציות להורים תמיד?!</span></div>
                        </div>
                        <div class="col-md-12" style="padding: 0px">
                            <div class="col-md-4 dvZmanim" contenteditable="true" id="dv99" style="margin-right: 60px;">ערבית:</div>
                            <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv100" style="font-size: 25px;">17:25</span></div>
                            <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv101" style="font-size: 27px; margin-right: -63px;"></span></div>
                        </div>
                          
                    </div>
                </div>
            </div>
        
        
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
