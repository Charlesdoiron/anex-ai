interface EnvVar {
  name: string
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  {
    name: "OPENAI_API_KEY",
  },
  {
    name: "DATABASE_URL",
  },
  {
    name: "BETTER_AUTH_SECRET",
  },
  {
    name: "BETTER_AUTH_URL",
  },
]

export function validateEnv(): void {
  const missing: string[] = []
  const errors: string[] = []

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name]

    if (!value || value.trim() === "") {
      missing.push(envVar.name)
      errors.push(`  - ${envVar.name}`)
    }
  }

  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables:\n${errors.join("\n")}\n\nPlease set these variables in your .env.local file.`
    throw new Error(errorMessage)
  }
}

export function getEnvStatus(): {
  valid: boolean
  missing: string[]
  errors: string[]
} {
  const missing: string[] = []
  const errors: string[] = []

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name]

    if (!value || value.trim() === "") {
      missing.push(envVar.name)
      errors.push(`  - ${envVar.name}`)
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    errors,
  }
}
