import React, { useState, useEffect, useRef } from "react";
import {
  Scan,
  Package,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Camera,
  X,
  Layers,
} from "lucide-react";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ============================================================
   UTILIDADES COMPARTIDAS (también las usa App.jsx)
   ============================================================ */

/**
 * Busca el código escaneado entre los productos ya registrados.
 * - Primero por coincidencia exacta.
 * - Si no hay, ignora ceros a la izquierda (una cámara puede leer un
 *   UPC-A de 12 dígitos como EAN-13 de 13 con un 0 adelante, o viceversa).
 * Si no encuentra nada, devuelve el código limpio tal cual.
 */
export function resolverCodigo(codigo, productos = {}) {
  const limpio = String(codigo || "").replace(/\s/g, "");
  if (!limpio) return "";
  if (productos[limpio]) return limpio;

  const sinCeros = limpio.replace(/^0+/, "");
  if (!sinCeros) return limpio;

  const claveEquivalente = Object.keys(productos).find(
    (k) => k.replace(/^0+/, "") === sinCeros
  );
  return claveEquivalente || limpio;
}

function esDispositivoTactil() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function avisoLectura() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      if (ctx.resume) ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      osc.onended = () => {
        try { ctx.close(); } catch (e) {}
      };
    }
  } catch (e) {}
  try {
    if (navigator.vibrate) navigator.vibrate(80);
  } catch (e) {}
}

/* ============================================================
   ESCÁNER DE CÁMARA
   - Chrome/Android: usa el BarcodeDetector nativo (rápido).
   - iPhone/Safari, Firefox, PC: usa ZXing (se descarga solo, sin instalar nada).
   ============================================================ */

const FORMATOS_NATIVOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];
const ZXING_URL = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";

let zxingPromise = null;
function cargarZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingPromise) {
    zxingPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = ZXING_URL;
      s.async = true;
      s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error("ZXing no disponible")));
      s.onerror = () => {
        zxingPromise = null;
        reject(new Error("No se pudo descargar ZXing"));
      };
      document.head.appendChild(s);
    });
  }
  return zxingPromise;
}

function mensajeErrorCamara(err) {
  const n = err && err.name;
  if (n === "NotAllowedError" || n === "SecurityError") {
    return "Permiso de cámara denegado. Actívalo en los ajustes del navegador y vuelve a intentar.";
  }
  if (n === "NotFoundError" || n === "OverconstrainedError") {
    return "No se encontró una cámara en este dispositivo.";
  }
  if (n === "NotReadableError") {
    return "La cámara está siendo usada por otra aplicación.";
  }
  return "No se pudo acceder a la cámara. Escribe el código manualmente.";
}

export function CameraScannerModal({ onClose, onScan }) {
  const videoRef = useRef(null);
  const onScanRef = useRef(onScan);
  const yaLeido = useRef(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [listo, setListo] = useState(false);

  // Siempre usar la última versión de onScan sin reiniciar la cámara
  onScanRef.current = onScan;

  useEffect(() => {
    let cancelado = false;
    let stream = null;
    let intervalo = null;
    let lector = null;

    const detener = () => {
      if (intervalo) clearInterval(intervalo);
      if (lector) {
        try { lector.reset(); } catch (e) {}
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    const alDetectar = (valor) => {
      if (cancelado || yaLeido.current) return;
      const code = String(valor || "").trim();
      if (!code) return;
      yaLeido.current = true;
      avisoLectura();
      onScanRef.current(code);
    };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg("La cámara solo funciona en páginas seguras (HTTPS). Escribe el código manualmente.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        setErrorMsg(mensajeErrorCamara(err));
        return;
      }

      if (cancelado) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try { await video.play(); } catch (e) {}
      if (cancelado) return;
      setListo(true);

      // 1) Detector nativo del navegador (Chrome Android, etc.)
      let detector = null;
      if ("BarcodeDetector" in window) {
        try {
          let formatos = FORMATOS_NATIVOS;
          if (typeof window.BarcodeDetector.getSupportedFormats === "function") {
            const soportados = await window.BarcodeDetector.getSupportedFormats();
            formatos = FORMATOS_NATIVOS.filter((f) => soportados.includes(f));
          }
          if (formatos.includes("ean_13")) {
            detector = new window.BarcodeDetector({ formats: formatos });
          }
        } catch (e) {
          detector = null;
        }
      }
      if (cancelado) return;

      if (detector) {
        let ocupado = false;
        intervalo = setInterval(async () => {
          if (ocupado || yaLeido.current || video.readyState < 2) return;
          ocupado = true;
          try {
            const resultados = await detector.detect(video);
            if (resultados.length > 0) alDetectar(resultados[0].rawValue);
          } catch (e) {
          } finally {
            ocupado = false;
          }
        }, 250);
        return;
      }

      // 2) Respaldo con ZXing (iPhone, Firefox, PC)
      try {
        const ZXing = await cargarZXing();
        if (cancelado) return;

        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_A,
          ZXing.BarcodeFormat.UPC_E,
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.ITF,
          ZXing.BarcodeFormat.QR_CODE,
        ]);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

        lector = new ZXing.BrowserMultiFormatReader(hints, 200);
        lector
          .decodeFromStream(stream, video, (resultado) => {
            if (resultado) alDetectar(resultado.getText());
          })
          .catch(() => {});
      } catch (e) {
        setErrorMsg("No se pudo cargar el lector de códigos. Revisa tu conexión o escribe el código manualmente.");
      }
    })();

    return () => {
      cancelado = true;
      detener();
    };
  }, []);

  return (
    <div style={S.modalOverlay}>
      <style>{`@keyframes pulseBeamScan { 0% { top: 10%; opacity: 0.3; } 50% { top: 85%; opacity: 1; } 100% { top: 10%; opacity: 0.3; } }`}</style>
      <div style={S.modalContainer}>
        <div style={S.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Camera size={18} color="#4F46E5" />
            <span style={S.modalTitle}>Escáner de Cámara</span>
          </div>
          <button type="button" onClick={onClose} style={S.btnCloseModal}>
            <X size={18} />
          </button>
        </div>

        <div style={S.cameraViewport}>
          <video ref={videoRef} style={S.videoElement} autoPlay playsInline muted />
          <div style={S.scannerOverlay}>
            <div style={S.scanBoxFrame}>
              <div style={S.scanBeamLine} />
            </div>
          </div>
        </div>

        {errorMsg ? (
          <div style={S.cameraErrorBox}>
            <AlertTriangle size={16} color="#DC2626" />
            <span>{errorMsg}</span>
          </div>
        ) : (
          <div style={S.cameraHint}>
            {listo ? "Apunta al código de barras dentro del recuadro" : "Iniciando cámara…"}
          </div>
        )}

        <div style={S.modalFooter}>
          <button type="button" onClick={onClose} style={S.btnSecondaryModal}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PANTALLA DE TRASPASO BODEGA → PRODUCCIÓN
   ============================================================ */

export default function GestionTraspaso({ lotes = [], productos = {}, onGuardarLotes }) {
  const [barcode, setBarcode] = useState("");
  const [cantidadRetirar, setCantidadRetirar] = useState(1);
  const [mensaje, setMensaje] = useState(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const barcodeRef = useRef(null);
  const cantidadRef = useRef(null);

  // Código "oficial" (si el escaneado equivale a uno ya registrado, usa el registrado)
  const codigo = resolverCodigo(barcode, productos);

  // Lotes que actualmente están en Bodega para este código
  const lotesBodega = lotes.filter(
    (l) => l.barcode === codigo && (l.ubicacion || "bodega") === "bodega"
  );

  // Lotes que ya están en Producción para este código
  const lotesProduccion = lotes.filter(
    (l) => l.barcode === codigo && l.ubicacion === "produccion"
  );

  const infoProducto = productos[codigo];

  const stockBodega = lotesBodega.reduce((acc, l) => acc + (l.cantidad || 0), 0);
  const stockProduccion = lotesProduccion.reduce((acc, l) => acc + (l.cantidad || 0), 0);

  const enfocarCantidad = () => {
    setTimeout(() => {
      if (cantidadRef.current) {
        cantidadRef.current.focus();
        cantidadRef.current.select();
      }
    }, 150);
  };

  const alEscanearConCamara = (codigoLeido) => {
    setCamaraAbierta(false);
    const resuelto = resolverCodigo(codigoLeido, productos);
    setBarcode(resuelto);
    setCantidadRetirar(1);

    if (!productos[resuelto]) {
      setMensaje({
        tipo: "error",
        texto: `El código ${resuelto} no está registrado. Primero ingrésalo a Bodega.`,
      });
    } else {
      setMensaje(null);
      enfocarCantidad();
    }
  };

  const handleRetirar = (e) => {
    e.preventDefault();
    const cant = Number(cantidadRetirar);

    if (!codigo) {
      setMensaje({ tipo: "error", texto: "Escanea o ingresa un código de barras." });
      return;
    }

    if (!infoProducto) {
      setMensaje({ tipo: "error", texto: "Ese código no está registrado en el inventario." });
      return;
    }

    if (lotesBodega.length === 0 || stockBodega === 0) {
      setMensaje({ tipo: "error", texto: "No hay stock disponible en Bodega para este código." });
      return;
    }

    if (!Number.isInteger(cant) || cant <= 0 || cant > stockBodega) {
      setMensaje({
        tipo: "error",
        texto: `La cantidad debe ser un número entero mayor a 0 y no superar el stock disponible en Bodega (${stockBodega} un.).`,
      });
      return;
    }

    // Ordenar lotes de bodega por fecha de vencimiento (FEFO: primero el que vence antes)
    const bodegaOrdenados = [...lotesBodega].sort(
      (a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento)
    );

    let restante = cant;
    const deducciones = {}; // loteId -> cantidadTraspasada

    for (const lote of bodegaOrdenados) {
      if (restante <= 0) break;
      const desc = Math.min(lote.cantidad, restante);
      deducciones[lote.id] = desc;
      restante -= desc;
    }

    // Reconstruir lista de lotes actualizando ubicaciones
    const nuevosLotes = [];

    for (const lote of lotes) {
      if (deducciones[lote.id]) {
        const cantTraspasada = deducciones[lote.id];
        const cantSobranteBodega = lote.cantidad - cantTraspasada;

        // Si queda remanente en bodega, mantener el lote en bodega con la nueva cantidad
        if (cantSobranteBodega > 0) {
          nuevosLotes.push({
            ...lote,
            cantidad: cantSobranteBodega,
            ubicacion: "bodega",
          });
        }

        // La fracción traspasada pasa a Producción conservando su fecha de vencimiento
        nuevosLotes.push({
          ...lote,
          id: uid(),
          cantidad: cantTraspasada,
          ubicacion: "produccion",
          fechaTraspaso: new Date().toISOString().slice(0, 10),
        });
      } else {
        nuevosLotes.push(lote);
      }
    }

    onGuardarLotes(nuevosLotes);

    setMensaje({
      tipo: "ok",
      texto: `Éxito: Se traspasaron ${cant} un. de "${infoProducto.nombre}" de Bodega a Producción.`,
    });

    setCantidadRetirar(1);
    setBarcode("");

    // En PC con lector USB, deja el cursor listo para el siguiente escaneo
    if (!esDispositivoTactil()) {
      setTimeout(() => barcodeRef.current && barcodeRef.current.focus(), 50);
    }
  };

  // Resumen de productos en Bodega para selección rápida
  const productosBodega = Object.keys(productos)
    .map((code) => {
      const lotesProd = lotes.filter((l) => l.barcode === code && (l.ubicacion || "bodega") === "bodega");
      const totalBodega = lotesProd.reduce((sum, l) => sum + (l.cantidad || 0), 0);
      const lotesProdProd = lotes.filter((l) => l.barcode === code && l.ubicacion === "produccion");
      const totalProduccion = lotesProdProd.reduce((sum, l) => sum + (l.cantidad || 0), 0);

      return {
        barcode: code,
        nombre: productos[code].nombre,
        categoria: productos[code].categoria,
        stockBodega: totalBodega,
        stockProduccion: totalProduccion,
      };
    })
    .filter((p) => p.stockBodega > 0);

  const puedeTraspasar = !!infoProducto && stockBodega > 0;

  return (
    <div style={S.container}>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RefreshCw size={22} color="#4F46E5" />
            <h2 style={S.title}>Traspaso de Bodega a Producción</h2>
          </div>
          <p style={S.subtitle}>
            Al retirar productos, su ubicación cambiará a "Producción". Si están por vencer, seguirán generando alertas.
          </p>
        </div>

        <form onSubmit={handleRetirar} style={S.form}>
          <div style={S.field}>
            <label style={S.label}>Código de Barras</label>
            <div style={S.inputWithIcon}>
              <Scan size={18} color="#64748B" />
              <input
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value.replace(/\s/g, ""));
                  setMensaje(null);
                }}
                onKeyDown={(e) => {
                  // Los lectores USB/Bluetooth envían Enter al terminar: pasar a cantidad, no confirmar
                  if (e.key === "Enter") {
                    e.preventDefault();
                    enfocarCantidad();
                  }
                }}
                placeholder="Escanea o escribe el código"
                style={S.input}
                autoFocus={!esDispositivoTactil()}
              />
              {barcode && (
                <button type="button" onClick={() => setBarcode("")} style={S.clearBtn}>
                  <X size={16} />
                </button>
              )}
            </div>

            <button type="button" onClick={() => setCamaraAbierta(true)} style={S.btnCamera}>
              <Camera size={18} />
              <span>Escanear con Cámara</span>
            </button>
          </div>

          {barcode.trim() !== "" && (
            <div style={infoProducto ? S.infoBoxOk : S.infoBoxError}>
              {infoProducto ? (
                <div>
                  <div style={S.prodName}>{infoProducto.nombre}</div>
                  <div style={S.prodSub}>
                    Categoría: {infoProducto.categoria} | 📦 En Bodega: <strong>{stockBodega} un.</strong> | 🏭 En Producción: <strong>{stockProduccion} un.</strong>
                  </div>
                  {stockBodega === 0 && (
                    <div style={S.warnText}>No hay stock en Bodega para traspasar.</div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#DC2626" }}>
                  <AlertCircle size={18} />
                  <span>Código no registrado en inventario.</span>
                </div>
              )}
            </div>
          )}

          <div style={S.field}>
            <label style={S.label}>Cantidad a Traspasar a Producción</label>
            <input
              ref={cantidadRef}
              type="number"
              inputMode="numeric"
              min="1"
              max={stockBodega > 0 ? stockBodega : 1}
              value={cantidadRetirar}
              onChange={(e) => setCantidadRetirar(e.target.value)}
              style={S.inputNumber}
            />
          </div>

          <button
            type="submit"
            disabled={!puedeTraspasar}
            style={puedeTraspasar ? S.btnSubmit : S.btnDisabled}
          >
            Confirmar Traspaso a Producción <ArrowRight size={18} />
          </button>
        </form>

        {mensaje && (
          <div style={mensaje.tipo === "ok" ? S.alertOk : S.alertError}>
            {mensaje.tipo === "ok" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{mensaje.texto}</span>
          </div>
        )}
      </div>

      <div style={{ ...S.card, marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Layers size={18} color="#4F46E5" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Disponible en Bodega ({productosBodega.length})</h3>
        </div>

        {productosBodega.length === 0 ? (
          <div style={S.emptyList}>
            <Package size={32} color="#94A3B8" />
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748B" }}>
              No hay stock activo en Bodega.
            </p>
          </div>
        ) : (
          <div style={S.productList}>
            {productosBodega.map((prod) => (
              <div
                key={prod.barcode}
                style={S.productItem}
                onClick={() => {
                  setBarcode(prod.barcode);
                  setMensaje(null);
                }}
                title="Haz clic para seleccionar este producto"
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{prod.nombre}</div>
                  <div style={{ fontSize: 12, color: "#64748B", fontFamily: "monospace" }}>{prod.barcode} · {prod.categoria}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={S.stockBadgeBodega}>📦 {prod.stockBodega} un.</span>
                  {prod.stockProduccion > 0 && (
                    <span style={S.stockBadgeProduccion}>🏭 {prod.stockProduccion} un.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {camaraAbierta && (
        <CameraScannerModal
          onClose={() => setCamaraAbierta(false)}
          onScan={alEscanearConCamara}
        />
      )}
    </div>
  );
}

const S = {
  container: { maxWidth: 800, margin: "0 auto" },
  card: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
  },
  cardHeader: { marginBottom: 20 },
  title: { fontSize: 19, fontWeight: 700, margin: 0, color: "#0F172A" },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 6 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "#475569" },
  inputWithIcon: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1.5px solid #CBD5E1",
    borderRadius: 10,
    padding: "12px 14px",
    backgroundColor: "#F8FAFC",
  },
  input: {
    border: "none",
    background: "transparent",
    fontSize: 15,
    flex: 1,
    minWidth: 0,
    color: "#0F172A",
    fontFamily: "monospace",
    fontWeight: 600,
  },
  inputNumber: {
    border: "1.5px solid #CBD5E1",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 15,
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    fontWeight: 600,
  },
  clearBtn: { border: "none", background: "none", color: "#94A3B8", cursor: "pointer" },
  btnCamera: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EEF2FF",
    color: "#4F46E5",
    border: "1px solid #C7D2FE",
    padding: "12px 16px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  infoBoxOk: { backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, padding: 12 },
  infoBoxError: { backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: 12 },
  prodName: { fontSize: 15, fontWeight: 700, color: "#1E1B4B" },
  prodSub: { fontSize: 12, color: "#4338CA", marginTop: 2 },
  warnText: { fontSize: 12, color: "#B45309", marginTop: 6, fontWeight: 600 },
  btnSubmit: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4F46E5",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnDisabled: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#94A3B8",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    fontWeight: 700,
    cursor: "not-allowed",
    opacity: 0.7,
  },
  alertOk: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    color: "#065F46",
    border: "1px solid #A7F3D0",
    padding: 12,
    borderRadius: 10,
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
    borderRadius: 10,
    marginTop: 16,
    fontSize: 14,
  },
  productList: { display: "flex", flexDirection: "column", gap: 8 },
  productItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    backgroundColor: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    cursor: "pointer",
  },
  stockBadgeBodega: {
    backgroundColor: "#DBEAFE",
    color: "#1E40AF",
    fontWeight: 700,
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 6,
  },
  stockBadgeProduccion: {
    backgroundColor: "#F3E8FF",
    color: "#6B21A8",
    fontWeight: 700,
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 6,
  },
  emptyList: {
    textAlign: "center",
    padding: "24px 12px",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    border: "1px dashed #CBD5E1",
  },

  // ---- Modal del escáner ----
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    padding: 16,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 480,
    padding: 20,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: "#0F172A" },
  btnCloseModal: { border: "none", background: "none", cursor: "pointer", color: "#64748B" },
  cameraViewport: {
    position: "relative",
    width: "100%",
    height: 260,
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
  },
  videoElement: { width: "100%", height: "100%", objectFit: "cover" },
  scannerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  scanBoxFrame: {
    width: 240,
    height: 130,
    border: "2px dashed #6366F1",
    borderRadius: 12,
    position: "relative",
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  scanBeamLine: {
    position: "absolute",
    left: "5%",
    width: "90%",
    height: "2px",
    backgroundColor: "#EF4444",
    boxShadow: "0 0 8px #EF4444",
    animation: "pulseBeamScan 2s infinite ease-in-out",
  },
  cameraHint: { marginTop: 12, fontSize: 13, color: "#64748B", textAlign: "center" },
  cameraErrorBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    color: "#991B1B",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    fontSize: 13,
  },
  modalFooter: { marginTop: 14, display: "flex", justifyContent: "flex-end" },
  btnSecondaryModal: {
    backgroundColor: "#F1F5F9",
    color: "#475569",
    border: "none",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};