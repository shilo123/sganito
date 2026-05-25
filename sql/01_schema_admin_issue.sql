/* =============================================================
   סגנית - הוספת תשתית לאדמין, דיווח תקלות, ו-onboarding
   קובץ זה idempotent - ניתן להרצה חוזרת
   ============================================================= */

USE Sganit;
GO

PRINT N'-- שלב 1: הוספת עמודות חסרות לטבלת Users';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'IsFirstLogin')
BEGIN
    ALTER TABLE Users ADD IsFirstLogin BIT NOT NULL DEFAULT 1;
    PRINT N'  ✓ נוספה עמודה: IsFirstLogin';
END
ELSE PRINT N'  - IsFirstLogin כבר קיים';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Email')
BEGIN
    ALTER TABLE Users ADD Email NVARCHAR(100) NULL;
    PRINT N'  ✓ נוספה עמודה: Email';
END
ELSE PRINT N'  - Email כבר קיים';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'CreatedAt')
BEGIN
    ALTER TABLE Users ADD CreatedAt DATETIME NOT NULL DEFAULT GETDATE();
    PRINT N'  ✓ נוספה עמודה: CreatedAt';
END
ELSE PRINT N'  - CreatedAt כבר קיים';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'OnboardingStep')
BEGIN
    ALTER TABLE Users ADD OnboardingStep TINYINT NOT NULL DEFAULT 0;
    PRINT N'  ✓ נוספה עמודה: OnboardingStep (מעקב אחר שלב נוכחי באשף)';
END
ELSE PRINT N'  - OnboardingStep כבר קיים';

GO

PRINT N'-- שלב 2: יצירת טבלת Admin (אדמינים של המערכת)';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Admin')
BEGIN
    CREATE TABLE [dbo].[Admin] (
        AdminId       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserName      NVARCHAR(50)  NOT NULL UNIQUE,
        PasswordHash  NVARCHAR(200) NOT NULL,  -- SHA256 hex (64 chars) + ':' + salt(32 chars)
        FullName      NVARCHAR(100) NOT NULL,
        Email         NVARCHAR(100) NULL,
        Active        BIT NOT NULL DEFAULT 1,
        CreatedAt     DATETIME NOT NULL DEFAULT GETDATE(),
        LastLoginAt   DATETIME NULL
    );
    PRINT N'  ✓ נוצרה טבלת Admin';
END
ELSE PRINT N'  - טבלת Admin כבר קיימת';

GO

PRINT N'-- שלב 3: יצירת טבלת Issue (תקלות שמשתמשים מדווחים)';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Issue')
BEGIN
    CREATE TABLE [dbo].[Issue] (
        IssueId        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ConfigurationId INT NOT NULL,
        SchoolId       INT NOT NULL,
        UserId         INT NOT NULL,
        Category       NVARCHAR(50) NOT NULL DEFAULT N'כללי', -- כללי / באג / הצעה / שאלה
        Priority       NVARCHAR(20) NOT NULL DEFAULT N'רגיל',  -- נמוך / רגיל / גבוה / דחוף
        Title          NVARCHAR(200) NOT NULL,
        Description    NVARCHAR(MAX) NOT NULL,
        Status         NVARCHAR(20)  NOT NULL DEFAULT N'פתוח', -- פתוח / בטיפול / טופל / נסגר
        CreatedAt      DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt      DATETIME NOT NULL DEFAULT GETDATE(),
        AdminResponse  NVARCHAR(MAX) NULL,
        RespondedAt    DATETIME NULL,
        RespondedByAdminId INT NULL
    );

    CREATE INDEX IX_Issue_ConfigurationId ON [dbo].[Issue](ConfigurationId);
    CREATE INDEX IX_Issue_SchoolId        ON [dbo].[Issue](SchoolId);
    CREATE INDEX IX_Issue_Status          ON [dbo].[Issue](Status);
    CREATE INDEX IX_Issue_CreatedAt       ON [dbo].[Issue](CreatedAt DESC);

    PRINT N'  ✓ נוצרה טבלת Issue (כולל אינדקסים)';
END
ELSE PRINT N'  - טבלת Issue כבר קיימת';

GO

PRINT N'-- סיכום סופי';

DECLARE @cAdminCols INT = (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('Users')
                            AND name IN ('IsFirstLogin','Email','CreatedAt','OnboardingStep'));
DECLARE @cAdminTbl  INT = (SELECT COUNT(*) FROM sys.tables WHERE name='Admin');
DECLARE @cIssueTbl  INT = (SELECT COUNT(*) FROM sys.tables WHERE name='Issue');

PRINT N'  Users new columns:        ' + CAST(@cAdminCols AS NVARCHAR(10)) + N'/4';
PRINT N'  Admin table exists:        ' + CAST(@cAdminTbl  AS NVARCHAR(10)) + N'/1';
PRINT N'  Issue table exists:        ' + CAST(@cIssueTbl  AS NVARCHAR(10)) + N'/1';
PRINT N'';
PRINT N'✓ סכמת DB הוקמה בהצלחה';
GO
