import EmptyState from '../../components/ui/EmptyState';
import useAuth from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { logout } = useAuth();

  return (
    <EmptyState
      className="bg-bg-main"
      message="Your profile arrives in a later sprint."
      actionLabel="Log Out"
      onAction={logout}
    />
  );
}
