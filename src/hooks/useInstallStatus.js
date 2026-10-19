import { useSyncExternalStore } from "react";
import { getInstallSnapshot, subscribeInstall } from "../lib/pwaInstall";
export default function useInstallStatus() {
  return useSyncExternalStore(subscribeInstall, getInstallSnapshot);
}
