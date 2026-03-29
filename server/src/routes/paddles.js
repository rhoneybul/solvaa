const express = require('express');
const router  = express.Router();
const { supabase } = require('../lib/supabase');

// GET /api/paddles — paddle history for user
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('paddles')
      .select('*, trips(location_name, trip_type, route_data)')
      .eq('user_id', req.user.id)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/paddles/stats — aggregate stats for the user
router.get('/stats', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('paddles')
      .select('distance_km, duration_seconds, started_at')
      .eq('user_id', req.user.id);

    if (error) throw error;

    const totalKm      = data.reduce((s, p) => s + (p.distance_km || 0), 0);
    const totalSeconds = data.reduce((s, p) => s + (p.duration_seconds || 0), 0);
    const count        = data.length;

    res.json({
      count,
      total_km:      +totalKm.toFixed(2),
      total_hours:   +(totalSeconds / 3600).toFixed(1),
      avg_km:        count ? +(totalKm / count).toFixed(2) : 0,
    });
  } catch (err) { next(err); }
});

// POST /api/paddles — save a completed paddle
router.post('/', async (req, res, next) => {
  try {
    const {
      trip_id,           // optional — links to a planned trip
      started_at,
      finished_at,
      distance_km,
      duration_seconds,
      avg_speed_knots,
      max_speed_knots,
      gps_track,         // array of {lat, lon, ts} — stored as JSONB
      weather_log,       // array of condition snapshots taken during paddle
      notes,
    } = req.body;

    const { data, error } = await supabase
      .from('paddles')
      .insert({
        user_id: req.user.id,
        trip_id,
        started_at,
        finished_at,
        distance_km,
        duration_seconds,
        avg_speed_knots,
        max_speed_knots,
        gps_track,
        weather_log,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    // If linked to a trip, mark it as completed
    if (trip_id) {
      await supabase
        .from('trips')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', trip_id)
        .eq('user_id', req.user.id);
    }

    res.status(201).json(data);
  } catch (err) { next(err); }
});

// GET /api/paddles/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('paddles')
      .select('*, trips(location_name, route_data)')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Paddle not found' });
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/paddles/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('paddles')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
