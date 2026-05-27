-- =====================================================================
-- יצירת 4 הקבצות לכל אחת משכבות ה' (LayerId=5) ו-ו' (LayerId=6).
-- 2 הקבצות לכל זוג כיתות: אחת באנגלית (ProfessionalId=6) ואחת בחשבון (=21).
--
-- מבנה התוצאה (LayerId=5):
--   Hak A: אנגלית, כיתות 2052+2053, 4 שעות, מורה: עדי חזן (T29)
--   Hak B: חשבון,  כיתות 2052+2053, 5 שעות, מורה: תהילה חורי (T28)
--   Hak C: אנגלית, כיתות 2054+2055, 4 שעות, מורה: גלית מסס (T42)
--   Hak D: חשבון,  כיתות 2054+2055, 5 שעות, מורה: איה טויטו (T30)
-- ובאופן דומה ל-LayerId=6 (4 כיתות 2056..2059).
--
-- 4 המורים שיקבלו ProfessionalId חדש:
--   T28 (תהילה חורי) → חשבון
--   T30 (איה טויטו)  → חשבון
--   T29 (עדי חזן)    → אנגלית
--   T42 (גלית מסס)   → אנגלית
-- =====================================================================

SET NOCOUNT ON;
DECLARE @cfg INT = 1;

PRINT 'Step 1: ניקוי הקבצות קיימות בשכבות 5 ו-6';
-- מוחקים שורות ClassTeacher של הקבצות בשכבות 5/6
DELETE ct
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId = @cfg
  AND c.LayerId IN (5,6)
  AND ct.Hakbatza IS NOT NULL AND ct.Hakbatza > 0;

-- מוחקים את GroupInfo התואמים
DELETE FROM GroupInfo
WHERE ConfigurationId = @cfg
  AND LayerId IN (5,6)
  AND Kind = 'H';

PRINT 'Step 2: עדכון ProfessionalId למורי אנגלית וחשבון';
UPDATE Teacher SET ProfessionalId = 21 WHERE TeacherId IN (28, 30) AND ConfigurationId = @cfg; -- חשבון
UPDATE Teacher SET ProfessionalId = 6  WHERE TeacherId IN (29, 42) AND ConfigurationId = @cfg; -- אנגלית

PRINT 'Step 3: יצירת הקבצות לשכבה ה (LayerId=5)';
-- Hak 1: אנגלית, 2052+2053, 4h, T29
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2052, 29, 4, 1, NULL), (@cfg, 2053, 29, 4, 1, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 5, 1, 'H', N'אנגלית ה1', 6);

-- Hak 2: חשבון, 2052+2053, 5h, T28
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2052, 28, 5, 2, NULL), (@cfg, 2053, 28, 5, 2, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 5, 2, 'H', N'חשבון ה1', 21);

-- Hak 3: אנגלית, 2054+2055, 4h, T42
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2054, 42, 4, 3, NULL), (@cfg, 2055, 42, 4, 3, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 5, 3, 'H', N'אנגלית ה2', 6);

-- Hak 4: חשבון, 2054+2055, 5h, T30
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2054, 30, 5, 4, NULL), (@cfg, 2055, 30, 5, 4, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 5, 4, 'H', N'חשבון ה2', 21);

PRINT 'Step 4: יצירת הקבצות לשכבה ו (LayerId=6)';
-- Hak 1: אנגלית, 2056+2057, 4h, T29
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2056, 29, 4, 1, NULL), (@cfg, 2057, 29, 4, 1, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 6, 1, 'H', N'אנגלית ו1', 6);

-- Hak 2: חשבון, 2056+2057, 5h, T28
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2056, 28, 5, 2, NULL), (@cfg, 2057, 28, 5, 2, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 6, 2, 'H', N'חשבון ו1', 21);

-- Hak 3: אנגלית, 2058+2059, 4h, T42
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2058, 42, 4, 3, NULL), (@cfg, 2059, 42, 4, 3, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 6, 3, 'H', N'אנגלית ו2', 6);

-- Hak 4: חשבון, 2058+2059, 5h, T30
INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud)
VALUES (@cfg, 2058, 30, 5, 4, NULL), (@cfg, 2059, 30, 5, 4, NULL);
INSERT INTO GroupInfo (ConfigurationId, LayerId, Number, Kind, Name, ProfessionalId)
VALUES (@cfg, 6, 4, 'H', N'חשבון ו2', 21);

PRINT 'Step 5: סיכום';
SELECT 'הקבצות שנוצרו' AS Info;
SELECT
  c.LayerId,
  ct.Hakbatza,
  gi.Name AS HakName,
  p.Name AS Profession,
  COUNT(DISTINCT ct.ClassId) AS ClassCount,
  MAX(ct.Hour) AS HourPerLesson,
  STRING_AGG(CONVERT(NVARCHAR(MAX), t.FirstName + ' ' + t.LastName), N' | ') WITHIN GROUP (ORDER BY t.TeacherId) AS Teachers
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
