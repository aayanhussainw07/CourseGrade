import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateCourseGrade, calculateGPA, getLetterGrade, getLetterGradeColor } from "@/lib/grade-utils"
import type { Course } from "@/lib/types"
import { RollingNumber } from "@/components/rolling-number"

interface GpaSummaryProps {
  courses: Course[]
  semesterName?: string
}

export function GpaSummary({ courses, semesterName }: GpaSummaryProps) {
  const safeCourses = Array.isArray(courses) ? courses : []
  const gpa = calculateGPA(safeCourses)
  const totalCredits = safeCourses.reduce((sum, c) => sum + c.credits, 0)
  const semesterLabel = semesterName ? `${semesterName}` : "Semester"

  return (
    <Card className="border-2 border-primary/20 shadow-xl">
      <CardHeader>
        <CardTitle className="text-center text-2xl text-primary">{semesterLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">GPA</p>
            <p className="mt-2 text-5xl font-bold text-primary">
              <RollingNumber value={gpa} decimals={2} />
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Total Credits</p>
            <p className="mt-2 text-5xl font-bold text-primary">
              <RollingNumber value={totalCredits} decimals={1} />
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Total Courses</p>
            <p className="mt-2 text-5xl font-bold text-primary">
              <RollingNumber value={courses.length} decimals={0} />
            </p>
          </div>
        </div>

        {/* Course Breakdown */}
        <div className="mt-6 space-y-2">
          <h4 className="text-sm font-semibold text-primary">Course Breakdown:</h4>
          <div
            className={`space-y-1 ${
              courses.length > 4
                ? "max-h-[200px] pl-2 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-600/80 scrollbar-track-transparent hover:scrollbar-thumb-neutral-500/80 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full"
                : ""
            }`}
            dir={safeCourses.length > 4 ? "rtl" : undefined}
          >
            {safeCourses.map((course, index) => {
              const grade = calculateCourseGrade(course.criteria, course.percentBoost)
              const letter = getLetterGrade(grade, course.gradeScale)
              const gradeColor = getLetterGradeColor(letter)
              const backgroundStyle = course.cardColor ? { backgroundColor: course.cardColor } : undefined
              return (
                <div
                  key={`${course.id}-${index}`}
                  className="flex items-center justify-between rounded border border-primary/20 bg-card px-3 py-2 text-sm"
                  dir={safeCourses.length > 4 ? "ltr" : undefined}
                  style={backgroundStyle}
                >
                  <span className="font-medium">{course.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">{course.credits} credits</span>
                    <span className="font-semibold text-primary">
                      <RollingNumber value={grade} decimals={1} />%
                    </span>
                    <span className="min-w-[2.5rem] text-right font-bold" style={{ color: gradeColor }}>
                      {letter}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
