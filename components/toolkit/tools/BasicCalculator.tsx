"use client";

import { useEffect, useState } from "react";

interface BasicCalculatorProps {
  onClose?: () => void;
}

type Operator = "+" | "-" | "*" | "/" | null;

function trimDisplay(value: string): string {
  if (value.length <= 12) return value;
  return value.slice(0, 12);
}

export function backspaceDisplay(value: string): string {
  if (!value || value === "Error") return "0";
  const next = value.slice(0, -1);
  return next.length > 0 ? next : "0";
}

export function clearDisplay(): string {
  return "0";
}

export function formatDisplayNumber(value: number): string {
  if (!Number.isFinite(value)) return "Error";
  const rounded = Math.round(value * 1e10) / 1e10;
  return trimDisplay(String(rounded));
}

export function computeBasicOperation(a: number, b: number, op: Exclude<Operator, null>): number {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (op === "/") {
    if (b === 0) throw new Error("divide_by_zero");
    return a / b;
  }
  return b;
}

export function applyPercentToBase(base: number, percent: number): number {
  return (base * percent) / 100;
}

export default function BasicCalculator({ onClose }: BasicCalculatorProps) {
  const [display, setDisplay] = useState("0");
  const [runningTotal, setRunningTotal] = useState<string>("");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const clearAll = () => {
    setDisplay("0");
    setRunningTotal("");
    setAccumulator(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const appendDigit = (digit: string) => {
    if (display === "Error") {
      setDisplay(digit);
      return;
    }
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }

    const next = display === "0" && digit !== "." ? digit : `${display}${digit}`;
    setDisplay(trimDisplay(next));
  };

  const applyOperator = (nextOperator: Exclude<Operator, null>) => {
    const current = Number(display);
    if (!Number.isFinite(current)) {
      setDisplay("Error");
      return;
    }

    if (accumulator == null) {
      setAccumulator(current);
      setRunningTotal(formatDisplayNumber(current));
    } else if (operator) {
      try {
        const result = computeBasicOperation(accumulator, current, operator);
        const formatted = formatDisplayNumber(result);
        if (formatted === "Error") throw new Error("invalid");
        setAccumulator(Number(formatted));
        setDisplay(formatted);
        setRunningTotal(formatted);
      } catch {
        setDisplay("Error");
        setRunningTotal("Error");
        setAccumulator(null);
        setOperator(null);
        return;
      }
    }

    setOperator(nextOperator);
    setWaitingForOperand(true);
  };

  const applyEquals = () => {
    if (operator == null || accumulator == null) return;
    const current = Number(display);
    try {
      const result = computeBasicOperation(accumulator, current, operator);
      const formatted = formatDisplayNumber(result);
      if (formatted === "Error") throw new Error("invalid");
      setDisplay(formatted);
      setRunningTotal(formatted);
      setAccumulator(null);
      setOperator(null);
      setWaitingForOperand(true);
    } catch {
      setDisplay("Error");
      setRunningTotal("Error");
      setAccumulator(null);
      setOperator(null);
    }
  };

  const applyPercent = () => {
    const current = Number(display);
    if (!Number.isFinite(current)) {
      setDisplay("Error");
      return;
    }
    if (accumulator != null && operator != null) {
      const next = applyPercentToBase(accumulator, current);
      setDisplay(formatDisplayNumber(next));
      return;
    }
    setDisplay(formatDisplayNumber(current / 100));
  };

  const backspace = () => {
    if (display === "Error" || waitingForOperand) {
      setDisplay("0");
      setWaitingForOperand(false);
      return;
    }
    setDisplay(backspaceDisplay(display));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (/^[0-9]$/.test(key)) appendDigit(key);
      else if (key === ".") appendDigit(".");
      else if (key === "+") applyOperator("+");
      else if (key === "-") applyOperator("-");
      else if (key === "*") applyOperator("*");
      else if (key === "/") applyOperator("/");
      else if (key === "%") applyPercent();
      else if (key === "Enter" || key === "=") applyEquals();
      else if (key === "Backspace") backspace();
      else if (key === "Escape") clearAll();
      else return;
      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const buttons = [
    ["7", "8", "9", "/"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "%", "+"],
  ] as const;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-[var(--ll-text-muted)]">Running Total: {runningTotal || "-"}</p>
        <button
          type="button"
          aria-label="Close basic calculator"
          className="rounded border border-[var(--ll-border)] px-2 py-1 text-xs"
          onClick={() => onClose?.()}
        >
          Close
        </button>
      </div>

      <output
        aria-label="Calculator display"
        className="block rounded border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-right text-2xl font-semibold"
      >
        {display}
      </output>

      <div className="grid grid-cols-4 gap-2">
        <button type="button" aria-label="Clear" className="rounded bg-[var(--ll-surface)] p-2" onClick={clearAll}>C</button>
        <button type="button" aria-label="Backspace" className="rounded bg-[var(--ll-surface)] p-2" onClick={backspace}>?</button>
        <button type="button" aria-label="Equals" className="col-span-2 rounded bg-[var(--ll-yellow-soft)] p-2 font-semibold" onClick={applyEquals}>=</button>

        {buttons.flat().map((token) => {
          const isOperator = ["+", "-", "*", "/"].includes(token);
          return (
            <button
              key={token}
              type="button"
              aria-label={`Key ${token}`}
              className={`rounded p-2 ${isOperator ? "bg-sky-700" : "bg-[var(--ll-surface)]"}`}
              onClick={() => {
                if (token === ".") {
                  if (!display.includes(".")) appendDigit(".");
                  return;
                }
                if (token === "%") {
                  applyPercent();
                  return;
                }
                if (isOperator) {
                  applyOperator(token as Exclude<Operator, null>);
                  return;
                }
                appendDigit(token);
              }}
            >
              {token}
            </button>
          );
        })}
      </div>
    </div>
  );
}
