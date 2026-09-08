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
      setSuccessMsg('🎉 Thank you! Your feedback has been submitted successfully.');
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
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-6" />
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4 mb-3" />
            <div className="h-8 bg-slate-200 rounded w-3/4 mb-2" />
            <div className="h-4 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      </main>
    );
  }

  if (error && !event) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 p-6">
        <div className="max-w-3xl mx-auto">
          <button onClick={() => navigate('student-dashboard')} className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            My Events
          </button>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-red-700 font-semibold">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <button onClick={() => navigate('student-dashboard')} className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            Back to My Events
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Event Card */}
        {event && (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-indigo-500 to-violet-500" />
            <div className="p-6">
              <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-1">{event.type} · {event.department}</p>
              <h1 className="text-2xl font-bold text-slate-900 mb-3">{event.name}</h1>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 font-medium mb-0.5">Date</p>
                  <p className="text-slate-700 font-semibold">{formatDate(event.date as string)}</p>
                </div>
                {event.venue && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-0.5">Venue</p>
                    <p className="text-slate-700 font-semibold">{event.venue}</p>
                  </div>
                )}
                {event.startTime && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-0.5">Time</p>
                    <p className="text-slate-700 font-semibold">{event.startTime} – {event.endTime || '—'}</p>
                  </div>
                )}
                {event.status && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-0.5">Status</p>
                    <p className="text-slate-700 font-semibold">{event.status}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Feedback Section */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Event Feedback</h2>
            {event && <p className="text-sm text-slate-500 mb-6">{event.name}</p>}

            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8 text-emerald-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Feedback Submitted!</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  {successMsg || 'Your feedback has been recorded successfully. Thank you for your response!'}
                </p>
                <button
                  onClick={() => navigate('student-dashboard')}
                  className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Return to My Events
                </button>
              </div>
            ) : !form ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-slate-400">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-slate-700 font-semibold mb-2">
                  {formStatus === 'Closed' ? 'Feedback is Closed' : 'Feedback Not Available Yet'}
                </p>
                <p className="text-slate-500 text-sm">
                  {formStatus === 'Closed'
                    ? 'The feedback form for this event has been closed.'
                    : 'The coordinator has not published a feedback form for this event yet.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {form.questions.map((question, index) => (
                  <div key={question.id} className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">
                      <span className="text-slate-400 mr-2">{index + 1}.</span>
                      {question.text}
                      {question.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {question.type === 'text' ? (
                      <textarea
                        required={Boolean(question.required)}
                        value={String(answers[question.id] || '')}
                        onChange={e => setAnswer(question.id, e.target.value)}
                        placeholder="Type your answer here..."
                        rows={3}
                        className="w-full border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl p-3 text-sm text-slate-700 outline-none transition-all resize-none"
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
                            <div className={`w-12 h-12 flex items-center justify-center rounded-xl border-2 text-sm font-bold transition-all cursor-pointer
                              ${answers[question.id] === String(rating)
                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                              }`}>
                              {rating}
                            </div>
                          </label>
                        ))}
                        <span className="text-xs text-slate-400 ml-1">
                          {answers[question.id] ? `Selected: ${answers[question.id]}/5` : '1 = Poor, 5 = Excellent'}
                        </span>
                      </div>
                    ) : question.type === 'yes-no' ? (
                      <div className="flex gap-3">
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
                            <div className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold text-center transition-all
                              ${answers[question.id] === option
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                              }`}>
                              {option}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      // Multiple choice / dropdown
                      <div className="space-y-2">
                        {(question.options?.length ? question.options : ['Option 1', 'Option 2']).map(option => (
                          <label key={option} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-all">
                            <input
                              type="radio"
                              name={question.id}
                              required={Boolean(question.required)}
                              checked={answers[question.id] === option}
                              onChange={() => setAnswer(question.id, option)}
                              className="w-4 h-4 text-indigo-600 border-slate-300"
                            />
                            <span className="text-sm text-slate-700 font-medium">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      Submit Feedback
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}