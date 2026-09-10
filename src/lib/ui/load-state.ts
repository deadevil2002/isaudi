export type LoadViewState = "loading" | "error" | "empty" | "data";

export function getLoadViewState({
  loading,
  hasError,
  itemCount,
}: {
  loading: boolean;
  hasError: boolean;
  itemCount: number;
}): LoadViewState {
  if (loading) return "loading";
  if (hasError) return "error";
  if (itemCount === 0) return "empty";
  return "data";
}