import { describe, expect, it } from 'vitest'
import { findProjectPathFromArgv, shouldShowSidecarLogToUi } from './open-path'

describe('findProjectPathFromArgv', () => {
  it('returns the first .dwproj and ignores flags', () => {
    expect(
      findProjectPathFromArgv([
        'C:\\Program Files\\DataWorkbench\\DataWorkbench.exe',
        '--allow-file-access-from-files',
        'D:\\lab\\run.dwproj'
      ])
    ).toBe('D:\\lab\\run.dwproj')
  })

  it('strips wrapping quotes from Windows argv', () => {
    expect(findProjectPathFromArgv(['"E:\\a.dwproj"'])).toBe('E:\\a.dwproj')
  })

  it('ignores unrelated files', () => {
    expect(findProjectPathFromArgv(['C:\\notes.txt', '--dev'])).toBeNull()
  })
})

describe('shouldShowSidecarLogToUi', () => {
  it('hides the spawn banner and keeps protocol plus errors', () => {
    expect(shouldShowSidecarLogToUi('stderr', 'Starting sidecar: python.exe -m dw_host')).toBe(false)
    expect(shouldShowSidecarLogToUi('protocol', 'oops')).toBe(true)
    expect(shouldShowSidecarLogToUi('stderr', 'Traceback (most recent call last):')).toBe(true)
    expect(shouldShowSidecarLogToUi('stderr', 'pandas 2.2.2')).toBe(false)
  })
})
