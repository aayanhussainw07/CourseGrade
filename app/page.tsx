"use client"

import { useState, useEffect, useRef } from "react"
import { CourseCard } from "@/components/course-card"
import { CourseSidebar } from "@/components/course-sidebar"
import { GpaSummary } from "@/components/gpa-summary"
import { GradeDistributionChart } from "@/components/grade-distribution-chart"
import { Button } from "@/components/ui/button"
import { Plus, GraduationCap } from "lucide-react"
import type { Course, Semester } from "@/lib/types"
import { AnimatePresence, motion } from "framer-motion"

export default function GradeCalculator() {
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null)
  const courseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")

  const activeSemester = semesters.find((s) => s.id === activeSemesterId)
  const courses = activeSemester?.courses || []

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.toggle("dark", savedTheme === "dark")
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
    document.documentElement.classList.toggle("dark", newTheme === "dark")
  }

  useEffect(() => {
    const savedSemesters = localStorage.getItem("grade-calculator-semesters")
    const savedActiveSemester = localStorage.getItem("grade-calculator-active-semester")
    const savedSidebar = localStorage.getItem("sidebar-collapsed")

    if (savedSemesters) {
      const parsedSemesters = JSON.parse(savedSemesters)
      setSemesters(parsedSemesters)
      if (savedActiveSemester && parsedSemesters.find((s: Semester) => s.id === savedActiveSemester)) {
        setActiveSemesterId(savedActiveSemester)
      } else if (parsedSemesters.length > 0) {
        setActiveSemesterId(parsedSemesters[0].id)
      }
    }

    if (savedSidebar) {
      setSidebarCollapsed(JSON.parse(savedSidebar))
    }
  }, [])

  useEffect(() => {
    if (semesters.length > 0) {
      localStorage.setItem("grade-calculator-semesters", JSON.stringify(semesters))
    }
  }, [semesters])

  useEffect(() => {
    if (activeSemesterId) {
      localStorage.setItem("grade-calculator-active-semester", activeSemesterId)
    }
  }, [activeSemesterId])

  useEffect(() => {
    const handleStorage = () => {
      const savedSidebar = localStorage.getItem("sidebar-collapsed")
      if (savedSidebar) {
        setSidebarCollapsed(JSON.parse(savedSidebar))
      }
    }
    window.addEventListener("storage", handleStorage)
    const interval = setInterval(handleStorage, 100)
    return () => {
      window.removeEventListener("storage", handleStorage)
      clearInterval(interval)
    }
  }, [])

  const scrollToCourse = (courseId: string) => {
    const element = courseRefs.current[courseId]
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const addSemester = () => {
    const newSemester: Semester = {
      id: crypto.randomUUID(),
      name: `Semester ${semesters.length + 1}`,
      courses: [],
    }
    setSemesters([...semesters, newSemester])
    setActiveSemesterId(newSemester.id)
  }

  const deleteSemester = (semesterId: string) => {
    const newSemesters = semesters.filter((s) => s.id !== semesterId)
    setSemesters(newSemesters)
    if (activeSemesterId === semesterId) {
      setActiveSemesterId(newSemesters.length > 0 ? newSemesters[0].id : null)
    }
  }

  const editSemester = (semesterId: string, newName: string) => {
    setSemesters(semesters.map((s) => (s.id === semesterId ? { ...s, name: newName } : s)))
  }

  const addCourse = () => {
    if (!activeSemesterId) return

    const newCourse: Course = {
      id: crypto.randomUUID(),
      name: `Course ${courses.length + 1}`,
      credits: 3,
      criteria: [
        { id: crypto.randomUUID(), name: "Assignments", weight: 30, score: 0 },
        { id: crypto.randomUUID(), name: "Midterm", weight: 30, score: 0 },
        { id: crypto.randomUUID(), name: "Final Exam", weight: 40, score: 0 },
      ],
      gradeScale: [
        { letter: "A+", min: 96 },
        { letter: "A", min: 93 },
        { letter: "A-", min: 90 },
        { letter: "B+", min: 87 },
        { letter: "B", min: 83 },
        { letter: "B-", min: 80 },
        { letter: "C+", min: 77 },
        { letter: "C", min: 73 },
        { letter: "C-", min: 70 },
        { letter: "D+", min: 67 },
        { letter: "D", min: 63 },
        { letter: "D-", min: 60 },
        { letter: "F", min: 0 },
      ],
      collapsed: false,
    }

    setSemesters(semesters.map((s) => (s.id === activeSemesterId ? { ...s, courses: [...s.courses, newCourse] } : s)))
  }

  const updateCourse = (id: string, updatedCourse: Course) => {
    if (!activeSemesterId) return
    setSemesters(
      semesters.map((s) =>
        s.id === activeSemesterId ? { ...s, courses: s.courses.map((c) => (c.id === id ? updatedCourse : c)) } : s,
      ),
    )
  }

  const deleteCourse = (id: string) => {
    if (!activeSemesterId) return
    setSemesters(
      semesters.map((s) => (s.id === activeSemesterId ? { ...s, courses: s.courses.filter((c) => c.id !== id) } : s)),
    )
  }

  const editCourse = (courseId: string, newName: string) => {
    if (!activeSemesterId) return
    setSemesters(
      semesters.map((s) =>
        s.id === activeSemesterId
          ? { ...s, courses: s.courses.map((c) => (c.id === courseId ? { ...c, name: newName } : c)) }
          : s,
      ),
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <CourseSidebar
        semesters={semesters}
        activeSemesterId={activeSemesterId}
        onSemesterClick={setActiveSemesterId}
        onCourseClick={scrollToCourse}
        onAddSemester={addSemester}
        onDeleteSemester={deleteSemester}
        onEditSemester={editSemester}
        onDeleteCourse={deleteCourse}
        onEditCourse={editCourse}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 transition-all duration-300"
        style={{
          marginLeft: semesters.length > 0 ? (sidebarCollapsed ? "4rem" : "16rem") : "0",
        }}
      >
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <GraduationCap className="h-10 w-10 text-primary" />
            <h1 className="font-sans text-4xl font-bold text-primary">Grade Calculator</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Track your course grades with weighted criteria and calculate your overall GPA
          </p>
        </div>

        {courses.length > 0 && (
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <GpaSummary courses={courses} />
            <GradeDistributionChart courses={courses} />
          </div>
        )}

        {activeSemesterId && (
          <AnimatePresence mode="popLayout">
            <div className="space-y-6">
              {courses.map((course) => (
                <motion.div
                  key={course.id}
                  ref={(el) => (courseRefs.current[course.id] = el)}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: -20, transition: { duration: 0.25, ease: "easeInOut" } }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <CourseCard course={course} onUpdate={updateCourse} onDelete={deleteCourse} />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {activeSemesterId && (
          <div className="mt-8 flex justify-center">
            <Button
              onClick={addCourse}
              size="lg"
              className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
            >
              <Plus className="h-5 w-5" />
              Add Course
            </Button>
          </div>
        )}

        {semesters.length === 0 && (
          <div className="mt-12 text-center">
            <p className="mb-4 text-muted-foreground">No semesters yet. Click "Add Semester" to get started!</p>
            <Button onClick={addSemester} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Add Semester
            </Button>
          </div>
        )}

        {activeSemesterId && courses.length === 0 && (
          <div className="mt-12 text-center">
            <p className="text-muted-foreground">No courses in this semester. Click "Add Course" to get started!</p>
          </div>
        )}
      </div>
    </div>
  )
}
