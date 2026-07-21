import type { Ref } from "react";

type JourneyLabelsProps = {
  labelHostRef: Ref<HTMLDivElement>;
};

export function JourneyLabels({ labelHostRef }: JourneyLabelsProps) {
  return (
    <div
      ref={labelHostRef}
      className="scroll-journey__labels"
      aria-hidden="true"
    />
  );
}
