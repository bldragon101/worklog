# Work Log Application

A modern, lightweight web application for logging and managing work entries for drivers. Built with Next.js, Tailwind CSS, and shadcn/ui, and powered by a PostgreSQL database via Prisma.

## Features

- **CRUD Operations:** Add, view, and edit work log entries.
- **Interactive Data Table:** A sleek and responsive table for viewing logs, powered by TanStack Table.
- **Advanced Filtering:**
  - Filter logs by year and month.
  - Filter by week-ending dates (Sundays).
  - Filter by specific days of the week.
  - "Show whole month" option.
- **Dark/Light Mode:** Seamless theme switching with `next-themes`, with a beautiful dark mode.
- **Modern UI:** Built with the excellent `shadcn/ui` component library.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) (designed for [Vercel Postgres](https://vercel.com/storage/postgres) / [Neon](https://neon.tech/))
- **Theming:** [next-themes](https://github.com/pacocoursey/next-themes)
- **Tables:** [@tanstack/react-table](https://tanstack.com/table/v8)
- **Date Utility:** [date-fns](https://date-fns.org/)

## Getting Started

Follow these steps to get the project running locally.

### Prerequisites

- [Node.js](https://nodejs.org/en) (v18 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A PostgreSQL database instance. You can get one for free from [Vercel Postgres](https://vercel.com/storage/postgres) or [Neon](https://neon.tech/).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd worklog
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    - Create a `.env` file in the root of the `worklog` directory.
    - Add your PostgreSQL database connection string to this file. It should be formatted for Prisma with Neon/Vercel.

    ```env
    DATABASE_URL="postgres://<user>:<password>@<host>/neondb?sslmode=require"
    ```

4.  **Run database migrations:**
    - This command will sync your Prisma schema with your database, creating the `WorkLog` table.
    ```bash
    npx prisma migrate dev
    ```

5.  **Run the development server:**
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

This application is optimized for deployment on [Vercel](https://vercel.com/). When you deploy, Vercel will automatically detect the Next.js framework. Make sure to add your `DATABASE_URL` as an environment variable in the Vercel project settings.
