import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { formatDate } from "@/lib/campus";
import { db, type Row } from "@/lib/db";
import { notify, userIdsByRole } from "@/lib/notify";
import { commonSkillGaps, useRoster, type RosterStudent } from "@/lib/roster";
import type { Session } from "@/lib/session";

import { Notifications } from "./student";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  SkillBar,
  Stat,
  SuccessNote,
  inputClass,
} from "./ui";

function GapBar({ skill, percent, needing, total }: { skill: string; percent: number; needing: number; total: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{skill}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {percent}% need improvement ({needing}/{total})
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-accent-warm"
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
    </div>
  );
}

function Dashboard({ session }: { session: Session }) {
  const roster = useRoster();
  const workshops = useQuery({
    queryKey: ["workshops"],
    queryFn: async () => {
      const { data } = await db.from("workshops").select("*").order("session_date");
      return (data ?? []) as Row[];
    },
  });

  if (roster.isLoading) return <Loading />;
  const students = roster.data ?? [];
  const gaps = commonSkillGaps(students).slice(0, 5);
  const needImprovement = students.filter((student) => student.overallScore < 60).length;
  const averageScore = students.length
    ? Math.round(students.reduce((sum, student) => sum + student.overallScore, 0) / students.length)
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="Faculty dashboard"
        title={`Good to see you, ${session.full_name}`}
        description="Live view of student skill progress across your department."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total students" value={students.length} />
        <Stat
          label="Requiring improvement"
          value={needImprovement}
          hint="Overall score below 60"
          tone="warm"
        />
        <Stat label="Average skill score" value={`${averageScore}`} hint="out of 100" />
        <Stat
          label="Workshops & seminars"
          value={(workshops.data ?? []).length}
          tone="success"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Common skill gaps" subtitle="Share of students below 60% for their target role">
          {gaps.length === 0 ? (
            <Empty title="No assessment data yet" />
          ) : (
            <div className="space-y-4">
              {gaps.map((gap) => (
                <GapBar key={gap.skill} {...gap} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Skill progress" subtitle="Every student, latest assessment score">
          <div className="space-y-3">
            {students.map((student) => (
              <div key={student.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{student.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {student.overallScore}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(2, student.overallScore)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-5" title="Upcoming workshops & seminars">
        {(workshops.data ?? []).length === 0 ? (
          <Empty title="Nothing scheduled" />
        ) : (
          <ul className="space-y-2">
            {(workshops.data ?? []).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.faculty_name} · {formatDate(item.session_date)} · {item.session_time}
                  </p>
                </div>
                <Badge tone={item.kind === "Workshop" ? "brand" : "warm"}>{item.kind}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function StudentsList({ detailed }: { detailed: boolean }) {
  const roster = useRoster();
  const [openId, setOpenId] = useState<string | null>(null);
  if (roster.isLoading) return <Loading />;
  const students = roster.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow={detailed ? "Student progress" : "My students"}
        title={detailed ? "Progress and skill profiles" : "Students in your department"}
        description={
          detailed
            ? "Open a student to see their measured skill profile against their career goal."
            : "Everyone currently registered on CAMPUS from your institution."
        }
      />
      {students.length === 0 ? (
        <Card>
          <Empty title="No students registered yet" />
        </Card>
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <Card key={student.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{student.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {student.department} · Year {student.year} · {student.careerGoal ?? "No goal set"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{student.email}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="label-eyebrow">Skill score</p>
                    <p className="font-display text-xl font-semibold text-brand">
                      {student.overallScore}
                    </p>
                  </div>
                  <Badge tone={student.assessmentsTaken > 0 ? "success" : "warm"}>
                    {student.assessmentsTaken > 0 ? "Assessed" : "Pending"}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="label-eyebrow">Strong skills</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {student.strong.length ? (
                      student.strong.map((skill) => (
                        <Badge key={skill} tone="success">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">None yet</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="label-eyebrow">Weak skills</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {student.weak.length ? (
                      student.weak.map((skill) => (
                        <Badge key={skill} tone="warm">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </div>
                </div>
              </div>

              {detailed ? (
                <>
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setOpenId(openId === student.id ? null : student.id)}
                  >
                    {openId === student.id ? "Hide skill profile" : "Open skill profile"}
                  </Button>
                  {openId === student.id ? (
                    <div className="mt-4 space-y-3 rounded-md bg-secondary/60 p-4">
                      {student.required.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          This student has not selected a career goal yet.
                        </p>
                      ) : (
                        student.required.map((skill) => (
                          <SkillBar
                            key={skill}
                            skill={skill}
                            level={student.levels[skill] ?? 0}
                          />
                        ))
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function SkillGaps() {
  const roster = useRoster();
  if (roster.isLoading) return <Loading />;
  const students = roster.data ?? [];
  const gaps = commonSkillGaps(students);

  return (
    <>
      <PageHeader
        eyebrow="Skill gap analysis"
        title="Where your students need the most help"
        description="Calculated from assessment results against each student's target role."
      />
      {gaps.length === 0 ? (
        <Card>
          <Empty title="No assessment data yet" />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card title="Common skill gaps">
            <div className="space-y-4">
              {gaps.map((gap) => (
                <GapBar key={gap.skill} {...gap} />
              ))}
            </div>
          </Card>
          <Card title="Suggested action" subtitle="Top three gaps worth a workshop">
            <ul className="space-y-3">
              {gaps.slice(0, 3).map((gap) => (
                <li key={gap.skill} className="rounded-md border border-border px-3 py-2">
                  <p className="text-sm font-medium">{gap.skill} Fundamentals Workshop</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {gap.needing} of {gap.total} students are below 60% in {gap.skill}.
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}

function SessionsManager({ session, kind }: { session: Session; kind: "Workshop" | "Seminar" }) {
  const queryClient = useQueryClient();
  const roster = useRoster();
  const [form, setForm] = useState({
    title: "",
    skill: "",
    description: "",
    session_date: "",
    session_time: "",
    target: "all",
  });
  const [created, setCreated] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["workshops", kind],
    queryFn: async () => {
      const { data } = await db
        .from("workshops")
        .select("*")
        .eq("kind", kind)
        .order("session_date");
      return (data ?? []) as Row[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const students: RosterStudent[] = roster.data ?? [];
      const targeted =
        form.target === "all"
          ? students
          : students.filter((student) => (student.levels[form.skill] ?? 0) < 60);

      const { error } = await db.from("workshops").insert({
        faculty_id: session.id,
        faculty_name: session.full_name,
        kind,
        title: form.title,
        skill: form.skill,
        description: form.description,
        session_date: form.session_date || null,
        session_time: form.session_time,
        target:
          form.target === "all" ? "All students" : `Students with ${form.skill} below 60%`,
      });
      if (error) throw error;

      await notify(
        targeted.map((student) => student.id),
        `${kind}: ${form.title}`,
        `${session.full_name} scheduled a ${kind.toLowerCase()} on ${form.skill || "skills"} for ${
          form.session_date || "a date to be confirmed"
        } at ${form.session_time || "TBA"}.`,
        "workshop",
      );
      const college = await userIdsByRole("college");
      await notify(
        college,
        `New ${kind.toLowerCase()} scheduled`,
        `${form.title} by ${session.full_name}, targeting ${targeted.length} student(s).`,
        "workshop",
      );
      return targeted.length;
    },
    onSuccess: (count) => {
      setCreated(`${form.title} created. ${count} student(s) notified.`);
      setForm({ title: "", skill: "", description: "", session_date: "", session_time: "", target: "all" });
      queryClient.invalidateQueries();
    },
  });

  const gaps = commonSkillGaps(roster.data ?? []).slice(0, 4);

  return (
    <>
      <PageHeader
        eyebrow={kind === "Workshop" ? "Workshops" : "Seminars"}
        title={`Create and manage ${kind.toLowerCase()}s`}
        description={`Students you target receive a notification the moment the ${kind.toLowerCase()} is created.`}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card title={`New ${kind.toLowerCase()}`}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <Field label={`${kind} title`}>
              <input
                className={inputClass}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Networking Fundamentals Workshop"
                required
              />
            </Field>
            <Field label="Skill" hint={gaps.length ? `Top gaps: ${gaps.map((gap) => gap.skill).join(", ")}` : undefined}>
              <input
                className={inputClass}
                value={form.skill}
                onChange={(event) => setForm({ ...form, skill: event.target.value })}
                placeholder="Networking"
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                className={inputClass}
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.session_date}
                  onChange={(event) => setForm({ ...form, session_date: event.target.value })}
                  required
                />
              </Field>
              <Field label="Time">
                <input
                  className={inputClass}
                  value={form.session_time}
                  onChange={(event) => setForm({ ...form, session_time: event.target.value })}
                  placeholder="10:00 AM - 1:00 PM"
                  required
                />
              </Field>
            </div>
            <Field label="Target students">
              <select
                className={inputClass}
                value={form.target}
                onChange={(event) => setForm({ ...form, target: event.target.value })}
              >
                <option value="all">All students</option>
                <option value="gap">Only students weak in this skill</option>
              </select>
            </Field>
            {create.isError ? <ErrorNote message="Could not create. Please try again." /> : null}
            {created ? <SuccessNote message={created} /> : null}
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : `Create ${kind}`}
            </Button>
          </form>
        </Card>

        <Card title={`Scheduled ${kind.toLowerCase()}s`}>
          {list.isLoading ? (
            <Loading />
          ) : (list.data ?? []).length === 0 ? (
            <Empty title={`No ${kind.toLowerCase()}s scheduled yet`} />
          ) : (
            <ul className="space-y-3">
              {(list.data ?? []).map((item) => (
                <li key={item.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <Badge tone="brand">{item.skill}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {formatDate(item.session_date)} · {item.session_time} · {item.target}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export function FacultySection({ session, section }: { session: Session; section: string }) {
  switch (section) {
    case "students":
      return <StudentsList detailed={false} />;
    case "progress":
      return <StudentsList detailed />;
    case "skill-gaps":
      return <SkillGaps />;
    case "workshops":
      return <SessionsManager session={session} kind="Workshop" />;
    case "seminars":
      return <SessionsManager session={session} kind="Seminar" />;
    case "notifications":
      return <Notifications session={session} />;
    default:
      return <Dashboard session={session} />;
  }
}
