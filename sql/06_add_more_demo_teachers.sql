/* =============================================================
   סגנית - הוספת מורים נוספים לבית הספר הדמו
   מעלה את כמות המורים מ-12 ל-28 (כיסוי טוב לכל המקצועות)
   ============================================================= */

USE Sganit;
GO

DECLARE @ConfigurationId INT, @SchoolId INT;
SELECT @SchoolId = SchoolId FROM Users WHERE UserName = 'demo';
SELECT TOP 1 @ConfigurationId = ConfigurationId FROM Configuration
WHERE SchoolId = @SchoolId ORDER BY ConfigurationId DESC;

IF @ConfigurationId IS NULL
BEGIN
    PRINT N'⚠ לא נמצא Configuration עבור משתמש demo. עצירה.';
    RETURN;
END

PRINT N'-- מוסיף מורים ל-ConfigurationId=' + CAST(@ConfigurationId AS NVARCHAR(10));

DECLARE @teachers TABLE (
    FirstName NVARCHAR(50),
    LastName  NVARCHAR(50),
    SubjectName NVARCHAR(50),
    Frontaly INT,
    FreeDay INT,
    Shehya INT,
    Partani INT
);

INSERT INTO @teachers VALUES
    (N'אילנה',   N'בן-דוד',   N'מתמטיקה',     22, 2, 4, 2),
    (N'מיכאל',   N'רוזנברג',  N'מתמטיקה',     20, 4, 4, 2),
    (N'אסתר',    N'אזולאי',   N'עברית',        24, 3, 4, 2),
    (N'שרון',    N'דהן',      N'עברית',        22, 1, 4, 2),
    (N'רונית',   N'שמשון',    N'אנגלית',       20, 2, 4, 2),
    (N'עירית',   N'מזור',     N'אנגלית',       18, 4, 4, 2),
    (N'בני',     N'גרינברג',  N'מדעים',        22, 3, 4, 2),
    (N'יואב',    N'אלימלך',   N'תורה',         20, 5, 4, 2),
    (N'אורית',   N'פרידמן',   N'תורה',         18, 1, 4, 2),
    (N'חנה',     N'קליין',    N'היסטוריה',     16, 2, 4, 2),
    (N'גיא',     N'בכר',      N'חינוך גופני',  22, 5, 4, 2),
    (N'איריס',   N'שטרן',     N'אומנות',       12, 3, 4, 2),
    (N'משה',     N'נחום',     N'גיאוגרפיה',    18, 4, 4, 2),
    (N'יעל',     N'אביב',     N'גיאוגרפיה',    14, 2, 4, 2),
    (N'נטע',     N'אדרי',     N'מלאכה',        16, 1, 4, 2),
    (N'אורי',    N'פינטו',    N'מלאכה',        14, 5, 4, 2);

INSERT INTO Teacher
    (ConfigurationId, FirstName, LastName, ProfessionalId,
     Frontaly, FreeDay, Shehya, Partani, TafkidId)
SELECT
    @ConfigurationId, t.FirstName, t.LastName,
    (SELECT TOP 1 ProfessionalId FROM Professional p
     WHERE p.ConfigurationId = @ConfigurationId AND p.Name = t.SubjectName),
    t.Frontaly, t.FreeDay, t.Shehya, t.Partani, 1
FROM @teachers t
WHERE NOT EXISTS (
    SELECT 1 FROM Teacher tt
    WHERE tt.ConfigurationId = @ConfigurationId
      AND tt.FirstName = t.FirstName
      AND tt.LastName  = t.LastName
);

DECLARE @added INT = @@ROWCOUNT;
PRINT N'  ✓ נוספו ' + CAST(@added AS NVARCHAR(10)) + N' מורים חדשים';

/* סיכום */
DECLARE @total INT = (SELECT COUNT(*) FROM Teacher WHERE ConfigurationId = @ConfigurationId);
PRINT N'';
PRINT N'=== סיכום מורים בבית הספר הדמו ===';
PRINT N'  סה"כ מורים: ' + CAST(@total AS NVARCHAR(10));

/* פיזור לפי מקצוע */
PRINT N'';
PRINT N'-- פיזור לפי מקצוע:';
SELECT
    p.Name AS [מקצוע],
    COUNT(t.TeacherId) AS [מספר_מורים]
FROM Professional p
LEFT JOIN Teacher t ON t.ProfessionalId = p.ProfessionalId
                    AND t.ConfigurationId = @ConfigurationId
WHERE p.ConfigurationId = @ConfigurationId
GROUP BY p.Name
ORDER BY COUNT(t.TeacherId) DESC, p.Name;
GO
