export default function TeacherDashboard() {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
        {/* Navigation */}
        <nav className="border-b bg-white/80 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <span className="text-2xl font-bold text-blue-600">🇱🇷 LiberiaLearn</span>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Ms. Johnson</span>
                <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>
  
        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
  
          {/* Stats Cards */}
          <div className="mb-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow-lg">
              <div className="mb-2 text-sm font-medium text-gray-600">Total Classes</div>
              <div className="text-3xl font-bold text-blue-600">1</div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-lg">
              <div className="mb-2 text-sm font-medium text-gray-600">Total Students</div>
              <div className="text-3xl font-bold text-green-600">1</div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-lg">
              <div className="mb-2 text-sm font-medium text-gray-600">Attendance Rate</div>
              <div className="text-3xl font-bold text-purple-600">100%</div>
            </div>
          </div>
  
          {/* My Classes */}
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-bold text-gray-900">My Classes</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                <div>
                  <h3 className="font-semibold text-gray-900">JSS-7A Algebra</h3>
                  <p className="text-sm text-gray-600">Mathematics • 1 student enrolled</p>
                </div>
                <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  View Class
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }