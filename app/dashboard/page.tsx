import { 
  BookOpen, 
  HelpCircle, 
  FileText, 
  Calendar, 
  ArrowUpRight,
  Clock
} from 'lucide-react';

export default function DoctorDashboardPage() {
  // Mock data until connected to real database
  const stats = [
    { label: 'Enrolled Subjects', value: '5', sub: 'Active courses', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Upcoming Quizzes', value: '3', sub: 'This week', icon: HelpCircle, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Pending Assignments', value: '4', sub: 'Need submission', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Attendance Rate', value: '85%', sub: 'This semester', icon: Calendar, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Welcome Section */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Welcome back! 👋</h2>
          <p className="text-slate-500 mt-2 font-medium">Here's a quick overview of your students and subjects today.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                <h3 className="text-3xl font-bold text-slate-800 mt-1">{stat.value}</h3>
              </div>
              <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                <stat.icon size={24} />
              </div>
            </div>
            <p className="text-xs text-slate-400 font-medium">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Bottom Section: Activity & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="text-slate-400" size={20} />
            <h3 className="text-xl font-bold text-slate-800">Recent Activity</h3>
          </div>
          
          <div className="space-y-6">
            {[
              { title: 'Mathematics Quiz 3', sub: 'Calculus II • 3/5/2026', status: 'Upcoming', statusColor: 'bg-blue-50 text-blue-600' },
              { title: 'Physics Lab Report', sub: 'Physics I • 3/3/2026', status: 'Pending', statusColor: 'bg-orange-50 text-orange-600' },
              { title: 'Attendance Recorded', sub: 'General Science • 2/3/2026', status: 'Completed', statusColor: 'bg-green-50 text-green-600' },
            ].map((activity, i) => (
              <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{activity.title}</h4>
                    <p className="text-xs text-slate-400">{activity.sub}</p>
                  </div>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold ${activity.statusColor}`}>
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="text-blue-600" size={20} />
              <h3 className="text-xl font-bold text-slate-800">Performance</h3>
            </div>
          </div>

          <div className="space-y-8">
            {[
              { label: 'Overall Progress', value: 78, color: 'bg-blue-600' },
              { label: 'Quiz Average', value: 85, color: 'bg-indigo-600' },
              { label: 'Assignment Completion', value: 92, color: 'bg-cyan-600' },
              { label: 'Attendance', value: 85, color: 'bg-emerald-600' },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="text-slate-800">{item.value}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color} transition-all duration-1000`} 
                    style={{ width: `${item.value}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}