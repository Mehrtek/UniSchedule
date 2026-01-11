import {
  state,
  getInstructor,
  getCourse,
  hoursCount,
  DEFAULT_DAYS,
  makeDefaultAvailability,
} from "./state.js";
import { $, clamp, toast, uid } from "./utils.js";
import {
  autoFix,
  generateSchedule,
  seedSample,
  clearAll,
  clearSchedule,
  smartSortCourses,
  normalizeAvailabilityForSettings,
} from "./logic.js";
import {
  renderAll,
  renderAvailability,
  renderCourses,
  renderTimetable,
  renderUnscheduled,
  renderInstructors,
  openCourseEditor,
  openInstructorEditor,
  closeModal,
} from "./ui.js";
import {
  persist,
  loadFromStorage,
  importJsonFile,
  exportDocx,
  persistSilently,
} from "./persistence.js";

// Re-export specific UI functions for main init if needed, or just import directly
// Since I imported them above, I can use them.

function applySettings() {
  const start = clamp(parseInt($("#startHour").value || "8", 10), 6, 12);
  const end = clamp(parseInt($("#endHour").value || "18", 10), 13, 22);
  if (end <= start + 1) {
    toast(
      "Invalid hours",
      "End hour must be at least 2 hours after start.",
      "warn"
    );
    return;
  }

  state.settings.startHour = start;
  state.settings.endHour = end;

  for (const inst of state.instructors) normalizeAvailabilityForSettings(inst);

  for (const c of state.courses) {
    c.earliestHour = clamp(
      parseInt(c.earliestHour ?? start, 10),
      start,
      end - 1
    );
    c.latestHour = clamp(parseInt(c.latestHour ?? end, 10), start + 1, end);
    if (c.latestHour <= c.earliestHour)
      c.latestHour = Math.min(end, c.earliestHour + 1);
    if (c.earliestHour + c.duration > c.latestHour)
      c.latestHour = Math.min(end, c.earliestHour + c.duration);
  }

  state.schedule.placements = (state.schedule.placements || []).filter(
    (p) => p.startHour >= start && p.startHour + p.duration <= end
  );

  renderAll();
  persistSilently();
  toast("Applied", "Settings updated.", "ok");
}

function setWorkingHoursForSelected() {
  const inst = getInstructor($("#instructorSelect").value);
  if (!inst) return;
  normalizeAvailabilityForSettings(inst);
  const start = state.settings.startHour;
  const end = state.settings.endHour;

  for (let di = 0; di < state.settings.days.length; di++) {
    for (let hi = 0; hi < hoursCount(); hi++) {
      const h = start + hi;
      const on = h >= start + 1 && h < end - 1;
      inst.availability[di][hi] = on;
    }
  }
  renderAvailability();
  persistSilently();
  toast("Updated", "Set working hours.", "ok");
}

function makeAllAvailableForSelected() {
  const inst = getInstructor($("#instructorSelect").value);
  if (!inst) return;
  normalizeAvailabilityForSettings(inst);
  for (let di = 0; di < state.settings.days.length; di++) {
    for (let hi = 0; hi < hoursCount(); hi++) {
      inst.availability[di][hi] = true;
    }
  }
  renderAvailability();
  persistSilently();
  toast("Updated", "All slots marked available.", "ok");
}

function setTheme(theme) {
  document.body.classList.remove(
    "theme-onyx",
    "theme-alabaster",
    "theme-spectrum"
  );
  document.body.classList.add(`theme-${theme}`);

  // Update custom UI active state
  document.querySelectorAll(".theme-opt").forEach((opt) => {
    opt.classList.toggle("active", opt.dataset.theme === theme);
  });

  localStorage.setItem("uni-theme-new", theme);
}

function bindEvents() {
    // Theme Toggle
    const btnThemeToggle = $("#btnThemeToggle");
    const themeDropdown = $("#themeDropdown");
    if (btnThemeToggle && themeDropdown) {
        btnThemeToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            themeDropdown.classList.toggle("hidden");
        });
    }

    // Theme Options (using delegation)
    if (themeDropdown) {
        themeDropdown.addEventListener("click", (e) => {
            const opt = e.target.closest(".theme-opt");
            if (opt) {
                e.stopPropagation();
                setTheme(opt.dataset.theme);
                themeDropdown.classList.add("hidden");
            }
        });
    }

    // Instructor Custom Select
    const instBtn = $("#instructorSelectBtn");
    if (instBtn) {
        instBtn.onclick = (e) => {
            e.stopPropagation();
            const menu = $("#instructorSelectMenu");
            const wrap = $("#instructorSelectWrap");
            if (menu && wrap) {
                const isHidden = menu.classList.toggle("hidden");
                wrap.classList.toggle("open", !isHidden);
            }
        };
    }

    window.addEventListener("click", () => {
        $("#themeDropdown")?.classList.add("hidden");
        $("#instructorSelectMenu")?.classList.add("hidden");
        $("#instructorSelectWrap")?.classList.remove("open");
    });

  $("#btnAddCourse").addEventListener("click", () => openCourseEditor(null));
  $("#btnAddInstructor").addEventListener("click", () =>
    openInstructorEditor(null)
  );

  $("#btnGenerate").addEventListener("click", () => {
    generateSchedule();
    renderAll();
    persistSilently();
  });

    $("#btnSave").addEventListener("click", persist);

    $("#btnExportDocx").addEventListener("click", exportDocx);

  $("#btnClearSchedule").addEventListener("click", () => {
    clearSchedule();
    renderAll();
  });
  $("#btnResetAll").addEventListener("click", () => {
    if (clearAll()) {
      renderAll();
      persistSilently();
    }
  });

    $("#btnSeed").addEventListener("click", () => { seedSample(); generateSchedule(); renderAll(); persistSilently(); });

  $("#btnSortCourses").addEventListener("click", () => {
    smartSortCourses();
    renderAll();
    persistSilently();
  });

  $("#btnApplySettings").addEventListener("click", applySettings);
  $("#btnAutoFix").addEventListener("click", () => {
    autoFix();
    renderAll();
    persistSilently();
  });

  $("#instructorSelect").addEventListener("change", () => {
    renderAvailability();
    persistSilently();
  });

  $("#btnWorkingHours").addEventListener("click", setWorkingHoursForSelected);
  $("#btnMakeAllAvailable").addEventListener(
    "click",
    makeAllAvailableForSelected
  );

  $("#courseSearch").addEventListener("input", renderCourses);

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;

    if (act === "edit-course") openCourseEditor(id);
    if (act === "del-course") {
      const c = getCourse(id);
      if (!c) return;
      if (!confirm(`Delete course "${c.code} — ${c.title}"?`)) return;
      state.courses = state.courses.filter((x) => x.id !== id);
      state.schedule.placements = (state.schedule.placements || []).filter(
        (p) => p.courseId !== id
      );
      state.schedule.unscheduled = (state.schedule.unscheduled || []).filter(
        (u) => u.courseId !== id
      );
      renderAll();
      persistSilently();
      toast("Deleted", "Course removed.", "ok");
    }

    if (act === "edit-inst") openInstructorEditor(id);
    if (act === "del-inst") {
      const i = getInstructor(id);
      if (!i) return;
      if (!confirm(`Delete instructor "${i.name}"?`)) return;
      state.instructors = state.instructors.filter((x) => x.id !== id);
      for (const c of state.courses) {
        if (c.instructorId === id) c.instructorId = "";
      }
      for (const p of state.schedule.placements || []) {
        if (p.instructorId === id) p.instructorId = "";
      }
      renderAll();
      persistSilently();
      toast("Deleted", "Instructor removed.", "ok");
    }
  });

  $("#modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
  $("#btnCloseModal").addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#modalBackdrop").classList.contains("show"))
      closeModal();
  });
}

function init() {
  // Default to onyx (dark)
  const savedTheme = localStorage.getItem("uni-theme-new") || "onyx";
  setTheme(savedTheme);

  state.settings.days = [...DEFAULT_DAYS];
  const loaded = loadFromStorage();
  if (!loaded) {
    const inst = {
      id: uid(),
      name: "Default Instructor",
      availability: makeDefaultAvailability(),
    };
    state.instructors = [inst];
  }
  for (const inst of state.instructors) normalizeAvailabilityForSettings(inst);

  bindEvents();
  renderAll();

  if (!loaded) toast("Welcome", "Data initialized.", "info");
  else toast("Loaded", "Restored from storage.", "ok");
}

init();
