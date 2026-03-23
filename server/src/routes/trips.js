const express = require('express');
const router  = express.Router();
const { supabase } = require('../lib/supabase');

// GET /api/trips — all trips for the authenticated user
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/trips/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Trip not found' });
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/trips — create a new trip plan
router.post('/', async (req, res, next) => {
  try {
    const {
      trip_type,        // 'day_paddle' | 'multi_day' | 'weekend' | 'week'
      skill_level,      // 'beginner' | 'intermediate' | 'advanced' | 'expert'
      location_name,    // 'Axminster' etc
      location_lat,
      location_lon,
      planned_date,     // ISO date string
      duration_days,
      route_data,       // full JSON from routeService / AI planner
      weather_snapshot, // conditions at time of planning
      notes,
    } = req.body;

    const { data, error } = await supabase
      .from('trips')
      .insert({
        user_id: req.user.id,
        trip_type,
        skill_level,
        location_name,
        location_lat,
        location_lon,
        planned_date,
        duration_days,
        route_data,
        weather_snapshot,
        notes,
        status: 'planned',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// PATCH /api/trips/:id — update status or notes
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['status', 'notes', 'route_data', 'weather_snapshot'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    const { data, error } = await supabase
      .from('trips')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/trips/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
