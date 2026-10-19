
import AccountSecurityBase from "./AccountSecurityBase";
import ParentPhoneChange from "./ParentPhoneChange";

import {
  ParentPushSettings,
} from "../components/ParentNotificationControls";

export default function AccountSecurity({
  account,
}) {
  const isParent =
    Array.isArray(account?.roles) &&
    account.roles.includes("parent");

  return (
    <>
      {isParent && (
        <ParentPushSettings />
      )}

      {isParent && <ParentPhoneChange account={account} />}
      <AccountSecurityBase account={account} />
    </>
  );
}
