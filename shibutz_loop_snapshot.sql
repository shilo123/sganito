-- snapshot של 12 שורות Hour=0 ללא הקבצה (סבב 1) + 26 שורות כפולות (סבב 2)
-- שחזור: SET IDENTITY_INSERT ClassTeacher ON; (אז INSERT) ; SET IDENTITY_INSERT OFF;
-- סבב 1 - 12 שורות Hour=0 ללא הקבצה
INSERT INTO ClassTeacher (ClassTeacherId, ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud, IsTeacher) VALUES
(512, 1, 2037, 18, 0, NULL, NULL, 0),
(539, 1, 2040, 58, 0, NULL, NULL, 0),
(543, 1, 2041, 33, 0, NULL, NULL, 0),
(546, 1, 2041, 29, 0, NULL, NULL, 0),
(578, 1, 2044, 58, 0, NULL, NULL, 0),
(610, 1, 2048, 18, 0, NULL, NULL, 0),
(613, 1, 2048, 58, 0, NULL, NULL, 0),
(627, 1, 2049, 58, 0, NULL, NULL, 0),
(635, 1, 2050, 18, 0, NULL, NULL, 0),
(638, 1, 2050, 59, 0, NULL, NULL, 0),
(715, 1, 2058, 5, 0, NULL, NULL, 0),
(803, 1, 2050, 33, 0, NULL, NULL, 0);

-- סבב 2 - 13 מקרים של (T,C) עם 2 שורות (סך 26 שורות)
-- 11 שורות חברי הקבצה שנמחקות (Hour=0):
-- ערן/אודיה Hak=4 (924), דניאל/נופר Hak=3 (934), תהילה/אודיה Hak=2 (916),
-- תהילה/ענת Hak=2 (917), אבניאל/מוריה Hak=1 (927), זלפה/ליאורי Hak=1 (842),
-- זלפה/רויטל Hak=1 (843), נועם/אודיה Hak=4 (922), ימימה/מרים Hak=1 (910),
-- ימימה/סיגל Hak=1 (911), ארז/סיגל Hak=3 (919)
INSERT INTO ClassTeacher (ClassTeacherId, ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud, IsTeacher) VALUES
(842, 1, 2045, 35, 0, 1, NULL, 0),
(843, 1, 2046, 35, 0, 1, NULL, 0),
(910, 1, 2052, 48, 0, 1, NULL, 0),
(911, 1, 2053, 48, 0, 1, NULL, 0),
(916, 1, 2054, 28, 0, 2, NULL, 0),
(917, 1, 2055, 28, 0, 2, NULL, 0),
(919, 1, 2053, 53, 0, 3, NULL, 0),
(922, 1, 2054, 41, 0, 4, NULL, 0),
(924, 1, 2054, 5, 0, 4, NULL, 0),
(927, 1, 2057, 32, 0, 1, NULL, 0),
(934, 1, 2056, 20, 0, 3, NULL, 0);

-- 2 מובילים: שרית/סיגל Hak=1 (895): Hour 4→6 חזרה ל-4. נועם/נופר Hak=3 (906): Hour 5→7 חזרה ל-5.
-- 2 שורות רגילות שנמחקו: שרית/סיגל (671), נועם/נופר (694).
INSERT INTO ClassTeacher (ClassTeacherId, ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud, IsTeacher) VALUES
(671, 1, 2053, 18, 2, NULL, NULL, 0),
(694, 1, 2056, 41, 2, NULL, NULL, 0);
-- וגם UPDATE לחזרה:
-- UPDATE ClassTeacher SET Hour=4 WHERE ClassTeacherId=895;
-- UPDATE ClassTeacher SET Hour=5 WHERE ClassTeacherId=906;

-- סבב 3 (התאמת מכסות לאקטואל) - 3 שינויי Hour, לחזרה:
-- UPDATE ClassTeacher SET Hour = 24 WHERE ClassTeacherId=589; -- רויטל@רויטל
-- UPDATE ClassTeacher SET Hour = 6  WHERE ClassTeacherId=895; -- שרית@סיגל (מאוחד עם 671)
-- UPDATE ClassTeacher SET Hour = 5  WHERE ClassTeacherId=684; -- חיה@ענת

-- סבב 4 (אחרי שיבוץ מ-0): 2 התאמות נוספות
-- UPDATE ClassTeacher SET Hour=5 WHERE ClassTeacherId=894; -- שרית@מרים (Hak=1)
-- UPDATE ClassTeacher SET Hour=7 WHERE ClassTeacherId=906; -- נועם@נופר (Hak=3)

-- סבב 5: עדכון Configuration:
-- UPDATE Configuration SET MaxHourInShibutz=2 WHERE ConfigurationId=1;

-- סבב 6: 3 מחיקות + 1 התאמה
-- INSERT INTO ClassTeacher (ClassTeacherId, ConfigurationId, ClassId, TeacherId, Hour, Hakbatza, Ihud, IsTeacher) VALUES
-- (587, 1, 2045, 31, 1, NULL, NULL, 0),  -- אביחי@ליאורי
-- (597, 1, 2046, 31, 1, NULL, NULL, 0),  -- אביחי@רויטל
-- (728, 1, 2059, 58, 1, NULL, NULL, 0);  -- מאור@עדי
-- UPDATE ClassTeacher SET Hour=15 WHERE ClassTeacherId=672;  -- אודיה ביטון@אודיה
