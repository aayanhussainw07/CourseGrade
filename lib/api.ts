// API service layer for communicating with Django backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
let apiUserScope = "default"

export function setApiUserScope(scope: string | null | undefined) {
  apiUserScope = scope && scope.trim().length > 0 ? scope.trim() : "default"
}

export class ApiUnavailableError extends Error {
  constructor(message = "Server is offline. Please try again later.") {
    super(message)
    this.name = "ApiUnavailableError"
  }
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
    const error = await response.json().catch(() => ({ detail: "An error occurred" }))
    throw new Error(error.detail || `API error: ${response.status}`)
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

  create: (data: { name: string }) =>
    apiFetch<any>("/semesters/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name: string }) =>
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

  create: (data: { semester: string; name: string; credits: number }) =>
    apiFetch<any>("/courses/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ name: string; credits: number }>) =>
    apiFetch<any>(`/courses/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
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

  create: (data: { course: string; name: string; weight: number; earned: number; total: number }) =>
    apiFetch<any>("/assignments/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ name: string; weight: number; earned: number; total: number }>) =>
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
