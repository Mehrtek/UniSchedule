import { state, getInstructor, getCourse, hoursCount, makeDefaultAvailability, DEFAULT_DAYS } from "./state.js";
import { toast, uid, clamp } from "./utils.js";

export function normalizeAvailabilityForSettings(inst) {
    const days = state.settings.days.length;
    const hours = hoursCount();
    if (!inst.availability || !Array.isArray(inst.availability)) {
        inst.availability = makeDefaultAvailability();
        return;
    }
    // Resize days
    while (inst.availability.length < days) inst.availability.push(Array(hoursCount()).fill(true));
    inst.availability = inst.availability.slice(0, days);

    // Resize hours per day
    for (let d = 0; d < days; d++) {
        const row = Array.isArray(inst.availability[d]) ? inst.availability[d] : [];
        while (row.length < hours) row.push(true);
        inst.availability[d] = row.slice(0, hours).map(v => !!v);
    }
}

export function autoFix() {
    // Ensure at least one instructor for any course that references missing
    for (const c of state.courses) {
        if (c.instructorId && !getInstructor(c.instructorId)) c.instructorId = "";
        if (!c.code) c.code = "COURSE";
        c.sessionsPerWeek = clamp(parseInt(c.sessionsPerWeek || 1, 10), 1, 10);
        c.duration = clamp(parseInt(c.duration || 1, 10), 1, 4);
        c.earliestHour = clamp(parseInt(c.earliestHour ?? state.settings.startHour, 10), state.settings.startHour, state.settings.endHour - 1);
        c.latestHour = clamp(parseInt(c.latestHour ?? state.settings.endHour, 10), state.settings.startHour + 1, state.settings.endHour);
        if (c.latestHour <= c.earliestHour + 0) c.latestHour = Math.min(state.settings.endHour, c.earliestHour + 1);
        if (!Array.isArray(c.preferredDays)) c.preferredDays = [];
    }
    for (const i of state.instructors) normalizeAvailabilityForSettings(i);
    toast("Auto-fix applied", "Validated settings and resized availability grids.", "ok");
}

function buildEmptyGrid() {
    return state.settings.days.map(() => Array(hoursCount()).fill(null));
}

function placeIntoGrid(grid, placement) {
    const d = state.settings.days.indexOf(placement.day);
    const h0 = placement.startHour - state.settings.startHour;
    for (let k = 0; k < placement.duration; k++) {
        grid[d][h0 + k] = placement.id;
    }
}

function isFree(grid, dayIndex, hourIndex, duration) {
    for (let k = 0; k < duration; k++) {
        if (grid[dayIndex][hourIndex + k] !== null) return false;
    }
    return true;
}

function instructorAvailable(inst, dayIndex, hourIndex, duration) {
    if (!inst) return true; // if no instructor assigned, ignore availability constraint
    const row = inst.availability?.[dayIndex];
    if (!row) return true;
    for (let k = 0; k < duration; k++) {
        if (row[hourIndex + k] === false) return false;
    }
    return true;
}

function courseWindowAllows(course, startHour) {
    const endHour = startHour + course.duration;
    return startHour >= course.earliestHour && endHour <= course.latestHour;
}

function dayScore(course, day) {
    if (!course.preferredDays || course.preferredDays.length === 0) return 1;
    return course.preferredDays.includes(day) ? 0 : 2; // preferred first
}

function timeScore(course, startHour) {
    return (startHour - course.earliestHour) * 0.05;
}

function availabilityTightness(course) {
    const days = state.settings.days;
    const options = [];
    for (let d = 0; d < days.length; d++) {
        const day = days[d];
        const startMin = course.earliestHour;
        const startMax = course.latestHour - course.duration;
        for (let h = startMin; h <= startMax; h++) {
            options.push({ d, h, day });
        }
    }
    return options.length;
}

export function smartSortCourses() {
    state.courses.sort((a, b) => {
        const ta = availabilityTightness(a);
        const tb = availabilityTightness(b);
        const la = a.sessionsPerWeek * a.duration;
        const lb = b.sessionsPerWeek * b.duration;
        return (ta - tb) || (lb - la) || (a.code.localeCompare(b.code));
    });
    toast("Sorted", "Courses sorted by constraint tightness and load.", "ok");
}

export function generateSchedule() {
    // Start fresh, ignoring existing placements for v1
    const grid = buildEmptyGrid();
    const placements = [];
    const unscheduled = [];

    const courses = [...state.courses].map(c => ({ ...c }));

    courses.sort((a, b) => {
        const ta = availabilityTightness(a);
        const tb = availabilityTightness(b);
        const la = a.sessionsPerWeek * a.duration;
        const lb = b.sessionsPerWeek * b.duration;
        return (ta - tb) || (lb - la) || (a.code.localeCompare(b.code));
    });

    for (const course of courses) {
        let remaining = course.sessionsPerWeek;
        const inst = course.instructorId ? getInstructor(course.instructorId) : null;

        while (remaining > 0) {
            let best = null;

            for (let d = 0; d < state.settings.days.length; d++) {
                const day = state.settings.days[d];

                const dScore = dayScore(course, day);
                const startMin = course.earliestHour;
                const startMax = course.latestHour - course.duration;

                for (let h = startMin; h <= startMax; h++) {
                    const hi = h - state.settings.startHour;
                    if (hi < 0) continue;
                    if (hi + course.duration > hoursCount()) continue;
                    if (!courseWindowAllows(course, h)) continue;
                    if (!isFree(grid, d, hi, course.duration)) continue;
                    if (!instructorAvailable(inst, d, hi, course.duration)) continue;

                    const score =
                        dScore * 10 +
                        timeScore(course, h) +
                        (h - state.settings.startHour) * 0.01;
                    if (!best || score < best.score) {
                        best = { day, d, startHour: h, hi, score };
                    }
                }
            }

            if (!best) {
                unscheduled.push({
                    courseId: course.id,
                    remaining,
                    reason: !inst && course.instructorId ? "Instructor missing" : "No feasible slots with current constraints"
                });
                break;
            }

            const placement = {
                id: uid(),
                courseId: course.id,
                instructorId: course.instructorId || "",
                day: best.day,
                startHour: best.startHour,
                duration: course.duration
            };

            placements.push(placement);
            placeIntoGrid(grid, placement);
            remaining--;
        }
    }

    state.schedule = { placements, unscheduled };
    const placedHours = placements.reduce((sum, p) => sum + p.duration, 0);
    toast("Generated", `Placed ${placements.length} sessions (${placedHours} hour(s)).`, unscheduled.length ? "warn" : "ok");
}

export function seedSample() {
    const sample = {
        instructors: [
            { id: uid(), name: "Dr. Amina Yusuf" },
            { id: uid(), name: "Prof. Daniel Okoye" },
            { id: uid(), name: "Ms. Leila Mensah" }
        ],
        courses: []
    };
    for (const inst of sample.instructors) {
        inst.availability = makeDefaultAvailability();
    }

    const start = state.settings.startHour;
    const end = state.settings.endHour; 
    // We assume default 8-18 for seed logic, or we adapt.
    // The seed logic in original code uses hardcoded indices assuming Mon-Fri and 8-18 roughly.
    // We'll stick to the original logic but ensure indices exist.
    
    // Dr. Amina: Mon 8-10 off
    const idxMon = state.settings.days.indexOf("Mon");
    const idxWed = state.settings.days.indexOf("Wed");
    if (idxMon >= 0) {
        sample.instructors[0].availability[idxMon][0] = false;
        sample.instructors[0].availability[idxMon][1] = false;
    }
    if (idxWed >= 0) {
        // 14:00. If start=8, 14 is index 6.
        const off = 14 - start;
        if(off >= 0 && off < hoursCount()) sample.instructors[0].availability[idxWed][off] = false; 
    }
    const idxTue = state.settings.days.indexOf("Tue");
    if (idxTue >= 0) {
        sample.instructors[1].availability[idxTue][0] = false;
        sample.instructors[1].availability[idxTue][1] = false;
        sample.instructors[1].availability[idxTue][2] = false;
    }
    const idxThu = state.settings.days.indexOf("Thu");
    if (idxThu >= 0) {
        for (let hi = 6; hi < hoursCount(); hi++) sample.instructors[2].availability[idxThu][hi] = false;
    }

    const [i1, i2, i3] = sample.instructors;
    // New instructor
    sample.instructors.push({ id: uid(), name: "Dr. Sarah Chen" });
    sample.instructors[3].availability = makeDefaultAvailability();
    const i4 = sample.instructors[3];

    sample.courses = [
        { id: uid(), code: "CSC201", title: "Data Structures", instructorId: i2.id, sessionsPerWeek: 3, duration: 1, preferredDays: ["Mon", "Wed", "Fri"], earliestHour: 9, latestHour: 16, notes: "Prefer mid-morning slots." },
        { id: uid(), code: "CSC241", title: "Operating Systems", instructorId: i1.id, sessionsPerWeek: 2, duration: 2, preferredDays: ["Tue", "Thu"], earliestHour: 10, latestHour: 18, notes: "2-hour blocks; avoid early mornings." },
        { id: uid(), code: "MTH110", title: "Discrete Mathematics", instructorId: i3.id, sessionsPerWeek: 2, duration: 1, preferredDays: ["Mon", "Thu"], earliestHour: 8, latestHour: 14, notes: "Keep before afternoon." },
        { id: uid(), code: "ENG101", title: "Technical Writing", instructorId: "", sessionsPerWeek: 1, duration: 2, preferredDays: ["Wed"], earliestHour: 9, latestHour: 17, notes: "Instructor TBD (availability ignored until assigned)." },
        { id: uid(), code: "PHY101", title: "Physics I", instructorId: i4.id, sessionsPerWeek: 3, duration: 1, preferredDays: ["Mon", "Wed", "Fri"], earliestHour: 8, latestHour: 12, notes: "Lab equipment needed." },
        { id: uid(), code: "CSC301", title: "Algorithms", instructorId: i1.id, sessionsPerWeek: 2, duration: 1.5, preferredDays: ["Tue", "Thu"], earliestHour: 13, latestHour: 17, notes: "Advanced topics." },
        { id: uid(), code: "ART105", title: "Design Studio", instructorId: i3.id, sessionsPerWeek: 1, duration: 3, preferredDays: ["Fri"], earliestHour: 13, latestHour: 17, notes: "Long studio session." },
        { id: uid(), code: "HIS101", title: "World History", instructorId: i2.id, sessionsPerWeek: 2, duration: 1.5, preferredDays: ["Mon", "Wed"], earliestHour: 14, latestHour: 18, notes: "Afternoon lectures." }
    ];

    state.instructors = sample.instructors;
    for (const inst of state.instructors) normalizeAvailabilityForSettings(inst);

    state.courses = sample.courses.map(c => ({
        ...c,
        earliestHour: clamp(c.earliestHour, state.settings.startHour, state.settings.endHour - 1),
        latestHour: clamp(c.latestHour, state.settings.startHour + 1, state.settings.endHour)
    }));

    state.schedule = { placements: [], unscheduled: [] };
    toast("Sample loaded", "Try generating now.", "ok");
}

export function clearAll() {
    if (!confirm("Reset everything (courses, instructors, timetable)?")) return false;
    state.settings.days = [...DEFAULT_DAYS];
    state.settings.startHour = 8;
    state.settings.endHour = 18;
    state.instructors = [];
    state.courses = [];
    state.schedule = { placements: [], unscheduled: [] };
    toast("Reset", "All data cleared.", "ok");
    return true;
}

export function clearSchedule() {
    state.schedule = { placements: [], unscheduled: [] };
    toast("Cleared", "Timetable cleared (data kept).", "ok");
}
