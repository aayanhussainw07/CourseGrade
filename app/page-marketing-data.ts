import { type LucideIcon, GraduationCap, Layers, Sparkles, TrendingUp } from "lucide-react";
import { DEFAULT_GRADE_SCALE, type Course } from "@/lib/types";
import { getGpaColor } from "./page-utils";

export const marketingFeatures: {
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Organize every semester",
    description:
      "Group classes by term and drag semesters in the order you remember them.",
    icon: Layers,
  },
  {
    title: "Visualize progress instantly",
    description:
      "GPA timelines and grade distributions surface trends so you can intervene before finals week.",
    icon: TrendingUp,
  },
  {
    title: "Model any grading rule",
    description:
      "Weighted criteria, extra credit, drop-lowest policies, pass/fail scales—CourseGrade handles real syllabi.",
    icon: Sparkles,
  },
];

export const marketingTimelineData = [
  { label: "Fall ’21", gpa: 3.91 },
  { label: "Spring ’22", gpa: 3.88 },
  { label: "Fall ’22", gpa: 3.85 },
  { label: "Spring ’23", gpa: 3.83 },
  { label: "Fall ’23", gpa: 3.8 },
  { label: "Spring ’24", gpa: 3.78 },
].map((entry) => ({ ...entry, color: getGpaColor(entry.gpa) }));

const cloneDefaultScale = () => DEFAULT_GRADE_SCALE.map((grade) => ({ ...grade }));

const MARKETING_COURSE_SEEDS = [
  ["Algorithms", 4, 98],
  ["Sustainability Lab", 3, 94],
  ["Studio Seminar", 2, 90],
  ["Signal Processing", 3, 92],
  ["Human Factors", 3, 89],
  ["Database Systems", 4, 95],
  ["Design Studio", 2, 93],
  ["Microeconomics", 3, 88],
  ["Systems Architecture", 3, 96],
  ["Machine Learning", 4, 97],
  ["Professional Writing", 2, 91],
  ["Embedded Systems", 3, 87],
  ["Entrepreneurship Lab", 1, 93],
  ["Game Theory", 3, 90],
  ["Cognitive Science", 3, 85],
  ["Creative Coding", 2, 99],
  ["Innovation Lab", 1, 92],
  ["Product Management", 3, 88],
  ["Bioinformatics", 3, 86],
  ["Ethics in AI", 2, 94],
] as const;

export const marketingCourses: Course[] = MARKETING_COURSE_SEEDS.map(
  ([name, credits, score], index) => {
    const idIndex = index + 1;
    const courseId = `marketing-course-${idIndex}`;
    const criterionId = `${courseId}-criterion`;

    return {
      id: courseId,
      name,
      credits,
      criteria: [
        {
          id: criterionId,
          clientId: criterionId,
          name: "Overall",
          weight: 100,
          score,
          dropLowest: 0,
          extraCredit: 0,
        },
      ],
      gradeScale: cloneDefaultScale(),
      collapsed: false,
      isPassFail: false,
    };
  },
);

const marketingTotalCredits = marketingCourses.reduce(
  (sum, course) => sum + (course.credits ?? 0),
  0,
);

export const marketingDashboardStats = [
  { label: "Overall GPA", value: "3.91", icon: TrendingUp },
  {
    label: "Total Credits",
    value: marketingTotalCredits.toString(),
    icon: Layers,
  },
  { label: "Semesters Tracked", value: "6", icon: GraduationCap },
];

export const marketingCapabilityCards = [
  {
    title: "Live GPA math",
    description:
      "Weighted criteria, pass/fail logic, and letter scales are modeled exactly the way your instructors grade.",
  },
  {
    title: "Drag-and-drop organization",
    description:
      "Reorder semesters, recolor courses, and collapse sections to match the way you plan your workload.",
  },
  {
    title: "One-click backups",
    description:
      "Export CSV or JSON snapshots before advising meetings or when switching devices.",
  },
  {
    title: "Role-aware sharing",
    description:
      "Sign in with Google and sync across browsers so mentors and teammates can pick up where you left off.",
  },
];

export const marketingWorkflow = [
  {
    title: "Import or start from scratch",
    description:
      "Bring in past semesters via CSV/JSON or create new ones with a single click.",
  },
  {
    title: "Track assignments in real time",
    description:
      "Update scores and watch GPA summaries, charts, and alerts respond instantly.",
  },
  {
    title: "Share and export anywhere",
    description:
      "Download clean CSVs for advisors, backups, or accountability partners whenever you need them.",
  },
];

export const marketingHighlights = [
  {
    value: "Unlimited courses",
    detail: "Per semester with drag-and-drop ordering",
  },
  { value: "CSV + JSON export", detail: "Portable backups & quick sharing" },
  { value: "Secure Google sign-in", detail: "Syncs your data across browsers" },
];
