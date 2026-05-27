-- =====================================================================
-- העברת ההקבצות שיצרתי למבנה החדש: Hakbatza + HakbatzaClass + HakbatzaTeacher + FK ב-ClassTeacher
-- מבנה חדש דורש:
--   1. רישום ב-Hakbatza (HakbatzaId, ConfigurationId, LayerId, Number, Hours, Mode='partial')
--   2. רישום ב-HakbatzaClass (HakbatzaId, ClassId) לכל כיתה בהקבצה
--   3. רישום ב-HakbatzaTeacher (HakbatzaId, TeacherId, HoursContribution) לכל מורה
--   4. עדכון ClassTeacher.HakbatzaId לרישומים הקיימים
--
-- Mode='partial': |Teachers|=3 > |Classes|=2, אז HoursContribution = Hours*Classes/Teachers
--   = 4*2/3 ≈ 2.67 לאנגלית, 5*2/3 ≈ 3.33 למתמטיקה.
-- אבל בעיקרון Hour ב-ClassTeacher נשאר 4/5 — כי ה-Hours per lesson לא תלוי במספר המורים.
-- HoursContribution הוא תרומת ה-load של כל מורה — נשתמש ב-Hours ל-bijection-like שיב מציאותי.
-- כדי לפשט: נשתמש ב-Mode='partial' עם HoursContribution = Hour של הCT-row.
-- =====================================================================
SET NOCOUNT ON;
DECLARE @cfg INT = 5;

PRINT '== Step 1: יצירת רישומי Hakbatza לכל הקבצה ב-LayerId=5 ==';
-- שכבה ה' - הקבצה 1 (אנגלית, 4h)
INSERT INTO Hakbatza (ConfigurationId, LayerId, Number, Hours, Mode, CreatedAt)
VALUES (@cfg, 5, 1, 4, 'partial', GETDATE());
DECLARE @h5_1 INT = SCOPE_IDENTITY();

INSERT INTO HakbatzaClass (HakbatzaId, ClassId) VALUES (@h5_1, 2167), (@h5_1, 2168);
INSERT INTO HakbatzaTeacher (HakbatzaId, TeacherId, HoursContribution)
VALUES (@h5_1, 214, 4), (@h5_1, 196, 4), (@h5_1, 242, 4);
UPDATE ClassTeacher SET HakbatzaId = @h5_1
WHERE ConfigurationId=@cfg AND ClassId IN (2167,2168) AND Hakbatza=1;

-- שכבה ה' - הקבצה 2 (מתמטיקה, 5h)
INSERT INTO Hakbatza (ConfigurationId, LayerId, Number, Hours, Mode, CreatedAt)
VALUES (@cfg, 5, 2, 5, 'partial', GETDATE());
DECLARE @h5_2 INT = SCOPE_IDENTITY();

INSERT INTO HakbatzaClass (HakbatzaId, ClassId) VALUES (@h5_2, 2167), (@h5_2, 2168);
INSERT INTO HakbatzaTeacher (HakbatzaId, TeacherId, HoursContribution)
VALUES (@h5_2, 215, 5), (@h5_2, 204, 5), (@h5_2, 230, 5);
UPDATE ClassTeacher SET HakbatzaId = @h5_2
WHERE ConfigurationId=@cfg AND ClassId IN (2167,2168) AND Hakbatza=2;

-- שכבה ה' - הקבצה 3 (אנגלית, 4h)
INSERT INTO Hakbatza (ConfigurationId, LayerId, Number, Hours, Mode, CreatedAt)
VALUES (@cfg, 5, 3, 4, 'partial', GETDATE());
DECLARE @h5_3 INT = SCOPE_IDENTITY();

INSERT INTO HakbatzaClass (HakbatzaId, ClassId) VALUES (@h5_3, 2177), (@h5_3, 2178);
INSERT INTO HakbatzaTeacher (HakbatzaId, TeacherId, HoursContribution)
VALUES (@h5_3, 229, 4), (@h5_3, 182, 4), (@h5_3, 211, 4);
UPDATE ClassTeacher SET HakbatzaId = @h5_3
WHERE ConfigurationId=@cfg AND ClassId IN (2177,2178) AND Hakbatza=3;

-- שכבה ה' - הקבצה 4 (מתמטיקה, 5h)
INSERT INTO Hakbatza (ConfigurationId, LayerId, Number, Hours, Mode, CreatedAt)
VALUES (@cfg, 5, 4, 5, 'partial', GETDATE());
DECLARE @h5_4 INT = SCOPE_IDENTITY();

INSERT INTO HakbatzaClass (HakbatzaId, ClassId) VALUES (@h5_4, 2177), (@h5_4, 2178);
INSERT INTO HakbatzaTeacher (HakbatzaId, TeacherId, HoursContribution)
VALUES (@h5_4, 223, 5), (@h5_4, 210, 5), (@h5_4, 231, 5);
UPDATE ClassTeacher SET HakbatzaId = @h5_4
WHERE ConfigurationId=@cfg AND ClassId IN (2177,2178) AND Hakbatza=4;

PRINT '== Step 2: יצירת רישומי Hakbatza לכל הקבצה ב-LayerId=6 ==';
-- שכבה ו' - הקבצה 1 (אנגלית, 4h)
INSERT INTO Hakbatza (ConfigurationId, LayerId, Number, Hours, Mode, CreatedAt)
VALUES (@cfg, 6, 1, 4, 'partial', GETDATE());
DECLARE @h6_1 INT = SCOPE_IDENTITY();

INSERT INTO HakbatzaClass (HakbatzaId, ClassId) VALUES (@h6_1, 2169), (@h6_1, 2170);
INSERT INTO HakbatzaTeacher (HakbatzaId, TeacherId, HoursContribution)
VALUES (@h6_1, 233, 4), (@h6_1, 235, 4), (@h6_1, 232, 4);
UPDATE ClassTeacher SET HakbatzaId = @h6_1
WHERE ConfigurationId=@cfg AND ClassId IN (2169,2170) AND Hakbatza=1;

-- שכבה ו' - הקבצה 2 (מתמטיקה, 5h)
INSERT INTO Hakbatza (ConfigurationId, LayerId, Number, Hours, Mode, CreatedAt)
VALUES (@cfg, 6, 2, 5, 'partial', GETDATE());
DECLARE @h6_2 INT = SCOPE_IDENTITY();

INSERT INTO HakbatzaClass (HakbatzaId, ClassId) VALUES (@h6_2, 2169), (@h6_2, 2170);
INSERT INTO HakbatzaTeacher (HakbatzaId, TeacherId, HoursContribution)
VALUES (@h6_2, 222, 5), (@h6_2, 236, 5), (@h6_2, 240, 5);
UPDATE ClassTeacher SET HakbatzaId = @h6_2
WHERE ConfigurationId=@cfg AND ClassId IN (2169,2170) AND Hakbatza=2;

-- שכבה ו' - הקבצה 3 (אנגלית, 4h)
INSERT INTO Hakbatza (ConfigurationId, LayerId, Number, Hours, Mode, CreatedAt)
VALUES (@cfg, 6, 3, 4, 'partial', GETDATE());
DECLARE @h6_3 INT = SCOPE_IDENTITY();

INSERT INTO HakbatzaClass (HakbatzaId, ClassId) VALUES (@h6_3, 2179), (@h6_3, 2180);
INSERT INTO HakbatzaTeacher (HakbatzaId, TeacherId, HoursContribution)
VALUES (@h6_3, 226, 4), (@h6_3, 208, 4), (@h6_3, 206, 4);
UPDATE ClassTeacher SET HakbatzaId = @h6_3
WHERE ConfigurationId=@cfg AND ClassId IN (2179,2180) AND Hakbatza=3;

-- שכבה ו' - הקבצה 4 (מתמטיקה, 5h)
INSERT INTO Hakbatza (ConfigurationId, LayerId, Number, Hours, Mode, CreatedAt)
VALUES (@cfg, 6, 4, 5, 'partial', GETDATE());
DECLARE @h6_4 INT = SCOPE_IDENTITY();

INSERT INTO HakbatzaClass (HakbatzaId, ClassId) VALUES (@h6_4, 2179), (@h6_4, 2180);
INSERT INTO HakbatzaTeacher (HakbatzaId, TeacherId, HoursContribution)
VALUES (@h6_4, 216, 5), (@h6_4, 185, 5), (@h6_4, 228, 5);
UPDATE ClassTeacher SET HakbatzaId = @h6_4
WHERE ConfigurationId=@cfg AND ClassId IN (2179,2180) AND Hakbatza=4;

PRINT '== Step 3: סיכום ==';
SELECT h.LayerId, h.Number, h.Hours, h.Mode,
  (SELECT COUNT(*) FROM HakbatzaClass hc WHERE hc.HakbatzaId=h.HakbatzaId) AS Classes,
  (SELECT COUNT(*) FROM HakbatzaTeacher ht WHERE ht.HakbatzaId=h.HakbatzaId) AS Teachers,
  (SELECT COUNT(*) FROM ClassTeacher ct WHERE ct.HakbatzaId=h.HakbatzaId) AS CTRows
FROM Hakbatza h
WHERE h.ConfigurationId=@cfg
ORDER BY h.LayerId, h.Number;
