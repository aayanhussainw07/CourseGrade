// API service layer for communicating with backend service
import type { ApiAssignment, ApiCourse, ApiGradeScale, ApiSemester } from "./types"

const API_BASE_URL = "/api/backend"

export type ApiListResponse<T> = T[] | { results?: T[] | null }

type SemesterPayload = {
  name: string
  background?: string
  timeline_date?: string | null
  ignored?: boolean
}

type CourseAssignmentPayload = {
  name: string
  weight: number
  earned: number
  total: number
  drop_lowest?: number
}

type CoursePayload = {
  semester: string
  name: string
  credits: number
  is_pass_fail?: boolean
  percent_boost?: number
  header_color?: string | null
  assignments?: CourseAssignmentPayload[]
  criteria?: unknown
}

type AssignmentPayload = {
  course: string
  name: string
  weight: number
  earned: number
  total: number
  drop_lowest?: number
}

type GradeScalePayload = {
  letter: string
  min_percentage: number
  gpa_value: number
}

export const extractApiList = <T>(payload: ApiListResponse<T>): T[] => {
  if (Array.isArray(payload)) return payload
  const results = payload?.results
  return Array.isArray(results) ? results : []
}

const normalizeCoursePayload = <T extends Record<string, unknown> | undefined>(payload: T): T => {
  if (!payload) return payload
  if ("criteria" in payload && !Array.isArray(payload.criteria)) {
    const criteria = (payload as { criteria?: unknown }).criteria
    ;(payload as { criteria?: unknown[] }).criteria = criteria ? [criteria].flat() : []
  }
  return payload
}

export function setApiUserScope(scope: string | null | undefined) {
  void scope
}

export class ApiUnavailableError extends Error {
  constructor(message = "Server is offline. Please try again later.") {
    super(message)
    this.name = "ApiUnavailableError"
  }
}

const formatErrorPayload = (payload: unknown): string | null => {
  if (payload == null) return null

  if (typeof payload === "string") {
    return payload
  }

  if (Array.isArray(payload)) {
    const parts = payload
      .map((item) => formatErrorPayload(item) ?? (typeof item === "object" ? JSON.stringify(item) : String(item)))
      .filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join(" | ") : null
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>
    if (typeof record.detail === "string") {
      return record.detail
    }
    const parts = Object.entries(record)
      .map(([key, value]) => {
        const formatted = formatErrorPayload(value)
        if (!formatted) return null
        return `${key}: ${formatted}`
      })
      .filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join(" | ") : null
  }

  return null
}

// Generic fetch wrapper with error handling
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
  } catch (error) {
    throw new ApiUnavailableError()
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new ApiUnavailableError()
    }
    const errorText = await response.text().catch(() => "")
    let message = `API error: ${response.status}`
    if (errorText) {
      try {
        const parsed = JSON.parse(errorText)
        message = formatErrorPayload(parsed) ?? message
      } catch {
        message = errorText
      }
    }
    throw new Error(message)
  }

  if (response.status === 204 || response.headers.get("Content-Length") === "0") {
    return undefined as T
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  return JSON.parse(text) as T
}

// Semester API calls
export const semesterApi = {
  getAll: () => apiFetch<ApiListResponse<ApiSemester>>("/semesters/"),

  getOne: (id: string) => apiFetch<ApiSemester>(`/semesters/${id}/`),

  create: (data: SemesterPayload) =>
    apiFetch<ApiSemester>("/semesters/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<SemesterPayload>) =>
    apiFetch<ApiSemester>(`/semesters/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/semesters/${id}/`, {
      method: "DELETE",
    }),
}

// Course API calls
export const courseApi = {
  getAll: (semesterId?: string) => {
    const url = semesterId ? `/courses/?semester=${semesterId}` : "/courses/"
    return apiFetch<ApiListResponse<ApiCourse>>(url)
  },

  getOne: (id: string) => apiFetch<ApiCourse>(`/courses/${id}/`),

  create: (data: CoursePayload) =>
    apiFetch<ApiCourse>("/courses/", {
      method: "POST",
      body: JSON.stringify(normalizeCoursePayload(data)),
    }),

  update: (id: string, data: Partial<CoursePayload>) =>
    apiFetch<ApiCourse>(`/courses/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(normalizeCoursePayload(data)),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/courses/${id}/`, {
      method: "DELETE",
    }),
}

// Assignment API calls
export const assignmentApi = {
  getAll: (courseId?: string) => {
    const url = courseId ? `/assignments/?course=${courseId}` : "/assignments/"
    return apiFetch<ApiListResponse<ApiAssignment>>(url)
  },

  getOne: (id: string) => apiFetch<ApiAssignment>(`/assignments/${id}/`),

  create: (data: AssignmentPayload) =>
    apiFetch<ApiAssignment>("/assignments/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<AssignmentPayload>) =>
    apiFetch<ApiAssignment>(`/assignments/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/assignments/${id}/`, {
      method: "DELETE",
    }),
}

// User settings
export const settingsApi = {
  get: () => apiFetch<Record<string, unknown>>("/settings/"),

  save: (data: Record<string, unknown>) =>
    apiFetch<Record<string, unknown>>("/settings/", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
}

// Syllabus AI import
export type SyllabusExtracted = {
  courseName: string
  credits: number
  isPassFail: boolean
  assignments: Array<{ name: string; weight: number; drop_lowest: number }>
}

export const syllabusApi = {
  analyze: async (
    formData: FormData,
  ): Promise<{ extracted: SyllabusExtracted; importsRemaining: number }> => {
    const response = await fetch("/api/syllabus", {
      method: "POST",
      body: formData,
      // Do NOT set Content-Type — browser sets multipart boundary automatically
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.error || `Error ${response.status}`) as Error & {
        code?: string
        status?: number
        retryAfterSeconds?: number
      }
      error.code = payload.code
      error.status = response.status
      error.retryAfterSeconds = payload.retryAfterSeconds
      throw error
    }
    return payload
  },
}

// Grade Scale API calls
export const gradeScaleApi = {
  getAll: () => apiFetch<ApiListResponse<ApiGradeScale>>("/grade-scales/"),

  create: (data: GradeScalePayload) =>
    apiFetch<ApiGradeScale>("/grade-scales/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<GradeScalePayload>) =>
    apiFetch<ApiGradeScale>(`/grade-scales/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/grade-scales/${id}/`, {
      method: "DELETE",
    }),

  resetDefault: () =>
    apiFetch<ApiListResponse<ApiGradeScale>>("/grade-scales/reset_default/", {
      method: "POST",
    }),
}
