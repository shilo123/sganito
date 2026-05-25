USE Sganit;
GO

-- תיקון שם האדמין שנפגע בקידוד
UPDATE [dbo].[Admin]
SET FullName = N'מנהל מערכת'
WHERE UserName = 'admin';

SELECT AdminId, UserName, FullName, Email FROM [dbo].[Admin];
