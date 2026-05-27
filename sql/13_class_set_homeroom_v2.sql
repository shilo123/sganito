-- =====================================================================
-- Class_SetHomeroom v2
-- ----------------------------------------------------------------------
-- שיפורים מול הגרסה הקודמת:
--   1. תומך ב-TeacherId=0/NULL כדי לנקות את המחנך/ת מהכיתה (מבלי להחליף).
--   2. ולידציה: אסור להגדיר מורה שהוא כבר מחנך של כיתה אחרת
--      (`Teacher.ManageClassId` כבר תפוס בכיתה אחרת) — מחזיר 'ALREADY_HOMEROOM_ELSEWHERE'.
--   3. אם המורה לא קיים כרישום ClassTeacher בכיתה הזו — מוסיף אוטומטית
--      רישום עם Hour=0 ו-IsTeacher=1. אחרת הגדרת מחנך/ת הייתה נכשלת אם
--      המורה עוד לא לימד בכיתה.
--   4. מסנכרן את `ClassTeacher.IsTeacher` עבור כל מורי הכיתה — רק
--      המחנך/ת החדש/ה מקבל/ת IsTeacher=1. השאר מתעדכנים ל-0. זה מבטל את
--      התופעה שבה היו "כמה מחנכים" באותה כיתה (תופעה מהתנהגות ישנה
--      ב-Class_SetTeacherToClass שסימנה IsTeacher=1 בעת הכנסה ראשונה).
--   5. מחזיר ערך res=0 עם msg כשיש בעיה (כדי שה-frontend יוכל להציג
--      הודעה ברורה למשתמש).
-- =====================================================================
IF OBJECT_ID('dbo.Class_SetHomeroom', 'P') IS NOT NULL
  DROP PROCEDURE dbo.Class_SetHomeroom;
GO

CREATE PROCEDURE [dbo].[Class_SetHomeroom]
  @ClassId INT,
  @TeacherId INT,
  @ConfigurationId INT
AS
BEGIN
  SET NOCOUNT ON;

  -- TeacherId NULL או 0 = ניקוי המחנך/ת של הכיתה הזו
  IF @TeacherId IS NULL OR @TeacherId = 0
  BEGIN
    UPDATE Teacher
    SET ManageClassId = NULL
    WHERE ManageClassId = @ClassId AND ConfigurationId = @ConfigurationId;

    UPDATE ClassTeacher
    SET IsTeacher = 0
    WHERE ClassId = @ClassId AND ConfigurationId = @ConfigurationId;

    -- שם הכיתה חוזר להיות ריק (השכבה + Seq בלבד)
    UPDATE Class
    SET Name = ''
    WHERE ClassId = @ClassId AND ConfigurationId = @ConfigurationId;

    SELECT 1 AS res, 'CLEARED' AS msg;
    RETURN;
  END

  -- ולידציה: המורה חייב להיות בעל תפקיד "מחנך/ת" (TafkidId=1)
  IF NOT EXISTS (
    SELECT 1 FROM Teacher
    WHERE TeacherId = @TeacherId
      AND ConfigurationId = @ConfigurationId
      AND TafkidId = 1
  )
  BEGIN
    SELECT 0 AS res, 'TAFKID_NOT_HOMEROOM' AS msg;
    RETURN;
  END

  -- ולידציה: המורה לא יכול להיות כבר מחנך של כיתה אחרת
  IF EXISTS (
    SELECT 1 FROM Teacher
    WHERE TeacherId = @TeacherId
      AND ConfigurationId = @ConfigurationId
      AND ManageClassId IS NOT NULL
      AND ManageClassId <> @ClassId
  )
  BEGIN
    SELECT 0 AS res, 'ALREADY_HOMEROOM_ELSEWHERE' AS msg;
    RETURN;
  END

  -- אם המורה לא קיים כרישום ClassTeacher בכיתה — מוסיפים אוטומטית עם Hour=0
  IF NOT EXISTS (
    SELECT 1 FROM ClassTeacher
    WHERE TeacherId = @TeacherId
      AND ClassId = @ClassId
      AND ConfigurationId = @ConfigurationId
  )
  BEGIN
    INSERT INTO ClassTeacher (ConfigurationId, ClassId, TeacherId, Hour, IsTeacher)
    VALUES (@ConfigurationId, @ClassId, @TeacherId, 0, 1);
  END

  -- מנקים את ה-ManageClassId של המחנך הקודם של הכיתה הזו
  UPDATE Teacher
  SET ManageClassId = NULL
  WHERE ManageClassId = @ClassId
    AND ConfigurationId = @ConfigurationId
    AND TeacherId <> @TeacherId;

  -- מסנכרנים IsTeacher בכל רישומי ClassTeacher של הכיתה — רק המחנך החדש מקבל 1
  UPDATE ClassTeacher
  SET IsTeacher = CASE WHEN TeacherId = @TeacherId THEN 1 ELSE 0 END
  WHERE ClassId = @ClassId
    AND ConfigurationId = @ConfigurationId;

  -- מגדירים את המחנך החדש
  UPDATE Teacher
  SET ManageClassId = @ClassId
  WHERE TeacherId = @TeacherId
    AND ConfigurationId = @ConfigurationId;

  -- מעדכנים את שם הכיתה עם השם הפרטי של המחנך
  UPDATE Class
  SET Name = (SELECT FirstName FROM Teacher WHERE TeacherId = @TeacherId AND ConfigurationId = @ConfigurationId)
  WHERE ClassId = @ClassId
    AND ConfigurationId = @ConfigurationId;

  SELECT 1 AS res, 'OK' AS msg;
END
GO
