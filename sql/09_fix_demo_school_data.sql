/* =============================================================
   סגנית - תיקון דטא בית הספר הדמו:
     1. ניקוי ClassTeacher (כולל הקבצות מסוכסכות)
     2. הוספת 18 מורים כדי לכסות את חוסר ה-Frontaly
     3. שיבוץ חדש שמכבד את Frontaly של כל מורה
   ============================================================= */

USE Sganit;
GO

SET NOCOUNT ON;

DECLARE @ConfigurationId INT = 5;

PRINT N'=== שלב 1: ניקוי ClassTeacher ===';
DELETE FROM ClassTeacher WHERE ConfigurationId = @ConfigurationId;
UPDATE Teacher SET ManageClassId = NULL WHERE ConfigurationId = @ConfigurationId;
PRINT N'  ✓ ClassTeacher נוקה';

PRINT N'';
PRINT N'=== שלב 2: הוספת מורים נוספים לכיסוי capacity ===';

-- הצורך: כ-1136 שעות. הקיבולת הנוכחית: 814. חוסר: ~320.
-- אוסיף 18 מורים עם Frontaly ממוצע 20 = 360 שעות נוספות.

DECLARE @newTeachers TABLE (
    FirstName NVARCHAR(50),
    LastName  NVARCHAR(50),
    SubjectName NVARCHAR(50),
    Frontaly INT, FreeDay INT, Tafkid INT
);

-- פיזור לפי דרישה (מקצועות שיותר נדרשים מקבלים יותר מורים)
INSERT INTO @newTeachers VALUES
    (N'רותי',     N'בנימין',    N'עברית',         22, 2, 2),  -- 3 לעברית
    (N'מעיין',    N'אלגרבלי',   N'עברית',         20, 3, 2),
    (N'הילה',     N'יוסיפוב',   N'עברית',         18, 4, 2),
    (N'גלעד',     N'שטיינברג',  N'מתמטיקה',       22, 1, 2),  -- 2 למתמטיקה
    (N'אורי',     N'מימון',     N'מתמטיקה',       20, 4, 2),
    (N'נחמיה',    N'מועלם',     N'תורה',          20, 3, 2),  -- 2 לתורה
    (N'שלמה',     N'ארביב',     N'תורה',          18, 1, 2),
    (N'בתיה',     N'אסור',      N'מקרא',          20, 4, 2),  -- 1 למקרא
    (N'מלכה',     N'אדרי',      N'תפילה',         18, 3, 2),  -- 1 לתפילה
    (N'יוכבד',    N'יבנון',     N'משנה',          16, 2, 2),  -- 1 למשנה
    (N'שרה',      N'אופיר',     N'מדעים',         18, 1, 2),  -- 1 למדעים
    (N'אמיר',     N'ועקנין',    N'מורשת',         18, 5, 2),  -- 1 למורשת
    (N'דקלה',     N'גיא',       N'נחשון',         16, 3, 2),  -- 1 לנחשון
    (N'ענת',      N'שרי',       N'כישורי חיים',   18, 4, 2),  -- 1 לכישורי חיים
    (N'מיכל',     N'אורבך',     N'של"ח',          18, 2, 2),  -- 1 לשל"ח
    (N'יערה',     N'שמואלי',    N'ספרות',         16, 1, 2),  -- 1 לספרות
    (N'ינון',     N'נהרי',      N'מחשבים',        18, 5, 2),  -- 1 למחשבים
    (N'עפרה',     N'ביטון',     N'מוסיקה',        16, 2, 2);  -- 1 למוסיקה

INSERT INTO Teacher
    (ConfigurationId, FirstName, LastName, ProfessionalId,
     Frontaly, FreeDay, Shehya, Partani, TafkidId)
SELECT
    @ConfigurationId, t.FirstName, t.LastName,
    (SELECT TOP 1 ProfessionalId FROM Professional p
     WHERE p.ConfigurationId = @ConfigurationId AND p.Name = t.SubjectName),
    t.Frontaly, t.FreeDay, 4, 2, t.Tafkid
FROM @newTeachers t
WHERE NOT EXISTS (
    SELECT 1 FROM Teacher tt
    WHERE tt.ConfigurationId = @ConfigurationId
      AND tt.FirstName = t.FirstName
      AND tt.LastName  = t.LastName
);
PRINT N'  ✓ נוספו ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' מורים';

PRINT N'';
PRINT N'=== שלב 3: תבנית שיבוץ ===';

DECLARE @template TABLE (
    ProfessionalName NVARCHAR(50),
    Hours INT,
    LayerGroup CHAR(1)
);

/* א'-ב' (L) - 51 שעות */
INSERT INTO @template VALUES
    (N'עברית',         8, 'L'), (N'מתמטיקה',    5, 'L'),
    (N'תורה',          4, 'L'), (N'מקרא',       3, 'L'),
    (N'תפילה',         4, 'L'), (N'מדעים',      3, 'L'),
    (N'אנגלית',        2, 'L'), (N'חינוך גופני', 2, 'L'),
    (N'אומנות',        2, 'L'), (N'מוסיקה',     1, 'L'),
    (N'מלאכה',         2, 'L'), (N'מחשבים',     1, 'L'),
    (N'כישורי חיים',   2, 'L'), (N'נחשון',      2, 'L'),
    (N'ריתמיקה',       2, 'L'), (N'של"ח',       2, 'L'),
    (N'מורשת',         2, 'L'), (N'היסטוריה',   1, 'L'),
    (N'גיאוגרפיה',     1, 'L'), (N'משנה',       1, 'L'),
    (N'ספרות',         1, 'L');

/* ג'-ד' (M) - 51 שעות */
INSERT INTO @template VALUES
    (N'עברית',         7, 'M'), (N'מתמטיקה',    6, 'M'),
    (N'אנגלית',        4, 'M'), (N'מדעים',      3, 'M'),
    (N'תורה',          3, 'M'), (N'מקרא',       3, 'M'),
    (N'משנה',          2, 'M'), (N'תפילה',      3, 'M'),
    (N'היסטוריה',      2, 'M'), (N'גיאוגרפיה',  2, 'M'),
    (N'חינוך גופני',   2, 'M'), (N'אומנות',     1, 'M'),
    (N'מוסיקה',        1, 'M'), (N'מלאכה',      2, 'M'),
    (N'מחשבים',        1, 'M'), (N'של"ח',       2, 'M'),
    (N'ספרות',         1, 'M'), (N'מורשת',      2, 'M'),
    (N'כישורי חיים',   1, 'M'), (N'נחשון',      1, 'M'),
    (N'ריתמיקה',       1, 'M'), (N'ערבית',      1, 'M');

/* ה'-ו' (H) - 40 שעות (11 חסרות להקבצות עתידיות) */
INSERT INTO @template VALUES
    (N'עברית',         5, 'H'), (N'מתמטיקה',    3, 'H'),
    (N'אנגלית',        1, 'H'), (N'מדעים',      3, 'H'),
    (N'תורה',          3, 'H'), (N'מקרא',       2, 'H'),
    (N'משנה',          2, 'H'), (N'תפילה',      2, 'H'),
    (N'היסטוריה',      2, 'H'), (N'גיאוגרפיה',  2, 'H'),
    (N'חינוך גופני',   2, 'H'), (N'אומנות',     1, 'H'),
    (N'מוסיקה',        1, 'H'), (N'מלאכה',      2, 'H'),
    (N'מחשבים',        1, 'H'), (N'של"ח',       2, 'H'),
    (N'ספרות',         1, 'H'), (N'ערבית',      2, 'H'),
    (N'מורשת',         1, 'H'), (N'כישורי חיים', 1, 'H'),
    (N'נחשון',         1, 'H');

PRINT N'';
PRINT N'=== שלב 4: שיבוץ עם כיבוד Frontaly ===';

-- טבלה זמנית למעקב Frontaly שכבר נוצל לכל מורה
DECLARE @teacherUsage TABLE (
    TeacherId INT PRIMARY KEY,
    Used INT,
    Frontaly INT
);
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
    DECLARE @layerGroup CHAR(1) =
        CASE WHEN @CurLayerId <= 2 THEN 'L'
             WHEN @CurLayerId <= 4 THEN 'M'
             ELSE 'H'
        END;

    DECLARE @ProfName NVARCHAR(50), @Hours INT;
    DECLARE cTpl CURSOR FAST_FORWARD FOR
        SELECT ProfessionalName, Hours
        FROM @template
        WHERE LayerGroup = @layerGroup AND Hours > 0;

    OPEN cTpl;
    FETCH NEXT FROM cTpl INTO @ProfName, @Hours;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @ProfId INT;
        SELECT @ProfId = ProfessionalId FROM Professional
        WHERE ConfigurationId = @ConfigurationId AND Name = @ProfName;

        IF @ProfId IS NOT NULL
        BEGIN
            -- בחר מורה רנדומלי שמלמד את המקצוע + יש לו עוד פנאי ב-Frontaly
            DECLARE @TeacherId INT = NULL;

            SELECT TOP 1 @TeacherId = t.TeacherId
            FROM Teacher t
            INNER JOIN @teacherUsage u ON u.TeacherId = t.TeacherId
            WHERE t.ConfigurationId = @ConfigurationId
              AND t.ProfessionalId = @ProfId
              AND t.TafkidId IN (1, 2)
              AND (u.Used + @Hours) <= u.Frontaly  -- חשוב: לא לחרוג מ-Frontaly
            ORDER BY u.Used ASC, NEWID() ASC;

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
            ELSE
            BEGIN
                SET @skipped += 1;
            END
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
PRINT N'  ⚠ Skipped (no available teacher): ' + CAST(@skipped AS NVARCHAR(10));

PRINT N'';
PRINT N'=== שלב 5: שיוך מחנכי כיתה ===';

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
PRINT N'  ✓ ' + CAST(@mech AS NVARCHAR(10)) + N' מחנכי כיתה שויכו';

PRINT N'';
PRINT N'=== סיכום סופי ===';

DECLARE @c1 INT = (SELECT COUNT(*) FROM Teacher WHERE ConfigurationId = @ConfigurationId);
DECLARE @c2 INT = (SELECT COUNT(*) FROM ClassTeacher WHERE ConfigurationId = @ConfigurationId);
DECLARE @c3 INT = (SELECT SUM(Hour) FROM ClassTeacher WHERE ConfigurationId = @ConfigurationId);
DECLARE @c4 INT = (SELECT SUM(Frontaly) FROM Teacher WHERE ConfigurationId = @ConfigurationId);
PRINT N'  מורים:          ' + CAST(@c1 AS NVARCHAR(10));
PRINT N'  ClassTeacher:   ' + CAST(@c2 AS NVARCHAR(10));
PRINT N'  סך שעות:        ' + CAST(@c3 AS NVARCHAR(10));
PRINT N'  סך Frontaly:    ' + CAST(@c4 AS NVARCHAR(10));

PRINT N'';
PRINT N'-- בדיקת Over-Allocation:';
SELECT
    (t.FirstName + N' ' + t.LastName) AS Teacher,
    t.Frontaly,
    SUM(ct.Hour) AS Assigned,
    SUM(ct.Hour) - t.Frontaly AS Overload
FROM Teacher t
INNER JOIN ClassTeacher ct ON ct.TeacherId = t.TeacherId
WHERE t.ConfigurationId = @ConfigurationId
GROUP BY t.TeacherId, t.FirstName, t.LastName, t.Frontaly
HAVING SUM(ct.Hour) > t.Frontaly;

PRINT N'';
PRINT N'-- שעות לכל שכבה:';
SELECT
    CASE c.LayerId WHEN 1 THEN N'א''' WHEN 2 THEN N'ב'''
                   WHEN 3 THEN N'ג''' WHEN 4 THEN N'ד'''
                   WHEN 5 THEN N'ה''' WHEN 6 THEN N'ו''' END AS [שכבה],
    COUNT(DISTINCT c.ClassId) AS [כיתות],
    SUM(ct.Hour) AS [סך_שעות],
    SUM(ct.Hour) / COUNT(DISTINCT c.ClassId) AS [ממוצע_לכיתה]
FROM Class c
LEFT JOIN ClassTeacher ct ON ct.ClassId = c.ClassId
WHERE c.ConfigurationId = @ConfigurationId
GROUP BY c.LayerId
ORDER BY c.LayerId;
GO
