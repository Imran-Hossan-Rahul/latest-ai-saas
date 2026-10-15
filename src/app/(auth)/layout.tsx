// Layout for all auth pages (/login, /register).
// Renders the animated gradient background and centers the auth card.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      {children}
    </div>
  );
}
