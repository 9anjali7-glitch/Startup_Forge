import React, { useRef, useState } from 'react';
import {
    ArrowRight,
    CheckCircle2,
    Target,
    Zap
} from 'lucide-react';

interface LandingPageProps {
    onLogin: (id: string, role: string, name: string) => void;
}

export const LandingPage = ({ onLogin }: LandingPageProps) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('investor');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const nameInputRef = useRef<HTMLInputElement>(null);
    const focusLogin = () => { nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); nameInputRef.current?.focus({ preventScroll: true }); };

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!name) {
            setError("Please enter your name");
            return;
        }
        setLoading(true);
        setError('');

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
            const res = await fetch(`${apiUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, role })
            });

            const data = await res.json();

            if (res.ok && data.success && data.userId != null) {
                onLogin(data.userId.toString(), role, data.name);
            } else {
                setError(data.error || "Login failed. Please check your spelling.");
            }
        } catch (err) {
            console.error("Login Check Failed", err);
            setError("Server connection failed. Ensure Backend is running.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* --- Navbar --- */}
            <nav className="max-w-7xl mx-auto px-6 py-5 md:py-8 flex justify-between items-center relative z-20">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">StartupForge</span>
                </div>

                <div className="flex items-center gap-4">
                    <button type="button" onClick={focusLogin} className="text-sm font-bold text-slate-900 hover:opacity-70">Log In</button>
                    <button type="button" onClick={focusLogin} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-full hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        Get Started
                    </button>
                </div>
            </nav>

            {/* --- Hero Section --- */}
            <header className="max-w-7xl mx-auto px-6 pt-10 pb-16 md:pt-12 md:pb-32 grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16 items-center relative z-10">

                {/* Left: Copy */}
                <div className="max-w-xl">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15] mb-6 md:mb-8">
                        Get funded early,<br />
                        scale automatically<br />
                        <span className="text-indigo-600">all your deals.</span>
                    </h1>
                    <p className="text-lg text-slate-500 mb-10 leading-relaxed">
                        Connect with world-class investors, perform instant due diligence, and secure your next round with the most advanced matching engine in the industry.
                    </p>

                </div>

                {/* Right: Interactive Login Card (Floating Visual) */}
                <div className="relative w-full">
                    {/* Background Blob */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-indigo-100 rounded-full blur-[80px] -z-10 opacity-60"></div>

                    {/* Main Floating Card (Login) */}
                    <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 relative backdrop-blur-sm">

                        {/* Decoration: Credit Card style float */}
                        <div className="absolute -right-8 -top-8 bg-slate-900 text-white p-6 rounded-3xl shadow-2xl w-48 hidden md:block animate-in slide-in-from-bottom-4 duration-1000">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
                                    <Target className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-xs font-mono opacity-50">**** 4242</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs opacity-70">Match Confidence</div>
                                <div className="text-2xl font-bold tracking-tight">98.4%</div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
                            <p className="text-slate-500 mt-1">Access your deal flow dashboard.</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">Full Name</label>
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-all shadow-sm"
                                    placeholder="e.g. Mark Suster"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setRole('investor')}
                                    className={`py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all font-bold text-sm ${role === 'investor'
                                        ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                        : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                                        }`}
                                >
                                    Investor
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('founder')}
                                    className={`py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all font-bold text-sm ${role === 'founder'
                                        ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                        : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                                        }`}
                                >
                                    Founder
                                </button>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? 'Authenticating...' : 'Enter Dashboard'}
                                {!loading && <ArrowRight className="w-5 h-5" />}
                            </button>
                        </form>

                        <div className="mt-6 text-center text-xs text-slate-400">
                            Try: <span className="text-indigo-600 font-bold cursor-pointer hover:underline" onClick={() => { setName('Mark Suster'); setRole('investor'); }}>Mark Suster</span> or <span className="text-emerald-600 font-bold cursor-pointer hover:underline" onClick={() => { setName('1upHealth'); setRole('founder'); }}>1upHealth</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- Footer --- */}
            <footer className="bg-slate-50 py-16 border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-start gap-12">
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
                                <Zap className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-lg font-bold text-slate-900">StartupForge</span>
                        </div>
                        <p className="text-slate-500 text-sm max-w-xs">
                            © {new Date().getFullYear()} Startup Forge Inc.<br />
                            All rights reserved.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-16">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-4">Solutions</h4>
                            <ul className="space-y-3 text-sm text-slate-500">
                                <li><a href="#" className="hover:text-slate-900">Small Business</a></li>
                                <li><a href="#" className="hover:text-slate-900">Freelancers</a></li>
                                <li><a href="#" className="hover:text-slate-900">Customers</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 mb-4">Company</h4>
                            <ul className="space-y-3 text-sm text-slate-500">
                                <li><a href="#" className="hover:text-slate-900">About Us</a></li>
                                <li><a href="#" className="hover:text-slate-900">Career</a></li>
                                <li><a href="#" className="hover:text-slate-900">Contact</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 mb-4">Learn</h4>
                            <ul className="space-y-3 text-sm text-slate-500">
                                <li><a href="#" className="hover:text-slate-900">Blog</a></li>
                                <li><a href="#" className="hover:text-slate-900">Ebooks</a></li>
                                <li><a href="#" className="hover:text-slate-900">Guides</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    );
};
