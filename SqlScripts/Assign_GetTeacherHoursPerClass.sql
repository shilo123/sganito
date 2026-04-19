-- =====================================================
-- Assign_GetTeacherHoursPerClass
-- מחזיר לכל מורה: כיתה, שעות מתוכננות, שעות שובצו
-- הרץ את הסקריפט בבסיס הנתונים
-- =====================================================
IF OBJECT_ID('dbo.Assign_GetTeacherHoursPerClass', 'P') IS NOT NULL
    DROP PROCEDURE dbo.Assign_GetTeacherHoursPerClass;
GO

CREATE PROCEDURE dbo.Assign_GetTeacherHoursPerClass
    @TeacherId INT,
    @ConfigurationId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- שעות מתוכננות: מ-TeacherClass או מטבלה דומה (התאם לשמות הטבלאות שלך)
    -- שעות שובצו: ספירת Assignment עבור TeacherId + ClassId
    -- אם המבנה שונה - שנה את השאילתות

    ;WITH Expected AS (
        -- מקור: TeacherClass, TeacherHours או טבלה עם TeacherId, ClassId, Hours
        -- דוגמה - התאם לטבלאות שלך:
        SELECT 
            tc.TeacherId,
            tc.ClassId,
            c.Name AS ClassName,
            ISNULL(SUM(tch.Hours), tc.Hours) AS ExpectedHours
        FROM TeacherClass tc
        LEFT JOIN TeacherHours tch ON tch.TeacherId = tc.TeacherId AND tch.ClassId = tc.ClassId AND tch.ConfigurationId = @ConfigurationId
        LEFT JOIN Class c ON c.ClassId = tc.ClassId AND c.ConfigurationId = @ConfigurationId
        WHERE tc.TeacherId = @TeacherId AND tc.ConfigurationId = @ConfigurationId
        GROUP BY tc.TeacherId, tc.ClassId, c.Name, tc.Hours
    ),
    Assigned AS (
        SELECT 
            a.TeacherId,
            a.ClassId,
            COUNT(*) AS AssignedHours
        FROM Assignment a
        WHERE a.TeacherId = @TeacherId 
          AND a.ConfigurationId = @ConfigurationId
          AND a.ProfessionalId IS NOT NULL
        GROUP BY a.TeacherId, a.ClassId
    )
    SELECT 
        @TeacherId AS TeacherId,
        (SELECT TOP 1 t.Name FROM Teacher t WHERE t.TeacherId = @TeacherId AND t.ConfigurationId = @ConfigurationId) AS TeacherName,
        ISNULL(e.ClassId, a.ClassId) AS ClassId,
        ISNULL(e.ClassName, (SELECT TOP 1 c.Name FROM Class c WHERE c.ClassId = a.ClassId AND c.ConfigurationId = @ConfigurationId)) AS ClassName,
        ISNULL(e.ExpectedHours, 0) AS ExpectedHours,
        ISNULL(a.AssignedHours, 0) AS AssignedHours
    FROM Expected e
    FULL OUTER JOIN Assigned a ON e.TeacherId = a.TeacherId AND e.ClassId = a.ClassId
    WHERE ISNULL(e.ClassId, a.ClassId) IS NOT NULL
    ORDER BY ClassName;

END
GO
