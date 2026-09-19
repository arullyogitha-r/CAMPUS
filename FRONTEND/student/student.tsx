import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { bandOf, formatDate, levelFromAnswers, skillMatchScore } from "@/lib/campus";
import { db, type Row } from "@/lib/db";
import { notify, userIdsByRole } from "@/lib/notify";
import { recommendResources } from "@/lib/recommend.functions";
import type { Session } from "@/lib/session";

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

/* ---------------------------------- data ---------------------------------- */

function useProfile(session: Session) {
  return useQuery({
    queryKey: ["student-profile", session.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("student_profiles")
        .select("*, colleges(name, city)")
        .eq("user_id", session.id)
        .maybeSingle();
      if (error) throw error;
      return data as Row | null;
    },
  });
}

function useRoles() {
  return useQuery({
    queryKey: ["career-roles"],
    queryFn: async () => {
      const { data, error } = await db.from("career_roles").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
}

function useSkills(session: Session) {
  return useQuery({
    queryKey: ["student-skills", session.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("student_skills")
        .select("*")
        .eq("student_id", session.id);
      if (error) throw error;
      const levels: Record<string, number> = {};
      for (const row of (data ?? []) as Row[]) levels[row.skill as string] = row.level as number;
      return levels;
    },
  });
}

function useAnalysis(session: Session) {
  const profile = useProfile(session);
  const roles = useRoles();
  const skills = useSkills(session);

  const goal = (profile.data?.career_goal as string | null) ?? null;
  const role = roles.data?.find((item) => item.name === goal) ?? null;
  const required = (role?.required_skills as string[] | undefined) ?? [];
  const levels = skills.data ?? {};

  const rows = required.map((skill) => ({ skill, level: levels[skill] ?? 0 }));
  const strong = rows.filter((row) => row.level >= 80);
  const good = rows.filter((row) => row.level >= 60 && row.level < 80);
  const improve = rows.filter((row) => row.level >= 40 && row.level < 60);
  const priority = rows.filter((row) => row.level < 40);

  return {
    loading: profile.isLoading || roles.isLoading || skills.isLoading,
    profile: profile.data,
    goal,
    role,
    required,
    levels,
    rows,
    strong,
    good,
    improve,
    priority,
    weak: [...priority, ...improve].sort((a, b) => a.level - b.level),
  };
}

/* -------------------------------- dashboard ------------------------------- */

function Dashboard({ session }: { session: Session }) {
  const analysis = useAnalysis(session);
  const { data: notifications = [] } = useQuery({
    queryKey: ["student-notifications", session.id],
    queryFn: async () => {
      const { data } = await db
        .from("notifications")
        .select("*")
        .eq("user_id", session.id)
        .order("created_at", { ascending: false })
        .limit(4);
      return (data ?? []) as Row[];
    },
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data } = await db.from("resources").select("*");
      return (data ?? []) as Row[];
    },
  });

  if (analysis.loading) return <Loading />;
  const profile = analysis.profile;
  if (!profile) return <Empty title="No student profile found for this account." />;

  const taken = (profile.assessments_taken as number) ?? 0;
  const picks = analysis.weak
    .slice(0, 3)
    .map((entry) => resources.find((resource) => resource.skill === entry.skill))
    .filter(Boolean) as Row[];

  return (
    <>
      <PageHeader
        eyebrow="Student dashboard"
        title={`Welcome back, ${session.full_name.split(" ")[0]}`}
        description={`${(profile.colleges as Row | null)?.name ?? "—"} · ${profile.department} · Year ${profile.year}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Overall skill score" value={`${profile.overall_score}`} hint="out of 100" />
        <Stat
          label="Assessment status"
          value={taken > 0 ? "Completed" : "Pending"}
          hint={taken > 0 ? `${taken} attempt(s) recorded` : "Take it to unlock analysis"}
          tone={taken > 0 ? "success" : "warm"}
        />
        <Stat label="Career goal" value={analysis.goal ?? "Not set"} hint="Target job role" />
        <Stat
          label="Priority skills"
          value={`${analysis.priority.length}`}
          hint="Below 40% for your goal"
          tone="warm"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Skill gap summary"
          subtitle={analysis.goal ? `Measured against ${analysis.goal}` : "Select a career goal first"}
          action={
            <Link
              to="/app/$role/$section"
              params={{ role: "student", section: "analysis" }}
              className="text-xs font-medium text-brand hover:underline"
            >
              Full analysis
            </Link>
          }
        >
          {analysis.rows.length === 0 ? (
            <Empty
              title="Nothing to compare yet"
              hint="Choose a career goal and complete the skill assessment."
            />
          ) : (
            <div className="space-y-4">
              {analysis.rows.slice(0, 4).map((row) => (
                <SkillBar key={row.skill} skill={row.skill} level={row.level} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Notifications" subtitle="Latest updates for you">
          {notifications.length === 0 ? (
            <Empty title="No notifications yet" />
          ) : (
            <ul className="space-y-3">
              {notifications.map((item) => (
                <li key={item.id as string} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card
          title="Recommended next steps"
          subtitle="Based on your weakest skills"
          action={
            <Link
              to="/app/$role/$section"
              params={{ role: "student", section: "resources" }}
              className="text-xs font-medium text-brand hover:underline"
            >
              All resources
            </Link>
          }
        >
          {picks.length === 0 ? (
            <Empty title="Complete the assessment to get recommendations" />
          ) : (
            <ul className="space-y-2">
              {picks.map((resource) => (
                <li
                  key={resource.id as string}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{resource.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {resource.skill} · {resource.difficulty} · {resource.hours}h
                    </p>
                  </div>
                  <Badge tone="brand">{resource.type}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Internship & job alerts"
          subtitle="Openings shared by companies"
          action={
            <Link
              to="/app/$role/$section"
              params={{ role: "student", section: "jobs" }}
              className="text-xs font-medium text-brand hover:underline"
            >
              Browse all
            </Link>
          }
        >
          <OpportunityTeaser />
        </Card>
      </div>
    </>
  );
}

function OpportunityTeaser() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const { data } = await db
        .from("opportunities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);
      return (data ?? []) as Row[];
    },
  });
  if (isLoading) return <Loading />;
  if (data.length === 0) return <Empty title="No openings posted yet" />;
  return (
    <ul className="space-y-2">
      {data.map((item) => (
        <li key={item.id as string} className="rounded-md border border-border px-3 py-2">
          <p className="text-sm font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.company_name} · {item.location} · {item.kind}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- profile -------------------------------- */

function Profile({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const profile = useProfile(session);
  const skills = useSkills(session);
  const roles = useRoles();
  const [form, setForm] = useState({ full_name: "", department: "", year: 1, interests: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile.data) {
      setForm({
        full_name: session.full_name,
        department: (profile.data.department as string) ?? "",
        year: (profile.data.year as number) ?? 1,
        interests: ((profile.data.interests as string[]) ?? []).join(", "),
      });
    }
  }, [profile.data, session.full_name]);

  const save = useMutation({
    mutationFn: async () => {
      const interests = form.interests
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const { error: userError } = await db
        .from("users")
        .update({ full_name: form.full_name })
        .eq("id", session.id);
      if (userError) throw userError;
      const { error } = await db
        .from("student_profiles")
        .update({ department: form.department, year: Number(form.year), interests })
        .eq("user_id", session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["student-profile", session.id] });
      window.setTimeout(() => setSaved(false), 3000);
    },
  });

  if (profile.isLoading) return <Loading />;
  if (!profile.data) return <Empty title="Profile not found" />;

  const levels = skills.data ?? {};
  const skillEntries = Object.entries(levels).sort((a, b) => b[1] - a[1]);
  const goalRole = roles.data?.find((role) => role.name === profile.data?.career_goal);

  return (
    <>
      <PageHeader
        eyebrow="Student profile"
        title="Your profile"
        description="Keep this current — faculty and companies see these details."
      />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card title="Edit details">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <Field label="Full name">
              <input
                className={inputClass}
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                required
              />
            </Field>
            <Field label="Email">
              <input className={inputClass} value={session.email} readOnly disabled />
            </Field>
            <Field label="College">
              <input
                className={inputClass}
                value={(profile.data.colleges as Row | null)?.name ?? "—"}
                readOnly
                disabled
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department">
                <input
                  className={inputClass}
                  value={form.department}
                  onChange={(event) => setForm({ ...form, department: event.target.value })}
                  required
                />
              </Field>
              <Field label="Current year">
                <select
                  className={inputClass}
                  value={form.year}
                  onChange={(event) => setForm({ ...form, year: Number(event.target.value) })}
                >
                  {[1, 2, 3, 4].map((year) => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Interests" hint="Comma separated">
              <input
                className={inputClass}
                value={form.interests}
                onChange={(event) => setForm({ ...form, interests: event.target.value })}
              />
            </Field>
            {save.isError ? <ErrorNote message="Could not save. Please try again." /> : null}
            {saved ? <SuccessNote message="Profile updated and saved to the database." /> : null}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Card>

        <div className="space-y-5">
          <Card title="Academic summary">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="label-eyebrow">Career goal</dt>
                <dd className="mt-1 font-medium">{(profile.data.career_goal as string) ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="label-eyebrow">Overall skill score</dt>
                <dd className="mt-1 font-medium">{profile.data.overall_score as number}/100</dd>
              </div>
              <div>
                <dt className="label-eyebrow">Assessments completed</dt>
                <dd className="mt-1 font-medium">{profile.data.assessments_taken as number}</dd>
              </div>
              <div>
                <dt className="label-eyebrow">Skills tracked</dt>
                <dd className="mt-1 font-medium">{skillEntries.length}</dd>
              </div>
            </dl>
            {goalRole ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(goalRole.required_skills as string[]).map((skill) => (
                  <Badge key={skill} tone="brand">
                    {skill}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Card>

          <Card title="Measured skills" subtitle="Updated after every assessment">
            {skillEntries.length === 0 ? (
              <Empty title="No skills measured yet" hint="Complete the skill assessment." />
            ) : (
              <div className="space-y-3">
                {skillEntries.map(([skill, level]) => (
                  <SkillBar key={skill} skill={skill} level={level} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ------------------------------- career goal ------------------------------ */

function CareerGoal({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const profile = useProfile(session);
  const roles = useRoles();
  const [saved, setSaved] = useState<string | null>(null);

  const select = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await db
        .from("student_profiles")
        .update({ career_goal: name })
        .eq("user_id", session.id);
      if (error) throw error;
      await notify(
        [session.id],
        `Career goal set: ${name}`,
        `Your skill analysis and recommendations now target the ${name} role.`,
        "goal",
      );
      return name;
    },
    onSuccess: (name) => {
      setSaved(name);
      queryClient.invalidateQueries({ queryKey: ["student-profile", session.id] });
      queryClient.invalidateQueries({ queryKey: ["unread", session.id] });
    },
  });

  if (roles.isLoading || profile.isLoading) return <Loading />;
  const current = (profile.data?.career_goal as string) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Career goal"
        title="Choose your target role"
        description="Your assessment, skill analysis and recommendations are all measured against this role."
      />
      {saved ? <SuccessNote message={`Career goal updated to ${saved}.`} /> : null}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.data?.map((role) => {
          const active = role.name === current;
          return (
            <Card key={role.id as string} className={active ? "ring-2 ring-brand" : undefined}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold">{role.name as string}</h3>
                {active ? <Badge tone="success">Selected</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{role.description as string}</p>
              <p className="label-eyebrow mt-4">Important skills</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(role.required_skills as string[]).map((skill) => (
                  <Badge key={skill} tone="brand">
                    {skill}
                  </Badge>
                ))}
              </div>
              <Button
                className="mt-4 w-full"
                variant={active ? "secondary" : "primary"}
                disabled={active || select.isPending}
                onClick={() => select.mutate(role.name as string)}
              >
                {active ? "Current goal" : "Set as career goal"}
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------- assessment ------------------------------- */

function Assessment({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const analysis = useAnalysis(session);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null);

  const goal = analysis.goal;
  const required = analysis.required;

  const questions = useQuery({
    queryKey: ["assessment-questions", goal],
    enabled: started && !!goal,
    queryFn: async () => {
      const { data: aptitude } = await db
        .from("assessment_questions")
        .select("*")
        .eq("section", "aptitude");
      const { data: technical } = await db
        .from("assessment_questions")
        .select("*")
        .eq("section", "technical")
        .in("skill", required.length ? required : ["Python"]);
      return [...((aptitude ?? []) as Row[]), ...((technical ?? []) as Row[])];
    },
  });

  const list = questions.data ?? [];

  const submit = useMutation({
    mutationFn: async () => {
      let correct = 0;
      const perSkill: Record<string, { correct: number; total: number }> = {};
      for (const question of list) {
        const selected = answers[question.id as string];
        const isCorrect = selected === (question.correct_index as number);
        if (isCorrect) correct += 1;
        if (question.section === "technical") {
          const skill = question.skill as string;
          perSkill[skill] = perSkill[skill] ?? { correct: 0, total: 0 };
          perSkill[skill].total += 1;
          if (isCorrect) perSkill[skill].correct += 1;
        }
      }
      const score = list.length ? Math.round((correct / list.length) * 100) : 0;

      const { data: assessment, error } = await db
        .from("assessments")
        .insert({
          student_id: session.id,
          career_goal: goal,
          score,
          total_questions: list.length,
          correct_answers: correct,
        })
        .select()
        .single();
      if (error) throw error;

      await db.from("assessment_answers").insert(
        list.map((question) => ({
          assessment_id: (assessment as Row).id,
          question_id: question.id,
          selected_index: answers[question.id as string] ?? null,
          is_correct: answers[question.id as string] === (question.correct_index as number),
        })),
      );

      await db.from("student_skills").upsert(
        Object.entries(perSkill).map(([skill, stats]) => ({
          student_id: session.id,
          skill,
          level: levelFromAnswers(stats.correct, stats.total),
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "student_id,skill" },
      );

      const taken = ((analysis.profile?.assessments_taken as number) ?? 0) + 1;
      await db
        .from("student_profiles")
        .update({ overall_score: score, assessments_taken: taken })
        .eq("user_id", session.id);

      await notify(
        [session.id],
        "Skill assessment submitted",
        `You scored ${score}/100. Your skill analysis and recommendations have been refreshed.`,
        "assessment",
      );
      const faculty = await userIdsByRole("faculty");
      await notify(
        faculty,
        "Student assessment update",
        `${session.full_name} completed the ${goal} assessment with a score of ${score}.`,
        "assessment",
      );
      const college = await userIdsByRole("college");
      await notify(
        college,
        "Skill gap report updated",
        `A new assessment result from ${session.full_name} is included in institution analytics.`,
        "report",
      );

      return { score, correct, total: list.length };
    },
    onSuccess: (value) => {
      setResult(value);
      setStarted(false);
      queryClient.invalidateQueries();
    },
  });

  if (analysis.loading) return <Loading />;

  if (!goal) {
    return (
      <>
        <PageHeader eyebrow="Skill assessment" title="Set a career goal first" />
        <Card>
          <Empty
            title="No career goal selected"
            hint="The assessment adapts to the role you are targeting. Pick one under Career Goal."
          />
        </Card>
      </>
    );
  }

  if (result) {
    return (
      <>
        <PageHeader eyebrow="Skill assessment" title="Assessment submitted" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Score" value={`${result.score}/100`} tone="success" />
          <Stat label="Correct answers" value={`${result.correct} of ${result.total}`} />
          <Stat label="Recorded on" value={formatDate(new Date().toISOString())} />
        </div>
        <Card className="mt-5">
          <p className="text-sm text-muted-foreground">
            Your per-skill levels, overall score and answer sheet were saved. Faculty and college
            dashboards have been notified.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/app/$role/$section" params={{ role: "student", section: "analysis" }}>
              <Button>View skill analysis</Button>
            </Link>
            <Link to="/app/$role/$section" params={{ role: "student", section: "resources" }}>
              <Button variant="secondary">See recommended resources</Button>
            </Link>
          </div>
        </Card>
      </>
    );
  }

  if (!started) {
    return (
      <>
        <PageHeader
          eyebrow="Skill assessment"
          title={`${goal} assessment`}
          description="Section A covers aptitude. Section B covers technical and scenario questions for your target role."
        />
        <Card>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>· Section A — logical reasoning, quantitative aptitude and problem solving</li>
            <li>· Section B — technical multiple-choice and real-world scenario questions</li>
            <li>· You can move back and forth before submitting</li>
            <li>· Results update your skill levels, analysis and recommendations</li>
          </ul>
          <Button
            className="mt-5"
            onClick={() => {
              setStarted(true);
              setIndex(0);
              setAnswers({});
            }}
          >
            Start Assessment
          </Button>
        </Card>
      </>
    );
  }

  if (questions.isLoading) return <Loading label="Preparing your question paper…" />;
  if (list.length === 0) return <Empty title="No questions available for this role yet." />;

  const question = list[index]!;
  const answered = Object.keys(answers).length;

  return (
    <>
      <PageHeader
        eyebrow={question.section === "aptitude" ? "Section A — Aptitude" : "Section B — Technical"}
        title={`Question ${index + 1} of ${list.length}`}
        description={`${answered} answered · ${question.skill as string}`}
      />
      <Card>
        <p className="text-base font-medium text-foreground">{question.question as string}</p>
        <div className="mt-4 space-y-2">
          {(question.options as string[]).map((option, optionIndex) => {
            const selected = answers[question.id as string] === optionIndex;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setAnswers({ ...answers, [question.id as string]: optionIndex })}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                  selected ? "border-brand bg-brand-soft font-medium" : "border-border hover:bg-secondary"
                }`}
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-current font-mono text-[10px]">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                {option}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={index >= list.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next
          </Button>
          <Button
            variant="warm"
            className="ml-auto"
            disabled={submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "Submitting…" : "Submit Assessment"}
          </Button>
        </div>
        {answered < list.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {list.length - answered} question(s) unanswered — they will be marked incorrect.
          </p>
        ) : null}
        {submit.isError ? <ErrorNote message="Submission failed. Please try again." /> : null}
      </Card>
    </>
  );
}

/* -------------------------------- analysis -------------------------------- */

function Analysis({ session }: { session: Session }) {
  const analysis = useAnalysis(session);
  if (analysis.loading) return <Loading />;
  if (!analysis.goal)
    return (
      <Card>
        <Empty title="Select a career goal to see your skill analysis" />
      </Card>
    );
  if (analysis.rows.every((row) => row.level === 0))
    return (
      <>
        <PageHeader eyebrow="Skill analysis" title={`Against ${analysis.goal}`} />
        <Card>
          <Empty
            title="No measured skills yet"
            hint="Complete the skill assessment to generate your gap analysis."
          />
        </Card>
      </>
    );

  const groups = [
    { title: "Strong skills", rows: analysis.strong, tone: "success" as const },
    { title: "On track", rows: analysis.good, tone: "brand" as const },
    { title: "Skills to improve", rows: analysis.improve, tone: "neutral" as const },
    { title: "Priority skills", rows: analysis.priority, tone: "warm" as const },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Skill analysis"
        title={`Your skills against ${analysis.goal}`}
        description="Bands: 80-100 Strong · 60-79 Good · 40-59 Needs Improvement · below 40 Priority."
      />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Current vs required" subtitle="Target level for each required skill is 80%">
          <div className="space-y-4">
            {analysis.rows.map((row) => (
              <SkillBar key={row.skill} skill={row.skill} level={row.level} />
            ))}
          </div>
        </Card>
        <div className="space-y-5">
          {groups.map((group) => (
            <Card key={group.title} title={group.title}>
              {group.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">None in this band.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {group.rows.map((row) => (
                    <Badge key={row.skill} tone={group.tone}>
                      {row.skill} · {row.level}%
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------- resources ------------------------------- */

function Resources({ session }: { session: Session }) {
  const analysis = useAnalysis(session);
  const recommend = useServerFn(recommendResources);
  const [startedIds, setStartedIds] = useState<string[]>([]);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data } = await db.from("resources").select("*");
      return (data ?? []) as Row[];
    },
  });

  const weak = analysis.weak;

  const recommendation = useQuery({
    queryKey: ["recommendations", session.id, analysis.goal, weak.map((w) => `${w.skill}:${w.level}`).join("|")],
    enabled: !!analysis.goal && resources.length > 0 && weak.length > 0,
    queryFn: async () =>
      recommend({
        data: {
          careerGoal: analysis.goal ?? "",
          weakSkills: weak,
          resources: resources.map((resource) => ({
            id: resource.id as string,
            title: resource.title as string,
            skill: resource.skill as string,
            difficulty: resource.difficulty as string,
            hours: resource.hours as number,
            type: resource.type as string,
          })),
        },
      }),
  });

  if (analysis.loading || isLoading) return <Loading />;
  if (!analysis.goal)
    return (
      <Card>
        <Empty title="Select a career goal to get recommendations" />
      </Card>
    );

  const items = recommendation.data?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="AI-Powered Learning Recommendations"
        title="Resources for your skill gaps"
        description={`Ranked for ${analysis.goal}. ${
          recommendation.data?.source === "ai"
            ? "Generated by the AI recommendation engine."
            : "Generated by the built-in rule-based recommendation engine."
        }`}
      />
      {weak.length === 0 ? (
        <Card>
          <Empty
            title="No gaps detected"
            hint="Every required skill is at 60% or above. Take the assessment again to re-check."
          />
        </Card>
      ) : recommendation.isLoading ? (
        <Loading label="Building your learning plan…" />
      ) : items.length === 0 ? (
        <Card>
          <Empty title="No matching resources found" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const resource = resources.find((entry) => entry.id === item.id);
            if (!resource) return null;
            const started = startedIds.includes(item.id);
            return (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold">{resource.title as string}</h3>
                  <Badge tone="warm">{resource.skill as string}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="label-eyebrow">Difficulty</dt>
                    <dd className="mt-0.5 font-medium">{resource.difficulty as string}</dd>
                  </div>
                  <div>
                    <dt className="label-eyebrow">Time</dt>
                    <dd className="mt-0.5 font-medium">{resource.hours as number} hours</dd>
                  </div>
                  <div>
                    <dt className="label-eyebrow">Type</dt>
                    <dd className="mt-0.5 font-medium">{resource.type as string}</dd>
                  </div>
                </dl>
                <a
                  href={resource.url as string}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setStartedIds([...startedIds, item.id])}
                >
                  <Button className="mt-4 w-full">
                    {started ? "Continue learning" : "Start Learning"}
                  </Button>
                </a>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  {resource.provider as string}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------------------------------- jobs ---------------------------------- */

function Jobs({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const skills = useSkills(session);
  const profile = useProfile(session);
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const applications = useQuery({
    queryKey: ["applications", session.id],
    queryFn: async () => {
      const { data } = await db.from("applications").select("*").eq("student_id", session.id);
      return (data ?? []) as Row[];
    },
  });

  const savedItems = useQuery({
    queryKey: ["saved", session.id],
    queryFn: async () => {
      const { data } = await db
        .from("saved_opportunities")
        .select("*")
        .eq("student_id", session.id);
      return (data ?? []) as Row[];
    },
  });

  const apply = useMutation({
    mutationFn: async (opportunity: Row) => {
      const match = skillMatchScore(
        (opportunity.required_skills as string[]) ?? [],
        skills.data ?? {},
        (profile.data?.overall_score as number) ?? 0,
      );
      const { error } = await db.from("applications").insert({
        opportunity_id: opportunity.id,
        student_id: session.id,
        match_score: match.score,
      });
      if (error) throw error;
      await notify(
        [opportunity.company_id as string],
        "New application received",
        `${session.full_name} applied for ${opportunity.title} with a Skill Match Score of ${match.score}%.`,
        "application",
      );
      await notify(
        [session.id],
        "Application submitted",
        `Your application for ${opportunity.title} at ${opportunity.company_name} was recorded.`,
        "application",
      );
      return opportunity.title as string;
    },
    onSuccess: (title) => {
      setMessage(`Applied to ${title}. The company has been notified.`);
      queryClient.invalidateQueries();
    },
    onError: () => setMessage("You have already applied to this opportunity."),
  });

  const save = useMutation({
    mutationFn: async (opportunity: Row) => {
      const { error } = await db
        .from("saved_opportunities")
        .insert({ opportunity_id: opportunity.id, student_id: session.id });
      if (error) throw error;
      return opportunity.title as string;
    },
    onSuccess: (title) => {
      setMessage(`Saved ${title} for later.`);
      queryClient.invalidateQueries({ queryKey: ["saved", session.id] });
    },
    onError: () => setMessage("That opportunity is already saved."),
  });

  if (opportunities.isLoading) return <Loading />;

  const appliedIds = new Set((applications.data ?? []).map((row) => row.opportunity_id as string));
  const savedIds = new Set((savedItems.data ?? []).map((row) => row.opportunity_id as string));

  return (
    <>
      <PageHeader
        eyebrow="Internships & jobs"
        title="Opportunities posted by companies"
        description="Every posting here comes from a company account in CAMPUS."
      />
      {message ? <SuccessNote message={message} /> : null}
      {opportunities.data?.length === 0 ? (
        <Card>
          <Empty title="No opportunities posted yet" />
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {opportunities.data?.map((item) => {
            const match = skillMatchScore(
              (item.required_skills as string[]) ?? [],
              skills.data ?? {},
              (profile.data?.overall_score as number) ?? 0,
            );
            const applied = appliedIds.has(item.id as string);
            const open = openId === item.id;
            return (
              <Card key={item.id as string}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{item.title as string}</h3>
                      <Badge tone={item.kind === "Internship" ? "brand" : "warm"}>
                        {item.kind as string}
                      </Badge>
                      {applied ? <Badge tone="success">Applied</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.company_name as string} · {item.location as string} ·{" "}
                      {item.duration as string}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="label-eyebrow">Skill Match Score</p>
                    <p className="font-display text-xl font-semibold text-brand">{match.score}%</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {((item.required_skills as string[]) ?? []).map((skill) => (
                    <Badge key={skill} tone={match.matching.includes(skill) ? "success" : "neutral"}>
                      {skill}
                    </Badge>
                  ))}
                </div>

                {open ? (
                  <div className="mt-4 space-y-3 rounded-md bg-secondary/60 p-4 text-sm">
                    <p>{item.description as string}</p>
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="label-eyebrow">Eligibility</dt>
                        <dd className="mt-0.5">{item.qualification as string}</dd>
                      </div>
                      <div>
                        <dt className="label-eyebrow">Stipend / CTC</dt>
                        <dd className="mt-0.5">{(item.stipend as string) || "Not disclosed"}</dd>
                      </div>
                      <div>
                        <dt className="label-eyebrow">Deadline</dt>
                        <dd className="mt-0.5">{formatDate(item.deadline as string)}</dd>
                      </div>
                      <div>
                        <dt className="label-eyebrow">Skills you still need</dt>
                        <dd className="mt-0.5">
                          {match.missing.length ? match.missing.join(", ") : "None — you match all"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setOpenId(open ? null : (item.id as string))}>
                    {open ? "Hide details" : "View Details"}
                  </Button>
                  <Button disabled={applied || apply.isPending} onClick={() => apply.mutate(item)}>
                    {applied ? "Applied" : "Apply"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={savedIds.has(item.id as string)}
                    onClick={() => save.mutate(item)}
                  >
                    {savedIds.has(item.id as string) ? "Saved" : "Save"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ------------------------------ notifications ----------------------------- */

export function Notifications({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["notifications", session.id],
    queryFn: async () => {
      const { data } = await db
        .from("notifications")
        .select("*")
        .eq("user_id", session.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Row[];
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await db.from("notifications").update({ is_read: true }).eq("user_id", session.id);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await db.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (isLoading) return <Loading />;

  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Your alerts"
        description="Generated automatically when other roles act in CAMPUS."
        action={
          <Button variant="secondary" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            Mark all as read
          </Button>
        }
      />
      {data.length === 0 ? (
        <Card>
          <Empty title="No notifications yet" />
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((item) => (
            <Card key={item.id as string} className={item.is_read ? "opacity-70" : undefined}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{item.title as string}</p>
                    <Badge tone="neutral">{item.category as string}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body as string}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(item.created_at as string)}
                  </p>
                </div>
                {!item.is_read ? (
                  <Button variant="ghost" onClick={() => markOne.mutate(item.id as string)}>
                    Mark read
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* --------------------------------- router --------------------------------- */

export function StudentSection({ session, section }: { session: Session; section: string }) {
  const map = useMemo(
    () => ({
      dashboard: <Dashboard session={session} />,
      profile: <Profile session={session} />,
      "career-goal": <CareerGoal session={session} />,
      assessment: <Assessment session={session} />,
      analysis: <Analysis session={session} />,
      resources: <Resources session={session} />,
      jobs: <Jobs session={session} />,
      notifications: <Notifications session={session} />,
    }),
    [session],
  );
  return map[section as keyof typeof map] ?? <Dashboard session={session} />;
}

export { bandOf };
