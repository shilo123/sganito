/* פיזור חכם של FreeDay לפי כיתה
   האלגוריתם: לכל מורה, אם הוא יוצר קיר בכיתה שהוא מלמד (3+ מורים באותו יום),
   חפש יום שאין בו קיר עבור כל הכיתות שלו, ועבור אליו. */

USE Sganit;
GO

SET NOCOUNT ON;

DECLARE @cfg INT = 5;

-- חזור 5 פעמים (לתת לאלגוריתם לקרב לפתרון)
DECLARE @iter INT = 0;
DECLARE @moved INT;
DECLARE @walls INT;

WHILE @iter < 10
BEGIN
    SET @moved = 0;

    -- מצא את הכיתה+יום הכי בעייתיים
    DECLARE @worstClassId INT, @worstDay INT, @worstCount INT;
    SELECT TOP 1
        @worstClassId = c.ClassId,
        @worstDay = t.FreeDay,
        @worstCount = COUNT(DISTINCT t.TeacherId)
    FROM Class c
    INNER JOIN ClassTeacher ct ON ct.ClassId = c.ClassId
    INNER JOIN Teacher t ON t.TeacherId = ct.TeacherId
    WHERE c.ConfigurationId = @cfg AND ct.ConfigurationId = @cfg
      AND t.FreeDay > 0
    GROUP BY c.ClassId, t.FreeDay
    HAVING COUNT(DISTINCT t.TeacherId) >= 3
    ORDER BY COUNT(DISTINCT t.TeacherId) DESC;

    IF @worstCount IS NULL OR @worstCount < 3
    BEGIN
        BREAK;
    END

    -- בחר מורה מאלה שב-class+day - העדף מורה עם פחות שיעורים בכיתה הזאת
    DECLARE @moveTeacherId INT;
    SELECT TOP 1 @moveTeacherId = t.TeacherId
    FROM Teacher t
    INNER JOIN ClassTeacher ct ON ct.TeacherId = t.TeacherId
    WHERE t.ConfigurationId = @cfg AND ct.ConfigurationId = @cfg
      AND ct.ClassId = @worstClassId
      AND t.FreeDay = @worstDay
      AND t.TafkidId <> 1  -- לא מחנכים
    ORDER BY ct.Hour ASC;

    IF @moveTeacherId IS NULL
    BEGIN
        SET @iter = @iter + 1;
        CONTINUE;
    END

    -- מצא יום שיוצר הכי פחות walls חדשים (לכל הכיתות שהמורה מלמד)
    DECLARE @bestDay INT = NULL, @bestImpact INT = 999999;
    DECLARE @d INT = 1;
    WHILE @d <= 5
    BEGIN
        IF @d <> @worstDay
        BEGIN
            -- ספור walls חדשים שייווצרו אם המורה יעבור ליום @d
            DECLARE @newWalls INT = 0;
            SELECT @newWalls = COUNT(*) FROM (
                SELECT ct.ClassId
                FROM ClassTeacher ct
                INNER JOIN Teacher t2 ON t2.TeacherId = ct.TeacherId
                WHERE ct.TeacherId IN (
                    SELECT TeacherId FROM ClassTeacher
                    WHERE TeacherId = @moveTeacherId AND ConfigurationId = @cfg
                )
                AND ct.ConfigurationId = @cfg
                AND t2.FreeDay = @d
                AND ct.ClassId IN (
                    SELECT ClassId FROM ClassTeacher
                    WHERE TeacherId = @moveTeacherId AND ConfigurationId = @cfg
                )
                GROUP BY ct.ClassId
                HAVING COUNT(DISTINCT ct.TeacherId) >= 2
            ) x;

            IF @newWalls < @bestImpact
            BEGIN
                SET @bestImpact = @newWalls;
                SET @bestDay = @d;
            END
        END
        SET @d = @d + 1;
    END

    -- עבר את המורה ליום הזה (או NULL אם אין יום טוב)
    IF @bestDay IS NOT NULL
    BEGIN
        UPDATE Teacher SET FreeDay = @bestDay WHERE TeacherId = @moveTeacherId;
        SET @moved = 1;
    END
    ELSE
    BEGIN
        UPDATE Teacher SET FreeDay = NULL WHERE TeacherId = @moveTeacherId;
        SET @moved = 1;
    END

    SET @iter = @iter + 1;
END

PRINT N'-- iterations: ' + CAST(@iter AS NVARCHAR(5));

-- בדיקה סופית
SELECT @walls = COUNT(*) FROM (
    SELECT c.ClassId, t.FreeDay
    FROM Class c
    INNER JOIN ClassTeacher ct ON ct.ClassId = c.ClassId
    INNER JOIN Teacher t ON t.TeacherId = ct.TeacherId
    WHERE c.ConfigurationId = @cfg AND ct.ConfigurationId = @cfg
      AND t.FreeDay > 0
    GROUP BY c.ClassId, t.FreeDay
    HAVING COUNT(DISTINCT t.TeacherId) >= 3
) x;
PRINT N'-- remaining walls: ' + CAST(@walls AS NVARCHAR(5));

-- הצג top walls
SELECT TOP 10 c.Name AS Class, t.FreeDay,
    COUNT(DISTINCT t.TeacherId) AS Teachers
FROM Class c
INNER JOIN ClassTeacher ct ON ct.ClassId = c.ClassId
INNER JOIN Teacher t ON t.TeacherId = ct.TeacherId
WHERE c.ConfigurationId = @cfg AND ct.ConfigurationId = @cfg
  AND t.FreeDay > 0
GROUP BY c.Name, t.FreeDay
HAVING COUNT(DISTINCT t.TeacherId) >= 3
ORDER BY COUNT(DISTINCT t.TeacherId) DESC;
GO

-- ⛔ אם עדיין יש walls - הגישה הפשוטה: לכל מורה שב-2+ walls, נקה FreeDay
DECLARE @cfg2 INT = 5;
DECLARE @cleared INT = 0;

WITH ProblematicTeachers AS (
    SELECT t.TeacherId,
        COUNT(DISTINCT c.ClassId) AS WallsCount
    FROM Teacher t
    INNER JOIN ClassTeacher ct ON ct.TeacherId = t.TeacherId
    INNER JOIN Class c ON c.ClassId = ct.ClassId
    WHERE t.ConfigurationId = @cfg2 AND ct.ConfigurationId = @cfg2
      AND t.FreeDay > 0
      AND EXISTS (
          SELECT 1 FROM ClassTeacher ct2
          INNER JOIN Teacher t2 ON t2.TeacherId = ct2.TeacherId
          WHERE ct2.ClassId = c.ClassId AND ct2.ConfigurationId = @cfg2
            AND t2.FreeDay = t.FreeDay
            AND t2.TeacherId <> t.TeacherId
          GROUP BY ct2.ClassId
          HAVING COUNT(DISTINCT t2.TeacherId) >= 2
      )
    GROUP BY t.TeacherId
)
UPDATE Teacher SET FreeDay = NULL
FROM Teacher t
INNER JOIN ProblematicTeachers p ON p.TeacherId = t.TeacherId
WHERE p.WallsCount >= 2;

SET @cleared = @@ROWCOUNT;
PRINT N'-- cleared FreeDay for ' + CAST(@cleared AS NVARCHAR(5)) + N' teachers';

-- בדוק שוב
SELECT COUNT(*) AS RemainingWalls FROM (
    SELECT c.ClassId, t.FreeDay
    FROM Class c
    INNER JOIN ClassTeacher ct ON ct.ClassId = c.ClassId
    INNER JOIN Teacher t ON t.TeacherId = ct.TeacherId
    WHERE c.ConfigurationId = @cfg2 AND ct.ConfigurationId = @cfg2
      AND t.FreeDay > 0
    GROUP BY c.ClassId, t.FreeDay
    HAVING COUNT(DISTINCT t.TeacherId) >= 3
) x;

SELECT FreeDay, COUNT(*) AS Teachers
FROM Teacher WHERE ConfigurationId = @cfg2
GROUP BY FreeDay ORDER BY FreeDay;
GO
