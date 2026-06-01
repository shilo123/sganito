/* =============================================================
   סגנית — שלמות נתונים בכיתות: מחיקת כיתה במפל + מחנך חייב ללמד
   ============================================================= */
/*
  שתי דרישות שהוטמעו כאן (idempotent — ניתן להרצה חוזרת):

  1) מחיקת כיתה (Class_SetClassData @mode=3) מנקה כעת במפל:
     - שורות ClassTeacher של הכיתה (היה קיים).
     - Teacher.ManageClassId של המחנך/ת — כדי שלא יישאר "מחנך יתום"
       שמצביע על כיתה שנמחקה (קישור מחנך→כיתה נעלם).
     - הקבצות (GroupInfo) שהכיתה הייתה מקושרת אליהן — ההקבצה כולה נעלמת.
       הקבצה מזוהה ב-(ConfigurationId, LayerId, Number). מאחר ש-ClassTeacher.Hakbatza
       מאחסן את ה-Number, אוספים את ה-Numbers של הכיתה לפני המחיקה, מנקים את
       שאר שורות ה-ClassTeacher שמשתמשות בהן (בכיתות אחרות), ומוחקים את ה-GroupInfo.

  2) הסרת מורה מכיתה (Class_SetTeacherToClass @Type=5): אם המורה שמוסר הוא
     המחנך/ת של אותה כיתה — מנקים גם את Teacher.ManageClassId, כך שלעולם
     לא יישאר מצב של כיתה שיש לה מחנך/ת מוגדר/ת שאינו/ה מלמד/ת בה בפועל.
*/

USE Sganit;
GO

/* ==================== Class_SetClassData ==================== */
IF OBJECT_ID('dbo.Class_SetClassData','P') IS NOT NULL DROP PROCEDURE dbo.Class_SetClassData;
GO
CREATE PROCEDURE [dbo].[Class_SetClassData]
(
  @ClassId int,
  @LayerId tinyint,
  @ClassName nvarchar(50) = '0,1,0',
  @Seq tinyint = null,
  @mode tinyint,
  @ConfigurationId int
)
AS
BEGIN
  SET NOCOUNT ON;

  -- הוספה
  IF @mode = 1
  BEGIN
    INSERT INTO Class(Name, ConfigurationId, Seq, LayerId)
    VALUES(@ClassName, @ConfigurationId, @Seq, @LayerId);
  END

  -- עדכון
  IF @mode = 2
  BEGIN
    UPDATE Class
    SET Name = @ClassName,
        Seq  = @Seq
    WHERE ClassId = @ClassId;
  END

  -- מחיקה (במפל)
  IF @mode = 3
  BEGIN
    BEGIN TRY
      BEGIN TRAN;

      -- שכבת הכיתה (לזיהוי הקבצות לפי LayerId+Number)
      DECLARE @clsLayer INT = (SELECT LayerId FROM Class WHERE ClassId = @ClassId);

      -- מספרי ההקבצות (Hakbatza Number) שהכיתה הזו השתתפה בהן
      DECLARE @groupNumbers TABLE (Num INT PRIMARY KEY);
      INSERT INTO @groupNumbers (Num)
      SELECT DISTINCT Hakbatza
      FROM ClassTeacher
      WHERE ClassId = @ClassId
        AND ConfigurationId = @ConfigurationId
        AND Hakbatza IS NOT NULL;

      -- (א) ניקוי קישור המחנך/ת לכיתה — לא להשאיר מחנך יתום
      UPDATE Teacher
      SET ManageClassId = NULL
      WHERE ManageClassId = @ClassId
        AND ConfigurationId = @ConfigurationId;

      -- (ב) מחיקת כל שורות ה-ClassTeacher של הכיתה
      DELETE FROM ClassTeacher
      WHERE ClassId = @ClassId
        AND ConfigurationId = @ConfigurationId;

      -- (ג) מחיקת ההקבצות המקושרות: מנקים את שורות ה-ClassTeacher שנותרו
      --     בכיתות אחרות עם אותו Number, ואז מוחקים את רשומות ה-GroupInfo.
      IF EXISTS (SELECT 1 FROM @groupNumbers)
      BEGIN
        DELETE ct
        FROM ClassTeacher ct
        WHERE ct.ConfigurationId = @ConfigurationId
          AND ct.Hakbatza IN (SELECT Num FROM @groupNumbers);

        DELETE gi
        FROM GroupInfo gi
        WHERE gi.ConfigurationId = @ConfigurationId
          AND gi.LayerId = @clsLayer
          AND gi.Number IN (SELECT Num FROM @groupNumbers);
      END

      -- (ד) מחיקת הכיתה עצמה
      DELETE FROM Class
      WHERE ClassId = @ClassId;

      COMMIT TRAN;
    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT > 0 ROLLBACK TRAN;
      THROW;
    END CATCH
  END
END
GO

/* ==================== Class_SetTeacherToClass ==================== */
/* זהה למקור, למעט תוספת ניקוי ManageClassId כשמסירים את המחנך/ת (Type=5). */
IF OBJECT_ID('dbo.Class_SetTeacherToClass','P') IS NOT NULL DROP PROCEDURE dbo.Class_SetTeacherToClass;
GO
CREATE PROCEDURE [dbo].[Class_SetTeacherToClass]
(
	@ClassId int = 1,
	@TeacherId int = 6,
	@Hour int=null,
	@TargetHakbatza int=null,
	@SourceHakbatza int=null,
	@TargetIhud int=null,
	@SourceIhud int=null,
	@TargetClassTeacherId int=null,
	@SourceClassTeacherId int=null,
	@Type tinyint=5,
	@ConfigurationId int = 1
)
AS

if @Type=1
begin
  declare @IsTeacher bit = 0
  if not exists(Select TeacherId from ClassTeacher where ConfigurationId=@ConfigurationId and ClassId=@ClassId and IsTeacher=1)
  and (Select top 1 TafkidId from Teacher where ConfigurationId=@ConfigurationId and TeacherId = @TeacherId) = 1
  begin
   set  @IsTeacher = 1
  end
  Insert into ClassTeacher(ConfigurationId, ClassId, TeacherId,IsTeacher)
  values(@ConfigurationId, @ClassId, @TeacherId,@IsTeacher)
end

if @Type=5
begin
  -- אילו מורים עומדים להיות מוסרים מהכיתה (לפני המחיקה) — כדי לבדוק אם
  -- אחד מהם הוא המחנך/ת ולנקות בהתאם את ManageClassId.
  declare @removed table (TeacherId int)
  insert into @removed (TeacherId)
  select distinct TeacherId
  from ClassTeacher
  where ClassId=@ClassId and ConfigurationId=@ConfigurationId
    and (ClassTeacherId = @SourceClassTeacherId or Hakbatza = @SourceHakbatza)
    and TeacherId is not null

  delete from ClassTeacher
  where ClassId=@ClassId and ConfigurationId=@ConfigurationId and
  (ClassTeacherId = @SourceClassTeacherId or Hakbatza = @SourceHakbatza)
  update ClassTeacher Set Ihud = null
  where ConfigurationId=@ConfigurationId and Ihud = @SourceIhud
  and (Select Count(distinct ClassId) from ClassTeacher where ConfigurationId = @ConfigurationId and Ihud=@SourceIhud) =1

  -- שלמות מחנך: אם מורה שהוסר הוא המחנך/ת של הכיתה ושוב אינו/ה מלמד/ת בה —
  -- מנקים את ManageClassId כדי שלא תיוותר כיתה עם מחנך/ת שאינו/ה מלמד/ת בה.
  update Teacher
  set ManageClassId = null
  where ConfigurationId = @ConfigurationId
    and ManageClassId = @ClassId
    and TeacherId in (select TeacherId from @removed)
    and not exists (
      select 1 from ClassTeacher ct
      where ct.ConfigurationId = @ConfigurationId
        and ct.ClassId = @ClassId
        and ct.TeacherId = Teacher.TeacherId
    )
end

if @Type=4
begin
   declare @WillExceed tinyint = dbo.IsClassTeacherHasHour(@SourceClassTeacherId,@TeacherId,@SourceHakbatza,@Hour,@ConfigurationId)
   update ClassTeacher set Hour = @Hour
   where ConfigurationId=@ConfigurationId and
   (ClassTeacherId = @SourceClassTeacherId Or (Hakbatza=@SourceHakbatza) Or (Ihud=@SourceIhud))
   select @WillExceed as res
   return
end

if @Type=3
begin
   declare @NewClassTeacherId int
   declare @Hakbatza int
   Insert into ClassTeacher(ConfigurationId, ClassId, TeacherId,Hakbatza,Ihud,Hour)
   select @ConfigurationId,@ClassId, @TeacherId,@TargetHakbatza,@TargetIhud,@Hour
   where @TeacherId not in(Select TeacherId from ClassTeacher
                           where ConfigurationId = @ConfigurationId and
						        Hakbatza=@TargetHakbatza and
								ClassId=@ClassId )
   union all
   select
   distinct @ConfigurationId,ClassId, @TeacherId,@TargetHakbatza,@TargetIhud,@Hour
   from ClassTeacher
   where
   Hakbatza = @TargetHakbatza and
   ConfigurationId = @ConfigurationId
	if @TargetHakbatza is null
	begin
		set @Hakbatza = (Select coalesce(max(Hakbatza),0) + 1 from ClassTeacher where ConfigurationId=@ConfigurationId)
		 update ClassTeacher set Hakbatza = @Hakbatza
		 where ClassId = @ClassId
		 and ConfigurationId=@ConfigurationId
		 and ClassTeacherId in (@TargetClassTeacherId,SCOPE_IDENTITY())
	end
end

if @Type=2
begin
     declare @IhudNumber int
	 set @IhudNumber = (Select coalesce(max(Ihud),0) + 1 from ClassTeacher where ConfigurationId=@ConfigurationId)
   Insert into ClassTeacher(ConfigurationId, ClassId, TeacherId,Hakbatza,Ihud,Hour)
   select
   ConfigurationId,@ClassId, TeacherId,Hakbatza,case when Ihud is null then @IhudNumber else Ihud end,Hour
   from ClassTeacher
   where ConfigurationId=@ConfigurationId
   and ClassId = @TargetHakbatza
   and (ClassTeacherId=@SourceClassTeacherId Or Hakbatza = @SourceHakbatza)
   update ClassTeacher Set Ihud = @IhudNumber
   where (ClassTeacherId=@SourceClassTeacherId Or Hakbatza = @SourceHakbatza)
   and Ihud Is Null
end

select 0 as res
GO

PRINT N'✓ Class_SetClassData + Class_SetTeacherToClass עודכנו (מחיקת כיתה במפל + שלמות מחנך)';
GO
