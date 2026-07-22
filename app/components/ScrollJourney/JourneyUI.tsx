import { JOURNEY_STAGES } from "../../data/journey";
import type { JourneyState } from "./JourneyFallback";

type JourneyUIProps = {
  activeStage: number;
  state: JourneyState;
};

export function JourneyUI({ activeStage, state }: JourneyUIProps) {
  const stage = JOURNEY_STAGES[activeStage] ?? JOURNEY_STAGES[0];

  return (
    <>
      <div className="scroll-journey__intro">
        <p className="section-kicker">FOUR-STAGE JOURNEY</p>
        <h2 id="journey-title">From raw material to a working release.</h2>
        <p>
          The process stays quiet on purpose: observe the real inputs, structure the
          system, prototype the interaction, then ship the result.
        </p>
      </div>

      <div
        className="journey-ui__stage-copy"
        aria-hidden={state !== "ready" && state !== "loading"}
        aria-live="polite"
      >
        <p>{stage.labelText}</p>
        <h3>{stage.title}</h3>
        <p>{stage.body}</p>
        <ul>
          {stage.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
