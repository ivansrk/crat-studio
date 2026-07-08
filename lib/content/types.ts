export type QuizQuestion = { question: string; options: string[]; correct: number; explanation: string }
export type Quiz = { questions: QuizQuestion[]; deferred?: QuizQuestion[] }
export type LessonMeta = {
  id: string; title: string; video_id?: string
  duration_min?: number; cheatsheet?: boolean; mission_prompt?: boolean
}
export type LessonRef = { id: string; title: string }
export type CourseYaml = { slug: string; title: string; modules: { id: number; title: string; lessons: LessonRef[] }[] }
export type Lesson = {
  meta: LessonMeta; moduleId: number
  dir: string            // абсолютный путь каталога урока
  mdx: string            // сырой lesson.mdx
  quiz: Quiz; practiceMd: string; hasCheatsheet: boolean
}
export type ContentIssue = { level: 'error' | 'warning'; lessonId?: string; message: string }
export type CourseContent = {
  course: CourseYaml
  lessons: Map<string, Lesson>   // только валидные; битые перечислены в issues
  issues: ContentIssue[]
  loadedAt: Date
}
