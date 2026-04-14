// data: none
// cache: no-store (inherited from AdminLayout)
// reason: static access denied screen within admin area
export default function NoPermissionPage() {
  return (
    <div
      className="flex h-screen flex-col items-center justify-center"
      data-testid="no-permission-page"
    >
      <h1 className="text-2xl font-normal">Access denied</h1>
    </div>
  );
}
