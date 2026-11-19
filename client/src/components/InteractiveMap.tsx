import React, { useState } from 'react';
import type { Space } from '../types';
import { StatusBadge } from './StatusBadge';
import { ZoneBadge } from './ZoneBadge';
import { ArrowRight, X, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';

interface InteractiveMapProps {
  spaces: Space[];
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ spaces }) => {
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  // Coordinates for campus architectural zones
  const spacePositions: Record<string, { x: number; y: number; label: string }> = {
    spc_lib_upper: { x: 90, y: 70, label: 'Library L3' },
    spc_lib_group: { x: 125, y: 105, label: 'Library L1' },
    spc_dept_study: { x: 250, y: 65, label: 'Engineering L2' },
    spc_dept_proj_214: { x: 280, y: 100, label: 'Project Rm 214' },
    spc_union_common: { x: 80, y: 210, label: 'Student Union' },
    spc_cafeteria_annex: { x: 190, y: 215, label: 'Campus Dining' },
    spc_sci_classroom_204: { x: 285, y: 205, label: 'Science 204' },
    spc_north_nook: { x: 180, y: 40, label: 'North Annex' },
  };

  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);

  const getStatusColor = (space: Space) => {
    if (!space.latest_report) return '#737373'; // neutral grey
    if (space.latest_report.status === 'Free') return '#16A34A'; // emerald/green
    if (space.latest_report.status === 'Filling up') return '#D97706'; // amber
    return '#E11D48'; // rose/red
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#111318] shadow-xs">
      {/* Map Control Bar */}
      <div className="px-4 py-3 bg-white dark:bg-[#202127] border-b border-[#E5E5E5] dark:border-[#33343B] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
          <span className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
            Campus Architectural Zone Radar
          </span>
        </div>
        <span className="text-[11px] text-[#737373] dark:text-[#A1A1AA] font-mono">
          Select building or pin to inspect
        </span>
      </div>

      {/* SVG Campus Floor/Zone Map */}
      <div className="relative w-full aspect-[16/9] max-h-[380px] flex items-center justify-center p-3">
        <svg viewBox="0 0 360 280" className="w-full h-full select-none">
          {/* Subtle architectural background grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-[#E5E5E5] dark:text-[#33343B]" />
            </pattern>
          </defs>
          <rect width="360" height="280" fill="url(#grid)" />

          {/* Campus pedestrian spine */}
          <path
            d="M50 85 Q160 85 290 85"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className="text-[#E5E5E5] dark:text-[#33343B]"
          />
          <path
            d="M180 35 L180 250"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className="text-[#E5E5E5] dark:text-[#33343B]"
          />
          <path
            d="M80 85 L80 220"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-[#E5E5E5] dark:text-[#33343B]"
          />
          <path
            d="M270 85 L270 220"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-[#E5E5E5] dark:text-[#33343B]"
          />

          {/* Central Forum Square */}
          <rect
            x="155"
            y="115"
            width="50"
            height="50"
            rx="4"
            className="fill-[#F4F4F5] dark:fill-[#202127] stroke-[#E5E5E5] dark:stroke-[#33343B]"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text
            x="180"
            y="143"
            textAnchor="middle"
            fontSize="8"
            fontWeight="600"
            className="fill-[#737373] dark:fill-[#A1A1AA] font-mono"
          >
            MAIN QUAD
          </text>

          {/* Building Footprints */}
          {/* Main Library */}
          <rect
            x="50"
            y="45"
            width="90"
            height="85"
            rx="6"
            className="fill-white dark:fill-[#202127] stroke-[#E5E5E5] dark:stroke-[#33343B]"
            strokeWidth="1.5"
          />
          <text x="95" y="60" textAnchor="middle" fontSize="8" fontWeight="600" className="fill-[#171717] dark:fill-[#F5F5F5] font-sans">
            MAIN LIBRARY
          </text>

          {/* Engineering Hall */}
          <rect
            x="220"
            y="45"
            width="95"
            height="85"
            rx="6"
            className="fill-white dark:fill-[#202127] stroke-[#E5E5E5] dark:stroke-[#33343B]"
            strokeWidth="1.5"
          />
          <text x="267" y="60" textAnchor="middle" fontSize="8" fontWeight="600" className="fill-[#171717] dark:fill-[#F5F5F5] font-sans">
            ENGINEERING
          </text>

          {/* Student Union */}
          <rect
            x="45"
            y="175"
            width="80"
            height="70"
            rx="6"
            className="fill-white dark:fill-[#202127] stroke-[#E5E5E5] dark:stroke-[#33343B]"
            strokeWidth="1.5"
          />
          <text x="85" y="193" textAnchor="middle" fontSize="8" fontWeight="600" className="fill-[#171717] dark:fill-[#F5F5F5] font-sans">
            STUDENT UNION
          </text>

          {/* Campus Hub / Dining */}
          <rect
            x="145"
            y="180"
            width="85"
            height="65"
            rx="6"
            className="fill-white dark:fill-[#202127] stroke-[#E5E5E5] dark:stroke-[#33343B]"
            strokeWidth="1.5"
          />
          <text x="187" y="196" textAnchor="middle" fontSize="8" fontWeight="600" className="fill-[#171717] dark:fill-[#F5F5F5] font-sans">
            CAMPUS HUB
          </text>

          {/* Science Hall */}
          <rect
            x="245"
            y="175"
            width="80"
            height="70"
            rx="6"
            className="fill-white dark:fill-[#202127] stroke-[#E5E5E5] dark:stroke-[#33343B]"
            strokeWidth="1.5"
          />
          <text x="285" y="193" textAnchor="middle" fontSize="8" fontWeight="600" className="fill-[#171717] dark:fill-[#F5F5F5] font-sans">
            SCIENCE HALL
          </text>

          {/* Interactive Space Pins */}
          {spaces.map(space => {
            const pos = spacePositions[space.id] || { x: 180, y: 140, label: space.name };
            const isSelected = selectedSpaceId === space.id;
            const pinColor = getStatusColor(space);

            return (
              <g
                key={space.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => setSelectedSpaceId(space.id)}
                className="cursor-pointer transition-transform hover:scale-110"
                style={{ transformBox: 'fill-box' }}
              >
                {/* Subtle pulse ring if selected */}
                {isSelected && (
                  <circle cx="0" cy="0" r="14" fill="#F97316" fillOpacity="0.3" className="animate-ping" />
                )}

                {/* Base circle marker */}
                <circle
                  cx="0"
                  cy="0"
                  r={isSelected ? '9' : '7'}
                  fill={pinColor}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  className="shadow-sm"
                />

                {/* Center dot */}
                <circle cx="0" cy="0" r="2.5" fill="#FFFFFF" />

                {/* Space label pill */}
                <rect
                  x="-28"
                  y="10"
                  width="56"
                  height="14"
                  rx="3"
                  className="fill-[#171717]/90 dark:fill-[#292A30]/90"
                />
                <text
                  x="0"
                  y="20"
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="500"
                  fill="#FFFFFF"
                  className="font-mono"
                >
                  {pos.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Space Bottom Card Drawer */}
      {selectedSpace && (
        <div className="p-3.5 bg-white dark:bg-[#202127] border-t border-[#E5E5E5] dark:border-[#33343B] animate-in fade-in slide-in-from-bottom duration-150">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <ZoneBadge zone={selectedSpace.zone_type} size="sm" />
                <StatusBadge latestReport={selectedSpace.latest_report} size="sm" />
              </div>
              <h4 className="font-semibold text-sm text-[#171717] dark:text-[#F5F5F5] truncate">
                {selectedSpace.name}
              </h4>
              <p className="text-xs text-[#737373] dark:text-[#A1A1AA] mt-0.5 truncate">
                {selectedSpace.location}
              </p>
            </div>
            <button
              onClick={() => setSelectedSpaceId(null)}
              className="p-1 rounded-md text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] cursor-pointer"
              aria-label="Close space preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <Link to={`/spaces/${selectedSpace.id}/plan-b`}>
              <Button variant="outline" size="sm">
                Alternative Spaces
              </Button>
            </Link>

            <Link to={`/spaces/${selectedSpace.id}`}>
              <Button variant="primary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                View Space Details
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
