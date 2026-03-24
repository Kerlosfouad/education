# Dr. Emad Bayuome Educational System

A comprehensive, production-ready educational management platform built with Next.js 14+, TypeScript, Prisma, and PostgreSQL.

## Features

### For Students
- **QR Code Access**: Scan QR codes from books to access the platform
- **Course Management**: View enrolled subjects and course materials
- **Attendance Tracking**: Digital attendance with real-time verification
- **Assignments**: Submit assignments and track deadlines
- **Quizzes**: Take timed quizzes with auto-grading
- **Live Lectures**: Join Zoom lectures directly from the platform
- **Lecture Slides**: Download course materials and presentations
- **E-Library**: Access required textbooks and reference materials
- **Exam Results**: View grades and academic progress

### For Doctors
- **Student Management**: Approve/reject student registrations
- **Attendance Control**: Open/close attendance sessions
- **Assignment Creation**: Create and grade assignments
- **Quiz Management**: Create quizzes with question banks
- **Material Upload**: Upload lecture slides and resources
- **Analytics Dashboard**: Track student performance and engagement
- **Bulk Notifications**: Send announcements to students

### For Admins
- **System Configuration**: Manage platform settings
- **User Management**: Manage all users and roles
- **Role Rules**: Configure automatic role detection
- **Department Management**: Manage departments and subjects
- **Security Monitoring**: View login history and detect anomalies

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth.js with JWT
- **State Management**: Zustand + React Query
- **Email**: Nodemailer
- **QR/Barcodes**: qrcode, jsbarcode

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dr-emad-edu-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/dr_emad_edu?schema=public"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here"
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASSWORD="your-app-password"
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Default Credentials

After running the seed script, you can login with:

- **Admin**: `admin@dr-emad-edu.com` / `admin123`
- **Doctor**: `doctor@dr-emad-edu.com` / `doctor123`

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Student dashboard
│   ├── doctor/            # Doctor dashboard
│   ├── admin/             # Admin dashboard
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── ui/               # UI components (shadcn/ui)
│   └── dashboard/        # Dashboard components
├── lib/                   # Utility functions
│   ├── auth.ts           # Authentication config
│   ├── db.ts             # Database client
│   ├── email.ts          # Email service
│   └── codes.ts          # QR/Barcode generation
├── prisma/               # Database schema
│   ├── schema.prisma     # Prisma schema
│   └── seed.ts           # Database seed
├── types/                # TypeScript types
└── public/               # Static assets
```

## Key Features Implementation

### Smart Role Detection
The system automatically detects user roles based on email patterns:
- Emails containing "admin" → Admin role
- Emails containing "doctor", "dr.", "prof" → Doctor role
- Emails with .edu domain → Doctor role
- All others → Student role

Role detection rules are configurable from the admin panel.

### Student Approval Workflow
1. Student registers with email and details
2. Account status is set to "PENDING"
3. Doctor reviews and approves/rejects
4. On approval:
   - Unique student code generated
   - QR code and barcode generated
   - Approval email sent with credentials
   - Student can now login

### Attendance System
- Doctor creates attendance session with open/close times
- Students click "Register Attendance" during open period
- System records:
  - Student info
  - Timestamp
  - Device information
  - IP address
- Real-time attendance tracking

### Quiz Engine
- Dynamic quiz creation with multiple question types
- Timer per quiz
- Auto-grading
- Anti-cheat protection (IP tracking, device info)
- Score shown immediately after completion
- Question bank management

## API Routes

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Students
- `GET /api/students` - Get all students
- `POST /api/students/approve` - Approve/reject student

### Attendance
- `GET /api/attendance` - Get attendance sessions/records
- `POST /api/attendance` - Create session or mark attendance
- `PATCH /api/attendance` - Update session status

### Quizzes
- `GET /api/quizzes` - Get quizzes
- `POST /api/quizzes` - Create quiz
- `GET /api/quizzes/[id]` - Get quiz details
- `POST /api/quizzes/[id]/attempt` - Start quiz attempt
- `POST /api/quizzes/[id]/submit` - Submit quiz answers

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_URL` | Base URL of the application | Yes |
| `NEXTAUTH_SECRET` | Secret for JWT encryption | Yes |
| `SMTP_HOST` | SMTP server host | No |
| `SMTP_PORT` | SMTP server port | No |
| `SMTP_USER` | SMTP username | No |
| `SMTP_PASSWORD` | SMTP password | No |
| `FROM_EMAIL` | Default sender email | No |

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Rate limiting on API routes
- Input validation with Zod
- CSRF protection
- Secure session management
- Login history tracking
- Account switching detection

## Mobile Responsiveness

The platform is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is proprietary and confidential.

## Support

For support, email support@dr-emad-edu.com or contact the system administrator.

## Acknowledgments

Built for Dr. Emad Bayuome Educational System.
