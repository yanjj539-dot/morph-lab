"use client";

import {
  Atom,
  Code2,
  FlaskConical,
  MousePointer2,
  ScanLine,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { capabilities } from "../data/site";

const icons = {
  direction: ScanLine,
  interaction: MousePointer2,
  identity: Atom,
  frontend: Code2,
  workflow: Workflow,
  prototype: FlaskConical,
};

export function CapabilityAccordion() {
  const [openId, setOpenId] = useState<string | null>(capabilities[0]?.id ?? null);

  return (
    <div className="capability-list">
      {capabilities.map((item) => {
        const isOpen = openId === item.id;
        const Icon = icons[item.icon];
        const panelId = `capability-panel-${item.id}`;

        return (
          <article className="capability-item" key={item.id} data-open={isOpen}>
            <button
              type="button"
              className="capability-trigger"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : item.id)}
            >
              <span className="capability-index">{item.index}</span>
              <span className="capability-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.35} />
              </span>
              <span className="capability-name">
                <strong>{item.title}</strong>
                <small>{item.titleZh}</small>
              </span>
              <span className="capability-summary">{item.description}</span>
              <span className="capability-mark" aria-hidden="true">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            <div
              id={panelId}
              className="capability-panel"
              aria-hidden={!isOpen}
            >
              <div>
                <p>{item.detail}</p>
                <ul aria-label={`${item.title} technical tags`}>
                  {item.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

