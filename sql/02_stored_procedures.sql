/* =============================================================
   סגנית - Stored Procedures לאדמין, תקלות, ו-onboarding
   הערות אבטחה:
   - סיסמת אדמין: SHA256 hash + salt. הלקוח שולח hex(SHA256(password + ':' + salt))
     ובפעם הראשונה (ב-SP יצירה) השרת מייצר salt ומחשב hash בעצמו.
   - כאן אני שומר salt ו-hash בעמודת PasswordHash בפורמט: hash:salt
   - סיסמת משתמש בית-ספר נשמרת בפלין-טקסט כדי לשמור על תאימות עם המודל הקיים.
   ============================================================= */

USE Sganit;
GO

/* ==================== Admin_Login ==================== */
IF OBJECT_ID('dbo.Admin_Login','P') IS NOT NULL DROP PROCEDURE dbo.Admin_Login;
GO
CREATE PROCEDURE [dbo].[Admin_Login]
    @UserName NVARCHAR(50),
    @Password NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @AdminId INT, @StoredHash NVARCHAR(200), @Salt NVARCHAR(50), @FullName NVARCHAR(100), @Email NVARCHAR(100);

    SELECT @AdminId = AdminId, @StoredHash = PasswordHash, @FullName = FullName, @Email = Email
    FROM [dbo].[Admin]
    WHERE UserName = @UserName AND Active = 1;

    IF @AdminId IS NULL
    BEGIN
        SELECT TOP 0 0 AS AdminId, '' AS FullName, '' AS Email, '' AS UserName;
        RETURN;
    END

    -- פיצול hash:salt
    DECLARE @sep INT = CHARINDEX(':', @StoredHash);
    DECLARE @hash NVARCHAR(100) = LEFT(@StoredHash, @sep - 1);
    SET @Salt = SUBSTRING(@StoredHash, @sep + 1, 100);

    -- חישוב hash על הסיסמה הנכנסת + salt
    DECLARE @computed NVARCHAR(100) =
        LOWER(CONVERT(NVARCHAR(100), HASHBYTES('SHA2_256', @Password + ':' + @Salt), 2));

    IF @computed = LOWER(@hash)
    BEGIN
        UPDATE [dbo].[Admin] SET LastLoginAt = GETDATE() WHERE AdminId = @AdminId;
        SELECT @AdminId AS AdminId, @FullName AS FullName, ISNULL(@Email,'') AS Email, @UserName AS UserName;
    END
    ELSE
    BEGIN
        SELECT TOP 0 0 AS AdminId, '' AS FullName, '' AS Email, '' AS UserName;
    END
END
GO

/* ==================== Admin_Create (יצירת אדמין חדש - לשימוש פנימי / seed) ==================== */
IF OBJECT_ID('dbo.Admin_Create','P') IS NOT NULL DROP PROCEDURE dbo.Admin_Create;
GO
CREATE PROCEDURE [dbo].[Admin_Create]
    @UserName NVARCHAR(50),
    @Password NVARCHAR(200),
    @FullName NVARCHAR(100),
    @Email    NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Salt NVARCHAR(32) =
        REPLACE(CONVERT(NVARCHAR(36), NEWID()), '-', '');
    DECLARE @hash NVARCHAR(100) =
        LOWER(CONVERT(NVARCHAR(100), HASHBYTES('SHA2_256', @Password + ':' + @Salt), 2));
    DECLARE @stored NVARCHAR(200) = @hash + ':' + @Salt;

    IF EXISTS (SELECT 1 FROM [dbo].[Admin] WHERE UserName = @UserName)
    BEGIN
        UPDATE [dbo].[Admin] SET PasswordHash = @stored, FullName = @FullName, Email = @Email
        WHERE UserName = @UserName;
        SELECT AdminId FROM [dbo].[Admin] WHERE UserName = @UserName;
    END
    ELSE
    BEGIN
        INSERT INTO [dbo].[Admin] (UserName, PasswordHash, FullName, Email, Active)
        VALUES (@UserName, @stored, @FullName, @Email, 1);
        SELECT SCOPE_IDENTITY() AS AdminId;
    END
END
GO

/* ==================== Admin_GetSchoolsDashboard ==================== */
IF OBJECT_ID('dbo.Admin_GetSchoolsDashboard','P') IS NOT NULL DROP PROCEDURE dbo.Admin_GetSchoolsDashboard;
GO
CREATE PROCEDURE [dbo].[Admin_GetSchoolsDashboard]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        s.SchoolId,
        s.Name AS SchoolName,
        -- מספר משתמשים פעילים
        (SELECT COUNT(*) FROM Users u WHERE u.SchoolId = s.SchoolId AND u.Active = 1) AS UsersCount,
        -- מספר configurations
        (SELECT COUNT(*) FROM Configuration c WHERE c.SchoolId = s.SchoolId) AS ConfigsCount,
        -- מספר מורים (סך הכל בכל ה-Configurations של בית הספר)
        (SELECT COUNT(*) FROM Teacher t
            INNER JOIN Configuration c ON c.ConfigurationId = t.ConfigurationId
            WHERE c.SchoolId = s.SchoolId) AS TeachersCount,
        -- מספר כיתות
        (SELECT COUNT(*) FROM Class cl
            INNER JOIN Configuration c ON c.ConfigurationId = cl.ConfigurationId
            WHERE c.SchoolId = s.SchoolId) AS ClassesCount,
        -- מספר תקלות פתוחות
        (SELECT COUNT(*) FROM Issue i WHERE i.SchoolId = s.SchoolId AND i.Status IN (N'פתוח', N'בטיפול')) AS OpenIssuesCount,
        -- תאריך כניסה אחרון של משתמש כלשהו (אם תהיה עמודה כזאת בעתיד)
        (SELECT MAX(u.CreatedAt) FROM Users u WHERE u.SchoolId = s.SchoolId) AS LastUserCreatedAt
    FROM School s
    ORDER BY s.SchoolId;
END
GO

/* ==================== Admin_AddSchool ==================== */
IF OBJECT_ID('dbo.Admin_AddSchool','P') IS NOT NULL DROP PROCEDURE dbo.Admin_AddSchool;
GO
CREATE PROCEDURE [dbo].[Admin_AddSchool]
    @SchoolName  NVARCHAR(50),
    @UserName    NVARCHAR(50),
    @Password    NVARCHAR(50),
    @AdminFirstName NVARCHAR(50),
    @AdminLastName  NVARCHAR(50),
    @Email       NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- בדיקה: שם משתמש לא תפוס
        IF EXISTS (SELECT 1 FROM Users WHERE UserName = @UserName)
        BEGIN
            ROLLBACK;
            SELECT 0 AS Success, N'שם המשתמש כבר קיים במערכת' AS [Message], 0 AS SchoolId, 0 AS UserId;
            RETURN;
        END

        -- 1. הוספת בית ספר
        INSERT INTO School (Name) VALUES (@SchoolName);
        DECLARE @SchoolId INT = SCOPE_IDENTITY();

        -- 2. הוספת Configuration עם השנה הנוכחית (או יצירת שנה חדשה אם לא קיימת)
        DECLARE @YearId INT;
        SELECT TOP 1 @YearId = YearId FROM Year
        WHERE GETDATE() BETWEEN StartDate AND EndDate
        ORDER BY YearId DESC;

        IF @YearId IS NULL
        BEGIN
            DECLARE @YearNum INT = YEAR(GETDATE());
            -- ייצור Id שמתאים (משתמשים ב-YearId שלא קיים)
            SET @YearId = @YearNum;
            IF NOT EXISTS (SELECT 1 FROM Year WHERE YearId = @YearId)
                INSERT INTO Year (YearId, Name, StartDate, EndDate)
                VALUES (@YearId, CAST(@YearNum AS NVARCHAR(10)),
                        DATEFROMPARTS(@YearNum, 1, 1),
                        DATEFROMPARTS(@YearNum, 12, 31));
        END

        INSERT INTO Configuration (SchoolId, YearId, MaxHourInShibutz, MinForPitzul, MinTeacherInmor)
        VALUES (@SchoolId, @YearId, 9, 2, 1);
        DECLARE @ConfigurationId INT = SCOPE_IDENTITY();

        -- 3. הוספת משתמש (RoleId=1 = סגן מנהל)
        INSERT INTO Users (FirstName, LastName, RoleId, UserName, Password, SchoolId, Active, Email, IsFirstLogin, CreatedAt, OnboardingStep)
        VALUES (@AdminFirstName, @AdminLastName, 1, @UserName, @Password, @SchoolId, 1, @Email, 1, GETDATE(), 0);
        DECLARE @UserId INT = SCOPE_IDENTITY();

        -- 4. יצירת SchoolHours בסיסיים (6 ימים × 9 שעות = 54 רשומות פעילות)
        -- HourId encoding: DayNum * 10 + HourInDay (1..9)
        DECLARE @d INT = 1, @h INT;
        WHILE @d <= 6
        BEGIN
            SET @h = 1;
            WHILE @h <= 9
            BEGIN
                -- יום שישי (d=6) - רק 6 שעות
                IF NOT (@d = 6 AND @h > 6)
                BEGIN
                    INSERT INTO SchoolHours (HourId, ConfigurationId, IsOnlyShehya)
                    VALUES (@d * 10 + @h, @ConfigurationId, 0);
                END
                SET @h = @h + 1;
            END
            SET @d = @d + 1;
        END

        COMMIT TRANSACTION;

        SELECT
            1 AS Success,
            N'בית הספר נוצר בהצלחה' AS [Message],
            @SchoolId AS SchoolId,
            @UserId AS UserId,
            @ConfigurationId AS ConfigurationId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 0 AS Success,
               ERROR_MESSAGE() AS [Message],
               0 AS SchoolId, 0 AS UserId;
    END CATCH
END
GO

/* ==================== Admin_DeleteSchool ==================== */
IF OBJECT_ID('dbo.Admin_DeleteSchool','P') IS NOT NULL DROP PROCEDURE dbo.Admin_DeleteSchool;
GO
CREATE PROCEDURE [dbo].[Admin_DeleteSchool]
    @SchoolId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @configs TABLE (ConfigurationId INT);
        INSERT INTO @configs SELECT ConfigurationId FROM Configuration WHERE SchoolId = @SchoolId;

        -- מחיקת נתונים מקושרים לכל ה-Configurations של בית הספר
        DELETE FROM TeacherAssignment WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs);
        DELETE FROM TeacherHours      WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs);
        DELETE FROM ClassTeacher      WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs);
        DELETE FROM HakbatzaClass     WHERE HakbatzaId IN (SELECT HakbatzaId FROM Hakbatza WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs));
        DELETE FROM HakbatzaTeacher   WHERE HakbatzaId IN (SELECT HakbatzaId FROM Hakbatza WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs));
        DELETE FROM Hakbatza          WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs);
        DELETE FROM ShehyaGroup       WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs);
        DELETE FROM TeacherTiyuv      WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs);
        DELETE FROM Teacher           WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs);
        DELETE FROM Class             WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs);
        DELETE FROM Professional      WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs);
        DELETE FROM SchoolHours       WHERE ConfigurationId IN (SELECT ConfigurationId FROM @configs);
        DELETE FROM Issue             WHERE SchoolId = @SchoolId;
        DELETE FROM Configuration     WHERE SchoolId = @SchoolId;
        DELETE FROM Users             WHERE SchoolId = @SchoolId;
        DELETE FROM School            WHERE SchoolId = @SchoolId;

        COMMIT;
        SELECT 1 AS Success, N'בית הספר נמחק' AS [Message];
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        SELECT 0 AS Success, ERROR_MESSAGE() AS [Message];
    END CATCH
END
GO

/* ==================== Issue_Insert ==================== */
IF OBJECT_ID('dbo.Issue_Insert','P') IS NOT NULL DROP PROCEDURE dbo.Issue_Insert;
GO
CREATE PROCEDURE [dbo].[Issue_Insert]
    @ConfigurationId INT,
    @SchoolId        INT,
    @UserId          INT,
    @Category        NVARCHAR(50),
    @Priority        NVARCHAR(20),
    @Title           NVARCHAR(200),
    @Description     NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO Issue (ConfigurationId, SchoolId, UserId, Category, Priority, Title, Description, Status, CreatedAt, UpdatedAt)
    VALUES (@ConfigurationId, @SchoolId, @UserId, @Category, @Priority, @Title, @Description, N'פתוח', GETDATE(), GETDATE());

    SELECT SCOPE_IDENTITY() AS IssueId;
END
GO

/* ==================== Issue_GetMine (משתמש רואה את התקלות שלו) ==================== */
IF OBJECT_ID('dbo.Issue_GetMine','P') IS NOT NULL DROP PROCEDURE dbo.Issue_GetMine;
GO
CREATE PROCEDURE [dbo].[Issue_GetMine]
    @SchoolId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        i.IssueId, i.Category, i.Priority, i.Title, i.Description,
        i.Status, i.CreatedAt, i.UpdatedAt,
        i.AdminResponse, i.RespondedAt,
        a.FullName AS AdminFullName
    FROM Issue i
    LEFT JOIN [dbo].[Admin] a ON a.AdminId = i.RespondedByAdminId
    WHERE i.SchoolId = @SchoolId
    ORDER BY i.CreatedAt DESC;
END
GO

/* ==================== Admin_GetIssues (אדמין רואה את כל התקלות) ==================== */
IF OBJECT_ID('dbo.Admin_GetIssues','P') IS NOT NULL DROP PROCEDURE dbo.Admin_GetIssues;
GO
CREATE PROCEDURE [dbo].[Admin_GetIssues]
    @StatusFilter NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        i.IssueId, i.Category, i.Priority, i.Title, i.Description,
        i.Status, i.CreatedAt, i.UpdatedAt,
        i.AdminResponse, i.RespondedAt,
        i.SchoolId, s.Name AS SchoolName,
        i.UserId, (u.FirstName + N' ' + u.LastName) AS UserFullName, u.UserName,
        a.FullName AS AdminFullName
    FROM Issue i
    INNER JOIN School s ON s.SchoolId = i.SchoolId
    INNER JOIN Users  u ON u.UserId   = i.UserId
    LEFT  JOIN [dbo].[Admin]  a ON a.AdminId  = i.RespondedByAdminId
    WHERE (@StatusFilter IS NULL OR @StatusFilter = N'' OR i.Status = @StatusFilter)
    ORDER BY
        CASE i.Status
            WHEN N'פתוח'  THEN 1
            WHEN N'בטיפול' THEN 2
            WHEN N'טופל'  THEN 3
            ELSE 4
        END,
        i.CreatedAt DESC;
END
GO

/* ==================== Admin_RespondIssue ==================== */
IF OBJECT_ID('dbo.Admin_RespondIssue','P') IS NOT NULL DROP PROCEDURE dbo.Admin_RespondIssue;
GO
CREATE PROCEDURE [dbo].[Admin_RespondIssue]
    @IssueId      INT,
    @AdminId      INT,
    @Status       NVARCHAR(20),
    @AdminResponse NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Issue
    SET Status = @Status,
        AdminResponse = COALESCE(@AdminResponse, AdminResponse),
        RespondedByAdminId = @AdminId,
        RespondedAt = CASE WHEN @AdminResponse IS NOT NULL THEN GETDATE() ELSE RespondedAt END,
        UpdatedAt = GETDATE()
    WHERE IssueId = @IssueId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

/* ==================== User_SetOnboardingState ==================== */
IF OBJECT_ID('dbo.User_SetOnboardingState','P') IS NOT NULL DROP PROCEDURE dbo.User_SetOnboardingState;
GO
CREATE PROCEDURE [dbo].[User_SetOnboardingState]
    @UserId         INT,
    @IsFirstLogin   BIT,
    @OnboardingStep TINYINT = 0
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Users
    SET IsFirstLogin = @IsFirstLogin,
        OnboardingStep = @OnboardingStep
    WHERE UserId = @UserId;

    SELECT @@ROWCOUNT AS RowsAffected;
END
GO

/* ==================== User_GetOnboardingState ==================== */
IF OBJECT_ID('dbo.User_GetOnboardingState','P') IS NOT NULL DROP PROCEDURE dbo.User_GetOnboardingState;
GO
CREATE PROCEDURE [dbo].[User_GetOnboardingState]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IsFirstLogin, OnboardingStep
    FROM Users
    WHERE UserId = @UserId;
END
GO

PRINT N'✓ כל ה-Stored Procedures נוצרו';
GO
