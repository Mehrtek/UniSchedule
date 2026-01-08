export const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const STORAGE_KEY = "personatable_v1";

export const state = {
    version: 1,
    settings: {
        days: [...DEFAULT_DAYS],
        startHour: 8,
        endHour: 18
    },
    instructors: [],
    courses: [],
    schedule: {
        placements: [],
        unscheduled: []
    }
};

export function hoursCount() { return state.settings.endHour - state.settings.startHour; }

export function getInstructor(id) { return state.instructors.find(x => x.id === id); }
export function getCourse(id) { return state.courses.find(x => x.id === id); }

export function makeDefaultAvailability() {
     return state.settings.days.map(() => Array(hoursCount()).fill(true));
}
