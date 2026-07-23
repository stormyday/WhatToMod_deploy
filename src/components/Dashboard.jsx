import { UserAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LuUser } from 'react-icons/lu';
import "@fontsource/league-spartan/700.css";

function Dashboard() {
    const { session, signOut } = UserAuth();
    const navigate = useNavigate();
    console.log(session);

    const handleSignOut = async (e) => {
    e.preventDefault();
    try {
        await signOut();
        navigate("/");
    } catch (err) {
        console.error(err);
    }
    };

    return (
    <div className="min-h-screen bg-[#F6EDDC]">
        {/* Navbar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-[#F76F44]" style={{fontFamily: "League Spartan", fontWeight: 700,}}>
            What<span style={{ color: "#2564F8" }}>To</span>Mod
        </h1>
        <div className="flex items-center gap-5">
            <button
            onClick={() => navigate("/profilePage")}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 transition">
            <LuUser size ={18} />
            Profile
            </button>
            <button
            onClick={handleSignOut}
            className="text-sm font-semibold text-white bg-[#E8541A] hover:bg-[#d14916] rounded-xl px-4 py-3 transition"
            >
            Sign out
            </button>
        </div>
        </header>

        {/* Page content */}
        <main className="max-w-5xl mx-auto px-8 py-12">
        <div className="mb-10">
            <h2 className="text-2xl font-bold text-[#2564F8]">Your One-Stop Academic Planner</h2>
            <p className="text-sm text-gray-500 mt-1">{session?.user?.email}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
            {
                title: "ModSearch",
                desc: "Browse NUS modules with the help of sentiment-based insights",
                tag: "Browse",
                color: "#2D4CC8",
            },
            {
                title: "AcadsPlanner",
                desc: "Drag-and-drop modules into your semester planner easily",
                tag: "Plan",
                color: "#2D4CC8",
            },
            {
                title: "GPA Calculator",
                desc: "Keep track of your GPA, eyes on target!",
                tag: "Calculate",
                color: "#2D4CC8",
            },
            {
                title: "Progress Tracker",
                desc: "See how far you've come!",
                tag: "Progress",
                color: "#2D4CC8",
            },
            ].map(({ title, desc, tag, color }) => (
            <div key={title} onClick={() => title === "AcadsPlanner" ? navigate("/moduleTree") : title == "ModSearch" ? navigate("/insights") : title === "GPA Calculator" ? navigate("/gpaCalculator") : null}
                className={`bg-white rounded-2xl border border-gray-200 px-7 py-6 
                hover:border-[#2D4CC8] hover:shadow-md transition cursor-pointer group`}>
                <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-bold text-gray-800 group-hover:text-[#2D4CC8] transition">{title}</h3>
                <span
                    className="text-xs font-semibold rounded-lg px-2.5 py-1 ml-3 shrink-0"
                    style={{ color, background: `${color}15` }}
                >
                    {tag}
                </span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
            ))}
        </div>
        </main>
    </div>
    );
}

export default Dashboard;