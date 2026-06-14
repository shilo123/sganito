/* =============================================================
   סגנית - תשתית לפניות יצירת קשר מדף הנחיתה (Contact leads)
   קובץ זה idempotent - ניתן להרצה חוזרת
   ============================================================= */

USE Sganit;
GO

PRINT N'-- שלב 1: יצירת טבלת Contact (פניות מדף הנחיתה)';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Contact')
BEGIN
    CREATE TABLE [dbo].[Contact] (
        ContactId   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        FullName    NVARCHAR(120)  NOT NULL,
        Phone       NVARCHAR(40)   NULL,
        Email       NVARCHAR(120)  NULL,
        SchoolName  NVARCHAR(150)  NULL,
        Message     NVARCHAR(MAX)  NULL,
        Status      NVARCHAR(20)   NOT NULL DEFAULT N'חדש',  -- חדש / בטיפול / טופל
        IpAddress   NVARCHAR(60)   NULL,
        UserAgent   NVARCHAR(400)  NULL,
        CreatedAt   DATETIME NOT NULL DEFAULT GETDATE(),
        HandledAt   DATETIME NULL,
        AdminNote   NVARCHAR(MAX)  NULL
    );

    CREATE INDEX IX_Contact_Status    ON [dbo].[Contact](Status);
    CREATE INDEX IX_Contact_CreatedAt ON [dbo].[Contact](CreatedAt DESC);

    PRINT N'  ✓ נוצרה טבלת Contact (כולל אינדקסים)';
END
ELSE PRINT N'  - טבלת Contact כבר קיימת';
GO

/* ==================== Contact_Insert (ציבורי - מדף הנחיתה) ==================== */
IF OBJECT_ID('dbo.Contact_Insert','P') IS NOT NULL DROP PROCEDURE dbo.Contact_Insert;
GO
CREATE PROCEDURE [dbo].[Contact_Insert]
    @FullName   NVARCHAR(120),
    @Phone      NVARCHAR(40)  = NULL,
    @Email      NVARCHAR(120) = NULL,
    @SchoolName NVARCHAR(150) = NULL,
    @Message    NVARCHAR(MAX) = NULL,
    @IpAddress  NVARCHAR(60)  = NULL,
    @UserAgent  NVARCHAR(400) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO Contact (FullName, Phone, Email, SchoolName, Message, Status, IpAddress, UserAgent, CreatedAt)
    VALUES (@FullName,
            NULLIF(LTRIM(RTRIM(@Phone)), N''),
            NULLIF(LTRIM(RTRIM(@Email)), N''),
            NULLIF(LTRIM(RTRIM(@SchoolName)), N''),
            NULLIF(LTRIM(RTRIM(@Message)), N''),
            N'חדש', @IpAddress, @UserAgent, GETDATE());

    SELECT SCOPE_IDENTITY() AS ContactId;
END
GO

/* ==================== Admin_GetContacts (אדמין רואה את כל הפניות) ==================== */
IF OBJECT_ID('dbo.Admin_GetContacts','P') IS NOT NULL DROP PROCEDURE dbo.Admin_GetContacts;
GO
CREATE PROCEDURE [dbo].[Admin_GetContacts]
    @StatusFilter NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        ContactId, FullName, Phone, Email, SchoolName, Message,
        Status, CreatedAt, HandledAt, AdminNote
    FROM Contact
    WHERE (@StatusFilter IS NULL OR @StatusFilter = N'' OR Status = @StatusFilter)
    ORDER BY
        CASE Status
            WHEN N'חדש'  THEN 1
            WHEN N'בטיפול' THEN 2
            WHEN N'טופל'  THEN 3
            ELSE 4
        END,
        CreatedAt DESC;
END
GO

/* ==================== Admin_UpdateContactStatus ==================== */
IF OBJECT_ID('dbo.Admin_UpdateContactStatus','P') IS NOT NULL DROP PROCEDURE dbo.Admin_UpdateContactStatus;
GO
CREATE PROCEDURE [dbo].[Admin_UpdateContactStatus]
    @ContactId INT,
    @Status    NVARCHAR(20),
    @AdminNote NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Contact
    SET Status   = @Status,
        AdminNote = COALESCE(@AdminNote, AdminNote),
        HandledAt = CASE WHEN @Status IN (N'בטיפול', N'טופל') AND HandledAt IS NULL THEN GETDATE() ELSE HandledAt END
    WHERE ContactId = @ContactId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

PRINT N'✓ תשתית פניות קשר (Contact) הוקמה בהצלחה';
GO
