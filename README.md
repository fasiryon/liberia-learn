# LiberiaLearn 🇱🇷

**AI-Powered K-12 Learning Platform**

LiberiaLearn is a full-stack, modern, AI-enhanced learning system designed to simulate a real national education platform. Built with Next.js 14 (App Router), Prisma, NextAuth, Anthropic Claude, and TailwindCSS, it provides:

* Student dashboards
* Teacher dashboards
* Assignments + grading
* Placement testing
* AI tutoring
* School & data management
* Real seeded Liberian schools

This is a complete, functioning platform with production-ready UI and backend.

---

## 🚀 Features

### 🎓 Student Features
* Personalized student dashboard
* View all classes (`/classes`)
* View all assignments (`/assignments`)
* Detailed assignment pages with homework submission
* Live placement test system
* AI Tutor assistant on dashboard
* Progress tracking (performance over time)

### 👨🏽‍🏫 Teacher Features
* Teacher dashboard with Homework tab
* Create new homework
* View all homework
* View students in each class
* Homework detail pages
* Inline grading with feedback
* Student profile pages
* Placement test history per student

### 🏫 Admin Features
* Admin dashboard
* Manage schools
* Seed includes 8 Liberian schools
* (Expandable into full School/Teacher management)

### 🧠 AI Features
* AI tutoring (context-aware chat)
* AI homework scoring & feedback
* AI placement grading logic
* AI question generator foundation ready
* Clean agent-based architecture

---

## 🗂️ Tech Stack

* **Framework**: Next.js 14 (App Router)
* **Language**: TypeScript
* **Database**: Prisma ORM + SQLite (dev) / PostgreSQL (production)
* **Auth**: NextAuth Credentials Provider
* **UI**: TailwindCSS + custom styles
* **Deployment**: Vercel
* **AI**: Anthropic Claude API

---

## 📁 Project Structure
```
app/
 ├── admin/              # Admin dashboard
 ├── api/                # API routes
 ├── assignments/        # Student assignments view
 ├── classes/            # Class listings
 ├── dashboard/          # Student dashboard
 ├── login/              # Login page
 ├── placement/          # Placement test
 ├── progress/           # Progress tracking
 ├── student/            # Student-specific pages
 └── teacher/            # Teacher dashboard & tools

components/
 ├── AITutorChat.tsx            # AI chat interface
 ├── GradeSubmissionForm.tsx    # Teacher grading form
 ├── PlacementTest.tsx          # Adaptive placement test
 ├── StudentSidebar.tsx         # Navigation sidebar
 └── SubmitHomeworkForm.tsx     # Student submission form

prisma/
 ├── schema.prisma       # Database schema
 ├── migrations/         # Database migrations
 └── seed.ts             # Seed data (schools, users, etc.)

lib/
 ├── auth.ts             # NextAuth configuration
 ├── db.ts               # Prisma client
 └── ai/                 # AI agent logic
```

---

## 📡 Key API Routes

### Homework
```
POST /api/homework                    # Create homework
GET  /api/homework/[id]               # Get homework details
POST /api/homework/submit             # Submit homework
POST /api/homework/grade              # Grade homework
```

### Student
```
GET  /api/student/[id]                      # Get student profile
POST /api/student/homework/[id]/submit      # Submit homework
GET  /api/student/placement                 # Get placement results
```

### Placement Test
```
POST /api/placement/generate-question       # Generate adaptive questions
POST /api/placement/calculate-grade         # Calculate placement level
```

### AI
```
POST /api/ai/chat                     # AI tutor chat
```

### Admin
```
GET  /api/admin/schools               # List all schools
```

---

## 🖥️ Local Installation

### Prerequisites
* Node.js 18+ 
* npm or yarn
* Git

### Setup

1. **Clone the repository**
```bash
   git clone https://github.com/fasiryon/liberia-learn.git
   cd liberia-learn
```

2. **Install dependencies**
```bash
   npm install
```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
```env
   DATABASE_URL="file:./prisma/dev.db"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here"
   ANTHROPIC_API_KEY="your-anthropic-api-key"
```

4. **Initialize the database**
```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
```

5. **Run the development server**
```bash
   npm run dev
```

6. **Open your browser**
   
   Navigate to `http://localhost:3000`

---

## MOE Pilot Sprint

LiberiaLearn completed a 10-session MOE Pilot Sprint to prepare for the Ministry of Education national pilot:

| Session | Feature |
|---------|---------|
| S1 | Student lesson view (today's work, content, mark complete) |
| S2 | Student progress dashboard + teacher student monitoring |
| S3 | Realistic Liberian seed data (3 schools, 75 students) |
| S4 | 5-step school onboarding wizard with county selector |
| S5 | Africa's Talking SMS for guardian notifications |
| S6 | Offline sync with IndexedDB queue + auto-reconnect |
| S7 | Pilot Readiness Score (5-component formula, admin breakdown) |
| S8 | Teacher dashboard, weekly schedule, curriculum workflow |
| S9 | Full smoke test suite + demo credential sheet |
| S10 | MOE docs, demo mode, error boundaries, loading states |

---

## 🔐 Demo Accounts

After seeding (`npx prisma db seed`), use these credentials:

**All passwords: `Password123`**

| Role | Email | School |
|------|-------|--------|
| Platform Admin | jkollie@mca.edu.lr | Monrovia Central Academy |
| Teacher | mpewee@mca.edu.lr | MCA - Grade 7 Math |
| Student | fatu.wreh@mca.edu.lr | MCA - Grade 7A |
| School Admin | gtokpah@pcs.edu.lr | Paynesville Community School |
| School Admin | mkarnga@krs.edu.lr | Kakata Rural School |

See `scripts/demo-credentials.txt` for the full credential sheet.

---

## 🗄️ Database Schema

### Core Models
* **User** - Base user with role (STUDENT, TEACHER, ADMIN)
* **Student** - Student profile with placement data
* **Teacher** - Teacher profile
* **School** - School information
* **Class** - Class/course
* **Enrollment** - Student-class relationship
* **Homework** - Assignments
* **HomeworkSubmission** - Student submissions
* **Grade** - Grade records
* **PlacementTest** - Adaptive test results

---

4. **Deploy!**

### Database for Production
For production, switch from SQLite to PostgreSQL:
- Use [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- Or [Supabase](https://supabase.com) (free tier available)
- Update `DATABASE_URL` in Vercel environment variables
- Run migrations: `npx prisma migrate deploy`

---

## 🛠️ Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database Commands
```bash
npx prisma studio           # Open Prisma Studio (GUI)
npx prisma generate         # Generate Prisma Client
npx prisma db push          # Push schema changes
npx prisma db seed          # Seed database
npx prisma migrate dev      # Create new migration
```

---

## 🎨 UI Design

LiberiaLearn features a modern, dark-themed UI with:
* Emerald green primary color (#22c55e)
* Cyan accents (#06b6d4)
* Slate dark backgrounds
* Glassmorphism effects
* Responsive design
* Smooth animations

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👨‍💻 Author

**Farquema Siryon**
* GitHub: [@fasiryon](https://github.com/fasiryon)

---

## 🙏 Acknowledgments

* Built for Liberian education system
* Powered by Anthropic Claude AI
* Next.js and Vercel for hosting
* Prisma for database management

---

## 📞 Support

For issues or questions:
* Open an issue on GitHub
* Email: [fasiryon@gmail.com]

---

**Live Demo**: [https://liberia-learn.vercel.app]

**Repository**: https://github.com/fasiryon/liberia-learn
