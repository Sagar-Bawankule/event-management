# MeetMatch - Comprehensive Event Management System

MeetMatch is a centralized event management platform designed specifically for educational institutions to streamline the entire lifecycle of college events—from proposal and approval to student registration.

## Features
- **Student Portal**: Discover events, register instantly, and manage personal schedules.
- **HOD Portal**: Propose events, track approvals, view live registrations, and manage attendees.
- **Admin Portal**: Review event proposals, manage users, and oversee platform metrics.
- **Role-Based Access Control**: Secure and partitioned experiences for Students, HODs, and Admins.
- **Modern UI**: Fast, accessible, and responsive interface using Tailwind CSS and Radix UI.

## Tech Stack
- **Frontend**: Next.js (App Router), React, Tailwind CSS, Radix UI (Shadcn UI)
- **Backend**: Next.js API Routes (Server Actions)
- **Database**: MongoDB & Mongoose
- **Authentication**: NextAuth.js (Auth.js) & bcryptjs

## Getting Started

### Prerequisites
- Node.js (v20 or higher)
- MongoDB

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables locally (create a `.env.local` file with necessary variables like `MONGODB_URI`, `NEXTAUTH_SECRET`).
4. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Scripts

- **`npm run dev`**: Starts the development server.
- **`npm run seed`**: Seeds the database with demo users and data.
- **`npm run build`**: Builds the application for production.
