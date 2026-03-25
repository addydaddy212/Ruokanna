export async function safeReadJsonResponse(
  response,
  fallbackError = 'The server returned an invalid response.',
) {
  try {
    const text = await response.text()

    if (!text || text.trim() === '') {
      throw new Error('Empty response')
    }

    return JSON.parse(text)
  } catch (err) {
    console.error('Parse error:', err)
    throw new Error(fallbackError)
  }
}
