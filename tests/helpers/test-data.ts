export function jobReferenceFor({
  tag,
  workerIndex,
}: {
  tag: string;
  workerIndex: number;
}): string {
  return `E2E-${tag}-W${workerIndex}`;
}
