/**
 * Returns the options with a previously saved value appended when it is not
 * already present, so records keep legacy values selectable after the source
 * list no longer includes them.
 */
export function withSavedOption({
  options,
  saved,
}: {
  options: string[];
  saved: string | null | undefined;
}): string[] {
  if (!saved || options.includes(saved)) return options;
  return [...options, saved];
}
