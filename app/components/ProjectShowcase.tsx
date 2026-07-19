"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { projects, workflowSteps } from "../data/site";

function moveProjectCursor(event: PointerEvent<HTMLAnchorElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
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
export function ProjectShowcase({ limit }: { limit?: number }) {
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
              <div className="project-gallery" data-gallery-count={project.assets.length}>
                {project.assets.map((asset, assetIndex) => (
                  <picture
                    className={`project-picture project-picture--${asset.tone ?? "paper"}`}
                    key={asset.src}
                  >
                    <img
                      src={asset.src}
                      alt={asset.alt}
                      width={asset.width}
                      height={asset.height}
                      loading={index === 0 && assetIndex === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 && assetIndex === 0 ? "high" : "auto"}
                      data-project-image
                      data-project-zoom={assetIndex === 0 ? "1.035" : "1.02"}
                    />
                  </picture>
                ))}
              </div>
            ) : (
              <WorkflowDiagram />
            )}
            <Link
              className="project-cursor"
              href={`/work#${project.id}`}
              aria-label={`View ${project.title} case study`}
              onPointerMove={moveProjectCursor}
            >
              <span>View case study</span>
            </Link>
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
