export type SidecarRestartDecisionInput = {
  shuttingDown: boolean
  restartAttempts: number
  maxRestarts: number
}

export function shouldRestartSidecar(input: SidecarRestartDecisionInput): boolean {
  if (input.shuttingDown) {
    return false
  }
  return input.restartAttempts < input.maxRestarts
}
