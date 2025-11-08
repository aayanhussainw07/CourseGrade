"use client"

import { useState, useEffect, useRef } from "react"
import { CourseCard } from "@/components/course-card"
import { CourseSidebar } from "@/components/course-sidebar"
import { GpaSummary } from "@/components/gpa-summary"
import { GradeDistributionChart } from "@/components/grade-distribution-chart"
import { Button } from "@/components/ui/button"
import { Plus, GraduationCap } from "lucide-react"
import type { Course, Semester } from "@/lib/types"
import { storage } from "@/lib/storage"
import { AnimatePresence, motion } from "framer-motion"

export default function GradeCalculator() {
  // -------------------------------
  // 🔹 STATE VARIABLES
  // -------------------------------

  const [semesters, setSemesters] = useState<Semester[]>([])
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null)
  const courseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [loading, setLoading] = useState(true)

  const activeSemester = semesters.find((s) => s.id === activeSemesterId)
  const courses = activeSemester?.courses || []

  // -------------------------------
  // 🔹 THEME HANDLING
  // -------------------------------

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

  // -------------------------------
  // 🔹 LOAD DATA FROM HYBRID STORAGE LAYER
  // -------------------------------

  useEffect(() => {
    loadSemesters()
    const savedSidebar = localStorage.getItem("sidebar-collapsed")
    if (savedSidebar) {
      setSidebarCollapsed(JSON.parse(savedSidebar))
    }
  }, [])

  const loadSemesters = async () => {
    try {
      setLoading(true)
      const loadedSemesters = await storage.getSemesters()
      setSemesters(loadedSemesters)

      const savedActiveSemester = localStorage.getItem("grade-calculator-active-semester")
      if (savedActiveSemester && loadedSemesters.find((s) => s.id === savedActiveSemester)) {
        setActiveSemesterId(savedActiveSemester)
      } else if (loadedSemesters.length > 0) {
        setActiveSemesterId(loadedSemesters[0].id)
      }
    } catch (error) {
      console.error("[v0] Failed to load semesters:", error)
    } finally {
      setLoading(false)
    }
  }

  // -------------------------------
  // 🔹 SAVE ACTIVE SEMESTER
  // -------------------------------

  useEffect(() => {
    if (activeSemesterId) {
      localStorage.setItem("grade-calculator-active-semester", activeSemesterId)
    }
  }, [activeSemesterId])

  // -------------------------------
  // 🔹 SCROLL FUNCTIONALITY
  // -------------------------------

  const scrollToCourse = (courseId: string) => {
    const element = courseRefs.current[courseId]
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  // -------------------------------
  // 🔹 SEMESTER MANAGEMENT
  // -------------------------------

  const addSemester = async () => {
    try {
      const newSemester = await storage.createSemester(`Semester ${semesters.length + 1}`)
      setSemesters([...semesters, newSemester])
      setActiveSemesterId(newSemester.id)
    } catch (error) {
      console.error("[v0] Failed to create semester:", error)
    }
  }

  const deleteSemester = async (semesterId: string) => {
    try {
      await storage.deleteSemester(semesterId)
      const newSemesters = semesters.filter((s) => s.id !== semesterId)
      setSemesters(newSemesters)

      if (activeSemesterId === semesterId) {
        setActiveSemesterId(newSemesters.length > 0 ? newSemesters[0].id : null)
      }
    } catch (error) {
      console.error("[v0] Failed to delete semester:", error)
    }
  }

  const editSemester = async (semesterId: string, newName: string) => {
    try {
      await storage.updateSemester(semesterId, newName)
      setSemesters(semesters.map((s) => (s.id === semesterId ? { ...s, name: newName } : s)))
    } catch (error) {
      console.error("[v0] Failed to update semester:", error)
    }
  }

  // -------------------------------
  // 🔹 COURSE MANAGEMENT
  // -------------------------------

  const addCourse = async () => {
    if (!activeSemesterId) return

    try {
      const newCourse = await storage.createCourse(activeSemesterId, `Course ${courses.length + 1}`, 3)

      setSemesters(semesters.map((s) => (s.id === activeSemesterId ? { ...s, courses: [...s.courses, newCourse] } : s)))

      setTimeout(() => {
        scrollToCourse(newCourse.id)
      }, 100)
    } catch (error) {
      console.error("[v0] Failed to create course:", error)
    }
  }

  const updateCourse = async (id: string, updatedCourse: Course) => {
    if (!activeSemesterId) return

    try {
      await storage.updateCourse(activeSemesterId, updatedCourse)
      setSemesters(
        semesters.map((s) =>
          s.id === activeSemesterId ? { ...s, courses: s.courses.map((c) => (c.id === id ? updatedCourse : c)) } : s,
        ),
      )
    } catch (error) {
      console.error("[v0] Failed to update course:", error)
    }
  }

  const deleteCourse = async (id: string) => {
    if (!activeSemesterId) return

    try {
      await storage.deleteCourse(activeSemesterId, id)
      setSemesters(
        semesters.map((s) => (s.id === activeSemesterId ? { ...s, courses: s.courses.filter((c) => c.id !== id) } : s)),
      )
    } catch (error) {
      console.error("[v0] Failed to delete course:", error)
    }
  }

  const editCourse = async (courseId: string, newName: string) => {
    if (!activeSemesterId) return

    try {
      const course = courses.find((c) => c.id === courseId)
      if (course) {
        await storage.updateCourse(activeSemesterId, { ...course, name: newName })
        setSemesters(
          semesters.map((s) =>
            s.id === activeSemesterId
              ? { ...s, courses: s.courses.map((c) => (c.id === courseId ? { ...c, name: newName } : c)) }
              : s,
          ),
        )
      }
    } catch (error) {
      console.error("[v0] Failed to update course name:", error)
    }
  }

  // -------------------------------
  // 🔹 MAIN RENDER
  // -------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <GraduationCap className="mx-auto mb-4 h-12 w-12 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
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
          paddingLeft: semesters.length > 0 ? (sidebarCollapsed ? "4rem" : "16rem") : "0",
        }}
      >
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <GraduationCap className="h-10 w-10 text-primary" />
            <h1 className="font-sans text-4xl font-bold text-primary">CourseGrade</h1>
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
