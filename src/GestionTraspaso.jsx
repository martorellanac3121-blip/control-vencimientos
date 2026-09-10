import React, { useState } from "react";
import { 
  Scan, 
  Package, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X,
  Layers,
  Factory
} from "lucide-react";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function GestionTraspaso({ lotes = [], productos = {}, onGuardarLotes }) {
  const [barcode, setBarcode] = useState("");
  const [cantidadRetirar, setCantidadRetirar] = useState(1);
  const [mensaje, setMensaje] = useState(null);

  // Lotes que actualmente están en Bodega para este código
  const lotesBodega = lotes.filter(
    (l) => l.barcode === barcode.trim() && (l.ubicacion || "bodega") === "bodega"
  );

  // Lotes que ya están en Producción para este código
  const lotesProduccion = lotes.filter(
    (l) => l.barcode === barcode.trim() && l.ubicacion === "produccion"
  );

  const infoProducto = productos[barcode.trim()];

  // Stock disponible en Bodega para traspasar
  const stockBodega = lotesBodega.reduce((acc, l) => acc + (l.cantidad || 0), 0);
  const stockProduccion = lotesProduccion.reduce((acc, l) => acc + (l.cantidad || 0), 0);

  const handleRetirar = (e) => {
    e.preventDefault();
    const cant = Number(cantidadRetirar);

    if (!barcode.trim()) {
      setMensaje({ tipo: "error", texto: "Escanea o ingresa un código de barras." });
      return;
    }

    if (lotesBodega.length === 0 || stockBodega === 0) {
      setMensaje({ tipo: "error", texto: "No hay stock disponible en Bodega para este código." });
      return;
    }

    if (cant <= 0 || cant > stockBodega) {
      setMensaje({ 
        tipo: "error", 
        texto: `La cantidad debe ser mayor a 0 y no superar el stock disponible en Bodega (${stockBodega} un.).` 
      });
      return;
    }

    // Ordenar lotes de bodega por fecha de vencimiento (FEFO)
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

        // Si queda remanente en bodega, mantener lote en bodega con la nueva cantidad
        if (cantSobranteBodega > 0) {
          nuevosLotes.push({
            ...lote,
            cantidad: cantSobranteBodega,
            ubicacion: "bodega"
          });
        }

        // Crear/pasar la fracción traspasada a Producción conservando su fecha de vencimiento
        nuevosLotes.push({
          ...lote,
          id: uid(),
          cantidad: cantTraspasada,
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
      texto: `Éxito: Se traspasaron ${cant} un. de "${infoProducto?.nombre || barcode}" de Bodega a Producción.` 
    });

    setCantidadRetirar(1);
    setBarcode("");
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
        stockProduccion: totalProduccion
      };
    })
    .filter((p) => p.stockBodega > 0);

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
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value.replace(/\s/g, ""));
                  setMensaje(null);
                }}
                placeholder="Escanea o escribe el código"
                style={S.input}
                autoFocus
              />
              {barcode && (
                <button type="button" onClick={() => setBarcode("")} style={S.clearBtn}>
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {barcode.trim() !== "" && (
            <div style={infoProducto ? S.infoBoxOk : S.infoBoxError}>
              {infoProducto ? (
                <div>
                  <div style={S.prodName}>{infoProducto.nombre}</div>
                  <div style={S.prodSub}>
                    Categoría: {infoProducto.categoria} | 📦 En Bodega: <strong>{stockBodega} un.</strong> | 🏭 En Producción: <strong>{stockProduccion} un.</strong>
                  </div>
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
              type="number"
              min="1"
              max={stockBodega > 0 ? stockBodega : 1}
              value={cantidadRetirar}
              onChange={(e) => setCantidadRetirar(e.target.value)}
              style={S.inputNumber}
            />
          </div>

          <button 
            type="submit" 
            disabled={!barcode.trim() || stockBodega === 0}
            style={barcode.trim() && stockBodega > 0 ? S.btnSubmit : S.btnDisabled}
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
                onClick={() => setBarcode(prod.barcode)}
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
  infoBoxOk: { backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, padding: 12 },
  infoBoxError: { backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: 12 },
  prodName: { fontSize: 15, fontWeight: 700, color: "#1E1B4B" },
  prodSub: { fontSize: 12, color: "#4338CA", marginTop: 2 },
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
  }
};