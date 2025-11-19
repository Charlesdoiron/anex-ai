export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fef9f4] dark:bg-[#343541] px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
