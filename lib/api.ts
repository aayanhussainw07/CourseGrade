// API service layer for communicating with Django backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
let apiUserScope = "default"

const normalizeCoursePayload = <T extends Record<string, any> | undefined>(payload: T): T => {
  if (!payload) return payload
  if ("criteria" in payload && !Array.isArray(payload.criteria)) {
    payload.criteria = payload.criteria ? [payload.criteria].flat() : []
  }
  return payload
}

export function setApiUserScope(scope: string | null | undefined) {
  apiUserScope = scope && scope.trim().length > 0 ? scope.trim() : "default"
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
        "X-User-Id": apiUserScope,
        ...options?.headers,
      },
    })
  } catch (error) {
    throw new ApiUnavailableError()
  }

  if (!response.ok) {
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
  getAll: () => apiFetch<any[]>("/semesters/"),

  getOne: (id: string) => apiFetch<any>(`/semesters/${id}/`),

  create: (data: { name: string; background?: string; timeline_date?: string | null }) =>
    apiFetch<any>("/semesters/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ name: string; background: string; timeline_date: string | null }>) =>
    apiFetch<any>(`/semesters/${id}/`, {
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
    return apiFetch<any[]>(url)
  },

  getOne: (id: string) => apiFetch<any>(`/courses/${id}/`),

  create: (data: {
    semester: string
    name: string
    credits: number
    is_pass_fail?: boolean
    percent_boost?: number
    criteria?: unknown
  }) =>
    apiFetch<any>("/courses/", {
      method: "POST",
      body: JSON.stringify(normalizeCoursePayload(data)),
    }),

  update: (
    id: string,
    data: Partial<{ name: string; credits: number; is_pass_fail: boolean; percent_boost: number; criteria?: unknown }>,
  ) =>
    apiFetch<any>(`/courses/${id}/`, {
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
    return apiFetch<any[]>(url)
  },

  getOne: (id: string) => apiFetch<any>(`/assignments/${id}/`),

  create: (data: { course: string; name: string; weight: number; earned: number; total: number; drop_lowest?: number }) =>
    apiFetch<any>("/assignments/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ name: string; weight: number; earned: number; total: number; drop_lowest: number }>) =>
    apiFetch<any>(`/assignments/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/assignments/${id}/`, {
      method: "DELETE",
    }),
}

// Grade Scale API calls
export const gradeScaleApi = {
  getAll: () => apiFetch<any[]>("/grade-scales/"),

  create: (data: { letter: string; min_percentage: number; gpa_value: number }) =>
    apiFetch<any>("/grade-scales/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ letter: string; min_percentage: number; gpa_value: number }>) =>
    apiFetch<any>(`/grade-scales/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/grade-scales/${id}/`, {
      method: "DELETE",
    }),

  resetDefault: () =>
    apiFetch<any[]>("/grade-scales/reset_default/", {
      method: "POST",
    }),
}
