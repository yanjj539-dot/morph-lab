"use client";

import { useState } from "react";
import { faqs } from "../data/site";

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="faq-list">
      {faqs.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-panel-${index}`;

        return (
          <article className="faq-item" key={item.question} data-open={isOpen}>
            <button
              className="faq-trigger"
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
            >
              <span>{item.question}</span>
              <span className="faq-mark" aria-hidden="true">+</span>
            </button>
            <div id={panelId} className="faq-panel" aria-hidden={!isOpen}>
              <div>
                <p>{item.answer}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

