"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { projects } from "../data/site";

function moveProjectCursor(event: PointerEvent<HTMLAnchorElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
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
            <picture className="project-picture">
              <source srcSet={`${project.image}.avif`} type="image/avif" />
              <source srcSet={`${project.image}.webp`} type="image/webp" />
              <img
                src={`${project.image}.jpg`}
                alt={project.imageAlt}
                width={project.ratio === "portrait" ? 1200 : 1600}
                height={project.ratio === "portrait" ? 1500 : 1000}
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                data-project-image
                data-project-zoom={index === 1 ? "1.035" : "1.05"}
              />
            </picture>
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
            <ul>
              {project.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  );
}
