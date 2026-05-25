/* =============================================================
   סגנית - הרחבה של בית הספר הדמו:
     + מקצועות חדשים (10)
     + מורים מקצועיים חדשים (12) - TafkidId=2
     + עדכון חלק מהמורים הקיימים להיות "מורה מקצועי"
     + סגן מנהל (TafkidId=3)
   ============================================================= */

USE Sganit;
GO

DECLARE @ConfigurationId INT, @SchoolId INT;
SELECT @SchoolId = SchoolId FROM Users WHERE UserName = 'demo';
SELECT TOP 1 @ConfigurationId = ConfigurationId FROM Configuration
WHERE SchoolId = @SchoolId ORDER BY ConfigurationId DESC;

IF @ConfigurationId IS NULL
BEGIN
    PRINT N'⚠ לא נמצא בית ספר דמו. עצירה.';
    RETURN;
END

PRINT N'-- מרחיב בית ספר דמו (ConfigurationId=' + CAST(@ConfigurationId AS NVARCHAR(10)) + N')';

/* ========== שלב 1: מקצועות חדשים ========== */
PRINT N'';
PRINT N'-- שלב 1: הוספת מקצועות חדשים';

DECLARE @newSubjects TABLE (Name NVARCHAR(50), IsTwoHour BIT);
INSERT INTO @newSubjects VALUES
    (N'של"ח',             0),
    (N'מקרא',             0),
    (N'משנה',             0),
    (N'תפילה',            0),
    (N'ספרות',            0),
    (N'ערבית',            0),
    (N'כישורי חיים',      0),
    (N'נחשון',            0),
    (N'ריתמיקה',          0),
    (N'מורשת',            0),
    (N'חינוך מיוחד',      0),
    (N'מתמטיקה מואצת',    0);

INSERT INTO Professional (ConfigurationId, Name, IsTwoHour)
SELECT @ConfigurationId, s.Name, s.IsTwoHour
FROM @newSubjects s
WHERE NOT EXISTS (
    SELECT 1 FROM Professional p
    WHERE p.ConfigurationId = @ConfigurationId AND p.Name = s.Name
);
PRINT N'  ✓ נוספו ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' מקצועות חדשים';

/* ========== שלב 2: עדכון תפקיד למורים קיימים שעוסקים במקצועות אומנותיים/יחודיים ========== */
PRINT N'';
PRINT N'-- שלב 2: עדכון מורים קיימים ל"מורה מקצועי"';

UPDATE t
SET TafkidId = 2 -- מורה מקצועי
FROM Teacher t
INNER JOIN Professional p ON p.ProfessionalId = t.ProfessionalId
WHERE t.ConfigurationId = @ConfigurationId
  AND p.Name IN (N'אומנות', N'מוסיקה', N'מחשבים', N'חינוך גופני',
                 N'מלאכה', N'גיאוגרפיה')
  AND t.TafkidId = 1;
PRINT N'  ✓ עודכנו ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' מורים ל"מורה מקצועי"';

/* ========== שלב 3: מורים מקצועיים חדשים למקצועות החדשים ========== */
PRINT N'';
PRINT N'-- שלב 3: הוספת מורים מקצועיים חדשים';

DECLARE @profTeachers TABLE (
    FirstName NVARCHAR(50),
    LastName  NVARCHAR(50),
    SubjectName NVARCHAR(50),
    Frontaly INT,
    FreeDay INT,
    Tafkid INT
);

INSERT INTO @profTeachers VALUES
    (N'יחזקאל', N'בכר',       N'של"ח',           18, 5, 2),
    (N'רינת',   N'אסולין',    N'של"ח',           14, 3, 2),
    (N'שולמית', N'גרבר',      N'ספרות',          20, 2, 2),
    (N'נחום',   N'דנינו',     N'ספרות',          16, 4, 2),
    (N'סלים',   N'חכים',      N'ערבית',          18, 5, 2),
    (N'אהרון',  N'כספי',      N'מקרא',           22, 1, 2),
    (N'שמואל',  N'שרעבי',     N'משנה',           18, 3, 2),
    (N'לימור',  N'גרינוולד',  N'ריתמיקה',         12, 2, 2),
    (N'סיוון',  N'בארי',      N'כישורי חיים',    16, 4, 2),
    (N'חופית',  N'רוזנברג',   N'חינוך מיוחד',    20, 1, 2),
    (N'יפעת',   N'גלוסר',     N'נחשון',          14, 5, 2),
    (N'רענן',   N'מויאל',     N'מורשת',          16, 2, 2),
    -- מורים מקצועיים נוספים למקצועות הליבה
    (N'דליה',   N'כהן-צמח',   N'אנגלית',         22, 3, 2),
    (N'יונתן',  N'אסף',       N'מתמטיקה',        20, 4, 2),
    (N'הדס',    N'סבן',       N'מתמטיקה מואצת',  18, 2, 2),
    (N'אריאל',  N'בן-עמי',    N'תפילה',          16, 5, 2);

INSERT INTO Teacher
    (ConfigurationId, FirstName, LastName, ProfessionalId,
     Frontaly, FreeDay, Shehya, Partani, TafkidId)
SELECT
    @ConfigurationId, t.FirstName, t.LastName,
    (SELECT TOP 1 ProfessionalId FROM Professional p
     WHERE p.ConfigurationId = @ConfigurationId AND p.Name = t.SubjectName),
    t.Frontaly, t.FreeDay, 4, 2, t.Tafkid
FROM @profTeachers t
WHERE NOT EXISTS (
    SELECT 1 FROM Teacher tt
    WHERE tt.ConfigurationId = @ConfigurationId
      AND tt.FirstName = t.FirstName
      AND tt.LastName  = t.LastName
);
PRINT N'  ✓ נוספו ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' מורים מקצועיים חדשים';

/* ========== שלב 4: סגן מנהל ========== */
PRINT N'';
PRINT N'-- שלב 4: סגן מנהל';

INSERT INTO Teacher
    (ConfigurationId, FirstName, LastName, ProfessionalId,
     Frontaly, FreeDay, Shehya, Partani, TafkidId)
SELECT @ConfigurationId, N'אריה', N'אברג''יל', NULL, 8, 5, 4, 2, 3
WHERE NOT EXISTS (
    SELECT 1 FROM Teacher
    WHERE ConfigurationId = @ConfigurationId
      AND FirstName = N'אריה' AND LastName = N'אברג''יל'
);
PRINT N'  ✓ סגן מנהל ' + CASE WHEN @@ROWCOUNT > 0 THEN N'נוסף' ELSE N'כבר קיים' END;

/* ========== סיכום ========== */
PRINT N'';
PRINT N'=== סיכום אחרי הרחבה ===';

DECLARE @cP INT = (SELECT COUNT(*) FROM Professional WHERE ConfigurationId=@ConfigurationId);
DECLARE @cT INT = (SELECT COUNT(*) FROM Teacher WHERE ConfigurationId=@ConfigurationId);
DECLARE @cC INT = (SELECT COUNT(*) FROM Class WHERE ConfigurationId=@ConfigurationId);
PRINT N'  סה"כ מקצועות:   ' + CAST(@cP AS NVARCHAR(10));
PRINT N'  סה"כ מורים:     ' + CAST(@cT AS NVARCHAR(10));
PRINT N'  סה"כ כיתות:    ' + CAST(@cC AS NVARCHAR(10));

PRINT N'';
PRINT N'-- פיזור לפי תפקיד:';
SELECT
    tk.Name AS [תפקיד],
    COUNT(t.TeacherId) AS [כמה_מורים]
FROM Teacher t
LEFT JOIN Tafkid tk ON tk.TafkidId = t.TafkidId
WHERE t.ConfigurationId = @ConfigurationId
GROUP BY tk.Name
ORDER BY COUNT(t.TeacherId) DESC;

PRINT N'';
PRINT N'-- פיזור לפי מקצוע:';
SELECT
    ISNULL(p.Name, N'(לא מוגדר)') AS [מקצוע],
    COUNT(t.TeacherId) AS [כמה_מורים]
FROM Teacher t
LEFT JOIN Professional p ON p.ProfessionalId = t.ProfessionalId
WHERE t.ConfigurationId = @ConfigurationId
GROUP BY p.Name
ORDER BY COUNT(t.TeacherId) DESC, p.Name;
GO
