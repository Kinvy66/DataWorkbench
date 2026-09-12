/** True only in the packaged / launched QA-lab build. Unit tests leave this off. */
export function qaLabEnabled(): boolean {
  return typeof window !== 'undefined' && window.dw?.qaLab === true
}
