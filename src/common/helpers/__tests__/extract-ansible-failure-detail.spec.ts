import { describe, expect, it } from '@jest/globals';
import { extractAnsibleFailureDetail } from '../ansible-output.helper';

describe('extractAnsibleFailureDetail', () => {
  it('returns the stderr of the failed task', () => {
    const stdout = `fatal: [host]: FAILED! => {
    "msg": "non-zero return code",
    "rc": 1,
    "stderr": "Error from server (NotFound): namespaces \\"x\\" not found",
    "stdout": ""
}`;

    expect(extractAnsibleFailureDetail(stdout)).toBe(
      'Error from server (NotFound): namespaces "x" not found',
    );
  });

  it('falls back to "msg" when the stderr is empty', () => {
    const stdout = '"msg": "non-zero return code", "stderr": ""';

    expect(extractAnsibleFailureDetail(stdout)).toBe('non-zero return code');
  });

  it('falls back to "msg" when there is no stderr field', () => {
    const stdout = '"msg": "Failed to connect to the host via ssh"';

    expect(extractAnsibleFailureDetail(stdout)).toBe(
      'Failed to connect to the host via ssh',
    );
  });

  it('prefers stderr over msg even if msg comes first', () => {
    const stdout = '"msg": "generic", "stderr": "specific"';

    expect(extractAnsibleFailureDetail(stdout)).toBe('specific');
  });

  it('returns null when neither field is present', () => {
    expect(extractAnsibleFailureDetail('PLAY RECAP failed=1')).toBeNull();
  });

  it('returns null for an empty output', () => {
    expect(extractAnsibleFailureDetail('')).toBeNull();
  });
});
