-- =====================================================================
-- תיקון: מחיקת שורות עם Hour שלילי שהשתבשו בתהליך האיזון.
-- ואיזון מחדש מסודר:
--   - אם הסכום > 40: הסר/הפחת שעות פרונטליות של מורים מקצועיים בכיתה
--   - אם הסכום < 40: הוסף שעות למחנך/ת
-- =====================================================================
SET NOCOUNT ON;
DECLARE @cfg INT = 5;

PRINT '== נקה שורות עם Hour <= 0 ==';
DELETE FROM ClassTeacher
WHERE ConfigurationId = @cfg AND [Hour] IS NOT NULL AND [Hour] <= 0;

PRINT '== חשב סכומי שעות נוכחיים ==';
SELECT c.ClassId, c.Name, dbo.GetClassCountHour(c.ClassId, @cfg) Hours
FROM Class c WHERE c.ConfigurationId=@cfg AND c.LayerId IN (5,6)
ORDER BY c.LayerId, c.Seq;

PRINT '== איזון: הוסף או הפחת שעות לפי הצורך ==';
DECLARE @cid INT, @currentHours INT, @diff INT, @homeroomId INT, @maxH INT = 40;

DECLARE class_cur CURSOR FOR
  SELECT c.ClassId, dbo.GetClassCountHour(c.ClassId, @cfg)
  FROM Class c
  WHERE c.ConfigurationId = @cfg AND c.LayerId IN (5,6);

OPEN class_cur;
FETCH NEXT FROM class_cur INTO @cid, @currentHours;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @diff = @maxH - @currentHours;
  IF @diff <> 0
  BEGIN
    SET @homeroomId = (SELECT TOP 1 TeacherId FROM Teacher WHERE ConfigurationId = @cfg AND ManageClassId = @cid);

    IF @diff > 0 AND @homeroomId IS NOT NULL
    BEGIN
      -- צריך להוסיף שעות למחנך/ת
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
    ELSE IF @diff < 0
    BEGIN
      -- צריך להפחית: הפחת ממורים בעלי הכי הרבה שעות בכיתה (לא הקבצה, לא המחנך/ת)
      DECLARE @need INT = ABS(@diff);
      DECLARE @rowId INT, @rowHour INT, @rowTid INT;
      WHILE @need > 0
      BEGIN
        SELECT TOP 1 @rowId = ct.ClassTeacherId, @rowHour = ISNULL(ct.[Hour],0), @rowTid = ct.TeacherId
        FROM ClassTeacher ct
        WHERE ct.ConfigurationId = @cfg AND ct.ClassId = @cid
          AND (ct.Hakbatza IS NULL OR ct.Hakbatza = 0)
          AND ISNULL(ct.[Hour],0) > 0
          AND (ct.TeacherId IS NULL OR ct.TeacherId <> @homeroomId)
        ORDER BY ct.[Hour] DESC;

        IF @rowId IS NULL BREAK;

        IF @rowHour <= @need
        BEGIN
          DELETE FROM ClassTeacher WHERE ClassTeacherId = @rowId;
          SET @need = @need - @rowHour;
        END
        ELSE
        BEGIN
          UPDATE ClassTeacher SET [Hour] = [Hour] - @need WHERE ClassTeacherId = @rowId;
          SET @need = 0;
        END
        SET @rowId = NULL; SET @rowHour = 0; SET @rowTid = 0;
      END
    END
  END
  FETCH NEXT FROM class_cur INTO @cid, @currentHours;
END
CLOSE class_cur;
DEALLOCATE class_cur;

PRINT '== סיכום אחרי איזון ==';
SELECT c.ClassId, c.Name ClassName, dbo.GetClassCountHour(c.ClassId, @cfg) Hours
FROM Class c WHERE c.ConfigurationId=@cfg AND c.LayerId IN (5,6)
ORDER BY c.LayerId, c.Seq;
