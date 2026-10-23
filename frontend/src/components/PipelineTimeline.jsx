import React from "react";

const STATUS_ICON = {
  RUNNING: "⏳",
  SUCCEEDED: "✅",
  FAILED: "❌",
  SKIPPED: "⚠️",
};

export default function PipelineTimeline({ timeline }) {
  if (timeline.length === 0) {
    return <p className="muted">Waiting for the first pipeline event…</p>;
  }

  return (
    <ol className="timeline">
      {timeline.map((e, idx) => (
        <li key={e.timestamp || idx} className={`timeline-item status-${e.status.toLowerCase()}`}>
          <span className="timeline-icon">{STATUS_ICON[e.status] || "•"}</span>
          <div className="timeline-body">
            <div className="timeline-head">
              <strong>{e.stage.replaceAll("_", " ")}</strong>
              <span className="muted small">
                {e.service}
              </span>
            </div>
            <p>{e.message}</p>
            <span className="muted small">{new Date(e.at || e.timestamp).toLocaleTimeString()}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
