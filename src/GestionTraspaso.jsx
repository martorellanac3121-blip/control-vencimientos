import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { 
  Scan, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Camera, 
  Calendar, 
  Check,
  ChevronRight
} from "lucide-react";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function GestionTraspaso({ lotes = [], productos = {}, onGuardarLotes }) {
  const [barcode, setBarcode] = useState("");
  const [codigoConfirmado, setCodigoConfirmado] = useState("");
  const [loteSeleccionadoId, setLoteSeleccionadoId] = useState(null);
  const [cantidadRetirar, setCantidadRetirar] = useState(1);
  const [mensaje, setMensaje] = useState(null);
  const [escaneandoCamara, setEscaneandoCamara] = useState(false);
  
  const scannerRef = useRef(null);

  // Lotes en Bodega del código verificado
  const lotesDisponibles = lotes.filter(
    (l) => l.barcode === codigoConfirmado.trim() && (l.ubicacion || "bodega") === "bodega"
  );

  // Ordenados de menor a mayor fecha de ingreso
  const lotesOrdenadosPorIngreso = [...lotesDisponibles].sort((a, b) => {
    const fechaA = new Date(a.fechaIngreso || a.fecha || 0);
    const fechaB = new Date(b.fechaIngreso || b.fecha || 0);
    return fechaA - fechaB;
  });

  const infoProducto = productos[codigoConfirmado.trim()];
  const loteSeleccionado = lotes.find((l) => l.id === loteSeleccionadoId);

  // Seleccionar automáticamente el lote más antiguo al presionar Continuar o Escanear
  useEffect(() => {
    if (lotesOrdenadosPorIngreso.length > 0) {
      setLoteSeleccionadoId(lotesOrdenadosPorIngreso[0].id);
      setCantidadRetirar(1);
    } else {
      setLoteSeleccionadoId(null);
    }
  }, [codigoConfirmado]);

  // Manejo de Cámara
  useEffect(() => {
    if (escaneandoCamara) {
      const html5Qrcode = new Html5Qrcode("reader");
      scannerRef.current = html5Qrcode;

      html5Qrcode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          const codeClean = decodedText.trim();
          setBarcode(codeClean);
          setCodigoConfirmado(codeClean);
          setMensaje(null);
          detenerCamara();
        },
        () => {}
      ).catch((err) => {
        console.error("Error al iniciar cámara:", err);
        setMensaje({ tipo: "error", texto: "No se pudo acceder a la cámara." });
        setEscaneandoCamara(false);
      });
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [escaneandoCamara]);

  const detenerCamara = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => setEscaneandoCamara(false)).catch(() => setEscaneandoCamara(false));
    } else {
      setEscaneandoCamara(false);
    }
  };

  const handleContinuar = (e) => {
    if (e) e.preventDefault();
    if (!barcode.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresa o escanea un código de barras." });
      return;
    }
    setCodigoConfirmado(barcode.trim());
    setMensaje(null);
  };

  const handleTraspasarLote = (e) => {
    e.preventDefault();
    if (!loteSeleccionado) {
      setMensaje({ tipo: "error", texto: "Selecciona un lote para continuar." });
      return;
    }

    const cant = Number(cantidadRetirar);
    if (cant <= 0 || cant > loteSeleccionado.cantidad) {
      setMensaje({
        tipo: "error",
        texto: `La cantidad debe ser entre 1 y ${loteSeleccionado.cantidad} un.`
      });
      return;
    }

    const nuevosLotes = [];
    for (const lote of lotes) {
      if (lote.id === loteSeleccionado.id) {
        const sobranteBodega = lote.cantidad - cant;
        if (sobranteBodega > 0) {
          nuevosLotes.push({
            ...lote,
            cantidad: sobranteBodega,
            ubicacion: "bodega"
          });
        }
        nuevosLotes.push({
          ...lote,
          id: uid(),
          cantidad: cant,
          ubicacion: "produccion",
          fechaTraspaso: new Date().toISOString().slice(0, 10)
        });
      } else {
        nuevosLotes.push(lote);
      }
    }

    onGuardarLotes(nuevosLotes);
    setMensaje({
      tipo: "ok",
      texto: `Éxito: Se traspasaron ${cant} un. del Lote (Ingreso: ${loteSeleccionado.fechaIngreso || loteSeleccionado.fecha || 'N/A'}) a Producción.`
    });

    setBarcode("");
    setCodigoConfirmado("");
    setLoteSeleccionadoId(null);
    setCantidadRetirar(1);
  };

  return (
    <div style={S.container}>
      <div style={S.card}>
        {/* Título e icono estilo + exactamente igual a la imagen */}
        <div style={S.titleContainer}>
          <span style={S.plusSign}>+</span>
          <h2 style={S.title}>Traspaso de Productos a Producción</h2>
        </div>
        <p style={S.subtitle}>
          Escanea o ingresa el código de barras para traspasar lotes a producción.
        </p>

        {/* Input de código de barras exacto a la imagen */}
        <form onSubmit={handleContinuar}>
          <div style={S.inputContainer}>
            <Scan size={22} color="#64748B" style={{ marginLeft: 12, marginRight: 10 }} />
            <input
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value.replace(/\s/g, ""));
                if (codigoConfirmado) setCodigoConfirmado("");
                setMensaje(null);
              }}
              placeholder="Código de barra (ej: 780123456789)"
              style={S.input}
              autoFocus
            />
            {barcode && (
              <button 
                type="button" 
                onClick={() => { setBarcode(""); setCodigoConfirmado(""); }} 
                style={S.clearBtn}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Botones de acción directos calcados de la imagen */}
          <div style={S.buttonRow}>
            <button
              type="button"
              onClick={() => setEscaneandoCamara(true)}
              style={S.btnCamera}
            >
              <Camera size={20} color="#4F46E5" />
              <span>Escanear con Cámara</span>
            </button>

            <button
              type="submit"
              style={S.btnContinue}
            >
              <span>Continuar</span>
              <ChevronRight size={20} />
            </button>
          </div>
        </form>

        {/* Modal para la cámara */}
        {escaneandoCamara && (
          <div style={S.cameraModal}>
            <div style={S.cameraBox}>
              <div style={S.cameraHeader}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Apunta al código del producto</span>
                <button type="button" onClick={detenerCamara} style={S.clearBtn}>
                  <X size={20} />
                </button>
              </div>
              <div id="reader" style={{ width: "100%" }}></div>
            </div>
          </div>
        )}

        {/* Despliegue de Lotes cuando se presiona Continuar o se Escanea */}
        {codigoConfirmado !== "" && (
          <div style={{ marginTop: 24 }}>
            {infoProducto ? (
              <div style={S.infoBoxOk}>
                <div style={S.prodName}>{infoProducto.nombre}</div>
                <div style={S.prodSub}>
                  Categoría: {infoProducto.categoria} | Lotes Disponibles en Bodega: <strong>{lotesOrdenadosPorIngreso.length}</strong>
                </div>
              </div>
            ) : (
              <div style={S.infoBoxError}>
                <AlertCircle size={18} color="#DC2626" />
                <span>Producto no encontrado en la base de datos.</span>
              </div>
            )}

            {infoProducto && lotesOrdenadosPorIngreso.length > 0 && (
              <div style={S.lotesSection}>
                <label style={S.labelGroup}>Selecciona el Lote a Traspasar (Ordenados por Fecha de Ingreso):</label>
                <div style={S.lotesList}>
                  {lotesOrdenadosPorIngreso.map((lote, idx) => {
                    const esSeleccionado = lote.id === loteSeleccionadoId;
                    const fechaIngresoStr = lote.fechaIngreso || lote.fecha || "Sin fecha";
                    const fechaVencStr = lote.fechaVencimiento || "Sin vencimiento";

                    return (
                      <div
                        key={lote.id}
                        onClick={() => {
                          setLoteSeleccionadoId(lote.id);
                          setCantidadRetirar(1);
                        }}
                        style={esSeleccionado ? S.loteCardSelected : S.loteCard}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Calendar size={16} color={esSeleccionado ? "#4F46E5" : "#64748B"} />
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#0F172A" }}>
                              Fecha Ingreso: {fechaIngresoStr}
                            </span>
                            {idx === 0 && (
                              <span style={S.badgeAntiguo}>Más Antiguo</span>
                            )}
                          </div>
                          {esSeleccionado && <Check size={18} color="#4F46E5" />}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "#64748B" }}>
                          <span>Vencimiento: {fechaVencStr}</span>
                          <span style={{ fontWeight: 700, color: "#1E40AF" }}>
                            Disponible: {lote.cantidad} un.
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Formulario final para confirmar cantidad */}
                {loteSeleccionado && (
                  <form onSubmit={handleTraspasarLote} style={{ marginTop: 18 }}>
                    <div style={S.field}>
                      <label style={S.labelGroup}>
                        Cantidad a Traspasar (Stock lote seleccionado: {loteSeleccionado.cantidad} un.)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={loteSeleccionado.cantidad}
                        value={cantidadRetirar}
                        onChange={(e) => setCantidadRetirar(e.target.value)}
                        style={S.inputNumber}
                      />
                    </div>

                    <button type="submit" style={S.btnSubmit}>
                      Confirmar Traspaso a Producción <ArrowRight size={18} />
                    </button>
                  </form>
                )}
              </div>
            )}

            {infoProducto && lotesOrdenadosPorIngreso.length === 0 && (
              <div style={S.alertError}>
                <AlertCircle size={18} />
                <span>Este producto no cuenta con lotes disponibles en Bodega.</span>
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
  container: { maxWidth: 720, margin: "0 auto", padding: "10px" },
  card: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 20,
    padding: "28px 24px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)",
  },
  titleContainer: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  plusSign: { fontSize: 22, fontWeight: 700, color: "#4F46E5" },
  title: { fontSize: 20, fontWeight: 700, margin: 0, color: "#0F172A" },
  subtitle: { fontSize: 13, color: "#64748B", marginBottom: 20, marginTop: 4, paddingLeft: 18 },
  inputContainer: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    border: "1.5px solid #E2E8F0",
    borderRadius: 14,
    padding: "6px 8px",
    marginBottom: 16,
  },
  input: {
    border: "none",
    background: "transparent",
    fontSize: 15,
    flex: 1,
    color: "#0F172A",
    outline: "none",
    padding: "10px 0",
    fontWeight: 500,
  },
  clearBtn: { border: "none", background: "none", color: "#94A3B8", cursor: "pointer", marginRight: 8 },
  buttonRow: { display: "flex", gap: 12 },
  btnCamera: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EEF2FF",
    color: "#4F46E5",
    border: "1px solid #E0E7FF",
    borderRadius: 12,
    padding: "14px 16px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  btnContinue: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4F46E5",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: "14px 16px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  cameraModal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: 16,
  },
  cameraBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    maxWidth: 450,
  },
  cameraHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  infoBoxOk: { backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 12, padding: 14 },
  infoBoxError: { display: "flex", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, padding: 14, color: "#DC2626" },
  prodName: { fontSize: 16, fontWeight: 700, color: "#1E1B4B" },
  prodSub: { fontSize: 13, color: "#4338CA", marginTop: 4 },
  lotesSection: { marginTop: 20 },
  labelGroup: { fontSize: 13, fontWeight: 600, color: "#475569" },
  lotesList: { display: "flex", flexDirection: "column", gap: 10, marginTop: 10 },
  loteCard: {
    padding: 14,
    borderRadius: 12,
    border: "1.5px solid #E2E8F0",
    backgroundColor: "#F8FAFC",
    cursor: "pointer",
  },
  loteCardSelected: {
    padding: 14,
    borderRadius: 12,
    border: "2px solid #4F46E5",
    backgroundColor: "#EEF2FF",
    cursor: "pointer",
  },
  badgeAntiguo: {
    backgroundColor: "#FEF3C7",
    color: "#D97706",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 6,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  inputNumber: {
    border: "1.5px solid #CBD5E1",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 15,
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    fontWeight: 600,
  },
  btnSubmit: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4F46E5",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    marginTop: 12,
  },
  alertOk: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    color: "#065F46",
    border: "1px solid #A7F3D0",
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    fontSize: 14,
  },
  alertError: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    color: "#991B1B",
    border: "1px solid #FCA5A5",
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    fontSize: 14,
  }
};