export const ganttTaskTemplate = {
  code: "", name: "", group: "", level: 0, progress: 0, plannedLabel: "",
  start: "", finish: "", baselineStart: "", baselineFinish: "",
  reportedState: "", riskLabel: "", critical: false, durationLabel: "",
  resources: "", dependencies: "", materials: "", notes: "", originalData: "",
};
export type GanttTask = typeof ganttTaskTemplate;
export type GanttSchedule = { title: string; cutoff: string; sourceName: string; scope: string; tasks: GanttTask[] };
const emptySchedule = (): GanttSchedule => ({ title: "", cutoff: "", sourceName: "", scope: "", tasks: [] });
export const ganttSchedules = { buildings: emptySchedule(), urbanism: emptySchedule() };
