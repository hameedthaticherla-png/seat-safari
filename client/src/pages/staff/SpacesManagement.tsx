import React, { useState, useEffect } from 'react';
import type { Space, ZoneType } from '../../types';
import { api } from '../../api/client';
import { ZoneBadge } from '../../components/ZoneBadge';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { 
  ArrowLeft, Plus, Check, Edit2, AlertTriangle, 
  CheckSquare, Square, Save
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const SpacesManagement: React.FC = () => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Edit / Create Modal State
  const [editingSpace, setEditingSpace] = useState<Partial<Space> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      const res = await api.staff.getSpaces();
      setSpaces(res.spaces);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  // One-tap confirm
  const handleConfirmSingle = async (id: string) => {
    try {
      const res = await api.staff.confirmAccurate(id);
      setFeedback(res.message);
      await fetchSpaces();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Toggle selection for bulk confirm
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === spaces.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(spaces.map(s => s.id));
    }
  };

  // Bulk confirm
  const handleBulkConfirm = async () => {
    if (selectedIds.length === 0) return;
    try {
      setBulkLoading(true);
      const res = await api.staff.bulkConfirm(selectedIds);
      setFeedback(res.message);
      setSelectedIds([]);
      await fetchSpaces();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // Open Edit Modal
  const openEdit = (space: Space) => {
    setEditingSpace({
      ...space,
      facilities: [...space.facilities],
    });
    setIsNew(false);
  };

  // Open Create Modal
  const openCreate = () => {
    setEditingSpace({
      name: '',
      location: '',
      zone_type: 'Quiet',
      zone_rule: 'Quiet: No talking nearby. Whispers only if essential.',
      facilities: ['power', 'wifi', 'desk_chair'],
      hours: '08:00 - 22:00',
      only_if_no_class: false,
      hold_enabled: false,
      owner_scope: 'library',
      description: '',
      capacity_hint: '',
    });
    setIsNew(true);
  };

  // Save Modal
  const handleSaveSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpace) return;

    try {
      setSaveLoading(true);
      if (isNew) {
        await api.staff.createSpace(editingSpace);
        setFeedback(`Created study space: ${editingSpace.name}`);
      } else {
        await api.staff.updateSpace(editingSpace.id!, editingSpace);
        setFeedback(`Updated space details: ${editingSpace.name}`);
      }
      setEditingSpace(null);
      await fetchSpaces();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const toggleFacility = (facKey: string) => {
    if (!editingSpace) return;
    const current = editingSpace.facilities || [];
    const updated = current.includes(facKey)
      ? current.filter(f => f !== facKey)
      : [...current, facKey];
    setEditingSpace({ ...editingSpace, facilities: updated });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
            Study Space Inventory
          </h1>
          <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
            Configure zone types, verified static facts, etiquette rules & operating hours
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={openCreate}
          className="gap-1.5 self-start sm:self-auto"
          icon={<Plus className="w-4 h-4" />}
        >
          <span>Add Study Space</span>
        </Button>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-[#737373] hover:text-[#171717] cursor-pointer">✕</button>
        </div>
      )}

      {/* Bulk Action Bar */}
      <Card className="p-3.5 flex items-center justify-between gap-3">
        <button
          onClick={selectAll}
          className="flex items-center gap-2 text-xs font-medium text-[#171717] dark:text-[#F5F5F5] cursor-pointer"
        >
          {selectedIds.length === spaces.length ? (
            <CheckSquare className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
          ) : (
            <Square className="w-4 h-4 text-[#737373] dark:text-[#A1A1AA]" />
          )}
          <span>Select All ({selectedIds.length} of {spaces.length} selected)</span>
        </button>

        <Button
          variant="primary"
          size="sm"
          disabled={selectedIds.length === 0 || bulkLoading}
          onClick={handleBulkConfirm}
          className="gap-1.5"
          icon={<Check className="w-3.5 h-3.5" />}
        >
          <span>{bulkLoading ? 'Updating...' : `Confirm Selected Accuracy (${selectedIds.length})`}</span>
        </Button>
      </Card>

      {/* Desktop Space Data Table (Visible on md+) */}
      <Card className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] dark:border-[#33343B] bg-[#F8F8F8] dark:bg-[#111318]/50 text-[#737373] dark:text-[#A1A1AA] font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-10">Select</th>
                <th className="py-3 px-4">Space Name</th>
                <th className="py-3 px-4">Zone & Conditions</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4">Last Verified</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5] dark:divide-[#33343B]">
              {spaces.map(space => {
                const isSelected = selectedIds.includes(space.id);
                return (
                  <tr key={space.id} className="hover:bg-[#F8F8F8] dark:hover:bg-[#292A30] transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleSelect(space.id)}
                        className="text-[#737373] hover:text-[#171717] dark:hover:text-[#F5F5F5] cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#737373] dark:text-[#A1A1AA]" />
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#171717] dark:text-[#F5F5F5]">
                        {space.name}
                      </div>
                      <div className="text-[11px] text-[#737373] dark:text-[#A1A1AA]">
                        {space.location} • {space.hours}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ZoneBadge zone={space.zone_type} size="sm" />
                        {space.hold_enabled && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                            Hold
                          </span>
                        )}
                        {space.only_if_no_class && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                            Class Condition
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-[#737373] dark:text-[#A1A1AA] capitalize">
                      {space.owner_scope}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[#171717] dark:text-[#F5F5F5]">
                          {space.last_checked_at.split('T')[0]}
                        </span>
                        {space.is_stale && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            (Stale)
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleConfirmSingle(space.id)}
                          className="h-7 text-xs text-[#EA580C] dark:text-[#F97316] hover:bg-orange-50 dark:hover:bg-orange-950/40"
                          title="Confirm Still Accurate"
                          icon={<Check className="w-3.5 h-3.5" />}
                        >
                          <span>Confirm</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!space.can_edit}
                          onClick={() => openEdit(space)}
                          className="h-7 text-xs"
                          title={!space.can_edit ? 'Only editable by assigned department scope' : 'Edit space'}
                          icon={<Edit2 className="w-3 h-3" />}
                        >
                          <span>Edit</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Space Cards (Visible on <md) */}
      <div className="space-y-3 md:hidden">
        {spaces.map(space => {
          const isSelected = selectedIds.includes(space.id);
          return (
            <Card key={space.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => toggleSelect(space.id)}
                    className="p-1 text-[#737373] hover:text-[#171717] cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#737373] dark:text-[#A1A1AA]" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <ZoneBadge zone={space.zone_type} size="sm" />
                      {space.hold_enabled && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                          Hold
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm text-[#171717] dark:text-[#F5F5F5]">
                      {space.name}
                    </h3>
                    <p className="text-xs text-[#737373] dark:text-[#A1A1AA]">
                      {space.location} • Scope: {space.owner_scope}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-[#737373] dark:text-[#A1A1AA]">
                  {space.last_checked_at.split('T')[0]}
                </span>
              </div>

              {space.is_stale && (
                <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Stale facts (&gt;7 days). Verification required.</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E5] dark:border-[#33343B]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleConfirmSingle(space.id)}
                  className="h-8 text-xs text-[#EA580C] dark:text-[#F97316]"
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  <span>Confirm Accurate</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!space.can_edit}
                  onClick={() => openEdit(space)}
                  className="h-8 text-xs"
                  icon={<Edit2 className="w-3 h-3" />}
                >
                  <span>Edit Facts</span>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Edit / Create Modal Dialog */}
      <Modal
        isOpen={Boolean(editingSpace)}
        onClose={() => setEditingSpace(null)}
        title={isNew ? 'Create Study Space' : `Edit ${editingSpace?.name}`}
        description="Configure space facts, rules, operating hours, and booking permissions."
        maxWidth="lg"
      >
        {editingSpace && (
          <form onSubmit={handleSaveSpace} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[#171717] dark:text-[#F5F5F5] mb-1">
                Space Name
              </label>
              <input
                type="text"
                value={editingSpace.name || ''}
                onChange={e => setEditingSpace({ ...editingSpace, name: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5]"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-[#171717] dark:text-[#F5F5F5] mb-1">
                Campus Location
              </label>
              <input
                type="text"
                value={editingSpace.location || ''}
                onChange={e => setEditingSpace({ ...editingSpace, location: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#171717] dark:text-[#F5F5F5] mb-1">
                  Zone Classification
                </label>
                <select
                  value={editingSpace.zone_type || 'Quiet'}
                  onChange={e => setEditingSpace({ ...editingSpace, zone_type: e.target.value as ZoneType })}
                  className="w-full p-2 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5] font-medium"
                >
                  <option value="Quiet">Quiet (Solo focus)</option>
                  <option value="Discussion">Discussion (Group talk)</option>
                  <option value="Flexible">Flexible (Adaptable)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#171717] dark:text-[#F5F5F5] mb-1">
                  Operating Hours
                </label>
                <input
                  type="text"
                  value={editingSpace.hours || '08:00 - 22:00'}
                  onChange={e => setEditingSpace({ ...editingSpace, hours: e.target.value })}
                  className="w-full p-2 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-[#171717] dark:text-[#F5F5F5] mb-1">
                Zone Etiquette Rule (Displayed to Students)
              </label>
              <input
                type="text"
                value={editingSpace.zone_rule || ''}
                onChange={e => setEditingSpace({ ...editingSpace, zone_rule: e.target.value })}
                placeholder="Quiet: No talking nearby. Whispers only if essential."
                className="w-full p-2.5 rounded-lg border border-[#E5E5E5] dark:border-[#33343B] bg-white dark:bg-[#202127] text-[#171717] dark:text-[#F5F5F5]"
                required
              />
            </div>

            {/* Facilities Checklist */}
            <div>
              <label className="block font-medium text-[#171717] dark:text-[#F5F5F5] mb-1.5">
                Verified Facilities
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'power', label: 'AC Power Outlets' },
                  { id: 'wifi', label: 'Campus Wi-Fi' },
                  { id: 'board', label: 'Whiteboard' },
                  { id: 'desk_chair', label: 'Desk & Chair' },
                ].map(f => {
                  const checked = (editingSpace.facilities || []).includes(f.id);
                  return (
                    <label key={f.id} className="flex items-center gap-2 cursor-pointer text-[#171717] dark:text-[#F5F5F5]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFacility(f.id)}
                        className="rounded text-orange-600 focus:ring-orange-500"
                      />
                      <span>{f.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Checkbox conditions */}
            <div className="pt-2 border-t border-[#E5E5E5] dark:border-[#33343B] space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#171717] dark:text-[#F5F5F5]">
                <input
                  type="checkbox"
                  checked={Boolean(editingSpace.hold_enabled)}
                  onChange={e => setEditingSpace({ ...editingSpace, hold_enabled: e.target.checked })}
                  className="rounded text-purple-600"
                />
                <span>Opt-in for student group room holds (max 2 hours)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-[#171717] dark:text-[#F5F5F5]">
                <input
                  type="checkbox"
                  checked={Boolean(editingSpace.only_if_no_class)}
                  onChange={e => setEditingSpace({ ...editingSpace, only_if_no_class: e.target.checked })}
                  className="rounded text-sky-600"
                />
                <span>Condition: Usable only when no class is in session</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E5E5] dark:border-[#33343B]">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setEditingSpace(null)}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={saveLoading}
                icon={<Save className="w-3.5 h-3.5" />}
              >
                <span>Save Space Facts</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
