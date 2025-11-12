"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { CourseCard } from "@/components/course-card"
import { CourseSidebar } from "@/components/course-sidebar"
import { GpaSummary } from "@/components/gpa-summary"
import { GradeDistributionChart } from "@/components/grade-distribution-chart"
import { Button } from "@/components/ui/button"
import { Plus, GraduationCap } from "lucide-react"
import type { Course, Semester } from "@/lib/types"
import { storage, ApiUnavailableError } from "@/lib/storage"
import { AnimatePresence, motion } from "framer-motion"
import { useSession, signIn, signOut } from "next-auth/react"

export default function GradeCalculator() {
  // -------------------------------
  // 🔹 STATE VARIABLES
  // -------------------------------

  const [semesters, setSemesters] = useState<Semester[]>([])
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null)
  const courseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [loading, setLoading] = useState(true)
  const [serverOffline, setServerOffline] = useState(false)
  const { data: session, status } = useSession()

  const activeSemester = semesters.find((s) => s.id === activeSemesterId)
  const courses = activeSemester?.courses || []

  // -------------------------------
  // 🔹 THEME HANDLING
  // -------------------------------

  useEffect(() => {
    document.documentElement.classList.remove("light")
    document.documentElement.classList.add("dark")
  }, [])

  // -------------------------------
  // 🔹 LOAD DATA FROM HYBRID STORAGE LAYER
  // -------------------------------

  const loadSemesters = useCallback(async () => {
    try {
      setLoading(true)
      setServerOffline(false)
      const loadedSemesters = await storage.getSemesters()
      setSemesters(loadedSemesters)

      const savedActiveSemester = localStorage.getItem("grade-calculator-active-semester")
      if (savedActiveSemester && loadedSemesters.find((s) => s.id === savedActiveSemester)) {
        setActiveSemesterId(savedActiveSemester)
      } else if (loadedSemesters.length > 0) {
        setActiveSemesterId(loadedSemesters[0].id)
      }
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        console.error("[v0] Server offline while loading semesters.")
        setServerOffline(true)
        setSemesters([])
        setActiveSemesterId(null)
      } else {
        console.error("[v0] Failed to load semesters:", error)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") {
      const scopeId = session?.user?.id || session?.user?.email || "default"
      storage.setUserScope(scopeId)
      loadSemesters()
    } else if (status === "unauthenticated") {
      storage.setUserScope("default")
      setServerOffline(false)
      setSemesters([])
      setActiveSemesterId(null)
      setLoading(false)
    }
  }, [status, session, loadSemesters])

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
      setSemesters((prev) => [...prev, newSemester])
      setActiveSemesterId(newSemester.id)
      setServerOffline(false)
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true)
      } else {
        console.error("[v0] Failed to create semester:", error)
      }
    }
  }

  const deleteSemester = async (semesterId: string) => {
    try {
      await storage.deleteSemester(semesterId)
      setSemesters((prev) => {
        const updated = prev.filter((s) => s.id !== semesterId)
        if (activeSemesterId === semesterId) {
          setActiveSemesterId(updated.length > 0 ? updated[0].id : null)
        }
        return updated
      })
      setServerOffline(false)
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true)
      } else {
        console.error("[v0] Failed to delete semester:", error)
      }
    }
  }

  const editSemester = async (semesterId: string, newName: string) => {
    try {
      await storage.updateSemester(semesterId, newName)
      setSemesters((prev) => prev.map((s) => (s.id === semesterId ? { ...s, name: newName } : s)))
      setServerOffline(false)
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true)
      } else {
        console.error("[v0] Failed to update semester:", error)
      }
    }
  }

  // -------------------------------
  // 🔹 COURSE MANAGEMENT
  // -------------------------------

  const addCourse = async () => {
    if (!activeSemesterId) return

    try {
      const newCourse = await storage.createCourse(activeSemesterId, `Course ${courses.length + 1}`, 3)

      setSemesters((prev) =>
        prev.map((s) => (s.id === activeSemesterId ? { ...s, courses: [...s.courses, newCourse] } : s)),
      )
      setServerOffline(false)

      setTimeout(() => {
        scrollToCourse(newCourse.id)
      }, 100)
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true)
      } else {
        console.error("[v0] Failed to create course:", error)
      }
    }
  }

  const updateCourse = async (id: string, updatedCourse: Course) => {
    if (!activeSemesterId) return

    try {
      const syncedCourse = await storage.updateCourse(activeSemesterId, updatedCourse)
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === activeSemesterId ? { ...s, courses: s.courses.map((c) => (c.id === id ? syncedCourse : c)) } : s,
        ),
      )
      setServerOffline(false)
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true)
      } else {
        console.error("[v0] Failed to update course:", error)
      }
    }
  }

  const deleteCourse = async (id: string) => {
    if (!activeSemesterId) return

    try {
      await storage.deleteCourse(activeSemesterId, id)
      setSemesters((prev) =>
        prev.map((s) => (s.id === activeSemesterId ? { ...s, courses: s.courses.filter((c) => c.id !== id) } : s)),
      )
      setServerOffline(false)
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true)
      } else {
        console.error("[v0] Failed to delete course:", error)
      }
    }
  }

  const editCourse = async (courseId: string, newName: string) => {
    if (!activeSemesterId) return
    const course = courses.find((c) => c.id === courseId)
    if (course) {
      await updateCourse(courseId, { ...course, name: newName })
    }
  }

  // -------------------------------
  // 🔹 MAIN RENDER
  // -------------------------------

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <GraduationCap className="mx-auto mb-4 h-12 w-12 animate-pulse text-primary" />
          <p className="text-muted-foreground">Checking your account...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <GraduationCap className="h-16 w-16 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Welcome to CourseGrade</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in with your Google account to save semesters and courses to your profile.
          </p>
        </div>
        <Button size="lg" onClick={() => signIn("google")}>
          Continue with Google
        </Button>
      </div>
    )
  }

  if (serverOffline) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <GraduationCap className="h-16 w-16 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Server Offline</h1>
          <p className="mt-2 text-muted-foreground">
            We can’t reach the grading server right now. Please try again shortly.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" onClick={() => loadSemesters()}>
            Retry
          </Button>
          <Button variant="ghost" size="lg" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    )
  }

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
    <div
      className="min-h-screen bg-background/80"
      style={{
        backgroundImage: "var(--page-background-image)",
        backgroundSize: "120% 120%",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
      }}
    >
      <div className="fixed right-6 top-6 z-50 flex items-center gap-3 rounded-full border bg-card/90 px-4 py-2 shadow-sm backdrop-blur">
        <div className="text-left">
          <p className="text-sm font-semibold text-foreground">
            {session?.user?.name || session?.user?.email || "Google User"}
          </p>
          <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
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
      />

      <div
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 transition-all duration-300"
        style={{
          paddingLeft: semesters.length > 0 ? "16rem" : "0",
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
            <GpaSummary courses={courses} semesterName={activeSemester?.name} />
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
