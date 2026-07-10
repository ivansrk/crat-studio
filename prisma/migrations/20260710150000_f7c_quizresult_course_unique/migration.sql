-- Ф7в T2 (MC-05/06): было @@unique([userId, lessonId, attempt]) — без courseSlug, латентный
-- мультикурс-баг (два курса с уроком "1.1" конфликтовали бы на attempt). Данные не мигрируются:
-- все существующие строки courseSlug='ai-basics', коллизий индекса нет (docs/data-model.md §5).

-- DropIndex
DROP INDEX "QuizResult_userId_lessonId_attempt_key";

-- CreateIndex
CREATE UNIQUE INDEX "QuizResult_userId_courseSlug_lessonId_attempt_key" ON "QuizResult"("userId", "courseSlug", "lessonId", "attempt");
