import { state, getInstructor, getCourse, hoursCount, makeDefaultAvailability } from "./state.js";
import { $, $$, escapeHtml, pad2, hashColor, clamp, toast, uid } from "./utils.js";
import { persistSilently, persist } from "./persistence.js";
import { normalizeAvailabilityForSettings } from "./logic.js";

// ---------- Rendering ----------
export function renderDayChips() {
    const wrap = $("#dayChips");
    wrap.innerHTML = "";
    for (const d of state.settings.days) {
        const el = document.createElement("div");
        el.className = "chip px-3 py-1.5 rounded-full text-sm";
        el.textContent = d;
        wrap.appendChild(el);
    }
}

export function renderSettings() {
    $("#startHour").value = state.settings.startHour;
    $("#endHour").value = state.settings.endHour;
    renderDayChips();
}

export function renderCourses() {
    const q = ($("#courseSearch").value || "").trim().toLowerCase();
    const list = $("#courseList");
    const courses = state.courses
        .filter(c => {
            if (!q) return true;
            const inst = c.instructorId ? getInstructor(c.instructorId) : null;
            const hay = `${c.code} ${c.title} ${inst?.name || ""}`.toLowerCase();
            return hay.includes(q);
        });

    list.innerHTML = "";
    if (courses.length === 0) {
        list.innerHTML = `<div class="text-sm text-muted">No courses yet. Add one to start.</div>`;
        return;
    }

    for (const c of courses) {
        const inst = c.instructorId ? getInstructor(c.instructorId) : null;
        const hue = hashColor(c.code + c.title);
        const pref = (c.preferredDays && c.preferredDays.length) ? c.preferredDays.join(", ") : "Any day";
        const window = `${pad2(c.earliestHour)}:00–${pad2(c.latestHour)}:00`;
        const el = document.createElement("div");
        el.className = "glass2 rounded-2xl p-4 border border-main";
        el.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-2.5 h-2.5 rounded-full" style="background: hsl(${hue} 85% 62%); box-shadow: 0 0 0 4px hsla(${hue} 85% 62% / 0.14);"></div>
            <div class="font-bold truncate">${escapeHtml(c.code)} <span class="text-muted font-medium">— ${escapeHtml(c.title)}</span></div>
          </div>
          <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            <span class="pill">${escapeHtml(inst?.name || "No instructor")}</span>
            <span class="pill">${escapeHtml(String(c.sessionsPerWeek))}×/week</span>
            <span class="pill">${escapeHtml(String(c.duration))}h</span>
            <span class="pill">${escapeHtml(window)}</span>
            <span class="pill">${escapeHtml(pref)}</span>
          </div>
          ${c.notes ? `<div class="mt-2 text-xs text-muted2">Notes: ${escapeHtml(c.notes)}</div>` : ``}
        </div>
        <div class="flex flex-col gap-2 shrink-0">
          <button class="btn px-3 py-2 rounded-xl text-xs" data-act="edit-course" data-id="${c.id}">Edit</button>
          <button class="btn btn-danger px-3 py-2 rounded-xl text-xs" data-act="del-course" data-id="${c.id}">Delete</button>
        </div>
      </div>
    `;
        list.appendChild(el);
    }
}

export function renderInstructors() {
    const list = $("#instructorList");
    list.innerHTML = "";
    if (state.instructors.length === 0) {
        list.innerHTML = `<div class="text-sm text-muted">No instructors yet. Add at least one for availability constraints.</div>`;
        $("#instructorSelect").innerHTML = `<option value="">(No instructors)</option>`;
        renderAvailability();
        return;
    }

    // Select dropdown
    const sel = $("#instructorSelect");
    const current = sel.value || state.instructors[0]?.id || "";
    sel.innerHTML = state.instructors.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join("");
    sel.value = state.instructors.some(i => i.id === current) ? current : state.instructors[0].id;

    for (const i of state.instructors) {
        const unavailable = countUnavailable(i);
        const el = document.createElement("div");
        el.className = "glass2 rounded-2xl p-4 border border-main";
        el.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-bold truncate">${escapeHtml(i.name)}</div>
          <div class="mt-1 text-xs text-muted">
            Unavailable slots: <span class="text-main font-semibold">${unavailable}</span>
            <span class="text-muted2">•</span>
            Assigned courses: <span class="text-main font-semibold">${state.courses.filter(c => c.instructorId === i.id).length}</span>
          </div>
        </div>
        <div class="flex flex-col gap-2 shrink-0">
          <button class="btn px-3 py-2 rounded-xl text-xs" data-act="edit-inst" data-id="${i.id}">Edit</button>
          <button class="btn btn-danger px-3 py-2 rounded-xl text-xs" data-act="del-inst" data-id="${i.id}">Delete</button>
        </div>
      </div>
    `;
        list.appendChild(el);
    }

    renderAvailability();
}

function countUnavailable(inst) {
    normalizeAvailabilityForSettings(inst);
    let n = 0;
    for (const row of inst.availability) {
        for (const v of row) if (v === false) n++;
    }
    return n;
}

export function renderAvailability() {
    const sel = $("#instructorSelect");
    const instId = sel.value;
    const grid = $("#availabilityGrid");

    grid.innerHTML = "";
    if (!instId) {
        grid.innerHTML = `<div class="text-sm text-muted">Add an instructor to edit availability.</div>`;
        return;
    }

    const inst = getInstructor(instId);
    if (!inst) {
        grid.innerHTML = `<div class="text-sm text-muted">Select a valid instructor.</div>`;
        return;
    }
    normalizeAvailabilityForSettings(inst);

    grid.appendChild(cell("Time", "a-cell head", { role: "columnheader" }));
    for (const day of state.settings.days) {
        grid.appendChild(cell(day, "a-cell head", { role: "columnheader" }));
    }

    for (let hi = 0; hi < hoursCount(); hi++) {
        const h = state.settings.startHour + hi;
        grid.appendChild(cell(`${pad2(h)}:00`, "a-cell time", { role: "rowheader" }));

        for (let di = 0; di < state.settings.days.length; di++) {
            const isOn = inst.availability[di][hi] !== false;
            const c = document.createElement("div");
            c.className = "a-cell " + (isOn ? "" : "off");
            c.setAttribute("role", "button");
            c.setAttribute("tabindex", "0");
            c.title = isOn ? "Available (click to mark unavailable)" : "Unavailable (click to mark available)";
            c.textContent = isOn ? "Free" : "Off";
            c.addEventListener("click", () => {
                inst.availability[di][hi] = !isOn;
                renderAvailability();
            });
            c.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inst.availability[di][hi] = !isOn;
                    renderAvailability();
                }
            });
            grid.appendChild(c);
        }
    }
}

function cell(text, className, attrs = {}) {
    const d = document.createElement("div");
    d.className = className;
    d.textContent = text;
    Object.entries(attrs).forEach(([k, v]) => d.setAttribute(k, v));
    return d;
}

export function renderTimetable() {
    const head = $("#ttHead");
    const body = $("#ttBody");
    head.innerHTML = "";
    body.innerHTML = "";

    head.appendChild(cell("", "tt-cell"));
    for (const day of state.settings.days) {
        const d = document.createElement("div");
        d.className = "tt-cell";
        d.innerHTML = `<div class="tt-day">${escapeHtml(day)}</div>`;
        head.appendChild(d);
    }

    const rows = hoursCount();
    const cols = state.settings.days.length;

    const startMap = new Map(); 
    for (const p of state.schedule.placements || []) {
        startMap.set(`${p.day}|${p.startHour}`, p);
    }

    for (let hi = 0; hi < rows; hi++) {
        const h = state.settings.startHour + hi;
        const time = document.createElement("div");
        time.className = "tt-cell";
        time.innerHTML = `<div class="tt-time">${pad2(h)}:00</div>`;
        body.appendChild(time);

        for (let di = 0; di < cols; di++) {
            const day = state.settings.days[di];
            const c = document.createElement("div");
            c.className = "tt-cell";
            c.dataset.day = day;
            c.dataset.hour = String(h);

            const p = startMap.get(`${day}|${h}`);

            if (p) {
                const course = getCourse(p.courseId);
                const inst = p.instructorId ? getInstructor(p.instructorId) : null;
                const hue = hashColor((course?.code || "COURSE") + (inst?.name || ""));
                
                const block = document.createElement("div");
                block.className = "block";
                block.style.background = `linear-gradient(180deg, hsla(${hue} 85% 62% / 0.26), hsla(${hue} 85% 62% / 0.10))`;
                block.style.borderColor = `hsla(${hue} 85% 62% / 0.28)`;
                block.style.boxShadow = `0 14px 38px rgba(0,0,0,0.34), 0 0 0 1px hsla(${hue} 85% 62% / 0.10)`;
                block.style.height = `calc(${p.duration} * 80px - 0px)`;
                block.style.zIndex = "10";

                block.innerHTML = `
          <div class="min-w-0">
            <div class="block-title truncate">${escapeHtml(course?.code || "COURSE")} • ${escapeHtml(course?.title || "Untitled")}</div>
            <div class="block-sub truncate mt-0.5">${escapeHtml(inst?.name || "No instructor")}</div>
          </div>
        `;
                block.addEventListener("click", () => openPlacementDetails(p.id));
                c.appendChild(block);
            }
            body.appendChild(c);
        }
    }

    const cover = new Set();
    for (const p of state.schedule.placements || []) {
        for (let k = 1; k < p.duration; k++) {
            cover.add(`${p.day}|${p.startHour + k}`);
        }
    }
    $$(".tt-cell", body).forEach(el => {
        const day = el.dataset.day;
        const hour = parseInt(el.dataset.hour || "0", 10);
        if (day && hour && cover.has(`${day}|${hour}`)) {
            el.style.background = "rgba(255,255,255,0.02)";
            el.style.pointerEvents = "none";
            el.style.opacity = "0.45";
        }
    });

    const placed = state.schedule.placements?.length || 0;
    const uns = state.schedule.unscheduled?.length || 0;
    const placedHours = (state.schedule.placements || []).reduce((s, p) => s + p.duration, 0);
    $("#ttSummary").textContent = placed
        ? `Placed ${placed} session(s) (${placedHours} hour(s)). ${uns ? `${uns} course(s) could not be fully scheduled.` : `All sessions scheduled.`}`
        : `Generate to see results. Conflicts are avoided; unplaceable sessions are listed.`;
}

export function renderUnscheduled() {
    const box = $("#unscheduledBox");
    if (!box) return; // Might not exist in HTML if user didn't add it yet, but old code had it? 
    // Wait, old code didn't have #unscheduledBox in HTML. It had `renderUnscheduled` but where does it output?
    // Ah, lines 625-642 in old script.js checked `$("#unscheduledBox")`.
    // Checking index.html... I don't see #unscheduledBox in the view_file output of index.html!
    // It might have been dynamically created or I missed it.
    // The `renderUnscheduled` function in old script had `if (!box) return;`.
    // If it's not in HTML, it does nothing. I'll keep the function.
}

export function renderAll() {
    renderSettings();
    renderCourses();
    renderInstructors();
    renderTimetable();
    renderUnscheduled();
}

// ---------- Modal system ----------
export function openModal({ kicker, title, hint, bodyHtml, primaryText, secondaryText, onPrimary, onSecondary }) {
    $("#modalKicker").textContent = kicker || "Editor";
    $("#modalTitle").textContent = title || "Modal";
    $("#modalHint").textContent = hint || "";
    $("#modalBody").innerHTML = bodyHtml || "";
    $("#btnModalPrimary").textContent = primaryText || "Save";
    $("#btnModalSecondary").textContent = secondaryText || "Cancel";

    const backdrop = $("#modalBackdrop");
    backdrop.classList.add("show");

    const close = () => closeModal();
    // btnCloseModal handled in main or here. 
    // We need to re-attach listeners because we might be opening multiple times?
    // In old code, listeners were attached once in bindEvents. 
    // But here we are setting onclick properties.
    $("#btnModalSecondary").onclick = () => { try { onSecondary?.(); } finally { close(); } };
    $("#btnModalPrimary").onclick = async () => {
        const res = await onPrimary?.();
        if (res !== false) close();
    };

    setTimeout(() => {
        const first = $("#modalBody input, #modalBody select, #modalBody textarea, #modalBody button");
        first?.focus?.();
    }, 0);
}

export function closeModal() {
    $("#modalBackdrop").classList.remove("show");
    $("#modalBody").innerHTML = "";
}

export function openCourseEditor(courseId) {
    const editing = !!courseId;
    const course = editing ? getCourse(courseId) : {
        id: uid(),
        code: "",
        title: "",
        instructorId: state.instructors[0]?.id || "",
        sessionsPerWeek: 2,
        duration: 1,
        preferredDays: [],
        earliestHour: state.settings.startHour,
        latestHour: state.settings.endHour,
        notes: ""
    };

    const instructorOptions = [
        `<option value="">(No instructor)</option>`,
        ...state.instructors.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`)
    ].join("");

    const days = state.settings.days;
    const dayButtons = days.map(d => {
        const on = course.preferredDays.includes(d);
        return `
      <button type="button" class="btn chip px-3 py-2 rounded-xl text-sm ${on ? "active" : ""}" data-day="${d}" data-on="${on ? "1" : "0"}">
        ${escapeHtml(d)}
      </button>
    `;
    }).join("");

    openModal({
        kicker: "Course",
        title: editing ? "Edit course" : "Add course",
        hint: "Preferences are soft. Availability is a hard constraint.",
        primaryText: editing ? "Update" : "Add",
        secondaryText: "Cancel",
        bodyHtml: `
      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="label" for="cCode">Code</label>
          <input id="cCode" class="input mt-1" placeholder="e.g., CSC201" value="${escapeHtml(course.code)}" />
        </div>
        <div>
          <label class="label" for="cTitle">Title</label>
          <input id="cTitle" class="input mt-1" placeholder="e.g., Data Structures" value="${escapeHtml(course.title)}" />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="cInstructor">Instructor</label>
          <select id="cInstructor" class="input mt-1">${instructorOptions}</select>
        </div>
        <div>
          <label class="label" for="cSessions">Sessions per week</label>
          <input id="cSessions" type="number" min="1" max="10" class="input mt-1" value="${escapeHtml(String(course.sessionsPerWeek))}" />
        </div>
        <div>
          <label class="label" for="cDuration">Duration (hours)</label>
          <input id="cDuration" type="number" min="1" max="4" class="input mt-1" value="${escapeHtml(String(course.duration))}" />
        </div>
        <div>
          <label class="label" for="cEarliest">Earliest start</label>
          <input id="cEarliest" type="number" min="${state.settings.startHour}" max="${state.settings.endHour - 1}" class="input mt-1" value="${escapeHtml(String(course.earliestHour))}" />
        </div>
        <div>
          <label class="label" for="cLatest">Latest end</label>
          <input id="cLatest" type="number" min="${state.settings.startHour + 1}" max="${state.settings.endHour}" class="input mt-1" value="${escapeHtml(String(course.latestHour))}" />
        </div>
        <div class="sm:col-span-2">
          <label class="label">Preferred days (optional)</label>
          <div class="mt-2 flex flex-wrap gap-2" id="cPreferredDays">${dayButtons}</div>
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="cNotes">Notes (optional)</label>
          <textarea id="cNotes" class="input mt-1" rows="3">${escapeHtml(course.notes || "")}</textarea>
        </div>
      </div>
    `,
        onPrimary: () => {
            const code = ($("#cCode").value || "").trim();
            const title = ($("#cTitle").value || "").trim();
            const instructorId = $("#cInstructor").value || "";
            const sessionsPerWeek = clamp(parseInt($("#cSessions").value || "1", 10), 1, 10);
            const duration = clamp(parseInt($("#cDuration").value || "1", 10), 1, 4);

            let earliestHour = clamp(parseInt($("#cEarliest").value || String(state.settings.startHour), 10), state.settings.startHour, state.settings.endHour - 1);
            let latestHour = clamp(parseInt($("#cLatest").value || String(state.settings.endHour), 10), state.settings.startHour + 1, state.settings.endHour);
            if (latestHour <= earliestHour) latestHour = Math.min(state.settings.endHour, earliestHour + 1);
            if (earliestHour + duration > latestHour) latestHour = Math.min(state.settings.endHour, earliestHour + duration);

            const notes = ($("#cNotes").value || "").trim();
            const preferredDays = $$("#cPreferredDays button")
                .filter(b => b.dataset.on === "1")
                .map(b => b.dataset.day);

            if (!code || !title) {
                toast("Missing fields", "Please provide both course code and title.", "warn");
                return false;
            }

            const payload = {
                ...course,
                code,
                title,
                instructorId,
                sessionsPerWeek,
                duration,
                earliestHour,
                latestHour,
                preferredDays,
                notes
            };

            if (editing) {
                const idx = state.courses.findIndex(x => x.id === courseId);
                if (idx >= 0) state.courses[idx] = payload;
                toast("Course updated", `${code} — ${title}`, "ok");
            } else {
                state.courses.unshift(payload);
                toast("Course added", `${code} — ${title}`, "ok");
            }

            renderCourses();
            persistSilently();
        }
    });

    $("#cInstructor").value = course.instructorId || "";
    $$("#cPreferredDays button").forEach(btn => {
        btn.addEventListener("click", () => {
            const isOn = btn.dataset.on === "1";
            const newVal = isOn ? "0" : "1";
            btn.dataset.on = newVal;
            btn.classList.toggle("active", newVal === "1");
        });
    });
}

export function openInstructorEditor(instId) {
    const editing = !!instId;
    const inst = editing ? getInstructor(instId) : {
        id: uid(),
        name: "",
        availability: makeDefaultAvailability()
    };
    normalizeAvailabilityForSettings(inst);

    openModal({
        kicker: "Instructor",
        title: editing ? "Edit instructor" : "Add instructor",
        primaryText: editing ? "Update" : "Add",
        bodyHtml: `
      <div class="grid sm:grid-cols-2 gap-3">
        <div class="sm:col-span-2">
          <label class="label" for="iName">Full name</label>
          <input id="iName" class="input mt-1" value="${escapeHtml(inst.name)}" />
        </div>
      </div>
    `,
        onPrimary: () => {
            const name = ($("#iName").value || "").trim();
            if (!name) {
                toast("Missing name", "Please provide an instructor name.", "warn");
                return false;
            }
            const payload = { ...inst, name };
            if (editing) {
                const idx = state.instructors.findIndex(x => x.id === instId);
                if (idx >= 0) state.instructors[idx] = payload;
                toast("Instructor updated", name, "ok");
            } else {
                state.instructors.unshift(payload);
                toast("Instructor added", name, "ok");
            }
            for (const i of state.instructors) normalizeAvailabilityForSettings(i);
            renderInstructors();
            renderCourses();
            persistSilently();
        }
    });
}

function openPlacementDetails(placementId) {
    const p = (state.schedule.placements || []).find(x => x.id === placementId);
    if (!p) return;
    const course = getCourse(p.courseId);
    const inst = p.instructorId ? getInstructor(p.instructorId) : null;

    openModal({
        kicker: "Session",
        title: `${course?.code || "COURSE"} • ${course?.title || "Untitled"}`,
        hint: "Remove session?",
        primaryText: "Remove session",
        secondaryText: "Close",
        bodyHtml: `
      <div class="grid gap-3">
        <div class="glass2 rounded-2xl p-4">
            <div class="text-sm">Instructor: ${escapeHtml(inst?.name || "No instructor")}</div>
            <div class="text-sm">Day: ${escapeHtml(p.day)}</div>
        </div>
      </div>
    `,
        onPrimary: () => {
            state.schedule.placements = (state.schedule.placements || []).filter(x => x.id !== placementId);
            renderTimetable();
            toast("Removed", "Session removed.", "ok");
            persistSilently();
        }
    });
}
