import { useCallback, useEffect, useState } from 'react';
import { ajax } from '../../api/client';

// Rows returned by Professional_DML (Type=0) / Gen_GetTable("Professional",...)
// IsTwo is returned by the SP as a Hebrew string "כן" / "לא"
interface ProfessionalRow {
  ProfessionalId: number;
  Name: string;
  IsTwo: string;
}

export default function Professional() {
  const [rows, setRows] = useState<ProfessionalRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [isTwo, setIsTwo] = useState(false);
  const [modalTitle, setModalTitle] = useState('');

  const fillData = useCallback(async () => {
    try {
      const data = await ajax<ProfessionalRow[]>('Professional_DML', {
        Type: 0,
        ProfessionalId: '',
        Name: '',
        isTwoHour: '',
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Professional_DML load failed', err);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    fillData();
  }, [fillData]);

  function openEdit(row?: ProfessionalRow) {
    if (row) {
      setSelectedId(row.ProfessionalId);
      setName(row.Name);
      setIsTwo(row.IsTwo === 'כן');
      setModalTitle(row.Name);
    } else {
      setSelectedId('');
      setName('');
      setIsTwo(false);
      setModalTitle('מקצוע חדש');
    }
    setShowModal(true);
  }

  async function saveData() {
    if (!name) {
      alert('שם מקצוע שדה חובה!!');
      return;
    }
    try {
      await ajax('Professional_DML', {
        Type: 1, // insert/update
        ProfessionalId: selectedId === '' ? '' : selectedId,
        Name: name,
        isTwoHour: isTwo ? 1 : 0,
      });
      setShowModal(false);
      fillData();
    } catch (err) {
      console.error('Professional_DML save failed', err);
      alert('שגיאה בשמירה');
    }
  }

  async function deleteRow(id: number) {
    if (!confirm('האם אתה בטוח שברצונך למחוק את המקצוע?')) return;
    try {
      await ajax('Professional_DML', {
        Type: 2, // delete
        ProfessionalId: id,
        Name: '',
        isTwoHour: '',
      });
      fillData();
    } catch (err) {
      console.error('Professional_DML delete failed', err);
      alert('שגיאה במחיקה');
    }
  }

  return (
    <>
      <div className="col-md-12">
        <div className="row">
          <div className="panel panel-info" style={{ margin: 2 }}>
            <div className="panel-heading">
              <h3 className="panel-title">
                <i className="glyphicon glyphicon-th-list"></i>רשימת מקצועות
              </h3>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <br />
              <div>
                <div className="col-md-3 dvRequireTitle">תאור מקצוע</div>
                <div className="col-md-2 dvRequireTitle">האם שעתיים ברצף</div>
                <div className="col-md-7 dvRequireTitle">&nbsp;</div>
                <div className="clear" style={{ height: 450, overflow: 'auto' }}>
                  {rows.map((row) => (
                    <div key={row.ProfessionalId}>
                      <div className="col-md-3 dvRequireDetails" style={{ height: 40 }}>
                        {row.Name}
                      </div>
                      <div className="col-md-2 dvRequireDetails" style={{ height: 40 }}>
                        {row.IsTwo}
                      </div>
                      <div className="col-md-7 dvRequireDetails" style={{ height: 40 }}>
                        <div className="btn btn-primary" onClick={() => openEdit(row)}>
                          ערוך
                        </div>
                        <div
                          className="btn btn-danger"
                          onClick={() => deleteRow(row.ProfessionalId)}
                          style={{ marginRight: 4 }}
                        >
                          מחק
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-12">
        <div className="row" style={{ padding: 4 }}>
          <div className="btn btn-primary" onClick={() => openEdit()}>
            <i className="fa fa-plus-circle"></i>&nbsp;הוסף מקצוע חדש
          </div>
        </div>
      </div>

      {showModal && (
        <div
          className="modal fade in"
          role="dialog"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header label-info">
                <button
                  type="button"
                  className="close"
                  aria-hidden="true"
                  onClick={() => setShowModal(false)}
                >
                  &times;
                </button>
                <h4 className="modal-title">
                  <span>{modalTitle}</span>
                </h4>
              </div>
              <div className="modal-body">
                <div className="col-md-3">
                  <span className="help-block m-b-none">שם מקצוע:</span>
                </div>
                <div className="col-md-9">
                  <input
                    type="text"
                    className="form-control text-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="clear">&nbsp;</div>
                <div className="col-md-3">
                  <span className="help-block m-b-none">האם שעתיים ברצף:</span>
                </div>
                <div className="col-md-1">
                  <input
                    type="checkbox"
                    className="form-control text-input"
                    style={{ float: 'right' }}
                    checked={isTwo}
                    onChange={(e) => setIsTwo(e.target.checked)}
                  />
                </div>
                <div className="clear">&nbsp;</div>
                <div className="col-md-12" style={{ textAlign: 'left' }}>
                  <div className="btn btn-info btn-round" onClick={saveData}>
                    <i className="glyphicon glyphicon-edit"></i>&nbsp; <span>שמור</span>
                  </div>
                </div>
                <div className="clear">&nbsp;</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-info btn-xs" onClick={() => setShowModal(false)}>
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
