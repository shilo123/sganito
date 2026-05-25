/* =============================================================
   סגנית - השלמת כיתות + שיבוץ רנדומלי בבית הספר הדמו
   מטרה:
     1. הבטח לפחות 4 כיתות בכל שכבה (24 בסך הכל)
     2. נקה ClassTeacher קיים
     3. שבץ רנדומלית לכל כיתה לפי תבנית שעות לשכבה
     4. בשכבות ה' ו-ו' - מספר שעות נמוך יותר כדי להשאיר
        מקום להקבצות שייוצרו ידנית
   ============================================================= */

USE Sganit;
GO

SET NOCOUNT ON;

DECLARE @ConfigurationId INT, @SchoolId INT;
SELECT @SchoolId = SchoolId FROM Users WHERE UserName = 'demo';
SELECT TOP 1 @ConfigurationId = ConfigurationId FROM Configuration
WHERE SchoolId = @SchoolId ORDER BY ConfigurationId DESC;

IF @ConfigurationId IS NULL
BEGIN
    PRINT N'⚠ לא נמצא בית ספר דמו. עצירה.';
    RETURN;
END

PRINT N'=== שלב 1: השלמת כיתות ל-4 בכל שכבה ===';

DECLARE @layerId INT = 1;
WHILE @layerId <= 6
BEGIN
    DECLARE @existing INT = (SELECT COUNT(*) FROM Class
                              WHERE ConfigurationId = @ConfigurationId
                                AND LayerId = @layerId);
    DECLARE @needToAdd INT = 4 - @existing;
    DECLARE @layerLetter NVARCHAR(2) =
        CASE @layerId
            WHEN 1 THEN N'א'
            WHEN 2 THEN N'ב'
            WHEN 3 THEN N'ג'
            WHEN 4 THEN N'ד'
            WHEN 5 THEN N'ה'
            ELSE N'ו'
        END;

    DECLARE @seq INT = @existing + 1;
    WHILE @needToAdd > 0
    BEGIN
        DECLARE @newClassName NVARCHAR(50) = @layerLetter + N'''' + CAST(@seq AS NVARCHAR(2));
        INSERT INTO Class (Name, ConfigurationId, LayerId, Seq)
        VALUES (@newClassName, @ConfigurationId, @layerId, @seq);
        SET @seq += 1;
        SET @needToAdd -= 1;
    END
    SET @layerId += 1;
END

DECLARE @totalClasses INT = (SELECT COUNT(*) FROM Class WHERE ConfigurationId = @ConfigurationId);
PRINT N'  ✓ סך הכל כיתות: ' + CAST(@totalClasses AS NVARCHAR(10));

PRINT N'';
PRINT N'=== שלב 2: ניקוי ClassTeacher קיים ===';
DELETE FROM ClassTeacher WHERE ConfigurationId = @ConfigurationId;
PRINT N'  ✓ נמחקו ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' רשומות';

PRINT N'';
PRINT N'=== שלב 3: תבנית שיבוץ לפי שכבה ===';

-- טבלה זמנית עם תבנית: ProfessionalName, Hours, LayerGroup ("L" = low א-ב, "M" = mid ג-ד, "H" = high ה-ו)
DECLARE @template TABLE (
    ProfessionalName NVARCHAR(50),
    Hours INT,
    LayerGroup CHAR(1)
);

/* ====== שכבות א'-ב' (צעירות) - 51 שעות ====== */
INSERT INTO @template VALUES
    (N'עברית',         8, 'L'),
    (N'מתמטיקה',       5, 'L'),
    (N'תורה',          4, 'L'),
    (N'מקרא',          3, 'L'),
    (N'תפילה',         4, 'L'),
    (N'מדעים',         3, 'L'),
    (N'אנגלית',        2, 'L'),
    (N'חינוך גופני',   2, 'L'),
    (N'אומנות',        2, 'L'),
    (N'מוסיקה',        1, 'L'),
    (N'מלאכה',         2, 'L'),
    (N'מחשבים',        1, 'L'),
    (N'כישורי חיים',   2, 'L'),
    (N'נחשון',         2, 'L'),
    (N'ריתמיקה',       2, 'L'),
    (N'של"ח',          2, 'L'),
    (N'מורשת',         2, 'L'),
    (N'היסטוריה',      1, 'L'),
    (N'גיאוגרפיה',     1, 'L'),
    (N'משנה',          1, 'L'),
    (N'ספרות',         1, 'L'),
    (N'ערבית',         0, 'L'); -- ערבית רק מכיתה ה' בד"כ

/* ====== שכבות ג'-ד' (ביניים) - 51 שעות ====== */
INSERT INTO @template VALUES
    (N'עברית',         7, 'M'),
    (N'מתמטיקה',       6, 'M'),
    (N'אנגלית',        4, 'M'),
    (N'מדעים',         3, 'M'),
    (N'תורה',          3, 'M'),
    (N'מקרא',          3, 'M'),
    (N'משנה',          2, 'M'),
    (N'תפילה',         3, 'M'),
    (N'היסטוריה',      2, 'M'),
    (N'גיאוגרפיה',     2, 'M'),
    (N'חינוך גופני',   2, 'M'),
    (N'אומנות',        1, 'M'),
    (N'מוסיקה',        1, 'M'),
    (N'מלאכה',         2, 'M'),
    (N'מחשבים',        1, 'M'),
    (N'של"ח',          2, 'M'),
    (N'ספרות',         1, 'M'),
    (N'מורשת',         2, 'M'),
    (N'כישורי חיים',   1, 'M'),
    (N'נחשון',         1, 'M'),
    (N'ריתמיקה',       1, 'M'),
    (N'ערבית',         1, 'M');

/* ====== שכבות ה'-ו' (גבוהות) - 41 שעות בלבד
   להשאיר 10 שעות חסרות כדי שהמשתמש יוסיף הקבצות
   במתמטיקה ובאנגלית ידנית      ====== */
INSERT INTO @template VALUES
    (N'עברית',         5, 'H'),
    (N'מתמטיקה',       3, 'H'),  -- חסר ~2 (להקבצה)
    (N'אנגלית',        1, 'H'),  -- חסר ~3 (להקבצה)
    (N'מדעים',         3, 'H'),
    (N'תורה',          3, 'H'),
    (N'מקרא',          2, 'H'),
    (N'משנה',          2, 'H'),
    (N'תפילה',         2, 'H'),
    (N'היסטוריה',      2, 'H'),
    (N'גיאוגרפיה',     2, 'H'),
    (N'חינוך גופני',   2, 'H'),
    (N'אומנות',        1, 'H'),
    (N'מוסיקה',        1, 'H'),
    (N'מלאכה',         2, 'H'),
    (N'מחשבים',        1, 'H'),
    (N'של"ח',          2, 'H'),
    (N'ספרות',         1, 'H'),
    (N'ערבית',         2, 'H'),
    (N'מורשת',         1, 'H'),
    (N'ריתמיקה',       0, 'H'),
    (N'כישורי חיים',   1, 'H'),
    (N'נחשון',         1, 'H');

PRINT N'';
PRINT N'=== שלב 4: שיבוץ רנדומלי לכל כיתה ===';

-- CURSOR על כל הכיתות
DECLARE @ClassId INT, @CurLayerId INT, @ClassName NVARCHAR(50);
DECLARE cClass CURSOR FAST_FORWARD FOR
    SELECT ClassId, LayerId, Name FROM Class
    WHERE ConfigurationId = @ConfigurationId
    ORDER BY LayerId, Seq;

OPEN cClass;
FETCH NEXT FROM cClass INTO @ClassId, @CurLayerId, @ClassName;

DECLARE @totalAssigned INT = 0;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- מהי קבוצת השכבה?
    DECLARE @layerGroup CHAR(1) =
        CASE WHEN @CurLayerId <= 2 THEN 'L'
             WHEN @CurLayerId <= 4 THEN 'M'
             ELSE 'H'
        END;

    -- CURSOR פנימי על כל המקצועות בתבנית
    DECLARE @ProfName NVARCHAR(50), @Hours INT;
    DECLARE cTpl CURSOR FAST_FORWARD FOR
        SELECT ProfessionalName, Hours
        FROM @template
        WHERE LayerGroup = @layerGroup AND Hours > 0;

    OPEN cTpl;
    FETCH NEXT FROM cTpl INTO @ProfName, @Hours;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- מצא ProfessionalId
        DECLARE @ProfId INT;
        SELECT @ProfId = ProfessionalId FROM Professional
        WHERE ConfigurationId = @ConfigurationId AND Name = @ProfName;

        IF @ProfId IS NOT NULL
        BEGIN
            -- בחר מורה רנדומלי שמלמד את המקצוע, עם עדיפות לאלה שיש להם
            -- פחות שעות עד עכשיו (כדי לפזר ולא להעמיס על אחד)
            DECLARE @TeacherId INT;

            SELECT TOP 1 @TeacherId = t.TeacherId
            FROM Teacher t
            WHERE t.ConfigurationId = @ConfigurationId
              AND t.ProfessionalId = @ProfId
              AND t.TafkidId IN (1, 2)  -- מחנך או מורה מקצועי
            ORDER BY
                ISNULL((SELECT SUM(Hour) FROM ClassTeacher ct
                        WHERE ct.TeacherId = t.TeacherId
                          AND ct.ConfigurationId = @ConfigurationId), 0) ASC,
                NEWID() ASC;

            IF @TeacherId IS NOT NULL
            BEGIN
                INSERT INTO ClassTeacher
                    (ConfigurationId, ClassId, TeacherId, Hour, IsTeacher)
                VALUES (@ConfigurationId, @ClassId, @TeacherId, @Hours, 0);
                SET @totalAssigned += 1;
            END
        END

        FETCH NEXT FROM cTpl INTO @ProfName, @Hours;
    END
    CLOSE cTpl;
    DEALLOCATE cTpl;

    FETCH NEXT FROM cClass INTO @ClassId, @CurLayerId, @ClassName;
END
CLOSE cClass;
DEALLOCATE cClass;

PRINT N'  ✓ נוצרו ' + CAST(@totalAssigned AS NVARCHAR(10)) + N' שיבוצי ClassTeacher';

PRINT N'';
PRINT N'=== שלב 5: שיוך מחנכי כיתה ===';

-- לכל כיתה - בחר מחנך כיתה (מורה עם TafkidId=1) שיש לו את העברית/מתמטיקה בכיתה
-- ועדכן Teacher.ManageClassId
UPDATE Teacher SET ManageClassId = NULL WHERE ConfigurationId = @ConfigurationId;

DECLARE cClass2 CURSOR FAST_FORWARD FOR
    SELECT ClassId FROM Class WHERE ConfigurationId = @ConfigurationId ORDER BY LayerId, Seq;
OPEN cClass2;
FETCH NEXT FROM cClass2 INTO @ClassId;
DECLARE @assignedMechanech INT = 0;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @MechanechId INT;
    SELECT TOP 1 @MechanechId = t.TeacherId
    FROM Teacher t
    INNER JOIN ClassTeacher ct ON ct.TeacherId = t.TeacherId AND ct.ClassId = @ClassId
    WHERE t.ConfigurationId = @ConfigurationId
      AND t.TafkidId = 1  -- מחנך כיתה
      AND t.ManageClassId IS NULL
    ORDER BY ct.Hour DESC, NEWID();

    IF @MechanechId IS NOT NULL
    BEGIN
        UPDATE Teacher SET ManageClassId = @ClassId WHERE TeacherId = @MechanechId;
        SET @assignedMechanech += 1;
    END
    FETCH NEXT FROM cClass2 INTO @ClassId;
END
CLOSE cClass2;
DEALLOCATE cClass2;
PRINT N'  ✓ שויכו ' + CAST(@assignedMechanech AS NVARCHAR(10)) + N' מחנכי כיתה';

PRINT N'';
PRINT N'=== סיכום סופי ===';

DECLARE @cClasses INT = (SELECT COUNT(*) FROM Class WHERE ConfigurationId = @ConfigurationId);
DECLARE @cAssigns INT = (SELECT COUNT(*) FROM ClassTeacher WHERE ConfigurationId = @ConfigurationId);
DECLARE @totalHours INT = (SELECT SUM(Hour) FROM ClassTeacher WHERE ConfigurationId = @ConfigurationId);
DECLARE @schoolHours INT = (SELECT COUNT(*) FROM SchoolHours WHERE ConfigurationId = @ConfigurationId);

PRINT N'  כיתות:           ' + CAST(@cClasses AS NVARCHAR(10));
PRINT N'  ClassTeacher:    ' + CAST(@cAssigns AS NVARCHAR(10));
PRINT N'  סך שעות מבוקשות: ' + CAST(@totalHours AS NVARCHAR(10));
PRINT N'  שעות בית ספר:    ' + CAST(@schoolHours AS NVARCHAR(10));
PRINT N'';

PRINT N'-- שעות לפי שכבה (מתוך 51 ליום, נשאר להקבצה):';
SELECT
    CASE c.LayerId
        WHEN 1 THEN N'א'''
        WHEN 2 THEN N'ב'''
        WHEN 3 THEN N'ג'''
        WHEN 4 THEN N'ד'''
        WHEN 5 THEN N'ה'''
        WHEN 6 THEN N'ו'''
    END AS [שכבה],
    COUNT(DISTINCT c.ClassId) AS [כיתות],
    SUM(ISNULL(ct.Hour, 0)) AS [סך_שעות],
    SUM(ISNULL(ct.Hour, 0)) / COUNT(DISTINCT c.ClassId) AS [שעות_לכיתה_בממוצע],
    51 - (SUM(ISNULL(ct.Hour, 0)) / COUNT(DISTINCT c.ClassId)) AS [פנוי_להקבצה]
FROM Class c
LEFT JOIN ClassTeacher ct ON ct.ClassId = c.ClassId
WHERE c.ConfigurationId = @ConfigurationId
GROUP BY c.LayerId
ORDER BY c.LayerId;
GO
