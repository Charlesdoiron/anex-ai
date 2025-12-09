"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "@/app/lib/auth-client"
import { LoadingButton } from "@/app/components/ui/loading-button"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || "Invalid email or password")
      } else {
        router.push("/")
        router.refresh()
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#40414f] p-8 rounded-2xl shadow-lg dark:shadow-xl border border-gray-300 dark:border-gray-700">
      <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100 text-center">
        Axena
      </h1>
      <h2 className="text-xl font-semibold mb-6 text-gray-700 dark:text-gray-300 text-center">
        Sign In
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 dark:bg-[#343541] dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 dark:bg-[#343541] dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            placeholder="••••••••"
          />
        </div>

        <LoadingButton
          type="submit"
          isLoading={isLoading}
          loadingText="Connexion..."
          className="w-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 disabled:cursor-not-allowed dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Se connecter
        </LoadingButton>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
        Don&#39;t have an account?{" "}
        <Link
          href="/signup"
          className="text-gray-800 dark:text-gray-200 hover:underline font-medium"
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}
