// MathML Core elements used by components/experience/MathText.tsx. React 18's JSX types do not declare them;
// the browser renders them natively (Chrome/Edge 109+, Firefox, Safari).
import type { DetailedHTMLProps, HTMLAttributes } from "react";

type MathMLProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { display?: "block" | "inline"; width?: string };

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      math: MathMLProps; mrow: MathMLProps; mn: MathMLProps; mi: MathMLProps; mo: MathMLProps; mtext: MathMLProps; mspace: MathMLProps;
      mfrac: MathMLProps; msqrt: MathMLProps; mroot: MathMLProps; msub: MathMLProps; msup: MathMLProps; msubsup: MathMLProps;
    }
  }
}
