// data: none
// cache: default
// reason: static access denied screen for admin routes; must stay outside admin-protected layout
export default function AdminNoPermissionPage() {
  return (
    <div
      className="flex h-screen flex-col items-center justify-center"
      data-testid="no-permission-page"
    >
      <h1 className="text-2xl font-normal">Access denied</h1>
    </div>
  );
}
