export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactNode {
  return (
    <div className='bg-background text-foreground flex min-h-screen items-center justify-center'>
      {children}
    </div>
  );
}
