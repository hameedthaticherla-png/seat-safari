import React, { useState, useEffect } from 'react';
import type { Space } from '../types';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ZoneBadge } from '../components/ZoneBadge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Bookmark, Trash2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FavouritesPage: React.FC = () => {
  const { role } = useAuth();
  const [favourites, setFavourites] = useState<Space[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchFavourites = async () => {
    if (role === 'guest') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.favourites.list();
      setFavourites(res.favourites);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavourites();
  }, [role]);

  const handleRemove = async (spaceId: string) => {
    try {
      await api.favourites.remove(spaceId);
      setFavourites(prev => prev.filter(s => s.id !== spaceId));
    } catch (err) {
      console.error(err);
    }
  };

  if (role === 'guest') {
    return (
      <EmptyState
        icon={Bookmark}
        title="Student Authentication Required"
        description="Sign in with your student account to bookmark study spaces and access them quickly across campus."
        action={
          <Link to="/login">
            <Button variant="primary" size="md">
              Sign In with Student Account
            </Button>
          </Link>
        }
        className="max-w-md mx-auto my-12"
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5] tracking-tight">
          Saved Study Spaces
        </h1>
        <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A1A1AA] mt-0.5">
          Your bookmarked spaces for rapid availability checks
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <Card key={i} className="p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : favourites.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No Saved Spaces Yet"
          description="Bookmark your preferred study areas by selecting the bookmark icon on any space card."
          action={
            <Link to="/">
              <Button variant="outline" size="sm">
                Explore Study Spaces
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {favourites.map(space => (
            <Card
              key={space.id}
              className="p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <ZoneBadge zone={space.zone_type} size="sm" />
                  <button
                    onClick={() => handleRemove(space.id)}
                    className="p-1 rounded text-[#737373] hover:text-rose-600 transition-colors cursor-pointer"
                    aria-label="Remove from saved spaces"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {space.name}
                </h3>
                <p className="text-xs text-[#737373] dark:text-[#A1A1AA] mt-0.5">
                  {space.location} • {space.hours}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E5E5E5] dark:border-[#33343B] flex items-center justify-between">
                <Link to={`/spaces/${space.id}`}>
                  <Button variant="primary" size="sm" className="gap-1.5" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                    <span>View Space</span>
                  </Button>
                </Link>

                <Link
                  to={`/spaces/${space.id}/plan-b`}
                  className="text-xs font-medium text-[#EA580C] dark:text-[#F97316] hover:underline"
                >
                  Alternative Spaces →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
