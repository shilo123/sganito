<%@ Page Language="C#" AutoEventWireup="true" CodeFile="BetKneset - Copy.aspx.cs" Inherits="BetKneset_BetKneset" %>

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


       // var CurrentId = "";

       // var IsMobile = true;
        $(document).ready(function () {

            //if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            //    // some code..

            //    $(".dvBox").css("width", "99%");
            //    $(".dvZmanim").removeClass("dvZmanim");
            //    $(".dvZmanimSP").removeClass("dvZmanimSP");
            //    $(".spComment").removeClass("spComment");
            //    $(".dvAlighnRight").removeClass("dvAlighnRight");
               
            //    $("div,span").prop('contenteditable', false );
                
                
            //}

            $(".dvBox").css("width", "99%");

            // $("#dvInMain").load("Screen.html #dvInMain");
            // $(".dvMainbuttons").css("display", "");

            $.get('screen.html', function (data) {
                data = $(data).find('#dvInMain').html();
              //  $("#dvInMain").html(data);
                $(".dvMainbuttons").css("display", "");

                $(".dvGroupButton").hide();

                $("#dvDeleteALERT").hide();
                $(".navigation,#left-navigation").hide();
                $("#min-wrapper").css("padding", "0px");

                $("body").css("overflow", "auto");

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


                //var CurrentHeight = $(document).height();


                //$(".dvCotainer").height(CurrentHeight * 0.96);
                //$(".dvCotainerM1").height(CurrentHeight * 0.76);
                //$(".dvCotainerM2").height(CurrentHeight * 0.18);
            });
        });

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



            $(".dvMainbuttons").css("display", "none");
            var textD = $("#dvInMain").html().replace(/&nbsp;/g," ");

            // alert(html);
            var Data = Ajax("BetKneset_UpdateHTML", "html=" + textD);

            $(".dvMainbuttons").css("display", "");

            alert("הלוח נשמר בהצלחה !!");

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

            <div class="col-md-4" style="padding: 2px">

                <div class="col-md-12 btn btn-info btn-round dvBox dvCotainer">

                    <div class="dvBasad" contenteditable="true">בס"ד חשוון התשע"ח</div>

                    <div class="imgStyle">
                        <img src="../assets/images/tfila.png" />
                    </div>

                    <div class="dvPageTitle">זמני תפילות חול</div>

                    <br />
                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="28">שחרית מנין א':</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv1">13:15</span></div>
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv30">ימים ב' וה': </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv2">16:30</span></div>
                    </div>
                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv32">שחרית מנין ב': </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv3">13:24</span></div>
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv33">ימים ב' וה': </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv4">16:30</span></div>
                    </div>


                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv34">שחרית מנין ג': </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv5">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv6">משכן ידידיה</span></div>
                    </div>
                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv35">שחרית מנין ד': </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" id="dv7" contenteditable="true">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv8">משכן ידידיה</span></div>

                    </div>

                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv36">שחרית נץ: </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv9">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv10">משכן ידידיה</span></div>

                    </div>

                    <div class="col-md-12">------------------------------------------</div>

                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv37">שחרית(שישי):</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv11">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv12">משכן ידידיה</span></div>

                    </div>







                    <div class="col-md-12">------------------------------------------</div>
                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv38">מנחה: </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv13">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv14">משכן ידידיה</span></div>

                    </div>
                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv44">מנחה: </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" id="dv15" contenteditable="true">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv16">שיעור משנה יומית</span></div>

                    </div>

                    <div class="col-md-12">------------------------------------------</div>

                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv39">ערבית: </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv17">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv18">שיעור לאחר התפילה</span></div>
                    </div>


                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv40">ערבית: </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv19">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv20">שיעור לאחר התפילה</span></div>
                    </div>

                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv41">כולל ערב: </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv21">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv22">שיעור לאחר התפילה</span></div>
                    </div>
                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv42">ערבית: </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv23">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv24">שיעור לאחר התפילה</span></div>
                    </div>

                    <div class="col-md-12" style="padding: 0px">
                        <br />
                    </div>



                    <div class="col-md-12 dvMessage" contenteditable="true" id="dv43">
                    </div>

                </div>

            </div>

            <div class="col-md-4" style="padding: 2px">
                <div class="col-md-12 btn btn-warning btn-round dvBox dvCotainerM1">


                    <div class="dvBasad" contenteditable="true">בס"ד חשוון התשע"ח</div>
                    <div class="dvPageTitle">
                        הודעות
                     <div class="btn btn-success btn-round mennageButton dvMainbuttons" onclick="AddRemoveFont(7)">
                         הוסף הודעה
                     </div>


                        <div class="btn btn-primary btn-round dvMainbuttons"
                            onclick="SaveData()">
                            שמור לוח
                        </div>

                    </div>



                    <div class="col-md-6 dvAlertRight" style="padding: 1px; margin: 0px">
                        <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage1" contenteditable="true">
                            גכגכגכגכ  אבות ובנים
                    

                        </div>
                        <div class="col-md-12"></div>
                        <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage2" contenteditable="true">
                            אבות ובנים
                    <br />

                            אבות ובנים באים יחד
                         אבות ובנים
                    <br />

                            sdsdsd sdsdsd גדגדגדגדגדג אבות ובנים באים יחד
                         אבות ובנים
                    <br />

                            אבות ובנים באים יחד

                        </div>

                    </div>
                    <div class="col-md-6 dvAlertLeft" style="padding: 1px; margin: 0px">
                        <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvMessage3">
                            אבות ובנים
                    <br />

                            אבות ובנים באים יחד
                       <br />

                            אבות ובנים באים יחד
                         <br />

                            אבות ובנים באים יחד


                        </div>
                    </div>




                </div>
                <div class="col-md-12 btn btn-warning btn-round dvBox dvCotainerM2" style="margin-top: 6px">

                    <div class="col-md-12 btn btn-default btn-round dvAlertMessage" id="dvLargeImage" contenteditable="true">
                        אבות ובנים
                    <br />

                        אבות ובנים באים יחד
                       <br />

                        אבות ובנים באים יחד
                         <br />

                        אבות ובנים באים יחד


                    </div>

                </div>
            </div>

            <div class="col-md-4" style="padding: 2px">

                <div class="col-md-12 btn btn-info btn-round dvBox dvCotainer">

                    <div class="dvBasad" id="dvBasad" contenteditable="true">בס"ד חשוון התשע"ח</div>

                    <div class="imgStyle">
                        <img src="../assets/images/shabat.png" width="130px" />
                    </div>
                    <div class="dvPageTitle" id="dv60" contenteditable="true">שבת "אחרי מות קדושים"</div>
                    <div class="col-md-12 dvSubTitle" id="dv61" contenteditable="true">ערב שבת</div>


                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv62">מנחה קטנה:</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv63">13:15</span></div>
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv64">מנחה: </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv65">16:30</span></div>
                    </div>


                    <div class="col-md-12"><span class="spComment" id="dv66" contenteditable="true">דברי תורה \ אורי דמרי</span></div>

                    <div class="col-md-12 dvSubTitle" contenteditable="true" id="dv67">יום שבת</div>



                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv68">נץ (פתיחה): </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv69">13:15</span></div>
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv70">נץ(הודו):</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv71">16:30</span></div>
                    </div>



                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv72">שחרית: </div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv73">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv74">שיעור תרי"ג מצוות \ יהודה עמר</span></div>
                    </div>


                    <div class="col-md-12">------------------------------------------</div>

                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv75">מנחה א':</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv76">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv77"></span></div>
                    </div>
                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv78">מנחה ב':</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv79">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv80"></span></div>
                    </div>


                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-6 dvZmanim" contenteditable="true" id="dv81">שיעור ילדים:</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv82">13:15</span></div>
                        <div class="col-md-4 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv83">יהודה</span></div>
                    </div>

                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-6 dvZmanim" contenteditable="true" id="dv84">תהילים ילדים:</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv85">13:15</span></div>
                        <div class="col-md-4 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv86">יהודה חורב</span></div>
                    </div>

                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv87">מנחה ג':</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv88">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv89"></span></div>
                    </div>

                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-6 dvZmanim" contenteditable="true" id="dv90">תהילים ילדים:</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv91">13:15</span></div>
                        <div class="col-md-4 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv92">יהודה חורב</span></div>
                    </div>



                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv93">מנחה ד':</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv94">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv95"></span></div>
                    </div>


                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-6 dvZmanim" contenteditable="true" id="dv96">שיעור:</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv97">13:15</span></div>

                    </div>
                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-2 dvMessage"><u><b>נושא:</b></u></div>
                        <div style="text-align: center" class="col-md-10 dvMessage" contenteditable="true" id="dv98">
                            ברכת המזון עד מתי לברך?
                    <br />
                            מיקום הברכה...
                        </div>

                    </div>

                    <div class="col-md-12" style="padding: 0px">
                        <div class="col-md-4 dvZmanim" contenteditable="true" id="dv99">ערבית:</div>
                        <div class="col-md-2 dvZmanimSP"><span class="badge dvbadageTzahi" contenteditable="true" id="dv100">13:15</span></div>
                        <div class="col-md-6 dvAlighnRight"><span class="spComment" contenteditable="true" id="dv101">ברכת הלבנה!</span></div>
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
