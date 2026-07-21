/* Static fallback URLs are already base-path-prefixed in journey data. */
/* eslint-disable @next/next/no-img-element */
import { JOURNEY_STAGES } from "../../data/journey";

export type JourneyState = "fallback" | "loading" | "ready" | "error";

type JourneyFallbackProps = {
  state: JourneyState;
};

const STATUS_COPY: Record<Exclude<JourneyState, "ready">, string> = {
  loading: "Loading the authored 3D workbench...",
  fallback: "Static scene sequence",
  error: "The real-time scene could not load. Showing the authored scene plates instead.",
};

export function JourneyFallback({ state }: JourneyFallbackProps) {
  const isLive = state === "loading" || state === "error";

  return (
    <div className="journey-fallback" aria-hidden={state === "ready"}>
      {state !== "ready" ? (
        <p
          className={`journey-fallback__status${isLive ? " is-live" : ""}`}
          role={state === "error" ? "alert" : "status"}
        >
          {STATUS_COPY[state]}
        </p>
      ) : null}

      <div className="journey-fallback__stages">
        {JOURNEY_STAGES.map((stage, index) => (
          <article
            id={`journey-stage-${stage.id}`}
            className="journey-fallback__stage"
            data-journey-fallback-stage={index}
            key={stage.id}
          >
            <figure className="journey-fallback__figure">
              <img
                src={stage.fallbackSrc}
                alt={`${stage.eyebrow} 阶段的 Blender 工作台场景`}
                width={1600}
                height={1000}
                loading={index === 0 ? "eager" : "lazy"}
              />
              <figcaption>
                <span>{stage.label}</span>
                <span>{stage.eyebrow}</span>
              </figcaption>
            </figure>

            <div className="journey-fallback__copy">
              <p>{stage.labelText}</p>
              <h3>{stage.title}</h3>
              <p>{stage.body}</p>
              <ul>
                {stage.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
