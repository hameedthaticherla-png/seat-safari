import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Space } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { ZoneBadge } from '../components/ZoneBadge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  ArrowLeft, ArrowRight, Zap, Wifi, Layers, Square, 
  Info
} from 'lucide-react';

export const PlanBPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [recommendations, setRecommendations] = useState<Space[]>([]);
  const [currentSpaceName, setCurrentSpaceName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.spaces.getPlanB(id)
      .then(res => {
        setRecommendations(res.plan_b_recommendations);
        setCurrentSpaceName(res.current_space_name);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const facilityIcons: Record<string, any> = {
    power: Zap,
    wifi: Wifi,
    board: Layers,
    desk_chair: Square,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back Link */}
      <div>
        <Link
          to={`/spaces/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to {currentSpaceName || 'Primary Space'}</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5] tracking-tight">
          Alternative Study Spaces (Plan B)
        </h1>
        <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA]">
          Ranked alternative spaces near {currentSpaceName || 'your selected location'} matching your activity and facility requirements.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((space, index) => {
            return (
              <Card
                key={space.id}
                interactive
                className={`p-5 transition-all ${
                  space.isQuietFallbackForGroup
                    ? 'border-orange-300 dark:border-orange-800/80 bg-orange-50/20 dark:bg-orange-950/20'
                    : ''
                }`}
              >
                {/* Top Rank Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#171717] text-white dark:bg-white dark:text-[#171717] font-semibold text-[11px] flex items-center justify-center font-mono">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider">
                      Alternative Option {index + 1}
                    </span>
                  </div>

                  <StatusBadge latestReport={space.latest_report} size="sm" />
                </div>

                {/* Quiet Fallback for Groups Notice */}
                {space.isQuietFallbackForGroup && (
                  <div className="mb-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-xs flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#EA580C] dark:text-[#F97316] shrink-0 mt-0.5" />
                    <div className="text-orange-900 dark:text-orange-200">
                      <strong>Quiet Fallback for Groups:</strong> Recommended for silent parallel study or independent exam prep if discussion rooms are crowded.
                    </div>
                  </div>
                )}

                {/* Space Details */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <ZoneBadge zone={space.zone_type} size="sm" />
                      {space.hold_enabled && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                          Hold Eligible
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-base text-[#171717] dark:text-[#F5F5F5]">
                      {space.name}
                    </h3>
                    <p className="text-xs text-[#737373] dark:text-[#A1A1AA] mt-0.5">
                      {space.location} • Hours: {space.hours}
                    </p>
                  </div>

                  <Link to={`/spaces/${space.id}`} className="shrink-0">
                    <Button variant="primary" size="sm" className="gap-1.5 w-full sm:w-auto" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                      View Space
                    </Button>
                  </Link>
                </div>

                {/* Recommendation Rationale */}
                {space.rationale && (
                  <p className="text-xs text-[#171717] dark:text-[#F5F5F5] bg-[#F8F8F8] dark:bg-[#202127] p-2.5 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] mb-3">
                    {space.rationale}
                  </p>
                )}

                {/* Facilities Checklist */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#E5E5E5] dark:border-[#33343B]">
                  {space.facilities.map(fac => {
                    const Icon = facilityIcons[fac] || Square;
                    return (
                      <span
                        key={fac}
                        className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#F4F4F5] dark:bg-[#292A30] text-[#171717] dark:text-[#F5F5F5] border border-[#E5E5E5] dark:border-[#33343B] flex items-center gap-1"
                      >
                        <Icon className="w-3 h-3 text-[#737373] dark:text-[#A1A1AA]" />
                        <span>{fac.replace('_', ' ')}</span>
                      </span>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
