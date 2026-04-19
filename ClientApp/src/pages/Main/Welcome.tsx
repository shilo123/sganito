import { useAuth } from '../../auth/AuthContext';

export default function Welcome() {
  const { user } = useAuth();

  return (
    <div className="container" style={{ padding: 20 }} dir="rtl">
      <div className="panel panel-primary">
        <div className="panel-heading">
          <h3 className="panel-title">ברוכים הבאים למערכת סגנית</h3>
        </div>
        <div className="panel-body">
          {user ? (
            <>
              <h4>
                שלום, <strong>{user.UserName}</strong>
              </h4>
              <p style={{ fontSize: 16, marginTop: 15 }}>
                <i className="fa fa-graduation-cap" style={{ marginLeft: 8 }} />
                בית הספר: <strong>{user.Name}</strong>
              </p>
              <p style={{ fontSize: 16 }}>
                <i className="fa fa-calendar" style={{ marginLeft: 8 }} />
                תאריך עברי: <strong>{user.HebDate}</strong>
              </p>
              <hr />
              <p className="text-muted">
                נעים שחזרת! השתמש בתפריט כדי לנווט במערכת.
              </p>
            </>
          ) : (
            <p>טעינה...</p>
          )}
        </div>
      </div>
    </div>
  );
}
