import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { 
  Camera, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Calendar, 
  Check, 
  Zap, 
  RefreshCw 
} from "lucide-react";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function GestionTraspaso({ lotes = [], productos = [], onGuardarLotes }) {
  const [barcodeScanned, setBarcodeScanned] = useState("");
  const [loteSeleccionadoId, setLoteSeleccionadoId] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [modoAutotraspaso, setModoAutotraspaso] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const scannerRef = useRef(null);

  // Normalizar búsqueda de producto (Soporta Array u Objeto, y claves 'barcode', 'codigo', 'codigoBarra')
  const infoProducto = Array.isArray(productos)
    ? productos.find((p) => String(p.barcode || p.codigo || p.codigoBarra) === String(barcodeScanned))
    : productos[barcodeScanned];

  // Filtrar y ordenar lotes en Bodega por Fecha de Ingreso (FIFO/FEFO)
  const lotesDisponibles = lotes.filter((l) => {
    const code = String(l.barcode || l.codigo || l.codigoBarra || "");
    const ubicacion = l.ubicacion || "bodega";
    return code === String(barcodeScanned) && ubicacion === "bodega";
  });

  const lotesOrdenados = [...lotesDisponibles].sort((a, b) => {
    const fechaA = new Date(a.fechaIngreso || a.fecha || 0);
    const fechaB = new Date(b.fechaIngreso || b.fecha || 0);
    return fechaA - fechaB;
  });

  const loteSeleccionado = lotes.find((l) => l.id === loteSeleccionadoId);

  // Auto-seleccionar el lote más antiguo en cuanto la cámara escanea algo
  useEffect(() => {
    if (lotesOrdenados.length > 0) {
      setLoteSeleccionadoId(lotesOrdenados[0].id);
      setCantidad(1);

      // Si está en Modo Ráfaga (Auto-traspaso 1 unidad al detectar)
      if (modoAutotraspaso) {
        ejecutarTraspasoDirecto(lotesOrdenados[0], 1);
      }
    } else {
      setLoteSeleccionadoId(null);
    }
  }, [barcodeScanned]);

  // Inicialización del Lector de Cámara Continuo
  useEffect(() => {
    if (camaraActiva) {
      const html5Qrcode = new Html5Qrcode("reader");
      scannerRef.current = html5Qrcode;

      html5Qrcode.start(
        { facingMode: "environment" }, // Usa la cámara trasera del celular
        { fps: 15, qrbox: { width: 280, height: 160 } },
        (decodedText) => {
          const codeClean = decodedText.trim();
          setBarcodeScanned(codeClean);
          setMensaje(null);
          
          // Si no está en modo ráfaga, pausa/cierra cámara para mostrar el detalle instantáneo
          if (!modoAutotraspaso) {
            detenerCamara();
          }
        },
        () => {}
      ).catch((err) => {
        console.error("Error al iniciar cámara:", err);
        setMensaje({ tipo: "error", texto: "No se pudo acceder a la cámara del celular." });
        setCamaraActiva(false);
      });
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [camaraActiva, modoAutotraspaso]);

  const detenerCamara = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => setCamaraActiva(false)).catch(() => setCamaraActiva(false));
    } else {
      setCamaraActiva(false);
    }
  };

  const ejecutarTraspasoDirecto = (loteAProcesar, cantAProcesar) => {
    if (!loteAProcesar) return;

    const nuevosLotes = [];
    for (const l of lotes) {
      if (l.id === loteAProcesar.id) {
        const sobrante = l.cantidad - cantAProcesar;
        if (sobrante > 0) {
          nuevosLotes.push({ ...l, cantidad: sobrante, ubicacion: "bodega" });
        }
        nuevosLotes.push({
          ...l,
          id: uid(),
          cantidad: cantAProcesar,
          ubicacion: "produccion",
          fechaTraspaso: new Date().toISOString().slice(0, 10)
        });
      } else {
        nuevosLotes.push(l);
      }
    }

    onGuardarLotes(nuevosLotes);
    setMensaje({
      tipo: "ok",
      texto: `✅ Traspasado: ${cantAProcesar} un. (Ingreso: ${loteAProcesar.fechaIngreso || loteAProcesar.fecha || 'S/F'}) a Producción.`
    });

    if (!modoAutotraspaso) {
      setBarcodeScanned("");
      setLoteSeleccionadoId(null);
    }
  };

  const handleConfirmarTraspaso = (e) => {
    e.preventDefault();
    if (!loteSeleccionado) return;
    ejecutarTraspasoDirecto(loteSeleccionado, Number(cantidad));
  };

  return (
    <div style={S.container}>
      <div style={S.card}>
        <div style={S.headerRow}>
          <div>
            <div style={S.titleContainer}>
              <span style={S.plusSign}>+</span>
              <h2 style={S.title}>Paso a Producción por Cámara</h2>
            </div>
            <p style={S.subtitle}>Escaneo directo e identificación de lote más antiguo.</p>
          </div>

          <button
            type="button"
            onClick={() => setModoAutotraspaso(!modoAutotraspaso)}
            style={modoAutotraspaso ? S.btnZapActive : S.btnZapInactive}
            title="Traspasa 1 unidad automáticamente al detectar el código"
          >
            <Zap size={16} />
            <span>{modoAutotraspaso ? "Modo Ráfaga" : "Manual"}</span>
          </button>
        </div>

        {/* BOTÓN PRINCIPAL DE CÁMARA */}
        {!camaraActiva ? (
          <button
            type="button"
            onClick={() => {
              setBarcodeScanned("");
              setCamaraActiva(true);
            }}
            style={S.btnStartCamera}
          >
            <Camera size={24} />
            <span>ABRIR CÁMARA Y ESCANEAR</span>
          </button>
        ) : (
          <div style={S.cameraContainer}>
            <div style={S.cameraHeader}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#FFFFFF" }}>
                {modoAutotraspaso ? "⚡ Apunta al código (Auto-Traspaso 1un)" : "Apunta al código de barras"}
              </span>
              <button type="button" onClick={detenerCamara} style={S.btnCloseCam}>
                <X size={20} color="#FFF" />
              </button>
            </div>
            <div id="reader" style={{ width: "100%", borderRadius: 12, overflow: "hidden" }}></div>
          </div>
        )}

        {/* MUESTRA RESULTADO INSTANTÁNEO SI HAY UN CÓDIGO DETECTADO */}
        {barcodeScanned && (
          <div style={{ marginTop: 20 }}>
            {infoProducto ? (
              <div style={S.infoBoxOk}>
                <div style={S.prodName}>{infoProducto.nombre || infoProducto.descripcion}</div>
                <div style={S.prodSub}>
                  Código: <strong>{barcodeScanned}</strong> | Lotes en Bodega: <strong>{lotesOrdenados.length}</strong>
                </div>
              </div>
            ) : (
              <div style={S.infoBoxError}>
                <AlertCircle size={18} />
                <span>Código <strong>{barcodeScanned}</strong> no encontrado en la base de datos.</span>
              </div>
            )}

            {infoProducto && lotesOrdenados.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <label style={S.labelGroup}>Lote Seleccionado (Orden por Fecha de Ingreso):</label>
                
                <div style={S.lotesList}>
                  {lotesOrdenados.map((lote, idx) => {
                    const esSeleccionado = lote.id === loteSeleccionadoId;
                    const fechaIngresoStr = lote.fechaIngreso || lote.fecha || "Sin fecha";

                    return (
                      <div
                        key={lote.id}
                        onClick={() => {
                          setLoteSeleccionadoId(lote.id);
                          setCantidad(1);
                        }}
                        style={esSeleccionado ? S.loteCardSelected : S.loteCard}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Calendar size={16} color={esSeleccionado ? "#4F46E5" : "#64748B"} />
                            <span style={{ fontWeight: 700, fontSize: 13 }}>
                              Ingreso: {fechaIngresoStr}
                            </span>
                            {idx === 0 && <span style={S.badgeAntiguo}>Primer Ingreso</span>}
                          </div>
                          {esSeleccionado && <Check size={18} color="#4F46E5" />}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "#64748B" }}>
                          <span>Vencimiento: {lote.fechaVencimiento || "S/V"}</span>
                          <span style={{ fontWeight: 700, color: "#1E40AF" }}>Stock: {lote.cantidad} un.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {loteSeleccionado && !modoAutotraspaso && (
                  <form onSubmit={handleConfirmarTraspaso} style={{ marginTop: 16 }}>
                    <div style={{ marginBottom: 12 }}>
                      <label style={S.labelGroup}>Cantidad a Traspasar (Máx: {loteSeleccionado.cantidad}):</label>
                      <input
                        type="number"
                        min="1"
                        max={loteSeleccionado.cantidad}
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        style={S.inputNumber}
                      />
                    </div>

                    <button type="submit" style={S.btnSubmit}>
                      PASAR A PRODUCCIÓN AHORA <ArrowRight size={18} />
                    </button>
                  </form>
                )}
              </div>
            )}

            {infoProducto && lotesOrdenados.length === 0 && (
              <div style={S.alertError}>
                <AlertCircle size={18} />
                <span>No hay stock disponible en Bodega para este producto.</span>
              </div>
            )}
          </div>
        )}

        {mensaje && (
          <div style={mensaje.tipo === "ok" ? S.alertOk : S.alertError}>
            {mensaje.tipo === "ok" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{mensaje.texto}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  container: { maxWidth: 650, margin: "0 auto", padding: "10px" },
  card: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 20,
    padding: "20px 18px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
  },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  titleContainer: { display: "flex", alignItems: "center", gap: 6 },
  plusSign: { fontSize: 22, fontWeight: 700, color: "#4F46E5" },
  title: { fontSize: 18, fontWeight: 700, margin: 0, color: "#0F172A" },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 2, margin: 0 },
  btnZapActive: { display: "flex", alignItems: "center", gap: 4, backgroundColor: "#DCFCE7", color: "#15803D", border: "1px solid #86EFAC", padding: "6px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  btnZapInactive: { display: "flex", alignItems: "center", gap: 4, backgroundColor: "#F1F5F9", color: "#64748B", border: "1px solid #CBD5E1", padding: "6px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  btnStartCamera: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#4F46E5",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 14,
    padding: "16px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
  },
  cameraContainer: { backgroundColor: "#0F172A", borderRadius: 16, padding: 12 },
  cameraHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  btnCloseCam: { background: "none", border: "none", cursor: "pointer" },
  infoBoxOk: { backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12, padding: 12 },
  infoBoxError: { display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, padding: 12, color: "#DC2626", fontSize: 13 },
  prodName: { fontSize: 15, fontWeight: 700, color: "#1E1B4B" },
  prodSub: { fontSize: 12, color: "#4338CA", marginTop: 2 },
  labelGroup: { fontSize: 12, fontWeight: 700, color: "#475569" },
  lotesList: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 },
  loteCard: { padding: 12, borderRadius: 10, border: "1.5px solid #E2E8F0", backgroundColor: "#F8FAFC", cursor: "pointer" },
  loteCardSelected: { padding: 12, borderRadius: 10, border: "2px solid #4F46E5", backgroundColor: "#EEF2FF", cursor: "pointer" },
  badgeAntiguo: { backgroundColor: "#FEF3C7", color: "#D97706", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 },
  inputNumber: { width: "100%", border: "1.5px solid #CBD5E1", borderRadius: 10, padding: "10px 12px", fontSize: 15, backgroundColor: "#F8FAFC", color: "#0F172A", fontWeight: 700, boxSizing: "border-box", marginTop: 4 },
  btnSubmit: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#16A34A", color: "#FFFFFF", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  alertOk: { display: "flex", alignItems: "center", gap: 8, backgroundColor: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0", padding: 12, borderRadius: 10, marginTop: 14, fontSize: 13 },
  alertError: { display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", color: "#991B1B", border: "1px solid #FCA5A5", padding: 12, borderRadius: 10, marginTop: 14, fontSize: 13 }
};