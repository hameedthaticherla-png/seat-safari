import React, { useState, useEffect } from 'react';
import type { Space } from '../../types';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer, VolumeX, Users, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SignGenerator: React.FC = () => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.staff.getSpaces()
      .then(res => {
        setSpaces(res.spaces);
        if (res.spaces.length > 0) {
          setSelectedSpaceId(res.spaces[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);

  const handlePrint = () => {
    window.print();
  };

  const currentOrigin = window.location.origin;
  const qrTargetUrl = selectedSpace ? `${currentOrigin}/spaces/${selectedSpace.id}` : currentOrigin;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header Controls (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/staff"
              className="text-xs font-medium text-[#737373] hover:text-[#171717] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5] flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5] tracking-tight">
            Printable Zone Signage
          </h1>
          <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
            Generate standardized physical signage with QR codes for door frames and stanchions
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handlePrint}
          className="gap-2 self-start sm:self-auto"
          icon={<Printer className="w-4 h-4" />}
        >
          <span>Print Zone Sign</span>
        </Button>
      </div>

      {/* Selector Control (Hidden during print) */}
      <Card className="p-4 no-print space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#737373] dark:text-[#A1A1AA]">
          Select Study Space to Print:
        </label>
        <select
          value={selectedSpaceId}
          onChange={e => setSelectedSpaceId(e.target.value)}
          className="w-full text-xs sm:text-sm p-2 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5] font-medium"
        >
          {spaces.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.zone_type} Zone • {s.location})
            </option>
          ))}
        </select>
      </Card>

      {/* PRINTABLE ZONE SIGN POSTER */}
      {selectedSpace && (
        <div
          id="printable-sign"
          className="bg-white text-slate-900 p-8 sm:p-10 rounded-2xl border-2 border-slate-900 shadow-md flex flex-col items-center text-center my-4 max-w-md mx-auto"
        >
          {/* Institution Header */}
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-600 mb-6 border-b border-slate-200 pb-3 w-full justify-center font-mono">
            <span className="w-2 h-2 rounded-full bg-orange-600 inline-block" />
            <span>Seat Safari • Campus Space Network</span>
          </div>

          {/* Space Name */}
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight leading-tight mb-1">
            {selectedSpace.name}
          </h2>

          <p className="text-xs font-medium text-slate-500 mb-6">
            {selectedSpace.location}
          </p>

          {/* Zone Badge Hero */}
          <div className="w-full py-3.5 px-4 rounded-xl mb-5 font-semibold text-base flex items-center justify-center gap-2 bg-slate-900 text-white">
            {selectedSpace.zone_type === 'Quiet' && <VolumeX className="w-5 h-5 text-orange-400" />}
            {selectedSpace.zone_type === 'Discussion' && <Users className="w-5 h-5 text-blue-400" />}
            {selectedSpace.zone_type === 'Flexible' && <Layers className="w-5 h-5 text-emerald-400" />}
            <span className="tracking-wide uppercase font-mono">{selectedSpace.zone_type} Zone</span>
          </div>

          {/* Etiquette Rule */}
          <div className="bg-slate-50 p-4 rounded-xl w-full mb-6 border border-slate-200 text-left">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Zone Etiquette Rule
            </span>
            <p className="font-medium text-xs sm:text-sm text-slate-900 leading-normal">
              "{selectedSpace.zone_rule}"
            </p>
          </div>

          {/* Scannable QR Code */}
          <div className="p-4 bg-white rounded-xl border border-slate-300 shadow-xs mb-3">
            <QRCodeSVG
              value={qrTargetUrl}
              size={150}
              level="H"
              includeMargin={true}
            />
          </div>

          <p className="text-xs font-semibold text-slate-900 tracking-tight mb-0.5">
            Scan to Check or Report Availability
          </p>
          <p className="text-[11px] text-slate-500 max-w-xs leading-normal">
            Help fellow campus members by sharing whether seats are available before they walk.
          </p>

          {/* Footer Info */}
          <div className="mt-8 pt-3 border-t border-slate-200 w-full text-[10px] text-slate-400 font-mono flex items-center justify-between">
            <span>Hours: {selectedSpace.hours}</span>
            <span>Ref: {selectedSpace.id}</span>
          </div>
        </div>
      )}
    </div>
  );
};
