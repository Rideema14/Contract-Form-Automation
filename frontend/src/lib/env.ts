// Only public values belong here. NEXT_PUBLIC_ variables are included in
// browser code: never put database URLs, JWT secrets or Google credentials here.
export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api",
};
