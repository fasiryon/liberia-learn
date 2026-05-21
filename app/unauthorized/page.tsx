import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <img src="/logo.png" alt="LiberiaLearn" className="h-12 w-auto" />
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        You do not have permission to access this page. Please contact your school
        administrator if you believe this is an error.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Go home
      </Link>
    </div>
  )
}
