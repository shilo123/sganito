-- =====================================================================
-- הרחבת ההקבצות: 3 מורים לכל הקבצה במקום 1.
-- כל מורה מלמד את אותן השעות אבל קבוצת רמה שונה (קבוצה גבוהה/בינונית/נמוכה).
-- במונחי ClassTeacher: לכל מורה נוסף בהקבצה צריך שורה לכל אחת מהכיתות בהקבצה.
-- Hour זהה לקיים (4 אנגלית / 5 מתמטיקה) — כי הסכימה משתמשת ב-MAX(Hour) per Hakbatza.
--
-- שיוכים:
-- LAYER 5:
--   Hak 1 (אנגלית 5א-5ב): T214 + T196 גיא בכר + T242 דניאל אזרזר
--   Hak 2 (מתמטיקה 5א-5ב): T215 + T204 שולמית גרבר + T230 אמיר ועקנין
--   Hak 3 (אנגלית 5ג-5ד): T229 + T182 תמר פרץ + T211 חופית רוזנברג
--   Hak 4 (מתמטיקה 5ג-5ד): T223 + T210 סיוון בארי + T231 דקלה גיא
-- LAYER 6:
--   Hak 1 (אנגלית 6א-6ב): T233 + T235 ינון נהרי + T232 ענת שרי
--   Hak 2 (מתמטיקה 6א-6ב): T222 + T236 עפרה ביטון + T240 גליה אסולין
--   Hak 3 (אנגלית 6ג-6ד): T226 + T208 שמואל שרעבי + T206 סלים חכים
--   Hak 4 (מתמטיקה 6ג-6ד): T216 + T185 גלית נחמיאס + T228 יוכבד יבנון
-- =====================================================================
SET NOCOUNT ON;
DECLARE @cfg INT = 5;

PRINT '== Step 1: עדכון ProfessionalId למורים החדשים ==';
-- אנגלית (127)
UPDATE Teacher SET ProfessionalId = 127
WHERE ConfigurationId = @cfg AND TeacherId IN (196, 242, 182, 211, 235, 232, 208, 206);

-- מתמטיקה (125) — T240 כבר מתמטיקה מואצת, נשאיר
UPDATE Teacher SET ProfessionalId = 125
WHERE ConfigurationId = @cfg AND TeacherId IN (204, 230, 210, 231, 236, 185, 228);

PRINT '== Step 2: הוספת 2 מורים נוספים לכל הקבצה ==';

-- LAYER 5
-- Hak 1 (אנגלית 5א-5ב = 2167+2168, 4h): T196, T242
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2167, 196, 4, 1, NULL), (@cfg, 2168, 196, 4, 1, NULL),
       (@cfg, 2167, 242, 4, 1, NULL), (@cfg, 2168, 242, 4, 1, NULL);

-- Hak 2 (מתמטיקה 5א-5ב = 2167+2168, 5h): T204, T230
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2167, 204, 5, 2, NULL), (@cfg, 2168, 204, 5, 2, NULL),
       (@cfg, 2167, 230, 5, 2, NULL), (@cfg, 2168, 230, 5, 2, NULL);

-- Hak 3 (אנגלית 5ג-5ד = 2177+2178, 4h): T182, T211
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2177, 182, 4, 3, NULL), (@cfg, 2178, 182, 4, 3, NULL),
       (@cfg, 2177, 211, 4, 3, NULL), (@cfg, 2178, 211, 4, 3, NULL);

-- Hak 4 (מתמטיקה 5ג-5ד = 2177+2178, 5h): T210, T231
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2177, 210, 5, 4, NULL), (@cfg, 2178, 210, 5, 4, NULL),
       (@cfg, 2177, 231, 5, 4, NULL), (@cfg, 2178, 231, 5, 4, NULL);

-- LAYER 6
-- Hak 1 (אנגלית 6א-6ב = 2169+2170, 4h): T235, T232
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2169, 235, 4, 1, NULL), (@cfg, 2170, 235, 4, 1, NULL),
       (@cfg, 2169, 232, 4, 1, NULL), (@cfg, 2170, 232, 4, 1, NULL);

-- Hak 2 (מתמטיקה 6א-6ב = 2169+2170, 5h): T236, T240
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2169, 236, 5, 2, NULL), (@cfg, 2170, 236, 5, 2, NULL),
       (@cfg, 2169, 240, 5, 2, NULL), (@cfg, 2170, 240, 5, 2, NULL);

-- Hak 3 (אנגלית 6ג-6ד = 2179+2180, 4h): T208, T206
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2179, 208, 4, 3, NULL), (@cfg, 2180, 208, 4, 3, NULL),
       (@cfg, 2179, 206, 4, 3, NULL), (@cfg, 2180, 206, 4, 3, NULL);

-- Hak 4 (מתמטיקה 6ג-6ד = 2179+2180, 5h): T185, T228
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2179, 185, 5, 4, NULL), (@cfg, 2180, 185, 5, 4, NULL),
       (@cfg, 2179, 228, 5, 4, NULL), (@cfg, 2180, 228, 5, 4, NULL);

PRINT '== Step 3: עדכון Frontaly למורים שחורגים אחרי ההוספה ==';
UPDATE t
SET Frontaly = realLoad.TotalReal
FROM Teacher t
INNER JOIN (
  SELECT t.TeacherId, t.Frontaly, (
    SELECT SUM(h.h) FROM (
      SELECT [Hour] AS h FROM ClassTeacher ct
      WHERE ct.TeacherId=t.TeacherId AND ct.ConfigurationId=t.ConfigurationId AND (ct.Hakbatza IS NULL OR ct.Hakbatza=0)
      UNION ALL
      SELECT MAX([Hour]) AS h FROM ClassTeacher ct
      WHERE ct.TeacherId=t.TeacherId AND ct.ConfigurationId=t.ConfigurationId AND ct.Hakbatza IS NOT NULL AND ct.Hakbatza>0
      GROUP BY ct.Hakbatza
    ) h) AS TotalReal
  FROM Teacher t WHERE t.ConfigurationId=@cfg
) realLoad ON realLoad.TeacherId = t.TeacherId
WHERE t.ConfigurationId=@cfg AND realLoad.TotalReal > t.Frontaly;

PRINT '== Step 4: סיכום ההקבצות ==';
SELECT
  c.LayerId,
  ct.Hakbatza,
  gi.Name AS HakName,
  p.Name AS Profession,
  COUNT(DISTINCT ct.ClassId) AS ClassCount,
  COUNT(DISTINCT ct.TeacherId) AS TeacherCount,
  MAX(ct.Hour) AS HourPerLesson,
  STRING_AGG(CONVERT(NVARCHAR(MAX), t.FirstName + N' ' + t.LastName), N' | ') WITHIN GROUP (ORDER BY t.TeacherId) AS Teachers
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
LEFT JOIN Teacher t ON t.TeacherId = ct.TeacherId AND t.ConfigurationId = @cfg
LEFT JOIN GroupInfo gi ON gi.ConfigurationId = @cfg AND gi.LayerId = c.LayerId AND gi.Number = ct.Hakbatza AND gi.Kind = 'H'
LEFT JOIN Professional p ON p.ProfessionalId = gi.ProfessionalId
WHERE ct.ConfigurationId = @cfg
  AND c.LayerId IN (5,6)
  AND ct.Hakbatza IS NOT NULL
GROUP BY c.LayerId, ct.Hakbatza, gi.Name, p.Name
ORDER BY c.LayerId, ct.Hakbatza;

PRINT '== Step 5: סיכום שעות לכל כיתה (חייב להישאר 40) ==';
SELECT c.ClassId, c.Name, dbo.GetClassCountHour(c.ClassId, @cfg) Hours
FROM Class c WHERE c.ConfigurationId=@cfg AND c.LayerId IN (5,6)
ORDER BY c.LayerId, c.Seq;
