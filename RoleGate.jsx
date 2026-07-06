import { useAuth } from '../../lib/auth.jsx';

/** <RoleGate roles={['ceo','ops_manager']}>...</RoleGate> */
export default function RoleGate({ roles, children, fallback = null }) {
  const { role } = useAuth();
  if (!role || !roles.includes(role)) return fallback;
  return children;
}
