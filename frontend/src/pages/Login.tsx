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
      const response = await axios.post(
        `${apiUrl}/api/auth/login`,
        {
          email,
          password
        }
      );

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
          'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!registerNumber.trim()) { setError('Please enter your register number'); return; }
    setLoading(true);
    try {
      const response = await axios.post(`${apiUrl}/api/student/login`, { registerNumber });
      const { token, student } = response.data;
      const user = { id: `student-${student.registerNumber}`, name: student.registerNumber, email: '', department: '', role: 'student' as const, active: true, registerNumber: student.registerNumber };
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem('token', token);
      storage.setItem('user', JSON.stringify(user));
      onLogin(user, token, remember);
    } catch (err: any) {
      setError(err.response?.data?.message || 'You are not part of any events.');
    } finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setSuccess('');

    if (
      !name ||
      !email ||
      !password ||
      !confirmPassword ||
      !department
    ) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isStrongPassword(password)) {
      setError('Password must be at least 8 characters and include upper, lower, and numeric characters');
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        `${apiUrl}/api/auth/register`,
        {
          name,
          email,
          password,
          department,
          role: signupRole
        }
      );

      setSuccess(
        `${signupRole === 'faculty' ? 'Faculty' : 'Coordinator'} account created. Please wait for approval before signing in.`
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
      }, 1500);
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
      setError('Password must be at least 8 characters and include upper, lower, and numeric characters');
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
      setSuccess('Password reset successfully. Please sign in.');
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
    <div className="min-h-screen flex">

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 flex-col items-center justify-center p-12 relative overflow-hidden">

        <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full -translate-x-32 -translate-y-32" />

        <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/5 rounded-full translate-x-20 translate-y-20" />

        <div className="absolute top-1/2 right-0 w-64 h-64 bg-violet-500/20 rounded-full translate-x-32" />

        <div className="relative z-10 text-center text-white max-w-md">

          <div className="flex items-center justify-center gap-3 mb-8">

            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">

              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-8 h-8 text-white"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>

            </div>

            <div className="text-left">
              <div className="text-2xl font-bold font-heading">
                Academic Event Hub
              </div>

              <div className="text-indigo-200 text-sm">
                SmartEvents Platform
              </div>
            </div>

          </div>

          <div className="mb-8 rounded-3xl overflow-hidden border border-white/20 shadow-2xl">

            <img
              src={sonaCollegeImg}
              alt="Sona College of Technology"
              className="w-full h-52 object-cover object-center"
            />

          </div>

          <h2 className="text-3xl font-bold font-heading mb-3">
            Manage Academic Events
          </h2>

          <p className="text-indigo-200 text-base leading-relaxed">
            A comprehensive platform for IT & AI/DS departments to
            plan, track, document, and analyze academic events
            seamlessly.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-4">

            {[
              {
                label: 'Events Tracked',
                value: '120+'
              },
              {
                label: 'Departments',
                value: '2'
              },
              {
                label: 'Academic Years',
                value: '3+'
              }
            ].map(stat => (

              <div
                key={stat.label}
                className="bg-white/10 rounded-xl p-3 backdrop-blur-sm"
              >

                <div className="text-2xl font-bold">
                  {stat.value}
                </div>

                <div className="text-indigo-200 text-xs">
                  {stat.label}
                </div>

              </div>

            ))}

          </div>

        </div>

      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">

        <div className="w-full max-w-md">

          <div className="lg:hidden flex items-center gap-3 mb-8">

            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">

              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-6 h-6 text-white"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>

            </div>

            <div>

              <div className="text-xl font-bold font-heading text-gray-900">
                Academic Event Hub
              </div>

              <div className="text-gray-400 text-xs">
                SmartEvents Platform
              </div>

            </div>

          </div>

          <div className="mb-8">

            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">

              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-7 h-7 text-indigo-600"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="18"
                  rx="2"
                  ry="2"
                />

                <line
                  x1="16"
                  y1="2"
                  x2="16"
                  y2="6"
                />

                <line
                  x1="8"
                  y1="2"
                  x2="8"
                  y2="6"
                />

                <line
                  x1="3"
                  y1="10"
                  x2="21"
                  y2="10"
                />

              </svg>

            </div>

            <h1 className="text-3xl font-bold font-heading text-gray-900">
              {resetStep
                ? resetStep === 'email'
                  ? 'Reset your password'
                  : resetStep === 'otp'
                  ? 'Enter verification code'
                  : 'Create a new password'
                : studentMode
                ? 'Student Login'
                : isSignup
                ? 'Create your account'
                : 'Welcome back'}
            </h1>

            <p className="text-gray-500 mt-1">
              {resetStep
                ? resetStep === 'email'
                  ? 'Enter your email to receive a one-time verification code'
                  : resetStep === 'otp'
                  ? `Enter the 6-digit code sent to ${email}`
                  : 'Choose a new password for your account'
                : studentMode
                ? 'Enter your register number to view your events'
                : isSignup
                ? 'Register for your Academic Event Hub account'
                : 'Sign in to your Academic Event Hub account'}
            </p>

          </div>

          {error && (

            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>

          )}

          {success && (

            <div className="mb-5 p-3 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm">
              {success}
            </div>

          )}

          {resetStep === 'email' ? (
            <form onSubmit={handleRequestReset} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@college.edu"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900 placeholder-gray-400"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200">
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
              <button type="button" onClick={returnToLogin} className="w-full text-sm text-gray-500 hover:text-gray-700">
                Back to sign in
              </button>
            </form>
          ) : resetStep === 'otp' ? (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">One-time password</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900 placeholder-gray-400 tracking-[0.4em] text-center"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200">
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
              <button type="button" onClick={() => setResetStep('email')} className="w-full text-sm text-gray-500 hover:text-gray-700">
                Use a different email
              </button>
            </form>
          ) : resetStep === 'password' ? (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8+ chars, upper, lower, number"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900 placeholder-gray-400"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200">
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          ) : studentMode ? (
            <form onSubmit={handleStudentLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Register Number</label>
                <input type="text" value={registerNumber} onChange={e => setRegisterNumber(e.target.value)} placeholder="Enter your register number" autoFocus className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900 placeholder-gray-400" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200">
                {loading ? 'Checking attendance...' : 'Student Login'}
              </button>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-gray-300" /><span className="text-sm text-gray-600">Remember me</span></label>
            </form>
          ) : !isSignup ? (

            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>

                <input
                  type="text"
                  value={email}
                  onChange={e =>
                    setEmail(e.target.value)
                  }
                  placeholder="hod@college.edu"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-gray-900 placeholder-gray-400"
                />

              </div>

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>

                <div className="relative">

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={password}
                    onChange={e =>
                      setPassword(e.target.value)
                    }
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-gray-900 placeholder-gray-400 pr-16"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                  >
                    {showPassword
                      ? 'Hide'
                      : 'Show'}
                  </button>

                </div>

              </div>

              <div className="flex items-center justify-between">

                <label className="flex items-center gap-2 cursor-pointer">

                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e =>
                      setRemember(
                        e.target.checked
                      )
                    }
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300"
                  />

                  <span className="text-sm text-gray-600">
                    Remember me
                  </span>

                </label>

                <button
                  type="button"
                  onClick={startPasswordReset}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Forgot password?
                </button>

              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200"
              >
                {loading
                  ? 'Signing In...'
                  : 'Sign In'}
              </button>

            </form>

          ) : (

            <form
              onSubmit={handleSignup}
              className="space-y-4"
            >

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={e =>
                    setName(e.target.value)
                  }
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900"
                />

              </div>

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={e =>
                    setEmail(e.target.value)
                  }
                  placeholder="name@college.edu"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900"
                />

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password
                  </label>

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={password}
                    onChange={e =>
                      setPassword(e.target.value)
                    }
                    placeholder="8+ chars, upper, lower, number"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900"
                  />

                </div>

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm Password
                  </label>

                  <input
                    type={
                      showConfirmPassword
                        ? 'text'
                        : 'password'
                    }
                    value={confirmPassword}
                    onChange={e =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="Confirm"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900"
                  />

                </div>

              </div>

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Department
                </label>

                <select
                  value={department}
                  onChange={e =>
                    setDepartment(e.target.value)
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900"
                >

                  <option value="IT">
                    Information Technology
                  </option>

                  <option value="AI&DS">
                    Artificial Intelligence & Data Science
                  </option>

                </select>

              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Account Type
                </label>
                <select
                  value={signupRole}
                  onChange={e => setSignupRole(e.target.value as SignupRole)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-900"
                >
                  <option value="faculty">Faculty</option>
                  <option value="coordinator">Event Coordinator</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all duration-200"
              >
                {loading
                  ? 'Creating Account...'
                  : 'Create Account'}
              </button>

            </form>

          )}

          {!resetStep && (
          <div className="mt-6 text-center">

            <span className="text-sm text-gray-500">
              {studentMode ? 'Staff login?' : isSignup
                ? 'Already have an account?'
                : "Don't have an account?"}
            </span>

            <button
              type="button"
              onClick={studentMode ? switchStudentMode : switchMode}
              className="ml-2 text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              {studentMode ? 'Staff Sign In' : isSignup
                ? 'Sign In'
                : 'Sign Up'}
            </button>

            {!studentMode && <button type="button" onClick={switchStudentMode} className="block mx-auto mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-semibold">Student Login</button>}

          </div>
          )}

          <p className="mt-8 text-center text-xs text-gray-400">
            Academic Event Hub — Department of IT & AI/DS
            <br />
            Unauthorized access is prohibited.
          </p>

        </div>

      </div>

    </div>
  );
}