import { useState } from 'react';
import axios from 'axios';
import sonaCollegeImg from '../imports/sona_college.jpeg';
import type { UserRole } from '../types';

interface LoginProps {
  onLogin: (user: AuthUser, token: string, remember: boolean) => void;
}

type ResetStep = 'email' | 'otp' | 'password';
type SignupRole = 'coordinator' | 'faculty';
interface AuthUser {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  active: boolean;
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const isStrongPassword = (value: string) =>
  value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);

export default function Login({ onLogin }: LoginProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [studentMode, setStudentMode] = useState(false);
  const [registerNumber, setRegisterNumber] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('IT');
  const [signupRole, setSignupRole] = useState<SignupRole>('faculty');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [resetStep, setResetStep] = useState<ResetStep | null>(null);
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${apiUrl}/api/auth/login`, {
        email,
        password
      });

      const { token, user } = response.data;

      if (remember) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));
      }

      onLogin(user, token, remember);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Login failed. Please verify your credentials and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!registerNumber.trim()) {
      setError('Please enter your register number');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${apiUrl}/api/student/login`, { registerNumber });
      const { token, student } = response.data;
      const user = {
        id: `student-${student.registerNumber}`,
        name: student.registerNumber,
        email: '',
        department: '',
        role: 'student' as const,
        active: true,
        registerNumber: student.registerNumber
      };
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem('token', token);
      storage.setItem('user', JSON.stringify(user));
      onLogin(user, token, remember);
    } catch (err: any) {
      setError(err.response?.data?.message || 'You are not part of any events.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name || !email || !password || !confirmPassword || !department) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isStrongPassword(password)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and numeric characters');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${apiUrl}/api/auth/register`, {
        name,
        email,
        password,
        department,
        role: signupRole
      });

      setSuccess(
        `${signupRole === 'faculty' ? 'Faculty' : 'Coordinator'} account created successfully. Please wait for HOD/Admin approval before signing in.`
      );

      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDepartment('IT');
      setSignupRole('faculty');

      setTimeout(() => {
        setIsSignup(false);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${apiUrl}/api/auth/forgot-password`, { email });
      setResetStep('otp');
      setSuccess('If that email is registered, a verification code has been sent.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!otp || !/^\d{6}$/.test(otp)) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${apiUrl}/api/auth/verify-otp`, { email, otp });
      setResetToken(response.data.resetToken);
      setResetStep('password');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!password || !confirmPassword) {
      setError('Please fill in both password fields');
      return;
    }
    if (!isStrongPassword(password)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and numeric characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${apiUrl}/api/auth/reset-password`, {
        email,
        resetToken,
        password
      });
      setResetStep(null);
      setPassword('');
      setConfirmPassword('');
      setOtp('');
      setResetToken('');
      setSuccess('Password reset successfully. Please sign in with your new password.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const startPasswordReset = () => {
    setIsSignup(false);
    setResetStep('email');
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setResetToken('');
  };

  const returnToLogin = () => {
    setResetStep(null);
    setError('');
    setSuccess('');
    setOtp('');
    setResetToken('');
    setPassword('');
    setConfirmPassword('');
  };

  const switchMode = () => {
    setIsSignup(!isSignup);
    setError('');
    setSuccess('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const switchStudentMode = () => {
    setStudentMode(value => !value);
    setIsSignup(false);
    setResetStep(null);
    setError('');
    setSuccess('');
    setRegisterNumber('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Left Branding Hero Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-indigo-950 border-r border-slate-800/60">
        {/* Glow Effects & Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold font-heading tracking-tight text-white flex items-center gap-2">
              Academic Event Hub
              <span className="text-[10px] uppercase tracking-wider bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                Enterprise
              </span>
            </div>
            <div className="text-slate-400 text-xs font-medium">SmartEvents Platform • IT & AI/DS</div>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="relative z-10 my-auto max-w-lg">
          <div className="mb-6 rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl shadow-slate-950/80 group">
            <div className="relative">
              <img
                src={sonaCollegeImg}
                alt="Sona College of Technology"
                className="w-full h-56 object-cover object-center group-hover:scale-105 transition-transform duration-700 brightness-95"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-slate-300 font-medium bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/50">
                <span>Sona College of Technology</span>
                <span className="text-indigo-400 font-semibold">NAAC A++ Accredited</span>
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-extrabold font-heading text-white tracking-tight leading-tight mb-3">
            Streamlined Management for Academic Excellence
          </h2>

          <p className="text-slate-300 text-sm leading-relaxed mb-8">
            An end-to-end institutional platform built for IT and AI/DS departments to coordinate, document, verify, and generate NAAC-compliant event reports seamlessly.
          </p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Events Tracked', value: '120+' },
              { label: 'Departments', value: 'IT & AI/DS' },
              { label: 'Compliance Rate', value: '100%' }
            ].map(stat => (
              <div
                key={stat.label}
                className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-md hover:border-slate-700 transition-colors"
              >
                <div className="text-xl font-bold text-white font-heading">{stat.value}</div>
                <div className="text-slate-400 text-xs mt-0.5 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between">
          <span>&copy; {new Date().getFullYear()} Sona College of Technology</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System Operational
          </span>
        </div>
      </div>

      {/* Right Login/Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-900 relative">
        <div className="w-full max-w-md">
          {/* Mobile Header Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/30">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold font-heading text-white">Academic Event Hub</div>
              <div className="text-slate-400 text-xs">SmartEvents Platform</div>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 mb-4 shadow-inner">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white tracking-tight">
              {resetStep
                ? resetStep === 'email'
                  ? 'Reset your password'
                  : resetStep === 'otp'
                  ? 'Verification Code'
                  : 'Set New Password'
                : studentMode
                ? 'Student Access Portal'
                : isSignup
                ? 'Create Account'
                : 'Sign In to Portal'}
            </h1>

            <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
              {resetStep
                ? resetStep === 'email'
                  ? 'Enter your institutional email to receive a 6-digit verification code'
                  : resetStep === 'otp'
                  ? `Enter the 6-digit security code sent to ${email}`
                  : 'Enter and confirm your new secure password'
                : studentMode
                ? 'Enter your register number to access your event record and certificates'
                : isSignup
                ? 'Request a new Faculty or Coordinator account'
                : 'Enter your credentials to manage academic events and reports'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-sm flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Success Alert */}
          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-sm flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
              <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Reset Flow: Step 1 Email */}
          {resetStep === 'email' ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Institutional Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@sonatech.ac.in"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm tracking-wide"
              >
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
              <button
                type="button"
                onClick={returnToLogin}
                className="w-full text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors pt-2"
              >
                &larr; Return to Sign In
              </button>
            </form>
          ) : resetStep === 'otp' ? (
            /* Reset Flow: Step 2 OTP */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 text-center">
                  6-Digit One-Time Security Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent tracking-[0.6em] text-center text-xl font-mono font-bold"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm tracking-wide"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
              <button
                type="button"
                onClick={() => setResetStep('email')}
                className="w-full text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors pt-2"
              >
                Change Email Address
              </button>
            </form>
          ) : resetStep === 'password' ? (
            /* Reset Flow: Step 3 New Password */
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8+ chars, upper, lower & number"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm tracking-wide"
              >
                {loading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          ) : studentMode ? (
            /* Student Login Mode */
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Student Register Number
                </label>
                <input
                  type="text"
                  value={registerNumber}
                  onChange={e => setRegisterNumber(e.target.value)}
                  placeholder="e.g. 611421205001"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase font-mono tracking-wider transition-all"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 rounded focus:ring-indigo-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-xs text-slate-400">Remember this browser</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm tracking-wide"
              >
                {loading ? 'Verifying Student Info...' : 'Access Student Portal'}
              </button>
            </form>
          ) : !isSignup ? (
            /* Staff Sign In Mode */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Institutional Email
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="hod@sonatech.ac.in"
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={startPasswordReset}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-12 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-medium px-1 py-0.5 rounded"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700 rounded focus:ring-indigo-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-xs text-slate-400">Remember login</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm tracking-wide"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          ) : (
            /* Staff Sign Up Mode */
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Dr. Jane Doe"
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Institutional Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="janedoe@sonatech.ac.in"
                  className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="8+ chars, A-Z, 0-9"
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Confirm
                  </label>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                  >
                    <option value="IT">Information Technology</option>
                    <option value="AI&DS">AI & Data Science</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Account Role
                  </label>
                  <select
                    value={signupRole}
                    onChange={e => setSignupRole(e.target.value as SignupRole)}
                    className="w-full px-3.5 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                  >
                    <option value="faculty">Faculty Member</option>
                    <option value="coordinator">Event Coordinator</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm tracking-wide mt-2"
              >
                {loading ? 'Submitting Registration...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Bottom Switch Links */}
          {!resetStep && (
            <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col items-center gap-3">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>
                  {studentMode
                    ? 'Faculty or Administrator?'
                    : isSignup
                    ? 'Already registered?'
                    : "Need a new account?"}
                </span>
                <button
                  type="button"
                  onClick={studentMode ? switchStudentMode : switchMode}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                >
                  {studentMode ? 'Staff Sign In' : isSignup ? 'Sign In' : 'Request Account'}
                </button>
              </div>

              {!studentMode && (
                <button
                  type="button"
                  onClick={switchStudentMode}
                  className="text-xs text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/40 transition-all"
                >
                  <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                  Switch to Student Attendance Portal
                </button>
              )}
            </div>
          )}

          <p className="mt-8 text-center text-[11px] text-slate-600">
            Academic Event Hub &bull; Sona College of Technology
            <br />
            Confidential System. Unauthorized access is monitored.
          </p>
        </div>
      </div>
    </div>
  );
}