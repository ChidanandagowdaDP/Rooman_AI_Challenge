const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new ApiError(
      "Could not reach the InterviewAI server. Confirm the backend is running.",
      0
    );
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

  getReport: (sessionId) => request(`/api/interviews/${sessionId}/report`),
};

export { ApiError };
