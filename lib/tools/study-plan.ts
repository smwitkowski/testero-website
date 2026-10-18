import type { ToolCertification } from "./data";

const DAY = 86_400_000;
function dateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}
const dateText = (time: number) => new Date(time).toISOString().slice(0, 10);
function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map(weight => total * weight / sum);
  const minutes = exact.map(Math.floor);
  const order = exact.map((value, i) => ({ i, fraction: value - minutes[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  const remainder = total - minutes.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < remainder; i++) minutes[order[i].i]++;
  return minutes;
}
export function buildStudyPlan(cert: ToolCertification, examDate: string, hoursPerWeek: number, today: string) {
  const start = dateValue(today), exam = dateValue(examDate);
  const days = (exam - start) / DAY;
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error("Choose an exam date 1–366 days from today.");
  if (!Number.isFinite(hoursPerWeek) || hoursPerWeek < 1 || hoursPerWeek > 40) throw new Error("Choose between 1 and 40 study hours per week.");
  const sections = cert.guide.sections.filter(section => section.included !== false);
  if (!sections.length) throw new Error("This guide has no included sections to schedule.");
  const weighted = sections.every(section => section.weight_percent !== null && section.weight_percent > 0);
  const weights = sections.map(section => weighted ? section.weight_percent! : 1);
  const totalWeight = weighted ? weights.reduce((sum, value) => sum + value, 0) : null;
  const totalMinutes = Math.round(days / 7 * hoursPerWeek * 60);
  const sectionMinutes = allocate(totalMinutes, weights);
  const weekDays = Array.from({ length: Math.ceil(days / 7) }, (_, i) => Math.min(7, days - i * 7));
  const weekMinutes = allocate(totalMinutes, weekDays);
  let sectionIndex = 0;
  const remaining = [...sectionMinutes];
  const weeks = weekMinutes.map((minutes, i) => {
    let budget = minutes;
    const tasks: { sectionId: string; title: string; minutes: number }[] = [];
    while (budget > 0 && sectionIndex < sections.length) {
      const used = Math.min(budget, remaining[sectionIndex]);
      if (used > 0) tasks.push({ sectionId: sections[sectionIndex].id, title: sections[sectionIndex].title, minutes: used });
      budget -= used; remaining[sectionIndex] -= used;
      if (remaining[sectionIndex] === 0) sectionIndex++;
    }
    return { number: i + 1, start: dateText(start + i * 7 * DAY), end: dateText(start + (i * 7 + weekDays[i] - 1) * DAY), minutes, tasks };
  });
  if (weeks.length > 1 && weekDays.at(-1) === 1) {
    const last = weeks.pop()!;
    const previous = weeks[weeks.length - 1];
    previous.end = last.end; previous.minutes += last.minutes;
    for (const task of last.tasks) {
      const existing = previous.tasks.find(item => item.sectionId === task.sectionId);
      if (existing) existing.minutes += task.minutes; else previous.tasks.push(task);
    }
  }
  return { certName: cert.name, guideUrl: cert.guide.url, guideVariant: cert.guide.variant, beta: cert.guide.variant === "beta", examDate, hoursPerWeek, totalMinutes, weighted, totalWeight, weeks, sections: sections.map((section, i) => ({ ...section, minutes: sectionMinutes[i] })) };
}
export type StudyPlan = ReturnType<typeof buildStudyPlan>;
export const studyTime = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
export function studyPlanText(plan: StudyPlan) {
  return [plan.certName, `Official ${plan.guideVariant} exam guide: ${plan.guideUrl}`, ...(plan.beta ? ["Beta guide only. Beta registration is closed; check Google for GA availability and its guide. Separate required labs are not scheduled."] : []), `Exam: ${plan.examDate} | ${plan.hoursPerWeek} hours/week | ${studyTime(plan.totalMinutes)} total`, plan.weighted ? `Time allocated in proportion to official section weights (total ${plan.totalWeight}%).` : "No complete section weights available; time split evenly across included sections.", ...plan.weeks.flatMap(week => [`\n${Date.parse(week.end) - Date.parse(week.start) > 6 * DAY ? "Study period" : "Week"} ${week.number}: ${week.start} – ${week.end} (${studyTime(week.minutes)})`, ...week.tasks.map(task => `- ${task.title}: ${studyTime(task.minutes)}`)]), "\nUse official docs and hands-on practice for each section; revisit weak areas. This schedule is not an exam-readiness prediction.", "Testero is independent and not affiliated with or endorsed by Google."].join("\n");
}
