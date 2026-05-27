-- =====================================================================
-- וודא שלכל מחנך/ת יש מינימום 4 שעות פרונטליות בכיתה שלו/ה.
-- לכל מחנך/ת חסרי שעות:
--   1. הוסף 4 שעות למחנך/ת (אם לא קיים — שורה חדשה; אם קיים — עדכן)
--   2. הפחת 4 שעות ממורה אחר בכיתה (עם הכי הרבה שעות) כדי לשמור על איזון
-- =====================================================================
SET NOCOUNT ON;
DECLARE @cfg INT = 5;
DECLARE @minH INT = 4;

PRINT '== זיהוי מחנכות עם פחות מ-4 שעות בכיתה ==';
DECLARE @tid INT, @cid INT;
DECLARE hr_cur CURSOR FOR
  SELECT t.TeacherId, t.ManageClassId
  FROM Teacher t
  WHERE t.ConfigurationId = @cfg
    AND t.ManageClassId IS NOT NULL
    AND t.TafkidId = 1
    AND ISNULL((
      SELECT SUM(ISNULL(ct.[Hour],0))
      FROM ClassTeacher ct
      WHERE ct.ConfigurationId = @cfg
        AND ct.TeacherId = t.TeacherId
        AND ct.ClassId = t.ManageClassId
        AND (ct.Hakbatza IS NULL OR ct.Hakbatza = 0)
    ),0) < @minH;

OPEN hr_cur;
FETCH NEXT FROM hr_cur INTO @tid, @cid;
WHILE @@FETCH_STATUS = 0
BEGIN
  DECLARE @curHr INT = ISNULL((
    SELECT SUM(ISNULL(ct.[Hour],0))
    FROM ClassTeacher ct
    WHERE ct.ConfigurationId=@cfg AND ct.TeacherId=@tid AND ct.ClassId=@cid
      AND (ct.Hakbatza IS NULL OR ct.Hakbatza=0)
  ),0);
  DECLARE @needAdd INT = @minH - @curHr;
  DECLARE @needRemove INT = @needAdd;

  -- 1. הפחתה ממורה אחר בכיתה (לא המחנך/ת, לא הקבצה) — לאזן
  WHILE @needRemove > 0
  BEGIN
    DECLARE @ctRemoveId INT, @ctRemoveHour INT;
    SELECT TOP 1 @ctRemoveId = ct.ClassTeacherId, @ctRemoveHour = ISNULL(ct.[Hour],0)
    FROM ClassTeacher ct
    WHERE ct.ConfigurationId=@cfg AND ct.ClassId=@cid
      AND ct.TeacherId IS NOT NULL AND ct.TeacherId <> @tid
      AND (ct.Hakbatza IS NULL OR ct.Hakbatza=0)
      AND ISNULL(ct.[Hour],0) > 0
    ORDER BY ct.[Hour] DESC;

    IF @ctRemoveId IS NULL BREAK;

    IF @ctRemoveHour <= @needRemove
    BEGIN
      DELETE FROM ClassTeacher WHERE ClassTeacherId = @ctRemoveId;
      SET @needRemove = @needRemove - @ctRemoveHour;
    END
    ELSE
    BEGIN
      UPDATE ClassTeacher SET [Hour] = [Hour] - @needRemove WHERE ClassTeacherId = @ctRemoveId;
      SET @needRemove = 0;
    END
    SET @ctRemoveId = NULL;
  END

  -- 2. הוספה למחנך/ת
  IF EXISTS (
    SELECT 1 FROM ClassTeacher
    WHERE ConfigurationId=@cfg AND TeacherId=@tid AND ClassId=@cid
      AND (Hakbatza IS NULL OR Hakbatza=0)
  )
  BEGIN
    UPDATE ClassTeacher
    SET [Hour] = ISNULL([Hour],0) + @needAdd
    WHERE ConfigurationId=@cfg AND TeacherId=@tid AND ClassId=@cid
      AND (Hakbatza IS NULL OR Hakbatza=0);
  END
  ELSE
  BEGIN
    INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud, IsTeacher)
    VALUES (@cfg, @cid, @tid, @needAdd, NULL, NULL, 1);
  END

  FETCH NEXT FROM hr_cur INTO @tid, @cid;
END
CLOSE hr_cur;
DEALLOCATE hr_cur;

PRINT '== סיכום אחרי תיקון ==';
SELECT t.TeacherId, t.FirstName, t.LastName, t.ManageClassId, ISNULL((
  SELECT SUM(ISNULL(ct.[Hour],0))
  FROM ClassTeacher ct
  WHERE ct.ConfigurationId=@cfg AND ct.TeacherId=t.TeacherId AND ct.ClassId=t.ManageClassId
    AND (ct.Hakbatza IS NULL OR ct.Hakbatza=0)
),0) HoursInClass
FROM Teacher t
WHERE t.ConfigurationId=@cfg AND t.ManageClassId IS NOT NULL AND t.TafkidId=1
ORDER BY t.ManageClassId;

PRINT '== סכום שעות לכל כיתה אחרי תיקון ==';
SELECT c.ClassId, c.Name, dbo.GetClassCountHour(c.ClassId, @cfg) Hours
FROM Class c WHERE c.ConfigurationId=@cfg AND c.LayerId IN (5,6)
ORDER BY c.LayerId, c.Seq;
