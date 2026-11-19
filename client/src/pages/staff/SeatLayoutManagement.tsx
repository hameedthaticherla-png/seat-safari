import React, { useState, useEffect } from 'react';
import {
  Layers,
  Building2,
  MapPin,
  Ban,
  CheckCircle2,
  Plus,
  Edit2,
  ShieldAlert,
  Save,
  AlertCircle,
  RefreshCw,
  Zap,
  Sun,
  Monitor,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Building, Space, Seat, SpaceTable } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SeatMap } from '../../components/seating/SeatMap';

export const SeatLayoutManagement: React.FC = () => {
  const { role } = useAuth();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [tables, setTables] = useState<SpaceTable[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [frontLabel, setFrontLabel] = useState<string>('FRONT / PRESENTATION WALL');

  // Selected Seat Inspection & Block Modal
  const [inspectSeat, setInspectSeat] = useState<Seat | null>(null);
  const [blockReason, setBlockReason] = useState<string>('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Add Seat Modal
  const [showAddSeatModal, setShowAddSeatModal] = useState(false);
  const [newSeatNumber, setNewSeatNumber] = useState('');
  const [newRowLabel, setNewRowLabel] = useState('A');
  const [newColIndex, setNewColIndex] = useState(1);
  const [newFacilities, setNewFacilities] = useState<string[]>(['power', 'wifi']);
  const [newSeatType, setNewSeatType] = useState('standard_desk');

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Load Hierarchy
  const fetchHierarchy = async () => {
    try {
      setLoading(true);
      const res = await api.reservations.getHierarchy();
      setBuildings(res.buildings || []);

      if (res.buildings && res.buildings.length > 0) {
        const firstBld = res.buildings[0];
        setSelectedBuildingId(firstBld.id);
        if (firstBld.floors && firstBld.floors.length > 0) {
          const firstFlr = firstBld.floors[0];
          setSelectedFloorId(firstFlr.id);
          if (firstFlr.spaces && firstFlr.spaces.length > 0) {
            setSelectedSpaceId(firstFlr.spaces[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load hierarchy', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHierarchy();
  }, []);

  const currentBuilding = buildings.find((b) => b.id === selectedBuildingId);
  const currentFloor = currentBuilding?.floors?.find((f) => f.id === selectedFloorId);
  const currentSpace = currentFloor?.spaces?.find((s) => s.id === selectedSpaceId);

  // Load Space Layout & Real-time Seats
  const fetchLayout = async () => {
    if (!selectedSpaceId) return;
    try {
      setLayoutLoading(true);
      const layoutData = await api.reservations.getLayout(selectedSpaceId);
      setTables(layoutData.tables || []);
      setSeats(layoutData.seats || []);
      setFrontLabel(layoutData.front_label || 'FRONT OF ROOM / PRESENTATION WALL');

      if (inspectSeat) {
        const updated = (layoutData.seats || []).find((s) => s.id === inspectSeat.id);
        if (updated) setInspectSeat(updated);
      }
    } catch (err) {
      console.error('Failed to load space layout', err);
    } finally {
      setLayoutLoading(false);
    }
  };

  useEffect(() => {
    fetchLayout();
  }, [selectedSpaceId]);

  // Handle Maintenance Block Toggle
  const handleToggleBlock = async () => {
    if (!inspectSeat) return;
    try {
      setIsBlocking(true);
      const res = await api.staff.seating.toggleBlock(
        inspectSeat.id,
        inspectSeat.is_blocked ? undefined : blockReason || 'Maintenance'
      );
      setActionMessage(res.message);
      setInspectSeat(res.seat);
      fetchLayout();
    } catch (err: any) {
      alert(err.message || 'Failed to update seat status');
    } finally {
      setIsBlocking(false);
    }
  };

  // Handle Add Seat
  const handleAddSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpaceId || !newSeatNumber) return;

    try {
      await api.staff.seating.addSeat({
        space_id: selectedSpaceId,
        seat_number: newSeatNumber,
        row_label: newRowLabel,
        col_index: Number(newColIndex),
        seat_type: newSeatType,
        facilities: newFacilities,
        grid_x: Number(newColIndex),
        grid_y: 1,
      });

      setActionMessage(`Seat ${newSeatNumber} added successfully.`);
      setShowAddSeatModal(false);
      setNewSeatNumber('');
      fetchLayout();
    } catch (err: any) {
      alert(err.message || 'Failed to create seat');
    }
  };

  if (role !== 'staff') {
    return (
      <div className="p-8 text-center text-zinc-500">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Staff Access Required</h2>
        <p className="text-xs mt-1">You must be logged in as library staff to manage seat layouts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">
            Staff Facility Console
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Seat Layout & Maintenance Management
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            View live space seating, toggle maintenance blocks, and configure seating grids
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLayout}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${layoutLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddSeatModal(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Seat</span>
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs underline font-normal">
            Dismiss
          </button>
        </div>
      )}

      {/* Location Navigation Cards */}
      <div className="bg-white dark:bg-[#202127] border border-[#E5E5E5] dark:border-[#33343B] rounded-2xl p-5 shadow-sm space-y-4">
        {/* Building & Floor Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider block mb-1.5">
              Select Building
            </label>
            <select
              value={selectedBuildingId}
              onChange={(e) => {
                const bldId = e.target.value;
                setSelectedBuildingId(bldId);
                const bld = buildings.find((b) => b.id === bldId);
                if (bld && bld.floors && bld.floors.length > 0) {
                  setSelectedFloorId(bld.floors[0].id);
                  if (bld.floors[0].spaces && bld.floors[0].spaces.length > 0) {
                    setSelectedSpaceId(bld.floors[0].spaces[0].id);
                  }
                }
              }}
              className="w-full py-2 px-3 rounded-xl border border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#292A30] text-xs font-medium text-[#171717] dark:text-[#F5F5F5]"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider block mb-1.5">
              Select Floor
            </label>
            <select
              value={selectedFloorId}
              onChange={(e) => {
                const flrId = e.target.value;
                setSelectedFloorId(flrId);
                const flr = currentBuilding?.floors?.find((f) => f.id === flrId);
                if (flr && flr.spaces && flr.spaces.length > 0) {
                  setSelectedSpaceId(flr.spaces[0].id);
                }
              }}
              className="w-full py-2 px-3 rounded-xl border border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#292A30] text-xs font-medium text-[#171717] dark:text-[#F5F5F5]"
            >
              {(currentBuilding?.floors || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#737373] dark:text-[#A1A1AA] uppercase tracking-wider block mb-1.5">
              Select Space
            </label>
            <select
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#292A30] text-xs font-medium text-[#171717] dark:text-[#F5F5F5]"
            >
              {(currentFloor?.spaces || []).map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} ({sp.zone_type})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Selected Seat Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Seat Map */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Click any seat below to inspect details or toggle maintenance blocks</span>
            <span className="font-semibold">{seats.length} Configured Seats</span>
          </div>

          <SeatMap
            seats={seats}
            tables={tables}
            selectedSeatId={inspectSeat?.id || null}
            onSelectSeat={(seat) => {
              setInspectSeat(seat);
              setBlockReason(seat.block_reason || '');
            }}
            frontLabel={frontLabel}
            isLoading={layoutLoading}
          />
        </div>

        {/* Right Col: Seat Inspector Panel */}
        <div className="space-y-4">
          <Card className="p-5 border border-zinc-200 dark:border-[#33343B] space-y-4">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span>Seat Inspector</span>
              {inspectSeat && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-[#292A30] text-zinc-600 dark:text-zinc-300">
                  ID: {inspectSeat.id}
                </span>
              )}
            </h3>

            {inspectSeat ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#292A30] border border-zinc-200/80 dark:border-[#33343B] space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Seat Number</span>
                    <span className="font-bold text-base text-orange-600 dark:text-orange-400">
                      Seat {inspectSeat.seat_number}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Row & Column</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Row {inspectSeat.row_label}, Col {inspectSeat.col_index}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Type</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 capitalize">
                      {inspectSeat.seat_type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Facilities</span>
                    <div className="flex items-center gap-1">
                      {inspectSeat.facilities.map((fac) => (
                        <span
                          key={fac}
                          className="px-2 py-0.5 rounded bg-white dark:bg-[#202127] border border-zinc-200 dark:border-[#33343B] text-[10px] font-medium"
                        >
                          {fac}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-zinc-200/60 dark:border-[#33343B]">
                    <span className="text-zinc-500">Current Status</span>
                    <span
                      className={`font-bold ${
                        inspectSeat.is_blocked
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {inspectSeat.is_blocked ? 'Under Maintenance (Blocked)' : 'Operational'}
                    </span>
                  </div>
                </div>

                {/* Maintenance Block Controls */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Maintenance Reason / Notes
                  </label>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="e.g. Broken outlet, liquid spill, chair repair"
                    disabled={Boolean(inspectSeat.is_blocked)}
                    className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-[#33343B] bg-zinc-50 dark:bg-[#292A30] text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={handleToggleBlock}
                    disabled={isBlocking}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      inspectSeat.is_blocked
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {inspectSeat.is_blocked ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isBlocking ? 'Updating...' : 'Remove Block (Set Available)'}</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-3.5 h-3.5" />
                        <span>{isBlocking ? 'Updating...' : 'Block for Maintenance'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-400 text-xs">
                Select any seat from the map to view diagnostics, modify attributes, or toggle maintenance status.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add Seat Modal */}
      {showAddSeatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1A1C23] border border-zinc-200 dark:border-[#33343B] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Add New Seat to {currentSpace?.name}
            </h3>

            <form onSubmit={handleAddSeat} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Seat Number / Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A5, T02-3"
                  value={newSeatNumber}
                  onChange={(e) => setNewSeatNumber(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-[#33343B] bg-zinc-50 dark:bg-[#292A30]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Row Label</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={newRowLabel}
                    onChange={(e) => setNewRowLabel(e.target.value.toUpperCase())}
                    className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-[#33343B] bg-zinc-50 dark:bg-[#292A30]"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Column Position</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newColIndex}
                    onChange={(e) => setNewColIndex(Number(e.target.value))}
                    className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-[#33343B] bg-zinc-50 dark:bg-[#292A30]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Seat Type</label>
                <select
                  value={newSeatType}
                  onChange={(e) => setNewSeatType(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-zinc-200 dark:border-[#33343B] bg-zinc-50 dark:bg-[#292A30]"
                >
                  <option value="standard_desk">Standard Study Desk</option>
                  <option value="ergonomic_chair">Ergonomic High-Back</option>
                  <option value="computer_station">Computer Workstation</option>
                  <option value="standing_desk">Standing Desk</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSeatModal(false)}
                  className="flex-1 py-2 rounded-xl border border-zinc-200 dark:border-[#33343B] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-md"
                >
                  Create Seat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
