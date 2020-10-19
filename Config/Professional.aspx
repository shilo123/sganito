<%@ Page Title="" Language="C#" MasterPageFile="~/MasterPage/MasterPage.master" AutoEventWireup="true"
    CodeFile="Professional.aspx.cs" Inherits="Config_Professional" %>

<asp:Content ID="Content1" ContentPlaceHolderID="head" runat="Server">
    <!--bootstrap validation Library Script End-->
    <!--Demo form validation  Script Start-->
    <script type="text/javascript">

        var mydata;




        $(document).ready(function () {

            //InitFormValidation("fmrReqDetails");
            //GetComboItems("Codes", "TableId=5", "#ddlArea", "ValueCode", "ValueDesc");
            //GetComboItems("Codes", "TableId=7", "#ddlShift", "ValueCode", "ValueDesc");
            //GetComboItems("Codes", "TableId=1", "#ddlDayCode", "ValueCode", "ValueDesc");
            //InitDateTimePickerPlugin('#txtStartDate,#txtEndDate', getDateTimeNowFormat(), 0);
            //FillData();

            //$("#ddlArea").change(function () {
            //    FillData();
            //});
            FillData();
        });

        function FillData() {

            $("#dvReqContainer").html("");

            mydata = Ajax("Professional_DML", "Type=0&ProfessionalId=&Name=&isTwoHour=");


            //var Area = "";
            var ReqHtml = "";
            for (var i = 0; i < mydata.length; i++) {

                ReqHtml = $("#dvReqTemplate").html();

                ReqHtml = ReqHtml.replace(/@Name/g, mydata[i].Name);
                ReqHtml = ReqHtml.replace(/@ProfessionalId/g, mydata[i].ProfessionalId);
                ReqHtml = ReqHtml.replace(/@IsTwoHour/g, mydata[i].IsTwo);

                $("#dvReqContainer").append(ReqHtml);


            }


        }

        var SelectedProfessionalId = "";
        function EditRequirement(ProfessionalId, Name, IsTwoHour) {
            SelectedProfessionalId = ProfessionalId;

            if (!ProfessionalId) {

                $("#spReqDesc").text("מקצוע חדש");
            } else { $("#spReqDesc").text(Name); }


           
            if (IsTwoHour=='כן') {
                $('#isTwo').prop('checked',true);

            } else {
                $('#isTwo').prop('checked', false);
            }

            $("#txtName").val(Name);

            $("#ModalEdit").modal();
        }

        function SaveDataTODB() {


            var Name = $("#txtName").val();

            if (!Name) {

                bootbox.alert("שם מקצוע שדה חובה!!");
                return;
            }

            var isTwoHour = 0;

            if ($('#isTwo').prop('checked')) {
                isTwoHour = 1;

            }

           
            Ajax("Professional_DML", "Type=1&ProfessionalId=" + SelectedProfessionalId + "&Name=" + Name + "&isTwoHour=" + isTwoHour);

            $("#ModalEdit").modal('hide');
            FillData();



        }

        function DeleteRequirement(ProfessionalId) {

            bootbox.confirm("האם אתה בטוח שברצונך למחוק את המקצוע?", function (result) {
                if (result) {
                    Ajax("Professional_DML", "Type=2&ProfessionalId=" + ProfessionalId + "&Name=&isTwoHour=");

                    FillData();
                }

            });


        }

    </script>
</asp:Content>
<asp:Content ID="Content2" ContentPlaceHolderID="ContentPlaceHolder1" runat="Server">

    <div class="col-md-12">
        <div class="row">
            <div class="panel panel-info" style="margin: 2px">
                <div class="panel-heading">
                    <h3 class="panel-title">
                        <i class="glyphicon glyphicon-th-list"></i>רשימת מקצועות
                        
                    </h3>
                </div>
                <div class="panel-body" style="padding: 0px">
                    <br />
                    <div>
                        <div class="col-md-3 dvRequireTitle">
                            תאור מקצוע
                        </div>
                        <div class="col-md-2 dvRequireTitle">
                            האם שעתיים ברצף
                        </div>

                        <div class="col-md-7 dvRequireTitle">
                            &nbsp;
                        </div>
                        <div id="dvReqContainer" class="clear" style="height: 450px; overflow: auto">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="col-md-12">
        <div class="row" style="padding: 4px">
            <div class="btn btn-primary" onclick='EditRequirement("", "","", "")'>
                <i class="fa fa-plus-circle"></i>&nbsp;הוסף מקצוע חדש
            </div>
        </div>
    </div>
    <%-- טמפלט של עובד --%>
    <div id="dvReqTemplate" style="display: none">
        <div class="col-md-3 dvRequireDetails" style="height:40px">
            @Name
        </div>
        <div class="col-md-2 dvRequireDetails" style="height:40px">
            @IsTwoHour
        </div>

        <div class="col-md-7 dvRequireDetails" style="height:40px">
            <div class="btn btn-primary " onclick='EditRequirement("@ProfessionalId", "@Name", "@IsTwoHour")'>
                ערוך
            </div>


            <div class="btn btn-danger " onclick='DeleteRequirement("@ProfessionalId")'>
                מחק
            </div>
        </div>




    </div>


    <div class="modal fade" id="ModalEdit" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
        aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header label-info">
                    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">
                        &times;</button>
                    <h4 class="modal-title">
                        <span id="spReqDesc"></span>
                    </h4>
                </div>
                <div class="modal-body" id="Div8">
                    <form id="fmrReqDetails" method="post" action="">
                        <div class="col-md-3">
                            <span class="help-block m-b-none">שם מקצוע:</span>
                        </div>
                        <div class="col-md-9">
                            <input type="text" id="txtName" name="txtName" class="form-control text-input">
                        </div>
                        <div class="clear">
                            &nbsp;
                        </div>
                        <div class="col-md-3">
                            <span class="help-block m-b-none">האם שעתיים ברצף:</span>
                        </div>
                        <div class="col-md-1">

                            <input type="checkbox" style="float: right" id="isTwo" name="isTwo" class="form-control  text-input">
                        </div>
                        <div class="clear">
                            &nbsp;
                        </div>

                        <div class="col-md-12" style="text-align: left">
                            <div class="btn btn-info btn-round" onclick="SaveDataTODB()">
                                <i class="glyphicon glyphicon-edit"></i>&nbsp; <span>שמור</span>
                            </div>
                        </div>

                    </form>
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

</asp:Content>
