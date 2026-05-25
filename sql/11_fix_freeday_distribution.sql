/* תיקון אחרון של פיזור FreeDay -
   הבעיה: אחרי האיזון הראשון עדיין יש כיתות עם 7-9 מורים חופשיים באותו יום
   הפתרון: לכל כיתה - לוודא שאין יותר מ-3 מורים עם אותו FreeDay */

USE Sganit;
GO

SET NOCOUNT ON;

DECLARE @cfg INT = 5;

PRINT N'-- מצב לפני:';
SELECT t.FreeDay, COUNT(*) AS Teachers
FROM Teacher t WHERE t.ConfigurationId = @cfg
GROUP BY t.FreeDay ORDER BY t.FreeDay;

-- פיזור אגרסיבי יותר - לכל יום (1-5) בדיוק ~10 מורים
WITH Ranked AS (
    SELECT TeacherId,
        ROW_NUMBER() OVER (ORDER BY TeacherId) AS rn
    FROM Teacher
    WHERE ConfigurationId = @cfg
)
UPDATE Teacher SET FreeDay = ((r.rn - 1) % 5) + 1
FROM Teacher t INNER JOIN Ranked r ON r.TeacherId = t.TeacherId;

PRINT N'-- מצב אחרי:';
SELECT t.FreeDay, COUNT(*) AS Teachers
FROM Teacher t WHERE t.ConfigurationId = @cfg
GROUP BY t.FreeDay ORDER BY t.FreeDay;

-- בדוק כיתות עם עומס FreeDay > 2
PRINT N'';
PRINT N'-- כיתות עם 3+ מורים חופשיים באותו יום:';
SELECT c.Name AS Class, t.FreeDay,
    COUNT(DISTINCT t.TeacherId) AS TeachersOff
FROM Class c
INNER JOIN ClassTeacher ct ON ct.ClassId = c.ClassId
INNER JOIN Teacher t ON t.TeacherId = ct.TeacherId
WHERE c.ConfigurationId = @cfg AND ct.ConfigurationId = @cfg
  AND t.FreeDay > 0
GROUP BY c.Name, t.FreeDay
HAVING COUNT(DISTINCT t.TeacherId) >= 3
ORDER BY COUNT(DISTINCT t.TeacherId) DESC;
GO
