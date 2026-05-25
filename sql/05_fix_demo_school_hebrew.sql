USE Sganit;
GO

-- תיקון שם בית ספר דמו (נפגע בקידוד cmd-line)
UPDATE School SET Name = N'בית ספר דמו' WHERE SchoolId = 4;

-- תיקון שם משתמש demo בעברית
UPDATE Users SET FirstName = N'דמו', LastName = N'משתמש' WHERE UserName = 'demo';

SELECT s.SchoolId, s.Name AS SchoolName, u.UserName, u.FirstName, u.LastName
FROM School s
LEFT JOIN Users u ON u.SchoolId = s.SchoolId AND u.UserName = 'demo'
WHERE s.SchoolId = 4;
