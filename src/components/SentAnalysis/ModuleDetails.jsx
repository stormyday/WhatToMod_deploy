// src/components/SentAnalysis/SkeletonLoader.tsx
// src/components/SentAnalysis/ModuleDetails.tsx
import { useState } from "react";


function formatWorkload(workload) {
  if (!workload) return "—";
  const labels = ["Lecture", "Tutorial", "Lab", "Project", "Preparation"];
  if (Array.isArray(workload)) {
    return workload.map((h, i) => `${labels[i] ?? `Part ${i + 1}`}: ${h}h`).join(" · ");
  }
  // String format like "2-1-0-3-4"
  return String(workload)
    .split("-")
    .map((h, i) => `${labels[i] ?? `Part ${i + 1}`}: ${h}h`)
    .join(" · ");
}

function formatTime(t) {
  if (t.length !== 4) return t;
  return `${t.slice(0, 2)}:${t.slice(2)}`;
}

export function ModuleDetails({ module: mod }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="module-details">
      <button
        className="details-toggle"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-controls="module-details-body"
      >
        <span>Module details</span>
        <span className={`chevron${open ? " open" : ""}`}>›</span>
      </button>

      {open && (
        <div id="module-details-body" className="details-body">

          {/* Basic info grid */}
          <div className="details-grid">
            <div>
              <p className="detail-key">Credits</p>
              <p className="detail-val">{mod.moduleCredit} MCs</p>
            </div>
            <div>
              <p className="detail-key">Faculty</p>
              <p className="detail-val">{mod.faculty}</p>
            </div>
            <div>
              <p className="detail-key">Department</p>
              <p className="detail-val">{mod.department}</p>
            </div>
            <div>
              <p className="detail-key">Workload breakdown</p>
              <p className="detail-val">{formatWorkload(mod.workload)}</p>
            </div>
          </div>

          <div className="details-divider" />

          {/* Prerequisites / preclusions */}
          {(mod.prerequisite || mod.preclusion || mod.corequisite) && (
            <>
              <div className="details-reqs">
                {mod.prerequisite && (
                  <div className="req-item">
                    <p className="detail-key">Prerequisite</p>
                    <p className="detail-val prereq">{mod.prerequisite}</p>
                  </div>
                )}
                {mod.corequisite && (
                  <div className="req-item">
                    <p className="detail-key">Corequisite</p>
                    <p className="detail-val prereq">{mod.corequisite}</p>
                  </div>
                )}
                {mod.preclusion && (
                  <div className="req-item">
                    <p className="detail-key">Preclusion</p>
                    <p className="detail-val prereq">{mod.preclusion}</p>
                  </div>
                )}
              </div>
              <div className="details-divider" />
            </>
          )}

          {/* Timetable per semester */}
          {mod.semesterData.map((sem) => (
            <div key={sem.semester} className="sem-block">
              <p className="sem-label">Semester {sem.semester}</p>

              {sem.examDate && (
                <p className="exam-date">
                  Exam:{" "}
                  {new Date(sem.examDate).toLocaleDateString("en-SG", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {sem.examDuration ? ` · ${sem.examDuration} min` : ""}
                </p>
              )}

              <div className="timetable-slots">
                {/* Deduplicate by lessonType + classNo */}
                {Array.from(
                  new Map(
                    sem.timetable.map((slot) => [
                      `${slot.lessonType}-${slot.classNo}`,
                      slot,
                    ])
                  ).values()
                ).map((slot, i) => (
                  <div key={i} className="slot-pill">
                    <span className="slot-type">{slot.lessonType}</span>
                    <span className="slot-time">
                      {slot.day} {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                    </span>
                    <span className="slot-venue">{slot.venue}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Fulfils requirements */}
          {mod.fulfillRequirements && mod.fulfillRequirements.length > 0 && (
            <>
              <div className="details-divider" />
              <div>
                <p className="detail-key">Fulfils requirements for</p>
                <div className="fulfil-chips">
                  {mod.fulfillRequirements.map((code) => (
                    <span key={code} className="fulfil-chip">{code}</span>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </section>
  );
}