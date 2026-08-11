const isLocal = window.location.hostname === "localhost"
  || window.location.hostname === "127.0.0.1"
  || window.location.protocol === "file:";

const API_URL = isLocal
  ? "http://localhost:8088"
  : "https://jewelry-backend-nine.vercel.app";