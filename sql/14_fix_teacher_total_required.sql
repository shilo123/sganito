-- =====================================================================
-- Teacher_GetTeacherList — תיקון חישוב TotalRequired
-- ----------------------------------------------------------------------
-- הבעיה: TotalRequired חישב SUM(Hour) על ClassTeacher, כך שמורה ששיבץ
-- 4 שעות בהקבצה של 2 כיתות "ראה" 8 שעות (כי יש שורה לכל כיתה).
-- זה לא תואם את `dbo.GetClassCountHour` שמחשב נכון לפי MAX(Hour) per Hakbatza.
--
-- התיקון: TotalRequired = (שעות לא-הקבצה) + (MAX(Hour) per Hakbatza).
-- כך הסכום שמופיע בעמודה "מוקצבות" ב"ניהול מורים" משקף את העומס האמיתי
-- של המורה ולא מנפח אותו על-פי מספר הכיתות בהקבצה.
-- =====================================================================
IF OBJECT_ID('dbo.Teacher_GetTeacherList', 'P') IS NOT NULL
  DROP PROCEDURE dbo.Teacher_GetTeacherList;
GO

CREATE PROCEDURE [dbo].[Teacher_GetTeacherList]
(
 @TeacherId int = -99,
 @ConfigurationId int = 1
)
AS
Select te.*, t.Name as Tafkid, FullText=LastName + ' '+FirstName, p.Name as Professional,
 -- שעות "אמת": שורות בלי Hakbatza נסכמות כרגיל;
 -- לכל מספר Hakbatza של המורה לוקחים את ה-Hour פעם אחת בלבד (MAX).
 ISNULL((
   SELECT SUM(h) FROM (
     SELECT [Hour] AS h
     FROM ClassTeacher ct
     WHERE ct.TeacherId = te.TeacherId
       AND ct.ConfigurationId = te.ConfigurationId
       AND (ct.Hakbatza IS NULL OR ct.Hakbatza = 0)
     UNION ALL
     SELECT MAX([Hour]) AS h
     FROM ClassTeacher ct
     WHERE ct.TeacherId = te.TeacherId
       AND ct.ConfigurationId = te.ConfigurationId
       AND ct.Hakbatza IS NOT NULL AND ct.Hakbatza > 0
     GROUP BY ct.Hakbatza
   ) x
 ), 0) AS TotalRequired,
 ISNULL((SELECT COUNT(*) FROM TeacherAssignment ta WHERE ta.TeacherId=te.TeacherId AND ta.ConfigurationId=te.ConfigurationId),0) AS AssignedCount
from Teacher te
left join Tafkid t on t.TafkidId = te.TafkidId
left join Professional p on p.ProfessionalId = te.ProfessionalId
Where (TeacherId= @TeacherId)
Or (@TeacherId is null and te.ConfigurationId=@ConfigurationId)
Or (@TeacherId=-99 and te.ConfigurationId=@ConfigurationId)
order by
CASE WHEN @TeacherId is null THEN LastName + FirstName END ASC,
CASE WHEN @TeacherId=-99 THEN te.TafkidId END ASC
GO
