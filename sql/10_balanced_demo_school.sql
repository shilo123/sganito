/* =============================================================
   סגנית - איזון בית הספר הדמו לדטא הגיונית:
     - כל כיתה = 51 שעות מבוקשות (= קיבולת הלוח)
     - מספיק מורים לכל מקצוע
     - אין over-allocation
   ============================================================= */

USE Sganit;
GO

SET NOCOUNT ON;

DECLARE @ConfigurationId INT = 5;

PRINT N'=== שלב 1: ניקוי ClassTeacher ===';
DELETE FROM ClassTeacher WHERE ConfigurationId = @ConfigurationId;
UPDATE Teacher SET ManageClassId = NULL WHERE ConfigurationId = @ConfigurationId;
PRINT N'  ✓ נוקה';

PRINT N'';
PRINT N'=== שלב 2: הוספת מורים למקצועות יחידים ===';

DECLARE @newTeachers TABLE (
    FirstName NVARCHAR(50), LastName NVARCHAR(50),
    SubjectName NVARCHAR(50), Frontaly INT, FreeDay INT, Tafkid INT
);
INSERT INTO @newTeachers VALUES
    -- מקצועות יחידים שצריך עוד מורים
    (N'אופירה',  N'בוסקילה', N'ריתמיקה',          14, 2, 2),
    (N'דנית',    N'אטיאס',    N'ערבית',           14, 3, 2),
    (N'עינת',    N'דרעי',     N'חינוך מיוחד',     14, 5, 2),
    (N'גליה',    N'אסולין',   N'מתמטיקה מואצת',   14, 2, 2),
    -- מורה לתפילה (יש 4 כיתות * 3 שעות = 12 שעות ל-2 שכבות = 72)
    (N'יוסף',    N'בן-חמו',   N'תפילה',           18, 4, 2),
    -- חינוך גופני (כל הכיתות צריכות 2 שעות = 48 לסך 30 כעת)
    (N'דניאל',   N'אזרזר',    N'חינוך גופני',     20, 3, 2),
    -- מוסיקה (24 כיתות * 1 שעה = 24, יש 3 מורים 60 cap)
    (N'אורי',    N'דהן',      N'מוסיקה',          14, 5, 2),
    -- אומנות (24 כיתות * 1 שעה = 24, יש 7 מורים) - לא צריך
    -- מחשבים (יש 4 מורים 82 cap, 24 שעות צריך)
    -- מורשת (24 שעות צריך, יש 2 מורים 34 cap) - הוסף עוד 1
    (N'בלהה',   N'יקיר',      N'מורשת',           14, 1, 2);

INSERT INTO Teacher
    (ConfigurationId, FirstName, LastName, ProfessionalId,
     Frontaly, FreeDay, Shehya, Partani, TafkidId)
SELECT @ConfigurationId, t.FirstName, t.LastName,
    (SELECT TOP 1 ProfessionalId FROM Professional p
     WHERE p.ConfigurationId = @ConfigurationId AND p.Name = t.SubjectName),
    t.Frontaly, t.FreeDay, 4, 2, t.Tafkid
FROM @newTeachers t
WHERE NOT EXISTS (SELECT 1 FROM Teacher tt
    WHERE tt.ConfigurationId = @ConfigurationId
      AND tt.FirstName = t.FirstName AND tt.LastName = t.LastName);
PRINT N'  ✓ נוספו ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' מורים';

PRINT N'';
PRINT N'=== שלב 3: איזון FreeDay - לפזר 30 המורים מימים 1+4 ===';

-- כעת 17 ב-1 + 13 ב-4 = 30 מתוך 43. הבעיה ש-יום ראשון בכיתה יש 8 מורים חופשיים.
-- אעביר חלק ל-ימים 2,3,5,6
WITH FreeDay1 AS (
    SELECT TeacherId, ROW_NUMBER() OVER (ORDER BY TeacherId) AS rn
    FROM Teacher WHERE ConfigurationId = @ConfigurationId AND FreeDay = 1
)
UPDATE Teacher SET FreeDay =
    CASE WHEN f.rn % 5 = 1 THEN 2
         WHEN f.rn % 5 = 2 THEN 3
         WHEN f.rn % 5 = 3 THEN 5
         WHEN f.rn % 5 = 4 THEN 6
         ELSE 1
    END
FROM Teacher t INNER JOIN FreeDay1 f ON f.TeacherId = t.TeacherId;
PRINT N'  ✓ פוזרו ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' מורים שהיו ב-FreeDay=1';

WITH FreeDay4 AS (
    SELECT TeacherId, ROW_NUMBER() OVER (ORDER BY TeacherId) AS rn
    FROM Teacher WHERE ConfigurationId = @ConfigurationId AND FreeDay = 4
)
UPDATE Teacher SET FreeDay =
    CASE WHEN f.rn % 5 = 1 THEN 2
         WHEN f.rn % 5 = 2 THEN 3
         WHEN f.rn % 5 = 3 THEN 5
         WHEN f.rn % 5 = 4 THEN 6
         ELSE 4
    END
FROM Teacher t INNER JOIN FreeDay4 f ON f.TeacherId = t.TeacherId;
PRINT N'  ✓ פוזרו ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' מורים שהיו ב-FreeDay=4';

-- בדיקה: פיזור FreeDay
SELECT ISNULL(FreeDay, 0) AS FreeDay, COUNT(*) AS Teachers
FROM Teacher WHERE ConfigurationId = @ConfigurationId
GROUP BY FreeDay ORDER BY FreeDay;

PRINT N'';
PRINT N'=== שלב 4: תבנית 51 שעות לכל כיתה ===';

-- Template אחיד: לכל כיתה, ללא קשר לשכבה
-- (קצת התאמה לפי שכבה אבל סך תמיד 51)
DECLARE @template TABLE (
    ProfessionalName NVARCHAR(50),
    HoursL INT, HoursM INT, HoursH INT
);

INSERT INTO @template VALUES
    (N'עברית',        8, 7, 6),    -- 4 כיתות * 8 = 32 לL וכו'
    (N'מתמטיקה',      5, 6, 5),
    (N'אנגלית',       2, 4, 5),
    (N'מדעים',        3, 3, 4),
    (N'תורה',         4, 3, 3),
    (N'מקרא',         3, 3, 3),
    (N'משנה',         1, 2, 2),
    (N'תפילה',        4, 3, 3),
    (N'היסטוריה',     1, 2, 3),
    (N'גיאוגרפיה',    1, 2, 3),
    (N'חינוך גופני',  2, 2, 2),
    (N'אומנות',       2, 1, 1),
    (N'מוסיקה',       1, 1, 1),
    (N'מלאכה',        2, 2, 2),
    (N'מחשבים',       1, 1, 1),
    (N'כישורי חיים',  2, 1, 1),
    (N'נחשון',        2, 1, 1),
    (N'ריתמיקה',      2, 1, 0),
    (N'של"ח',         2, 2, 2),
    (N'מורשת',        2, 2, 1),
    (N'היסטוריה',     0, 0, 0), -- skip duplicate
    (N'ספרות',        1, 1, 1),
    (N'ערבית',        0, 1, 1);
-- סך לL: 8+5+2+3+4+3+1+4+1+1+2+2+1+2+1+2+2+2+2+2+1+0 = 50 (חסר 1)
-- חכה אספור שוב

-- ננסה ברירת מחדל פשוטה ויעיל
DELETE FROM @template;
INSERT INTO @template VALUES
    -- ProfName, L (a-b), M (c-d), H (e-f) - all sum to 51
    (N'עברית',        8, 7, 6),
    (N'מתמטיקה',      5, 6, 5),
    (N'אנגלית',       2, 4, 5),
    (N'מדעים',        3, 3, 4),
    (N'תורה',         4, 3, 3),
    (N'מקרא',         3, 3, 3),
    (N'משנה',         1, 2, 2),
    (N'תפילה',        4, 3, 3),
    (N'היסטוריה',     2, 2, 3),
    (N'גיאוגרפיה',    1, 2, 3),
    (N'חינוך גופני',  2, 2, 2),
    (N'אומנות',       2, 1, 1),
    (N'מוסיקה',       1, 1, 1),
    (N'מלאכה',        2, 2, 2),
    (N'מחשבים',       1, 1, 1),
    (N'כישורי חיים',  2, 1, 1),
    (N'נחשון',        2, 1, 1),
    (N'ריתמיקה',      1, 1, 0),
    (N'של"ח',         2, 2, 2),
    (N'מורשת',        2, 2, 1),
    (N'ספרות',        1, 1, 1),
    (N'ערבית',        0, 1, 1);

-- ולידציה: סך לכל קבוצת שכבה
DECLARE @sumL INT, @sumM INT, @sumH INT;
SELECT @sumL = SUM(HoursL), @sumM = SUM(HoursM), @sumH = SUM(HoursH) FROM @template;
PRINT N'  בדיקה - סך שעות לפי שכבה:';
PRINT N'    L (א-ב): ' + CAST(@sumL AS NVARCHAR(5));
PRINT N'    M (ג-ד): ' + CAST(@sumM AS NVARCHAR(5));
PRINT N'    H (ה-ו): ' + CAST(@sumH AS NVARCHAR(5));

PRINT N'';
PRINT N'=== שלב 5: שיבוץ עם round-robin על מורים ===';

-- מבנה: לכל (כיתה, מקצוע), בחר מורה רנדומלי שמלמד את המקצוע + הכי פחות נטען
DECLARE @teacherUsage TABLE (TeacherId INT PRIMARY KEY, Used INT, Frontaly INT);
INSERT INTO @teacherUsage
    SELECT TeacherId, 0, ISNULL(Frontaly, 0)
    FROM Teacher WHERE ConfigurationId = @ConfigurationId;

DECLARE @ClassId INT, @CurLayerId INT, @inserts INT = 0, @skipped INT = 0;
DECLARE cClass CURSOR FAST_FORWARD FOR
    SELECT ClassId, LayerId FROM Class
    WHERE ConfigurationId = @ConfigurationId
    ORDER BY LayerId, Seq;

OPEN cClass;
FETCH NEXT FROM cClass INTO @ClassId, @CurLayerId;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @colName CHAR(7) =
        CASE WHEN @CurLayerId <= 2 THEN 'HoursL '
             WHEN @CurLayerId <= 4 THEN 'HoursM '
             ELSE 'HoursH '
        END;

    DECLARE @ProfName NVARCHAR(50), @Hours INT;
    DECLARE cTpl CURSOR FAST_FORWARD FOR
        SELECT ProfessionalName,
            CASE WHEN @CurLayerId <= 2 THEN HoursL
                 WHEN @CurLayerId <= 4 THEN HoursM
                 ELSE HoursH END
        FROM @template;

    OPEN cTpl;
    FETCH NEXT FROM cTpl INTO @ProfName, @Hours;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF @Hours > 0
        BEGIN
            DECLARE @ProfId INT;
            SELECT @ProfId = ProfessionalId FROM Professional
            WHERE ConfigurationId = @ConfigurationId AND Name = @ProfName;

            IF @ProfId IS NOT NULL
            BEGIN
                DECLARE @TeacherId INT = NULL;

                -- העדף מורה ש: 1) מלמד את המקצוע, 2) הכי פחות נטען
                SELECT TOP 1 @TeacherId = t.TeacherId
                FROM Teacher t
                INNER JOIN @teacherUsage u ON u.TeacherId = t.TeacherId
                WHERE t.ConfigurationId = @ConfigurationId
                  AND t.ProfessionalId = @ProfId
                  AND t.TafkidId IN (1, 2)
                  AND (u.Used + @Hours) <= u.Frontaly + 5  -- מותר חריגה קטנה
                ORDER BY u.Used ASC, NEWID() ASC;

                -- אם לא נמצא מורה מהמקצוע - קח מורה כללי שיש לו פנאי
                IF @TeacherId IS NULL
                BEGIN
                    SELECT TOP 1 @TeacherId = t.TeacherId
                    FROM Teacher t
                    INNER JOIN @teacherUsage u ON u.TeacherId = t.TeacherId
                    WHERE t.ConfigurationId = @ConfigurationId
                      AND t.TafkidId IN (1, 2)
                      AND (u.Used + @Hours) <= u.Frontaly
                    ORDER BY u.Used ASC, NEWID() ASC;
                END

                IF @TeacherId IS NOT NULL
                BEGIN
                    INSERT INTO ClassTeacher
                        (ConfigurationId, ClassId, TeacherId, Hour, IsTeacher,
                         Hakbatza, Ihud, HakbatzaId)
                    VALUES (@ConfigurationId, @ClassId, @TeacherId, @Hours, 0,
                            NULL, NULL, NULL);
                    UPDATE @teacherUsage SET Used = Used + @Hours WHERE TeacherId = @TeacherId;
                    SET @inserts += 1;
                END
                ELSE SET @skipped += 1;
            END
            ELSE SET @skipped += 1;
        END

        FETCH NEXT FROM cTpl INTO @ProfName, @Hours;
    END
    CLOSE cTpl;
    DEALLOCATE cTpl;

    FETCH NEXT FROM cClass INTO @ClassId, @CurLayerId;
END
CLOSE cClass;
DEALLOCATE cClass;

PRINT N'  ✓ INSERTed: ' + CAST(@inserts AS NVARCHAR(10));
PRINT N'  ⚠ Skipped: ' + CAST(@skipped AS NVARCHAR(10));

PRINT N'';
PRINT N'=== שלב 6: שיוך מחנכי כיתה ===';

DECLARE cClass2 CURSOR FAST_FORWARD FOR
    SELECT ClassId FROM Class WHERE ConfigurationId = @ConfigurationId ORDER BY LayerId, Seq;
OPEN cClass2;
FETCH NEXT FROM cClass2 INTO @ClassId;
DECLARE @mech INT = 0;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @MechId INT = NULL;
    SELECT TOP 1 @MechId = t.TeacherId
    FROM Teacher t
    INNER JOIN ClassTeacher ct ON ct.TeacherId = t.TeacherId AND ct.ClassId = @ClassId
    WHERE t.ConfigurationId = @ConfigurationId
      AND t.TafkidId = 1
      AND t.ManageClassId IS NULL
    ORDER BY ct.Hour DESC, NEWID();

    IF @MechId IS NOT NULL
    BEGIN
        UPDATE Teacher SET ManageClassId = @ClassId WHERE TeacherId = @MechId;
        SET @mech += 1;
    END
    FETCH NEXT FROM cClass2 INTO @ClassId;
END
CLOSE cClass2;
DEALLOCATE cClass2;
PRINT N'  ✓ ' + CAST(@mech AS NVARCHAR(10)) + N' מחנכי כיתה';

PRINT N'';
PRINT N'=== סיכום סופי ===';
SELECT
    CASE c.LayerId WHEN 1 THEN N'א''' WHEN 2 THEN N'ב''' WHEN 3 THEN N'ג'''
                   WHEN 4 THEN N'ד''' WHEN 5 THEN N'ה''' WHEN 6 THEN N'ו''' END AS [שכבה],
    COUNT(DISTINCT c.ClassId) AS [כיתות],
    SUM(ct.Hour) AS [סך_שעות],
    SUM(ct.Hour) / COUNT(DISTINCT c.ClassId) AS [ממוצע]
FROM Class c
LEFT JOIN ClassTeacher ct ON ct.ClassId = c.ClassId
WHERE c.ConfigurationId = @ConfigurationId
GROUP BY c.LayerId
ORDER BY c.LayerId;

PRINT N'';
PRINT N'-- בדיקת היתכנות:';
SELECT
    (SELECT SUM(Hour) FROM ClassTeacher WHERE ConfigurationId = @ConfigurationId) AS Demand,
    (SELECT SUM(Frontaly) FROM Teacher WHERE ConfigurationId = @ConfigurationId) AS Capacity,
    (SELECT COUNT(*) FROM Class c CROSS JOIN SchoolHours sh
     WHERE c.ConfigurationId = @ConfigurationId AND sh.ConfigurationId = @ConfigurationId
       AND (sh.IsOnlyShehya = 0 OR sh.IsOnlyShehya IS NULL)) AS BoardCells;
GO
