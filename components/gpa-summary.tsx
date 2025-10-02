import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateGPA, getLetterGrade, getLetterGradeColor } from "@/lib/grade-utils"
import type { Course } from "@/lib/types"
import { RollingNumber } from "@/components/rolling-number"

interface GpaSummaryProps {
  courses: Course[]
}

export function GpaSummary({ courses }: GpaSummaryProps) {
  const gpa = calculateGPA(courses)
  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0)

  return (
    <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 to-secondary/10 shadow-xl">
      <CardHeader>
        <CardTitle className="text-center text-2xl text-primary">Semester GPA Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Semester GPA</p>
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
          <div className="space-y-1">
            {courses.map((course) => {
              const grade = course.criteria.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0)
              const letter = getLetterGrade(grade, course.gradeScale)
              const gradeColor = getLetterGradeColor(letter)
              return (
                <div
                  key={course.id}
                  className="flex items-center justify-between rounded border border-primary/20 bg-card px-3 py-2 text-sm"
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
