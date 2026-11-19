import React, { useState, useEffect } from 'react';
import type { Space, ZoneType } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ZoneBadge } from '../components/ZoneBadge';
import { InteractiveMap } from '../components/InteractiveMap';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { 
  Zap, Wifi, Layers, Square, Search, 
  Map, LayoutGrid, AlertTriangle, ArrowRight, Bookmark, 
  Clock, RotateCcw, Building2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const FindPage: React.FC = () => {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activity, setActivity] = useState<ZoneType | 'Either'>('Either');
  const [needs, setNeeds] = useState<string[]>([]);
  const [time, setTime] = useState<string>('now');

  // Fetch spaces with current filters
  const fetchSpaces = async () => {
    try {
      setLoading(true);
      const res = await api.spaces.find({
        activity,
        needs,
        time,
      });
      setSpaces(res.spaces);
    } catch (err) {
      console.error('Failed to load study spaces', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, [activity, needs, time]);

  // Toggle need helper
  const toggleNeed = (needKey: string) => {
    setNeeds(prev =>
      prev.includes(needKey) ? prev.filter(n => n !== needKey) : [...prev, needKey]
    );
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setActivity('Either');
    setNeeds([]);
    setTime('now');
  };

  // Preset Scenario: "Quiet + AC Power @ 1 PM"
  const applyQuietPeakScenario = () => {
    setActivity('Quiet');
    setNeeds(['power', 'wifi', 'desk_chair']);
    setTime('13:00');
  };

  // Preset Scenario: "Discussion + Whiteboard"
  const applyGroupBoardScenario = () => {
    setActivity('Discussion');
    setNeeds(['power', 'wifi', 'board']);
    setTime('14:00');
  };

  // Toggle bookmark / favourite
  const handleToggleFavourite = async (space: Space, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (user.role === 'guest') {
      alert('Please sign in as a student to save favourite spaces.');
      return;
    }
    try {
      if (space.is_favourite) {
        await api.favourites.remove(space.id);
      } else {
        await api.favourites.add(space.id);
      }
      setSpaces(prev =>
        prev.map(s => (s.id === space.id ? { ...s, is_favourite: !s.is_favourite } : s))
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Filter spaces client-side by text search query
  const filteredSpaces = spaces.filter(space => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      space.name.toLowerCase().includes(q) ||
      space.location.toLowerCase().includes(q) ||
      space.zone_type.toLowerCase().includes(q)
    );
  });

  const facilityIcons: Record<string, { label: string; icon: any }> = {
    power: { label: 'AC Power', icon: Zap },
    wifi: { label: 'Wi-Fi', icon: Wifi },
    board: { label: 'Whiteboard', icon: Layers },
    desk_chair: { label: 'Desk & Chair', icon: Square },
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5] tracking-tight">
            Study Space Discovery
          </h1>
          <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
            Verified space facts & 30-minute community reports across campus
          </p>
        </div>

        {/* View Switcher: List vs Map */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] p-0.5 shadow-xs">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#F4F4F5] dark:bg-[#292A30] text-[#171717] dark:text-[#F5F5F5] font-semibold shadow-xs'
                  : 'text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid View</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-[#F4F4F5] dark:bg-[#292A30] text-[#171717] dark:text-[#F5F5F5] font-semibold shadow-xs'
                  : 'text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5]'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Campus Radar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <Card className="p-4 sm:p-5 space-y-4">
        {/* Top Filter Row: Search & Activity Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#737373] dark:text-[#A1A1AA] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by building, space name, or zone..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-xs sm:text-sm text-[#171717] dark:text-[#F5F5F5] placeholder:text-[#737373] dark:placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
            />
          </div>

          {/* Activity Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
            <span className="text-xs font-medium text-[#737373] dark:text-[#A1A1AA] mr-1 hidden sm:inline">
              Zone:
            </span>
            {[
              { id: 'Either', label: 'All Zones' },
              { id: 'Quiet', label: 'Quiet Solo' },
              { id: 'Discussion', label: 'Discussion' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActivity(item.id as any)}
                className={`h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activity === item.id
                    ? 'bg-[#EA580C] dark:bg-[#F97316] text-white font-semibold shadow-xs'
                    : 'bg-[#F4F4F5] hover:bg-[#E5E5E5] text-[#171717] dark:bg-[#292A30] dark:hover:bg-[#33343B] dark:text-[#F5F5F5]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Facilities & Time Selectors */}
        <div className="pt-3 border-t border-[#E5E5E5] dark:border-[#33343B] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Facilities Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-[#737373] dark:text-[#A1A1AA] mr-1">
              Required:
            </span>
            {[
              { id: 'power', label: 'AC Power', icon: Zap },
              { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
              { id: 'board', label: 'Whiteboard', icon: Layers },
              { id: 'desk_chair', label: 'Desk & Chair', icon: Square },
            ].map(item => {
              const Icon = item.icon;
              const isSelected = needs.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleNeed(item.id)}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 font-semibold shadow-xs'
                      : 'border-[#E5E5E5] bg-white text-[#737373] hover:bg-[#F8F8F8] dark:border-[#33343B] dark:bg-[#202127] dark:text-[#A1A1AA] dark:hover:bg-[#292A30]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Time Filter & Quick Scenarios */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-[#737373] dark:text-[#A1A1AA] font-medium">
              <Clock className="w-3.5 h-3.5 text-[#737373] dark:text-[#A1A1AA]" />
              <span>Visit:</span>
              <select
                value={time}
                onChange={e => setTime(e.target.value)}
                className="h-7 text-xs px-2 rounded-md border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5] font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="now">Current Time</option>
                <option value="11:00">11:00 AM</option>
                <option value="13:00">1:00 PM (Peak)</option>
                <option value="15:00">3:00 PM</option>
                <option value="18:00">6:00 PM</option>
              </select>
            </div>

            {/* Fast Evaluation Scenario Buttons */}
            <button
              onClick={applyQuietPeakScenario}
              className="h-7 px-2 text-[11px] font-medium text-[#737373] dark:text-[#A1A1AA] hover:text-[#EA580C] dark:hover:text-[#F97316] border border-dashed border-[#E5E5E5] dark:border-[#33343B] rounded-md hover:border-orange-500 transition-colors cursor-pointer"
              title="Filter for quiet seat with power at 1 PM"
            >
              Quiet + Power (1 PM)
            </button>

            <button
              onClick={applyGroupBoardScenario}
              className="h-7 px-2 text-[11px] font-medium text-[#737373] dark:text-[#A1A1AA] hover:text-[#EA580C] dark:hover:text-[#F97316] border border-dashed border-[#E5E5E5] dark:border-[#33343B] rounded-md hover:border-orange-500 transition-colors cursor-pointer"
              title="Filter for group room with whiteboard"
            >
              Group + Board
            </button>

            {(activity !== 'Either' || needs.length > 0 || time !== 'now' || searchQuery) && (
              <button
                onClick={resetFilters}
                className="h-7 px-2 text-[11px] font-medium text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] flex items-center gap-1 cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Campus Radar View (if toggled) */}
      {viewMode === 'map' && (
        <InteractiveMap spaces={filteredSpaces} />
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#A1A1AA] px-1">
        <span className="font-medium">
          Showing {filteredSpaces.length} of {spaces.length} study spaces
        </span>
        <span className="font-mono text-[11px] hidden sm:inline">
          Ranked by activity, facilities & peak busy rhythm
        </span>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-[#E5E5E5] dark:bg-[#33343B] rounded w-1/3" />
              <div className="h-6 bg-[#E5E5E5] dark:bg-[#33343B] rounded w-3/4" />
              <div className="h-4 bg-[#E5E5E5] dark:bg-[#33343B] rounded w-1/2" />
              <div className="h-10 bg-[#F4F4F5] dark:bg-[#292A30] rounded" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredSpaces.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No study spaces match your criteria"
          description="Try broadening your zone preference or clearing required facility filters."
          action={
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset Filters
            </Button>
          }
        />
      )}

      {/* Spaces Grid */}
      {!loading && filteredSpaces.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSpaces.map(space => {
            return (
              <Card
                key={space.id}
                interactive
                className="flex flex-col justify-between p-4 sm:p-5"
              >
                <div>
                  {/* Top Meta Row */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <ZoneBadge zone={space.zone_type} size="sm" />

                      {space.hold_enabled && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                          Hold Eligible
                        </span>
                      )}

                      {space.only_if_no_class && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                          Class Condition
                        </span>
                      )}
                    </div>

                    {/* Bookmark Button */}
                    <button
                      onClick={(e) => handleToggleFavourite(space, e)}
                      className="p-1 rounded text-[#737373] hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      aria-label="Bookmark space"
                    >
                      <Bookmark
                        className={`w-4 h-4 ${
                          space.is_favourite ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Title & Location */}
                  <h3 className="font-semibold text-base text-[#171717] dark:text-[#F5F5F5] tracking-tight leading-snug">
                    {space.name}
                  </h3>
                  <p className="text-xs text-[#737373] dark:text-[#A1A1AA] mt-0.5">
                    {space.location} • {space.hours}
                  </p>

                  {/* Zone Etiquette Rule Callout */}
                  <div className="mt-3 p-2.5 rounded-lg bg-[#F8F8F8] dark:bg-[#292A30]/50 border border-[#E5E5E5] dark:border-[#33343B] text-xs">
                    <span className="text-[10px] uppercase font-semibold text-[#737373] dark:text-[#A1A1AA] tracking-wider block mb-0.5">
                      Zone Rule
                    </span>
                    <p className="text-[#171717] dark:text-[#F5F5F5] font-normal leading-relaxed">
                      {space.zone_rule}
                    </p>
                  </div>

                  {/* Facilities Grid */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    {space.facilities.map(fac => {
                      const meta = facilityIcons[fac] || { label: fac, icon: Square };
                      const Icon = meta.icon;
                      return (
                        <span
                          key={fac}
                          className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F4F4F5] dark:bg-[#292A30] text-[#171717] dark:text-[#F5F5F5] flex items-center gap-1 border border-[#E5E5E5] dark:border-[#33343B]"
                        >
                          <Icon className="w-3 h-3 text-[#737373] dark:text-[#A1A1AA]" />
                          <span>{meta.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Status & Actions */}
                <div className="mt-4 pt-3 border-t border-[#E5E5E5] dark:border-[#33343B] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge
                      latestReport={space.latest_report}
                      busyNote={space.busy_at_time?.note}
                      size="sm"
                    />

                    {/* Amber Staleness Warning */}
                    {space.staleness?.is_stale && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="w-3 h-3" />
                        Verified {space.staleness.days_ago}d ago
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <Link to={`/book?spaceId=${space.id}`} className="w-full">
                      <Button variant="primary" size="sm" className="w-full text-xs font-semibold px-1">
                        Book Seat
                      </Button>
                    </Link>

                    <Link to={`/spaces/${space.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full text-xs px-1">
                        Details
                      </Button>
                    </Link>

                    <Link to={`/spaces/${space.id}/plan-b`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full text-xs px-1">
                        Plan B
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
