const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export { API_URL };

const TOKEN_KEY = "ia_token";
const USER_KEY = "ia_user";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders(extra = {}) {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, ...extra }
    : extra;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...authHeaders(options.headers) },
    });
  } catch {
    throw new ApiError(
      "Could not reach the InterviewAI server. Confirm the backend is running.",
      0
    );
  }

  if (response.status === 401 && getToken()) {
    // Token expired/invalid — drop it so the next navigation hits the login page.
    clearSession();
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      /* response had no JSON body */
    }
    throw new ApiError(detail, response.status);
  }

  return response.json();
}

export const api = {
  register: (payload) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => request("/api/auth/me"),

  startInterview: (payload) =>
    request("/api/interviews", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submitAnswer: (sessionId, payload) =>
    request(`/api/interviews/${sessionId}/answers`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getInterview: (sessionId) => request(`/api/interviews/${sessionId}`),

  listInterviews: () => request("/api/interviews"),

  getReport: (sessionId) => request(`/api/interviews/${sessionId}/report`),
};

export { ApiError };
