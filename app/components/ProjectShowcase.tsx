"use client";

import type { PointerEvent } from "react";
import { projects, workflowSteps } from "../data/site";
import { withBasePath } from "../lib/paths";

function moveProjectCursor(event: PointerEvent<HTMLAnchorElement>) {
  if (
    event.pointerType !== "mouse" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const visual = event.currentTarget.closest<HTMLElement>(".project-visual-wrap");
  const normalizedX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  const normalizedY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

  event.currentTarget.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
  visual?.style.setProperty("--project-shift-x", `${normalizedX * 1.2}%`);
  visual?.style.setProperty("--project-shift-y", `${normalizedY * 1.2}%`);
}

function resetProjectCursor(event: PointerEvent<HTMLAnchorElement>) {
  const visual = event.currentTarget.closest<HTMLElement>(".project-visual-wrap");
  visual?.style.setProperty("--project-shift-x", "0%");
  visual?.style.setProperty("--project-shift-y", "0%");
}

function WorkflowDiagram() {
  return (
    <div className="workflow-diagram" aria-label="AI design workflow from materials to release">
      {workflowSteps.map((step, index) => (
        <div className="workflow-node" key={step}>
          <span className="workflow-node__index">{String(index + 1).padStart(2, "0")}</span>
          <span className="workflow-node__label">{step}</span>
        </div>
      ))}
      <div className="workflow-review">
        <span>Quality gate</span>
        <p>Human judgement stays in the loop before every release.</p>
      </div>
    </div>
  );
}
type ProjectShowcaseProps = {
  limit?: number;
  prioritizeFirstImage?: boolean;
};

export function ProjectShowcase({
  limit,
  prioritizeFirstImage = true,
}: ProjectShowcaseProps) {
  const visibleProjects = typeof limit === "number" ? projects.slice(0, limit) : projects;

  return (
    <div className="project-list">
      {visibleProjects.map((project, index) => (
        <article
          className={`project-item project-item--${project.ratio}`}
          key={project.id}
          id={project.id}
        >
          <div className="project-visual-wrap">
            {project.assets.length > 0 ? (
              <div
                className="project-gallery"
                data-gallery-count={project.assets.length}
                data-project-visual
              >
                {project.assets.map((asset, assetIndex) => {
                  const shouldPrioritize = prioritizeFirstImage && index === 0 && assetIndex === 0;

                  return (
                    <picture
                      className={[
                        `project-picture project-picture--${asset.tone ?? "paper"}`,
                        `project-picture--${asset.kind ?? "screenshot"}`,
                      ].join(" ")}
                      key={asset.src}
                      data-project-mask
                    >
                      <img
                        src={asset.src}
                        alt={asset.alt}
                        width={asset.width}
                        height={asset.height}
                        loading={shouldPrioritize ? "eager" : "lazy"}
                        fetchPriority={shouldPrioritize ? "high" : "auto"}
                        data-project-image
                        data-project-zoom={assetIndex === 0 ? "1.025" : "1.015"}
                      />
                    </picture>
                  );
                })}
              </div>
            ) : (
              <WorkflowDiagram />
            )}
            <a
              className="project-cursor"
              href={withBasePath(`/work#${project.id}`)}
              aria-label={`View ${project.title} case study`}
              data-page-transition
              onPointerMove={moveProjectCursor}
              onPointerLeave={resetProjectCursor}
            >
              <span className="project-cursor__label">View case study</span>
              <span className="project-hover-meta" aria-hidden="true">
                <span>{project.status}</span>
                <span>{project.year}</span>
                <span>{project.role}</span>
              </span>
            </a>
          </div>
          <div className="project-copy" data-motion-reveal>
            <div className="project-meta">
              <span>{project.index}</span>
              <span>{project.year}</span>
            </div>
            <h3>{project.title}</h3>
            <p className="project-subtitle">{project.subtitle}</p>
            <p className="project-description">{project.description}</p>
            <ul className="project-services" aria-label={`${project.title} disciplines`}>
              {project.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
            <ul className="project-evidence" aria-label={`${project.title} real project evidence`}>
              {project.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  );
}
