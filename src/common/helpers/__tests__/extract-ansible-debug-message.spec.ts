import { describe, expect, it } from '@jest/globals';
import { extractAnsibleDebugMessage } from '../ansible-output.helper';

const PLAY_OUTPUT = `
PLAY [all] *********************************************************************

TASK [Emit deployment names] ***************************************************
ok: [pcbox.example.com] => {
    "msg": "api web worker"
}

PLAY RECAP *********************************************************************
pcbox.example.com          : ok=2    changed=1    unreachable=0    failed=0
`;

describe('extractAnsibleDebugMessage', () => {
  it('extracts the "msg" of the debug task from the playbook output', () => {
    expect(extractAnsibleDebugMessage(PLAY_OUTPUT)).toBe('api web worker');
  });

  it('returns null when the output has no "msg" field', () => {
    expect(extractAnsibleDebugMessage('PLAY RECAP ok=1')).toBeNull();
  });

  it('returns null for an empty output', () => {
    expect(extractAnsibleDebugMessage('')).toBeNull();
  });

  it('decodes JSON escapes such as newlines and quotes', () => {
    const stdout = '    "msg": "db1\\ndb2\\n\\"quoted\\""';

    expect(extractAnsibleDebugMessage(stdout)).toBe('db1\ndb2\n"quoted"');
  });

  it('decodes unicode escapes', () => {
    expect(extractAnsibleDebugMessage('"msg": "caf\\u00e9"')).toBe('caf\u00e9');
  });

  it('returns an empty string for an empty message', () => {
    expect(extractAnsibleDebugMessage('"msg": ""')).toBe('');
  });

  it('accepts no whitespace between the colon and the value', () => {
    expect(extractAnsibleDebugMessage('"msg":"compact"')).toBe('compact');
  });

  it('returns the first "msg" when the output has several', () => {
    const stdout = '"msg": "first"\n"msg": "second"';

    expect(extractAnsibleDebugMessage(stdout)).toBe('first');
  });

  it('returns null when the value is not a string', () => {
    expect(extractAnsibleDebugMessage('"msg": ["a", "b"]')).toBeNull();
  });

  it('returns null when the escape sequence is not valid JSON', () => {
    expect(extractAnsibleDebugMessage('"msg": "bad \\q escape"')).toBeNull();
  });

  it('does not match a key that merely ends with msg', () => {
    expect(extractAnsibleDebugMessage('"error_msg": "x"')).toBeNull();
  });
});
