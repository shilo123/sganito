<%@ page title="" language="C#" masterpagefile="~/MasterPage/MasterPage.master" autoeventwireup="true" inherits="Config_SchoolHours, App_Web_scaj0hwx" %>

<asp:Content ID="Content1" ContentPlaceHolderID="head" runat="Server">
  
    <script type="text/javascript">

        var mydata;
        var appendHTML = "<span class='spPartani' style='float:left;font-weight:bold'>פ</span>";

        $(document).ready(function () {

          
            mydata = Ajax("Gen_GetTable", "TableName=SchoolHours&Condition=ConfigurationId=" + ConfigurationId);
          //  alert(mydata.length)
          
            InitSelectableNGN(mydata, "HourId");


            for (var i = 0; i < mydata.length; i++) {

                var HourId = mydata[i].HourId;
                var IsOnlyShehya = mydata[i].IsOnlyShehya;

                if (IsOnlyShehya == "1") {
                    $("#" + HourId).append(appendHTML);
                   
                }


            }

            DefineRightClickEVENT();

        });


        function SaveData() {

        //    Ajax("School_UpdateConfigHours", "Hours=" + arr);
         //   bootbox.alert("המידע נשמר בהצלחה");

        }

     

        function CallBackAdd(ObjId) {

            Ajax("School_UpdateHour", "HourId=" + ObjId + "&Mode=3");
          
            return true;

        }





        function CallBackRemove(ObjId) {

           

            Ajax("School_UpdateHour", "HourId=" + ObjId + "&Mode=4");
            $("#" + ObjId + ' .spPartani').remove();
            

            return true;

        }

        function DefineRightClickEVENT() {

            $(".dvForRIGHT div").contextMenu({
                menuSelector: "#contextMenuAbsence",
                menuSelected: function (invokedOn, selectedMenu) {

                    //e.cancelBubble = true;
                    var Obj = invokedOn[0];

                    //  alert($(Obj).attr("id"));

                    var SchoolHourId = $(Obj).attr("id");

                    var MenuId = selectedMenu[0].id;

                    switch (MenuId) {
                        case "li1":
                            Ajax("School_UpdateHour", "HourId=" + SchoolHourId + "&Mode=1");
                            $("#" + SchoolHourId).append(appendHTML);
                            $("#" + SchoolHourId).css("background-color", "#B8C0DC");
                            break;
                        case "li2":
                            Ajax("School_UpdateHour", "HourId=" + SchoolHourId + "&Mode=2");
                            $("#" + SchoolHourId + ' .spPartani').remove();
                           // OpenShyaPartani(Obj, 2);
                            break;

                        default:
                            break;


                    }

                }
            });

        }



    </script>
</asp:Content>
<asp:content id="Content2" contentplaceholderid="ContentPlaceHolder1" runat="Server">
    <div class="col-md-12">
        <div class="row dvWeek">
            <div class="panel panel-info">
                <div class="panel-heading">
                    <h3 class="panel-title">
                        &nbsp; מצבת שעות בית ספר
                    </h3>
                </div>
                <div class="panel-body">
                    <div class="col-md-10">
                        <h5 style="font-style:italic">
                             בחר שעות ע"י לחיצה וגרירה , לביטול לחץ וגרור שוב.</h5>
                    </div>
                    <div class="col-md-2" style="text-align: left">
                        <div class="btn btn-info btn-round" style="margin: 1px;">
                            סה"כ שעות בית ספר <span class="badge" id="spTotals">0</span>
                        </div>
                    </div>
                    <div class="dvDaysCotainer">
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">
                                        &nbsp; יום ראשון
                                    </h3>
                                </div>
                                <div class="panel-body dvForRIGHT">
                                    <div id="11">
                                        <span class="spSeqNumber">1.</span>08:00 - 09:00
                                      
                                    </div>
                                    <div id="12">
                                        <span class="spSeqNumber">2.</span> 09:00 - 09:40
                                    </div>
                                    <div id="13">
                                        <span class="spSeqNumber">3.</span> 10:05 - 10:55
                                    </div>
                                    <div id="14">
                                        <span class="spSeqNumber">4.</span> 10:56 - 11:40
                                    </div>
                                    <div id="15">
                                        <span class="spSeqNumber">5.</span> 12:00 - 12:45
                                    </div>
                                    <div id="16">
                                        <span class="spSeqNumber">6.</span> 12:46 - 13:30
                                    </div>
                                    <div id="17">
                                        <span class="spSeqNumber">7.</span> 13:45 - 14:30
                                    </div>
                                    <div id="18">
                                        <span class="spSeqNumber">8.</span> 14:31 - 15:15
                                    </div>
                                    <div id="19">
                                        <span class="spSeqNumber">9.</span> 15:16 - 16:00
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">
                                        &nbsp; יום שני
                                    </h3>
                                </div>
                                <div class="panel-body dvForRIGHT" >
                                    <div id="21">
                                        <span class="spSeqNumber">1.</span>08:00 - 09:00
                                    </div>
                                    <div id="22">
                                        <span class="spSeqNumber">2.</span> 09:00 - 09:40
                                    </div>
                                    <div id="23">
                                        <span class="spSeqNumber">3.</span> 10:05 - 10:55
                                    </div>
                                    <div id="24">
                                        <span class="spSeqNumber">4.</span> 10:56 - 11:40
                                    </div>
                                    <div id="25">
                                        <span class="spSeqNumber">5.</span> 12:00 - 12:45
                                    </div>
                                    <div id="26">
                                        <span class="spSeqNumber">6.</span> 12:46 - 13:30
                                    </div>
                                    <div id="27">
                                        <span class="spSeqNumber">7.</span> 13:45 - 14:30
                                    </div>
                                    <div id="28">
                                        <span class="spSeqNumber">8.</span> 14:31 - 15:15
                                    </div>
                                    <div id="29">
                                        <span class="spSeqNumber">9.</span> 15:16 - 16:00
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">
                                        &nbsp; יום שלישי
                                    </h3>
                                </div>
                                <div class="panel-body dvForRIGHT">
                                    <div id="31">
                                        <span class="spSeqNumber">1.</span>08:00 - 09:00
                                    </div>
                                    <div id="32">
                                        <span class="spSeqNumber">2.</span> 09:00 - 09:40
                                    </div>
                                    <div id="33">
                                        <span class="spSeqNumber">3.</span> 10:05 - 10:55
                                    </div>
                                    <div id="34">
                                        <span class="spSeqNumber">4.</span> 10:56 - 11:40
                                    </div>
                                    <div id="35">
                                        <span class="spSeqNumber">5.</span> 12:00 - 12:45
                                    </div>
                                    <div id="36">
                                        <span class="spSeqNumber">6.</span> 12:46 - 13:30
                                    </div>
                                    <div id="37">
                                        <span class="spSeqNumber">7.</span> 13:45 - 14:30
                                    </div>
                                    <div id="38">
                                        <span class="spSeqNumber">8.</span> 14:31 - 15:15
                                    </div>
                                    <div id="39">
                                        <span class="spSeqNumber">9.</span> 15:16 - 16:00
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">
                                        &nbsp; יום רביעי
                                    </h3>
                                </div>
                                <div class="panel-body dvForRIGHT">
                                    <div id="41">
                                        <span class="spSeqNumber">1.</span>08:00 - 09:00
                                    </div>
                                    <div id="42">
                                        <span class="spSeqNumber">2.</span> 09:00 - 09:40
                                    </div>
                                    <div id="43">
                                        <span class="spSeqNumber">3.</span> 10:05 - 10:55
                                    </div>
                                    <div id="44">
                                        <span class="spSeqNumber">4.</span> 10:56 - 11:40
                                    </div>
                                    <div id="45">
                                        <span class="spSeqNumber">5.</span> 12:00 - 12:45
                                    </div>
                                    <div id="46">
                                        <span class="spSeqNumber">6.</span> 12:46 - 13:30
                                    </div>
                                    <div id="47">
                                        <span class="spSeqNumber">7.</span> 13:45 - 14:30
                                    </div>
                                    <div id="48">
                                        <span class="spSeqNumber">8.</span> 14:31 - 15:15
                                    </div>
                                    <div id="49">
                                        <span class="spSeqNumber">9.</span> 15:16 - 16:00
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">
                                        &nbsp; יום חמישי
                                    </h3>
                                </div>
                                <div class="panel-body dvForRIGHT">
                                    <div id="51">
                                        <span class="spSeqNumber">1.</span>08:00 - 09:00
                                    </div>
                                    <div id="52">
                                        <span class="spSeqNumber">2.</span> 09:00 - 09:40
                                    </div>
                                    <div id="53">
                                        <span class="spSeqNumber">3.</span> 10:05 - 10:55
                                    </div>
                                    <div id="54">
                                        <span class="spSeqNumber">4.</span> 10:56 - 11:40
                                    </div>
                                    <div id="55">
                                        <span class="spSeqNumber">5.</span> 12:00 - 12:45
                                    </div>
                                    <div id="56">
                                        <span class="spSeqNumber">6.</span> 12:46 - 13:30
                                    </div>
                                    <div id="57">
                                        <span class="spSeqNumber">7.</span> 13:45 - 14:30
                                    </div>
                                    <div id="58">
                                        <span class="spSeqNumber">8.</span> 14:31 - 15:15
                                    </div>
                                    <div id="59">
                                        <span class="spSeqNumber">9.</span> 15:16 - 16:00
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-2">
                            <div class="panel panel-info">
                                <div class="panel-heading">
                                    <h3 class="panel-title">
                                        &nbsp; יום שישי
                                    </h3>
                                </div>
                                <div class="panel-body dvForRIGHT">
                                    <div id="61">
                                        <span class="spSeqNumber">1.</span>08:00 - 09:00
                                    </div>
                                    <div id="62">
                                        <span class="spSeqNumber">2.</span> 09:00 - 09:40
                                    </div>
                                    <div id="63">
                                        <span class="spSeqNumber">3.</span> 10:05 - 10:55
                                    </div>
                                    <div id="64">
                                        <span class="spSeqNumber">4.</span> 10:56 - 11:40
                                    </div>
                                    <div id="65">
                                        <span class="spSeqNumber">5.</span> 12:00 - 12:45
                                    </div>
                                    <div id="66">
                                        <span class="spSeqNumber">6.</span> 12:46 - 13:30
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="clear">
                            &nbsp;</div>
                    </div>
                    <div class="col-md-10">
                    </div>
                 <%--   <div class="col-md-2" style="text-align: left">
                        <div class="btn btn-info btn-round" onclick="SaveData()">
                            <i class="glyphicon glyphicon-edit"></i>&nbsp; <span>שמור שינויים</span>
                        </div>
                    </div>--%>
                </div>
            </div>
        </div>
    </div>


  <%--   <div class="col-md-12">
        <div class="row">
            <div class="panel panel-info">
                <div class="panel-heading">
                    <h3 class="panel-title">
                        &nbsp;הגדרת שעות פרונטלי 
                    </h3>
                </div>
                <div class="panel-body">
                 <div class="col-md-3">
                       
                        <div class="input-group ls-group-input">
                         <span class="input-group-addon spDateIcon"> שעות פרונטליות</span>
                            <input type="text" id="txtFrontali" class="form-control">
                           
                        </div>
                    </div>
                
                </div>
                 </div>
        </div>
    </div>--%>



    <ul id="contextMenuAbsence" class="dropdown-menu dropdown-menu-right" role="menu"
        style="display: none;">
        <li><a id="li1" tabindex="-1" href="#">שעה פרטנית\שהייה בלבד</a></li>
        <li><a id="li2" tabindex="-1" href="#">ביטול פרטנית\שהייה  </a></li>
        <li class="divider"></li>
        <li><a tabindex="-1" href="#">סגור</a></li>
    </ul>
</asp:content>
