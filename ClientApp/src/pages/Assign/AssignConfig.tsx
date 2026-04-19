import { useEffect, useState } from 'react';
import { ajax } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

// ---- Types ----

interface ConfigurationRow {
  ConfigurationId: string;
  MaxHourInShibutz: string;
  MinForPitzul: string;
  SchoolId?: string;
}

// ---- Component ----

export default function AssignConfig() {
  const { user } = useAuth();

  const [maxHourInShibutz, setMaxHourInShibutz] = useState<string>('');
  const [minForPitzul, setMinForPitzul] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const rows = await ajax<ConfigurationRow[]>('Gen_GetTable', {
          TableName: 'Configuration',
          Condition: 'ConfigurationId=' + user.ConfigurationId,
        });
        if (cancelled) return;
        if (Array.isArray(rows) && rows.length > 0) {
          setMaxHourInShibutz(rows[0].MaxHourInShibutz ?? '');
          setMinForPitzul(rows[0].MinForPitzul ?? '');
        }
      } catch (e) {
        console.error('Load Configuration failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSave() {
    if (isNaN(Number(minForPitzul)) || isNaN(Number(maxHourInShibutz))) {
      alert('לא ניתן לעדכן מספר');
      return;
    }
    setSaving(true);
    setSavedMessage(null);
    try {
      await ajax('Assign_SetConfiguration', {
        MaxHourInShibutz: maxHourInShibutz,
        MinForPitzul: minForPitzul,
      });
      setSavedMessage('המידע נשמר בהצלחה');
      setTimeout(() => setSavedMessage(null), 2500);
    } catch (e) {
      console.error('Assign_SetConfiguration failed', e);
      alert('אירעה שגיאה בשמירת ההגדרות');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 20, direction: 'rtl' }}>
        <p>טוען הגדרות...</p>
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl' }}>
      <div className="col-md-12">
        <div className="row dvWeek">
          <div className="panel panel-info">
            <div className="panel-heading">
              <h3 className="panel-title">&nbsp;הגדרת כלליות לשיבוץ אוטמטי</h3>
            </div>
            <div className="panel-body">
              <div className="col-md-3">
                <div className="input-group ls-group-input">
                  <span className="input-group-addon">מקסימום שעות למורה ביום</span>
                  <input
                    type="text"
                    id="txtRetzef"
                    className="form-control"
                    value={maxHourInShibutz}
                    onChange={(e) => setMaxHourInShibutz(e.target.value)}
                  />
                </div>
              </div>

              <div className="clearfix" />
              <div className="col-md-4">
                <div className="input-group ls-group-input">
                  <span className="input-group-addon">מינימום שעות לפיצול בימים</span>
                  <input
                    type="text"
                    id="txtMin"
                    className="form-control"
                    value={minForPitzul}
                    onChange={(e) => setMinForPitzul(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-md-4">
                <button
                  type="button"
                  className="btn btn-info btn-round"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <i className="glyphicon glyphicon-edit" />
                  &nbsp; <span>{saving ? 'שומר...' : 'שמור'}</span>
                </button>
                {savedMessage && (
                  <span style={{ marginRight: 10, color: 'green', fontWeight: 'bold' }}>
                    {savedMessage}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
