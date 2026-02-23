import axios from "axios";
import { TOKEN_STORAGE_KEY } from "../constants/storage";

function normalizeApiUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const withProtocol = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  const withoutTrailingSlash = withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;

  if (withoutTrailingSlash.endsWith("/api")) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/api`;
}

const configuredApiUrl = normalizeApiUrl(import.meta.env.VITE_API_URL);
const apiBaseUrl = configuredApiUrl || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");

const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || "حدث خطأ أثناء تنفيذ الطلب";
    return Promise.reject(new Error(message));
  }
);

export default http;
