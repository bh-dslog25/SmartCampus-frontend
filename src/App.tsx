import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  Clock3,
  Cpu,
  Database,
  DoorOpen,
  Fan,
  FileClock,
  History,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Radio,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Thermometer,
  Users,
  Wind,
  X,
  Zap,
} from "lucide-react";

type Page =
  | "Dashboard"
  | "Alerts & Decisions"
  | "History & Devices"
  | "Audit Logs"
  | "AI Assistant"
  | "Settings";

type Room = {
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
};

const rooms: Room[] = [
  { id: "A101", name: "Phòng A101", type: "Phòng học", mode: "LECTURE", temp: "28.5°C", humidity: "61%", co2: "720 ppm", smoke: "Bình thường", occupancy: 32, status: "online" },
  { id: "A102", name: "Phòng A102", type: "Phòng học", mode: "SELF_STUDY", temp: "27.8°C", humidity: "58%", co2: "680 ppm", smoke: "Bình thường", occupancy: 12, status: "online" },
  { id: "A201", name: "Phòng A201", type: "Phòng thi", mode: "EXAM", temp: "26.2°C", humidity: "57%", co2: "810 ppm", smoke: "Bình thường", occupancy: 42, status: "online" },
  { id: "LAB-02", name: "Lab 02", type: "Phòng thí nghiệm", mode: "SUSPECTED", temp: "30.1°C", humidity: "64%", co2: "890 ppm", smoke: "Nghi ngờ", occupancy: 18, status: "warning" },
  { id: "B101", name: "Phòng B101", type: "Phòng học", mode: "SAVING", temp: "25.6°C", humidity: "55%", co2: "510 ppm", smoke: "Bình thường", occupancy: 0, status: "online" },
  { id: "B102", name: "Phòng B102", type: "Phòng học", mode: "LECTURE", temp: "27.1°C", humidity: "59%", co2: "740 ppm", smoke: "Bình thường", occupancy: 28, status: "online" },
];

const nav: { name: Page; icon: typeof LayoutDashboard }[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Alerts & Decisions", icon: AlertTriangle },
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

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

function SectionHead({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div><h2>{title}</h2>{hint && <p>{hint}</p>}</div>
      {action}
    </div>
  );
}

function DigitalTwin({ onRoom }: { onRoom: (room: Room) => void }) {
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

    const roomGeometry = new THREE.BoxGeometry(2.35, 0.65, 2.2);
    const positions = [
      [-2.75, 0.28, -1.35], [0, 0.28, -1.35], [2.75, 0.28, -1.35],
      [-2.75, 0.28, 1.35], [0, 0.28, 1.35], [2.75, 0.28, 1.35],
    ];
    const meshes: THREE.Mesh[] = [];
    positions.forEach((position, index) => {
      const color = rooms[index].status === "warning" ? 0xf59e0b : rooms[index].mode === "SAVING" ? 0x94a3b8 : 0x3b82f6;
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.64 });
      const mesh = new THREE.Mesh(roomGeometry, material);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.castShadow = true;
      mesh.userData.roomIndex = index;
      scene.add(mesh);
      meshes.push(mesh);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(roomGeometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
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
      if (target) onRoom(rooms[target.userData.roomIndex]);
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
  }, [onRoom]);

  return (
    <div className="twin-wrap">
      <div className="twin-stage" ref={mountRef} />
      <div className="twin-title">
        <span className="eyebrow">DIGITAL TWIN · TẦNG 1–2</span>
        <strong>Khối giảng đường A</strong>
        <span>Chọn một phòng để xem ngữ cảnh vận hành</span>
      </div>
      <div className="twin-legend"><span><i className="dot blue" />Đang hoạt động</span><span><i className="dot amber" />Cần chú ý</span><span><i className="dot gray" />Tiết kiệm</span></div>
      <div className="twin-labels">
        {rooms.map((room) => <button key={room.id} onClick={() => onRoom(room)}>{room.id}</button>)}
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

function Dashboard({ openRoom, openDecision }: { openRoom: (r: Room) => void; openDecision: () => void }) {
  return (
    <>
      <div className="page-title">
        <div><span className="eyebrow">TỔNG QUAN VẬN HÀNH</span><h1>Chào buổi sáng, Quản trị viên</h1><p>Theo dõi trạng thái campus và phê duyệt các đề xuất từ AI Agent.</p></div>
        <div className="status-live"><i /> LIVE · Cập nhật 10 giây trước</div>
      </div>
      <div className="metrics">
        <Metric icon={<Building2 />} label="Tổng số phòng" value="06" meta="Dữ liệu demo đã kết nối" />
        <Metric icon={<AlertTriangle />} label="Phòng có cảnh báo" value="01" meta="LAB-02 · SUSPECTED" tone="amber" />
        <Metric icon={<Activity />} label="Phòng hoạt động" value="05" meta="1 phòng đang SAVING" tone="green" />
        <Metric icon={<Cpu />} label="Trạng thái thiết bị" value="18 / 19" meta="1 thiết bị ngoại tuyến" tone="slate" />
        <Metric icon={<ShieldCheck />} label="Sức khỏe hệ thống" value="Ổn định" meta="Edge & AI đã kết nối" tone="green" />
      </div>

      <div className="dashboard-grid">
        <Panel className="digital-panel">
          <SectionHead title="Bản sao số Campus" hint="Mô hình không gian thời gian thực" action={<Badge tone="info">MÔ PHỎNG</Badge>} />
          <DigitalTwin onRoom={openRoom} />
        </Panel>
        <Panel className="sensor-panel">
          <SectionHead title="Cảm biến thời gian thực" hint="Giá trị mới nhất từ Edge Gateway" action={<MoreHorizontal size={18} />} />
          <div className="sensor-list">
            {[
              { icon: <Thermometer />, name: "Nhiệt độ", value: "30.1°C", room: "LAB-02", time: "10:42:18", tone: "amber" },
              { icon: <Wind />, name: "Độ ẩm", value: "64%", room: "LAB-02", time: "10:42:18", tone: "blue" },
              { icon: <Activity />, name: "CO₂", value: "890 ppm", room: "LAB-02", time: "10:42:16", tone: "blue" },
              { icon: <AlertTriangle />, name: "Khói", value: "SUSPECTED", room: "LAB-02", time: "10:42:12", tone: "amber" },
              { icon: <CircleGauge />, name: "Chất lượng KK", value: "Trung bình", room: "LAB-02", time: "10:42:15", tone: "slate" },
            ].map((sensor) => (
              <div className="sensor-row" key={sensor.name}>
                <span className={`sensor-icon ${sensor.tone}`}>{sensor.icon}</span>
                <div><strong>{sensor.name}</strong><span>{sensor.room} · {sensor.time}</span></div>
                <b>{sensor.value}</b>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="room-section">
        <SectionHead title="Giám sát phòng" hint="Trạng thái FSM và telemetry mới nhất" action={<button className="text-button">Xem sơ đồ tầng <ChevronRight size={15} /></button>} />
        <div className="room-grid">
          {rooms.map((room) => (
            <button className="room-card" key={room.id} onClick={() => openRoom(room)}>
              <div className="room-card-head">
                <div><strong>{room.name}</strong><span>{room.type} · {room.id}</span></div>
                <Badge tone={room.status === "warning" ? "warning" : "success"}>{room.mode}</Badge>
              </div>
              <div className="room-readings">
                <span>Nhiệt độ <b>{room.temp}</b></span>
                <span>Độ ẩm <b>{room.humidity}</b></span>
                <span>CO₂ <b>{room.co2}</b></span>
                <span>Số người <b>{room.occupancy}</b></span>
              </div>
              <div className="room-card-foot"><span className={room.status}><i />{room.status === "online" ? "Trực tuyến" : "Cần chú ý"}</span><ChevronRight size={16} /></div>
            </button>
          ))}
        </div>
      </Panel>

      <div className="bottom-grid">
        <Panel>
          <SectionHead title="Cảnh báo gần đây" action={<button className="text-button">Xem tất cả</button>} />
          <div className="event-row warning-event">
            <span className="event-icon"><AlertTriangle /></span>
            <div><strong>Phát hiện khói lần đầu</strong><p>LAB-02 · Smoke value 428 · Ngưỡng 400</p></div>
            <time>10:42</time>
            <button className="outline-button" onClick={openDecision}>Xem quyết định</button>
          </div>
          <div className="event-row">
            <span className="event-icon neutral"><Radio /></span>
            <div><strong>ESP32 mất heartbeat</strong><p>Phòng A203 · Không phản hồi sau 90 giây</p></div>
            <time>10:31</time>
          </div>
        </Panel>
        <Panel>
          <SectionHead title="Quyết định AI mới nhất" action={<Badge tone="warning">CHỜ PHÊ DUYỆT</Badge>} />
          <div className="decision-summary">
            <div className="decision-id"><span>EVT-SMK-2048</span><time>10:42:24</time></div>
            <p>Chỉ số khói vượt ngưỡng tại LAB-02. AI Agent khuyến nghị kích hoạt cảnh báo cục bộ và kiểm tra trực tiếp.</p>
            <div className="recommend"><Zap size={18} /><div><span>KHUYẾN NGHỊ</span><strong>trigger_buzzer</strong></div><Badge tone="danger">HIGH</Badge></div>
            <button className="primary-button wide" onClick={openDecision}>Xem và phê duyệt <ChevronRight size={16} /></button>
          </div>
        </Panel>
      </div>
      <p className="demo-note">Giao diện prototype · Telemetry hiển thị là dữ liệu mô phỏng theo đúng cấu trúc backend.</p>
    </>
  );
}

function AlertsPage({ openDecision }: { openDecision: () => void }) {
  const [tab, setTab] = useState("Tất cả");
  return (
    <>
      <div className="page-title"><div><span className="eyebrow">HUMAN-IN-THE-LOOP</span><h1>Cảnh báo & Quyết định</h1><p>Đánh giá sự kiện và phê duyệt hành động do AI Agent đề xuất.</p></div></div>
      <Panel>
        <div className="tabs">{["Tất cả", "Cảnh báo", "Quyết định AI"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
        <div className="table-tools"><div className="search"><Search size={16} /><input placeholder="Tìm theo event ID hoặc phòng..." /></div><button className="outline-button">Trạng thái <ChevronDown size={15} /></button></div>
        <div className="data-table">
          <div className="table-head"><span>SỰ KIỆN</span><span>PHÒNG</span><span>PHÂN TÍCH / LOẠI</span><span>THỜI GIAN</span><span>TRẠNG THÁI</span><span /></div>
          {[
            ["EVT-SMK-2048", "LAB-02", "Khói vượt ngưỡng lần đầu", "10:42:24", "Chờ phê duyệt"],
            ["EVT-DEV-2047", "A203", "Heartbeat timeout", "10:31:02", "Đang đánh giá"],
            ["EVT-TMP-2046", "A101", "Nhiệt độ tăng liên tục", "09:58:45", "Đã duyệt"],
            ["EVT-OCC-2045", "A201", "Phiên thi đã bắt đầu", "09:30:00", "Đã bỏ qua"],
          ].map((row, i) => (
            <button className="table-row" key={row[0]} onClick={openDecision}>
              <span><b>{row[0]}</b><small>{i === 0 ? "smoke_detected" : "room_event"}</small></span><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span><span><Badge tone={i === 0 ? "warning" : i === 2 ? "success" : "neutral"}>{row[4]}</Badge></span><span><ChevronRight size={16} /></span>
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}

function HistoryPage() {
  const [tab, setTab] = useState("Lịch sử");
  return (
    <>
      <div className="page-title"><div><span className="eyebrow">DỮ LIỆU CAMPUS</span><h1>Lịch sử & Thiết bị</h1><p>Khám phá telemetry lịch sử và quản lý hạ tầng IoT.</p></div></div>
      <Panel>
        <div className="tabs">{["Lịch sử", "Thiết bị"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
        {tab === "Lịch sử" ? (
          <>
            <div className="filters"><button className="outline-button">Phòng: LAB-02 <ChevronDown size={15} /></button><button className="outline-button">Nhiệt độ <ChevronDown size={15} /></button><button className="outline-button">24 giờ qua <ChevronDown size={15} /></button></div>
            <div className="chart-area">
              <div className="chart-title"><div><span>NHIỆT ĐỘ · LAB-02</span><strong>30.1°C</strong></div><Badge tone="info">DỮ LIỆU MÔ PHỎNG</Badge></div>
              <svg viewBox="0 0 900 220" role="img" aria-label="Biểu đồ nhiệt độ">
                {[30, 75, 120, 165, 210].map((y) => <line key={y} x1="20" x2="890" y1={y} y2={y} />)}
                <path d="M20,177 C90,166 122,168 170,144 S260,158 315,125 S400,140 455,102 S545,115 600,82 S690,98 738,65 S825,78 890,38" />
              </svg>
              <div className="chart-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Hiện tại</span></div>
            </div>
          </>
        ) : (
          <div className="data-table device-table">
            <div className="table-head"><span>THIẾT BỊ</span><span>PHÒNG</span><span>LOẠI</span><span>HEARTBEAT</span><span>TRẠNG THÁI</span><span /></div>
            {[["ESP32-A101", "A101", "Edge node", "12 giây trước", "Trực tuyến"], ["DHT22-L02", "LAB-02", "Cảm biến", "4 giây trước", "Trực tuyến"], ["MQ2-L02", "LAB-02", "Cảm biến khói", "3 giây trước", "Trực tuyến"], ["ESP32-A203", "A203", "Edge node", "2 phút trước", "Ngoại tuyến"]].map((r, i) => <div className="table-row" key={r[0]}><span><b>{r[0]}</b></span><span>{r[1]}</span><span>{r[2]}</span><span>{r[3]}</span><span><Badge tone={i === 3 ? "danger" : "success"}>{r[4]}</Badge></span><span><MoreHorizontal size={17} /></span></div>)}
          </div>
        )}
      </Panel>
    </>
  );
}

function AuditPage() {
  const [tab, setTab] = useState("Agent Tool Calls");
  return (
    <>
      <div className="page-title"><div><span className="eyebrow">TRUY VẾT HỆ THỐNG</span><h1>Nhật ký kiểm toán</h1><p>Tool activity và fallback audit được lưu trữ độc lập.</p></div><button className="outline-button">Xuất CSV</button></div>
      <Panel>
        <div className="tabs">{["Agent Tool Calls", "Fallback Audit"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
        <div className="data-table audit-table">
          <div className="table-head"><span>THỜI GIAN</span><span>COMPONENT</span><span>{tab === "Agent Tool Calls" ? "TOOL" : "FALLBACK LEVEL"}</span><span>KẾT QUẢ / LÝ DO</span><span>LEVEL</span><span /></div>
          {(tab === "Agent Tool Calls" ? [
            ["10:42:24", "react_agent", "get_room_context", "Context loaded · LAB-02", "INFO"],
            ["10:42:23", "rag_service", "search_sop", "3 evidence items returned", "INFO"],
            ["09:58:46", "react_agent", "set_fan", "Pending operator approval", "WARN"],
          ] : [
            ["08:12:03", "ai_service", "LEVEL_1", "Primary model timeout", "WARN"],
            ["08:12:05", "rule_engine", "LEVEL_2", "Rule-based recommendation", "INFO"],
          ]).map((r) => <div className="table-row" key={r.join()}><span>{r[0]}</span><span>{r[1]}</span><span><code>{r[2]}</code></span><span>{r[3]}</span><span><Badge tone={r[4] === "WARN" ? "warning" : "info"}>{r[4]}</Badge></span><span><ChevronRight size={16} /></span></div>)}
        </div>
      </Panel>
    </>
  );
}

function AssistantPage({ openDecision }: { openDecision: () => void }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="assistant-layout">
      <div className="assistant-main">
        <div className="page-title compact"><div><span className="eyebrow">AI AGENT + RAG</span><h1>Trợ lý vận hành</h1><p>Hỏi về ngữ cảnh phòng, sự kiện và SOP.</p></div><Badge tone="success">AI SERVICE ONLINE</Badge></div>
        <div className="chat">
          <div className="chat-day">HÔM NAY</div>
          <div className="bubble user">Tại sao phòng LAB-02 đang cảnh báo?</div>
          <div className="bubble ai">
            <span className="bubble-label"><Bot size={16} /> SMARTCAMPUS AGENT</span>
            <p>Chỉ số khói tại LAB-02 là <b>428</b>, vượt ngưỡng cấu hình <b>400</b>. FSM đã chuyển từ LECTURE sang SUSPECTED sau lần phát hiện đầu tiên.</p>
            <div className="evidence"><span>BẰNG CHỨNG</span><p>MQ2 reading · 10:42:12</p><p>Room state transition · 10:42:13</p></div>
            <div className="assistant-recommend"><Zap size={18} /><div><span>KHUYẾN NGHỊ · HIGH</span><strong>trigger_buzzer</strong></div><button className="text-button" onClick={openDecision}>Xem quyết định <ChevronRight size={15} /></button></div>
          </div>
          {sent && <><div className="bubble user">Cho tôi xem SOP xử lý khói.</div><div className="bubble ai"><span className="bubble-label"><Bot size={16} /> SMARTCAMPUS AGENT</span><p>Theo SOP liên quan, quản trị viên cần xác minh trực tiếp tại phòng, chuẩn bị sơ tán nếu phát hiện lần hai trong 5 giây, và chỉ phê duyệt hành động sau khi kiểm tra ngữ cảnh.</p></div></>}
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <input aria-label="Câu hỏi" placeholder="Hỏi về phòng, cảm biến, sự kiện hoặc SOP..." />
          <button aria-label="Gửi"><Send size={18} /></button>
        </form>
      </div>
      <aside className="assistant-side">
        <h2>Ngữ cảnh hiện tại</h2>
        <div className="context-room"><span>ĐANG XEM</span><strong>LAB-02</strong><p>Phòng thí nghiệm · SUSPECTED</p></div>
        <h3>Gợi ý câu hỏi</h3>
        {["Phòng nào đang có cảnh báo?", "Tóm tắt phiên học A101", "Thiết bị nào đang ngoại tuyến?", "SOP xử lý khói là gì?"].map((q) => <button key={q} onClick={() => setSent(true)}>{q}<ChevronRight size={14} /></button>)}
        <div className="assistant-safety"><ShieldCheck size={19} /><div><strong>Phê duyệt bởi con người</strong><p>AI không tự động thực thi hành động.</p></div></div>
      </aside>
    </div>
  );
}

function SettingsPage() {
  return (
    <>
      <div className="page-title"><div><span className="eyebrow">CẤU HÌNH</span><h1>Cài đặt</h1><p>Quản lý kết nối campus, AI Agent và trạng thái hệ thống.</p></div></div>
      <div className="settings-grid">
        {[
          ["Cấu hình chung", "Campus và thông báo", Building2, ["Campus configuration", "Realtime connection", "Notification settings"]],
          ["AI Agent", "Mô hình và tri thức", Bot, ["Agent configuration", "RAG configuration", "Fallback configuration"]],
          ["Trạng thái hệ thống", "Dịch vụ và kết nối", Activity, ["Edge API · Connected", "AI Service · Connected", "WebSocket · Connected"]],
        ].map(([title, subtitle, Icon, items]) => (
          <Panel key={String(title)} className="settings-card">
            <span className="settings-icon"><Icon /></span><div><h2>{String(title)}</h2><p>{String(subtitle)}</p></div>
            <div className="settings-links">{(items as string[]).map((item) => <button key={item}><span>{item}</span>{String(title) === "Trạng thái hệ thống" ? <i /> : <ChevronRight size={16} />}</button>)}</div>
          </Panel>
        ))}
      </div>
    </>
  );
}

function RoomDrawer({ room, close }: { room: Room; close: () => void }) {
  return (
    <div className="drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside className="drawer">
        <div className="drawer-head"><div><span className="eyebrow">ROOM CONTEXT</span><h2>{room.name}</h2><p>{room.type} · {room.id}</p></div><IconButton label="Đóng" onClick={close}><X /></IconButton></div>
        <div className="drawer-status"><Badge tone={room.status === "warning" ? "warning" : "success"}>{room.mode}</Badge><span><i /> Cập nhật 10 giây trước</span></div>
        <div className="drawer-content">
          <div className="detail-block"><h3>Ngữ cảnh phòng</h3><div className="key-grid"><span>Room ID<b>{room.id}</b></span><span>Loại phòng<b>{room.type}</b></span><span>Current mode<b>{room.mode}</b></span><span>Smoke state<b>{room.smoke}</b></span></div></div>
          <div className="detail-block"><h3>Telemetry summary</h3><p className="window">10:27:18 → 10:42:18</p><div className="telemetry-grid">{[["Nhiệt độ", room.temp, "26.4", "30.1", "28.2"], ["Độ ẩm", room.humidity, "57", "64", "60"], ["CO₂", room.co2, "620", "890", "744"], ["Khói", room.smoke, "112", "428", "184"]].map((r) => <div key={r[0]}><span>{r[0]}</span><strong>{r[1]}</strong><small>MIN {r[2]} · MAX {r[3]} · AVG {r[4]}</small></div>)}</div></div>
          <div className="detail-block"><h3>Số người hiện diện</h3><div className="occupancy"><Users /><div><strong>{room.occupancy}</strong><span>Hiện tại</span></div><div><strong>47</strong><span>Tổng vào</span></div><div><strong>29</strong><span>Tổng ra</span></div><Badge tone="info">Tăng</Badge></div></div>
          <div className="detail-block"><h3>Phiên học đang hoạt động</h3>{room.mode === "SAVING" ? <p className="empty">Không có phiên học đang hoạt động</p> : <div className="session"><div><span>Giảng viên</span><b>Nguyễn Minh Anh</b></div><div><span>Mã lớp</span><b>AT19A</b></div><div><span>Bắt đầu</span><b>09:30</b></div><div><span>Điểm danh</span><b>32 / 40</b></div></div>}</div>
          <details className="detail-block"><summary>Sự kiện gần đây <ChevronDown size={16} /></summary><div className="timeline"><p><i />10:42 · smoke_suspected</p><p><i />10:31 · occupancy_updated</p><p><i />09:30 · session_started</p></div></details>
          <details className="detail-block"><summary>Environment Context <ChevronDown size={16} /></summary><p className="empty">Source: edge_gateway · 15 phút gần nhất · 450 readings</p></details>
        </div>
      </aside>
    </div>
  );
}

function DecisionDrawer({ close }: { close: () => void }) {
  const [state, setState] = useState("Chờ phê duyệt");
  return (
    <div className="drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <aside className="drawer decision-drawer">
        <div className="drawer-head"><div><span className="eyebrow">AI DECISION · EVT-SMK-2048</span><h2>Đề xuất xử lý khói</h2><p>LAB-02 · 10:42:24</p></div><IconButton label="Đóng" onClick={close}><X /></IconButton></div>
        <div className="drawer-status"><Badge tone={state === "Đã phê duyệt" ? "success" : state === "Đã từ chối" ? "danger" : "warning"}>{state}</Badge><Badge tone="danger">URGENCY · HIGH</Badge></div>
        <div className="drawer-content">
          <div className="recommendation-card">
            <span className="recommendation-icon"><Fan /></span>
            <div><span>AI RECOMMENDATION</span><h3>trigger_buzzer</h3><p>Kích hoạt cảnh báo cục bộ để nhân viên tại khu vực kiểm tra LAB-02 ngay lập tức.</p></div>
            <div className="confidence"><span>ĐỘ TIN CẬY</span><strong>94%</strong></div>
          </div>
          <div className="detail-block"><h3>Phân tích AI</h3><p className="analysis">Chỉ số MQ2 mới nhất là 428, vượt ngưỡng cấu hình 400. Đây là lần phát hiện đầu tiên nên FSM đang ở trạng thái SUSPECTED. Cần xác minh tại chỗ trước khi có hành động tiếp theo.</p></div>
          <div className="detail-block"><h3>Tham số hành động</h3><div className="code-row"><code>room_id</code><b>LAB-02</b></div><div className="code-row"><code>duration_seconds</code><b>10</b></div></div>
          <div className="detail-block alternative"><h3>Alternative Action</h3><div><b>notify_security</b><Badge tone="neutral">82% · MEDIUM</Badge></div><p>Gửi thông báo cho đội an ninh để kiểm tra phòng.</p></div>
          <details className="detail-block" open><summary>AI Evaluation Trace <ChevronDown size={16} /></summary><div className="trace"><p><i /><span><b>1 · Observe</b>Đọc operational context và telemetry.</span></p><p><i /><span><b>2 · Evaluate</b>Đối chiếu smoke threshold và trạng thái FSM.</span></p><p><i /><span><b>3 · Recommend</b>Đề xuất tool; chưa thực thi.</span></p></div></details>
          <details className="detail-block"><summary>Agent Tool Activity <ChevronDown size={16} /></summary><p className="empty">2 tool calls · get_room_context, search_sop</p></details>
          {state === "Chờ phê duyệt" ? <div className="approval"><div><ShieldCheck /><p><b>Yêu cầu phê duyệt của người vận hành</b><span>AI Agent sẽ không tự động thực thi đề xuất.</span></p></div><button className="outline-button danger-button" onClick={() => setState("Đã từ chối")}>Từ chối</button><button className="primary-button" onClick={() => setState("Đã phê duyệt")}><Check size={16} />Phê duyệt</button></div> : <div className="approval result"><Check /><p><b>{state}</b><span>Quyết định của operator đã được ghi vào audit log.</span></p></div>}
        </div>
      </aside>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [room, setRoom] = useState<Room | null>(null);
  const [decision, setDecision] = useState(false);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span><Building2 /></span><div><strong>SmartCampus</strong><small>AI Operations</small></div></div>
        <nav>{nav.map(({ name, icon: Icon }) => <button key={name} className={page === name ? "active" : ""} onClick={() => setPage(name)}><Icon size={18} /><span>{name}</span>{name === "Alerts & Decisions" && <i>2</i>}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="connection"><span><i /></span><div><b>Hệ thống ổn định</b><small>Edge Gateway · Connected</small></div></div>
          <button className="profile"><span>NA</span><div><b>Nguyễn An</b><small>Campus Admin</small></div><MoreHorizontal size={16} /></button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <IconButton label="Mở menu"><Menu /></IconButton>
          <div className="breadcrumb"><span>SmartCampus</span><ChevronRight size={14} /><b>{page}</b></div>
          <div className="top-actions"><button className="search-button"><Search size={16} /><span>Tìm kiếm</span><kbd>⌘ K</kbd></button><IconButton label="Hoạt động"><Clock3 /></IconButton><IconButton label="Cảnh báo"><AlertTriangle /></IconButton></div>
        </header>
        <main>
          {page === "Dashboard" && <Dashboard openRoom={setRoom} openDecision={() => setDecision(true)} />}
          {page === "Alerts & Decisions" && <AlertsPage openDecision={() => setDecision(true)} />}
          {page === "History & Devices" && <HistoryPage />}
          {page === "Audit Logs" && <AuditPage />}
          {page === "AI Assistant" && <AssistantPage openDecision={() => setDecision(true)} />}
          {page === "Settings" && <SettingsPage />}
        </main>
      </div>
      {room && <RoomDrawer room={room} close={() => setRoom(null)} />}
      {decision && <DecisionDrawer close={() => setDecision(false)} />}
    </div>
  );
}
