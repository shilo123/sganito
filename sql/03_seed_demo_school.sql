/* =============================================================
   סגנית - הזרקת נתוני דמו לבית ספר "בית ספר דמו"
   הסקריפט מזהה את ה-Configuration של המשתמש demo ומזריק
   מקצועות, מורים, וכיתות לדוגמה.
   idempotent - אם הנתונים כבר קיימים, לא כופלים.
   ============================================================= */

USE Sganit;
GO

DECLARE @ConfigurationId INT, @SchoolId INT, @UserId INT;
SELECT @UserId = UserId, @SchoolId = SchoolId FROM Users WHERE UserName = 'demo';
SELECT TOP 1 @ConfigurationId = ConfigurationId FROM Configuration WHERE SchoolId = @SchoolId ORDER BY ConfigurationId DESC;

IF @ConfigurationId IS NULL
BEGIN
    PRINT N'⚠ לא נמצא Configuration עבור משתמש demo. עצירה.';
    RETURN;
END

PRINT N'-- מזריק נתונים ל-ConfigurationId=' + CAST(@ConfigurationId AS NVARCHAR(10));

/* ============ מקצועות (Professional) ============ */
PRINT N'-- מקצועות:';

DECLARE @subjects TABLE (Name NVARCHAR(50), IsTwoHour BIT);
INSERT INTO @subjects (Name, IsTwoHour) VALUES
    (N'מתמטיקה',     0),
    (N'עברית',       0),
    (N'אנגלית',      0),
    (N'מדעים',       0),
    (N'תורה',        0),
    (N'היסטוריה',    0),
    (N'גיאוגרפיה',   0),
    (N'חינוך גופני', 0),
    (N'אומנות',      1),
    (N'מוסיקה',      0),
    (N'מלאכה',       1),
    (N'מחשבים',      0);

INSERT INTO Professional (ConfigurationId, Name, IsTwoHour)
SELECT @ConfigurationId, s.Name, s.IsTwoHour
FROM @subjects s
WHERE NOT EXISTS (SELECT 1 FROM Professional p
                  WHERE p.ConfigurationId = @ConfigurationId AND p.Name = s.Name);

PRINT N'  ✓ ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' מקצועות נוספו';

/* ============ מורים (Teacher) ============ */
PRINT N'-- מורים:';

DECLARE @teachers TABLE (FirstName NVARCHAR(50), LastName NVARCHAR(50), SubjectName NVARCHAR(50), Frontaly INT, FreeDay INT);
INSERT INTO @teachers (FirstName, LastName, SubjectName, Frontaly, FreeDay) VALUES
    (N'שרה',    N'כהן',     N'מתמטיקה',     24, 5),
    (N'דוד',    N'לוי',      N'מתמטיקה',     22, 3),
    (N'רחל',    N'מזרחי',   N'עברית',        24, 2),
    (N'יעקב',   N'אברהם',   N'עברית',        20, 4),
    (N'מרים',   N'גולדמן',  N'אנגלית',       22, 5),
    (N'אבי',    N'שמיר',    N'מדעים',        20, 1),
    (N'דנה',    N'ברק',     N'תורה',         18, 5),
    (N'יוסי',   N'אורן',    N'היסטוריה',     16, 3),
    (N'תמר',    N'פרץ',     N'חינוך גופני',  20, 4),
    (N'נועה',   N'הראל',    N'אומנות',       12, 2),
    (N'אורן',   N'יצחק',    N'מוסיקה',       14, 5),
    (N'גלית',   N'נחמיאס',  N'מחשבים',       16, 3);

INSERT INTO Teacher (ConfigurationId, FirstName, LastName, ProfessionalId, Frontaly, FreeDay, Shehya, Partani, TafkidId)
SELECT @ConfigurationId, t.FirstName, t.LastName,
       (SELECT TOP 1 ProfessionalId FROM Professional p WHERE p.ConfigurationId = @ConfigurationId AND p.Name = t.SubjectName),
       t.Frontaly, t.FreeDay, 4, 2, 1
FROM @teachers t
WHERE NOT EXISTS (SELECT 1 FROM Teacher tt
                  WHERE tt.ConfigurationId = @ConfigurationId AND tt.FirstName = t.FirstName AND tt.LastName = t.LastName);

PRINT N'  ✓ ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' מורים נוספו';

/* ============ כיתות (Class) ============ */
PRINT N'-- כיתות:';

DECLARE @classes TABLE (Name NVARCHAR(50), LayerId TINYINT, Seq TINYINT);
INSERT INTO @classes (Name, LayerId, Seq) VALUES
    (N'א''1', 1, 1), (N'א''2', 1, 2), (N'א''3', 1, 3),
    (N'ב''1', 2, 1), (N'ב''2', 2, 2), (N'ב''3', 2, 3),
    (N'ג''1', 3, 1), (N'ג''2', 3, 2),
    (N'ד''1', 4, 1), (N'ד''2', 4, 2),
    (N'ה''1', 5, 1), (N'ה''2', 5, 2),
    (N'ו''1', 6, 1), (N'ו''2', 6, 2);

INSERT INTO Class (Name, ConfigurationId, LayerId, Seq)
SELECT c.Name, @ConfigurationId, c.LayerId, c.Seq
FROM @classes c
WHERE NOT EXISTS (SELECT 1 FROM Class cc
                  WHERE cc.ConfigurationId = @ConfigurationId AND cc.Name = c.Name);

PRINT N'  ✓ ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' כיתות נוספו';

/* ============ סימון: המשתמש כבר עבר onboarding ============ */
UPDATE Users SET IsFirstLogin = 0 WHERE UserId = @UserId;
PRINT N'  ✓ משתמש demo סומן כלא-ראשון (לא יראה את האשף)';

/* ============ סיכום ============ */
PRINT N'';
PRINT N'=== נתוני בית ספר דמו ===';
DECLARE @c1 INT = (SELECT COUNT(*) FROM Professional WHERE ConfigurationId = @ConfigurationId);
DECLARE @c2 INT = (SELECT COUNT(*) FROM Teacher WHERE ConfigurationId = @ConfigurationId);
DECLARE @c3 INT = (SELECT COUNT(*) FROM Class WHERE ConfigurationId = @ConfigurationId);
DECLARE @c4 INT = (SELECT COUNT(*) FROM SchoolHours WHERE ConfigurationId = @ConfigurationId);
PRINT N'  מקצועות: ' + CAST(@c1 AS NVARCHAR(10));
PRINT N'  מורים:   ' + CAST(@c2 AS NVARCHAR(10));
PRINT N'  כיתות:  ' + CAST(@c3 AS NVARCHAR(10));
PRINT N'  שעות:   ' + CAST(@c4 AS NVARCHAR(10));
PRINT N'';
PRINT N'✓ בית הספר הדמו מוכן לשימוש. כניסה: demo / demo123';
GO
