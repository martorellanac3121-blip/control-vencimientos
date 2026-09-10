import React, { useState } from "react";
import { 
  Scan, 
  Package, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  X,
  Layers
} from "lucide-react";

export default function GestionTraspaso({ lotes = [], productos = {}, onGuardarLotes }) {
  const [barcode, setBarcode] = useState("");
  const [cantidadRetirar, setCantidadRetirar] = useState(1);
  const [mensaje, setMensaje] = useState(null);

  // Filtrar lotes activos pertenecientes al código buscado
  const lotesDelCodigo = lotes.filter(
    (l) => l.barcode === barcode.trim()
  );

  // Información general del producto registrado
  const infoProducto = productos[barcode.trim()];

  // Stock total disponible sumando todos los lotes de ese código
  const stockDisponible = lotesDelCodigo.reduce((acc, l) => acc + (l.cantidad || 0), 0);

  const handleRetirar = (e) => {
    e.preventDefault();
    const cant = Number(cantidadRetirar);

    if (!barcode.trim()) {
      setMensaje({ tipo: "error", texto: "Escanea o ingresa un código de barras." });
      return;
    }

    if (lotesDelCodigo.length === 0 || stockDisponible === 0) {
      setMensaje({ tipo: "error", texto: "No hay stock disponible registrado para este código." });
      return;
    }

    if (cant <= 0 || cant > stockDisponible) {
      setMensaje({ 
        tipo: "error", 
        texto: `La cantidad debe ser mayor a 0 y no superar el stock disponible (${stockDisponible} un.).` 
      });
      return;
    }

    // Descontar unidades de los lotes más próximos a vencer primero
    let restanteADescontar = cant;
    
    // Crear copia ordenada por fecha de vencimiento (más antiguos primero)
    const lotesOrdenados = [...lotes].sort(
      (a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento)
    );

    const nuevosLotes = [];

    for (const lote of lotesOrdenados) {
      if (lote.barcode === barcode.trim() && restanteADescontar > 0) {
        if (lote.cantidad <= restanteADescontar) {
          // El lote se agota completamente, se omite de los nuevos lotes
          restanteADescontar -= lote.cantidad;
        } else {
          // El lote conserva unidades sobrantes
          nuevosLotes.push({
            ...lote,
            cantidad: lote.cantidad - restanteADescontar
          });
          restanteADescontar = 0;
        }
      } else {
        nuevosLotes.push(lote);
      }
    }

    // Actualizar almacenamiento centralizado
    onGuardarLotes(nuevosLotes);

    setMensaje({ 
      tipo: "ok", 
      texto: `Éxito: Se retiraron ${cant} un. de "${infoProducto?.nombre || barcode}" a producción.` 
    });

    setCantidadRetirar(1);
    setBarcode("");
  };

  // Lista de productos con stock registrado para selección rápida
  const productosConStock = Object.keys(productos)
    .map((code) => {
      const lotesProd = lotes.filter((l) => l.barcode === code);
      const total = lotesProd.reduce((sum, l) => sum + (l.cantidad || 0), 0);
      return {
        barcode: code,
        nombre: productos[code].nombre,
        categoria: productos[code].categoria,
        stockTotal: total,
        lotesCount: lotesProd.length
      };
    })
    .filter((p) => p.stockTotal > 0);

  return (
    <div style={S.container}>
      <div style={S.card}>
        <div style={S.cardHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RefreshCw size={22} color="#4F46E5" />
            <h2 style={S.title}>Retiro de Productos a Producción</h2>
          </div>
          <p style={S.subtitle}>
            Escanea el código de barras para descontar automáticamente unidades de tus lotes registrados en inventario.
          </p>
        </div>

        {/* Formulario de Retiro */}
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
                placeholder="Escanea o escribe el código (ej: 780123456789)"
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

          {/* Información en tiempo real del producto escaneado */}
          {barcode.trim() !== "" && (
            <div style={infoProducto ? S.infoBoxOk : S.infoBoxError}>
              {infoProducto ? (
                <div>
                  <div style={S.prodName}>{infoProducto.nombre}</div>
                  <div style={S.prodSub}>
                    Categoría: {infoProducto.categoria} | Stock Total Registrado: <strong>{stockDisponible} un.</strong> ({lotesDelCodigo.length} lote/s)
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#DC2626" }}>
                  <AlertCircle size={18} />
                  <span>Código no registrado en inventario. Ingresa primero el producto en la pestaña "Escanear / Ingresar".</span>
                </div>
              )}
            </div>
          )}

          <div style={S.field}>
            <label style={S.label}>Cantidad a Retirar para Producción</label>
            <input
              type="number"
              min="1"
              max={stockDisponible > 0 ? stockDisponible : 1}
              value={cantidadRetirar}
              onChange={(e) => setCantidadRetirar(e.target.value)}
              style={S.inputNumber}
            />
          </div>

          <button 
            type="submit" 
            disabled={!barcode.trim() || stockDisponible === 0}
            style={barcode.trim() && stockDisponible > 0 ? S.btnSubmit : S.btnDisabled}
          >
            Confirmar Retiro a Producción <ArrowRight size={18} />
          </button>
        </form>

        {mensaje && (
          <div style={mensaje.tipo === "ok" ? S.alertOk : S.alertError}>
            {mensaje.tipo === "ok" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{mensaje.texto}</span>
          </div>
        )}
      </div>

      {/* Catálogo en vivo de productos disponibles para seleccionar rápido */}
      <div style={{ ...S.card, marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Layers size={18} color="#4F46E5" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Productos Disponibles en Inventario ({productosConStock.length})</h3>
        </div>

        {productosConStock.length === 0 ? (
          <div style={S.emptyList}>
            <Package size={32} color="#94A3B8" />
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748B" }}>
              No hay productos con stock activo. Registra lotes en la pestaña "Escanear / Ingresar".
            </p>
          </div>
        ) : (
          <div style={S.productList}>
            {productosConStock.map((prod) => (
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
                <div style={S.stockBadge}>
                  {prod.stockTotal} un.
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
  container: {
    maxWidth: 800,
    margin: "0 auto",
  },
  card: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
  },
  cardHeader: {
    marginBottom: 20,
  },
  title: {
    fontSize: 19,
    fontWeight: 700,
    margin: 0,
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
  },
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
  clearBtn: {
    border: "none",
    background: "none",
    color: "#94A3B8",
    cursor: "pointer",
  },
  infoBoxOk: {
    backgroundColor: "#EEF2FF",
    border: "1px solid #C7D2FE",
    borderRadius: 10,
    padding: 12,
  },
  infoBoxError: {
    backgroundColor: "#FEF2F2",
    border: "1px solid #FCA5A5",
    borderRadius: 10,
    padding: 12,
  },
  prodName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#1E1B4B",
  },
  prodSub: {
    fontSize: 12,
    color: "#4338CA",
    marginTop: 2,
  },
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
  productList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
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
  stockBadge: {
    backgroundColor: "#DBEAFE",
    color: "#1E40AF",
    fontWeight: 700,
    fontSize: 13,
    padding: "4px 10px",
    borderRadius: 20,
  },
  emptyList: {
    textAlign: "center",
    padding: "24px 12px",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    border: "1px dashed #CBD5E1",
  }
};