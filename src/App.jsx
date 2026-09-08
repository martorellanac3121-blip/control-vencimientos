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
  Download, 
  Bell, 
  Clock, 
  FileSpreadsheet,
  ChevronRight
} from "lucide-react";

const STORAGE_KEY = "inventario-vencimientos";

const CATEGORIAS = [
  "Abarrotes", "Lácteos", "Panadería", "Bebidas", "Congelados",
  "Frutas y verduras", "Cecinas y fiambres", "Limpieza", "Otro",
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
  vencido: { bg: "#F4E3E0", border: "#B23B3B", text: "#7A2A22", label: "Vencido" },
  critico: { bg: "#FBEAE7", border: "#B23B3B", text: "#8C3327", label: "Crítico (0-3d)" },
  proximo: { bg: "#FBF1DE", border: "#C98A2D", text: "#8A5C16", label: "Próximo (4-7d)" },
  normal: { bg: "#EAF2EC", border: "#3F7A5D", text: "#2C5A43", label: "Sin urgencia" },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Función para exportar a CSV compatible con Excel en español
function exportarCSV(lotes) {
  if (!lotes || lotes.length === 0) return false;

  const headers = [
    "Código de Barra",
    "Producto",
    "Categoría",
    "Cantidad",
    "Fecha Ingreso",
    "Fecha Vencimiento",
    "Días Restantes",
    "Estado"
  ];

  const filas = lotes.map((l) => {
    const dias = diasHasta(l.fechaVencimiento);
    const estadoKey = estadoUrgencia(dias);
    const estadoEtiqueta = URGENCIA_STYLES[estadoKey]?.label || estadoKey;
    const nombreLimpio = l.nombre ? l.nombre.replace(/"/g, '""') : "";
    
    return [
      `"${l.barcode}"`,
      `"${nombreLimpio}"`,
      `"${l.categoria || ''}"`,
      l.cantidad || 1,
      l.fechaIngreso || "-",
      l.fechaVencimiento || "-",
      dias,
      `"${estadoEtiqueta}"`
    ].join(";"); // Delimitador punto y coma para Excel en español
  });

  // BOM para soporte de tildes y caracteres especiales en Excel (UTF-8)
  const csvContent = "\uFEFF" + [headers.join(";"), ...filas].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const fechaHoy = new Date().toISOString().slice(0, 10);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `inventario_vencimientos_${fechaHoy}.csv`);
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
        console.error("Error al cargar datos:", e);
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
      mostrarToast("No se pudo guardar. Intenta de nuevo.", "error");
    }
  };

  const mostrarToast = (mensaje, tipo = "ok") => {
    setToast({ mensaje, tipo });
    setTimeout(() => setToast(null), 2800);
  };

  const registrarLote = ({ barcode, nombre, categoria, fechaVencimiento, cantidad }) => {
    const nuevosProductos = { ...productos, [barcode]: { nombre, categoria } };
    const nuevoLote = {
      id: uid(),
      barcode,
      nombre,
      categoria,
      fechaIngreso: new Date().toISOString().slice(0, 10),
      fechaVencimiento,
      cantidad,
    };
    guardar(nuevosProductos, [nuevoLote, ...lotes]);
    mostrarToast(`${nombre} guardado — vence ${fechaVencimiento}`);
  };

  const eliminarLote = (id) => {
    guardar(productos, lotes.filter((l) => l.id !== id));
    mostrarToast("Lote retirado del registro");
  };

  const handleExportar = () => {
    if (lotes.length === 0) {
      mostrarToast("No hay datos cargados para exportar", "error");
      return;
    }
    const exito = exportarCSV(lotes);
    if (exito) {
      mostrarToast("Archivo CSV descargado con éxito");
    }
  };

  const irAPanelConFiltro = (filtro) => {
    setFiltroInicial(filtro);
    setVista("panel");
  };

  if (!cargado) {
    return (
      <div style={{ ...S.app, alignItems: "center", justifyContent: "center", display: "flex" }}>
        <div style={{ color: S.colors.muted, fontFamily: S.font }}>Cargando inventario…</div>
      </div>
    );
  }

  const totalCriticosYVencidos = lotes.filter((l) => {
    const st = estadoUrgencia(diasHasta(l.fechaVencimiento));
    return st === "critico" || st === "vencido";
  }).length;

  return (
    <div style={S.app}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, button { font-family: ${S.font}; }
        input:focus, select:focus, button:focus-visible {
          outline: 2px solid ${S.colors.ink}; outline-offset: 1px;
        }
        ::placeholder { color: #9AA3AB; }
      `}</style>

      <Header totalCriticos={totalCriticosYVencidos} onExportar={handleExportar} />

      <main style={S.main}>
        {!resumenOculto && lotes.length > 0 && (
          <ResumenDiarioBanner
            lotes={lotes}
            onCerrar={() => setResumenOculto(true)}
            onVerFiltro={irAPanelConFiltro}
          />
        )}

        {vista === "ingresar" ? (
          <PantallaIngreso productos={productos} onRegistrar={registrarLote} />
        ) : (
          <PantallaPanel 
            lotes={lotes} 
            onEliminar={eliminarLote} 
            onExportar={handleExportar}
            filtroInicial={filtroInicial}
          />
        )}
      </main>

      <NavInferior vista={vista} setVista={setVista} />

      {toast && (
        <div style={{ ...S.toast, borderColor: toast.tipo === "error" ? S.colors.danger : S.colors.ink }}>
          {toast.tipo !== "error" && <Check size={16} color={S.colors.ink} />}
          <span>{toast.mensaje}</span>
        </div>
      )}
    </div>
  );
}

function Header({ totalCriticos, onExportar }) {
  return (
    <header style={S.header}>
      <div>
        <div style={S.headerEyebrow}>Bodega · Minimarket</div>
        <h1 style={S.headerTitle}>Control de vencimientos</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button 
          onClick={onExportar} 
          style={S.headerExportBtn} 
          title="Exportar registro a Excel / CSV"
        >
          <FileSpreadsheet size={16} />
          <span style={S.headerExportText}>CSV</span>
        </button>
        {totalCriticos > 0 && (
          <div style={S.headerBadge}>
            <AlertTriangle size={14} color="#8C3327" />
            <span>{totalCriticos}</span>
          </div>
        )}
      </div>
    </header>
  );
}

function ResumenDiarioBanner({ lotes, onCerrar, onVerFiltro }) {
  const metricas = useMemo(() => {
    let vencidos = 0;
    let criticos = 0; // 0 a 3 dias
    let proximos = 0; // 4 a 7 dias

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
      <div style={S.resumenOkCard}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Check size={18} color="#2C5A43" />
          <span style={S.resumenOkText}>
            <strong>Todo al día:</strong> No hay productos vencidos ni por vencer en los próximos 7 días.
          </span>
        </div>
        <button onClick={onCerrar} style={S.resumenCloseBtn} aria-label="Cerrar notificación">
          <X size={14} color={S.colors.muted} />
        </button>
      </div>
    );
  }

  return (
    <div style={S.resumenCard}>
      <div style={S.resumenHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Bell size={16} color="#8C3327" />
          <span style={S.resumenTitle}>Resumen del Día</span>
        </div>
        <button onClick={onCerrar} style={S.resumenCloseBtn} aria-label="Cerrar notificación">
          <X size={14} color={S.colors.muted} />
        </button>
      </div>

      <div style={S.resumenStatsGrid}>
        {metricas.vencidos > 0 && (
          <div 
            onClick={() => onVerFiltro("vencido")} 
            style={{ ...S.statBox, background: "#F4E3E0", borderColor: "#B23B3B" }}
          >
            <span style={{ ...S.statNum, color: "#7A2A22" }}>{metricas.vencidos}</span>
            <span style={{ ...S.statLabel, color: "#7A2A22" }}>Vencidos</span>
          </div>
        )}

        {metricas.criticos > 0 && (
          <div 
            onClick={() => onVerFiltro("critico")} 
            style={{ ...S.statBox, background: "#FBEAE7", borderColor: "#C98A2D" }}
          >
            <span style={{ ...S.statNum, color: "#8C3327" }}>{metricas.criticos}</span>
            <span style={{ ...S.statLabel, color: "#8C3327" }}>Criticos (&le;3d)</span>
          </div>
        )}

        {metricas.proximos > 0 && (
          <div 
            onClick={() => onVerFiltro("proximo")} 
            style={{ ...S.statBox, background: "#FBF1DE", borderColor: "#C98A2D" }}
          >
            <span style={{ ...S.statNum, color: "#8A5C16" }}>{metricas.proximos}</span>
            <span style={{ ...S.statLabel, color: "#8A5C16" }}>Próximos (4-7d)</span>
          </div>
        )}
      </div>

      <div style={S.resumenFooter}>
        <button 
          onClick={() => onVerFiltro(metricas.vencidos > 0 ? "vencido" : "critico")} 
          style={S.resumenActionBtn}
        >
          <span>Revisar productos en el Panel</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function NavInferior({ vista, setVista }) {
  return (
    <nav style={S.nav}>
      <button
        onClick={() => setVista("ingresar")}
        style={{ ...S.navBtn, ...(vista === "ingresar" ? S.navBtnActive : {}) }}
      >
        <Scan size={20} />
        <span>Ingresar</span>
      </button>
      <button
        onClick={() => setVista("panel")}
        style={{ ...S.navBtn, ...(vista === "panel" ? S.navBtnActive : {}) }}
      >
        <ListFilter size={20} />
        <span>Panel</span>
      </button>
    </nav>
  );
}

function PantallaIngreso({ productos, onRegistrar }) {
  const [paso, setPaso] = useState("codigo");
  const [barcode, setBarcode] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [fecha, setFecha] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const inputRef = useRef(null);

  useEffect(() => {
    if (paso === "codigo" && inputRef.current) inputRef.current.focus();
  }, [paso]);

  const productoExistente = productos[barcode];

  const continuar = () => {
    if (!barcode.trim()) return;
    if (productoExistente) {
      setNombre(productoExistente.nombre);
      setCategoria(productoExistente.categoria);
    } else {
      setNombre("");
      setCategoria(CATEGORIAS[0]);
    }
    setPaso("datos");
  };

  const confirmar = () => {
    if (!nombre.trim() || !fecha) return;
    onRegistrar({
      barcode: barcode.trim(),
      nombre: nombre.trim(),
      categoria,
      fechaVencimiento: fecha,
      cantidad: Number(cantidad) || 1,
    });
    setBarcode("");
    setNombre("");
    setFecha("");
    setCantidad("1");
    setPaso("codigo");
  };

  if (paso === "codigo") {
    return (
      <div style={S.card}>
        <p style={S.cardHint}>Escanea o escribe el código de barra del producto que está entrando a bodega.</p>
        <div style={S.scanRow}>
          <Scan size={20} color={S.colors.muted} />
          <input
            ref={inputRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.replace(/\s/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && continuar()}
            placeholder="Código de barra"
            inputMode="numeric"
            style={S.scanInput}
          />
        </div>
        <button type="button" onClick={continuar} style={S.primaryBtn} disabled={!barcode.trim()}>
          Continuar
        </button>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <button type="button" onClick={() => setPaso("codigo")} style={S.backLink}>
        <ChevronLeft size={16} /> Cambiar código
      </button>

      <div style={S.barcodePill}>{barcode}</div>

      {productoExistente ? (
        <div style={S.knownProduct}>
          <Package size={16} color={S.colors.ink} />
          <div>
            <div style={S.knownProductName}>{productoExistente.nombre}</div>
            <div style={S.knownProductCat}>{productoExistente.categoria}</div>
          </div>
        </div>
      ) : (
        <>
          <Field label="Nombre del producto">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Yogurt natural 1L"
              style={S.input}
              autoFocus
            />
          </Field>
          <Field label="Categoría">
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={S.input}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
        </>
      )}

      <Field label="Fecha de vencimiento">
        <div style={S.scanRow}>
          <Calendar size={18} color={S.colors.muted} />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={S.scanInput}
          />
        </div>
      </Field>

      <Field label="Cantidad">
        <input
          type="number"
          min="1"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          style={S.input}
        />
      </Field>

      <button type="button" onClick={confirmar} style={S.primaryBtn} disabled={!nombre.trim() || !fecha}>
        Guardar lote
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function PantallaPanel({ lotes, onEliminar, onExportar, filtroInicial = "todos" }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState(filtroInicial);

  useEffect(() => {
    if (filtroInicial) {
      setFiltro(filtroInicial);
    }
  }, [filtroInicial]);

  const ordenados = useMemo(() => {
    return [...lotes]
      .filter((l) => {
        const q = busqueda.trim().toLowerCase();
        const matchQ = !q || l.nombre.toLowerCase().includes(q) || l.barcode.includes(q);
        const estado = estadoUrgencia(diasHasta(l.fechaVencimiento));
        const matchF = filtro === "todos" || estado === filtro;
        return matchQ && matchF;
      })
      .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
  }, [lotes, busqueda, filtro]);

  const conteos = useMemo(() => {
    const c = { critico: 0, proximo: 0, normal: 0, vencido: 0 };
    lotes.forEach((l) => { c[estadoUrgencia(diasHasta(l.fechaVencimiento))]++; });
    return c;
  }, [lotes]);

  return (
    <div>
      <div style={S.panelHeaderRow}>
        <div style={S.filterRow}>
          {[
            { key: "todos", label: `Todos (${lotes.length})` },
            { key: "vencido", label: `Vencidos (${conteos.vencido})` },
            { key: "critico", label: `Críticos (${conteos.critico})` },
            { key: "proximo", label: `Próximos (${conteos.proximo})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{ ...S.filterChip, ...(filtro === f.key ? S.filterChipActive : {}) }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={S.searchRow}>
          <Search size={16} color={S.colors.muted} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto o código"
            style={S.searchInput}
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} style={S.clearBtn}>
              <X size={14} />
            </button>
          )}
        </div>

        <button onClick={onExportar} style={S.exportFullBtn} title="Exportar reporte CSV">
          <Download size={16} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>CSV</span>
        </button>
      </div>

      {ordenados.length === 0 ? (
        <div style={S.empty}>
          <Package size={28} color={S.colors.muted} />
          <p style={S.emptyText}>
            {lotes.length === 0
              ? "Aún no hay productos registrados. Ve a Ingresar para agregar el primero."
              : "Ningún lote coincide con este filtro o búsqueda."}
          </p>
        </div>
      ) : (
        <ul style={S.list}>
          {ordenados.map((l) => {
            const dias = diasHasta(l.fechaVencimiento);
            const estado = estadoUrgencia(dias);
            const st = URGENCIA_STYLES[estado];
            return (
              <li key={l.id} style={{ ...S.item, background: st.bg, borderColor: st.border }}>
                <div style={S.itemMain}>
                  <div style={S.itemName}>{l.nombre}</div>
                  <div style={S.itemMeta}>
                    {l.categoria} · {l.cantidad} un. · <span style={S.itemCode}>{l.barcode}</span>
                  </div>
                </div>
                <div style={S.itemRight}>
                  <span style={{ ...S.itemTag, color: st.text }}>{st.label}</span>
                  <span style={S.itemDays}>
                    {dias < 0 ? `Vencido hace ${Math.abs(dias)} d` : dias === 0 ? "Vence hoy" : `${dias} d`}
                  </span>
                  <button onClick={() => onEliminar(l.id)} style={S.removeBtn} title="Retirar de bodega">
                    <X size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const S = (() => {
  const colors = {
    bg: "#F5F6F3",
    surface: "#FFFFFF",
    ink: "#1B2B3A",
    inkSoft: "#2E3F4E",
    muted: "#6B7480",
    line: "#E3E4DE",
    danger: "#B23B3B",
    amber: "#C98A2D",
    green: "#3F7A5D",
  };
  const font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const mono = "'IBM Plex Mono', 'SF Mono', monospace";

  return {
    colors,
    font,
    app: {
      minHeight: "100vh",
      maxWidth: 430,
      margin: "0 auto",
      background: colors.bg,
      fontFamily: font,
      color: colors.ink,
      display: "flex",
      flexDirection: "column",
    },
    header: {
      padding: "20px 20px 16px",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      borderBottom: `1px solid ${colors.line}`,
    },
    headerEyebrow: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 4,
      letterSpacing: 0.2,
    },
    headerTitle: {
      fontSize: 21,
      fontWeight: 650,
      margin: 0,
      letterSpacing: -0.3,
      color: colors.ink,
    },
    headerExportBtn: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      background: "#EEF0EA",
      border: `1px solid ${colors.line}`,
      color: colors.ink,
      padding: "5px 10px",
      borderRadius: 20,
      cursor: "pointer",
      fontSize: 12,
      fontWeight: 600,
    },
    headerExportText: {
      fontSize: 11,
      fontWeight: 700,
    },
    headerBadge: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      background: "#FBEAE7",
      border: "1px solid #B23B3B",
      color: "#8C3327",
      fontSize: 13,
      fontWeight: 600,
      padding: "5px 10px",
      borderRadius: 20,
    },
    resumenCard: {
      background: "#FFFFFF",
      border: "1px solid #E3E4DE",
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    },
    resumenHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    resumenTitle: {
      fontSize: 13.5,
      fontWeight: 700,
      color: colors.ink,
    },
    resumenCloseBtn: {
      border: "none",
      background: "none",
      cursor: "pointer",
      padding: 2,
      display: "flex",
    },
    resumenStatsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
      gap: 8,
      marginBottom: 10,
    },
    statBox: {
      border: "1px solid",
      borderRadius: 8,
      padding: "8px 10px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      cursor: "pointer",
    },
    statNum: {
      fontSize: 18,
      fontWeight: 700,
      lineHeight: 1.1,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: 600,
      marginTop: 2,
    },
    resumenFooter: {
      display: "flex",
      justifyContent: "flex-end",
    },
    resumenActionBtn: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      background: "none",
      border: "none",
      color: colors.inkSoft,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      padding: 0,
    },
    resumenOkCard: {
      background: "#EAF2EC",
      border: "1px solid #3F7A5D",
      borderRadius: 12,
      padding: "10px 14px",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    resumenOkText: {
      fontSize: 12.5,
      color: "#2C5A43",
    },
    main: {
      flex: 1,
      padding: "18px 16px 90px",
    },
    card: {
      background: colors.surface,
      border: `1px solid ${colors.line}`,
      borderRadius: 14,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 14,
    },
    cardHint: {
      fontSize: 14,
      color: colors.muted,
      margin: 0,
      lineHeight: 1.5,
    },
    scanRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      border: `1.5px solid ${colors.line}`,
      borderRadius: 10,
      padding: "12px 14px",
      background: "#FBFBFA",
    },
    scanInput: {
      border: "none",
      background: "transparent",
      fontSize: 17,
      flex: 1,
      color: colors.ink,
      fontFamily: mono,
      letterSpacing: 0.5,
    },
    input: {
      border: `1.5px solid ${colors.line}`,
      borderRadius: 10,
      padding: "12px 14px",
      fontSize: 15,
      color: colors.ink,
      background: "#FBFBFA",
      width: "100%",
    },
    field: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    fieldLabel: {
      fontSize: 12.5,
      color: colors.muted,
      fontWeight: 500,
    },
    primaryBtn: {
      background: colors.ink,
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "13px 16px",
      fontSize: 15,
      fontWeight: 600,
      cursor: "pointer",
      marginTop: 4,
    },
    backLink: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      background: "none",
      border: "none",
      color: colors.muted,
      fontSize: 13,
      padding: 0,
      cursor: "pointer",
      alignSelf: "flex-start",
    },
    barcodePill: {
      fontFamily: mono,
      fontSize: 13,
      color: colors.inkSoft,
      background: "#EEF0EA",
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 6,
      alignSelf: "flex-start",
      letterSpacing: 0.5,
    },
    knownProduct: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "#EAF2EC",
      border: "1px solid #3F7A5D",
      borderRadius: 10,
      padding: "10px 14px",
    },
    knownProductName: { fontSize: 14.5, fontWeight: 600, color: colors.ink },
    knownProductCat: { fontSize: 12.5, color: colors.muted },
    panelHeaderRow: {
      marginBottom: 10,
    },
    filterRow: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      paddingBottom: 4,
    },
    filterChip: {
      flexShrink: 0,
      border: `1px solid ${colors.line}`,
      background: colors.surface,
      color: colors.muted,
      fontSize: 12.5,
      fontWeight: 500,
      padding: "7px 12px",
      borderRadius: 20,
      cursor: "pointer",
    },
    filterChipActive: {
      background: colors.ink,
      color: "#fff",
      borderColor: colors.ink,
    },
    searchRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: colors.surface,
      border: `1px solid ${colors.line}`,
      borderRadius: 10,
      padding: "10px 12px",
      flex: 1,
    },
    searchInput: {
      border: "none",
      background: "transparent",
      fontSize: 14,
      flex: 1,
      color: colors.ink,
    },
    exportFullBtn: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: colors.ink,
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "0 14px",
      cursor: "pointer",
    },
    clearBtn: {
      border: "none",
      background: "none",
      color: colors.muted,
      cursor: "pointer",
      display: "flex",
    },
    list: {
      listStyle: "none",
      margin: 0,
      padding: 0,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    },
    item: {
      border: "1px solid",
      borderRadius: 12,
      padding: "12px 14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    itemMain: { minWidth: 0, flex: 1 },
    itemName: {
      fontSize: 14.5,
      fontWeight: 600,
      color: colors.ink,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    itemMeta: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    itemCode: { fontFamily: mono },
    itemRight: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 2,
      flexShrink: 0,
    },
    itemTag: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: "none",
    },
    itemDays: {
      fontSize: 12,
      color: colors.inkSoft,
      fontWeight: 500,
    },
    removeBtn: {
      border: "none",
      background: "rgba(0,0,0,0.06)",
      borderRadius: 20,
      width: 22,
      height: 22,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: colors.muted,
      marginTop: 3,
    },
    empty: {
      textAlign: "center",
      padding: "50px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
    },
    emptyText: {
      fontSize: 13.5,
      color: colors.muted,
      lineHeight: 1.5,
      maxWidth: 260,
    },
    nav: {
      position: "sticky",
      bottom: 0,
      background: colors.surface,
      borderTop: `1px solid ${colors.line}`,
      display: "flex",
      padding: "8px 16px calc(env(safe-area-inset-bottom, 0px) + 8px)",
      maxWidth: 430,
      margin: "0 auto",
      width: "100%",
    },
    navBtn: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
      background: "none",
      border: "none",
      color: colors.muted,
      fontSize: 11.5,
      fontWeight: 500,
      padding: "6px 0",
      cursor: "pointer",
      borderRadius: 8,
    },
    navBtnActive: {
      color: colors.ink,
      background: "#EEF0EA",
    },
    toast: {
      position: "fixed",
      bottom: 78,
      left: "50%",
      transform: "translateX(-50%)",
      background: "#fff",
      border: "1.5px solid",
      borderRadius: 10,
      padding: "10px 16px",
      fontSize: 13.5,
      display: "flex",
      alignItems: "center",
      gap: 8,
      boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
      maxWidth: "88%",
    },
  };
})();
