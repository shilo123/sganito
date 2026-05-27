-- =====================================================================
-- תיקון: הקבצות נוצרו בטעות ב-ConfigurationId=1.
-- המשתמש המחובר ל-UI הוא ConfigurationId=5 (SchoolId=4, דמו).
-- אנקה את ההקבצות מ-cfg=1 ואיצור מחדש ב-cfg=5.
-- =====================================================================

SET NOCOUNT ON;

PRINT '== Step 1: נקה הקבצות שגויות ב-ConfigurationId=1 ==';
DELETE ct
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId = 1
  AND c.LayerId IN (5,6)
  AND ct.Hakbatza IS NOT NULL AND ct.Hakbatza > 0
  AND ct.ClassTeacherId >= 3215; -- רק אלה שאני יצרתי, לא נוגעים בקיימים

DELETE FROM GroupInfo
WHERE ConfigurationId = 1
  AND LayerId IN (5,6)
  AND Kind = 'H'
  AND Number IN (1,2,3,4);

-- מחזירים את ה-ProfessionalId של 4 המורים ל-NULL (אם זה היה הערך המקורי)
-- בעצם נשאיר את ה-ProfessionalId שלהם כי שינוי זה לא מזיק
PRINT '== Step 2: הוסף מורי אנגלית ב-ConfigurationId=5 ==';
-- מורים שיהפכו לאנגלית (ProfessionalId=127): שרה אופיר, מיכל אורבך, בתיה אסור
UPDATE Teacher SET ProfessionalId = 127
WHERE TeacherId IN (229, 233, 226) AND ConfigurationId = 5;

DECLARE @cfg INT = 5;

PRINT '== Step 3: נקה הקבצות קיימות בשכבות 5,6 של cfg=5 ==';
DELETE ct
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId = @cfg
  AND c.LayerId IN (5,6)
  AND ct.Hakbatza IS NOT NULL AND ct.Hakbatza > 0;

DELETE FROM GroupInfo
WHERE ConfigurationId = @cfg
  AND LayerId IN (5,6)
  AND Kind = 'H';

PRINT '== Step 4: צור 4 הקבצות לשכבה ה (LayerId=5) ב-cfg=5 ==';
-- שכבה ה' classes: 2167 אודיה (1), 2168 דנה (2), 2177 אבישג (3), 2178 טליה (4)

-- Hak 1: אנגלית 5א-5ב, T214 דליה כהן-צמח, 4h
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2167, 214, 4, 1, NULL), (@cfg, 2168, 214, 4, 1, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 5, 1, 'H', N'אנגלית ה-א/ב', 127);

-- Hak 2: מתמטיקה 5א-5ב, T215 יונתן אסף, 5h
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2167, 215, 5, 2, NULL), (@cfg, 2168, 215, 5, 2, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 5, 2, 'H', N'מתמטיקה ה-א/ב', 125);

-- Hak 3: אנגלית 5ג-5ד, T229 שרה אופיר, 4h
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2177, 229, 4, 3, NULL), (@cfg, 2178, 229, 4, 3, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 5, 3, 'H', N'אנגלית ה-ג/ד', 127);

-- Hak 4: מתמטיקה 5ג-5ד, T223 אורי מימון, 5h
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2177, 223, 5, 4, NULL), (@cfg, 2178, 223, 5, 4, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 5, 4, 'H', N'מתמטיקה ה-ג/ד', 125);

PRINT '== Step 5: צור 4 הקבצות לשכבה ו (LayerId=6) ב-cfg=5 ==';
-- שכבה ו' classes: 2169 רינת (1), 2170 שירה (2), 2179 דנה (3), 2180 מיכל (4)

-- Hak 1: אנגלית 6א-6ב, T233 מיכל אורבך, 4h
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2169, 233, 4, 1, NULL), (@cfg, 2170, 233, 4, 1, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 6, 1, 'H', N'אנגלית ו-א/ב', 127);

-- Hak 2: מתמטיקה 6א-6ב, T222 גלעד שטיינברג, 5h
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2169, 222, 5, 2, NULL), (@cfg, 2170, 222, 5, 2, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 6, 2, 'H', N'מתמטיקה ו-א/ב', 125);

-- Hak 3: אנגלית 6ג-6ד, T226 בתיה אסור, 4h
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2179, 226, 4, 3, NULL), (@cfg, 2180, 226, 4, 3, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 6, 3, 'H', N'אנגלית ו-ג/ד', 127);

-- Hak 4: מתמטיקה 6ג-6ד, T216 הדס סבן, 5h
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2179, 216, 5, 4, NULL), (@cfg, 2180, 216, 5, 4, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 6, 4, 'H', N'מתמטיקה ו-ג/ד', 125);

PRINT '== Step 6: סיכום הקבצות בשכבות 5,6 cfg=5 ==';
SELECT
  c.LayerId,
  ct.Hakbatza,
  gi.Name AS HakName,
  p.Name AS Profession,
  COUNT(DISTINCT ct.ClassId) AS ClassCount,
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
