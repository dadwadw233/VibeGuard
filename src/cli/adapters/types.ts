import type { RuntimePaths } from "../runtime.js";
import type { HostTarget, InstallState, TargetInstallState } from "../install-state.js";

export interface DoctorCheck {
  label: string;
  ok: boolean;
  details: string;
}

export interface InstallSummary {
  target: HostTarget;
  ok: boolean;
  headline: string;
  details: string[];
  state?: TargetInstallState;
}

export interface UninstallSummary {
  target: HostTarget;
  ok: boolean;
  headline: string;
  details: string[];
}

export interface DoctorSummary {
  target: HostTarget;
  ok: boolean;
  checks: DoctorCheck[];
}

export interface HostAdapter {
  readonly target: HostTarget;
  install(runtime: RuntimePaths, state: InstallState): InstallSummary;
  uninstall(runtime: RuntimePaths, state: InstallState): UninstallSummary;
  doctor(runtime: RuntimePaths, state: InstallState): DoctorSummary;
  launch(runtime: RuntimePaths, state: InstallState, args: string[]): Promise<number>;
}
