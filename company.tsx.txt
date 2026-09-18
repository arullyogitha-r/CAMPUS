import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { formatDate, skillMatchScore } from "@/lib/campus";
import { db, type Row } from "@/lib/db";
import { notify, userIdsByRole } from "@/lib/notify";
import { useRoster } from "@/lib/roster";
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
  Stat,
  SuccessNote,
  inputClass,
} from "./ui";

function useCompany(session: Session) {
  return useQuery({
    queryKey: ["company-profile", session.id],
    queryFn: async () => {
      const { data } = await db
        .from("company_profiles")
        .select("*")
        .eq("user_id", session.id)
        .maybeSingle();
      return data as Row | null;
    },
  });
}

function useOpportunities(session: Session) {
  return useQuery({
    queryKey: ["company-opportunities", session.id],
    queryFn: async () => {
      const { data } = await db
        .from("opportunities")
        .select("*")
        .eq("company_id", session.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Row[];
    },
  });
}

function useApplications(session: Session) {
  return useQuery({
    queryKey: ["company-applications", session.id],
    queryFn: async () => {
      const { data } = await db
        .from("applications")
        .select("*, opportunities!inner(title, company_id), users:student_id(full_name, email)")
        .eq("opportunities.company_id", session.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Row[];
    },
  });
}

function Dashboard({ session }: { session: Session }) {
  const company = useCompany(session);
  const opportunities = useOpportunities(session);
  const applications = useApplications(session);
  const roster = useRoster();
  const sessions = useQuery({
    queryKey: ["info-sessions", session.id],
    queryFn: async () => {
      const { data } = await db.from("info_sessions").select("*").eq("company_id", session.id);
      return (data ?? []) as Row[];
    },
  });

  if (opportunities.isLoading || roster.isLoading) return <Loading />;
  const list = opportunities.data ?? [];
  const internships = list.filter((item) => item.kind === "Internship").length;
  const jobs = list.filter((item) => item.kind === "Full-time").length;

  const allRequired = Array.from(new Set(list.flatMap((item) => item.required_skills ?? [])));
  const matching = (roster.data ?? []).filter(
    (student) =>
      skillMatchScore(allRequired, student.levels, student.overallScore).score >= 50,
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Company dashboard"
        title={company.data?.company_name ?? session.full_name}
        description={
          company.data
            ? `${company.data.industry} · ${company.data.location}`
            : "Campus hiring workspace"
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active internships" value={internships} />
        <Stat label="Active jobs" value={jobs} />
        <Stat label="Applications" value={(applications.data ?? []).length} tone="success" />
        <Stat label="Matching students" value={matching} hint="50%+ Skill Match Score" tone="warm" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Recent applications">
          {(applications.data ?? []).length === 0 ? (
            <Empty title="No applications yet" />
          ) : (
            <ul className="space-y-2">
              {(applications.data ?? []).slice(0, 6).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{item.users?.full_name ?? "Student"}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.opportunities?.title} · {formatDate(item.created_at)}
                    </p>
                  </div>
                  <Badge tone="brand">{item.match_score}% match</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Upcoming info sessions">
          {(sessions.data ?? []).length === 0 ? (
            <Empty title="No sessions scheduled" />
          ) : (
            <ul className="space-y-2">
              {(sessions.data ?? []).map((item) => (
                <li key={item.id} className="rounded-md border border-border px-3 py-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.session_date)} · {item.session_time}
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

function CompanyProfile({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const company = useCompany(session);
  const [form, setForm] = useState({ company_name: "", industry: "", location: "", about: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (company.data) {
      setForm({
        company_name: company.data.company_name ?? "",
        industry: company.data.industry ?? "",
        location: company.data.location ?? "",
        about: company.data.about ?? "",
      });
    }
  }, [company.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("company_profiles").update(form).eq("user_id", session.id);
      if (error) throw error;
      await db.from("users").update({ full_name: form.company_name }).eq("id", session.id);
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries();
      window.setTimeout(() => setSaved(false), 3000);
    },
  });

  if (company.isLoading) return <Loading />;

  return (
    <>
      <PageHeader eyebrow="Company profile" title="Your company details" />
      <Card className="max-w-2xl">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Company name">
            <input
              className={inputClass}
              value={form.company_name}
              onChange={(event) => setForm({ ...form, company_name: event.target.value })}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Industry">
              <input
                className={inputClass}
                value={form.industry}
                onChange={(event) => setForm({ ...form, industry: event.target.value })}
              />
            </Field>
            <Field label="Location">
              <input
                className={inputClass}
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              />
            </Field>
          </div>
          <Field label="About">
            <textarea
              className={inputClass}
              rows={4}
              value={form.about}
              onChange={(event) => setForm({ ...form, about: event.target.value })}
            />
          </Field>
          {saved ? <SuccessNote message="Company profile saved." /> : null}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Card>
    </>
  );
}

function PostOpportunity({ session, kind }: { session: Session; kind: "Internship" | "Full-time" }) {
  const queryClient = useQueryClient();
  const company = useCompany(session);
  const [form, setForm] = useState({
    title: "",
    description: "",
    required_skills: "",
    qualification: "",
    location: "",
    duration: "",
    stipend: "",
    deadline: "",
  });
  const [posted, setPosted] = useState<string | null>(null);

  const post = useMutation({
    mutationFn: async () => {
      const skills = form.required_skills
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const companyName = company.data?.company_name ?? session.full_name;
      const { error } = await db.from("opportunities").insert({
        company_id: session.id,
        company_name: companyName,
        title: form.title,
        kind,
        description: form.description,
        required_skills: skills,
        qualification: form.qualification,
        location: form.location,
        duration: form.duration,
        stipend: form.stipend,
        deadline: form.deadline || null,
      });
      if (error) throw error;

      const students = await userIdsByRole("student");
      await notify(
        students,
        `New ${kind === "Internship" ? "internship" : "job"}: ${form.title}`,
        `${companyName} is hiring for ${form.title} in ${form.location || "multiple locations"}. Skills: ${skills.join(", ")}.`,
        "opportunity",
      );
      const college = await userIdsByRole("college");
      await notify(
        college,
        "New company opportunity",
        `${companyName} posted ${form.title} (${kind}).`,
        "opportunity",
      );
      return form.title;
    },
    onSuccess: (title) => {
      setPosted(`${title} is now live for students and visible in your opportunities.`);
      setForm({
        title: "",
        description: "",
        required_skills: "",
        qualification: "",
        location: "",
        duration: "",
        stipend: "",
        deadline: "",
      });
      queryClient.invalidateQueries();
    },
  });

  return (
    <>
      <PageHeader
        eyebrow={kind === "Internship" ? "Post internship" : "Post job"}
        title={`Post a new ${kind === "Internship" ? "internship" : "full-time role"}`}
        description="Posting notifies every student and immediately appears in their Internships & Jobs page."
      />
      <Card className="max-w-2xl">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            post.mutate();
          }}
        >
          <Field label="Job title">
            <input
              className={inputClass}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder={kind === "Internship" ? "Cloud Engineering Intern" : "Site Reliability Engineer"}
              required
            />
          </Field>
          <Field label="Type">
            <input className={inputClass} value={kind} readOnly disabled />
          </Field>
          <Field label="Description">
            <textarea
              className={inputClass}
              rows={4}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              required
            />
          </Field>
          <Field label="Required skills" hint="Comma separated — used for the Skill Match Score">
            <input
              className={inputClass}
              value={form.required_skills}
              onChange={(event) => setForm({ ...form, required_skills: event.target.value })}
              placeholder="AWS, Python, Networking, Linux"
              required
            />
          </Field>
          <Field label="Minimum qualification">
            <input
              className={inputClass}
              value={form.qualification}
              onChange={(event) => setForm({ ...form, qualification: event.target.value })}
              placeholder="B.E./B.Tech, 3rd or 4th year"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location">
              <input
                className={inputClass}
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                required
              />
            </Field>
            <Field label="Duration">
              <input
                className={inputClass}
                value={form.duration}
                onChange={(event) => setForm({ ...form, duration: event.target.value })}
                placeholder={kind === "Internship" ? "6 months" : "Permanent"}
                required
              />
            </Field>
            <Field label="Stipend / CTC">
              <input
                className={inputClass}
                value={form.stipend}
                onChange={(event) => setForm({ ...form, stipend: event.target.value })}
                placeholder="INR 25,000/month"
              />
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                className={inputClass}
                value={form.deadline}
                onChange={(event) => setForm({ ...form, deadline: event.target.value })}
                required
              />
            </Field>
          </div>
          {post.isError ? <ErrorNote message="Could not post. Please try again." /> : null}
          {posted ? <SuccessNote message={posted} /> : null}
          <Button type="submit" variant="warm" disabled={post.isPending}>
            {post.isPending ? "Posting…" : "Post Opportunity"}
          </Button>
        </form>
      </Card>
    </>
  );
}

function MyOpportunities({ session }: { session: Session }) {
  const opportunities = useOpportunities(session);
  const applications = useApplications(session);
  if (opportunities.isLoading) return <Loading />;
  const list = opportunities.data ?? [];

  return (
    <>
      <PageHeader eyebrow="My opportunities" title="Everything you have posted" />
      {list.length === 0 ? (
        <Card>
          <Empty title="Nothing posted yet" hint="Use Post Internship or Post Job to publish a role." />
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((item) => {
            const applicants = (applications.data ?? []).filter(
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
                      {item.location} · {item.duration} · closes {formatDate(item.deadline)}
                    </p>
                  </div>
                  <Badge tone="success">{applicants.length} application(s)</Badge>
                </div>
                <p className="mt-3 text-sm">{item.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(item.required_skills ?? []).map((skill: string) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                </div>
                {applicants.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {applicants.map((application) => (
                      <li
                        key={application.id}
                        className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-2 text-sm"
                      >
                        <span>{application.users?.full_name ?? "Student"}</span>
                        <span className="font-mono text-xs">{application.match_score}% match</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Matching({ session }: { session: Session }) {
  const opportunities = useOpportunities(session);
  const roster = useRoster();
  const [selected, setSelected] = useState<string | null>(null);

  if (opportunities.isLoading || roster.isLoading) return <Loading />;
  const list = opportunities.data ?? [];
  const active = list.find((item) => item.id === selected) ?? list[0];

  if (!active)
    return (
      <>
        <PageHeader eyebrow="Student matching" title="Skill Match Score" />
        <Card>
          <Empty title="Post an opportunity to see matching students" />
        </Card>
      </>
    );

  const required: string[] = active.required_skills ?? [];
  const ranked = (roster.data ?? [])
    .map((student) => ({
      student,
      ...skillMatchScore(required, student.levels, student.overallScore),
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <>
      <PageHeader
        eyebrow="Student matching"
        title="Skill Match Score"
        description="A transparent weighted comparison of student skill levels against your required skills — not machine learning."
      />
      <Card title="Choose an opportunity">
        <div className="flex flex-wrap gap-2">
          {list.map((item) => (
            <Button
              key={item.id}
              variant={item.id === active.id ? "primary" : "secondary"}
              onClick={() => setSelected(item.id)}
            >
              {item.title}
            </Button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {required.map((skill) => (
            <Badge key={skill} tone="brand">
              {skill}
            </Badge>
          ))}
        </div>
      </Card>

      <div className="mt-5 space-y-3">
        {ranked.map((entry, index) => (
          <Card key={entry.student.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold">
                  {index + 1}. {entry.student.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {entry.student.department} · Year {entry.student.year} ·{" "}
                  {entry.student.careerGoal ?? "No goal set"}
                </p>
              </div>
              <div className="text-right">
                <p className="label-eyebrow">Skill Match Score</p>
                <p className="font-display text-2xl font-semibold text-brand">{entry.score}%</p>
                <p className="text-xs text-muted-foreground">
                  Assessment score {entry.student.overallScore}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="label-eyebrow">Matching skills</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {entry.matching.length ? (
                    entry.matching.map((skill) => (
                      <Badge key={skill} tone="success">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </div>
              </div>
              <div>
                <p className="label-eyebrow">Missing skills</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {entry.missing.length ? (
                    entry.missing.map((skill) => (
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
          </Card>
        ))}
      </div>
    </>
  );
}

function InfoSessions({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const company = useCompany(session);
  const [form, setForm] = useState({
    title: "",
    session_date: "",
    session_time: "",
    description: "",
    meeting_link: "",
  });
  const [created, setCreated] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["info-sessions", session.id],
    queryFn: async () => {
      const { data } = await db
        .from("info_sessions")
        .select("*")
        .eq("company_id", session.id)
        .order("session_date");
      return (data ?? []) as Row[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const companyName = company.data?.company_name ?? session.full_name;
      const { error } = await db.from("info_sessions").insert({
        company_id: session.id,
        company_name: companyName,
        title: form.title,
        description: form.description,
        session_date: form.session_date || null,
        session_time: form.session_time,
        meeting_link: form.meeting_link || "https://meet.campus.example/session",
      });
      if (error) throw error;
      const students = await userIdsByRole("student");
      await notify(
        students,
        `Company info session: ${form.title}`,
        `${companyName} is hosting an info session on ${form.session_date || "a date to be confirmed"} at ${form.session_time || "TBA"}.`,
        "session",
      );
      const college = await userIdsByRole("college");
      await notify(college, "New company session", `${companyName} scheduled ${form.title}.`, "session");
      return students.length;
    },
    onSuccess: (count) => {
      setCreated(`Session created. ${count} student(s) notified.`);
      setForm({ title: "", session_date: "", session_time: "", description: "", meeting_link: "" });
      queryClient.invalidateQueries();
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Info sessions"
        title="Host a campus information session"
        description="Every student receives a notification as soon as you create the session."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card title="New session">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Session title">
              <input
                className={inputClass}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
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
                  placeholder="3:00 PM"
                  required
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className={inputClass}
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                required
              />
            </Field>
            <Field label="Meeting link">
              <input
                className={inputClass}
                value={form.meeting_link}
                onChange={(event) => setForm({ ...form, meeting_link: event.target.value })}
                placeholder="https://meet.campus.example/session"
              />
            </Field>
            {created ? <SuccessNote message={created} /> : null}
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create session"}
            </Button>
          </form>
        </Card>

        <Card title="Scheduled sessions">
          {list.isLoading ? (
            <Loading />
          ) : (list.data ?? []).length === 0 ? (
            <Empty title="No sessions yet" />
          ) : (
            <ul className="space-y-3">
              {(list.data ?? []).map((item) => (
                <li key={item.id} className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {formatDate(item.session_date)} · {item.session_time}
                  </p>
                  <a
                    href={item.meeting_link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-brand hover:underline"
                  >
                    Meeting link
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export function CompanySection({ session, section }: { session: Session; section: string }) {
  switch (section) {
    case "profile":
      return <CompanyProfile session={session} />;
    case "post-internship":
      return <PostOpportunity session={session} kind="Internship" />;
    case "post-job":
      return <PostOpportunity session={session} kind="Full-time" />;
    case "opportunities":
      return <MyOpportunities session={session} />;
    case "matching":
      return <Matching session={session} />;
    case "sessions":
      return <InfoSessions session={session} />;
    case "notifications":
      return <Notifications session={session} />;
    default:
      return <Dashboard session={session} />;
  }
}
