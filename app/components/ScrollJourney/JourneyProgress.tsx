import {
  JOURNEY_STAGE_PROGRESS,
  JOURNEY_STAGES,
} from "../../data/journey";

type JourneyProgressProps = {
  activeStage: number;
  onSelectStage: (index: number) => void;
};

export function JourneyProgress({
  activeStage,
  onSelectStage,
}: JourneyProgressProps) {
  return (
    <ol className="journey-progress" aria-label="Design process stages">
      {JOURNEY_STAGES.map((stage, index) => {
        const isActive = activeStage === index;
        const isComplete = index < activeStage;

        return (
          <li
            key={stage.id}
            className={`journey-progress__item${isActive ? " is-active" : ""}${
              isComplete ? " is-complete" : ""
            }`}
          >
            <button
              type="button"
              className="journey-progress__button"
              data-progress={JOURNEY_STAGE_PROGRESS[index]}
              aria-current={isActive ? "step" : undefined}
              aria-label={`${stage.label} ${stage.eyebrow}: ${stage.title}`}
              onClick={() => onSelectStage(index)}
            >
              <span>{stage.label}</span>
              <span>{stage.eyebrow}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
