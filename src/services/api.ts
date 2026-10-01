/**
 * frontend/src/services/api.ts
 * ----------------------------
 * REST API client kết nối trực tiếp với SmartCampus AI Service & Edge Gateway.
 */

export interface RoomData {
  id: string;
  name: string;
  building?: string;
  floor?: number;
  capacity?: number;
  mode: string;
  previous_mode?: string;
  temperature?: number | null;
  humidity?: number | null;
  co2?: number | null;
  occupancy: number;
  door_locked: boolean;
  fan_on: boolean;
  smoke?: string;
  status: "online" | "warning";
}

export interface RecommendationItem {
  id: string;
  event_id?: string;
  room_id?: string;
  tool_name: string;
  tool_params: Record<string, any>;
  reason?: string;
  confidence?: number;
  urgency?: string;
  status: string; // "pending" | "approved" | "rejected" | "auto_approved"
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface DeviceItem {
  id: string;
  mac_address: string;
  name?: string;
  device_type?: string;
  firmware_version?: string;
  room_id?: string;
  status: "online" | "offline" | "provisioning";
  last_heartbeat?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: "admin" | "lecturer" | "student";
  is_active: boolean;
  avatar_url?: string;
}

// Token & User storage keys
const TOKEN_KEY = "smartcampus_jwt_token";
const USER_KEY = "smartcampus_user_profile";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): UserProfile | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserProfile | null): void {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export async function login(username: string, password: string): Promise<UserProfile> {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);

  const resp = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Đăng nhập thất bại" }));
    throw new Error(err.detail || "Sai tên đăng nhập hoặc mật khẩu");
  }

  const data = await resp.json();
  if (data.access_token) {
    setToken(data.access_token);
  }

  const profile = await getMe();
  setStoredUser(profile);
  return profile;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function getMe(): Promise<UserProfile> {
  const res = await authFetch("/api/auth/me");
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const user = await res.json();
  setStoredUser(user);
  return user;
}

/**
 * Tự động đảm bảo có Admin Token để demo nếu chưa đăng nhập.
 */
export async function ensureAdminAuth(): Promise<UserProfile> {
  const existing = getToken();
  if (existing) {
    try {
      return await getMe();
    } catch {
      // Token hết hạn, thử đăng nhập lại
    }
  }

  try {
    // 1. Thử tạo root admin nếu chưa có
    await fetch("/api/auth/rootadmin", { method: "POST" }).catch(() => {});

    // 2. Đăng nhập mặc định admin
    return await login("admin", "admin123456");
  } catch (e) {
    console.warn("Không thể auto-login admin token, tiếp tục ở chế độ guest:", e);
    return {
      id: "guest",
      username: "guest",
      email: "guest@smartcampus.local",
      full_name: "Khách",
      role: "student",
      is_active: true,
    };
  }
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getToken();
  if (!token) {
    await ensureAdminAuth();
    token = getToken();
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}

// ---------------------------------------------------------------------------
// Room APIs
// ---------------------------------------------------------------------------
export async function getRooms(): Promise<RoomData[]> {
  try {
    const res = await authFetch("/api/rooms");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      building: r.building || "A",
      floor: r.floor || 1,
      capacity: r.capacity || 40,
      mode: r.mode || "SAVING",
      previous_mode: r.previous_mode,
      temperature: r.temperature !== null ? r.temperature : null,
      humidity: r.humidity !== null ? r.humidity : null,
      co2: r.co2 !== null ? r.co2 : null,
      occupancy: r.occupancy || 0,
      door_locked: Boolean(r.door_locked),
      fan_on: Boolean(r.fan_on),
      smoke: r.mode === "EMERGENCY" ? "Báo động khói" : r.mode === "SUSPECTED" ? "Nghi ngờ" : "Bình thường",
      status: r.mode === "EMERGENCY" || r.mode === "SUSPECTED" ? "warning" : "online",
    }));
  } catch (err) {
    console.warn("Lỗi khi tải rooms từ API, sử dụng fallback:", err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Recommendations & HITL APIs
// ---------------------------------------------------------------------------
export async function getRecommendations(status = "all"): Promise<RecommendationItem[]> {
  try {
    const url = status === "all" ? "/api/recommendations" : `/api/recommendations?status=${status}`;
    const res = await authFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.map((r: any) => ({
      ...r,
      id: String(r.id || r.recommendation_id || ""),
    }));
  } catch (err) {
    console.warn("Lỗi khi tải recommendations:", err);
    return [];
  }
}

export async function executeRecommendation(
  recId: string,
  action: "approve" | "reject",
  notes?: string
): Promise<any> {
  const cleanId = String(recId || "").trim();
  if (!cleanId || cleanId === "undefined" || cleanId === "null") {
    throw new Error("Mã đề xuất (recommendation_id) không hợp lệ (undefined)!");
  }
  const res = await authFetch(`/api/recommendations/${cleanId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, notes }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Execute failed (${res.status}): ${errText}`);
  }
  return await res.json();
}

export async function getHitlStatus(): Promise<boolean> {
  try {
    const res = await fetch("/api/recommendations/hitl/status");
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.hitl_enabled);
    }
  } catch (err) {
    console.warn("Không thể lấy trạng thái HITL:", err);
  }
  return true;
}

export async function toggleHitl(enabled?: boolean): Promise<{ hitl_enabled: boolean; message: string }> {
  const res = await authFetch("/api/recommendations/hitl/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enabled !== undefined ? { enabled } : {}),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Toggle HITL failed: ${errText}`);
  }
  return await res.json();
}

// ---------------------------------------------------------------------------
// Devices API
// ---------------------------------------------------------------------------
export async function getDevices(): Promise<DeviceItem[]> {
  try {
    const res = await authFetch("/api/devices");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Lỗi khi tải devices:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Chat / AI Assistant Query
// ---------------------------------------------------------------------------
export async function askAiAssistant(question: string, roomId?: string): Promise<string> {
  const res = await authFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: question, room_id: roomId }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: "Lỗi kết nối AI Assistant" }));
    throw new Error(errData.detail || `Lỗi AI Service: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.reply || data.response || "Đã nhận câu trả lời từ AI Agent.";
}

// ---------------------------------------------------------------------------
// Users Management API (Admin only)
// ---------------------------------------------------------------------------
export async function getUsers(): Promise<UserProfile[]> {
  try {
    const res = await authFetch("/api/users");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.users || [];
  } catch (err) {
    console.warn("Lỗi khi tải users:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Corridor Node RFID Card Registration & Approval (FR-RF-01)
// ---------------------------------------------------------------------------
export interface CardRegistrationRequestItem {
  request_id: string;
  card_uid: string;
  mac_address?: string;
  room_id?: string;
  status: "pending" | "approved" | "rejected";
  assigned_user_id?: string;
  assigned_user_name?: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getCardRegistrationRequests(
  status?: string
): Promise<CardRegistrationRequestItem[]> {
  try {
    const url = status ? `/api/rfid/requests?status=${status}` : "/api/rfid/requests";
    const res = await authFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Lỗi khi tải danh sách yêu cầu đăng ký thẻ:", err);
    return [];
  }
}

export async function approveCardRegistration(
  requestId: string,
  payload: { user_id?: string; full_name?: string; username?: string; role?: string }
): Promise<CardRegistrationRequestItem> {
  const res = await authFetch(`/api/rfid/requests/${requestId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Duyệt thẻ thất bại: ${err}`);
  }
  return await res.json();
}

export async function rejectCardRegistration(
  requestId: string,
  reason?: string
): Promise<CardRegistrationRequestItem> {
  const res = await authFetch(`/api/rfid/requests/${requestId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Từ chối thẻ thất bại: ${err}`);
  }
  return await res.json();
}

export async function simulateCorridorCardScan(
  cardUid?: string,
  macAddress?: string
): Promise<{ success: boolean; message: string; card_uid: string; mac_address: string }> {
  const res = await authFetch("/api/rfid/requests/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card_uid: cardUid, mac_address: macAddress }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mô phỏng quét thẻ thất bại: ${err}`);
  }
  return await res.json();
}

// ---------------------------------------------------------------------------
// Real Audit Logs & Tool Activity API
// ---------------------------------------------------------------------------
export interface AuditLogItem {
  id: string;
  timestamp: string;
  date: string;
  type: "Agent Tool Calls" | "Fallback Audit";
  component: string;
  target: string;
  detail: string;
  level: "INFO" | "WARN" | "ERROR";
  room_id?: string;
  event_id?: string;
}

export async function getAuditLogs(logType?: string): Promise<AuditLogItem[]> {
  try {
    const url = logType ? `/api/audit-logs?log_type=${encodeURIComponent(logType)}` : "/api/audit-logs";
    const res = await authFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Lỗi khi tải audit logs:", err);
    return [];
  }
}

export async function downloadAuditCsv(logType?: string): Promise<void> {
  const url = logType ? `/api/audit-logs/export?log_type=${encodeURIComponent(logType)}` : "/api/audit-logs/export";
  const token = getToken();
  const resp = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error(`Lỗi xuất CSV: HTTP ${resp.status}`);
  const blob = await resp.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `smartcampus_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

// ---------------------------------------------------------------------------
// Real TimescaleDB Telemetry History & Room Stats API
// ---------------------------------------------------------------------------
export interface TelemetryPoint {
  bucket: string;
  room_id?: string;
  temperature: number;
  humidity: number;
  smoke: number;
  co2: number;
  air_quality: number;
  time_label: string;
}

export async function getTelemetryHistory(roomId?: string, limit = 30): Promise<TelemetryPoint[]> {
  try {
    const params = new URLSearchParams();
    if (roomId) params.set("room_id", roomId);
    params.set("limit", String(limit));
    const res = await authFetch(`/api/telemetry/history?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Lỗi khi tải lịch sử telemetry:", err);
    return [];
  }
}

export interface RoomTelemetryStats {
  room_id: string;
  temperature: { min: number; max: number; avg: number; latest: number };
  humidity: { min: number; max: number; avg: number; latest: number };
  smoke: { min: number; max: number; avg: number; latest: number };
  co2: { min: number; max: number; avg: number; latest: number };
  occupancy: { total_in: number; total_out: number; current: number };
  fsm_history?: Array<{ time: string; text: string }>;
}

export async function getRoomTelemetryStats(roomId: string): Promise<RoomTelemetryStats | null> {
  try {
    const res = await authFetch(`/api/telemetry/stats/${roomId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Real System Services Health API
// ---------------------------------------------------------------------------
export interface SystemHealthStatus {
  edge_gateway: { name: string; port: number; status: "online" | "offline" };
  ai_service: { name: string; port: number; status: "online" | "offline" };
  mqtt_broker: { name: string; port: number; status: "ready" | "offline" };
  database: { name: string; port: number; status: "online" | "offline" };
}

export async function getSystemHealth(): Promise<SystemHealthStatus | null> {
  try {
    const res = await authFetch("/api/system/health");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Real Recent Events API
// ---------------------------------------------------------------------------
export interface RecentEventItem {
  id: string;
  event_id: string;
  title: string;
  description: string;
  time: string;
  tone: "amber" | "blue" | "green";
  type: string;
  rec_id?: string;
}

export async function getRecentEvents(): Promise<RecentEventItem[]> {
  try {
    const res = await authFetch("/api/events/recent");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}



