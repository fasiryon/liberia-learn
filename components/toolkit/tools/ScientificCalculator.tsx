"use client";

import { useState } from "react";

interface ScientificCalculatorProps {
  onClose?: () => void;
}

function safeEvaluateExpression(raw: string, radians: boolean): number {
  const normalized = raw
    .replace(/p/g, String(Math.PI))
    .replace(/\^/g, "**")
    .replace(/sin\(/g, radians ? "Math.sin(" : "Math.sin((Math.PI/180)*")
    .replace(/cos\(/g, radians ? "Math.cos(" : "Math.cos((Math.PI/180)*")
    .replace(/tan\(/g, radians ? "Math.tan(" : "Math.tan((Math.PI/180)*")
    .replace(/log\(/g, "Math.log10(")
    .replace(/ln\(/g, "Math.log(");

  if (!/^[0-9+\-*/%.()\s*^MathsincotaPIlgne]+$/i.test(normalized)) {
    throw new Error("invalid_expression");
  }

  const result = Function(`"use strict"; return (${normalized});`)();
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("invalid_result");
  }
  return Math.round(result * 1e10) / 1e10;
}

export default function ScientificCalculator({ onClose }: ScientificCalculatorProps) {
  const [expression, setExpression] = useState("0");
  const [mode, setMode] = useState<"DEG" | "RAD">("DEG");
  const [memory, setMemory] = useState(0);

  const push = (token: string) => {
    setExpression((prev) => (prev === "0" || prev === "Error" ? token : `${prev}${token}`));
  };

  const compute = () => {
    try {
      const value = safeEvaluateExpression(expression, mode === "RAD");
      setExpression(String(value));
    } catch {
      setExpression("Error");
    }
  };

  const unary = (fn: "sin" | "cos" | "tan" | "log" | "ln" | "square" | "cube") => {
    try {
      const x = Number(expression);
      if (!Number.isFinite(x)) throw new Error("invalid");
      let value = x;
      if (fn === "square") value = x ** 2;
      if (fn === "cube") value = x ** 3;
      if (fn === "sin") value = mode === "RAD" ? Math.sin(x) : Math.sin((x * Math.PI) / 180);
      if (fn === "cos") value = mode === "RAD" ? Math.cos(x) : Math.cos((x * Math.PI) / 180);
      if (fn === "tan") value = mode === "RAD" ? Math.tan(x) : Math.tan((x * Math.PI) / 180);
      if (fn === "log") value = Math.log10(x);
      if (fn === "ln") value = Math.log(x);
      setExpression(String(Math.round(value * 1e10) / 1e10));
    } catch {
      setExpression("Error");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-400">Mode: {mode}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Toggle degree and radian mode"
            className="rounded border border-slate-600 px-2 py-1 text-xs"
            onClick={() => setMode((prev) => (prev === "DEG" ? "RAD" : "DEG"))}
          >
            DEG/RAD
          </button>
          <button
            type="button"
            aria-label="Close scientific calculator"
            className="rounded border border-slate-600 px-2 py-1 text-xs"
            onClick={() => onClose?.()}
          >
            Close
          </button>
        </div>
      </div>

      <output aria-label="Scientific calculator display" className="block rounded border border-slate-700 bg-slate-900 px-3 py-2 text-right text-xl font-semibold">
        {expression}
      </output>

      <div className="grid grid-cols-6 gap-2 text-sm">
        <button type="button" aria-label="Clear" className="rounded bg-slate-800 p-2" onClick={() => setExpression("0")}>C</button>
        <button type="button" aria-label="Open parenthesis" className="rounded bg-slate-800 p-2" onClick={() => push("(")}>(</button>
        <button type="button" aria-label="Close parenthesis" className="rounded bg-slate-800 p-2" onClick={() => push(")")}>)</button>
        <button type="button" aria-label="Power operator" className="rounded bg-slate-800 p-2" onClick={() => push("^")}>x?</button>
        <button type="button" aria-label="Pi constant" className="rounded bg-slate-800 p-2" onClick={() => push("p")}>p</button>
        <button type="button" aria-label="Equals" className="rounded bg-emerald-700 p-2 font-semibold" onClick={compute}>=</button>

        <button type="button" aria-label="Sine" className="rounded bg-slate-800 p-2" onClick={() => unary("sin")}>sin</button>
        <button type="button" aria-label="Cosine" className="rounded bg-slate-800 p-2" onClick={() => unary("cos")}>cos</button>
        <button type="button" aria-label="Tangent" className="rounded bg-slate-800 p-2" onClick={() => unary("tan")}>tan</button>
        <button type="button" aria-label="Log base 10" className="rounded bg-slate-800 p-2" onClick={() => unary("log")}>log</button>
        <button type="button" aria-label="Natural log" className="rounded bg-slate-800 p-2" onClick={() => unary("ln")}>ln</button>
        <button type="button" aria-label="Percent" className="rounded bg-slate-800 p-2" onClick={() => push("/100")}>%</button>

        <button type="button" aria-label="Square" className="rounded bg-slate-800 p-2" onClick={() => unary("square")}>x²</button>
        <button type="button" aria-label="Cube" className="rounded bg-slate-800 p-2" onClick={() => unary("cube")}>x³</button>
        <button type="button" aria-label="M plus" className="rounded bg-slate-800 p-2" onClick={() => setMemory((m) => m + Number(expression || 0))}>M+</button>
        <button type="button" aria-label="M minus" className="rounded bg-slate-800 p-2" onClick={() => setMemory((m) => m - Number(expression || 0))}>M-</button>
        <button type="button" aria-label="Memory recall" className="rounded bg-slate-800 p-2" onClick={() => setExpression(String(memory))}>MR</button>
        <button type="button" aria-label="Memory clear" className="rounded bg-slate-800 p-2" onClick={() => setMemory(0)}>MC</button>

        {["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "+"].map((token) => (
          <button
            key={token}
            type="button"
            aria-label={`Key ${token}`}
            className="rounded bg-slate-800 p-2"
            onClick={() => push(token)}
          >
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}

