/** Bounded GitHub pagination; capped data is explicitly partial, never silently complete. */
export const paginate = async (
  {
    request,
    path,
    select = (value) => value,
    stop,
    limit = 10,
    onLimit = () => {},
  },
  page = 1,
  result = [],
) => {
  const data = select(
    await request(
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    ),
  )
  if (!Array.isArray(data)) {
    throw new Error("Unexpected GitHub collection response")
  }
  const next = [...result, ...data]
  if (data.length < 100 || stop?.(data)) {
    return next
  }
  if (page >= limit) {
    onLimit(path)
    return next
  }
  return paginate(
    { request, path, select, stop, limit, onLimit },
    page + 1,
    next,
  )
}
