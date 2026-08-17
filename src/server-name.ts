const leadingCountryFlagPattern = /^\s*[\u{1F1E6}-\u{1F1FF}]{2}\s*/u

/**
 * Keeps the country flag consistent with the authoritative public region
 * fields. A stale leading flag is replaced for display only; the configured
 * server name is not modified.
 */
export function displayServerName(
  name: string | undefined,
  fallback: string,
  generatedEmoji = ''
): string {
  const label = name?.trim() || fallback
  if (!generatedEmoji) return label
  const withoutStaleFlag = label.replace(leadingCountryFlagPattern, '').trim()
  return `${generatedEmoji} ${withoutStaleFlag || fallback}`
}
