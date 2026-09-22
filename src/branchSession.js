export function requestBranchSwitch(branchId) {
  if (!branchId) return;
  window.dispatchEvent(new CustomEvent("lepos-request-branch-switch", { detail: { branchId } }));
}
