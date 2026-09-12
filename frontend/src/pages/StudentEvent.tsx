import { useEffect, useState } from 'react';
import type { Page } from '../types';
import { getStudentEvent, getStudentFeedback, submitStudentFeedback, type StudentEventRecord, type StudentFeedbackForm } from '../services/api';

interface Props { eventId: string; navigate: (page: Page, eventId?: string) => void; }

export default function StudentEvent({ eventId, navigate }: Props) {
  const [event, setEvent] = useState<StudentEventRecord | null>(null);
  const [form, setForm] = useState<StudentFeedbackForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([getStudentEvent(eventId), getStudentFeedback(eventId)])
      .then(([eventData, feedback]) => {
        setEvent(eventData);
        setForm(feedback.form);
        setFormStatus(feedback.status || null);
        setSubmitted(feedback.submitted);
      })
      .catch(err => setError(err.response?.data?.message || 'Unable to load this event.'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const setAnswer = (id: string, value: unknown) =>
    setAnswers(prev => ({ ...prev, [id]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await submitStudentFeedback(eventId, form._id, answers);
      setSubmitted(true);
      setSuccessMsg('Your feedback has been submitted successfully. Thank you!');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Unable to submit feedback. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }); }
    catch { return String(d).slice(0, 10); }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
        <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
          <div className="h-4 w-28 bg-slate-800 rounded" />
          <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-800 space-y-3">
            <div className="h-4 bg-slate-700 rounded w-1/4" />
            <div className="h-7 bg-slate-700 rounded w-3/4" />
          </div>
        </div>
      </main>
    );
  }

  if (error && !event) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <button onClick={() => navigate('student-dashboard')} className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
            &larr; Back to My Events
          </button>
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-6 text-center text-rose-300 text-sm">
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Header bar */}
      <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('student-dashboard')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Return to My Events
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Event Meta Card */}
        {event && (
          <section className="bg-slate-800/60 rounded-2xl border border-slate-700/80 shadow-lg overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">{event.type} &bull; {event.department}</span>
                {event.status && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {event.status}
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-extrabold font-heading text-white tracking-tight">{event.name}</h1>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <p className="text-slate-500 font-medium text-[10px] uppercase">Date</p>
                  <p className="text-slate-200 font-semibold mt-0.5">{formatDate(event.date as string)}</p>
                </div>
                {event.venue && (
                  <div>
                    <p className="text-slate-500 font-medium text-[10px] uppercase">Venue</p>
                    <p className="text-slate-200 font-semibold mt-0.5 truncate">{event.venue}</p>
                  </div>
                )}
                {event.startTime && (
                  <div>
                    <p className="text-slate-500 font-medium text-[10px] uppercase">Time</p>
                    <p className="text-slate-200 font-semibold mt-0.5">{event.startTime} - {event.endTime || '—'}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Feedback Section */}
        <section className="bg-slate-800/60 rounded-2xl border border-slate-700/80 shadow-lg overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="pb-3 border-b border-slate-700/60">
              <h2 className="text-lg font-bold font-heading text-white">Event Feedback Submission</h2>
              {event && <p className="text-xs text-slate-400 mt-0.5">Please share your honest ratings and feedback for {event.name}</p>}
            </div>

            {submitted ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-14 h-14 bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-7 h-7">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold font-heading text-white">Feedback Submitted!</h3>
                <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
                  {successMsg || 'Your feedback response has been recorded in the database.'}
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => navigate('student-dashboard')}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/30 transition-all"
                  >
                    Return to Student Dashboard
                  </button>
                </div>
              </div>
            ) : !form ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-12 h-12 bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center mx-auto border border-slate-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-slate-300 font-semibold text-sm">
                  {formStatus === 'Closed' ? 'Feedback Period Closed' : 'Feedback Form Not Published Yet'}
                </p>
                <p className="text-slate-500 text-xs max-w-xs mx-auto">
                  {formStatus === 'Closed'
                    ? 'The feedback window for this event has expired.'
                    : 'The event coordinator has not opened feedback submissions for this event yet.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {form.questions.map((question, index) => (
                  <div key={question.id} className="space-y-2.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      <span className="text-indigo-400 font-bold mr-1.5">{index + 1}.</span>
                      {question.text}
                      {question.required && <span className="text-rose-400 ml-1">*</span>}
                    </label>

                    {question.type === 'text' ? (
                      <textarea
                        required={Boolean(question.required)}
                        value={String(answers[question.id] || '')}
                        onChange={e => setAnswer(question.id, e.target.value)}
                        placeholder="Type your feedback response here..."
                        rows={3}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                      />
                    ) : question.type === 'rating' ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {[1, 2, 3, 4, 5].map(rating => (
                          <label key={rating} className="cursor-pointer">
                            <input
                              type="radio"
                              name={question.id}
                              required={Boolean(question.required)}
                              checked={answers[question.id] === String(rating)}
                              onChange={() => setAnswer(question.id, String(rating))}
                              className="sr-only"
                            />
                            <div className={`w-11 h-11 flex items-center justify-center rounded-xl border text-xs font-bold transition-all ${
                              answers[question.id] === String(rating)
                                ? 'border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105'
                                : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                            }`}>
                              {rating}
                            </div>
                          </label>
                        ))}
                        <span className="text-[11px] text-slate-500 ml-2">
                          {answers[question.id] ? `Selected: ${answers[question.id]} / 5` : '1 = Poor, 5 = Excellent'}
                        </span>
                      </div>
                    ) : question.type === 'yes-no' ? (
                      <div className="flex gap-3 max-w-xs">
                        {['Yes', 'No'].map(option => (
                          <label key={option} className="cursor-pointer flex-1">
                            <input
                              type="radio"
                              name={question.id}
                              required={Boolean(question.required)}
                              checked={answers[question.id] === option}
                              onChange={() => setAnswer(question.id, option)}
                              className="sr-only"
                            />
                            <div className={`py-2.5 px-4 rounded-xl border text-xs font-semibold text-center transition-all ${
                              answers[question.id] === option
                                ? 'border-indigo-500 bg-indigo-600 text-white shadow-md'
                                : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                            }`}>
                              {option}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(question.options?.length ? question.options : ['Option 1', 'Option 2']).map(option => (
                          <label key={option} className="flex items-center gap-3 p-3 rounded-xl border border-slate-700 bg-slate-900/40 hover:border-slate-600 cursor-pointer transition-all">
                            <input
                              type="radio"
                              name={question.id}
                              required={Boolean(question.required)}
                              checked={answers[question.id] === option}
                              onChange={() => setAnswer(question.id, option)}
                              className="w-4 h-4 text-indigo-600 bg-slate-800 border-slate-700"
                            />
                            <span className="text-xs text-slate-300 font-medium">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {error && (
                  <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? 'Submitting Responses...' : 'Submit Feedback Response'}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}