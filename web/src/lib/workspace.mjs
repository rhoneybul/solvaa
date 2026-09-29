// Device uploads never enter the account payload.
export const cloudPayload = (state) => ({
  profile: state.profile,
  plans: state.plans,
});
export function reconcileWorkspace(local, remote) {
  const revision = remote.revision || 0;
  const matches =
    remote.payload &&
    JSON.stringify(cloudPayload(local)) === JSON.stringify(remote.payload);
  if (local.cloudPending && !matches && revision !== (local.cloudRevision || 0))
    return { state: local, revision, conflict: true };
  if (local.cloudPending && !matches)
    return { state: local, revision, pending: true };
  return {
    state: {
      ...local,
      ...(remote.payload || {}),
      cloudPending: false,
      cloudRevision: revision,
    },
    revision,
  };
}
