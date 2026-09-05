"use client";

import { useEffect } from "react";

export function PrintOnMount() {
  useEffect(() => window.print(), []);
  return null;
}
