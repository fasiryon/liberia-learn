import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">🇱🇷 LiberiaLearn</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl md:text-7xl">
              <span className="block">Empowering Education</span>
              <span className="block bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Across Liberia
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-gray-600">
              A modern learning platform connecting teachers, students, and schools
              throughout Liberia. Track attendance, manage classes, and enhance education.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link
                href="/login"
                className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white transition hover:bg-blue-700"
              >
                Get Started
              </Link>
              <button className="rounded-lg border-2 border-gray-300 bg-white px-8 py-3 text-lg font-semibold text-gray-700 transition hover:border-gray-400">
                Learn More
              </button>
            </div>
          </div>

          {/* Features */}
          <div className="mt-24 grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-8 shadow-lg transition hover:shadow-xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Class Management</h3>
              <p className="text-gray-600">
                Organize classes, track progress, and manage student enrollment with ease.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-lg transition hover:shadow-xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <span className="text-2xl">✓</span>
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Attendance Tracking</h3>
              <p className="text-gray-600">
                Real-time attendance monitoring to ensure students stay engaged and present.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-lg transition hover:shadow-xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Analytics & Reports</h3>
              <p className="text-gray-600">
                Comprehensive insights into student performance and class statistics.
              </p>
            </div>
          </div>

          {/* Stats Section */}
          <div className="mt-24 rounded-2xl bg-gradient-to-r from-blue-600 to-green-600 p-12 text-white shadow-2xl">
            <div className="grid gap-8 text-center md:grid-cols-3">
              <div>
                <div className="text-4xl font-bold">500+</div>
                <div className="mt-2 text-blue-100">Students Enrolled</div>
              </div>
              <div>
                <div className="text-4xl font-bold">50+</div>
                <div className="mt-2 text-blue-100">Active Teachers</div>
              </div>
              <div>
                <div className="text-4xl font-bold">15+</div>
                <div className="mt-2 text-blue-100">Partner Schools</div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="mt-24 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Ready to get started?</h2>
            <p className="mt-4 text-lg text-gray-600">
              Join LiberiaLearn today and transform education in your school.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-block rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white transition hover:bg-blue-700"
            >
              Sign In Now
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600">
            <p className="text-lg font-semibold text-gray-900">🇱🇷 LiberiaLearn</p>
            <p className="mt-2">Empowering education across Liberia</p>
            <p className="mt-4 text-sm">© 2024 LiberiaLearn. Building a brighter future.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}