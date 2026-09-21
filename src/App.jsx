import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Scan, 
  Calendar, 
  Package, 
  ListFilter, 
  ChevronLeft, 
  Check, 
  AlertTriangle, 
  Search, 
  X, 
  Bell, 
  FileSpreadsheet,
  ChevronRight,
  Camera,
  Plus,
  Trash2,
  Store,
  CheckCircle2,
  BarChart3,
  Layers,
  Sparkles,
  RefreshCw,
  Factory
} from "lucide-react";
import GestionTraspaso, { CameraScannerModal, resolverCodigo } from "./GestionTraspaso";

const STORAGE_KEY = "vencicontrol_pro_data";

const CATEGORIAS = [
  "Abarrotes", 
  "Lácteos y Quesos", 
  "Panadería y Pastelería", 
  "Bebidas y Licores", 
  "Congelados",
  "Frutas y Verduras", 
  "Cecinas y Embutidos", 
  "Limpieza y Hogar", 
  "Cuidado Personal",
  "Mascotas",
  "Otro"
];

function diasHasta(fechaISO) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fechaISO + "T00:00:00");
  return Math.round((f - hoy) / 86400000);
}

function estadoUrgencia(dias) {
  if (dias < 0) return "vencido";
  if (dias <= 3) return "critico";
  if (dias <= 7) return "proximo";
  return "normal";
}

const URGENCIA_STYLES = {
  vencido: {
    bg: "#FEF2F2",
    border: "#FCA5A5",
    text: "#991B1B",
    badgeBg: "#FEE2E2",
    label: "Vencido",
    dotColor: "#EF4444"
  },
  critico: {
    bg: "#FFFBEB",
    border: "#FDE68A",
    text: "#92400E",
    badgeBg: "#FEF3C7",
    label: "Crítico (0-3 días)",
    dotColor: "#F59E0B"
  },
  proximo: {
    bg: "#EFF6FF",
    border: "#BFDBFE",
    text: "#1E40AF",
    badgeBg: "#DBEAFE",
    label: "Próximo (4-7 días)",
    dotColor: "#3B82F6"
  },
  normal: {
    bg: "#ECFDF5",
    border: "#A7F3D0",
    text: "#065F46",
    badgeBg: "#D1FAE5",
    label: "Sin riesgo",
    dotColor: "#10B981"
  },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function exportarCSV(lotes) {
  if (!lotes || lotes.length === 0) return false;

  const headers = [
    "Código de Barra",
    "Producto",
    "Categoría",
    "Ubicación",
    "Unidades",
    "Fecha Ingreso",
    "Fecha Vencimiento",
    "Días Restantes",
    "Estado de Urgencia"
  ];

  const filas = lotes.map((l) => {
    const dias = diasHasta(l.fechaVencimiento);
    const estadoKey = estadoUrgencia(dias);
    const estadoEtiqueta = URGENCIA_STYLES[estadoKey]?.label || estadoKey;
    const nombreLimpio = l.nombre ? l.nombre.replace(/"/g, '""') : "";
    const ubicacionTxt = l.ubicacion === "produccion" ? "Producción" : "Bodega";
    
    return [
      `"${l.barcode}"`,
      `"${nombreLimpio}"`,
      `"${l.categoria || ''}"`,
      `"${ubicacionTxt}"`,
      l.cantidad || 1,
      l.fechaIngreso || "-",
      l.fechaVencimiento || "-",
      dias,
      `"${estadoEtiqueta}"`
    ].join(";");
  });

  const csvContent = "\uFEFF" + [headers.join(";"), ...filas].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const fechaHoy = new Date().toISOString().slice(0, 10);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `vencicontrol_reporte_${fechaHoy}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export default function App() {
  const [vista, setVista] = useState("ingresar");
  const [productos, setProductos] = useState({});
  const [lotes, setLotes] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [toast, setToast] = useState(null);
  const [resumenOculto, setResumenOculto] = useState(false);
  const [filtroInicial, setFiltroInicial] = useState("todos");

  useEffect(() => {
    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.type = "image/svg+xml";
    favicon.href = "/favicon.svg";

    let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = "/apple-touch-icon.png";

    let manifestLink = document.querySelector("link[rel='manifest']");
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = "/manifest.json";

    let themeColor = document.querySelector("meta[name='theme-color']");
    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      document.head.appendChild(themeColor);
    }
    themeColor.content = "#0F172A";
  }, []);

  useEffect(() => {
    (async () => {
      try {
        let data = null;
        if (window.storage && typeof window.storage.get === "function") {
          const res = await window.storage.get(STORAGE_KEY, true);
          if (res && res.value) data = JSON.parse(res.value);
        } else {
          const localData = localStorage.getItem(STORAGE_KEY);
          if (localData) data = JSON.parse(localData);
        }

        if (data) {
          setProductos(data.productos || {});
          setLotes(data.lotes || []);
        }
      } catch (e) {
        console.error("Error al cargar inventario:", e);
      } finally {
        setCargado(true);
      }
    })();
  }, []);

  const guardar = async (nuevosProductos, nuevosLotes) => {
    setProductos(nuevosProductos);
    setLotes(nuevosLotes);
    const dataStr = JSON.stringify({ productos: nuevosProductos, lotes: nuevosLotes });
    try {
      if (window.storage && typeof window.storage.set === "function") {
        await window.storage.set(STORAGE_KEY, dataStr, true);
      } else {
        localStorage.setItem(STORAGE_KEY, dataStr);
      }
    } catch (e) {
      mostrarToast("Error al guardar cambios.", "error");
    }
  };

  const mostrarToast = (mensaje, tipo = "ok") => {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 3200);
  };

  const registrarLote = ({ barcode, nombre, categoria, fechaVencimiento, cantidad, fechaIngreso }) => {
    const nuevosProductos = { ...productos, [barcode]: { nombre, categoria } };
    const nuevoLote = {
      id: uid(),
      barcode,
      nombre,
      categoria,
      fechaIngreso: fechaIngreso || new Date().toISOString().slice(0, 10),
      fechaVencimiento,
      cantidad,
      ubicacion: "bodega"
    };
    guardar(nuevosProductos, [nuevoLote, ...lotes]);
    mostrarToast(`Ingresado a Bodega: ${nombre} (${cantidad} un.) [Llegada: ${nuevoLote.fechaIngreso}]`, "ok");
  };

  const eliminarLote = (id) => {
    guardar(productos, lotes.filter((l) => l.id !== id));
    mostrarToast("Registro descartado del sistema.", "ok");
  };

  const handleExportar = () => {
    if (lotes.length === 0) {
      mostrarToast("No hay registros para exportar.", "error");
      return;
    }
    const exito = exportarCSV(lotes);
    if (exito) mostrarToast("Reporte descargado con éxito.", "ok");
  };

  const irAPanelConFiltro = (filtro) => {
    setFiltroInicial(filtro);
    setVista("panel");
  };

  if (!cargado) {
    return (
      <div style={S.loadingContainer}>
        <div style={S.spinner}></div>
        <div style={S.loadingText}>Iniciando VenciControl Pro…</div>
      </div>
    );
  }

  const totalCriticosYVencidos = lotes.filter((l) => {
    const st = estadoUrgencia(diasHasta(l.fechaVencimiento));
    return st === "critico" || st === "vencido";
  }).length;

  return (
    <div style={S.appWrapper}>
      <style>{`
        * { box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        body { margin: 0; background-color: #F8FAFC; }
        input, select, button { font-family: inherit; }
        input:focus, select:focus, button:focus-visible { outline: 2px solid #4F46E5; outline-offset: 1px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      <Header totalCriticos={totalCriticosYVencidos} onExportar={handleExportar} />

      <main style={S.mainContainer}>
        <KpiDashboard lotes={lotes} onVerFiltro={irAPanelConFiltro} />

        {!resumenOculto && lotes.length > 0 && (
          <ResumenSmartBanner
            lotes={lotes}
            onCerrar={() => setResumenOculto(true)}
            onVerFiltro={irAPanelConFiltro}
          />
        )}

        {vista === "ingresar" && (
          <PantallaIngreso 
            productos={productos} 
            lotes={lotes}
            onRegistrar={registrarLote} 
            onMostrarToast={mostrarToast}
          />
        )}

        {vista === "panel" && (
          <PantallaPanel 
            lotes={lotes} 
            onEliminar={eliminarLote} 
            filtroInicial={filtroInicial}
            onNuevoRegistro={() => setVista("ingresar")}
          />
        )}

        {vista === "traspaso" && (
          <GestionTraspaso 
            lotes={lotes} 
            productos={productos} 
            onGuardarLotes={(nuevosLotes) => guardar(productos, nuevosLotes)} 
          />
        )}
      </main>

      <NavInferior vista={vista} setVista={setVista} />

      {toast && (
        <div style={{
          ...S.toast,
          borderLeft: `4px solid ${toast.tipo === "error" ? "#EF4444" : "#10B981"}`
        }}>
          {toast.tipo === "error" ? <AlertTriangle size={18} color="#EF4444" /> : <CheckCircle2 size={18} color="#10B981" />}
          <span style={S.toastText}>{toast.mensaje}</span>
        </div>
      )}
    </div>
  );
}

function Header({ totalCriticos, onExportar }) {
  return (
    <header style={S.header}>
      <div style={S.headerBrand}>
        <div style={S.logoIcon}>
          <Store size={22} color="#FFFFFF" />
        </div>
        <div>
          <div style={S.brandName}>
            VenciControl <span style={S.proTag}>PRO</span>
          </div>
          <div style={S.brandSubtitle}>Control de Bodega y Producción</div>
        </div>
      </div>

      <div style={S.headerActions}>
        <button onClick={onExportar} style={S.btnExportHeader} title="Exportar reporte CSV">
          <FileSpreadsheet size={16} />
          <span style={S.btnExportText}>Exportar CSV</span>
        </button>

        {totalCriticos > 0 && (
          <div style={S.alertBadgeHeader} title="Productos vencidos o por vencer">
            <AlertTriangle size={15} color="#DC2626" />
            <span>{totalCriticos} Alertas</span>
          </div>
        )}
      </div>
    </header>
  );
}

function KpiDashboard({ lotes, onVerFiltro }) {
  const stats = useMemo(() => {
    let vencidos = 0;
    let criticos = 0;
    let proximos = 0;
    let ok = 0;

    lotes.forEach((l) => {
      const d = diasHasta(l.fechaVencimiento);
      if (d < 0) vencidos++;
      else if (d <= 3) criticos++;
      else if (d <= 7) proximos++;
      else ok++;
    });

    return { total: lotes.length, vencidos, criticos, proximos, ok };
  }, [lotes]);

  return (
    <div style={S.kpiGrid}>
      <div style={S.kpiCard} onClick={() => onVerFiltro("todos")}>
        <div style={S.kpiHeader}>
          <span style={S.kpiTitle}>Total Lotes</span>
          <Layers size={16} color="#64748B" />
        </div>
        <div style={S.kpiVal}>{stats.total}</div>
        <span style={S.kpiSub}>Bodega + Producción</span>
      </div>

      <div style={{ ...S.kpiCard, borderTop: "3px solid #EF4444" }} onClick={() => onVerFiltro("vencido")}>
        <div style={S.kpiHeader}>
          <span style={{ ...S.kpiTitle, color: "#991B1B" }}>Vencidos</span>
          <AlertTriangle size={16} color="#EF4444" />
        </div>
        <div style={{ ...S.kpiVal, color: "#EF4444" }}>{stats.vencidos}</div>
        <span style={S.kpiSub}>Descartar / Merma</span>
      </div>

      <div style={{ ...S.kpiCard, borderTop: "3px solid #F59E0B" }} onClick={() => onVerFiltro("critico")}>
        <div style={S.kpiHeader}>
          <span style={{ ...S.kpiTitle, color: "#92400E" }}>Críticos (0-3d)</span>
          <Bell size={16} color="#F59E0B" />
        </div>
        <div style={{ ...S.kpiVal, color: "#D97706" }}>{stats.criticos}</div>
        <span style={S.kpiSub}>Uso inmediato</span>
      </div>

      <div style={{ ...S.kpiCard, borderTop: "3px solid #3B82F6" }} onClick={() => onVerFiltro("proximo")}>
        <div style={S.kpiHeader}>
          <span style={{ ...S.kpiTitle, color: "#1E40AF" }}>Próximos (4-7d)</span>
          <BarChart3 size={16} color="#3B82F6" />
        </div>
        <div style={{ ...S.kpiVal, color: "#2563EB" }}>{stats.proximos}</div>
        <span style={S.kpiSub}>Monitoreo</span>
      </div>
    </div>
  );
}

function ResumenSmartBanner({ lotes, onCerrar, onVerFiltro }) {
  const metricas = useMemo(() => {
    let vencidos = 0;
    let criticos = 0;
    let proximos = 0;

    lotes.forEach((l) => {
      const d = diasHasta(l.fechaVencimiento);
      if (d < 0) vencidos++;
      else if (d <= 3) criticos++;
      else if (d <= 7) proximos++;
    });

    return { vencidos, criticos, proximos, totalAlerta: vencidos + criticos + proximos };
  }, [lotes]);

  if (metricas.totalAlerta === 0) {
    return (
      <div style={S.bannerOk}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle2 size={20} color="#059669" />
          <span style={S.bannerOkText}>
            <strong>Inventario Saludable:</strong> Sin productos en riesgo de vencimiento.
          </span>
        </div>
        <button onClick={onCerrar} style={S.closeBannerBtn}><X size={16} color="#64748B" /></button>
      </div>
    );
  }

  return (
    <div style={S.bannerAlert}>
      <div style={S.bannerAlertHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={18} color="#DC2626" />
          <span style={S.bannerAlertTitle}>Atención: Productos próximos a vencer</span>
        </div>
        <button onClick={onCerrar} style={S.closeBannerBtn}><X size={16} color="#64748B" /></button>
      </div>

      <p style={S.bannerAlertDesc}>
        Hay productos en riesgo tanto en Bodega como en Producción. Prioriza su uso antes de la fecha límite.
      </p>

      <div style={S.bannerActionsRow}>
        {metricas.vencidos > 0 && (
          <button onClick={() => onVerFiltro("vencido")} style={S.btnTagRed}>
            Ver {metricas.vencidos} Vencidos
          </button>
        )}
        {metricas.criticos > 0 && (
          <button onClick={() => onVerFiltro("critico")} style={S.btnTagAmber}>
            Ver {metricas.criticos} Críticos
          </button>
        )}
        {metricas.proximos > 0 && (
          <button onClick={() => onVerFiltro("proximo")} style={S.btnTagBlue}>
            Ver {metricas.proximos} Próximos
          </button>
        )}
      </div>
    </div>
  );
}

function PantallaIngreso({ productos, lotes, onRegistrar, onMostrarToast }) {
  const [paso, setPaso] = useState("codigo");
  const [barcode, setBarcode] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().slice(0, 10));
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [camaraLocal, setCamaraLocal] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (paso === "codigo" && inputRef.current) inputRef.current.focus();
  }, [paso]);

  const productoExistente = productos[barcode.trim()];

  // Búsqueda en tiempo real para autorrellenar si ya existe en catálogo
  const handleBarcodeChange = (val) => {
    const cleanCode = val.replace(/\s/g, "");
    setBarcode(cleanCode);
    
    if (productos[cleanCode]) {
      setNombre(productos[cleanCode].nombre);
      setCategoria(productos[cleanCode].categoria);
    }
  };

  const continuar = (codeOverride) => {
    const codeToUse = resolverCodigo(codeOverride !== undefined ? codeOverride : barcode, productos);
    if (!codeToUse) return;
    
    if (productos[codeToUse]) {
      setNombre(productos[codeToUse].nombre);
      setCategoria(productos[codeToUse].categoria);
      onMostrarToast(`¡Producto reconocido! "${productos[codeToUse].nombre}" cargado del historial.`, "ok");
    } else {
      setNombre("");
      setCategoria(CATEGORIAS[0]);
    }
    setBarcode(codeToUse);
    setPaso("datos");
  };

  const confirmar = () => {
    if (!nombre.trim() || !fechaVencimiento || !fechaIngreso) return;
    onRegistrar({
      barcode: barcode.trim(),
      nombre: nombre.trim(),
      categoria,
      fechaVencimiento,
      cantidad: Number(cantidad) || 1,
      fechaIngreso
    });
    setBarcode("");
    setNombre("");
    setFechaVencimiento("");
    setFechaIngreso(new Date().toISOString().slice(0, 10));
    setCantidad("1");
    setPaso("codigo");
  };

  const lotesPreviosMismoProducto = lotes.filter(l => l.barcode === barcode.trim());

  return (
    <div style={S.formCard}>
      <div style={S.cardHeader}>
        <div style={S.cardTitleRow}>
          <Plus size={20} color="#4F46E5" />
          <h2 style={S.cardTitle}>Ingreso de Productos a Bodega</h2>
        </div>
        <p style={S.cardSub}>Escanea o ingresa el código de barras para registrar o asociar lotes.</p>
      </div>

      {paso === "codigo" ? (
        <div style={S.stepContainer}>
          <div style={S.scanBox}>
            <div style={S.inputWithIcon}>
              <Scan size={20} color="#64748B" />
              <input
                ref={inputRef}
                value={barcode}
                onChange={(e) => handleBarcodeChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && continuar()}
                placeholder="Código de barra (ej: 780123456789)"
                inputMode="numeric"
                style={S.mainScanInput}
              />
              {barcode && (
                <button onClick={() => setBarcode("")} style={S.clearInputBtn}><X size={16} /></button>
              )}
            </div>

            <div style={S.scanButtonsRow}>
              <button type="button" onClick={() => setCamaraLocal(true)} style={S.btnCameraTrigger}>
                <Camera size={18} />
                <span>Escanear con Cámara</span>
              </button>

              <button type="button" onClick={() => continuar()} disabled={!barcode.trim()} style={S.btnPrimary}>
                Continuar <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {barcode.trim() && productos[barcode.trim()] && (
            <div style={S.knownCardNotice}>
              <Sparkles size={16} color="#4F46E5" />
              <span>Este código ya fue registrado anteriormente como: <strong>{productos[barcode.trim()].nombre}</strong></span>
            </div>
          )}

          {camaraLocal && (
            <CameraScannerModal
              onClose={() => setCamaraLocal(false)}
              onScan={(scannedCode) => {
                setCamaraLocal(false);
                const codigoResuelto = resolverCodigo(scannedCode, productos);
                handleBarcodeChange(codigoResuelto);
                continuar(codigoResuelto);
              }}
            />
          )}
        </div>
      ) : (
        <div style={S.stepContainer}>
          <button type="button" onClick={() => setPaso("codigo")} style={S.btnBackLink}>
            <ChevronLeft size={16} /> Modificar código
          </button>

          <div style={S.codeBadgeRow}>
            <span style={S.codeBadgeLabel}>Código:</span>
            <span style={S.codeBadgeVal}>{barcode}</span>
          </div>

          {productoExistente ? (
            <div style={S.knownCard}>
              <Sparkles size={20} color="#4F46E5" />
              <div>
                <div style={S.knownName}>{productoExistente.nombre}</div>
                <div style={S.knownCat}>Categoría: {productoExistente.categoria} (Reconocido automáticamente)</div>
              </div>
            </div>
          ) : (
            <>
              <Field label="Nombre comercial del producto">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Harina de Trigo 1kg"
                  style={S.formInput}
                  autoFocus
                />
              </Field>

              <Field label="Categoría">
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={S.formSelect}>
                  {CATEGORIAS.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </Field>
            </>
          )}

          {lotesPreviosMismoProducto.length > 0 && (
            <div style={S.historyHintBox}>
              <Layers size={14} color="#D97706" />
              <span>Nota: Ya existen {lotesPreviosMismoProducto.length} lote(s) previo(s) de este producto en bodega/producción. Este nuevo ingreso tendrá su propio diferenciador de llegada.</span>
            </div>
          )}

          <div style={S.formRow2Col}>
            <Field label="Fecha de Llegada / Ingreso">
              <div style={S.inputWithIcon}>
                <Calendar size={18} color="#64748B" />
                <input
                  type="date"
                  value={fechaIngreso}
                  onChange={(e) => setFechaIngreso(e.target.value)}
                  style={S.formInputNoBorder}
                />
              </div>
            </Field>

            <Field label="Fecha de Vencimiento">
              <div style={S.inputWithIcon}>
                <Calendar size={18} color="#64748B" />
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  style={S.formInputNoBorder}
                />
              </div>
            </Field>
          </div>

          <Field label="Cantidad / Unidades del Lote">
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              style={S.formInput}
            />
          </Field>

          <button type="button" onClick={confirmar} disabled={!nombre.trim() || !fechaVencimiento || !fechaIngreso} style={S.btnSaveLote}>
            <Check size={18} /> Registrar Nuevo Lote en Bodega
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={S.fieldGroup}>
      <span style={S.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function PantallaPanel({ lotes, onEliminar, filtroInicial = "todos", onNuevoRegistro }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroUrgencia, setFiltroUrgencia] = useState(filtroInicial);
  const [filtroUbicacion, setFiltroUbicacion] = useState("todas");

  useEffect(() => {
    if (filtroInicial) setFiltroUrgencia(filtroInicial);
  }, [filtroInicial]);

  const ordenados = useMemo(() => {
    return [...lotes]
      .filter((l) => {
        const q = busqueda.trim().toLowerCase();
        const matchQ = !q || l.nombre.toLowerCase().includes(q) || l.barcode.includes(q) || (l.categoria && l.categoria.toLowerCase().includes(q));
        const estado = estadoUrgencia(diasHasta(l.fechaVencimiento));
        const matchUrgencia = filtroUrgencia === "todos" || estado === filtroUrgencia;
        
        const ub = l.ubicacion || "bodega";
        const matchUbicacion = filtroUbicacion === "todas" || ub === filtroUbicacion;

        return matchQ && matchUrgencia && matchUbicacion;
      })
      .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
  }, [lotes, busqueda, filtroUrgencia, filtroUbicacion]);

  const conteos = useMemo(() => {
    const c = { critico: 0, proximo: 0, normal: 0, vencido: 0 };
    lotes.forEach((l) => { c[estadoUrgencia(diasHasta(l.fechaVencimiento))]++; });
    return c;
  }, [lotes]);

  return (
    <div style={S.panelWrapper}>
      <div style={S.filtersBar}>
        {[
          { key: "todos", label: `Todos (${lotes.length})` },
          { key: "vencido", label: `Vencidos (${conteos.vencido})` },
          { key: "critico", label: `Críticos (${conteos.critico})` },
          { key: "proximo", label: `Próximos (${conteos.proximo})` },
          { key: "normal", label: `Sin Riesgo (${conteos.normal})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltroUrgencia(f.key)}
            style={{
              ...S.filterChip,
              ...(filtroUrgencia === f.key ? S.filterChipActive : {})
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={S.locationTabs}>
        <button 
          onClick={() => setFiltroUbicacion("todas")}
          style={filtroUbicacion === "todas" ? S.locTabActive : S.locTab}
        >
          📍 Todas las Ubicaciones
        </button>
        <button 
          onClick={() => setFiltroUbicacion("bodega")}
          style={filtroUbicacion === "bodega" ? S.locTabActive : S.locTab}
        >
          📦 Solo Bodega
        </button>
        <button 
          onClick={() => setFiltroUbicacion("produccion")}
          style={filtroUbicacion === "produccion" ? S.locTabActive : S.locTab}
        >
          🏭 Solo Producción
        </button>
      </div>

      <div style={S.searchAndActionsRow}>
        <div style={S.searchBox}>
          <Search size={18} color="#64748B" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, código o categoría..."
            style={S.searchInput}
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} style={S.clearSearchBtn}><X size={16} /></button>
          )}
        </div>

        <button onClick={onNuevoRegistro} style={S.btnQuickAdd}>
          <Plus size={18} />
          <span>Ingresar a Bodega</span>
        </button>
      </div>

      {ordenados.length === 0 ? (
        <div style={S.emptyState}>
          <Package size={40} color="#94A3B8" />
          <h3 style={S.emptyStateTitle}>Sin registros coincidentes</h3>
          <p style={S.emptyStateText}>
            No se encontraron productos con la combinación de filtros seleccionada.
          </p>
        </div>
      ) : (
        <div style={S.tableContainer}>
          <div style={S.tableHeader}>
            <span>Producto, Ubicación y Lote</span>
            <span>Vencimiento & Estado</span>
          </div>
          <div style={S.tableBody}>
            {ordenados.map((l) => {
              const dias = diasHasta(l.fechaVencimiento);
              const estado = estadoUrgencia(dias);
              const st = URGENCIA_STYLES[estado];
              const esProduccion = l.ubicacion === "produccion";

              return (
                <div key={l.id} style={{ ...S.tableRow, backgroundColor: st.bg, borderColor: st.border }}>
                  <div style={S.rowMain}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={S.rowTitle}>{l.nombre}</span>
                      
                      <span style={esProduccion ? S.badgeUbicacionProduccion : S.badgeUbicacionBodega}>
                        {esProduccion ? <><Factory size={12} /> Producción</> : <><Package size={12} /> Bodega</>}
                      </span>

                      <span style={S.badgeLlegada} title="Fecha de llegada de este lote específico">
                        📥 Llegada: {l.fechaIngreso || 'No registrada'}
                      </span>
                    </div>

                    <div style={S.rowSub}>
                      <span style={S.catBadge}>{l.categoria || 'Sin categoría'}</span>
                      <span>· Cantidad: <strong>{l.cantidad} un.</strong> · </span>
                      <span style={S.codeMonospace}>{l.barcode}</span>
                    </div>
                  </div>

                  <div style={S.rowRight}>
                    <span style={{ ...S.statusBadge, backgroundColor: st.badgeBg, color: st.text }}>
                      <span style={{ ...S.dot, backgroundColor: st.dotColor }}></span>
                      {st.label}
                    </span>

                    <span style={S.daysText}>
                      {dias < 0 ? `Vencido hace ${Math.abs(dias)}d` : dias === 0 ? "¡Vence HOY!" : `Vence en ${dias}d`}
                    </span>

                    <button onClick={() => onEliminar(l.id)} style={S.btnDeleteRow} title="Descartar lote">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NavInferior({ vista, setVista }) {
  return (
    <nav style={S.bottomNav}>
      <button onClick={() => setVista("ingresar")} style={{ ...S.navTab, ...(vista === "ingresar" ? S.navTabActive : {}) }}>
        <Scan size={20} />
        <span>Ingresar a Bodega</span>
      </button>
      <button onClick={() => setVista("panel")} style={{ ...S.navTab, ...(vista === "panel" ? S.navTabActive : {}) }}>
        <ListFilter size={20} />
        <span>Panel e Inventario</span>
      </button>
      <button onClick={() => setVista("traspaso")} style={{ ...S.navTab, ...(vista === "traspaso" ? S.navTabActive : {}) }}>
        <RefreshCw size={20} />
        <span>Traspaso a Producción</span>
      </button>
    </nav>
  );
}

const S = {
  appWrapper: { minHeight: "100vh", backgroundColor: "#F8FAFC", color: "#0F172A", display: "flex", flexDirection: "column" },
  loadingContainer: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: "#F8FAFC" },
  spinner: { width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #4F46E5", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loadingText: { fontSize: 15, fontWeight: 500, color: "#475569" },
  header: { backgroundColor: "#0F172A", color: "#FFFFFF", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)" },
  headerBrand: { display: "flex", alignItems: "center", gap: 12 },
  logoIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" },
  brandName: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1.2 },
  proTag: { backgroundColor: "#6366F1", fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 800, marginLeft: 4 },
  brandSubtitle: { fontSize: 12, color: "#94A3B8" },
  headerActions: { display: "flex", alignItems: "center", gap: 10 },
  btnExportHeader: { display: "flex", alignItems: "center", gap: 6, backgroundColor: "#1E293B", color: "#F8FAFC", border: "1px solid #334155", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  btnExportText: { display: "inline" },
  alertBadgeHeader: { display: "flex", alignItems: "center", gap: 6, backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", padding: "7px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700 },
  mainContainer: { flex: 1, maxWidth: 1100, width: "100%", margin: "0 auto", padding: "24px 16px 100px" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 },
  kpiCard: { backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: 16, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  kpiHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  kpiTitle: { fontSize: 13, fontWeight: 600, color: "#64748B" },
  kpiVal: { fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 },
  kpiSub: { fontSize: 11, color: "#94A3B8", marginTop: 4, display: "block" },
  bannerOk: { backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 12, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" },
  bannerOkText: { fontSize: 14, color: "#065F46" },
  bannerAlert: { backgroundColor: "#FFFFFF", border: "1px solid #FECDD3", borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: "0 2px 8px rgba(239, 68, 68, 0.08)" },
  bannerAlertHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  bannerAlertTitle: { fontSize: 15, fontWeight: 700, color: "#991B1B" },
  bannerAlertDesc: { fontSize: 13, color: "#475569", margin: "0 0 12px 0" },
  bannerActionsRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  btnTagRed: { backgroundColor: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  btnTagAmber: { backgroundColor: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  btnTagBlue: { backgroundColor: "#DBEAFE", color: "#1E40AF", border: "1px solid #BFDBFE", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  closeBannerBtn: { background: "none", border: "none", cursor: "pointer", padding: 2 },
  formCard: { backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.03)" },
  cardHeader: { marginBottom: 20 },
  cardTitleRow: { display: "flex", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 19, fontWeight: 700, margin: 0, color: "#0F172A" },
  cardSub: { fontSize: 13, color: "#64748B", marginTop: 4 },
  stepContainer: { display: "flex", flexDirection: "column", gap: 16 },
  scanBox: { display: "flex", flexDirection: "column", gap: 12 },
  inputWithIcon: { display: "flex", alignItems: "center", gap: 10, border: "1.5px solid #CBD5E1", borderRadius: 10, padding: "12px 14px", backgroundColor: "#F8FAFC" },
  mainScanInput: { border: "none", background: "transparent", fontSize: 16, flex: 1, color: "#0F172A", fontFamily: "monospace", fontWeight: 600 },
  clearInputBtn: { border: "none", background: "none", color: "#94A3B8", cursor: "pointer" },
  scanButtonsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  btnCameraTrigger: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EEF2FF", color: "#4F46E5", border: "1px solid #C7D2FE", padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnPrimary: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#4F46E5", color: "#FFFFFF", border: "none", padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnBackLink: { display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#64748B", fontSize: 13, cursor: "pointer", padding: 0 },
  codeBadgeRow: { display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F1F5F9", padding: "8px 12px", borderRadius: 8, width: "fit-content" },
  codeBadgeLabel: { fontSize: 12, color: "#64748B", fontWeight: 600 },
  codeBadgeVal: { fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#0F172A" },
  knownCard: { display: "flex", alignItems: "center", gap: 12, backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, padding: 14 },
  knownCardNotice: { display: "flex", alignItems: "center", gap: 8, backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", padding: "10px 14px", borderRadius: 8, fontSize: 13, color: "#166534" },
  knownName: { fontSize: 15, fontWeight: 700, color: "#1E1B4B" },
  knownCat: { fontSize: 12, color: "#4338CA" },
  historyHintBox: { display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", padding: "10px 14px", borderRadius: 8, fontSize: 12, color: "#92400E" },
  formInput: { border: "1.5px solid #CBD5E1", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#0F172A", backgroundColor: "#F8FAFC", width: "100%" },
  formInputNoBorder: { border: "none", background: "transparent", fontSize: 14, color: "#0F172A", width: "100%" },
  formSelect: { border: "1.5px solid #CBD5E1", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#0F172A", backgroundColor: "#F8FAFC", width: "100%" },
  formRow2Col: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: "#475569" },
  btnSaveLote: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#059669", color: "#FFFFFF", border: "none", borderRadius: 10, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  panelWrapper: { display: "flex", flexDirection: "column", gap: 16 },
  filtersBar: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 },
  filterChip: { flexShrink: 0, border: "1px solid #E2E8F0", backgroundColor: "#FFFFFF", color: "#64748B", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 20, cursor: "pointer" },
  filterChipActive: { backgroundColor: "#0F172A", color: "#FFFFFF", borderColor: "#0F172A" },
  locationTabs: { display: "flex", gap: 8, backgroundColor: "#E2E8F0", padding: 4, borderRadius: 10, width: "fit-content" },
  locTab: { border: "none", background: "none", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" },
  locTabActive: { border: "none", backgroundColor: "#FFFFFF", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#4F46E5", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  searchAndActionsRow: { display: "flex", gap: 12 },
  searchBox: { flex: 1, display: "flex", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 10, padding: "10px 14px" },
  searchInput: { border: "none", background: "transparent", fontSize: 14, flex: 1, color: "#0F172A" },
  clearSearchBtn: { border: "none", background: "none", color: "#94A3B8", cursor: "pointer" },
  btnQuickAdd: { display: "flex", alignItems: "center", gap: 6, backgroundColor: "#4F46E5", color: "#FFFFFF", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  emptyState: { textAlign: "center", backgroundColor: "#FFFFFF", border: "1px dashed #CBD5E1", borderRadius: 16, padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center" },
  emptyStateTitle: { fontSize: 17, fontWeight: 700, color: "#334155", margin: "12px 0 4px 0" },
  emptyStateText: { fontSize: 13, color: "#64748B", maxWidth: 320 },
  tableContainer: { backgroundColor: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" },
  tableHeader: { display: "flex", justifyContent: "space-between", backgroundColor: "#F8FAFC", padding: "12px 18px", fontSize: 12, fontWeight: 700, color: "#64748B", borderBottom: "1px solid #E2E8F0", textTransform: "uppercase", letterSpacing: "0.5px" },
  tableBody: { display: "flex", flexDirection: "column" },
  tableRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #E2E8F0", gap: 12 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: 700, color: "#0F172A" },
  badgeUbicacionBodega: { display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: "#DBEAFE", color: "#1E40AF", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 },
  badgeUbicacionProduccion: { display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: "#F3E8FF", color: "#6B21A8", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 },
  badgeLlegada: { display: "inline-flex", alignItems: "center", gap: 4, backgroundColor: "#FEF3C7", color: "#92400E", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 },
  rowSub: { fontSize: 12, color: "#64748B", marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  catBadge: { backgroundColor: "rgba(255,255,255,0.7)", padding: "2px 6px", borderRadius: 4, fontWeight: 600, border: "1px solid rgba(0,0,0,0.06)" },
  codeMonospace: { fontFamily: "monospace", fontWeight: 600 },
  rowRight: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 },
  statusBadge: { display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 },
  dot: { width: 6, height: 6, borderRadius: "50%" },
  daysText: { fontSize: 13, fontWeight: 600, color: "#334155" },
  btnDeleteRow: { backgroundColor: "rgba(0,0,0,0.05)", border: "none", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" },
  bottomNav: { position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "#FFFFFF", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "center", padding: "8px 16px calc(env(safe-area-inset-bottom, 0px) + 8px)", boxShadow: "0 -4px 12px rgba(0,0,0,0.03)", zIndex: 90 },
  navTab: { flex: 1, maxWidth: 200, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", color: "#64748B", fontSize: 12, fontWeight: 600, padding: "8px", cursor: "pointer", borderRadius: 8 },
  navTabActive: { color: "#4F46E5", backgroundColor: "#EEF2FF" },
  toast: { position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", backgroundColor: "#0F172A", color: "#FFFFFF", padding: "12px 18px", borderRadius: 10, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)", zIndex: 1000, maxWidth: "90%" },
  toastText: { fontSize: 14, fontWeight: 500 }
};