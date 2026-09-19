import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDate } from "@/lib/campus";
import { db, type Row } from "@/lib/db";
import { commonSkillGaps, useRoster, type RosterStudent } from "@/lib/roster";
import type { Session } from "@/lib/session";

import { Notifications } from "./student";
import { Badge, Card, Empty, Loading, PageHeader, Stat } from "./ui";

const CHART_COLORS = [
  "var(--color-brand)",
  "var(--color-accent-warm)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-muted-foreground)",
  "var(--color-chart-3)",
];

function useInstitution() {
  const roster = useRoster();
  const faculty = useQuery({
    queryKey: ["faculty-list"],
    queryFn: async () => {
      const { data } = await db
        .from("faculty_profiles")
        .select("*, users:user_id(full_name, email)");
      return (data ?? []) as Row[];
    },
  });
  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data } = await db.from("company_profiles").select("*");
      return (data ?? []) as Row[];
    },
  });
  const opportunities = useQuery({
    queryKey: ["opportunities-all"],
    queryFn: async () => {
      const { data } = await db
        .from("opportunities")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as Row[];
    },
  });
  const workshops = useQuery({
    queryKey: ["workshops"],
    queryFn: async () => {
      const { data } = await db.from("workshops").select("*").order("session_date");
      return (data ?? []) as Row[];
    },
  });
  const infoSessions = useQuery({
    queryKey: ["info-sessions-all"],
    queryFn: async () => {
      const { data } = await db.from("info_sessions").select("*").order("session_date");
      return (data ?? []) as Row[];
    },
  });
  const applications = useQuery({
    queryKey: ["applications-all"],
    queryFn: async () => {
      const { data } = await db.from("applications").select("*");
      return (data ?? []) as Row[];
    },
  });

  return {
    loading: roster.isLoading || faculty.isLoading || opportunities.isLoading,
    students: roster.data ?? [],
    faculty: faculty.data ?? [],
    companies: companies.data ?? [],
    opportunities: opportunities.data ?? [],
    workshops: workshops.data ?? [],
    infoSessions: infoSessions.data ?? [],
    applications: applications.data ?? [],
  };
}

function averageScore(students: RosterStudent[]) {
  if (students.length === 0) return 0;
  return Math.round(students.reduce((sum, student) => sum + student.overallScore, 0) / students.length);
}

function Dashboard() {
  const data = useInstitution();
  if (data.loading) return <Loading />;

  const gaps = commonSkillGaps(data.students).slice(0, 5);
  const internships = data.opportunities.filter((item) => item.kind === "Internship").length;
  const jobs = data.opportunities.filter((item) => item.kind === "Full-time").length;

  return (
    <>
      <PageHeader
        eyebrow="College dashboard"
        title="Institution overview"
        description="Everything happening across students, faculty and recruiting partners."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total students" value={data.students.length} />
        <Stat label="Total faculty" value={data.faculty.length} />
        <Stat label="Active companies" value={data.companies.length} tone="success" />
        <Stat label="Average skill score" value={averageScore(data.students)} hint="out of 100" />
        <Stat label="Internships" value={internships} />
        <Stat label="Jobs" value={jobs} />
        <Stat label="Applications" value={data.applications.length} tone="success" />
        <Stat label="Major skill gaps" value={gaps.length} tone="warm" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Major skill gaps" subtitle="Students below 60% for their target role">
          {gaps.length === 0 ? (
            <Empty title="No assessment data yet" />
          ) : (
            <div className="space-y-3">
              {gaps.map((gap) => (
                <div key={gap.skill}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{gap.skill}</span>
                    <span className="font-mono text-xs text-muted-foreground">{gap.percent}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-accent-warm"
                      style={{ width: `${Math.max(2, gap.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Upcoming workshops & seminars">
            {data.workshops.length === 0 ? (
              <Empty title="Nothing scheduled" />
            ) : (
              <ul className="space-y-2">
                {data.workshops.map((item) => (
                  <li key={item.id} className="rounded-md border border-border px-3 py-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.faculty_name} · {formatDate(item.session_date)} · {item.session_time}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Upcoming company sessions">
            {data.infoSessions.length === 0 ? (
              <Empty title="Nothing scheduled" />
            ) : (
              <ul className="space-y-2">
                {data.infoSessions.map((item) => (
                  <li key={item.id} className="rounded-md border border-border px-3 py-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.company_name} · {formatDate(item.session_date)} · {item.session_time}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Analytics() {
  const data = useInstitution();
  if (data.loading) return <Loading />;

  const gaps = commonSkillGaps(data.students);
  const gapChart = gaps.slice(0, 6).map((gap) => ({ skill: gap.skill, percent: gap.percent }));

  const byDepartment = new Map<string, { total: number; count: number; gaps: number }>();
  for (const student of data.students) {
    const entry = byDepartment.get(student.department) ?? { total: 0, count: 0, gaps: 0 };
    entry.total += student.overallScore;
    entry.count += 1;
    entry.gaps += student.weak.length;
    byDepartment.set(student.department, entry);
  }
  const departmentChart = Array.from(byDepartment.entries()).map(([department, entry]) => ({
    department,
    average: Math.round(entry.total / entry.count),
    gaps: entry.gaps,
  }));

  const roleCount = new Map<string, number>();
  for (const student of data.students) {
    const goal = student.careerGoal ?? "Not set";
    roleCount.set(goal, (roleCount.get(goal) ?? 0) + 1);
  }
  const roleChart = Array.from(roleCount.entries()).map(([name, value]) => ({ name, value }));

  const industrySkills = new Map<string, number>();
  for (const opportunity of data.opportunities) {
    for (const skill of (opportunity.required_skills ?? []) as string[]) {
      industrySkills.set(skill, (industrySkills.get(skill) ?? 0) + 1);
    }
  }
  const industryChart = Array.from(industrySkills.entries())
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <>
      <PageHeader
        eyebrow="Skill analytics"
        title="Institution-wide skill intelligence"
        description="Use this to decide which workshops and seminars to run next term."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Average student skill score" value={averageScore(data.students)} />
        <Stat
          label="Most common weak skill"
          value={gaps[0]?.skill ?? "—"}
          hint={gaps[0] ? `${gaps[0].percent}% need improvement` : undefined}
          tone="warm"
        />
        <Stat label="Open industry roles" value={data.opportunities.length} tone="success" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Most common skill gaps" subtitle="% of students below 60%">
          {gapChart.length === 0 ? (
            <Empty title="No data yet" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gapChart} layout="vertical" margin={{ left: 16, right: 16 }}>
                  <XAxis type="number" domain={[0, 100]} fontSize={11} />
                  <YAxis dataKey="skill" type="category" width={90} fontSize={11} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Bar dataKey="percent" fill="var(--color-accent-warm)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Department-wise performance" subtitle="Average score and open skill gaps">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentChart} margin={{ left: 0, right: 8 }}>
                <XAxis dataKey="department" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="average" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gaps" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Career role distribution" subtitle="What students are aiming for">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={roleChart} dataKey="value" nameKey="name" outerRadius={90} label>
                  {roleChart.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Skills industry is asking for" subtitle="Across all posted opportunities">
          {industryChart.length === 0 ? (
            <Empty title="No opportunities posted yet" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={industryChart} margin={{ left: 0, right: 8 }}>
                  <XAxis dataKey="skill" fontSize={10} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Students() {
  const data = useInstitution();
  if (data.loading) return <Loading />;
  return (
    <>
      <PageHeader eyebrow="Students" title="All registered students" />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-secondary/60">
            <tr>
              {["Name", "Department", "Year", "Career goal", "Score", "Weak skills"].map((head) => (
                <th key={head} className="px-4 py-3 font-medium">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.students.map((student) => (
              <tr key={student.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{student.name}</td>
                <td className="px-4 py-3">{student.department}</td>
                <td className="px-4 py-3">{student.year}</td>
                <td className="px-4 py-3">{student.careerGoal ?? "—"}</td>
                <td className="px-4 py-3 font-mono">{student.overallScore}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {student.weak.length ? student.weak.join(", ") : "None"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function Faculty() {
  const data = useInstitution();
  if (data.loading) return <Loading />;
  return (
    <>
      <PageHeader eyebrow="Faculty" title="Teaching staff on CAMPUS" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.faculty.map((member) => (
          <Card key={member.id}>
            <p className="text-base font-semibold">{member.users?.full_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {member.designation} · {member.department}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{member.users?.email}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {data.workshops.filter((workshop) => workshop.faculty_id === member.user_id).length}{" "}
              session(s) scheduled
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}

function SessionList({ kind }: { kind: "Workshop" | "Seminar" }) {
  const data = useInstitution();
  if (data.loading) return <Loading />;
  const list = data.workshops.filter((item) => item.kind === kind);
  return (
    <>
      <PageHeader
        eyebrow={kind === "Workshop" ? "Workshops" : "Seminars"}
        title={`${kind}s scheduled by faculty`}
      />
      {list.length === 0 ? (
        <Card>
          <Empty title={`No ${kind.toLowerCase()}s scheduled`} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((item) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold">{item.title}</h3>
                <Badge tone="brand">{item.skill}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                {item.faculty_name} · {formatDate(item.session_date)} · {item.session_time}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Target: {item.target}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Companies() {
  const data = useInstitution();
  if (data.loading) return <Loading />;
  return (
    <>
      <PageHeader eyebrow="Companies" title="Recruiting partners" />
      <div className="grid gap-4 md:grid-cols-2">
        {data.companies.map((company) => {
          const posts = data.opportunities.filter(
            (item) => item.company_name === company.company_name,
          );
          return (
            <Card key={company.id}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold">{company.company_name}</h3>
                <Badge tone="success">{posts.length} opening(s)</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {company.industry} · {company.location}
              </p>
              <p className="mt-2 text-sm">{company.about}</p>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Opportunities() {
  const data = useInstitution();
  if (data.loading) return <Loading />;
  return (
    <>
      <PageHeader eyebrow="Opportunities" title="All internships and jobs on CAMPUS" />
      <div className="space-y-3">
        {data.opportunities.map((item) => {
          const applications = data.applications.filter(
            (application) => application.opportunity_id === item.id,
          );
          return (
            <Card key={item.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <Badge tone={item.kind === "Internship" ? "brand" : "warm"}>{item.kind}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.company_name} · {item.location} · closes {formatDate(item.deadline)}
                  </p>
                </div>
                <Badge tone="success">{applications.length} application(s)</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {((item.required_skills ?? []) as string[]).map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Reports() {
  const data = useInstitution();
  if (data.loading) return <Loading />;
  const gaps = commonSkillGaps(data.students);
  const assessed = data.students.filter((student) => student.assessmentsTaken > 0).length;

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Institution skill report"
        description="A summary you can read out in a placement review meeting."
      />
      <Card className="max-w-3xl">
        <h2 className="text-lg">Skill readiness summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>· {data.students.length} students registered, {assessed} have completed an assessment.</li>
          <li>· Average institution skill score is {averageScore(data.students)} out of 100.</li>
          <li>
            · {data.opportunities.length} live opportunities from {data.companies.length} recruiting
            partners, with {data.applications.length} applications submitted.
          </li>
          <li>
            · {data.workshops.length} workshops and seminars scheduled by {data.faculty.length}{" "}
            faculty members.
          </li>
        </ul>

        <h3 className="mt-6 text-base font-semibold">Priority skills for intervention</h3>
        {gaps.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No assessment data yet.</p>
        ) : (
          <ol className="mt-2 space-y-1 text-sm">
            {gaps.slice(0, 5).map((gap, index) => (
              <li key={gap.skill}>
                {index + 1}. {gap.skill} — {gap.percent}% of relevant students need improvement (
                {gap.needing} of {gap.total})
              </li>
            ))}
          </ol>
        )}

        <h3 className="mt-6 text-base font-semibold">Recommended next actions</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {gaps.slice(0, 3).map((gap) => (
            <li key={gap.skill}>· Run a {gap.skill} workshop before the next placement cycle.</li>
          ))}
          {data.students.length - assessed > 0 ? (
            <li>· Follow up with {data.students.length - assessed} student(s) yet to be assessed.</li>
          ) : null}
        </ul>
      </Card>
    </>
  );
}

export function CollegeSection({ session, section }: { session: Session; section: string }) {
  switch (section) {
    case "students":
      return <Students />;
    case "faculty":
      return <Faculty />;
    case "analytics":
      return <Analytics />;
    case "workshops":
      return <SessionList kind="Workshop" />;
    case "seminars":
      return <SessionList kind="Seminar" />;
    case "companies":
      return <Companies />;
    case "opportunities":
      return <Opportunities />;
    case "reports":
      return <Reports />;
    case "notifications":
      return <Notifications session={session} />;
    default:
      return <Dashboard />;
  }
}
