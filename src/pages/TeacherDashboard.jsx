
import HomeroomTeacherDashboard from "./HomeroomTeacherDashboard";
import PrincipalDashboard from "./PrincipalDashboard";

export default function TeacherDashboard(props) {
  const roles = Array.isArray(props.account?.roles)
    ? props.account.roles
    : [];

  if (roles.includes("principal")) {
    return <PrincipalDashboard {...props} />;
  }

  return <HomeroomTeacherDashboard {...props} />;
}
