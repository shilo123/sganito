-- =====================================================================
-- איזון: כל כיתה צריכה להגיע בדיוק ל-40 שעות שבועיות.
-- אחרי שהוספתי הקבצות אנגלית (4ש) + מתמטיקה (5ש) = 9 שעות לכיתה,
-- הסכום עלה ל-49 כי שעות פרונטליות קיימות של אותם מורים עוד שם.
--
-- פתרון:
--   1. הסר שורות "פרונטלי רגיל" (Hak IS NULL) של המורים שעכשיו בהקבצה,
--      בכיתות 5,6 של cfg=5.
--   2. אם נשארה פחות מ-40 ש"ש, הוסף שעות חסרות למחנך/ת הכיתה.
-- =====================================================================
SET NOCOUNT ON;
DECLARE @cfg INT = 5;

PRINT '== Step 1: הסר שעות פרונטליות-רגילות של מורי ההקבצה ==';
-- כל המורים שיש להם רישום Hak>0 בכיתה ספציפית — להסיר את רישומי Hak=NULL/0 שלהם
-- באותה כיתה (כי עכשיו ההקבצה מחליפה את ההוראה הרגילה שלהם).
DELETE ct
FROM ClassTeacher ct
INNER JOIN Class c ON c.ClassId = ct.ClassId
WHERE ct.ConfigurationId = @cfg
  AND c.LayerId IN (5,6)
  AND (ct.Hakbatza IS NULL OR ct.Hakbatza = 0)
  AND EXISTS (
    SELECT 1 FROM ClassTeacher ct2
    WHERE ct2.ConfigurationId = @cfg
      AND ct2.ClassId = ct.ClassId
      AND ct2.TeacherId = ct.TeacherId
      AND ct2.Hakbatza IS NOT NULL AND ct2.Hakbatza > 0
  );

PRINT '== Step 2: בדוק את סכום השעות לכל כיתה ==';
SELECT
  c.ClassId, c.Name, dbo.GetClassCountHour(c.ClassId, @cfg) Hours
FROM Class c WHERE c.ConfigurationId=@cfg AND c.LayerId IN (5,6)
ORDER BY c.LayerId, c.Seq;

PRINT '== Step 3: השלם ל-40 ש"ש על-ידי הוספת שעות למחנך/ת ==';
-- לכל כיתה, מוצאים את ההפרש מ-40 ומוסיפים אותו לרישום של המחנך/ת.
-- (מאפשר חיסור או הוספה — אבל בפועל ההפרש פה תמיד חיובי כי אנחנו ב-31).
DECLARE @cid INT, @diff INT, @homeroomId INT;
DECLARE class_cur CURSOR FOR
  SELECT c.ClassId, 40 - dbo.GetClassCountHour(c.ClassId, @cfg) AS Diff
  FROM Class c
  WHERE c.ConfigurationId = @cfg AND c.LayerId IN (5,6);

OPEN class_cur;
FETCH NEXT FROM class_cur INTO @cid, @diff;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF @diff <> 0
  BEGIN
    SET @homeroomId = (SELECT TOP 1 TeacherId FROM Teacher WHERE ConfigurationId = @cfg AND ManageClassId = @cid);
    IF @homeroomId IS NOT NULL
    BEGIN
      -- אם למחנך/ת יש כבר רישום בכיתה (Hak=NULL) — מעדכן אותו, אחרת מוסיף שורה
      IF EXISTS (
        SELECT 1 FROM ClassTeacher
        WHERE ConfigurationId = @cfg AND ClassId = @cid AND TeacherId = @homeroomId
          AND (Hakbatza IS NULL OR Hakbatza = 0)
      )
      BEGIN
        UPDATE ClassTeacher SET [Hour] = ISNULL([Hour],0) + @diff
        WHERE ConfigurationId = @cfg AND ClassId = @cid AND TeacherId = @homeroomId
          AND (Hakbatza IS NULL OR Hakbatza = 0);
      END
      ELSE
      BEGIN
        INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud, IsTeacher)
        VALUES (@cfg, @cid, @homeroomId, @diff, NULL, NULL, 1);
      END
    END
  END
  FETCH NEXT FROM class_cur INTO @cid, @diff;
END
CLOSE class_cur;
DEALLOCATE class_cur;

PRINT '== Step 4: סיכום ==';
SELECT
  c.ClassId, c.Name ClassName, dbo.GetClassCountHour(c.ClassId, @cfg) Hours,
  (SELECT COUNT(*) FROM ClassTeacher ct WHERE ct.ConfigurationId=@cfg AND ct.ClassId=c.ClassId) TeacherRowCount
FROM Class c WHERE c.ConfigurationId=@cfg AND c.LayerId IN (5,6)
ORDER BY c.LayerId, c.Seq;
