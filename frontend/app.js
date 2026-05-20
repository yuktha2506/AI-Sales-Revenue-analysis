const { useEffect, useMemo, useRef, useState } = React;
const API_BASE = localStorage.getItem("apiBase") || "https://sales-analytics-backend-1zcz.onrender.com";

function money(value) {
  return `INR ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function ChartBox({ title, config }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !config) return;
    const chart = new Chart(canvasRef.current, config);
    return () => chart.destroy();
  }, [config]);
  return <section className="chart-panel"><h2>{title}</h2><canvas ref={canvasRef}></canvas></section>;
}

function Auth({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "Admin User", email: "admin@example.com", password: "Password@123" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      const data = await api(`/auth/${mode}`, { method: "POST", body: JSON.stringify(body) });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onAuthed(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-wrap">
    <form className="auth-panel" onSubmit={submit}>
      <h1>Sales Analytics</h1>
      <p>Sign in to view revenue KPIs, forecasts, and AI-assisted insights.</p>
      {mode === "register" && <label className="field">Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>}
      <label className="field">Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label className="field">Password<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
      {error && <div className="error">{error}</div>}
      <button disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}</button>
      <button type="button" className="secondary" onClick={() => setMode(mode === "login" ? "register" : "login")} style={{ marginLeft: 10 }}>
        {mode === "login" ? "Register" : "Use login"}
      </button>
    </form>
  </main>;
}

function Dashboard({ user }) {
  const [filters, setFilters] = useState({ startDate: "", endDate: "", category: "" });
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [liveMessage, setLiveMessage] = useState("Connecting live updates...");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).toString();
      const [analytics, predicted, orderData, userData, productData] = await Promise.all([
        api(`/analytics?${qs}`),
        api("/predict?months=6"),
        api("/orders"),
        user.role === "admin" ? api("/users") : Promise.resolve({ users: [] }),
        user.role === "admin" ? api("/products") : Promise.resolve({ products: [] })
      ]);
      setData(analytics);
      setForecast(predicted);
      setOrders(orderData.orders || []);
      setUsers(userData.users || []);
      setProducts(productData.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!window.io) {
      setLiveMessage("Live updates unavailable because Socket.io client did not load.");
      return;
    }
    const socket = io(API_BASE, { transports: ["websocket", "polling"] });
    socket.on("connected", () => setLiveMessage("Live updates connected"));
    socket.on("connect_error", () => setLiveMessage("Live updates disconnected"));
    socket.on("order:created", event => {
      setLiveMessage(`New order #${event.orderId} inserted. Dashboard refreshed.`);
      load();
    });
    return () => socket.disconnect();
  }, []);

  async function exportCsv() {
    const token = localStorage.getItem("token");
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))).toString();
    const res = await fetch(`${API_BASE}/analytics/export.csv?${qs}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "CSV export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sales-analytics-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function createDemoOrder() {
    const product = products[0];
    const customer = users.find(u => u.role === "user") || users[0] || user;
    if (!product || !customer) {
      setError("Need at least one product and one user before creating a demo order.");
      return;
    }
    await api("/orders", {
      method: "POST",
      body: JSON.stringify({
        userId: customer.id,
        date: new Date().toISOString().slice(0, 10),
        items: [{ productId: product.id, quantity: 1 }]
      })
    });
  }

  const lineConfig = useMemo(() => data && ({
    type: "line",
    data: { labels: data.monthlyRevenue.map(x => x.month), datasets: [{ label: "Revenue", data: data.monthlyRevenue.map(x => x.revenue), borderColor: "#126b63", tension: .3 }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  }), [data]);
  const catConfig = useMemo(() => data && ({
    type: "bar",
    data: { labels: data.categoryRevenue.map(x => x.category), datasets: [{ label: "Revenue", data: data.categoryRevenue.map(x => x.revenue), backgroundColor: "#4062bb" }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  }), [data]);
  const topConfig = useMemo(() => data && ({
    type: "bar",
    data: { labels: data.topProducts.map(x => x.name), datasets: [{ label: "Revenue", data: data.topProducts.map(x => x.revenue), backgroundColor: "#bc4b51" }] },
    options: { indexAxis: "y", responsive: true, plugins: { legend: { display: false } } }
  }), [data]);
  const forecastConfig = useMemo(() => forecast && ({
    type: "line",
    data: {
      labels: [...forecast.actual.map(x => x.month), ...forecast.forecast.map(x => x.month)],
      datasets: [
        { label: "Actual", data: [...forecast.actual.map(x => x.revenue), ...forecast.forecast.map(() => null)], borderColor: "#126b63" },
        { label: "Predicted", data: [...forecast.actual.map(() => null), ...forecast.forecast.map(x => x.predictedRevenue)], borderColor: "#9d6b00", borderDash: [6, 4] }
      ]
    }
  }), [forecast]);

  if (!data) return <div className="main">{loading ? "Loading dashboard..." : error}</div>;

  return <div className="main">
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
      <span className="pill">{user.role === "admin" ? "Admin: full analytics" : "User: personal analytics only"}</span>
      <span className="pill live">{liveMessage}</span>
    </div>
    <div className="filters">
      <label className="field">Start date<input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} /></label>
      <label className="field">End date<input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} /></label>
      <label className="field">Category<select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{data.categories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="field">&nbsp;<button onClick={load} disabled={loading}>{loading ? "Refreshing..." : "Apply filters"}</button></label>
    </div>
    {error && <div className="error">{error}</div>}
    <section className="kpis">
      <div className="kpi"><span>Total Revenue</span><strong>{money(data.kpis.totalRevenue)}</strong></div>
      <div className="kpi"><span>Total Orders</span><strong>{data.kpis.totalOrders.toLocaleString()}</strong></div>
      <div className="kpi"><span>Average Order Value</span><strong>{money(data.kpis.averageOrderValue)}</strong></div>
      <div className="kpi"><span>Top Product</span><strong>{data.topProducts[0]?.name || "N/A"}</strong></div>
    </section>
    <section className="charts">
      <ChartBox title="Monthly Revenue Trend" config={lineConfig} />
      <ChartBox title="Category-wise Revenue" config={catConfig} />
      <ChartBox title="Top Products" config={topConfig} />
      <ChartBox title="Predicted vs Actual Revenue" config={forecastConfig} />
    </section>
    <div className="insights panel" style={{ padding: 18 }}>
      <strong>{user.role === "admin" ? "Business insights" : "Personalized insights"}</strong>
      <p>The highest category and product panels identify revenue drivers for inventory and campaign planning. Monthly trends highlight seasonal demand and possible dips that merit promotion, stock, or fulfilment review. The forecast gives a directional revenue baseline for the next 3-6 months.</p>
      {forecast?.explanation && <p><strong>ML explanation:</strong> {forecast.explanation}</p>}
      {forecast?.model?.featureImportance?.[0] && <p><strong>Feature importance:</strong> {forecast.model.featureImportance[0].feature} is the main feature. {forecast.model.featureImportance[0].meaning}</p>}
      <button className="secondary" onClick={exportCsv}>Export CSV report</button>
      {user.role === "admin" && <button style={{ marginLeft: 10 }} onClick={createDemoOrder}>Insert demo order</button>}
    </div>
    <section className="split">
      <div className="panel" style={{ padding: 18 }}>
        <h2>{user.role === "admin" ? "All Recent Orders" : "My Recent Orders"}</h2>
        <div className="table-wrap"><table><thead><tr><th>ID</th><th>Date</th><th>Customer</th><th>Revenue</th></tr></thead><tbody>{orders.slice(0, 10).map(o => <tr key={o.id}><td>{o.id}</td><td>{o.date}</td><td>{o.customer}</td><td>{money(o.revenue)}</td></tr>)}</tbody></table></div>
      </div>
      {user.role === "admin" && <div className="panel" style={{ padding: 18 }}>
        <h2>Users</h2>
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Orders</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.totalOrders}</td></tr>)}</tbody></table></div>
      </div>}
    </section>
  </div>;
}

function Chat() {
  const [messages, setMessages] = useState([{ role: "assistant", text: "Ask about sales drops, top categories, revenue drivers, or forecast risks." }]);
  const [question, setQuestion] = useState("Which category performs best?");
  const [loading, setLoading] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (!question.trim()) return;
    const q = question.trim();
    setMessages(m => [...m, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);
    try {
      const data = await api("/chat", { method: "POST", body: JSON.stringify({ question: q }) });
      setMessages(m => [...m, { role: "assistant", text: data.answer }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", text: err.message }]);
    } finally {
      setLoading(false);
    }
  }

  return <div className="main"><section className="chat-panel"><h2>AI Insights Assistant</h2><div className="chat-log">{messages.map((m, i) => <div key={i} className={`bubble ${m.role === "user" ? "user" : ""}`}>{m.text}</div>)}</div><form className="chat-form" onSubmit={send}><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Why did sales drop last month?" /><button disabled={loading}>{loading ? "Thinking..." : "Send"}</button></form></section></div>;
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [page, setPage] = useState("dashboard");
  if (!user) return <Auth onAuthed={setUser} />;
  return <div className="shell">
    <header className="topbar"><div className="brand">AI Sales & Revenue Analytics</div><div>{user.name} <button className="secondary" onClick={() => { localStorage.clear(); setUser(null); }}>Logout</button></div></header>
    <div className="layout"><nav className="sidebar"><button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}>Dashboard</button><button className={page === "chat" ? "active" : ""} onClick={() => setPage("chat")}>AI Chat</button></nav>{page === "dashboard" ? <Dashboard user={user} /> : <Chat />}</div>
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
