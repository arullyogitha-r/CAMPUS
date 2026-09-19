
CREATE TABLE public.colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password text NOT NULL DEFAULT 'campus123',
  role text NOT NULL CHECK (role IN ('student','faculty','college','company')),
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.student_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  college_id uuid REFERENCES public.colleges(id) ON DELETE SET NULL,
  department text NOT NULL DEFAULT '',
  year integer NOT NULL DEFAULT 1,
  career_goal text,
  interests text[] NOT NULL DEFAULT '{}',
  overall_score integer NOT NULL DEFAULT 0,
  assessments_taken integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.faculty_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  college_id uuid REFERENCES public.colleges(id) ON DELETE SET NULL,
  department text NOT NULL DEFAULT '',
  designation text NOT NULL DEFAULT 'Assistant Professor'
);

CREATE TABLE public.college_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  college_id uuid REFERENCES public.colleges(id) ON DELETE SET NULL
);

CREATE TABLE public.company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  industry text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  about text NOT NULL DEFAULT ''
);

CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'Technical'
);

CREATE TABLE public.career_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  required_skills text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE public.assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL CHECK (section IN ('aptitude','technical')),
  skill text NOT NULL DEFAULT 'General',
  kind text NOT NULL DEFAULT 'mcq',
  question text NOT NULL,
  options text[] NOT NULL,
  correct_index integer NOT NULL
);

CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  career_goal text,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  taken_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  selected_index integer,
  is_correct boolean NOT NULL DEFAULT false
);

CREATE TABLE public.student_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  skill text NOT NULL,
  level integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, skill)
);

CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  skill text NOT NULL,
  difficulty text NOT NULL DEFAULT 'Beginner',
  hours integer NOT NULL DEFAULT 4,
  type text NOT NULL DEFAULT 'Course',
  provider text NOT NULL DEFAULT 'CAMPUS Learning',
  url text NOT NULL DEFAULT 'https://www.freecodecamp.org/'
);

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'Internship' CHECK (kind IN ('Internship','Full-time')),
  description text NOT NULL DEFAULT '',
  required_skills text[] NOT NULL DEFAULT '{}',
  qualification text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  duration text NOT NULL DEFAULT '',
  stipend text NOT NULL DEFAULT '',
  deadline date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Applied',
  match_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, student_id)
);

CREATE TABLE public.saved_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, student_id)
);

CREATE TABLE public.workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  faculty_name text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'Workshop' CHECK (kind IN ('Workshop','Seminar')),
  title text NOT NULL,
  skill text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  session_date date,
  session_time text NOT NULL DEFAULT '',
  target text NOT NULL DEFAULT 'All students',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.info_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  session_date date,
  session_time text NOT NULL DEFAULT '',
  meeting_link text NOT NULL DEFAULT 'https://meet.campus.example/session',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.colleges, public.users, public.student_profiles, public.faculty_profiles, public.college_profiles, public.company_profiles, public.skills, public.career_roles, public.assessment_questions, public.assessments, public.assessment_answers, public.student_skills, public.resources, public.opportunities, public.applications, public.saved_opportunities, public.workshops, public.info_sessions, public.notifications TO anon, authenticated;
GRANT ALL ON public.colleges, public.users, public.student_profiles, public.faculty_profiles, public.college_profiles, public.company_profiles, public.skills, public.career_roles, public.assessment_questions, public.assessments, public.assessment_answers, public.student_skills, public.resources, public.opportunities, public.applications, public.saved_opportunities, public.workshops, public.info_sessions, public.notifications TO service_role;

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.info_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo open" ON public.colleges FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.student_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.faculty_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.college_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.company_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.skills FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.career_roles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.assessment_questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.assessments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.assessment_answers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.student_skills FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.resources FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.opportunities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.applications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.saved_opportunities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.workshops FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.info_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open" ON public.notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ SEED DATA ============

INSERT INTO public.colleges (id, name, city) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Sriram Institute of Technology', 'Coimbatore');

INSERT INTO public.users (id, email, password, role, full_name) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'student@campus.edu', 'campus123', 'student', 'Ananya Iyer'),
  ('a0000000-0000-4000-8000-000000000002', 'rohan@campus.edu', 'campus123', 'student', 'Rohan Deshmukh'),
  ('a0000000-0000-4000-8000-000000000003', 'meera@campus.edu', 'campus123', 'student', 'Meera Krishnan'),
  ('a0000000-0000-4000-8000-000000000004', 'kabir@campus.edu', 'campus123', 'student', 'Kabir Ahluwalia'),
  ('a0000000-0000-4000-8000-000000000005', 'divya@campus.edu', 'campus123', 'student', 'Divya Raghavan'),
  ('b0000000-0000-4000-8000-000000000001', 'faculty@campus.edu', 'campus123', 'faculty', 'Dr. Lakshmi Narayan'),
  ('b0000000-0000-4000-8000-000000000002', 'arvind@campus.edu', 'campus123', 'faculty', 'Prof. Arvind Menon'),
  ('c0000000-0000-4000-8000-000000000001', 'college@campus.edu', 'campus123', 'college', 'Sriram Institute of Technology'),
  ('d0000000-0000-4000-8000-000000000001', 'company@campus.edu', 'campus123', 'company', 'Nimbus Cloud Systems'),
  ('d0000000-0000-4000-8000-000000000002', 'vertex@campus.edu', 'campus123', 'company', 'Vertex Analytics');

INSERT INTO public.student_profiles (user_id, college_id, department, year, career_goal, interests, overall_score, assessments_taken) VALUES
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Computer Science', 3, 'Cloud Engineer', ARRAY['Cloud Computing','Open Source'], 0, 0),
  ('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Information Technology', 3, 'DevOps Engineer', ARRAY['Automation','Linux'], 71, 1),
  ('a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Computer Science', 4, 'Data Analyst', ARRAY['Statistics','Visualisation'], 64, 1),
  ('a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'Electronics', 2, 'Cybersecurity Analyst', ARRAY['Networking','Ethical Hacking'], 46, 1),
  ('a0000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Computer Science', 3, 'Software Developer', ARRAY['Problem Solving','Web'], 78, 1);

INSERT INTO public.faculty_profiles (user_id, college_id, department, designation) VALUES
  ('b0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Computer Science', 'Head of Department'),
  ('b0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Information Technology', 'Associate Professor');

INSERT INTO public.college_profiles (user_id, college_id) VALUES
  ('c0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111');

INSERT INTO public.company_profiles (user_id, company_name, industry, location, about) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'Nimbus Cloud Systems', 'Cloud Infrastructure', 'Bengaluru', 'We build managed cloud platforms for mid-market enterprises across India.'),
  ('d0000000-0000-4000-8000-000000000002', 'Vertex Analytics', 'Data & Analytics', 'Hyderabad', 'Analytics consultancy helping retail and fintech teams make data-led decisions.');

INSERT INTO public.skills (name, category) VALUES
  ('AWS','Cloud'), ('Networking','Infrastructure'), ('Linux','Infrastructure'), ('Python','Programming'),
  ('SQL','Data'), ('Cloud Security','Security'), ('Docker','DevOps'), ('Kubernetes','DevOps'),
  ('CI/CD','DevOps'), ('Java','Programming'), ('Data Structures','Programming'), ('Git','Tools'),
  ('System Design','Engineering'), ('Statistics','Data'), ('Data Visualization','Data'), ('Excel','Data'),
  ('Cryptography','Security'), ('SIEM','Security'), ('Figma','Design'), ('User Research','Design'),
  ('Wireframing','Design'), ('HTML/CSS','Web');

INSERT INTO public.career_roles (name, description, required_skills) VALUES
  ('Cloud Engineer','Design, deploy and operate workloads on public cloud platforms.', ARRAY['AWS','Networking','Linux','Python','SQL','Cloud Security']),
  ('Software Developer','Build and maintain production software systems.', ARRAY['Java','Python','Data Structures','SQL','Git','System Design']),
  ('Data Analyst','Turn raw data into decisions using queries, statistics and dashboards.', ARRAY['SQL','Python','Excel','Statistics','Data Visualization','Git']),
  ('Cybersecurity Analyst','Monitor, detect and respond to security threats.', ARRAY['Networking','Linux','Cloud Security','Cryptography','SIEM','Python']),
  ('DevOps Engineer','Automate build, release and infrastructure operations.', ARRAY['Linux','Docker','Kubernetes','CI/CD','AWS','Python']),
  ('UI/UX Designer','Research, design and validate digital product experiences.', ARRAY['Figma','Wireframing','User Research','HTML/CSS','Data Visualization','Git']);

INSERT INTO public.assessment_questions (section, skill, kind, question, options, correct_index) VALUES
  ('aptitude','Logical Reasoning','mcq','If all Rovers are Bots and some Bots are Drones, which statement must be true?', ARRAY['All Rovers are Drones','Some Rovers are Drones','All Rovers are Bots','No Bot is a Rover'], 2),
  ('aptitude','Logical Reasoning','mcq','Find the next term: 2, 6, 12, 20, 30, ?', ARRAY['36','40','42','46'], 2),
  ('aptitude','Quantitative','mcq','A train covers 180 km in 3 hours. What is its average speed?', ARRAY['50 km/h','55 km/h','60 km/h','70 km/h'], 2),
  ('aptitude','Quantitative','mcq','An item priced 2400 is sold at a 15% discount. What is the selling price?', ARRAY['1980','2040','2100','2160'], 1),
  ('aptitude','Problem Solving','mcq','A server handles 300 requests/min. How many requests in 45 seconds?', ARRAY['180','200','225','250'], 2),
  ('aptitude','Problem Solving','scenario','Your team must ship a release but one test keeps failing intermittently. What is the most responsible first step?', ARRAY['Delete the flaky test','Reproduce and isolate the failure','Ship and fix later','Rerun until it passes'], 1),
  ('technical','AWS','mcq','Which AWS service stores objects such as images and backups?', ARRAY['EC2','S3','RDS','IAM'], 1),
  ('technical','AWS','scenario','You need to deploy a web application to the cloud. Which component would you consider first?', ARRAY['A logging dashboard','Compute and hosting for the application','A custom domain name','A billing alarm'], 1),
  ('technical','Networking','mcq','Which port does HTTPS use by default?', ARRAY['21','80','443','8080'], 2),
  ('technical','Networking','mcq','What does DNS primarily do?', ARRAY['Encrypts traffic','Resolves domain names to IP addresses','Balances server load','Assigns MAC addresses'], 1),
  ('technical','Linux','mcq','Which command shows running processes in real time?', ARRAY['ls','top','cat','grep'], 1),
  ('technical','Linux','mcq','Which command changes file permissions?', ARRAY['chmod','chown','mv','mkdir'], 0),
  ('technical','Python','mcq','What does len([1, 2, 3, 4]) return?', ARRAY['3','4','5','Error'], 1),
  ('technical','Python','mcq','Which data type is immutable in Python?', ARRAY['list','dict','set','tuple'], 3),
  ('technical','SQL','mcq','Which clause filters rows after grouping?', ARRAY['WHERE','HAVING','ORDER BY','LIMIT'], 1),
  ('technical','SQL','mcq','Which join returns only matching rows from both tables?', ARRAY['LEFT JOIN','RIGHT JOIN','INNER JOIN','FULL JOIN'], 2),
  ('technical','Cloud Security','mcq','What is the principle of least privilege?', ARRAY['Give every user admin access','Grant only the access needed for the task','Disable all logging','Share one root account'], 1),
  ('technical','Cloud Security','scenario','A storage bucket holding student records is publicly readable. What do you do first?', ARRAY['Rename the bucket','Block public access and audit who read it','Move it to another region','Add a password to each file'], 1),
  ('technical','Docker','mcq','What does a Dockerfile describe?', ARRAY['A running container log','Instructions to build an image','A network policy','A database schema'], 1),
  ('technical','Docker','mcq','Which command lists running containers?', ARRAY['docker ps','docker build','docker pull','docker rmi'], 0),
  ('technical','Kubernetes','mcq','What is the smallest deployable unit in Kubernetes?', ARRAY['Node','Pod','Service','Cluster'], 1),
  ('technical','Kubernetes','mcq','What does a Kubernetes Service provide?', ARRAY['Persistent storage','Stable networking to a set of pods','Container image builds','Secret rotation'], 1),
  ('technical','CI/CD','mcq','What is the main purpose of continuous integration?', ARRAY['Deploy to production daily','Merge and verify code changes frequently','Write documentation','Monitor uptime'], 1),
  ('technical','CI/CD','scenario','A pipeline deploys broken code to production every week. What control helps most?', ARRAY['Longer release notes','Automated tests gating the deploy stage','More manual approvals only','Bigger servers'], 1),
  ('technical','Java','mcq','Which keyword prevents a class from being subclassed in Java?', ARRAY['static','final','private','abstract'], 1),
  ('technical','Java','mcq','Which collection does not allow duplicate elements?', ARRAY['ArrayList','LinkedList','HashSet','Vector'], 2),
  ('technical','Data Structures','mcq','What is the average time complexity of binary search?', ARRAY['O(1)','O(log n)','O(n)','O(n log n)'], 1),
  ('technical','Data Structures','mcq','Which structure works on First In, First Out?', ARRAY['Stack','Queue','Tree','Heap'], 1),
  ('technical','Git','mcq','Which command creates a new branch and switches to it?', ARRAY['git branch -d','git checkout -b','git merge','git clone'], 1),
  ('technical','Git','mcq','What does git pull do?', ARRAY['Uploads local commits','Fetches and merges remote changes','Deletes a branch','Creates a tag'], 1),
  ('technical','System Design','mcq','Why add a cache in front of a database?', ARRAY['To store backups','To reduce read latency and load','To encrypt data','To version the schema'], 1),
  ('technical','Statistics','mcq','Which measure is most affected by outliers?', ARRAY['Median','Mode','Mean','Range of ranks'], 2),
  ('technical','Data Visualization','mcq','Which chart best shows change over time?', ARRAY['Pie chart','Line chart','Treemap','Word cloud'], 1),
  ('technical','Excel','mcq','Which function looks up a value in the leftmost column of a range?', ARRAY['SUMIF','VLOOKUP','CONCAT','TRIM'], 1),
  ('technical','Cryptography','mcq','Which of these is a hashing algorithm?', ARRAY['AES','RSA','SHA-256','TLS'], 2),
  ('technical','SIEM','mcq','What is a SIEM primarily used for?', ARRAY['Designing user interfaces','Collecting and correlating security events','Provisioning laptops','Writing unit tests'], 1),
  ('technical','Figma','mcq','What is a Figma component used for?', ARRAY['Running code','Reusing a design element consistently','Hosting a website','Storing a database'], 1),
  ('technical','Wireframing','mcq','What is the main goal of a low-fidelity wireframe?', ARRAY['Final visual polish','Fast validation of structure and flow','Choosing brand colours','Writing production CSS'], 1),
  ('technical','User Research','mcq','Which method best uncovers why users struggle with a flow?', ARRAY['A/B test alone','Moderated usability testing','Server log counts','Colour survey'], 1),
  ('technical','HTML/CSS','mcq','Which CSS property controls space inside an element border?', ARRAY['margin','padding','gap','border'], 1);

INSERT INTO public.resources (title, skill, difficulty, hours, type, provider, url) VALUES
  ('AWS Cloud Fundamentals','AWS','Beginner',8,'Course','AWS Skill Builder','https://explore.skillbuilder.aws/'),
  ('Architecting on AWS: Core Services','AWS','Intermediate',12,'Course','CAMPUS Learning','https://aws.amazon.com/training/'),
  ('Computer Networking Basics','Networking','Beginner',6,'Course','Cisco Networking Academy','https://www.netacad.com/'),
  ('Subnetting and Routing Workshop','Networking','Intermediate',5,'Workshop','CAMPUS Learning','https://www.netacad.com/'),
  ('Linux Fundamentals','Linux','Beginner',7,'Course','Linux Foundation','https://training.linuxfoundation.org/'),
  ('Shell Scripting for Operations','Linux','Intermediate',5,'Tutorial','CAMPUS Learning','https://www.gnu.org/software/bash/manual/'),
  ('Python for Cloud Automation','Python','Intermediate',10,'Course','CAMPUS Learning','https://docs.python.org/3/tutorial/'),
  ('Python Programming Basics','Python','Beginner',9,'Course','freeCodeCamp','https://www.freecodecamp.org/'),
  ('SQL Query Essentials','SQL','Beginner',6,'Course','Mode Analytics','https://mode.com/sql-tutorial/'),
  ('Advanced SQL for Analysts','SQL','Advanced',8,'Course','CAMPUS Learning','https://mode.com/sql-tutorial/'),
  ('Cloud Security Foundations','Cloud Security','Intermediate',7,'Course','CAMPUS Learning','https://aws.amazon.com/security/'),
  ('Docker from Zero','Docker','Beginner',5,'Course','Docker Docs','https://docs.docker.com/get-started/'),
  ('Kubernetes in Practice','Kubernetes','Intermediate',11,'Course','Kubernetes.io','https://kubernetes.io/docs/tutorials/'),
  ('Building CI/CD Pipelines','CI/CD','Intermediate',6,'Project','CAMPUS Learning','https://docs.github.com/actions'),
  ('Java Core Concepts','Java','Beginner',10,'Course','CAMPUS Learning','https://dev.java/learn/'),
  ('Data Structures and Algorithms Drill','Data Structures','Intermediate',14,'Practice','CAMPUS Learning','https://www.geeksforgeeks.org/'),
  ('Git and Collaboration Workflow','Git','Beginner',3,'Tutorial','Git SCM','https://git-scm.com/doc'),
  ('System Design Primer','System Design','Advanced',12,'Reading','CAMPUS Learning','https://github.com/donnemartin/system-design-primer'),
  ('Statistics for Data Analysis','Statistics','Beginner',8,'Course','Khan Academy','https://www.khanacademy.org/math/statistics-probability'),
  ('Dashboards and Data Visualization','Data Visualization','Beginner',5,'Course','CAMPUS Learning','https://www.tableau.com/learn/training'),
  ('Excel for Analysts','Excel','Beginner',4,'Course','CAMPUS Learning','https://support.microsoft.com/excel'),
  ('Applied Cryptography Basics','Cryptography','Intermediate',7,'Course','CAMPUS Learning','https://cryptobook.nakov.com/'),
  ('SIEM and Threat Detection Lab','SIEM','Intermediate',6,'Lab','CAMPUS Learning','https://www.splunk.com/en_us/training.html'),
  ('Figma Essentials','Figma','Beginner',4,'Course','Figma Learn','https://help.figma.com/'),
  ('Wireframing Workshop','Wireframing','Beginner',3,'Workshop','CAMPUS Learning','https://help.figma.com/'),
  ('User Research Methods','User Research','Intermediate',6,'Course','Nielsen Norman Group','https://www.nngroup.com/articles/'),
  ('HTML and CSS Foundations','HTML/CSS','Beginner',6,'Course','MDN Web Docs','https://developer.mozilla.org/');

INSERT INTO public.student_skills (student_id, skill, level) VALUES
  ('a0000000-0000-4000-8000-000000000002','Linux',78),('a0000000-0000-4000-8000-000000000002','Docker',72),
  ('a0000000-0000-4000-8000-000000000002','Kubernetes',55),('a0000000-0000-4000-8000-000000000002','CI/CD',68),
  ('a0000000-0000-4000-8000-000000000002','AWS',60),('a0000000-0000-4000-8000-000000000002','Python',74),
  ('a0000000-0000-4000-8000-000000000003','SQL',82),('a0000000-0000-4000-8000-000000000003','Python',66),
  ('a0000000-0000-4000-8000-000000000003','Excel',75),('a0000000-0000-4000-8000-000000000003','Statistics',58),
  ('a0000000-0000-4000-8000-000000000003','Data Visualization','48'),('a0000000-0000-4000-8000-000000000003','Git',55),
  ('a0000000-0000-4000-8000-000000000004','Networking',52),('a0000000-0000-4000-8000-000000000004','Linux',44),
  ('a0000000-0000-4000-8000-000000000004','Cloud Security',38),('a0000000-0000-4000-8000-000000000004','Cryptography',35),
  ('a0000000-0000-4000-8000-000000000004','SIEM',30),('a0000000-0000-4000-8000-000000000004','Python',60),
  ('a0000000-0000-4000-8000-000000000005','Java',86),('a0000000-0000-4000-8000-000000000005','Python',80),
  ('a0000000-0000-4000-8000-000000000005','Data Structures',84),('a0000000-0000-4000-8000-000000000005','SQL',70),
  ('a0000000-0000-4000-8000-000000000005','Git',78),('a0000000-0000-4000-8000-000000000005','System Design',52);

INSERT INTO public.assessments (student_id, career_goal, score, total_questions, correct_answers, taken_at) VALUES
  ('a0000000-0000-4000-8000-000000000002','DevOps Engineer',71,18,13, now() - interval '9 days'),
  ('a0000000-0000-4000-8000-000000000003','Data Analyst',64,18,12, now() - interval '7 days'),
  ('a0000000-0000-4000-8000-000000000004','Cybersecurity Analyst',46,18,8, now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000005','Software Developer',78,18,14, now() - interval '3 days');

INSERT INTO public.opportunities (id, company_id, company_name, title, kind, description, required_skills, qualification, location, duration, stipend, deadline) VALUES
  ('e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Nimbus Cloud Systems','Cloud Engineering Intern','Internship','Work with our platform team on AWS provisioning, Linux automation and monitoring for customer workloads.', ARRAY['AWS','Linux','Networking','Python'],'B.E./B.Tech, 3rd or 4th year','Bengaluru (Hybrid)','6 months','INR 25,000/month', CURRENT_DATE + 30),
  ('e0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','Nimbus Cloud Systems','Site Reliability Engineer','Full-time','Own reliability of production Kubernetes clusters, build CI/CD pipelines and reduce incident response time.', ARRAY['Linux','Kubernetes','Docker','CI/CD','AWS'],'B.E./B.Tech graduate, 2026 batch','Bengaluru','Permanent','INR 9.5 LPA', CURRENT_DATE + 45),
  ('e0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000002','Vertex Analytics','Data Analyst Intern','Internship','Build SQL models and dashboards for retail clients, and present weekly insight summaries.', ARRAY['SQL','Python','Excel','Statistics','Data Visualization'],'Any engineering branch, 3rd or 4th year','Hyderabad (Remote friendly)','3 months','INR 18,000/month', CURRENT_DATE + 20);

INSERT INTO public.workshops (faculty_id, faculty_name, kind, title, skill, description, session_date, session_time, target) VALUES
  ('b0000000-0000-4000-8000-000000000001','Dr. Lakshmi Narayan','Workshop','Networking Fundamentals Workshop','Networking','Hands-on session covering IP addressing, subnetting, routing and troubleshooting for cloud roles.', CURRENT_DATE + 7, '10:00 AM - 1:00 PM','Students with Networking gaps'),
  ('b0000000-0000-4000-8000-000000000002','Prof. Arvind Menon','Seminar','Industry Seminar: Careers in Cloud & DevOps','AWS','Guest seminar with industry engineers on how cloud hiring works and what portfolios stand out.', CURRENT_DATE + 12, '2:00 PM - 4:00 PM','All students');

INSERT INTO public.info_sessions (company_id, company_name, title, description, session_date, session_time, meeting_link) VALUES
  ('d0000000-0000-4000-8000-000000000001','Nimbus Cloud Systems','Nimbus Campus Info Session','Overview of our internship programme, interview process and the skills we look for.', CURRENT_DATE + 9, '3:00 PM', 'https://meet.campus.example/nimbus-info');

INSERT INTO public.notifications (user_id, title, body, category) VALUES
  ('a0000000-0000-4000-8000-000000000001','Complete your skill assessment','Take the CAMPUS assessment to unlock your skill analysis and personalised resources.','assessment'),
  ('a0000000-0000-4000-8000-000000000001','New internship: Cloud Engineering Intern','Nimbus Cloud Systems is hiring interns matching AWS, Linux and Networking.','opportunity'),
  ('a0000000-0000-4000-8000-000000000001','Workshop: Networking Fundamentals','Dr. Lakshmi Narayan scheduled a workshop on Networking for students with gaps.','workshop'),
  ('a0000000-0000-4000-8000-000000000002','New job: Site Reliability Engineer','Nimbus Cloud Systems posted a full-time SRE role.','opportunity'),
  ('a0000000-0000-4000-8000-000000000003','New internship: Data Analyst Intern','Vertex Analytics is hiring data analyst interns in Hyderabad.','opportunity'),
  ('b0000000-0000-4000-8000-000000000001','Skill gap alert','Networking is the most common weak skill across your students this term.','alert'),
  ('b0000000-0000-4000-8000-000000000001','Assessment update','4 students completed their skill assessment this week.','assessment'),
  ('c0000000-0000-4000-8000-000000000001','Skill gap report ready','Institution-wide analytics updated with the latest assessment results.','report'),
  ('c0000000-0000-4000-8000-000000000001','New company opportunity','Nimbus Cloud Systems posted 2 new opportunities for your students.','opportunity'),
  ('d0000000-0000-4000-8000-000000000001','Matching students available','5 students match your Cloud Engineering Intern requirements.','matching');
