"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { CourseCard } from "@/components/course-card"
import { CourseSidebar } from "@/components/course-sidebar"
import { GpaSummary } from "@/components/gpa-summary"
import { GradeDistributionChart } from "@/components/grade-distribution-chart"
import { GpaTimelineChart } from "@/components/gpa-timeline-chart"
import { Button } from "@/components/ui/button"
import { Plus, GraduationCap, Sparkles, Menu, Upload, TrendingUp, Layers } from "lucide-react"
import type { Course, Semester } from "@/lib/types"
import { storage, ApiUnavailableError } from "@/lib/storage"
import { serializeCourseCsv, serializeSemesterCsv, parseCourseCsv, parseSemesterCsv, type CoursePortableData } from "@/lib/csv"
import { AnimatePresence, motion } from "framer-motion"
import { useSession, signIn, signOut } from "next-auth/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { backgroundOptions, getBackgroundImage } from "@/lib/backgrounds"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { applyStoredSettingsToSemesters, persistCourseSettings, removeCourseSettings } from "@/lib/course-settings"
import { calculateGPA, getLetterGradeColor } from "@/lib/grade-utils"
const generateClientId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

const SEMESTER_ORDER_STORAGE_KEY = "grade-calculator-semester-order"
const ACTIVE_SEMESTER_STORAGE_KEY = "grade-calculator-active-semester"
const DASHBOARD_SENTINEL = "__dashboard__"

const triggerFileDownload = (filename: string, content: string) => {
  if (typeof window === "undefined") return
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const safeFilename = (name: string | undefined, fallback: string) => {
  if (name && name.length > 0) {
    const sanitized = name.replace(/[^a-z0-9]+/gi, "_")
    return sanitized.length > 0 ? sanitized : fallback
  }
  return fallback
}

const courseToPortable = (course: Course): CoursePortableData => ({
  name: course.name,
  credits: course.credits,
  isPassFail: course.isPassFail ?? false,
  passLabel: course.passLabel ?? "P",
  failLabel: course.failLabel ?? "F",
  passThreshold: course.passThreshold ?? 60,
  cardColor: course.cardColor ?? null,
  gradeScale: Array.isArray(course.gradeScale) && course.gradeScale.length > 0 ? course.gradeScale : [],
  criteria: (Array.isArray(course.criteria) ? course.criteria : []).map((criterion) => ({
    name: criterion.name,
    weight: criterion.weight,
    score: criterion.score,
    extraCredit: criterion.extraCredit ?? 0,
    dropLowest: criterion.dropLowest ?? 0,
    subItems: (Array.isArray(criterion.subItems) ? criterion.subItems : []).map((subItem) => ({
      id: subItem.id,
      name: subItem.name,
      score: subItem.score,
    })),
  })),
})

interface DashboardBackupPayload {
  version: number
  generatedAt: string
  semesterOrder: string[]
  semesters: Array<{
    id?: string
    name: string
    background?: string
    timelineDate?: string | null
    courses: CoursePortableData[]
  }>
}

const readStoredSemesterOrder = (): string[] => {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SEMESTER_ORDER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === "string")
  } catch {
    return []
  }
}

const writeStoredSemesterOrder = (order: string[]) => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SEMESTER_ORDER_STORAGE_KEY, JSON.stringify(order))
  } catch {
    // Ignore storage errors
  }
}

const formatDateLabel = (value?: string | null) => {
  if (!value) return "Not set"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short" })
}

const gpaToLetterGrade = (gpa: number) => {
  if (gpa >= 3.95) return "A+"
  if (gpa >= 3.85) return "A"
  if (gpa >= 3.7) return "A-"
  if (gpa >= 3.3) return "B+"
  if (gpa >= 3.0) return "B"
  if (gpa >= 2.7) return "B-"
  if (gpa >= 2.3) return "C+"
  if (gpa >= 2.0) return "C"
  if (gpa >= 1.7) return "C-"
  if (gpa >= 1.3) return "D+"
  if (gpa >= 1.0) return "D"
  if (gpa >= 0.7) return "D-"
  return "F"
}

const getGpaColor = (gpa: number) => getLetterGradeColor(gpaToLetterGrade(gpa))

const parseSemesterSortValue = (semester: Semester) => {
  const source = semester.createdAt ?? semester.updatedAt
  const parsed = source ? Date.parse(source) : Number.NaN
  if (Number.isNaN(parsed)) {
    return Number.MAX_SAFE_INTEGER
  }
  return parsed
}

const isServerResourceId = (value: string | null | undefined) => typeof value === "string" && /^\d+$/.test(value)


export default function GradeCalculator() {
  // -------------------------------
  // 🔹 STATE VARIABLES
  // -------------------------------

  const [semesters, setSemesters] = useState<Semester[]>([])
  const [semesterOrder, setSemesterOrder] = useState<string[]>([])
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null)
  const courseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [loading, setLoading] = useState(true)
  const [serverOffline, setServerOffline] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const themePickerRef = useRef<HTMLDivElement | null>(null)
  const themeButtonRef = useRef<HTMLButtonElement | null>(null)
  const themeSelectContentRef = useRef<HTMLDivElement | null>(null)
  const recentThemeSelectInteraction = useRef(0)
  const { data: session, status } = useSession()

  useEffect(() => {
    setSemesterOrder((previous) => {
      if (semesters.length === 0) {
        return []
      }
      const semesterIds = semesters.map((semester) => semester.id)
      const filtered = previous.filter((id) => semesterIds.includes(id))
      const missing = semesterIds.filter((id) => !filtered.includes(id))
      if (missing.length === 0 && filtered.length === previous.length) {
        return previous
      }
      return [...filtered, ...missing]
    })
  }, [semesters])

  useEffect(() => {
    if (semesterOrder.length === 0) return
    writeStoredSemesterOrder(semesterOrder)
  }, [semesterOrder])

  const activeSemester = useMemo(
    () => semesters.find((semester) => semester.id === activeSemesterId),
    [semesters, activeSemesterId],
  )
  const courses = activeSemester?.courses || []
  const activeBackgroundId = activeSemester?.background || "sunrise"
  const isDashboardView = activeSemesterId === null

  const orderedSemesters = useMemo(() => {
    if (semesterOrder.length === 0) {
      return [...semesters].sort((a, b) => parseSemesterSortValue(a) - parseSemesterSortValue(b))
    }
    const semesterMap = new Map(semesters.map((semester) => [semester.id, semester]))
    const ordered = semesterOrder
      .map((id) => semesterMap.get(id))
      .filter((semester): semester is Semester => Boolean(semester))
    if (ordered.length === semesters.length) {
      return ordered
    }
    const missing = semesters.filter((semester) => !semesterOrder.includes(semester.id))
    return [...ordered, ...missing]
  }, [semesterOrder, semesters])

  const allCourses = useMemo(
    () => orderedSemesters.flatMap((semester) => (Array.isArray(semester.courses) ? semester.courses : [])),
    [orderedSemesters],
  )
  const overallGpa = useMemo(() => (allCourses.length > 0 ? calculateGPA(allCourses) : 0), [allCourses])
  const totalCredits = useMemo(() => allCourses.reduce((sum, course) => sum + course.credits, 0), [allCourses])
  const totalSemesters = orderedSemesters.length

  const semesterSummaries = useMemo(
    () =>
      orderedSemesters.map((semester) => {
        const coursesList = Array.isArray(semester.courses) ? semester.courses : []
        const credits = coursesList.reduce((sum, course) => sum + course.credits, 0)
        const gpa = coursesList.length > 0 ? calculateGPA(coursesList) : 0
        return {
          id: semester.id,
          name: semester.name,
          gpa,
          credits,
          createdAt: semester.createdAt ?? semester.updatedAt ?? "",
        }
      }),
    [orderedSemesters],
  )

  const timelineData = useMemo(
    () =>
      semesterSummaries.map((summary) => {
        const gpaValue = Number(summary.gpa.toFixed(2))
        return {
          label: summary.name,
          gpa: gpaValue,
          color: getGpaColor(gpaValue),
        }
      }),
    [semesterSummaries],
  )

  const dashboardSummary = useMemo(
    () => ({
      overallGpa,
      totalCredits,
      totalSemesters,
    }),
    [overallGpa, totalCredits, totalSemesters],
  )

  // -------------------------------
  // 🔹 THEME HANDLING
  // -------------------------------

  useEffect(() => {
    document.documentElement.classList.remove("light")
    document.documentElement.classList.add("dark")
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!themePickerOpen) return
      const picker = themePickerRef.current
      const button = themeButtonRef.current
      const selectContent = themeSelectContentRef.current
      const target = event.target as Node
      if (
        (picker && picker.contains(target)) ||
        (button && button.contains(target)) ||
        (selectContent && selectContent.contains(target))
      ) {
        return
      }
      if (recentThemeSelectInteraction.current > Date.now()) {
        return
      }
      setThemePickerOpen(false)
    }
    window.addEventListener("mousedown", handleClickOutside)
    return () => window.removeEventListener("mousedown", handleClickOutside)
  }, [themePickerOpen])

  useEffect(() => {
    const handleResponsiveSidebar = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }
    handleResponsiveSidebar()
    window.addEventListener("resize", handleResponsiveSidebar)
    return () => window.removeEventListener("resize", handleResponsiveSidebar)
  }, [])

  // -------------------------------
  // 🔹 LOAD DATA FROM HYBRID STORAGE LAYER
  // -------------------------------

  const loadSemesters = useCallback(async () => {
    try {
      setLoading(true)
      setServerOffline(false)
      const loadedSemesters = await storage.getSemesters()
      const mergedSemesters = applyStoredSettingsToSemesters(loadedSemesters)
      setSemesters(mergedSemesters)

      const savedOrder = readStoredSemesterOrder()
      if (savedOrder.length > 0) {
        const validOrder = savedOrder.filter((id) => mergedSemesters.some((semester) => semester.id === id))
        if (validOrder.length > 0) {
          setSemesterOrder(validOrder)
        }
      }

      const savedActiveSemester = localStorage.getItem(ACTIVE_SEMESTER_STORAGE_KEY)
      if (savedActiveSemester === DASHBOARD_SENTINEL) {
        setActiveSemesterId(null)
      } else if (savedActiveSemester && loadedSemesters.find((s) => s.id === savedActiveSemester)) {
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
    if (activeSemesterId === null) {
      localStorage.setItem(ACTIVE_SEMESTER_STORAGE_KEY, DASHBOARD_SENTINEL)
    } else {
      localStorage.setItem(ACTIVE_SEMESTER_STORAGE_KEY, activeSemesterId)
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
      await storage.updateSemester(semesterId, { name: newName })
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

  const importPortableCourse = useCallback(
    async (courseData: CoursePortableData, semesterId: string): Promise<Course> => {
      const numericOr = (value: number | undefined, fallback: number) =>
        typeof value === "number" && Number.isFinite(value) ? value : fallback
      const fallbackName =
        typeof courseData.name === "string" && courseData.name.length > 0 ? courseData.name : `Imported Course`
      const baseCourse = await storage.createCourse(semesterId, fallbackName, numericOr(courseData.credits, 0))
      const normalizedCriteria =
        courseData.criteria?.map((criterion, index) => ({
          id: "",
          clientId: generateClientId(),
          name: typeof criterion.name === "string" && criterion.name.length > 0 ? criterion.name : `Criterion ${index + 1}`,
          weight: numericOr(criterion.weight, 0),
          score: numericOr(criterion.score, 0),
          extraCredit: numericOr(criterion.extraCredit, 0),
          dropLowest: Math.max(0, Math.floor(numericOr(criterion.dropLowest, 0))),
          subItems: (criterion.subItems ?? []).map((subItem, subIndex) => ({
            id: generateClientId(),
            name: typeof subItem.name === "string" && subItem.name.length > 0 ? subItem.name : `Item ${subIndex + 1}`,
            score: numericOr(subItem.score, 0),
          })),
        })) ?? []

      const updatedCourse: Course = {
        ...baseCourse,
        name: fallbackName,
        credits: numericOr(courseData.credits, baseCourse.credits),
        isPassFail: courseData.isPassFail ?? baseCourse.isPassFail ?? false,
        passLabel: courseData.passLabel ?? baseCourse.passLabel ?? "P",
        failLabel: courseData.failLabel ?? baseCourse.failLabel ?? "F",
        passThreshold: numericOr(courseData.passThreshold, baseCourse.passThreshold ?? 60),
        cardColor: courseData.cardColor ?? baseCourse.cardColor ?? null,
        gradeScale: courseData.gradeScale && courseData.gradeScale.length > 0 ? courseData.gradeScale : baseCourse.gradeScale,
        criteria: normalizedCriteria.length > 0 ? normalizedCriteria : baseCourse.criteria,
      }

      const syncedCourse = await storage.updateCourse(semesterId, updatedCourse)
      persistCourseSettings(syncedCourse)
      return syncedCourse
    },
    [],
  )

  const updateCourse = async (id: string, updatedCourse: Course) => {
    if (!activeSemesterId) return

    const baseCriteria = Array.isArray(updatedCourse.criteria) ? updatedCourse.criteria : []
    const stateCriteria = baseCriteria.map((criterion) => ({
      ...criterion,
      name: typeof criterion.name === "string" ? criterion.name : "",
      subItems: Array.isArray(criterion.subItems) ? criterion.subItems : [],
    }))
    const stateCourse: Course = {
      ...updatedCourse,
      name: typeof updatedCourse.name === "string" ? updatedCourse.name : "",
      criteria: stateCriteria,
    }
    const sanitizedCriteria = stateCriteria.map((criterion, index) => ({
      ...criterion,
      name: criterion.name.length > 0 ? criterion.name : ``,
    }))
    const sanitizedCourse: Course = {
      ...stateCourse,
      name: stateCourse.name.length > 0 ? stateCourse.name : "",
      criteria: sanitizedCriteria,
    }

    const applyCourseUpdate = (nextCourse: Course) => {
      setSemesters((prev) =>
        prev.map((s) =>
          s.id === activeSemesterId ? { ...s, courses: s.courses.map((c) => (c.id === id ? nextCourse : c)) } : s,
        ),
      )
    }

    applyCourseUpdate(stateCourse)
    persistCourseSettings(sanitizedCourse)

    const isServerCourse = isServerResourceId(id)
    const isServerSemester = isServerResourceId(activeSemesterId)

    if (!isServerCourse || !isServerSemester) {
      console.warn("[v0] Skipping course sync until course and semester have server IDs.")
      return
    }

    try {
      const syncedCourse = await storage.updateCourse(activeSemesterId, sanitizedCourse)
      applyCourseUpdate(syncedCourse)
      persistCourseSettings(syncedCourse)
      setServerOffline(false)
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true)
      } else {
        console.error("[v0] Failed to update course:", error)
      }
    }
  }

  const exportSemesterToJson = useCallback(
    (semesterId: string) => {
      const semester = semesters.find((s) => s.id === semesterId)
      if (!semester) return
      const csv = serializeSemesterCsv(semester)
      const filename = `${safeFilename(semester.name, "semester")}.json`
      triggerFileDownload(filename, csv)
    },
    [semesters],
  )

  const exportCourseToJson = useCallback(
    (courseId: string) => {
      for (const semester of semesters) {
        const course = semester.courses.find((c) => c.id === courseId)
        if (course) {
          const csv = serializeCourseCsv(course)
          const filename = `${safeFilename(course.name, "course")}.json`
          triggerFileDownload(filename, csv)
          return
        }
      }
    },
    [semesters],
  )

  const exportDashboardBackup = useCallback(() => {
    const payload: DashboardBackupPayload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      semesterOrder,
      semesters: semesters.map((semester) => ({
        id: semester.id,
        name: semester.name,
        background: semester.background,
        timelineDate: semester.timelineDate ?? null,
        courses: semester.courses.map(courseToPortable),
      })),
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `coursegrade-dashboard-${timestamp}.json`
    triggerFileDownload(filename, JSON.stringify(payload, null, 2))
  }, [semesterOrder, semesters])

  const importSemesterFromJson = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const data = parseSemesterCsv(text)
        const desiredName =
          typeof data.name === "string" && data.name.length > 0 ? data.name : `Imported Semester ${semesters.length + 1}`
        const created = await storage.createSemester(desiredName)
        const background = data.background ?? created.background
        if (background !== created.background || desiredName !== created.name) {
          await storage.updateSemester(created.id, { name: desiredName, background })
        }
        const importedCourses: Course[] = []
        for (const courseData of data.courses ?? []) {
          const importedCourse = await importPortableCourse(courseData, created.id)
          importedCourses.push(importedCourse)
        }
        const merged: Semester = {
          ...created,
          name: desiredName,
          background,
          courses: importedCourses,
        }
        setSemesters((prev) => [...prev, merged])
        setActiveSemesterId(merged.id)
        setServerOffline(false)
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          setServerOffline(true)
        } else {
          console.error("[v0] Failed to import semester JSON:", error)
        }
      }
    },
    [importPortableCourse, semesters.length],
  )

  const importCourseFromJson = useCallback(
    async (file: File, semesterId: string | null) => {
      if (!semesterId) return
      try {
        const text = await file.text()
        const data = parseCourseCsv(text)
        const importedCourse = await importPortableCourse(data, semesterId)
        setSemesters((prev) =>
          prev.map((semester) =>
            semester.id === semesterId ? { ...semester, courses: [...semester.courses, importedCourse] } : semester,
          ),
        )
        setServerOffline(false)
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          setServerOffline(true)
        } else {
          console.error("[v0] Failed to import course JSON:", error)
        }
      }
    },
    [importPortableCourse],
  )

  const importDashboardBackup = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const payload = JSON.parse(text) as Partial<DashboardBackupPayload>
        if (!payload || !Array.isArray(payload.semesters)) {
          throw new Error("Invalid dashboard backup file")
        }
        const orderMap = new Map<string, number>()
        if (Array.isArray(payload.semesterOrder)) {
          payload.semesterOrder.forEach((oldId, index) => {
            if (typeof oldId === "string") {
              orderMap.set(oldId, index)
            }
          })
        }
        const createdSemesters: Array<{ semester: Semester; orderIndex: number }> = []
        for (const [index, semesterData] of payload.semesters.entries()) {
          const safeName =
            typeof semesterData?.name === "string" && semesterData.name.length > 0
              ? semesterData.name
              : `Imported Semester ${semesters.length + createdSemesters.length + 1}`
          const created = await storage.createSemester(safeName, semesterData?.timelineDate ?? null)
          const background = semesterData?.background ?? created.background
          if (
            background !== created.background ||
            safeName !== created.name ||
            (semesterData?.timelineDate ?? null) !== (created.timelineDate ?? null)
          ) {
            await storage.updateSemester(created.id, {
              name: safeName,
              background,
              timelineDate: semesterData?.timelineDate ?? null,
            })
          }
          const importedCourses: Course[] = []
          for (const courseData of semesterData?.courses ?? []) {
            const importedCourse = await importPortableCourse(courseData, created.id)
            importedCourses.push(importedCourse)
          }
          const semesterRecord: Semester = {
            ...created,
            name: safeName,
            background,
            timelineDate: semesterData?.timelineDate ?? created.timelineDate ?? null,
            courses: importedCourses,
          }
          const orderIndex =
            (typeof semesterData?.id === "string" && orderMap.has(semesterData.id)
              ? orderMap.get(semesterData.id)
              : undefined) ?? index
          createdSemesters.push({ semester: semesterRecord, orderIndex })
        }
        if (createdSemesters.length > 0) {
          const orderedImports = createdSemesters.sort((a, b) => a.orderIndex - b.orderIndex).map((entry) => entry.semester)
          setSemesters((prev) => [...prev, ...orderedImports])
          setSemesterOrder((prev) => [...prev, ...orderedImports.map((semester) => semester.id)])
          setActiveSemesterId(orderedImports[0].id)
        }
        setServerOffline(false)
      } catch (error) {
        if (error instanceof ApiUnavailableError) {
          setServerOffline(true)
        } else {
          console.error("[v0] Failed to import dashboard backup:", error)
        }
      }
    },
    [importPortableCourse, semesters.length],
  )

  const deleteCourse = async (id: string) => {
    if (!activeSemesterId) return

    try {
      if (isServerResourceId(activeSemesterId) && isServerResourceId(id)) {
        await storage.deleteCourse(activeSemesterId, id)
      }
      removeCourseSettings(id)
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

  const handleReorderSemesters = useCallback((orderedIds: string[]) => {
    if (orderedIds.length === 0) return
    setSemesterOrder(orderedIds)
    setSemesters((previous) => {
      const semesterMap = new Map(previous.map((semester) => [semester.id, semester]))
      const reordered = orderedIds
        .map((id) => semesterMap.get(id))
        .filter((semester): semester is Semester => Boolean(semester))
      if (reordered.length === previous.length) {
        return reordered
      }
      const extras = previous.filter((semester) => !orderedIds.includes(semester.id))
      return [...reordered, ...extras]
    })
  }, [])

  const handleReorderCourses = useCallback((semesterId: string, orderedCourseIds: string[]) => {
    if (!semesterId || orderedCourseIds.length === 0) return
    setSemesters((previous) =>
      previous.map((semester) => {
        if (semester.id !== semesterId) return semester
        const courseMap = new Map(semester.courses.map((course) => [course.id, course]))
        const reordered = orderedCourseIds
          .map((courseId) => courseMap.get(courseId))
          .filter((course): course is Course => Boolean(course))
        if (reordered.length === semester.courses.length) {
          return {
            ...semester,
            courses: reordered,
          }
        }
        const extras = semester.courses.filter((course) => !orderedCourseIds.includes(course.id))
        return {
          ...semester,
          courses: [...reordered, ...extras],
        }
      }),
    )
  }, [])

  const editCourse = async (courseId: string, newName: string) => {
    if (!activeSemesterId) return
    const course = courses.find((c) => c.id === courseId)
    if (course) {
      await updateCourse(courseId, { ...course, name: newName })
    }
  }

  const handleBackgroundChange = async (value: string) => {
    if (!activeSemesterId) return
    try {
      await storage.updateSemester(activeSemesterId, { background: value })
      setSemesters((prev) =>
        prev.map((semester) => (semester.id === activeSemesterId ? { ...semester, background: value } : semester)),
      )
      setServerOffline(false)
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setServerOffline(true)
      } else {
        console.error("[v0] Failed to update background:", error)
      }
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

  const backgroundImage = getBackgroundImage(activeBackgroundId)

  return (
    <div
      className="min-h-screen bg-background/80"
      style={{
        backgroundImage,
        backgroundSize: "120% 120%",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
      }}
    >
      <div className="fixed left-4 top-6 z-50 lg:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button className="flex items-center gap-2 border border-border/60 bg-card/80 px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur hover:bg-card">
              <Menu className="h-4 w-4" />
              Overview
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] border-border/40 bg-background/95 p-0 text-foreground sm:w-96">
            <CourseSidebar
              variant="overlay"
              semesters={orderedSemesters}
              activeSemesterId={activeSemesterId}
              onSemesterClick={(id) => {
                setSidebarOpen(false)
                setActiveSemesterId(id)
              }}
              onCourseClick={(id) => {
                setSidebarOpen(false)
                scrollToCourse(id)
              }}
              onAddSemester={addSemester}
              onDeleteSemester={deleteSemester}
              onEditSemester={editSemester}
              onDeleteCourse={deleteCourse}
              onEditCourse={editCourse}
              onExportSemester={exportSemesterToJson}
              onImportSemester={importSemesterFromJson}
              onExportCourse={exportCourseToJson}
              onImportCourse={importCourseFromJson}
              onExportDashboard={exportDashboardBackup}
              onImportDashboard={importDashboardBackup}
              onReorderSemesters={handleReorderSemesters}
              onReorderCourses={handleReorderCourses}
              dashboardSummary={totalSemesters ? dashboardSummary : undefined}
              onDashboardClick={() => {
                setSidebarOpen(false)
                setActiveSemesterId(null)
              }}
              isDashboardActive={isDashboardView}
            />
          </SheetContent>
        </Sheet>
      </div>
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
      {activeSemesterId && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {themePickerOpen && (
            <div
              ref={themePickerRef}
              className="rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-2xl backdrop-blur"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Theme</p>
              <Select value={activeBackgroundId} onValueChange={handleBackgroundChange}>
                <SelectTrigger className="mt-2 border border-border/60 bg-transparent text-foreground">
                  <SelectValue placeholder="Choose background" />
                </SelectTrigger>
                <SelectContent
                  ref={themeSelectContentRef}
                  className="bg-card/95 text-foreground"
                  onMouseDownCapture={() => {
                    recentThemeSelectInteraction.current = Date.now() + 400
                  }}
                >
                  {backgroundOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <button
            ref={themeButtonRef}
            onClick={() => setThemePickerOpen((prev) => !prev)}
            className="rounded-full border border-border/70 bg-card/90 p-3 text-muted-foreground shadow-lg backdrop-blur transition hover:text-foreground"
            title="Change scene"
          >
            <Sparkles className="h-5 w-5" />
          </button>
        </div>
      )}
      <CourseSidebar
        semesters={orderedSemesters}
        activeSemesterId={activeSemesterId}
        onSemesterClick={setActiveSemesterId}
        onCourseClick={scrollToCourse}
        onAddSemester={addSemester}
        onDeleteSemester={deleteSemester}
        onEditSemester={editSemester}
        onDeleteCourse={deleteCourse}
        onEditCourse={editCourse}
        onExportSemester={exportSemesterToJson}
        onImportSemester={importSemesterFromJson}
        onExportCourse={exportCourseToJson}
        onImportCourse={importCourseFromJson}
        onExportDashboard={exportDashboardBackup}
        onImportDashboard={importDashboardBackup}
        onReorderSemesters={handleReorderSemesters}
        onReorderCourses={handleReorderCourses}
        dashboardSummary={totalSemesters ? dashboardSummary : undefined}
        onDashboardClick={() => setActiveSemesterId(null)}
        isDashboardActive={isDashboardView}
        variant="desktop"
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 transition-all duration-300 sm:px-6 lg:px-8 lg:pl-[18rem]">
        {isDashboardView ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mb-4 flex items-center justify-center gap-3">
                <TrendingUp className="h-10 w-10 text-primary" />
                <h1 className="font-sans text-4xl font-bold text-primary">Dashboard</h1>
              </div>
            </div>

            {semesters.length === 0 ? (
              <div className="rounded-lg border border-dashed border-primary/30 bg-card/60 p-6 text-center text-sm text-muted-foreground">
                Add your first semester to populate the dashboard.
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-primary/20 bg-card/70 p-4 text-left shadow-sm">
                    <p className="text-sm text-muted-foreground">Overall GPA</p>
                    <p className="mt-2 flex items-baseline gap-2 text-3xl font-bold text-primary">
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                      {overallGpa.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-card/70 p-4 text-left shadow-sm">
                    <p className="text-sm text-muted-foreground">Total Credits</p>
                    <p className="mt-2 flex items-baseline gap-2 text-3xl font-bold text-primary">
                      <Layers className="h-5 w-5 text-muted-foreground" />
                      {totalCredits}
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-card/70 p-4 text-left shadow-sm">
                    <p className="text-sm text-muted-foreground">Semesters Tracked</p>
                    <p className="mt-2 text-3xl font-bold text-primary">{totalSemesters}</p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <GpaTimelineChart data={timelineData} />
                  {allCourses.length > 0 ? (
                    <GradeDistributionChart title="Overall Grade Distribution" courses={allCourses} />
                  ) : (
                    <div className="rounded-lg border border-primary/20 bg-card/70 p-4 text-sm text-muted-foreground">
                      Add courses to see the overall grade distribution.
                    </div>
                  )}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {semesterSummaries.map((summary) => (
                    <div key={summary.id} className="rounded-lg border border-primary/20 bg-card/80 p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{summary.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDateLabel(summary.createdAt)}</p>
                        </div>
                        <span className="text-lg font-bold text-primary">{summary.gpa.toFixed(2)} GPA</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">Credits: {summary.credits}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mb-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-3">
              <GraduationCap className="h-10 w-10 text-primary" />
              <h1 className="font-sans text-4xl font-bold text-primary">CourseGrade</h1>
            </div>
          </div>
        )}

        {!isDashboardView && courses.length > 0 && (
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <GpaSummary courses={courses} semesterName={activeSemester?.name} />
            <GradeDistributionChart courses={courses} />
          </div>
        )}

        {!isDashboardView && activeSemesterId && (
          <AnimatePresence mode="popLayout">
            <div className="space-y-6">
              {courses.map((course, index) => (
                <motion.div
                  key={`${course.id}-${index}`}
                  ref={(el) => {
                    courseRefs.current[course.id] = el
                  }}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: -20, transition: { duration: 0.25, ease: "easeInOut" } }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <CourseCard
                    course={course}
                    onUpdate={(courseId, nextCourse) => updateCourse(courseId, nextCourse)}
                    onDelete={deleteCourse}
                    onExportCourse={exportCourseToJson}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {activeSemesterId && (
          <>
            <input
              id="course-import-trigger"
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  importCourseFromJson(file, activeSemesterId)
                }
                event.target.value = ""
              }}
            />
            <div className="mt-8 flex justify-center gap-3">
              <Button
                onClick={addCourse}
                size="lg"
                variant="outline"
                className="gap-2 border-secondary/40 bg-transparent text-secondary-foreground"
              >
                <Plus className="h-5 w-5" />
                Add Course
              </Button>
              <Button
                onClick={() => document.getElementById("course-import-trigger")?.click()}
                size="lg"
                variant="outline"
                className="gap-2 border-secondary/40 bg-transparent text-secondary-foreground"
              >
                <Upload className="h-5 w-5" />
                Import Course
              </Button>
            </div>
          </>
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
