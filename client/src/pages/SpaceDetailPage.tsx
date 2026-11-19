import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Space, ReportStatus } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ZoneBadge } from '../components/ZoneBadge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, AlertTriangle, 
  XCircle, Zap, Wifi, Layers, Square, ThumbsDown, 
  Flag, CalendarClock, Building2, ArrowRight,
  Info, CheckCircle2
} from 'lucide-react';

export const SpaceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & form state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [showProblemModal, setShowProblemModal] = useState(false);
  const [problemCategory, setProblemCategory] = useState('general');
  const [problemNote, setProblemNote] = useState('');
  const [problemSuccess, setProblemSuccess] = useState<string | null>(null);

  const [holding, setHolding] = useState(false);
  const [holdMessage, setHoldMessage] = useState<string | null>(null);

  const fetchSpace = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.spaces.getById(id);
      setSpace(res.space);
    } catch (err: any) {
      setError(err.message || 'Space not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpace();
  }, [id]);

  // Handle reporting availability
  const handleReport = async (status: ReportStatus) => {
    if (!space) return;
    if (user.role === 'guest') {
      alert('Only authenticated students can submit reports. Please sign in with a student account.');
      return;
    }

    try {
      setReporting(true);
      setReportError(null);
      await api.reports.submit(space.id, status);
      setShowReportModal(false);
      await fetchSpace();
    } catch (err: any) {
      setReportError(err.message || 'Failed to submit availability report');
    } finally {
      setReporting(false);
    }
  };

  // Handle flagging inaccurate report
  const handleFlagReport = async (reportId: string) => {
    try {
      const res = await api.reports.flagFeedback(reportId);
      alert(res.message);
      await fetchSpace();
    } catch (err: any) {
      alert(err.message || 'Failed to flag report');
    }
  };

  // Handle problem report submission
  const handleProblemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!space) return;
    if (user.role === 'guest') {
      alert('Please sign in to report a facility issue');
      return;
    }

    try {
      await api.reports.submitProblem(space.id, problemCategory, problemNote);
      setProblemSuccess('Facility maintenance report submitted to campus operations.');
      setProblemNote('');
      setTimeout(() => setShowProblemModal(false), 1500);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle group room reservation request
  const handleRequestHold = async () => {
    if (!space) return;
    if (user.role === 'guest') {
      alert('Please sign in as a student to reserve a room hold');
      return;
    }

    try {
      setHolding(true);
      setHoldMessage(null);
      const res = await api.holds.request(space.id, 120);
      setHoldMessage(res.message);
      setTimeout(() => navigate('/holds'), 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to reserve room');
    } finally {
      setHolding(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[#737373] dark:text-[#A1A1AA] font-medium">
        Loading space information...
      </div>
    );
  }

  if (error || !space) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto my-8">
        <Building2 className="w-8 h-8 text-[#737373] dark:text-[#A1A1AA] mx-auto mb-2" />
        <h3 className="text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
          Study Space Not Found
        </h3>
        <p className="text-xs text-[#737373] dark:text-[#A1A1AA] mt-1 mb-4">
          The requested space record is unavailable or has been archived.
        </p>
        <Link to="/">
          <Button variant="primary" size="sm">
            Return to Space Directory
          </Button>
        </Link>
      </Card>
    );
  }

  const facilityIcons: Record<string, { label: string; icon: any }> = {
    power: { label: 'Dedicated AC Power', icon: Zap },
    wifi: { label: 'High-Speed Campus Wi-Fi', icon: Wifi },
    board: { label: 'Whiteboard / Chalkboard', icon: Layers },
    desk_chair: { label: 'Ergonomic Desk & Chair', icon: Square },
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back Link */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Space Directory</span>
        </Link>
      </div>

      {/* Amber Staleness Notice (> 7 days) */}
      {space.staleness?.is_stale && (
        <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <strong className="font-semibold">Verification Notice:</strong> This space's static facts and facilities were last confirmed {space.staleness.days_ago} days ago ({space.staleness.last_checked_date}). Library staff have been alerted to re-verify.
          </div>
        </div>
      )}

      {/* Classroom Schedule Notice */}
      {space.only_if_no_class && (
        <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 flex items-center gap-2.5 text-xs text-sky-800 dark:text-sky-300">
          <Info className="w-4 h-4 shrink-0 text-sky-600" />
          <span><strong>Lecture Timetable Notice:</strong> Open for independent student study only when no scheduled university class is in session.</span>
        </div>
      )}

      {/* Interactive Seat Reservation Banner */}
      <Card className="p-5 border-orange-200 dark:border-orange-900/50 bg-orange-50/20 dark:bg-orange-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">
            Interactive Seating
          </span>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            Reserve Your Specific Desk or Room
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            BookMyShow-style visual seat map. Pick your exact seat or study pod before walking.
          </p>
        </div>

        <Link to={`/book?spaceId=${space.id}`} className="shrink-0">
          <Button variant="primary" size="md" className="gap-2 shadow-md">
            <span>Select Seat on Map</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </Card>

      {/* Primary Space Overview Card */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <ZoneBadge zone={space.zone_type} size="md" />
              {space.hold_enabled && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                  Hold Eligible
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5] tracking-tight">
              {space.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
              {space.location}
            </p>
          </div>

          <StatusBadge latestReport={space.latest_report} size="md" />
        </div>

        {/* Zone Rule Banner */}
        <div className="p-3.5 rounded-lg bg-[#F8F8F8] dark:bg-[#202127] border border-[#E5E5E5] dark:border-[#33343B]">
          <span className="text-[10px] uppercase font-semibold text-[#737373] dark:text-[#A1A1AA] tracking-wider block mb-0.5">
            Zone Etiquette Rule
          </span>
          <p className="text-xs sm:text-sm font-medium text-[#171717] dark:text-[#F5F5F5] leading-normal">
            "{space.zone_rule}"
          </p>
        </div>

        {space.description && (
          <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] leading-relaxed">
            {space.description}
          </p>
        )}

        {/* Space Meta Facts Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-[#E5E5E5] dark:border-[#33343B] text-xs">
          <div>
            <span className="text-[#737373] dark:text-[#A1A1AA] text-[11px] block">Operating Hours</span>
            <span className="font-medium text-[#171717] dark:text-[#F5F5F5] mt-0.5 block">{space.hours}</span>
          </div>
          <div>
            <span className="text-[#737373] dark:text-[#A1A1AA] text-[11px] block">Last Staff Check</span>
            <span className="font-medium text-[#171717] dark:text-[#F5F5F5] mt-0.5 block">{space.last_checked_at.split('T')[0]}</span>
          </div>
          <div>
            <span className="text-[#737373] dark:text-[#A1A1AA] text-[11px] block">Management Scope</span>
            <span className="font-medium text-[#171717] dark:text-[#F5F5F5] mt-0.5 block capitalize">{space.owner_scope}</span>
          </div>
        </div>
      </Card>

      {/* Facilities & Amenities */}
      <Card className="p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA] mb-3">
          Verified Facilities
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {space.facilities.map(facilityKey => {
            const fac = facilityIcons[facilityKey] || { label: facilityKey, icon: Square };
            const Icon = fac.icon;
            return (
              <div
                key={facilityKey}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F4F4F5] dark:bg-[#292A30] border border-[#E5E5E5] dark:border-[#33343B] text-xs font-medium text-[#171717] dark:text-[#F5F5F5]"
              >
                <Icon className="w-4 h-4 text-[#EA580C] dark:text-[#F97316] shrink-0" />
                <span>{fac.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Usual Busy Times Timetable (No Guesswork) */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA]">
            Usual Busy Rhythm (Historical Fact)
          </h3>
          <span className="text-[11px] text-[#737373] dark:text-[#A1A1AA] font-mono">No live sensors</span>
        </div>

        {space.usual_busy && space.usual_busy.length > 0 ? (
          <div className="space-y-2">
            {space.usual_busy.map(b => (
              <div
                key={b.id}
                className="p-3 rounded-lg bg-[#F8F8F8] dark:bg-[#292A30]/50 border border-[#E5E5E5] dark:border-[#33343B] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    {b.start_time} – {b.end_time}
                  </div>
                  {b.notes && (
                    <p className="text-[#737373] dark:text-[#A1A1AA] text-[11px] mt-0.5">
                      {b.notes}
                    </p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase font-mono ${
                  b.busy_level === 'busy'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                    : 'bg-[#E5E5E5] dark:bg-[#33343B] text-[#171717] dark:text-[#F5F5F5]'
                }`}>
                  {b.busy_level}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#737373] dark:text-[#A1A1AA] italic">
            Usual busy pattern not established for this location.
          </p>
        )}
      </Card>

      {/* Community Availability Reports */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA]">
            Student Availability Reports
          </h3>
          <span className="text-[11px] text-[#737373] dark:text-[#A1A1AA]">Expires after 30 minutes</span>
        </div>

        {space.latest_report ? (
          <div className="p-3.5 rounded-lg bg-[#F8F8F8] dark:bg-[#292A30]/50 border border-[#E5E5E5] dark:border-[#33343B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <StatusBadge latestReport={space.latest_report} size="md" />

            <button
              onClick={() => handleFlagReport(space.latest_report!.id)}
              className="text-xs text-[#737373] hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 self-start sm:self-auto font-medium transition-colors cursor-pointer"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span>Flag as inaccurate</span>
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg bg-[#F8F8F8] dark:bg-[#292A30]/50 border border-[#E5E5E5] dark:border-[#33343B] text-xs text-[#737373] dark:text-[#A1A1AA]">
            No report filed in the last 30 minutes. The system never guesses seat counts; refer to the historical rhythm above.
          </div>
        )}

        {/* Report Availability Trigger Button */}
        <div className="pt-2">
          <Button
            variant="outline"
            size="md"
            className="w-full sm:w-auto"
            onClick={() => setShowReportModal(true)}
          >
            <span>Report Availability</span>
          </Button>
        </div>

        {reportError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
            {reportError}
          </p>
        )}
      </Card>

      {/* Group Room Reservation Hold (If Enabled) */}
      {space.hold_enabled && (
        <Card className="p-5 border-purple-200 dark:border-purple-900/60 bg-purple-50/30 dark:bg-purple-950/20 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-purple-700 dark:text-purple-400" />
            <div>
              <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                Group Room Reservation Hold
              </h3>
              <p className="text-xs text-purple-700/80 dark:text-purple-300/80">
                Max 2 hours duration. Auto-releases if no physical check-in within 15 minutes.
              </p>
            </div>
          </div>

          {space.active_hold ? (
            <div className="p-3 rounded-lg bg-white dark:bg-[#202127] border border-purple-200 dark:border-purple-800 text-xs space-y-1">
              <span className="font-semibold text-purple-800 dark:text-purple-300">
                Currently Reserved
              </span>
              <p className="text-[#737373] dark:text-[#A1A1AA]">
                Hold active until {new Date(space.active_hold.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
              </p>
              {space.active_hold.is_my_hold && (
                <div className="pt-2">
                  <Link to="/holds">
                    <Button variant="primary" size="sm">
                      Manage My Hold & Check-In
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div>
              <Button
                variant="primary"
                size="md"
                disabled={holding}
                onClick={handleRequestHold}
                className="bg-purple-700 hover:bg-purple-800 text-white"
              >
                <span>{holding ? 'Securing reservation...' : 'Reserve Group Room (Hold)'}</span>
              </Button>
            </div>
          )}

          {holdMessage && (
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {holdMessage}
            </p>
          )}
        </Card>
      )}

      {/* Prominent Alternative Spaces Callout (Plan B) */}
      <Card className="p-5 sm:p-6 border-[#E5E5E5] dark:border-[#33343B] space-y-2">
        <h4 className="font-semibold text-sm text-[#171717] dark:text-[#F5F5F5]">
          If it's full, try next
        </h4>
        <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA]">
          Avoid walking floor-to-floor. View the 2 to 3 closest verified alternative study locations.
        </p>
        <div className="pt-2">
          <Link to={`/spaces/${space.id}/plan-b`}>
            <Button variant="primary" size="md" className="gap-2" icon={<ArrowRight className="w-4 h-4" />}>
              <span>View Alternative Spaces (Plan B)</span>
            </Button>
          </Link>
        </div>
      </Card>

      {/* Facility Issue Action */}
      <div className="text-center pt-2">
        <button
          onClick={() => setShowProblemModal(true)}
          className="text-xs text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Report a space issue (noise violation, broken outlet, maintenance)</span>
        </button>
      </div>

      {/* Report Availability Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Report Availability"
        description="Share current space status with fellow students. Reports expire after 30 minutes and are completely anonymized."
      >
        <div className="space-y-2">
          <button
            onClick={() => handleReport('Free')}
            disabled={reporting}
            className="w-full p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100/60 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <div>
                <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Seats Free</div>
                <div className="text-[11px] text-[#737373] dark:text-[#A1A1AA]">Multiple free desks observed</div>
              </div>
            </div>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Select</span>
          </button>

          <button
            onClick={() => handleReport('Filling up')}
            disabled={reporting}
            className="w-full p-3 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100/60 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <div>
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">Limited Availability</div>
                <div className="text-[11px] text-[#737373] dark:text-[#A1A1AA]">Few seats remaining</div>
              </div>
            </div>
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Select</span>
          </button>

          <button
            onClick={() => handleReport('Full')}
            disabled={reporting}
            className="w-full p-3 rounded-lg border border-rose-200 dark:border-rose-800/80 bg-rose-50/60 dark:bg-rose-950/40 hover:bg-rose-100/60 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <XCircle className="w-4 h-4 text-rose-600" />
              <div>
                <div className="text-xs font-semibold text-rose-800 dark:text-rose-300">Full</div>
                <div className="text-[11px] text-[#737373] dark:text-[#A1A1AA]">No open seats available</div>
              </div>
            </div>
            <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">Select</span>
          </button>
        </div>
      </Modal>

      {/* Facility Issue Modal */}
      <Modal
        isOpen={showProblemModal}
        onClose={() => setShowProblemModal(false)}
        title="Report Facility Issue"
        description="Notify campus operations of maintenance, noise, or equipment problems."
      >
        <form onSubmit={handleProblemSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-[#171717] dark:text-[#F5F5F5] mb-1">
              Issue Category
            </label>
            <select
              value={problemCategory}
              onChange={e => setProblemCategory(e.target.value)}
              className="w-full p-2 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5]"
            >
              <option value="noise">Noise violation in Quiet Zone</option>
              <option value="broken_facility">Broken power socket or Wi-Fi drop</option>
              <option value="cleanliness">Cleanliness or mess</option>
              <option value="other">General maintenance</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#171717] dark:text-[#F5F5F5] mb-1">
              Description
            </label>
            <textarea
              value={problemNote}
              onChange={e => setProblemNote(e.target.value)}
              placeholder="Provide specific location details (e.g., table 4 on east wall)."
              rows={3}
              className="w-full p-2.5 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5]"
              required
            />
          </div>

          {problemSuccess && (
            <p className="text-xs text-emerald-600 font-semibold">{problemSuccess}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowProblemModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Submit Issue
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
