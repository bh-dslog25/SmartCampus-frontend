import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  Clock3,
  Copy,
  Cpu,
  CreditCard,
  Database,
  DoorOpen,
  Fan,
  FileClock,
  History,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Power,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Thermometer,
  User,
  UserCheck,
  Users,
  Wind,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  ensureAdminAuth,
  getRooms,
  getRecommendations,
  executeRecommendation,
  getHitlStatus,
  toggleHitl,
  getDevices,
  getUsers,
  getCardRegistrationRequests,
  approveCardRegistration,
  rejectCardRegistration,
  simulateCorridorCardScan,
  type CardRegistrationRequestItem,
  askAiAssistant,
  login,
  logout,
  getMe,
  getStoredUser,
  getAuditLogs,
  downloadAuditCsv,
  getTelemetryHistory,
  getRoomTelemetryStats,
  getSystemHealth,
  getRecentEvents,
  type AuditLogItem,
  type TelemetryPoint,
  type RoomTelemetryStats,
  type SystemHealthStatus,
  type RecentEventItem,
  type RoomData,
  type RecommendationItem,
  type DeviceItem,
  type UserProfile,
} from "./services/api";
import { campusWs } from "./services/websocket";

type Page =
  | "Dashboard"
  | "Alerts & Decisions"
  | "Corridor RFID"
  | "History & Devices"
  | "Audit Logs"
  | "AI Assistant"
  | "Settings";

export type Room = {
  id: string;
  name: string;
  type: string;
  mode: string;
  temp: string;
  humidity: string;
  co2: string;
  smoke: string;
  occupancy: number;
  status: "online" | "warning";
  fan_on?: boolean;
  door_locked?: boolean;
};

const initialRooms: Room[] = [];
const initialRecommendations: RecommendationItem[] = [];

const nav: { name: Page; icon: any }[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Alerts & Decisions", icon: AlertTriangle },
  { name: "Corridor RFID", icon: CreditCard },
  { name: "History & Devices", icon: History },
  { name: "Audit Logs", icon: FileClock },
  { name: "AI Assistant", icon: MessageSquareText },
  { name: "Settings", icon: Settings },
];


function IconButton({ children, label, onClick }: { children: ReactNode; label: string; onClick?: () => void }) {
  return <button aria-label={label} className="icon-button" onClick={onClick}>{children}</button>;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Panel({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <section className={`panel ${className}`} style={style}>{children}</section>;
}

function SectionHead({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div><h2>{title}</h2>{hint && <p>{hint}</p>}</div>
      {action}
    </div>
  );
}

function UserRoleBadge({ role }: { role?: string }) {
  if (role === "admin") return <span className="role-badge admin">Quản trị viên</span>;
  if (role === "lecturer") return <span className="role-badge lecturer">Giảng viên</span>;
  return <span className="role-badge student">Sinh viên</span>;
}

function HitlToggleSwitch({
  enabled,
  loading,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  loading?: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`hitl-toggle-container ${enabled ? "active" : "autopilot"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      onClick={() => !loading && onToggle()}
      title={
        disabled
          ? "Bạn không có quyền bật/tắt HITL (Yêu cầu tài khoản Quản trị viên - Admin)."
          : enabled
          ? "Chế độ HITL BẬT: Mọi hành động AI cần Quản trị viên duyệt trước khi chạy phần cứng."
          : "Chế độ Autopilot: AI tự động phát lệnh sang Edge Gateway & ESP32 mà không cần chờ duyệt."
      }
    >
      <div className={`toggle-switch ${enabled ? "on" : "off"}`}>
        <div className="toggle-knob" />
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        {loading ? (
          <Loader2 size={13} className="spin text-blue-600" />
        ) : enabled ? (
          <ShieldCheck size={14} className="text-emerald-700" />
        ) : (
          <Zap size={14} className="text-amber-700" />
        )}
        <strong>{enabled ? "HITL: Cần duyệt" : "Autopilot: Tự động"}</strong>
      </span>
    </div>
  );
}

function LoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (u?: string, p?: string) => {
    const finalU = u || username;
    const finalP = p || password;
    if (!finalU || !finalP) {
      setError("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const user = await login(finalU, finalP);
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Tài khoản hoặc mật khẩu không chính xác");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="login-card">
        <div className="login-head">
          <div className="brand-logo"><Building2 size={24} /></div>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: 16 }}>SmartCampus RBAC</h3>
            <p style={{ margin: 0, fontSize: 10, color: "#94a3b8" }}>Đăng nhập tài khoản phân quyền</p>
          </div>
          <button style={{ marginLeft: "auto", background: "none", border: 0, color: "#94a3b8", cursor: "pointer" }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="login-body">
          {error && (
            <div className="result-banner error" style={{ margin: "0 0 14px", padding: "8px 12px" }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <div className="input-group">
              <label>Tên đăng nhập hoặc Email</label>
              <input
                placeholder="vd: admin, lecturer, student..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>Mật khẩu</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="primary-button wide"
              style={{ height: 38, fontSize: 11, marginTop: 6 }}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}
              Đăng nhập hệ thống
            </button>
          </form>

          <div className="quick-login-section">
            <h4>Đăng nhập nhanh theo Role (Demo RBAC)</h4>
            <div className="quick-login-grid">
              <button
                type="button"
                className="quick-login-btn"
                onClick={() => handleLogin("admin", "admin123456")}
              >
                <span>👑</span>
                <strong>Quản trị viên</strong>
                <small>Full quyền</small>
              </button>
              <button
                type="button"
                className="quick-login-btn"
                onClick={() => handleLogin("lecturer", "lecturer123456")}
              >
                <span>👨‍🏫</span>
                <strong>Giảng viên</strong>
                <small>Duyệt lệnh phòng</small>
              </button>
              <button
                type="button"
                className="quick-login-btn"
                onClick={() => handleLogin("student", "student123456")}
              >
                <span>🎓</span>
                <strong>Sinh viên</strong>
                <small>Chỉ xem (Readonly)</small>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DigitalTwin({ rooms, onRoom }: { rooms: Room[]; onRoom: (room: Room) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const host = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(8, 8, 10);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const light = new THREE.DirectionalLight(0xffffff, 2.4);
    light.position.set(5, 9, 4);
    light.castShadow = true;
    scene.add(light);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0xe7ebf0, roughness: 0.8 }),
    );
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    scene.add(floor);

    const roomCount = rooms.length;
    const cols = Math.min(3, Math.max(2, Math.ceil(roomCount / 2)));
    const roomGeometry = new THREE.BoxGeometry(2.35, 0.65, 2.2);
    const meshes: THREE.Mesh[] = [];

    rooms.forEach((currentRoom, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const posX = (col - (cols - 1) / 2) * 2.8;
      const posZ = (row - 0.5) * 2.6;

      const color =
        currentRoom.status === "warning"
          ? 0xf59e0b
          : currentRoom.mode === "SAVING"
          ? 0x94a3b8
          : 0x3b82f6;
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.64 });
      const mesh = new THREE.Mesh(roomGeometry, material);
      mesh.position.set(posX, 0.28, posZ);
      mesh.castShadow = true;
      mesh.userData.roomIndex = index;
      scene.add(mesh);
      meshes.push(mesh);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(roomGeometry),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
      );
      edge.position.copy(mesh.position);
      scene.add(edge);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const selectRoom = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const target = raycaster.intersectObjects(meshes)[0]?.object as THREE.Mesh | undefined;
      if (target && rooms[target.userData.roomIndex]) {
        onRoom(rooms[target.userData.roomIndex]);
      }
    };
    renderer.domElement.addEventListener("pointerdown", selectRoom);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      scene.rotation.y = Math.sin(Date.now() * 0.00015) * 0.08;
      renderer.render(scene, camera);
    };
    animate();
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", selectRoom);
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [rooms, onRoom]);

  return (
    <div className="twin-wrap">
      <div className="twin-stage" ref={mountRef} />
      <div className="twin-title">
        <span className="eyebrow">DIGITAL TWIN · TẦNG 1–2</span>
        <strong>Khối giảng đường A</strong>
        <span>Chọn một phòng để xem ngữ cảnh vận hành</span>
      </div>
      <div className="twin-legend">
        <span><i className="dot blue" />Đang hoạt động</span>
        <span><i className="dot amber" />Cần chú ý</span>
        <span><i className="dot gray" />Tiết kiệm</span>
      </div>
      <div className="twin-labels">
        {rooms.map((room) => (
          <button key={room.id} onClick={() => onRoom(room)}>{room.id}</button>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon, label, value, meta, tone = "blue" }: { icon: ReactNode; label: string; value: string; meta: string; tone?: string }) {
  return (
    <Panel className="metric">
      <span className={`metric-icon ${tone}`}>{icon}</span>
      <div><p>{label}</p><strong>{value}</strong><span>{meta}</span></div>
    </Panel>
  );
}

function Dashboard({
  rooms,
  recommendations,
  hitlEnabled,
  onToggleHitl,
  hitlLoading,
  openRoom,
  openDecision,
  currentUser,
  recentEvents,
}: {
  rooms: Room[];
  recommendations: RecommendationItem[];
  hitlEnabled: boolean;
  onToggleHitl: () => void;
  hitlLoading: boolean;
  openRoom: (r: Room) => void;
  openDecision: (rec?: RecommendationItem) => void;
  currentUser: UserProfile | null;
  recentEvents: RecentEventItem[];
}) {
  const warningRooms = rooms.filter((r) => r.status === "warning");
  const savingRooms = rooms.filter((r) => r.mode === "SAVING");
  const pendingRecs = recommendations.filter((r) => r.status === "pending");
  const latestRec = recommendations[0];
  const focusRoom = warningRooms[0] || rooms.find((r) => r.mode !== "SAVING") || rooms[0];

  const co2Num = focusRoom?.co2 ? parseFloat(focusRoom.co2.replace(/[^0-9.]/g, "")) : 0;
  const aqiVal = co2Num > 800 ? "Kém" : co2Num > 600 ? "Trung bình" : "Tốt";

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">TỔNG QUAN VẬN HÀNH · RBAC ACTIVE</span>
          <h1>Chào mừng, {currentUser?.full_name || currentUser?.username || "Người dùng"}</h1>
          <p>Hệ thống giám sát FSM campus kết hợp AI Agent, RBAC và cơ chế Human-in-the-Loop.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <HitlToggleSwitch
            enabled={hitlEnabled}
            loading={hitlLoading}
            onToggle={onToggleHitl}
            disabled={currentUser?.role !== "admin"}
          />
          <div className="status-live"><i /> LIVE · Đã kết nối Edge & AI</div>
        </div>
      </div>

      {!hitlEnabled && (
        <div className="autopilot-notice">
          <Zap size={16} />
          <span>
            <b>Đang chạy ở chế độ Autopilot:</b> AI Agent sẽ tự động gửi lệnh điều khiển xuống Edge Gateway và thiết bị phần cứng ngay khi có đề xuất mà không cần Quản trị viên duyệt tay.
          </span>
        </div>
      )}

      <div className="metrics">
        <Metric icon={<Building2 />} label="Tổng số phòng" value={`0${rooms.length}`} meta="Cấu hình trực tiếp từ DB" />
        <Metric
          icon={<AlertTriangle />}
          label="Phòng cần chú ý"
          value={warningRooms.length > 0 ? `0${warningRooms.length}` : "00"}
          meta={warningRooms.length > 0 ? `${warningRooms[0].id} · ${warningRooms[0].mode}` : "An toàn"}
          tone={warningRooms.length > 0 ? "amber" : "green"}
        />
        <Metric
          icon={<Activity />}
          label="Phòng hoạt động"
          value={`0${rooms.length - savingRooms.length}`}
          meta={`${savingRooms.length} phòng đang SAVING`}
          tone="green"
        />
        <Metric
          icon={<ShieldAlert />}
          label="Quyết định chờ duyệt"
          value={`0${pendingRecs.length}`}
          meta={hitlEnabled ? "Chờ duyệt tay" : "Autopilot tự động"}
          tone={pendingRecs.length > 0 ? "amber" : "slate"}
        />
        <Metric icon={<ShieldCheck />} label="Vai trò hiện tại" value={currentUser?.role?.toUpperCase() || "ADMIN"} meta={currentUser?.email || "RBAC"} tone="green" />
      </div>

      <div className="dashboard-grid">
        <Panel className="digital-panel">
          <SectionHead title="Bản sao số Campus (Digital Twin 3D)" hint="Mô hình không gian thời gian thực" action={<Badge tone="info">3D TWIN</Badge>} />
          <DigitalTwin rooms={rooms} onRoom={openRoom} />
        </Panel>
        <Panel className="sensor-panel">
          <SectionHead title="Cảm biến thời gian thực" hint={focusRoom ? `Dữ liệu live từ ${focusRoom.name}` : "Giá trị từ Edge Gateway"} action={<MoreHorizontal size={18} />} />
          <div className="sensor-list">
            {focusRoom ? (
              [
                { icon: <Thermometer />, name: "Nhiệt độ", value: focusRoom.temp || "--", room: focusRoom.name, time: "Vừa xong", tone: "amber" },
                { icon: <Wind />, name: "Độ ẩm", value: focusRoom.humidity || "--", room: focusRoom.name, time: "Vừa xong", tone: "blue" },
                { icon: <Activity />, name: "CO₂", value: focusRoom.co2 || "--", room: focusRoom.name, time: "Vừa xong", tone: "blue" },
                { icon: <AlertTriangle />, name: "Khói", value: focusRoom.smoke || "Bình thường", room: focusRoom.name, time: "Vừa xong", tone: focusRoom.smoke === "Bình thường" ? "green" : "amber" },
                { icon: <CircleGauge />, name: "Chất lượng KK", value: aqiVal, room: focusRoom.name, time: "Vừa xong", tone: aqiVal === "Tốt" ? "green" : aqiVal === "Kém" ? "amber" : "blue" },
              ].map((sensor) => (
                <div className="sensor-row" key={sensor.name}>
                  <span className={`sensor-icon ${sensor.tone}`}>{sensor.icon}</span>
                  <div><strong>{sensor.name}</strong><span>{sensor.room} · {sensor.time}</span></div>
                  <b>{sensor.value}</b>
                </div>
              ))
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 12 }}>
                Đang kết nối cảm biến Edge...
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel className="room-section">
        <SectionHead title="Giám sát phòng" hint="Trạng thái FSM và telemetry mới nhất từ Edge Gateway" action={<button className="text-button" onClick={() => window.scrollTo({ top: 300, behavior: 'smooth' })}>Xem sơ đồ tầng <ChevronRight size={15} /></button>} />
        <div className="room-grid">
          {rooms.map((r) => (
            <button className="room-card" key={r.id} onClick={() => openRoom(r)}>
              <div className="room-card-head">
                <div><strong>{r.name}</strong><span>{r.type} · {r.id.slice(0, 8)}</span></div>
                <Badge tone={r.status === "warning" ? "warning" : "success"}>{r.mode}</Badge>
              </div>
              <div className="room-readings">
                <span>Nhiệt độ <b>{r.temp}</b></span>
                <span>Độ ẩm <b>{r.humidity}</b></span>
                <span>CO₂ <b>{r.co2}</b></span>
                <span>Số người <b>{r.occupancy}</b></span>
              </div>
              <div className="room-card-foot">
                <span className={r.status}><i />{r.status === "online" ? "Trực tuyến" : "Cần chú ý"}</span>
                <ChevronRight size={16} />
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <div className="bottom-grid">
        <Panel>
          <SectionHead title="Cảnh báo & Sự kiện gần đây" action={<button className="text-button" onClick={() => openDecision()}>Xem tất cả</button>} />
          {recentEvents && recentEvents.length > 0 ? (
            recentEvents.slice(0, 5).map((evt) => (
              <div className={`event-row ${evt.tone === "amber" ? "warning-event" : ""}`} key={evt.id}>
                <span className={`event-icon ${evt.tone === "amber" ? "" : "neutral"}`}>
                  {evt.tone === "amber" ? <AlertTriangle /> : <Radio />}
                </span>
                <div>
                  <strong>{evt.title}</strong>
                  <p>{evt.description}</p>
                </div>
                <time>{evt.time}</time>
                {evt.rec_id && (
                  <button
                    className="outline-button"
                    onClick={() => {
                      const found = recommendations.find((r) => r.id === evt.rec_id);
                      openDecision(found || latestRec);
                    }}
                  >
                    Xem quyết định
                  </button>
                )}
              </div>
            ))
          ) : (
            <div style={{ padding: 25, textAlign: "center", color: "#64748b", fontSize: 12 }}>
              Hệ thống an toàn, chưa ghi nhận cảnh báo bất thường.
            </div>
          )}
        </Panel>
        <Panel>
          <SectionHead
            title="Quyết định AI mới nhất"
            action={
              <Badge tone={latestRec?.status === "approved" || latestRec?.status === "auto_approved" ? "success" : "warning"}>
                {latestRec?.status === "approved" ? "ĐÃ DUYỆT" : latestRec?.status === "auto_approved" ? "AUTOPILOT" : "CHỜ DUYỆT"}
              </Badge>
            }
          />
          {latestRec ? (
            <div className="decision-summary">
              <div className="decision-id">
                <span>{latestRec.event_id || latestRec.id}</span>
                <time>{latestRec.created_at ? (latestRec.created_at.length >= 19 ? latestRec.created_at.slice(11, 19) : latestRec.created_at) : "Vừa xong"}</time>
              </div>
              <p>{latestRec.reason || "AI Agent phân tích ngữ cảnh telemetry và đưa ra đề xuất hành động."}</p>
              <div className="recommend">
                <Zap size={18} />
                <div>
                  <span>KHUYẾN NGHỊ CÔNG CỤ</span>
                  <strong>{latestRec.tool_name}</strong>
                </div>
                <Badge tone={latestRec.urgency === "HIGH" || latestRec.urgency === "high" ? "danger" : "info"}>{latestRec.urgency || "MEDIUM"}</Badge>
              </div>
              <button className="primary-button wide" onClick={() => openDecision(latestRec)}>
                Xem và xử lý quyết định <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <p className="empty" style={{ padding: 20 }}>Chưa có đề xuất nào từ AI Agent.</p>
          )}
        </Panel>
      </div>
      <p className="demo-note">SmartCampus Digital Twin · Hệ thống kết nối Realtime Edge Gateway, Mosquitto MQTT & AI ReAct Agent.</p>
    </>
  );
}

function AlertsPage({
  recommendations,
  openDecision,
  hitlEnabled,
  onToggleHitl,
  hitlLoading,
  currentUser,
}: {
  recommendations: RecommendationItem[];
  openDecision: (rec: RecommendationItem) => void;
  hitlEnabled: boolean;
  onToggleHitl: () => void;
  hitlLoading: boolean;
  currentUser: UserProfile | null;
}) {
  const [tab, setTab] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = recommendations.filter((r) => {
    if (tab === "Cảnh báo" && r.urgency !== "HIGH" && r.urgency !== "high" && r.urgency !== "critical") return false;
    if (tab === "Quyết định AI" && !r.tool_name) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const matchId = (r.event_id || r.id).toLowerCase().includes(q);
      const matchRoom = (r.room_id || "").toLowerCase().includes(q);
      const matchTool = r.tool_name.toLowerCase().includes(q);
      return matchId || matchRoom || matchTool;
    }
    return true;
  });

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">HUMAN-IN-THE-LOOP (HITL) & PHÂN QUYỀN RBAC</span>
          <h1>Cảnh báo & Quyết định</h1>
          <p>
            {currentUser?.role === "student"
              ? "Tài khoản Sinh viên: Chỉ được phép xem trạng thái, không thể phê duyệt lệnh phần cứng."
              : "Đánh giá sự kiện và phê duyệt hành động do AI Agent đề xuất trước khi phát lệnh phần cứng."}
          </p>
        </div>
        <HitlToggleSwitch
          enabled={hitlEnabled}
          loading={hitlLoading}
          onToggle={onToggleHitl}
          disabled={currentUser?.role !== "admin"}
        />
      </div>

      <Panel>
        <div className="tabs">
          {["Tất cả", "Cảnh báo", "Quyết định AI"].map((item) => (
            <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>
              {item}
            </button>
          ))}
        </div>
        <div className="table-tools">
          <div className="search">
            <Search size={16} />
            <input
              placeholder="Tìm theo event ID, phòng hoặc tool..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="outline-button"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: "#f8fafc", padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", cursor: "pointer" }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ phê duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="auto_approved">Tự động duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>
        <div className="data-table">
          <div className="table-head">
            <span>SỰ KIỆN / ID</span>
            <span>PHÒNG</span>
            <span>TOOL & LÝ DO</span>
            <span>THỜI GIAN</span>
            <span>TRẠNG THÁI</span>
            <span />
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 25, textAlign: "center", color: "#8a95a4", fontSize: 11 }}>
              Không có sự kiện hoặc đề xuất nào phù hợp.
            </div>
          ) : (
            filtered.map((row) => (
              <button className="table-row" key={row.id} onClick={() => openDecision(row)}>
                <span>
                  <b>{row.event_id || row.id.slice(0, 12)}</b>
                  <small>{row.tool_name}</small>
                </span>
                <span>{row.room_id ? row.room_id.slice(0, 8) : "Campus"}</span>
                <span>{row.reason || `AI đề xuất chạy ${row.tool_name}`}</span>
                <span>{row.created_at ? (row.created_at.length >= 19 ? row.created_at.slice(11, 19) : row.created_at) : "Vừa xong"}</span>
                <span>
                  <Badge
                    tone={
                      row.status === "approved"
                        ? "success"
                        : row.status === "auto_approved"
                        ? "info"
                        : row.status === "rejected"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {row.status === "pending"
                      ? "Chờ phê duyệt"
                      : row.status === "approved"
                      ? "Đã duyệt"
                      : row.status === "auto_approved"
                      ? "Tự động duyệt"
                      : "Từ chối"}
                  </Badge>
                </span>
                <span><ChevronRight size={16} /></span>
              </button>
            ))
          )}
        </div>
      </Panel>
    </>
  );
}

function buildSvgPath(points: number[], width = 860, height = 180, padding = 20) {
  if (!points || points.length < 2) return "";
  const minVal = Math.min(...points);
  const maxVal = Math.max(...points);
  const range = maxVal - minVal || 1;
  const stepX = (width - padding * 2) / (points.length - 1);

  return points
    .map((val, idx) => {
      const x = padding + idx * stepX;
      const y = height - padding - ((val - minVal) / range) * (height - padding * 2);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function HistoryPage({ devices, rooms }: { devices: DeviceItem[]; rooms: Room[] }) {
  const [tab, setTab] = useState<"Lịch sử" | "Thiết bị">("Lịch sử");
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || "");
  const [selectedMetric, setSelectedMetric] = useState<"temperature" | "humidity" | "smoke" | "co2">("temperature");
  const [telemetryPoints, setTelemetryPoints] = useState<TelemetryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    getTelemetryHistory(selectedRoomId || undefined, 30)
      .then((data) => {
        if (active) setTelemetryPoints(data);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [selectedRoomId]);

  const metricValues = telemetryPoints.map((p) => p[selectedMetric] || 0);
  const currentVal = metricValues[metricValues.length - 1] ?? 0;
  const currentRoomObj = rooms.find((r) => r.id === selectedRoomId);
  const currentRoomName = currentRoomObj?.name || (selectedRoomId ? selectedRoomId.slice(0, 8) : "Toàn trường");

  const metricUnit =
    selectedMetric === "temperature" ? "°C" :
    selectedMetric === "humidity" ? "%" : "ppm";

  const metricTitle =
    selectedMetric === "temperature" ? "NHIỆT ĐỘ PHÒNG" :
    selectedMetric === "humidity" ? "ĐỘ ẨM KHÔNG KHÍ" :
    selectedMetric === "smoke" ? "NỒNG ĐỘ KHÓI ANALOG" : "KHÍ CO₂";

  const svgPath = buildSvgPath(metricValues);

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">DỮ LIỆU CAMPUS · TIMESCALEDB LIVE</span>
          <h1>Lịch sử & Thiết bị</h1>
          <p>Khám phá chuỗi telemetry thực tế từ TimescaleDB và quản lý hạ tầng IoT Edge.</p>
        </div>
      </div>
      <Panel>
        <div className="tabs">
          {(["Lịch sử", "Thiết bị"] as const).map((item) => (
            <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>
              {item}
            </button>
          ))}
        </div>
        {tab === "Lịch sử" ? (
          <>
            <div className="filters" style={{ flexWrap: "wrap", gap: "10px" }}>
              <select
                className="outline-button"
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                style={{ background: "#f8fafc", padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              >
                <option value="">Tất cả phòng (Trung bình)</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.mode})
                  </option>
                ))}
              </select>

              <select
                className="outline-button"
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                style={{ background: "#f8fafc", padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              >
                <option value="temperature">Chỉ số: Nhiệt độ (°C)</option>
                <option value="humidity">Chỉ số: Độ ẩm (%)</option>
                <option value="smoke">Chỉ số: Khói MQ2 (ppm)</option>
                <option value="co2">Chỉ số: CO₂ (ppm)</option>
              </select>

              <button
                className="outline-button"
                onClick={() => {
                  setLoadingHistory(true);
                  getTelemetryHistory(selectedRoomId || undefined, 30)
                    .then(setTelemetryPoints)
                    .finally(() => setLoadingHistory(false));
                }}
                disabled={loadingHistory}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <RefreshCw size={14} className={loadingHistory ? "spin" : ""} />
                Làm mới chuỗi đo
              </button>
            </div>

            <div className="chart-area">
              <div className="chart-title">
                <div>
                  <span>{metricTitle} · {currentRoomName.toUpperCase()}</span>
                  <strong>{currentVal} {metricUnit}</strong>
                </div>
                <Badge tone="info">TIMESCALEDB REALTIME</Badge>
              </div>

              {loadingHistory ? (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                  <Loader2 size={24} className="spin" /> &nbsp; Đang truy vấn TimescaleDB...
                </div>
              ) : telemetryPoints.length === 0 ? (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                  Chưa có dữ liệu telemetry cho bộ lọc này.
                </div>
              ) : (
                <>
                  <svg viewBox="0 0 900 220" role="img" aria-label="Biểu đồ telemetry thực tế">
                    {[30, 75, 120, 165, 210].map((y) => (
                      <line key={y} x1="20" x2="890" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                    ))}
                    {svgPath && (
                      <path
                        d={svgPath}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                  <div className="chart-labels">
                    {telemetryPoints
                      .filter((_, i) => i % Math.max(1, Math.floor(telemetryPoints.length / 5)) === 0)
                      .map((p, idx) => (
                        <span key={idx}>{p.time_label}</span>
                      ))}
                    <span>Hiện tại</span>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="data-table device-table">
            <div className="table-head">
              <span>THIẾT BỊ / MAC</span>
              <span>PHÒNG</span>
              <span>LOẠI PHẦN CỨNG</span>
              <span>HEARTBEAT</span>
              <span>TRẠNG THÁI</span>
              <span />
            </div>
            {devices.length > 0 ? (
              devices.map((d) => (
                <div className="table-row" key={d.id}>
                  <span><b>{d.name || d.mac_address}</b><small>{d.mac_address}</small></span>
                  <span>{d.room_id ? d.room_id.slice(0, 8) : "Chưa gán"}</span>
                  <span>{d.device_type || "ESP32 Node"}</span>
                  <span>{d.last_heartbeat ? (d.last_heartbeat.length >= 19 ? d.last_heartbeat.slice(11, 19) : d.last_heartbeat) : "Vừa xong"}</span>
                  <span><Badge tone={d.status === "online" ? "success" : "danger"}>{d.status}</Badge></span>
                  <span><MoreHorizontal size={17} /></span>
                </div>
              ))
            ) : (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                Chưa có thiết bị IoT nào được đăng ký trong hệ thống.
              </div>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}

function CorridorRfidPage({
  cardRequests,
  onRefresh,
  onApprove,
  onReject,
  onSimulate,
  simulating,
  loading,
  currentUser,
}: {
  cardRequests: CardRegistrationRequestItem[];
  onRefresh: () => void;
  onApprove: (req: CardRegistrationRequestItem) => void;
  onReject: (req: CardRegistrationRequestItem) => void;
  onSimulate: () => void;
  simulating: boolean;
  loading: boolean;
  currentUser: UserProfile | null;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const canManage = currentUser?.role === "admin" || currentUser?.role === "lecturer";

  const filteredRequests = cardRequests.filter((req) => {
    if (filter !== "all" && req.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        req.card_uid.toLowerCase().includes(q) ||
        (req.assigned_user_name && req.assigned_user_name.toLowerCase().includes(q)) ||
        (req.mac_address && req.mac_address.toLowerCase().includes(q)) ||
        (req.note && req.note.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalCount = cardRequests.length;
  const pendingCount = cardRequests.filter((r) => r.status === "pending").length;
  const approvedCount = cardRequests.filter((r) => r.status === "approved").length;
  const rejectedCount = cardRequests.filter((r) => r.status === "rejected").length;

  const copyUid = (uid: string) => {
    navigator.clipboard?.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">NODE HÀNH LANG (ESP32 · ROLE_CORRIDOR_NODE)</span>
          <h1>Duyệt Thẻ RFID Hành Lang</h1>
          <p>
            Quản lý và phê duyệt các thẻ RFID chưa đăng ký được quét tại sảnh/hành lang.
            Sau khi duyệt, thông tin được gán cho Sinh viên/Giảng viên và tự động đồng bộ kết quả lên màn hình OLED SSD1306.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="btn-simulate"
            onClick={onSimulate}
            disabled={simulating}
            title="Tạo giả lập sự kiện quét thẻ lạ tại Corridor Node qua MQTT"
          >
            {simulating ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            <span>Quét thử Thẻ tại Corridor</span>
          </button>
          <button
            className="outline-button"
            onClick={onRefresh}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="rfid-stat-grid">
        <div className="rfid-stat-card">
          <div className="rfid-stat-icon total"><CreditCard size={22} /></div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a" }}>{totalCount}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Tổng số lượt quét</div>
          </div>
        </div>
        <div className="rfid-stat-card" style={{ borderColor: pendingCount > 0 ? "#fde68a" : "#e2e8f0" }}>
          <div className="rfid-stat-icon pending"><Clock3 size={22} /></div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#d97706" }}>{pendingCount}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Đang chờ phê duyệt</div>
          </div>
        </div>
        <div className="rfid-stat-card">
          <div className="rfid-stat-icon approved"><CheckCircle2 size={22} /></div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#059669" }}>{approvedCount}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Đã kích hoạt & đồng bộ OLED</div>
          </div>
        </div>
        <div className="rfid-stat-card">
          <div className="rfid-stat-icon rejected"><XCircle size={22} /></div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: "700", color: "#dc2626" }}>{rejectedCount}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>Bị từ chối</div>
          </div>
        </div>
      </div>

      {!canManage && (
        <div className="rbac-warning-card">
          <ShieldAlert size={18} />
          <div>
            <b>Chế độ xem (Chỉ đọc)</b>: Bạn đang đăng nhập với quyền <b>Sinh viên</b>.
            Chỉ <b>Admin</b> hoặc <b>Giảng viên</b> mới có quyền phê duyệt hoặc từ chối thẻ RFID tại Hành lang.
          </div>
        </div>
      )}

      {/* Main Table Panel */}
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {(["all", "pending", "approved", "rejected"] as const).map((t) => (
              <button
                key={t}
                className={filter === t ? "active" : ""}
                onClick={() => setFilter(t)}
              >
                {t === "all" ? `Tất cả (${totalCount})` :
                 t === "pending" ? `Chờ duyệt (${pendingCount})` :
                 t === "approved" ? `Đã duyệt (${approvedCount})` :
                 `Từ chối (${rejectedCount})`}
              </button>
            ))}
          </div>

          <div style={{ position: "relative", minWidth: "260px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Tìm theo UID, tên, MAC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 12px 7px 32px",
                borderRadius: "7px",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                outline: "none",
                background: "#f8fafc",
              }}
            />
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "#94a3b8" }}>
            <CreditCard size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: "14px", color: "#475569" }}>
              {filter === "pending" ? "Không có thẻ nào đang chờ duyệt" : "Chưa có dữ liệu quẹt thẻ"}
            </div>
            <p style={{ fontSize: "12px", margin: "6px 0 16px" }}>
              Quẹt thẻ vật lý tại đầu đọc RC522 của Corridor Node hoặc nhấn nút bên dưới để mô phỏng.
            </p>
            <button className="btn-simulate" onClick={onSimulate} disabled={simulating}>
              <Sparkles size={14} />
              <span>Quét thử Thẻ Demo ngay</span>
            </button>
          </div>
        ) : (
          <div className="data-table" style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px", fontWeight: "700" }}>
                  <th style={{ padding: "12px 14px" }}>MÃ THẺ (UID)</th>
                  <th style={{ padding: "12px 14px" }}>THIẾT BỊ / MAC</th>
                  <th style={{ padding: "12px 14px" }}>THỜI GIAN QUÉT</th>
                  <th style={{ padding: "12px 14px" }}>NGƯỜI DÙNG ĐƯỢC GÁN</th>
                  <th style={{ padding: "12px 14px" }}>TRẠNG THÁI</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req.request_id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          fontFamily: "monospace",
                          fontWeight: 700,
                          fontSize: "12px",
                          background: "#f1f5f9",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          color: "#1e293b",
                          border: "1px solid #cbd5e1"
                        }}>
                          {req.card_uid}
                        </span>
                        <button
                          onClick={() => copyUid(req.card_uid)}
                          style={{ border: 0, background: "transparent", color: "#64748b", padding: 0, cursor: "pointer" }}
                          title="Sao chép mã thẻ"
                        >
                          <Copy size={13} />
                        </button>
                        {copiedUid === req.card_uid && (
                          <span style={{ fontSize: "10px", color: "#059669" }}>Đã copy!</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: "#334155" }}>
                        Corridor Node #1
                      </div>
                      <small style={{ color: "#64748b", fontFamily: "monospace" }}>
                        {req.mac_address || "24:6F:28:AA:BB:CC"}
                      </small>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#475569" }}>
                      {req.created_at ? new Date(req.created_at).toLocaleString("vi-VN") : "Vừa xong"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {req.assigned_user_name ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <UserCheck size={14} style={{ color: "#059669" }} />
                          <strong style={{ color: "#0f172a" }}>{req.assigned_user_name}</strong>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Chưa gán</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span className={`rfid-badge ${req.status}`}>
                        {req.status === "pending" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d97706", display: "inline-block" }} />}
                        {req.status === "approved" && <Check size={12} />}
                        {req.status === "rejected" && <X size={12} />}
                        {req.status === "pending" ? "Chờ duyệt" : req.status === "approved" ? "Đã kích hoạt" : "Từ chối"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {req.status === "pending" ? (
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <button
                            className="btn-approve-sm"
                            onClick={() => onApprove(req)}
                            disabled={!canManage}
                            title={canManage ? "Phê duyệt và gán thông tin thẻ" : "Cần quyền Admin/Lecturer"}
                            style={{ opacity: canManage ? 1 : 0.5, cursor: canManage ? "pointer" : "not-allowed" }}
                          >
                            <Check size={12} />
                            <span>Duyệt thẻ</span>
                          </button>
                          <button
                            className="btn-reject-sm"
                            onClick={() => onReject(req)}
                            disabled={!canManage}
                            title={canManage ? "Từ chối yêu cầu đăng ký thẻ" : "Cần quyền Admin/Lecturer"}
                            style={{ opacity: canManage ? 1 : 0.5, cursor: canManage ? "pointer" : "not-allowed" }}
                          >
                            <X size={12} />
                            <span>Từ chối</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>Hoàn tất</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function CorridorApprovalModal({
  request,
  onClose,
  onConfirm,
  submitting,
}: {
  request: CardRegistrationRequestItem | null;
  onClose: () => void;
  onConfirm: (payload: { full_name: string; username: string; role: string }) => void;
  submitting: boolean;
}) {
  const [fullName, setFullName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [role, setRole] = useState("student");

  useEffect(() => {
    if (request) {
      const suffix = request.card_uid.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
      setFullName("Sinh viên " + suffix);
      setStudentCode("SV" + suffix);
      setRole("student");
    }
  }, [request]);

  if (!request) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    onConfirm({
      full_name: fullName.trim(),
      username: studentCode.trim() || `sv_${request.card_uid.slice(-4)}`,
      role,
    });
  };

  return (
    <div className="corridor-modal-backdrop" onClick={onClose}>
      <div className="corridor-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "10px", fontWeight: "700", color: "#2563eb", letterSpacing: "1px", textTransform: "uppercase" }}>
              XÁC THỰC & DUYỆT THẺ HÀNH LANG
            </span>
            <h3 style={{ margin: "4px 0 0", fontSize: "16px", color: "#0f172a" }}>
              Phê duyệt Thẻ RFID: {request.card_uid}
            </h3>
          </div>
          <button onClick={onClose} style={{ border: 0, background: "transparent", color: "#94a3b8", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", marginBottom: "16px", fontSize: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div><span style={{ color: "#64748b" }}>Mã thẻ UID:</span> <b style={{ fontFamily: "monospace" }}>{request.card_uid}</b></div>
              <div><span style={{ color: "#64748b" }}>MAC Node:</span> <b style={{ fontFamily: "monospace" }}>{request.mac_address || "24:6F:28:AA:BB:CC"}</b></div>
              <div><span style={{ color: "#64748b" }}>Thời điểm quét:</span> <span>{request.created_at ? new Date(request.created_at).toLocaleTimeString("vi-VN") : "Vừa xong"}</span></div>
              <div><span style={{ color: "#64748b" }}>Vị trí:</span> <span>Hành lang tầng 4</span></div>
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
              Họ và tên Sinh viên / Giảng viên *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="VD: Nguyễn Văn An"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
            />
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
              Mã Sinh viên / Mã Cán bộ (Username)
            </label>
            <input
              type="text"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="VD: B21DCCN042"
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "6px" }}>
              Vai trò (Role)
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "white" }}
            >
              <option value="student">Sinh viên (Student)</option>
              <option value="lecturer">Giảng viên (Lecturer)</option>
              <option value="admin">Quản trị viên (Admin)</option>
            </select>
          </div>

          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "10px 14px", marginBottom: "20px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <CheckCircle2 size={16} style={{ color: "#059669", flexShrink: 0, marginTop: "2px" }} />
            <div style={{ fontSize: "11px", color: "#065f46", lineHeight: 1.4 }}>
              <strong>Tự động đồng bộ phần cứng ESP32:</strong> Khi phê duyệt, Edge Gateway gửi phản hồi MQTT về Corridor Node. Màn hình OLED sẽ lập tức hiển thị <code>DA DUYET / OK</code>, đèn LED RGB chuyển xanh lá và còi buzzer kêu xác nhận.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-approve-sm"
              disabled={submitting}
              style={{ padding: "8px 18px", fontSize: "12px" }}
            >
              {submitting ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              <span>Xác nhận Phê duyệt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AuditPage() {
  const [tab, setTab] = useState<"Agent Tool Calls" | "Fallback Audit">("Agent Tool Calls");
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchLogs = (selectedTab: "Agent Tool Calls" | "Fallback Audit") => {
    setLoading(true);
    const typeParam = selectedTab === "Agent Tool Calls" ? "tool_calls" : "fallback";
    getAuditLogs(typeParam)
      .then(setLogs)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs(tab);
  }, [tab]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const typeParam = tab === "Agent Tool Calls" ? "tool_calls" : "fallback";
      await downloadAuditCsv(typeParam);
    } catch (err: any) {
      alert("Lỗi xuất file CSV: " + (err.message || String(err)));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">TRUY VẾT HỆ THỐNG · REALTIME AUDIT TRAIL</span>
          <h1>Nhật ký kiểm toán (Audit Logs)</h1>
          <p>Tool activity của AI Agent và fallback audit được lưu trữ bất biến từ các phiên thực thi.</p>
        </div>
        <button
          className="outline-button"
          onClick={handleExportCsv}
          disabled={exporting || loading}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          {exporting ? <Loader2 size={14} className="spin" /> : <FileClock size={14} />}
          <span>Xuất file CSV</span>
        </button>
      </div>
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {(["Agent Tool Calls", "Fallback Audit"] as const).map((item) => (
              <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>
                {item}
              </button>
            ))}
          </div>
          <button
            className="outline-button"
            onClick={() => fetchLogs(tab)}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
            <span>Làm mới</span>
          </button>
        </div>

        <div className="data-table audit-table">
          <div className="table-head">
            <span>THỜI GIAN</span>
            <span>COMPONENT</span>
            <span>{tab === "Agent Tool Calls" ? "TOOL ĐÃ GỌI" : "CẤP ĐỘ FALLBACK"}</span>
            <span>KẾT QUẢ / LÝ DO</span>
            <span>LEVEL</span>
            <span />
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              <Loader2 size={20} className="spin inline" /> &nbsp; Đang tải nhật ký kiểm toán...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              Chưa có bản ghi kiểm toán nào cho phân loại này.
            </div>
          ) : (
            logs.map((r) => (
              <div className="table-row" key={r.id}>
                <span>
                  <b>{r.timestamp}</b>
                  <small>{r.date}</small>
                </span>
                <span>{r.component}</span>
                <span><code>{r.target}</code></span>
                <span>{r.detail}</span>
                <span><Badge tone={r.level === "WARN" ? "warning" : r.level === "ERROR" ? "danger" : "info"}>{r.level}</Badge></span>
                <span><ChevronRight size={16} /></span>
              </div>
            ))
          )}
        </div>
      </Panel>
    </>
  );
}

function AssistantPage({ openDecision, rooms }: { openDecision: () => void; rooms: Room[] }) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || "");
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; text: string; rec?: string }>>([
    {
      role: "ai",
      text: "Xin chào! Tôi là Trợ lý AI SmartCampus. Tôi đã kết nối với cơ sở tri thức RAG và dữ liệu telemetry thời gian thực từ Edge Gateway. Bạn có thể hỏi tôi về trạng thái phòng học, chỉ số cảm biến, quy trình SOP hoặc yêu cầu hỗ trợ vận hành an toàn.",
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];

  const handleSend = async (q?: string) => {
    const query = q || inputVal;
    if (!query.trim()) return;

    setMessages((prev) => [...prev, { role: "user", text: query }]);
    if (!q) setInputVal("");
    setLoading(true);

    try {
      const reply = await askAiAssistant(query, selectedRoomId || undefined);
      let rec: string | undefined = undefined;
      if (reply.includes("trigger_buzzer")) rec = "trigger_buzzer";
      else if (reply.includes("set_fan")) rec = "set_fan";
      else if (reply.includes("set_door")) rec = "set_door";
      else if (reply.includes("send_alert")) rec = "send_alert";

      setMessages((prev) => [...prev, { role: "ai", text: reply, rec }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Lỗi kết nối AI: ${e.message || "Không thể nhận phản hồi từ AI Service."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="assistant-layout">
      <div className="assistant-main">
        <div className="page-title compact">
          <div>
            <span className="eyebrow">AI AGENT + RAG KNOWLEDGE</span>
            <h1>Trợ lý vận hành Campus</h1>
            <p>Hỏi về ngữ cảnh phòng, telemetry, quy trình SOP và điều khiển thiết bị.</p>
          </div>
          <Badge tone="success">GEMINI & SLM ONLINE</Badge>
        </div>
        <div className="chat">
          <div className="chat-day">HÔM NAY · {selectedRoom ? selectedRoom.name.toUpperCase() : "TOÀN TRƯỜNG"}</div>
          {messages.map((m, idx) => (
            <div key={idx} className={`bubble ${m.role}`}>
              {m.role === "ai" && (
                <span className="bubble-label"><Bot size={16} /> SMARTCAMPUS AGENT</span>
              )}
              <p>{m.text}</p>
              {m.rec && (
                <div className="assistant-recommend">
                  <Zap size={18} />
                  <div>
                    <span>KHUYẾN NGHỊ · HIGH</span>
                    <strong>{m.rec}</strong>
                  </div>
                  <button className="text-button" onClick={openDecision}>
                    Xem quyết định <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="bubble ai" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={16} className="spin text-blue-600" />
              <span>AI Agent đang tra cứu RAG SOP và đánh giá ngữ cảnh phòng...</span>
            </div>
          )}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            aria-label="Câu hỏi"
            placeholder="Hỏi về phòng, cảm biến, sự kiện hoặc quy trình SOP..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
          <button aria-label="Gửi" type="submit" disabled={loading}>
            <Send size={18} />
          </button>
        </form>
      </div>
      <aside className="assistant-side">
        <h2>Ngữ cảnh phòng</h2>
        <div style={{ marginBottom: 12 }}>
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", background: "white" }}
          >
            <option value="">Toàn trường (Campus General)</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.mode})
              </option>
            ))}
          </select>
        </div>

        {selectedRoom && (
          <div className="context-room">
            <span>ĐANG CHỌN</span>
            <strong>{selectedRoom.name}</strong>
            <p>{selectedRoom.type} · Chế độ {selectedRoom.mode} (Nhiệt độ: {selectedRoom.temp})</p>
          </div>
        )}

        <h3>Gợi ý câu hỏi nhanh</h3>
        {[
          "Phòng nào đang có cảnh báo khói?",
          "Quy trình SOP xử lý sự cố khói là gì?",
          `Bật quạt phòng ${selectedRoom?.name || "học"} nếu nhiệt độ quá 28°C`,
          "Tóm tắt trạng thái các phòng học hôm nay",
        ].map((q) => (
          <button key={q} onClick={() => handleSend(q)}>
            {q}<ChevronRight size={14} />
          </button>
        ))}
        <div className="assistant-safety">
          <ShieldCheck size={19} />
          <div>
            <strong>Kiểm soát bởi con người (HITL)</strong>
            <p>Hành động kích hoạt thiết bị thật luôn yêu cầu xác nhận trừ khi bật chế độ Autopilot.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SettingsPage({
  hitlEnabled,
  onToggleHitl,
  hitlLoading,
  wsConnected,
  currentUser,
  onOpenLogin,
}: {
  hitlEnabled: boolean;
  onToggleHitl: () => void;
  hitlLoading: boolean;
  wsConnected: boolean;
  currentUser: UserProfile | null;
  onOpenLogin: () => void;
}) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);

  useEffect(() => {
    getSystemHealth().then(setHealth);
    if (currentUser?.role === "admin") {
      setLoadingUsers(true);
      getUsers()
        .then(setUsers)
        .finally(() => setLoadingUsers(false));
    }
  }, [currentUser]);

  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">CẤU HÌNH HỆ THỐNG & PHÂN QUYỀN</span>
          <h1>Cài đặt & RBAC</h1>
          <p>Quản lý phân quyền người dùng, chính sách Human-in-the-Loop và kết nối hệ thống.</p>
        </div>
        <button className="primary-button" onClick={onOpenLogin}>
          <UserCheck size={15} /> Chuyển đổi Role / Đăng nhập
        </button>
      </div>

      <div className="settings-grid">
        <Panel className="settings-card" style={{ gridColumn: "span 2" }}>
          <span className="settings-icon"><ShieldCheck /></span>
          <div>
            <h2>Chế độ Human-in-the-Loop (HITL)</h2>
            <p>Quyết định mức độ can thiệp của con người vào các lệnh điều khiển thiết bị phần cứng do AI Agent đề xuất.</p>
          </div>
          <div style={{ gridColumn: "1 / -1", marginTop: 15, padding: "12px 16px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <strong style={{ fontSize: 13, display: "block" }}>
                  {hitlEnabled ? "Chế độ HITL: Đang BẬT (Khuyến nghị an toàn)" : "Chế độ Autopilot: Đang BẬT (Tự động 100%)"}
                </strong>
                <span style={{ fontSize: 10, color: "#64748b" }}>
                  {hitlEnabled
                    ? "Mọi tool execution (bật quạt, còi, mở cửa, đổi mode) bắt buộc Quản trị viên duyệt trên DTwin."
                    : "AI Agent tự động phát lệnh trực tiếp sang Edge Gateway API và gửi MQTT xuống ESP32."}
                </span>
              </div>
              <HitlToggleSwitch
                enabled={hitlEnabled}
                loading={hitlLoading}
                onToggle={onToggleHitl}
                disabled={currentUser?.role !== "admin"}
              />
            </div>
            {currentUser?.role !== "admin" && (
              <p style={{ margin: 0, fontSize: 9, color: "#b45309" }}>
                ⚠️ Chỉ tài khoản có vai trò <b>Quản trị viên (admin)</b> mới có quyền thay đổi thiết lập này.
              </p>
            )}
          </div>
        </Panel>

        <Panel className="settings-card">
          <span className="settings-icon"><Activity /></span>
          <div>
            <h2>Trạng thái kết nối</h2>
            <p>Kiểm tra trực tiếp các dịch vụ phân tán</p>
          </div>
          <div className="settings-links">
            <button>
              <span>Edge Gateway API (Port 8000)</span>
              <Badge tone={health?.edge_gateway?.status === "online" ? "success" : "danger"}>
                {health?.edge_gateway?.status?.toUpperCase() || "CHECKING"}
              </Badge>
            </button>
            <button>
              <span>AI Service & RAG (Port 8001)</span>
              <Badge tone={health?.ai_service?.status === "online" ? "success" : "danger"}>
                {health?.ai_service?.status?.toUpperCase() || "ONLINE"}
              </Badge>
            </button>
            <button>
              <span>WebSocket Realtime Tunnel (/ws/campus)</span>
              <Badge tone={wsConnected ? "success" : "warning"}>
                {wsConnected ? "CONNECTED" : "RECONNECTING"}
              </Badge>
            </button>
            <button>
              <span>Mosquitto MQTT Broker (Port 1883)</span>
              <Badge tone={health?.mqtt_broker?.status === "ready" ? "success" : "danger"}>
                {health?.mqtt_broker?.status?.toUpperCase() || "READY"}
              </Badge>
            </button>
          </div>
        </Panel>

        <Panel className="settings-card" style={{ gridColumn: "span 3" }}>
          <span className="settings-icon"><KeyRound /></span>
          <div>
            <h2>Danh sách người dùng & Phân quyền RBAC (Role-Based Access Control)</h2>
            <p>Tài khoản thực tế trong cơ sở dữ liệu (Admin, Giảng viên, Sinh viên)</p>
          </div>
          <div style={{ gridColumn: "1 / -1", marginTop: 15 }}>
            {currentUser?.role !== "admin" ? (
              <div className="rbac-warning-card">
                <ShieldAlert size={16} />
                <span>Yêu cầu quyền <b>Quản trị viên (Admin)</b> để xem và quản lý danh sách người dùng đầy đủ.</span>
              </div>
            ) : loadingUsers ? (
              <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                <Loader2 size={16} className="spin inline" /> Đang tải danh sách tài khoản từ cơ sở dữ liệu...
              </div>
            ) : users.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                Chưa có danh sách người dùng trong hệ thống.
              </div>
            ) : (
              <div className="data-table">
                <div className="table-head">
                  <span>HỌ TÊN / USERNAME</span>
                  <span>EMAIL</span>
                  <span>VAI TRÒ (ROLE)</span>
                  <span>QUYỀN HẠN TRÊN HỆ THỐNG</span>
                  <span>TRẠNG THÁI</span>
                </div>
                {users.map((u) => (
                  <div className="table-row" key={u.id}>
                    <span>
                      <b>{u.full_name || u.username}</b>
                      <small>@{u.username}</small>
                    </span>
                    <span>{u.email}</span>
                    <span><UserRoleBadge role={u.role} /></span>
                    <span style={{ fontSize: 8, color: "#64748b" }}>
                      {u.role === "admin"
                        ? "Toàn quyền: Bật/Tắt HITL, Duyệt mọi lệnh, Quản lý User"
                        : u.role === "lecturer"
                        ? "Học vụ: Duyệt đề xuất quạt/cửa/còi, Xem telemetry"
                        : "Chỉ đọc: Xem telemetry, không được duyệt chấp hành"}
                    </span>
                    <span><Badge tone={u.is_active ? "success" : "danger"}>{u.is_active ? "Hoạt động" : "Đã khóa"}</Badge></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

function RoomDrawer({ room, close }: { room: Room; close: () => void }) {
  const [stats, setStats] = useState<RoomTelemetryStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingStats(true);
    getRoomTelemetryStats(room.id)
      .then((data) => {
        if (active && data) setStats(data);
      })
      .catch((err) => console.warn("Lỗi tải stats:", err))
      .finally(() => {
        if (active) setLoadingStats(false);
      });
    return () => {
      active = false;
    };
  }, [room.id]);

  const minTemp = stats?.temperature ? `${stats.temperature.min}°C` : "-";
  const maxTemp = stats?.temperature ? `${stats.temperature.max}°C` : "-";
  const avgTemp = stats?.temperature ? `${stats.temperature.avg}°C` : "-";

  const minHumid = stats?.humidity ? `${stats.humidity.min}%` : "-";
  const maxHumid = stats?.humidity ? `${stats.humidity.max}%` : "-";
  const avgHumid = stats?.humidity ? `${stats.humidity.avg}%` : "-";

  const minCo2 = stats?.co2 ? `${stats.co2.min}` : "-";
  const maxCo2 = stats?.co2 ? `${stats.co2.max}` : "-";
  const avgCo2 = stats?.co2 ? `${stats.co2.avg}` : "-";

  const minSmoke = stats?.smoke ? `${stats.smoke.min}` : "-";
  const maxSmoke = stats?.smoke ? `${stats.smoke.max}` : "-";
  const avgSmoke = stats?.smoke ? `${stats.smoke.avg}` : "-";

  const totalIn = stats?.occupancy ? stats.occupancy.total_in : room.occupancy;
  const totalOut = stats?.occupancy ? stats.occupancy.total_out : 0;
  const currentOcc = stats?.occupancy ? stats.occupancy.current : room.occupancy;

  const fsmHistory = stats?.fsm_history && stats.fsm_history.length > 0
    ? stats.fsm_history
    : [{ time: "Hiện tại", text: `Đang hoạt động ở chế độ: ${room.mode}` }];

  return (
    <div className="drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside className="drawer">
        <div className="drawer-head">
          <div>
            <span className="eyebrow">ROOM CONTEXT</span>
            <h2>{room.name}</h2>
            <p>{room.type} · {room.id}</p>
          </div>
          <IconButton label="Đóng" onClick={close}><X /></IconButton>
        </div>
        <div className="drawer-status">
          <Badge tone={room.status === "warning" ? "warning" : "success"}>{room.mode}</Badge>
          <span><i /> Cập nhật thời gian thực</span>
        </div>
        <div className="drawer-content">
          <div className="detail-block">
            <h3>Ngữ cảnh phòng</h3>
            <div className="key-grid">
              <span>Room ID<b>{room.id}</b></span>
              <span>Loại phòng<b>{room.type}</b></span>
              <span>Chế độ FSM<b>{room.mode}</b></span>
              <span>Trạng thái khói<b>{room.smoke}</b></span>
            </div>
          </div>
          <div className="detail-block">
            <h3>Telemetry mới nhất từ Cảm biến</h3>
            <p className="window">{loadingStats ? "Đang tải TimescaleDB..." : "15 phút gần nhất · TimescaleDB"}</p>
            <div className="telemetry-grid">
              {[
                ["Nhiệt độ", room.temp, minTemp, maxTemp, avgTemp],
                ["Độ ẩm", room.humidity, minHumid, maxHumid, avgHumid],
                ["CO₂", room.co2, minCo2, maxCo2, avgCo2],
                ["Khói", room.smoke, minSmoke, maxSmoke, avgSmoke],
              ].map((r) => (
                <div key={r[0]}>
                  <span>{r[0]}</span>
                  <strong>{r[1]}</strong>
                  <small>MIN {r[2]} · MAX {r[3]} · AVG {r[4]}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="detail-block">
            <h3>Cơ cấu chấp hành vật lý</h3>
            <div className="key-grid">
              <span>Quạt thông gió<b>{room.fan_on ? "ĐANG BẬT" : "ĐANG TẮT"}</b></span>
              <span>Khóa cửa điện từ<b>{room.door_locked ? "ĐÃ KHÓA" : "MỞ KHÓA"}</b></span>
            </div>
          </div>
          <div className="detail-block">
            <h3>Số người hiện diện</h3>
            <div className="occupancy">
              <Users />
              <div><strong>{currentOcc}</strong><span>Hiện tại</span></div>
              <div><strong>{totalIn}</strong><span>Tổng vào</span></div>
              <div><strong>{totalOut}</strong><span>Tổng ra</span></div>
              <Badge tone={room.mode === "SAVING" ? "secondary" : "info"}>
                {room.mode === "SAVING" ? "Phòng trống" : room.mode === "EXAM" ? "Thi cử" : "Đang học"}
              </Badge>
            </div>
          </div>
          <details className="detail-block" open>
            <summary>Lịch sử chuyển trạng thái FSM <ChevronDown size={16} /></summary>
            <div className="timeline">
              {fsmHistory.map((h, i) => (
                <p key={i}><i />{h.time} · {h.text}</p>
              ))}
            </div>
          </details>
        </div>
      </aside>
    </div>
  );
}

function DecisionDrawer({
  recommendation,
  close,
  onExecute,
  hitlEnabled,
  currentUser,
}: {
  recommendation: RecommendationItem | null;
  close: () => void;
  onExecute: (id: string, action: "approve" | "reject", notes?: string) => Promise<any>;
  hitlEnabled: boolean;
  currentUser: UserProfile | null;
}) {
  if (!recommendation) return null;
  const rec = recommendation;
  const [state, setState] = useState(
    rec.status === "approved"
      ? "Đã phê duyệt"
      : rec.status === "auto_approved"
      ? "Đã tự động duyệt"
      : rec.status === "rejected"
      ? "Đã từ chối"
      : "Chờ phê duyệt"
  );
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{
    success: boolean;
    message: string;
    detail?: any;
  } | null>(null);

  const isStudent = currentUser?.role === "student";
  const targetRecId = rec.id || (rec as any).recommendation_id || (rec as any).rec_id;

  const handleApprove = async () => {
    if (isStudent) {
      alert("Tài khoản Sinh viên không có quyền phê duyệt lệnh phần cứng!");
      return;
    }
    if (!targetRecId || targetRecId === "undefined") {
      setExecResult({
        success: false,
        message: "Lỗi: Không tìm thấy mã định danh (UUID) của đề xuất này.",
      });
      return;
    }
    setExecuting(true);
    setExecResult(null);
    try {
      const res = await onExecute(targetRecId, "approve", `Approved by ${currentUser?.username || "operator"}`);
      setState("Đã phê duyệt");
      if (res?.execution_result?.command_executed) {
        setExecResult({
          success: true,
          message: `Lệnh '${res.execution_result.command_type}: ${res.execution_result.command_value}' đã được gửi thành công sang Edge Gateway và MQTT!`,
          detail: res.execution_result,
        });
      } else if (res?.execution_result?.edge_status === "no_hardware_action_required") {
        setExecResult({
          success: true,
          message: "Đề xuất đã được duyệt và ghi nhận vào hệ thống (không cần lệnh cơ cấu chấp hành).",
        });
      } else {
        setExecResult({
          success: true,
          message: `Đã phê duyệt thành công đề xuất '${rec.tool_name}'. Edge Gateway status: ${res?.execution_result?.edge_status || "queued"}.`,
          detail: res?.execution_result,
        });
      }
    } catch (err: any) {
      setExecResult({
        success: false,
        message: `Lỗi khi thực thi: ${err.message || String(err)}`,
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleReject = async () => {
    if (isStudent) {
      alert("Tài khoản Sinh viên không có quyền từ chối hoặc can thiệp lệnh phần cứng!");
      return;
    }
    if (!targetRecId || targetRecId === "undefined") {
      setExecResult({
        success: false,
        message: "Lỗi: Không tìm thấy mã định danh (UUID) của đề xuất này.",
      });
      return;
    }
    setExecuting(true);
    setExecResult(null);
    try {
      await onExecute(targetRecId, "reject", `Rejected by ${currentUser?.username || "operator"}`);
      setState("Đã từ chối");
      setExecResult({
        success: false,
        message: "Bạn đã từ chối thực thi đề xuất này. Trạng thái đã được ghi vào audit log.",
      });
    } catch (err: any) {
      setExecResult({
        success: false,
        message: `Lỗi: ${err.message || String(err)}`,
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside className="drawer decision-drawer">
        <div className="drawer-head">
          <div>
            <span className="eyebrow">AI DECISION · {rec.event_id || rec.id}</span>
            <h2>Đề xuất xử lý thiết bị</h2>
            <p>{rec.room_id || "LAB-02"} · {rec.created_at ? rec.created_at.slice(11, 19) || rec.created_at : "Thời gian thực"}</p>
          </div>
          <IconButton label="Đóng" onClick={close}><X /></IconButton>
        </div>
        <div className="drawer-status">
          <Badge tone={state.includes("duyệt") ? "success" : state === "Đã từ chối" ? "danger" : "warning"}>
            {state}
          </Badge>
          <Badge tone={rec.urgency === "HIGH" ? "danger" : "info"}>
            URGENCY · {rec.urgency || "MEDIUM"}
          </Badge>
          {!hitlEnabled && <Badge tone="warning">AUTOPILOT ON</Badge>}
        </div>
        <div className="drawer-content">
          <div className="recommendation-card">
            <span className="recommendation-icon">
              {rec.tool_name.includes("fan") ? <Fan /> : rec.tool_name.includes("door") ? <DoorOpen /> : <Zap />}
            </span>
            <div>
              <span>AI RECOMMENDATION</span>
              <h3>{rec.tool_name}</h3>
              <p>{rec.reason || "Kích hoạt hành động để đảm bảo an toàn vận hành phòng."}</p>
            </div>
            <div className="confidence">
              <span>ĐỘ TIN CẬY</span>
              <strong>{rec.confidence ? Math.round(rec.confidence * 100) : 94}%</strong>
            </div>
          </div>

          {isStudent && (
            <div className="rbac-warning-card">
              <ShieldAlert size={16} />
              <div>
                <strong>Hạn chế phân quyền (RBAC)</strong>
                <p style={{ margin: "2px 0 0" }}>Tài khoản Sinh viên chỉ có quyền xem. Bạn cần đăng nhập tài khoản Giảng viên hoặc Quản trị viên để Phê duyệt lệnh phần cứng.</p>
              </div>
            </div>
          )}

          {execResult && (
            <div className={`result-banner ${execResult.success ? "success" : "warning"}`}>
              {execResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <div>
                <strong>{execResult.message}</strong>
                {execResult.detail?.edge_response && (
                  <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 8 }}>
                    Edge Response: {JSON.stringify(execResult.detail.edge_response)}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="detail-block">
            <h3>Tham số công cụ (Tool Parameters)</h3>
            <div className="code-row">
              <code>room_id</code>
              <b>{rec.room_id || rec.tool_params?.room_id || "LAB-02"}</b>
            </div>
            {Object.entries(rec.tool_params || {}).map(([k, v]) => (
              <div className="code-row" key={k}>
                <code>{k}</code>
                <b>{String(v)}</b>
              </div>
            ))}
          </div>

          <div className="detail-block">
            <h3>Phân tích ngữ cảnh AI Agent</h3>
            <p className="analysis">
              Chỉ số telemetry được đối chiếu tự động với quy trình vận hành chuẩn (SOP).
              Hệ thống kích hoạt hành động thông qua Edge Gateway API <code>/api/commands/room/execute</code> và phát lệnh MQTT tới thiết bị chấp hành.
            </p>
          </div>

          <details className="detail-block" open>
            <summary>Quy trình kiểm tra an toàn (Trace) <ChevronDown size={16} /></summary>
            <div className="trace">
              <p><i /><span><b>1 · Observe</b>Thu thập telemetry cảm biến và trạng thái FSM hiện tại.</span></p>
              <p><i /><span><b>2 · Evaluate</b>Đối chiếu ngưỡng cảnh báo và truy vấn SOP bằng vector embedding.</span></p>
              <p><i /><span><b>3 · Recommend & Dispatch</b>Sinh tool call, kiểm tra HITL policy và phát lệnh điều khiển.</span></p>
            </div>
          </details>

          {state === "Chờ phê duyệt" ? (
            <div className="approval">
              <div>
                <ShieldCheck />
                <p>
                  <b>Yêu cầu người vận hành xác nhận</b>
                  <span>Hành động sẽ chỉ gửi xuống phần cứng khi bạn bấm Phê duyệt.</span>
                </p>
              </div>
              <button
                className="outline-button danger-button"
                onClick={handleReject}
                disabled={executing || isStudent}
                title={isStudent ? "Sinh viên không có quyền từ chối lệnh" : ""}
              >
                Từ chối
              </button>
              <button
                className="primary-button"
                onClick={handleApprove}
                disabled={executing || isStudent}
                title={isStudent ? "Sinh viên không có quyền phê duyệt lệnh" : ""}
              >
                {executing ? <Loader2 size={15} className="spin" /> : <Check size={16} />}
                {isStudent ? "Yêu cầu quyền GV/Admin" : "Phê duyệt & Thực thi"}
              </button>
            </div>
          ) : (
            <div className="approval result">
              <Check />
              <p>
                <b>{state}</b>
                <span>Quyết định đã được thực thi và lưu trữ kiểm toán.</span>
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(initialRecommendations);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEventItem[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedRec, setSelectedRec] = useState<RecommendationItem | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [hitlEnabled, setHitlEnabled] = useState(true);
  const [hitlLoading, setHitlLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // RBAC & Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(getStoredUser());
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Corridor RFID Cards State (FR-RF-01)
  const [cardRequests, setCardRequests] = useState<CardRegistrationRequestItem[]>([]);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardSimulating, setCardSimulating] = useState(false);
  const [selectedCardForApproval, setSelectedCardForApproval] = useState<CardRegistrationRequestItem | null>(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [cardNotification, setCardNotification] = useState<string | null>(null);

  const refreshCardRequests = async () => {
    setCardLoading(true);
    try {
      const list = await getCardRegistrationRequests();
      setCardRequests(list);
    } catch (e) {
      console.warn("Lỗi tải danh sách thẻ:", e);
    } finally {
      setCardLoading(false);
    }
  };

  const handleApproveCard = async (payload: { full_name: string; username: string; role: string }) => {
    if (!selectedCardForApproval) return;
    setApprovalSubmitting(true);
    try {
      const updated = await approveCardRegistration(selectedCardForApproval.request_id, payload);
      setCardRequests((prev) =>
        prev.map((r) => (r.request_id === updated.request_id ? updated : r))
      );
      setSelectedCardForApproval(null);
      setCardNotification(`Đã duyệt thẻ ${updated.card_uid} cho ${updated.assigned_user_name}! Màn hình OLED Node Hành lang đã đồng bộ.`);
      setTimeout(() => setCardNotification(null), 7000);
    } catch (e: any) {
      alert(e.message || "Lỗi khi duyệt thẻ");
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handleRejectCard = async (req: CardRegistrationRequestItem) => {
    const reason = window.prompt("Nhập lý do từ chối thẻ:", "Thẻ không hợp lệ / Chưa đăng ký hồ sơ");
    if (reason === null) return;
    try {
      const updated = await rejectCardRegistration(req.request_id, reason);
      setCardRequests((prev) =>
        prev.map((r) => (r.request_id === updated.request_id ? updated : r))
      );
      setCardNotification(`Đã từ chối thẻ ${req.card_uid}. Corridor Node OLED hiển thị TU CHOI.`);
      setTimeout(() => setCardNotification(null), 7000);
    } catch (e: any) {
      alert(e.message || "Lỗi khi từ chối thẻ");
    }
  };

  const handleSimulateScan = async () => {
    setCardSimulating(true);
    try {
      const res = await simulateCorridorCardScan();
      setCardNotification(`Mô phỏng quẹt thẻ ${res.card_uid} tại Corridor Node thành công!`);
      setTimeout(() => setCardNotification(null), 8000);
      await refreshCardRequests();
    } catch (e: any) {
      alert(e.message || "Lỗi mô phỏng quẹt thẻ");
    } finally {
      setCardSimulating(false);
    }
  };

  // 1. Tải dữ liệu ban đầu và khởi động WebSocket
  useEffect(() => {
    let mounted = true;

    async function initData() {
      try {
        const user = await ensureAdminAuth();
        if (mounted) {
          setCurrentUser(user);
        }

        const [hitlStatus, roomList, recList, devList, cardList, eventList] = await Promise.allSettled([
          getHitlStatus(),
          getRooms(),
          getRecommendations("all"),
          getDevices(),
          getCardRegistrationRequests(),
          getRecentEvents(10),
        ]);

        if (!mounted) return;

        if (hitlStatus.status === "fulfilled") {
          setHitlEnabled(hitlStatus.value);
        }

        if (roomList.status === "fulfilled" && roomList.value.length > 0) {
          const mapped: Room[] = roomList.value.map((r: RoomData) => ({
            id: r.id,
            name: r.name,
            type: r.floor ? `Tầng ${r.floor}` : "Phòng học",
            mode: r.mode,
            temp: r.temperature !== null ? `${r.temperature}°C` : "28.5°C",
            humidity: r.humidity !== null ? `${r.humidity}%` : "60%",
            co2: r.co2 !== null ? `${r.co2} ppm` : "720 ppm",
            smoke: r.smoke || "Bình thường",
            occupancy: r.occupancy || 0,
            status: r.status,
            fan_on: r.fan_on,
            door_locked: r.door_locked,
          }));
          setRooms(mapped);
        }

        if (recList.status === "fulfilled" && recList.value.length > 0) {
          setRecommendations(recList.value);
        }

        if (devList.status === "fulfilled" && devList.value.length > 0) {
          setDevices(devList.value);
        }

        if (cardList.status === "fulfilled") {
          setCardRequests(cardList.value);
        }

        if (eventList.status === "fulfilled" && eventList.value.length > 0) {
          setRecentEvents(eventList.value);
        }
      } catch (err) {
        console.warn("Khởi tạo API:", err);
      }
    }

    initData();

    // 2. Kết nối WebSocket tunnel
    campusWs.connect();
    const unsubscribe = campusWs.subscribe((msg) => {
      console.log("⚡ [WS Event Received]:", msg);

      if (msg.type === "connection_status") {
        setWsConnected(Boolean(msg.connected));
      } else if (msg.type === "hitl_status_changed" || msg.type === "hitl_status") {
        setHitlEnabled(Boolean(msg.hitl_enabled));
      } else if (
        msg.type === "card_registration_request" ||
        msg.type === "card_registration_approved" ||
        msg.type === "card_registration_rejected"
      ) {
        getCardRegistrationRequests().then(setCardRequests).catch(() => {});
        if (msg.type === "card_registration_request") {
          const item = msg.data || msg;
          const cUid = item.card_uid || "RFID mới";
          setCardNotification(`Phát hiện thẻ mới tại Hành lang: ${cUid} - Đang chờ phê duyệt!`);
          setTimeout(() => setCardNotification(null), 8000);
        }
      } else if (msg.type === "ai_recommendation" || msg.type === "recommendation_created") {
        const raw = msg.recommendation || msg.data || msg;
        const recId = raw.id || raw.recommendation_id || raw.rec_id || msg.recommendation_id || msg.id;
        if (recId) {
          const item: RecommendationItem = {
            id: String(recId),
            event_id: raw.event_id || msg.event_id,
            room_id: raw.room_id || msg.room_id,
            tool_name: raw.tool_name || msg.tool_name || "send_alert",
            tool_params: raw.tool_params || msg.tool_params || {},
            reason: raw.reason || msg.reason,
            confidence: raw.confidence ?? msg.confidence ?? 0.95,
            urgency: raw.urgency || msg.urgency || "medium",
            status: raw.status || msg.status || "pending",
            created_at: raw.created_at || msg.created_at || new Date().toISOString(),
          };
          setRecommendations((prev) => [item, ...prev.filter((r) => r.id !== item.id)]);
        }
        getRecentEvents(10).then(setRecentEvents).catch(() => {});
      } else if (msg.type === "recommendation_executed" || msg.type === "tool_execution_dispatched") {
        const recId = msg.recommendation_id || msg.id || msg.data?.id;
        const newStatus = msg.status || (msg.is_auto ? "auto_approved" : "approved");
        if (recId) {
          setRecommendations((prev) =>
            prev.map((r) => (r.id === recId ? { ...r, status: newStatus } : r))
          );
        }
        getRecentEvents(10).then(setRecentEvents).catch(() => {});
      } else if (
        msg.type === "room_telemetry" ||
        msg.type === "room_mode_changed" ||
        msg.type === "fsm_transition"
      ) {
        getRooms()
          .then((roomList) => {
            if (roomList.length > 0) {
              setRooms(
                roomList.map((r) => ({
                  id: r.id,
                  name: r.name,
                  type: r.floor ? `Tầng ${r.floor}` : "Phòng học",
                  mode: r.mode,
                  temp: r.temperature !== null ? `${r.temperature}°C` : "28.5°C",
                  humidity: r.humidity !== null ? `${r.humidity}%` : "60%",
                  co2: r.co2 !== null ? `${r.co2} ppm` : "720 ppm",
                  smoke: r.smoke || "Bình thường",
                  occupancy: r.occupancy || 0,
                  status: r.status,
                  fan_on: r.fan_on,
                  door_locked: r.door_locked,
                }))
              );
            }
          })
          .catch(() => {});
        getRecentEvents(10).then(setRecentEvents).catch(() => {});
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Xử lý bật/tắt HITL (Chỉ Admin mới có quyền)
  const handleToggleHitl = async () => {
    if (currentUser?.role !== "admin") {
      alert("Chỉ Quản trị viên (Admin) mới có quyền bật/tắt chế độ HITL! Bạn đang đăng nhập với vai trò: " + (currentUser?.role || "Khách"));
      return;
    }

    setHitlLoading(true);
    try {
      const nextState = !hitlEnabled;
      const res = await toggleHitl(nextState);
      setHitlEnabled(res.hitl_enabled);
    } catch (err: any) {
      console.error("Lỗi toggle HITL:", err);
      alert("Lỗi khi chuyển chế độ HITL: " + (err.message || String(err)));
    } finally {
      setHitlLoading(false);
    }
  };

  // Xử lý phê duyệt/từ chối recommendation
  const handleExecuteRec = async (id: string, action: "approve" | "reject", notes?: string) => {
    const result = await executeRecommendation(id, action, notes);
    setRecommendations((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: action === "approve" ? "approved" : "rejected" } : r
      )
    );
    return result;
  };

  const handleOpenDecision = (rec?: RecommendationItem) => {
    const target = rec || recommendations[0];
    if (!target) {
      alert("Chưa có đề xuất (recommendation) nào từ AI Agent.");
      return;
    }
    const resolvedId = target.id || (target as any).recommendation_id || (target as any).rec_id;
    setSelectedRec({ ...target, id: String(resolvedId || target.id) });
    setDecisionOpen(true);
  };

  // Xử lý đăng xuất
  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setUserMenuOpen(false);
    setLoginModalOpen(true);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span><Building2 /></span>
          <div>
            <strong>SmartCampus</strong>
            <small>AI Operations</small>
          </div>
        </div>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => setPage(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Alerts & Decisions" && (
                <i>{recommendations.filter((r) => r.status === "pending").length}</i>
              )}
              {name === "Corridor RFID" && (
                <i style={{ background: cardRequests.filter((r) => r.status === "pending").length > 0 ? "#f59e0b" : "#475569" }}>
                  {cardRequests.filter((r) => r.status === "pending").length}
                </i>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection">
            <span><i style={{ background: wsConnected ? "#37bf8a" : "#f59e0b" }} /></span>
            <div>
              <b>{wsConnected ? "Hệ thống trực tuyến" : "Đang kết nối lại"}</b>
              <small>Edge & AI Realtime Tunnel</small>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <button
              className="profile"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              title="Nhấn để đổi tài khoản hoặc đăng xuất"
            >
              <span>{currentUser?.username?.slice(0, 2).toUpperCase() || "AD"}</span>
              <div>
                <b>{currentUser?.full_name || currentUser?.username || "Chưa đăng nhập"}</b>
                <div style={{ marginTop: 2 }}>
                  <UserRoleBadge role={currentUser?.role} />
                </div>
              </div>
              <MoreHorizontal size={16} />
            </button>

            {userMenuOpen && (
              <div className="user-menu-popover">
                <div className="user-info">
                  <strong>{currentUser?.full_name || currentUser?.username}</strong>
                  <small>{currentUser?.email}</small>
                  <div style={{ marginTop: 4 }}>
                    <UserRoleBadge role={currentUser?.role} />
                  </div>
                </div>
                <button
                  className="user-menu-btn"
                  onClick={() => {
                    setUserMenuOpen(false);
                    setLoginModalOpen(true);
                  }}
                >
                  <UserCheck size={14} />
                  <span>Chuyển đổi Role / Login</span>
                </button>
                <button className="user-menu-btn logout" onClick={handleLogout}>
                  <LogOut size={14} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <IconButton label="Mở menu"><Menu /></IconButton>
          <div className="breadcrumb">
            <span>SmartCampus</span>
            <ChevronRight size={14} />
            <b>{page}</b>
          </div>
          <div className="top-actions">
            <HitlToggleSwitch
              enabled={hitlEnabled}
              loading={hitlLoading}
              onToggle={handleToggleHitl}
              disabled={currentUser?.role !== "admin"}
            />
            <button
              className="search-button"
              onClick={() => setLoginModalOpen(true)}
              title="Đăng nhập tài khoản khác"
            >
              <User size={15} />
              <span>{currentUser?.username ? `Role: ${currentUser.role}` : "Đăng nhập"}</span>
              <kbd>RBAC</kbd>
            </button>
            <IconButton label="Hoạt động"><Clock3 /></IconButton>
            <IconButton
              label="Cảnh báo"
              onClick={() => {
                setPage("Alerts & Decisions");
              }}
            >
              <AlertTriangle />
            </IconButton>
          </div>
        </header>

        <main>
          {cardNotification && (
            <div className="corridor-toast-banner">
              <Radio size={20} className="pulse" style={{ color: "#60a5fa" }} />
              <div style={{ flex: 1, fontSize: "12px" }}>
                <strong>CORRIDOR NODE:</strong> {cardNotification}
              </div>
              <button
                onClick={() => {
                  setPage("Corridor RFID");
                  setCardNotification(null);
                }}
                style={{
                  background: "#3b82f6",
                  color: "white",
                  border: 0,
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Xem ngay
              </button>
              <button
                onClick={() => setCardNotification(null)}
                style={{ background: "transparent", border: 0, color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {page === "Dashboard" && (
            <Dashboard
              rooms={rooms}
              recommendations={recommendations}
              hitlEnabled={hitlEnabled}
              onToggleHitl={handleToggleHitl}
              hitlLoading={hitlLoading}
              openRoom={setSelectedRoom}
              openDecision={handleOpenDecision}
              currentUser={currentUser}
              recentEvents={recentEvents}
            />
          )}
          {page === "Alerts & Decisions" && (
            <AlertsPage
              recommendations={recommendations}
              openDecision={handleOpenDecision}
              hitlEnabled={hitlEnabled}
              onToggleHitl={handleToggleHitl}
              hitlLoading={hitlLoading}
              currentUser={currentUser}
            />
          )}
          {page === "Corridor RFID" && (
            <CorridorRfidPage
              cardRequests={cardRequests}
              onRefresh={refreshCardRequests}
              onApprove={(req) => setSelectedCardForApproval(req)}
              onReject={handleRejectCard}
              onSimulate={handleSimulateScan}
              simulating={cardSimulating}
              loading={cardLoading}
              currentUser={currentUser}
            />
          )}
          {page === "History & Devices" && <HistoryPage devices={devices} rooms={rooms} />}
          {page === "Audit Logs" && <AuditPage />}
          {page === "AI Assistant" && (
            <AssistantPage openDecision={() => handleOpenDecision()} rooms={rooms} />
          )}
          {page === "Settings" && (
            <SettingsPage
              hitlEnabled={hitlEnabled}
              onToggleHitl={handleToggleHitl}
              hitlLoading={hitlLoading}
              wsConnected={wsConnected}
              currentUser={currentUser}
              onOpenLogin={() => setLoginModalOpen(true)}
            />
          )}
        </main>
      </div>

      {selectedRoom && <RoomDrawer room={selectedRoom} close={() => setSelectedRoom(null)} />}
      {decisionOpen && (
        <DecisionDrawer
          recommendation={selectedRec}
          close={() => setDecisionOpen(false)}
          onExecute={handleExecuteRec}
          hitlEnabled={hitlEnabled}
          currentUser={currentUser}
        />
      )}

      {selectedCardForApproval && (
        <CorridorApprovalModal
          request={selectedCardForApproval}
          onClose={() => setSelectedCardForApproval(null)}
          onConfirm={handleApproveCard}
          submitting={approvalSubmitting}
        />
      )}

      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    </div>
  );
}
