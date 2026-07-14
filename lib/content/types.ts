export type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string }
export type Quiz = { questions: QuizQuestion[]; deferred?: QuizQuestion[] }
export type LessonMeta = {
  id: string; title: string; video_id?: string
  duration_min?: number; cheatsheet?: boolean; mission_prompt?: boolean
}
export type LessonRef = { id: string; title: string }
export type CourseYaml = {
  slug: string; title: string
  published?: boolean // MC-02: необязателен; отсутствует → true (обратная совместимость, D-036)
  hours?: number       // CERT-09/D-044: необязателен; отсутствует/не число → 72 (см. CourseContent.hours)
  modules: { id: number; title: string; lessons: LessonRef[] }[]
}
export type Lesson = {
  meta: LessonMeta; moduleId: number
  dir: string            // абсолютный путь каталога урока
  mdx: string            // сырой lesson.mdx
  quiz: Quiz; practiceMd: string; hasCheatsheet: boolean
}
export type ContentIssue = { level: 'error' | 'warning'; lessonId?: string; message: string }
export type CourseContent = {
  slug: string                   // = имени каталога content/{slug} (MC-01), не путать с course.slug
  published: boolean             // из course.yaml, по умолчанию true (MC-02, D-036)
  hours: number                  // из course.yaml, по умолчанию 72 (CERT-09, D-044)
  course: CourseYaml
  lessons: Map<string, Lesson>   // только валидные; битые перечислены в issues
  issues: ContentIssue[]
  loadedAt: Date
}
