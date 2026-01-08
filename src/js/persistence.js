import { state, getInstructor, getCourse, hoursCount, makeDefaultAvailability, DEFAULT_DAYS, STORAGE_KEY } from "./state.js";
import { toast, uid, clamp, downloadText, pad2 } from "./utils.js";

// ---------- Persistence ----------
export function persistSilently() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { }
}

export function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        toast("Saved", "Stored to this browser (local storage).", "ok");
    } catch (e) {
        toast("Save failed", "Local storage is unavailable (private mode or storage full).", "danger");
    }
}

export function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object") return false;

        // Shallow merge with defaults
        state.version = data.version ?? 1;
        if (data.settings) {
            state.settings.days = Array.isArray(data.settings.days) ? data.settings.days.slice(0, 5) : [...DEFAULT_DAYS];
            state.settings.startHour = parseInt(data.settings.startHour ?? 8, 10);
            state.settings.endHour = parseInt(data.settings.endHour ?? 18, 10);
        }

        state.instructors = Array.isArray(data.instructors) ? data.instructors : [];
        state.courses = Array.isArray(data.courses) ? data.courses : [];
        state.schedule = data.schedule && typeof data.schedule === "object" ? data.schedule : { placements: [], unscheduled: [] };

        // Normalize
        state.settings.days = [...DEFAULT_DAYS]; // keep view fixed to Mon-Fri for now
        state.settings.startHour = clamp(state.settings.startHour, 6, 12);
        state.settings.endHour = clamp(state.settings.endHour, 13, 22);
        if (state.settings.endHour <= state.settings.startHour + 1) state.settings.endHour = state.settings.startHour + 9;

        // Need logic to normalize availability, but that is in logic.js
        // We will do a robust check here or in main after load.
        // For now, let's just leave it raw and let main fix it "normalizeAvailabilityForSettings"
        
        // Ensure course fields...
        for (const c of state.courses) {
            c.id ||= uid();
            c.title ||= "Untitled";
            c.code ||= "COURSE";
            c.instructorId ||= "";
            c.sessionsPerWeek = clamp(parseInt(c.sessionsPerWeek ?? 2, 10), 1, 10);
            c.duration = clamp(parseInt(c.duration ?? 1, 10), 1, 4);
            c.preferredDays = Array.isArray(c.preferredDays) ? c.preferredDays : [];
            c.earliestHour = clamp(parseInt(c.earliestHour ?? state.settings.startHour, 10), state.settings.startHour, state.settings.endHour - 1);
            c.latestHour = clamp(parseInt(c.latestHour ?? state.settings.endHour, 10), state.settings.startHour + 1, state.settings.endHour);
            c.notes ||= "";
        }

        // Remove placements if out of range
        const validDays = new Set(state.settings.days);
        state.schedule.placements = Array.isArray(state.schedule.placements) ? state.schedule.placements : [];
        state.schedule.placements = state.schedule.placements.filter(p =>
            validDays.has(p.day) &&
            p.startHour >= state.settings.startHour &&
            p.startHour + p.duration <= state.settings.endHour
        );

        return true;
    } catch (e) {
        return false;
    }
}

// ---------- Import/Export ----------
export function importJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(String(reader.result || ""));
                if (!data || typeof data !== "object") throw new Error("Invalid JSON");
                // Basic validation
                if (!data.settings || !Array.isArray(data.courses) || !Array.isArray(data.instructors)) throw new Error("Missing required fields");
                
                // Replace state
                state.version = data.version ?? 1;
                state.settings.startHour = clamp(parseInt(data.settings.startHour ?? 8, 10), 6, 12);
                state.settings.endHour = clamp(parseInt(data.settings.endHour ?? 18, 10), 13, 22);
                state.settings.days = [...DEFAULT_DAYS]; 
                
                state.instructors = data.instructors.map(i => ({
                    id: i.id || uid(),
                    name: String(i.name || "Instructor"),
                    availability: i.availability
                }));
                // normalization happens in main or logic

                state.courses = data.courses.map(c => ({
                    id: c.id || uid(),
                    code: String(c.code || "COURSE"),
                    title: String(c.title || "Untitled"),
                    instructorId: String(c.instructorId || ""),
                    sessionsPerWeek: clamp(parseInt(c.sessionsPerWeek ?? 2, 10), 1, 10),
                    duration: clamp(parseInt(c.duration ?? 1, 10), 1, 4),
                    preferredDays: Array.isArray(c.preferredDays) ? c.preferredDays.filter(d => DEFAULT_DAYS.includes(d)) : [],
                    earliestHour: clamp(parseInt(c.earliestHour ?? state.settings.startHour, 10), state.settings.startHour, state.settings.endHour - 1),
                    latestHour: clamp(parseInt(c.latestHour ?? state.settings.endHour, 10), state.settings.startHour + 1, state.settings.endHour),
                    notes: String(c.notes || "")
                }));

                state.schedule = data.schedule && typeof data.schedule === "object"
                    ? { placements: Array.isArray(data.schedule.placements) ? data.schedule.placements : [], unscheduled: Array.isArray(data.schedule.unscheduled) ? data.schedule.unscheduled : [] }
                    : { placements: [], unscheduled: [] };
                
                // normalize placements
                const validDays = new Set(state.settings.days);
                state.schedule.placements = (state.schedule.placements || []).filter(p => validDays.has(p.day))
                    .map(p => ({
                        id: p.id || uid(),
                        courseId: String(p.courseId || ""),
                        instructorId: String(p.instructorId || ""),
                        day: p.day,
                        startHour: parseInt(p.startHour, 10),
                        duration: parseInt(p.duration, 10)
                    }))
                    .filter(p => Number.isFinite(p.startHour) && Number.isFinite(p.duration))
                    .filter(p => p.startHour >= state.settings.startHour && p.startHour + p.duration <= state.settings.endHour);

                persistSilently();
                toast("Imported", "JSON imported successfully.", "ok");
                resolve(true); // Signal success
            } catch (e) {
                toast("Import failed", "Invalid JSON or unsupported format.", "danger");
                resolve(false);
            }
        };
        reader.readAsText(file);
    });
}

export function exportCsv() {
    const rows = [["CourseCode", "CourseTitle", "Instructor", "Day", "Start", "End", "DurationHours"]];
    for (const p of (state.schedule.placements || [])) {
        const c = getCourse(p.courseId);
        const i = p.instructorId ? getInstructor(p.instructorId) : null;
        rows.push([
            c?.code || "",
            c?.title || "",
            i?.name || "",
            p.day,
            `${pad2(p.startHour)}:00`,
            `${pad2(p.startHour + p.duration)}:00`,
            String(p.duration)
        ]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    downloadText(`personatable_schedule_${Date.now()}.csv`, csv, "text/csv");
    toast("Exported", "Downloaded CSV schedule.", "ok");
}

export async function exportDocx() {
    // This depends on global docx variable from CDN
    if (typeof docx === "undefined") {
        toast("Error", "DOCX library not loaded.", "danger");
        return;
    }

    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } = docx;

    const days = state.settings.days;
    const startHour = state.settings.startHour;
    const endHour = state.settings.endHour;
    const hours = endHour - startHour;

    const startMap = new Map();
    const cover = new Set();
    for (const p of (state.schedule.placements || [])) {
        startMap.set(`${p.day}|${p.startHour}`, p);
        for (let k = 1; k < p.duration; k++) {
            cover.add(`${p.day}|${p.startHour + k}`);
        }
    }

    const tableRows = [];
    const headerCells = [
        new TableCell({
            children: [new Paragraph({ text: "Time", searchPatterns: [] })],
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
        })
    ];

    for (const day of days) {
        headerCells.push(new TableCell({
            children: [new Paragraph({ text: day, searchPatterns: [] })],
            width: { size: 90 / days.length, type: WidthType.PERCENTAGE },
            shading: { fill: "E0E0E0" },
        }));
    }
    tableRows.push(new TableRow({ children: headerCells }));

    for (let hi = 0; hi < hours; hi++) {
        const h = startHour + hi;
        const rowCells = [];
        rowCells.push(new TableCell({
            children: [new Paragraph({ text: `${pad2(h)}:00`, searchPatterns: [] })]
        }));

        for (const day of days) {
            const key = `${day}|${h}`;
            if (startMap.has(key)) {
                const p = startMap.get(key);
                const course = getCourse(p.courseId);
                const inst = p.instructorId ? getInstructor(p.instructorId) : null;
                const lines = [
                    new Paragraph({ children: [new TextRun({ text: course?.code || "COURSE", bold: true })] }),
                    new Paragraph({ children: [new TextRun({ text: course?.title || "", size: 20 })] }),
                    new Paragraph({ children: [new TextRun({ text: inst?.name || "", italics: true, size: 18 })] })
                ];
                rowCells.push(new TableCell({
                    children: lines,
                    rowSpan: p.duration,
                    verticalMerge: "restart",
                    shading: { fill: "F0F8FF" }
                }));
            } else if (cover.has(key)) {
                rowCells.push(new TableCell({ children: [], verticalMerge: "continue" }));
            } else {
                rowCells.push(new TableCell({ children: [] }));
            }
        }
        tableRows.push(new TableRow({ children: rowCells }));
    }

    const table = new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
    });

    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({
                    children: [new TextRun({ text: "Timetable Preview", size: 32, bold: true })],
                    spacing: { after: 200 }
                }),
                table
            ],
        }],
    });

    try {
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `timetable_export_${Date.now()}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast("Exported", "Downloaded DOCX timetable.", "ok");
    } catch (e) {
        console.error(e);
        toast("Export failed", "Could not generate DOCX.", "danger");
    }
}
