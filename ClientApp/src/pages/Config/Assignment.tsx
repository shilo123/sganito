// Config/Assignment — placeholder.
// The original Assignment.aspx (~3166 lines, UTF-16) is a full work-shift
// presence/assignment UI that does not belong to the Config section of the
// React SPA. Auto-assignment configuration is handled under
// pages/Assign/AssignConfig.tsx. This route is kept only to preserve the
// existing router entry; it should eventually be removed or redirected.

export default function Assignment() {
  return (
    <div className="col-md-12" style={{ padding: 20 }}>
      <div className="panel panel-info">
        <div className="panel-heading">
          <h3 className="panel-title">הגדרות שיבוץ</h3>
        </div>
        <div className="panel-body">
          <p>
            לניהול שיבוץ אוטומטי נא לגשת למסך <b>שיבוץ אוטמטי</b> בתפריט הראשי.
          </p>
        </div>
      </div>
    </div>
  );
}
