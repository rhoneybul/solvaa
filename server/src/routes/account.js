const express = require("express");
const { supabase } = require("../lib/supabase");
const router = express.Router();
router.use((_req,res,next)=>supabase ? next() : res.status(503).json({error:"Account storage is not configured yet. Your changes remain on this device."}));

function validateWorkspace(body) {
  if (
    !body ||
    !body.profile ||
    !Array.isArray(body.plans) ||
    body.plans.length > 100
  )
    throw Object.assign(
      new Error("A profile and up to 100 saved trips are required."),
      { status: 400 },
    );
  if (Buffer.byteLength(JSON.stringify(body)) > 500000)
    throw Object.assign(
      new Error(
        "This workspace is too large to sync. Remove older saved trips and try again.",
      ),
      { status: 413 },
    );
  const p = body.profile;
  if (
    !["beginner", "intermediate", "advanced", "expert"].includes(p.level) ||
    typeof p.name !== "string" ||
    p.name.length > 100 ||
    typeof p.home !== "string" ||
    p.home.length > 200
  )
    throw Object.assign(new Error("The profile details are invalid."), {
      status: 400,
    });
  if (
    !Array.isArray(p.skills) ||
    p.skills.length > 20 ||
    p.skills.some((skill) => typeof skill !== "string" || skill.length > 100) ||
    !Number.isFinite(p.dailyDistanceKm) ||
    p.dailyDistanceKm < 1 ||
    p.dailyDistanceKm > 80 ||
    !Number.isFinite(p.paceKmh) ||
    p.paceKmh < 2.5 ||
    p.paceKmh > 5 ||
    (p.homeCoords &&
      (!Number.isFinite(p.homeCoords.lat) ||
        Math.abs(p.homeCoords.lat) > 90 ||
        !Number.isFinite(p.homeCoords.lon) ||
        Math.abs(p.homeCoords.lon) > 180))
  )
    throw Object.assign(
      new Error("The profile location, skills or pace are invalid."),
      { status: 400 },
    );
  if (
    body.plans.some(
      (plan) =>
        !plan ||
        typeof plan.id !== "string" ||
        (plan.kind !== "plotted" && (!Array.isArray(plan.routes) || !plan.routes.length)) ||
        !Array.isArray(plan.days) ||
        (plan.kind !== "plotted" && !plan.request) ||
        typeof plan.title !== "string",
    )
  )
    throw Object.assign(new Error("A saved trip is invalid."), { status: 400 });
  return { profile: p, plans: body.plans };
}
router.get("/workspace", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("web_workspaces")
      .select("payload,revision,updated_at")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (error) throw error;
    res.json(data || { payload: null, revision: 0 });
  } catch (error) {
    next(error);
  }
});
router.put("/workspace", async (req, res, next) => {
  try {
    const payload = validateWorkspace(req.body.payload);
    const { validateDraft } = await import("../../../web/src/lib/plotting.mjs");
    for (const plan of payload.plans) {
      if (plan.kind === "plotted") {
        try { validateDraft(plan, { complete: true }); }
        catch (error) { error.status = 400; throw error; }
      }
    }
    const revision = Number(req.body.revision);
    if (!Number.isInteger(revision) || revision < 0)
      return res
        .status(400)
        .json({ error: "A workspace revision is required." });
    const row = {
      user_id: req.user.id,
      payload,
      revision: revision + 1,
      updated_at: new Date().toISOString(),
    };
    const query =
      revision === 0
        ? supabase.from("web_workspaces").insert(row)
        : supabase
            .from("web_workspaces")
            .update(row)
            .eq("user_id", req.user.id)
            .eq("revision", revision);
    const { data, error } = await query.select("revision").maybeSingle();
    if (error?.code === "23505" || (!error && !data))
      return res
        .status(409)
        .json({
          error:
            "Your profile changed on another device. Reload before saving again.",
        });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});
module.exports = { router, validateWorkspace };
