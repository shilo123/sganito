import { useCallback, useEffect, useMemo, useState } from 'react';
import { ajax } from '../../api/client';
import { useToast } from '../../lib/toast';
import PageLoader from '../../lib/PageLoader';

// Rows returned by Professional_DML (Type=0) / Gen_GetTable("Professional",...)
// IsTwo is returned by the SP as a Hebrew string "כן" / "לא"
interface ProfessionalRow {
  ProfessionalId: number;
  Name: string;
  IsTwo: string;
}

export default function Professional() {
  const toast = useToast();
  const [rows, setRows] = useState<ProfessionalRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'new' | 'edit'>('new');
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [isTwo, setIsTwo] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

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
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fillData();
  }, [fillData]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.Name ?? '').toLowerCase().includes(q));
  }, [rows, search]);

  function openEdit(row?: ProfessionalRow) {
    if (row) {
      setModalMode('edit');
      setSelectedId(row.ProfessionalId);
      setName(row.Name);
      setIsTwo(row.IsTwo === 'כן');
    } else {
      setModalMode('new');
      setSelectedId('');
      setName('');
      setIsTwo(false);
    }
    setShowModal(true);
  }

  async function saveData() {
    if (!name.trim()) {
      toast.warning('שם המקצוע הוא שדה חובה', { title: 'חסר שדה' });
      return;
    }
    try {
      await ajax('Professional_DML', {
        Type: 1, // insert/update
        ProfessionalId: selectedId === '' ? '' : selectedId,
        Name: name.trim(),
        isTwoHour: isTwo ? 1 : 0,
      });
      setShowModal(false);
      fillData();
    } catch (err) {
      console.error('Professional_DML save failed', err);
      toast.error('שגיאה בשמירת המקצוע');
    }
  }

  function requestDelete(id: number, rowName: string) {
    setConfirmDelete({ id, name: rowName });
  }
  async function confirmDeleteRow() {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
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
      toast.error('שגיאה במחיקת המקצוע');
    }
  }

  return (
    <div className="pro-page">
      {initialLoading && <PageLoader title="טוען מקצועות" subtitle="מאחזר את רשימת המקצועות..." />}

      <div className="pro-card">
        <header className="pro-card__header">
          <div className="pro-card__title-cluster">
            <span className="pro-card__title-icon" aria-hidden="true">
              <i className="fa fa-book" />
            </span>
            <h2 className="pro-card__title">רשימת מקצועות</h2>
            <span className="pro-card__count" aria-label={`${filteredRows.length} מקצועות`}>
              {filteredRows.length}
            </span>
          </div>
          <div className="pro-card__actions">
            <label
              className={`pro-search${search ? ' is-filled' : ''}`}
              aria-label="חיפוש מקצוע"
            >
              <i className="fa fa-search pro-search__icon" aria-hidden="true" />
              <input
                type="search"
                className="pro-search__input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש מקצוע..."
              />
              {search && (
                <button
                  type="button"
                  className="pro-search__clear"
                  aria-label="נקה חיפוש"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSearch('')}
                >
                  <i className="fa fa-times" />
                </button>
              )}
            </label>
            <button
              type="button"
              className="pro-card__add"
              onClick={() => openEdit()}
              title="הוספת מקצוע חדש"
            >
              <i className="fa fa-plus" />
              <span>מקצוע חדש</span>
            </button>
          </div>
        </header>

        <div className="pro-table" role="table" aria-label="מקצועות">
          <div className="pro-table__head" role="row">
            <div role="columnheader">שם המקצוע</div>
            <div role="columnheader">שעתיים ברצף</div>
            <div role="columnheader" aria-label="פעולות" />
          </div>

          <div className="pro-table__body">
            {filteredRows.length === 0 && !initialLoading && (
              <div className="pro-empty">
                <i className="fa fa-inbox pro-empty__icon" />
                <div className="pro-empty__title">
                  {search ? 'לא נמצאו מקצועות' : 'אין מקצועות עדיין'}
                </div>
                <div className="pro-empty__hint">
                  {search ? 'נסה חיפוש אחר' : 'לחץ על "מקצוע חדש" כדי להוסיף את הראשון'}
                </div>
              </div>
            )}

            {filteredRows.map((row) => {
              const isYes = row.IsTwo === 'כן';
              return (
                <div
                  key={row.ProfessionalId}
                  className="pro-row"
                  role="row"
                  onDoubleClick={() => openEdit(row)}
                >
                  <div className="pro-row__name" role="cell">{row.Name}</div>
                  <div className="pro-row__badge" role="cell">
                    {isYes ? (
                      <span className="pro-badge pro-badge--yes">
                        <i className="fa fa-check" /> כן
                      </span>
                    ) : (
                      <span className="pro-badge pro-badge--no">לא</span>
                    )}
                  </div>
                  <div className="pro-row__actions" role="cell">
                    <button
                      type="button"
                      className="pro-icon-btn pro-icon-btn--edit"
                      onClick={() => openEdit(row)}
                      title="עריכה"
                      aria-label={`עריכת ${row.Name}`}
                    >
                      <i className="fa fa-pencil" />
                    </button>
                    <button
                      type="button"
                      className="pro-icon-btn pro-icon-btn--delete"
                      onClick={() => requestDelete(row.ProfessionalId, row.Name)}
                      title="מחיקה"
                      aria-label={`מחיקת ${row.Name}`}
                    >
                      <i className="fa fa-trash" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showModal && (
        <div
          className="tm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pro-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="tm-modal__card" style={{ maxWidth: 480 }}>
            <header className="tm-modal__header">
              <div className="tm-modal__header-side">
                <span className="tm-modal__avatar" aria-hidden="true">
                  <i className={`fa ${modalMode === 'new' ? 'fa-plus' : 'fa-pencil'}`} />
                </span>
                <div>
                  <h2 id="pro-modal-title" className="tm-modal__title">
                    {modalMode === 'new' ? 'מקצוע חדש' : 'עריכת מקצוע'}
                  </h2>
                  {modalMode === 'edit' && name && (
                    <div className="tm-modal__subtitle">{name}</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="tm-modal__close"
                onClick={() => setShowModal(false)}
                aria-label="סגור"
              >
                <i className="fa fa-times" />
              </button>
            </header>

            <div className="tm-modal__body">
              <section className="tm-section">
                <div className="tm-grid tm-grid--2" style={{ gridTemplateColumns: '1fr' }}>
                  <label className="tm-field">
                    <span className="tm-field__label">
                      שם המקצוע <span className="tm-field__required">*</span>
                    </span>
                    <input
                      type="text"
                      className="tm-field__input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="לדוגמה: מתמטיקה"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveData();
                      }}
                    />
                  </label>
                </div>
              </section>

              <section className="tm-section">
                <label className="pro-toggle">
                  <input
                    type="checkbox"
                    checked={isTwo}
                    onChange={(e) => setIsTwo(e.target.checked)}
                    className="pro-toggle__input"
                  />
                  <span className="pro-toggle__track">
                    <span className="pro-toggle__thumb" />
                  </span>
                  <span className="pro-toggle__label">
                    <span className="pro-toggle__title">שעתיים ברצף</span>
                    <span className="pro-toggle__hint">
                      המקצוע מועבר תמיד בשתי שעות צמודות
                    </span>
                  </span>
                </label>
              </section>
            </div>

            <footer className="tm-modal__footer">
              <div className="tm-modal__footer-primary">
                <button
                  type="button"
                  className="tm-btn tm-btn--primary"
                  onClick={saveData}
                >
                  <i className={`fa ${modalMode === 'new' ? 'fa-plus' : 'fa-check'}`} />
                  {modalMode === 'new' ? 'צור מקצוע' : 'שמור שינויים'}
                </button>
                <button
                  type="button"
                  className="tm-btn tm-btn--ghost"
                  onClick={() => setShowModal(false)}
                >
                  ביטול
                </button>
              </div>
              <div className="tm-modal__footer-secondary" />
            </footer>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmDeleteProfTitle"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(null);
          }}
        >
          <div className="confirm-modal__card">
            <div className="confirm-modal__icon">
              <i className="fa fa-exclamation-triangle" />
            </div>
            <h3 className="confirm-modal__title" id="confirmDeleteProfTitle">
              מחיקת מקצוע
            </h3>
            <p className="confirm-modal__text">
              האם אתה בטוח שברצונך למחוק את המקצוע{' '}
              <strong>{confirmDelete.name}</strong>?
              <br />
              פעולה זו אינה ניתנת לביטול.
            </p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="btn btn-default"
                onClick={() => setConfirmDelete(null)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDeleteRow}
                autoFocus
              >
                <i className="fa fa-trash" /> מחק לצמיתות
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
