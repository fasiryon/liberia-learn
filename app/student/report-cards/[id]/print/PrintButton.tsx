"use client";

export function PrintButton() {
  return (
    <div className="no-print" style={{ marginTop: "24px", textAlign: "center" }}>
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          padding: "8px 24px",
          background: "#111",
          color: "white",
          border: "none",
          borderRadius: "999px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "bold",
        }}
      >
        Print / Download
      </button>
    </div>
  );
}
