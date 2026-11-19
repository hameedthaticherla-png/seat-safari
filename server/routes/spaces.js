const express = require('express');
const { query, get, getSetting } = require('../db');
const { authenticateOptional } = require('../middleware/auth');

const router = express.Router();

// Helper to determine if a report is unexpired
function getLatestReport(spaceId) {
  const expiryMinutes = Number(getSetting('report_expiry_minutes', 30));

  // Only unhidden reports.
  // CRITICAL: We do NOT select user_id or student identity to preserve privacy!
  const report = get(
    `SELECT id, status, created_at, flagged, flag_count 
     FROM reports 
     WHERE space_id = ? AND hidden = 0
     ORDER BY created_at DESC LIMIT 1`,
    [spaceId]
  );

  if (!report) return null;

  const ageMinutes = Math.floor((Date.now() - new Date(report.created_at).getTime()) / (60 * 1000));
  if (ageMinutes >= expiryMinutes) return null; // Expired!

  return {
    id: report.id,
    status: report.status,
    created_at: report.created_at,
    age_minutes: Math.max(0, ageMinutes),
    age_text: ageMinutes === 0 ? 'just now' : `${ageMinutes}m ago`,
    flagged: Boolean(report.flagged)
  };
}

// Helper to check staleness (> 7 days)
function checkStaleness(lastCheckedIso) {
  const thresholdDays = Number(getSetting('staleness_threshold_days', 7));
  const lastCheckedDate = new Date(lastCheckedIso);
  const diffDays = (Date.now() - lastCheckedDate.getTime()) / (1000 * 60 * 60 * 24);
  return {
    is_stale: diffDays > thresholdDays,
    days_ago: Math.floor(diffDays),
    last_checked_date: lastCheckedDate.toISOString().split('T')[0]
  };
}

// 1. GET /api/spaces - Find & Rank spaces
router.get('/', authenticateOptional, (req, res) => {
  const { activity = 'Either', needs = '', time = 'now', day_type = 'teaching_days' } = req.query;
  const requestedNeeds = needs ? needs.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];

  // Parse time of interest
  let checkHour = new Date().getHours();
  let checkMinute = new Date().getMinutes();
  if (time && time !== 'now') {
    const parts = time.split(':');
    if (parts.length >= 2) {
      checkHour = parseInt(parts[0], 10);
      checkMinute = parseInt(parts[1], 10);
    }
  }
  const timeNumber = checkHour * 60 + checkMinute;

  // Retrieve all spaces
  const spaces = query('SELECT * FROM spaces');
  const allBusy = query('SELECT * FROM usual_busy');

  // Compute scores and enrich
  const scoredSpaces = spaces.map(space => {
    let score = 0;
    const facilities = JSON.parse(space.facilities || '[]');
    const latestReport = getLatestReport(space.id);
    const staleness = checkStaleness(space.last_checked_at);
    
    // Space usual busy records
    const busyRecords = allBusy.filter(b => b.space_id === space.id);
    let busyStatusAtTime = 'unknown';
    let busyNote = '';

    for (const b of busyRecords) {
      if (b.day_type === day_type || b.day_type === 'all') {
        const [sH, sM] = b.start_time.split(':').map(Number);
        const [eH, eM] = b.end_time.split(':').map(Number);
        const startNum = sH * 60 + sM;
        const endNum = eH * 60 + eM;
        if (timeNumber >= startNum && timeNumber <= endNum) {
          busyStatusAtTime = b.busy_level;
          busyNote = b.notes || '';
          break;
        }
      }
    }

    // --- 1. Activity Match ---
    if (activity === 'Either') {
      score += 40;
    } else if (space.zone_type === activity) {
      score += 50; // Exact match
    } else if (space.zone_type === 'Flexible') {
      score += 30; // Flexible can adapt
    } else {
      score += 0; // Mismatch
    }

    // --- 2. Facility Match ---
    let matchedFacilitiesCount = 0;
    let missingRequired = false;
    for (const reqNeed of requestedNeeds) {
      if (facilities.includes(reqNeed)) {
        score += 20;
        matchedFacilitiesCount++;
      } else {
        score -= 25; // Penalty for missing a requested essential need
        missingRequired = true;
      }
    }

    // --- 3. Fresh Report Impact ---
    if (latestReport) {
      if (latestReport.status === 'Free') {
        score += 45;
      } else if (latestReport.status === 'Filling up') {
        score += 15;
      } else if (latestReport.status === 'Full') {
        score -= 50;
      }
    }

    // --- 4. Usual Busy Impact (especially when no recent report) ---
    if (!latestReport) {
      if (busyStatusAtTime === 'busy') {
        score -= 20;
      } else if (busyStatusAtTime === 'quiet') {
        score += 15;
      }
    }

    // --- 5. Staleness penalty ---
    if (staleness.is_stale) {
      score -= 10;
    }

    // Check if user has favourited this space
    let is_favourite = false;
    if (req.user && req.user.id) {
      const fav = get('SELECT user_id FROM favourites WHERE user_id = ? AND space_id = ?', [req.user.id, space.id]);
      is_favourite = Boolean(fav);
    }

    // Check active hold on room
    let active_hold = null;
    if (space.hold_enabled) {
      active_hold = get(
        "SELECT id, start_time, end_time, status FROM holds WHERE room_id = ? AND status IN ('active', 'checked_in') ORDER BY start_time ASC LIMIT 1",
        [space.id]
      );
    }

    return {
      id: space.id,
      name: space.name,
      location: space.location,
      zone_type: space.zone_type,
      zone_rule: space.zone_rule,
      facilities,
      hours: space.hours,
      only_if_no_class: Boolean(space.only_if_no_class),
      hold_enabled: Boolean(space.hold_enabled),
      last_checked_at: space.last_checked_at,
      capacity_hint: space.capacity_hint,
      map_zone: space.map_zone,
      description: space.description,
      owner_scope: space.owner_scope,
      latest_report: latestReport,
      staleness,
      busy_at_time: {
        status: busyStatusAtTime,
        note: busyNote
      },
      matched_all_needs: !missingRequired,
      is_favourite,
      active_hold,
      rank_score: score
    };
  });

  // Sort by rank_score descending
  scoredSpaces.sort((a, b) => b.rank_score - a.rank_score);

  return res.json({
    spaces: scoredSpaces,
    query: { activity, needs: requestedNeeds, time, day_type }
  });
});

// 2. GET /api/spaces/:id - Space detail
router.get('/:id', authenticateOptional, (req, res) => {
  const space = get('SELECT * FROM spaces WHERE id = ?', [req.params.id]);
  if (!space) {
    return res.status(404).json({ error: 'Space not found' });
  }

  const facilities = JSON.parse(space.facilities || '[]');
  const latestReport = getLatestReport(space.id);
  const staleness = checkStaleness(space.last_checked_at);
  const usualBusy = query('SELECT * FROM usual_busy WHERE space_id = ?', [space.id]);

  let is_favourite = false;
  if (req.user && req.user.id) {
    const fav = get('SELECT user_id FROM favourites WHERE user_id = ? AND space_id = ?', [req.user.id, space.id]);
    is_favourite = Boolean(fav);
  }

  let active_hold = null;
  if (space.hold_enabled) {
    active_hold = get(
      "SELECT id, user_id, start_time, end_time, checked_in_at, status FROM holds WHERE room_id = ? AND status IN ('active', 'checked_in') ORDER BY start_time ASC LIMIT 1",
      [space.id]
    );
    // Sanitize user_id if not holding student
    if (active_hold && (!req.user || req.user.id !== active_hold.user_id)) {
      active_hold = {
        id: active_hold.id,
        start_time: active_hold.start_time,
        end_time: active_hold.end_time,
        status: active_hold.status,
        is_my_hold: false
      };
    } else if (active_hold && req.user && req.user.id === active_hold.user_id) {
      active_hold.is_my_hold = true;
    }
  }

  return res.json({
    space: {
      ...space,
      facilities,
      only_if_no_class: Boolean(space.only_if_no_class),
      hold_enabled: Boolean(space.hold_enabled),
      latest_report: latestReport,
      staleness,
      usual_busy: usualBusy,
      is_favourite,
      active_hold
    }
  });
});

// 3. GET /api/spaces/:id/plan-b - Plan B Trail recommendations
router.get('/:id/plan-b', authenticateOptional, (req, res) => {
  const currentSpace = get('SELECT * FROM spaces WHERE id = ?', [req.params.id]);
  if (!currentSpace) {
    return res.status(404).json({ error: 'Space not found' });
  }

  const currentFacilities = JSON.parse(currentSpace.facilities || '[]');
  const allSpaces = query('SELECT * FROM spaces WHERE id != ?', [req.params.id]);

  // Rank candidate Plan B spaces
  const candidates = allSpaces.map(candidate => {
    const candFacilities = JSON.parse(candidate.facilities || '[]');
    const latestReport = getLatestReport(candidate.id);
    const staleness = checkStaleness(candidate.last_checked_at);
    let suitabilityScore = 0;
    let rationale = '';
    let isQuietFallbackForGroup = false;

    // Plan B Case 1: Current is Discussion/Group
    if (currentSpace.zone_type === 'Discussion') {
      if (candidate.zone_type === 'Discussion') {
        suitabilityScore += 40;
        rationale = 'Alternative collaborative discussion space with group tables.';
      } else if (candidate.zone_type === 'Flexible') {
        suitabilityScore += 30;
        rationale = 'Flexible zone suitable for low-voice group discussions and shared tasks.';
      } else if (candidate.zone_type === 'Quiet') {
        // Specifically requested: "including a quiet fallback for groups"
        suitabilityScore += 25;
        isQuietFallbackForGroup = true;
        rationale = 'Quiet fallback for groups: Ideal for silent side-by-side study or parallel exam prep if discussion rooms are crowded.';
      }
    } 
    // Plan B Case 2: Current is Quiet
    else if (currentSpace.zone_type === 'Quiet') {
      if (candidate.zone_type === 'Quiet') {
        suitabilityScore += 45;
        rationale = 'Dedicated silent/quiet study area matching your focus needs.';
      } else if (candidate.zone_type === 'Flexible') {
        suitabilityScore += 25;
        rationale = 'Flexible space offering solo seating in quieter corners.';
      } else {
        suitabilityScore += 5;
        rationale = 'Active area; recommend noise-cancelling headphones.';
      }
    } 
    // Plan B Case 3: Current is Flexible
    else {
      if (candidate.zone_type === 'Flexible') {
        suitabilityScore += 35;
        rationale = 'Comparable flexible multi-use space.';
      } else if (candidate.zone_type === 'Quiet') {
        suitabilityScore += 30;
        rationale = 'Quieter alternative if you need to concentrate.';
      } else {
        suitabilityScore += 25;
        rationale = 'Discussion space if you prefer social study.';
      }
    }

    // Facility overlap
    let sharedFacilities = 0;
    for (const f of currentFacilities) {
      if (candFacilities.includes(f)) sharedFacilities++;
    }
    suitabilityScore += sharedFacilities * 10;

    // Report status boost/penalty
    if (latestReport) {
      if (latestReport.status === 'Free') suitabilityScore += 30;
      if (latestReport.status === 'Filling up') suitabilityScore += 10;
      if (latestReport.status === 'Full') suitabilityScore -= 40;
    }

    return {
      ...candidate,
      facilities: candFacilities,
      only_if_no_class: Boolean(candidate.only_if_no_class),
      hold_enabled: Boolean(candidate.hold_enabled),
      latest_report: latestReport,
      staleness,
      suitabilityScore,
      rationale,
      isQuietFallbackForGroup
    };
  });

  // Sort candidates by score
  candidates.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

  // If current space is discussion, ensure at least one quiet fallback is present in top 3!
  let topRecommendations = [];
  if (currentSpace.zone_type === 'Discussion') {
    const discussionOrFlex = candidates.filter(c => !c.isQuietFallbackForGroup);
    const quietFallback = candidates.find(c => c.isQuietFallbackForGroup);
    
    // Pick top 2 discussion/flex and 1 quiet fallback
    topRecommendations = discussionOrFlex.slice(0, 2);
    if (quietFallback) {
      topRecommendations.push(quietFallback);
    } else if (discussionOrFlex[2]) {
      topRecommendations.push(discussionOrFlex[2]);
    }
  } else {
    topRecommendations = candidates.slice(0, 3);
  }

  return res.json({
    current_space_name: currentSpace.name,
    current_zone_type: currentSpace.zone_type,
    plan_b_recommendations: topRecommendations
  });
});

// Alias for room hold on space
router.post('/:id/hold', (req, res, next) => {
  req.url = `/${req.params.id}`;
  const holdsRouter = require('./holds');
  return holdsRouter(req, res, next);
});

module.exports = router;
