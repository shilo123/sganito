import { useEffect, useState } from 'react';
import { ajax } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../lib/toast';
import PageLoader from '../../lib/PageLoader';

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
  const toast = useToast();

  const [maxHourInShibutz, setMaxHourInShibutz] = useState<string>('');
  const [minForPitzul, setMinForPitzul] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      toast.warning('יש להזין ערכים מספריים בלבד', { title: 'קלט לא תקין' });
      return;
    }
    setSaving(true);
    try {
      await ajax('Assign_SetConfiguration', {
        MaxHourInShibutz: maxHourInShibutz,
        MinForPitzul: minForPitzul,
      });
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (e) {
      console.error('Assign_SetConfiguration failed', e);
      toast.error('אירעה שגיאה בשמירת ההגדרות');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ direction: 'rtl' }}>
      {loading && <PageLoader title="טוען הגדרות" subtitle="מאחזר את הגדרות השיבוץ האוטומטי..." />}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
