import { describe, expect, it } from '@jest/globals';
import { AnsiblePlaybookExecutionError } from '../ansible.exception';

describe('AnsiblePlaybookExecutionError', () => {
  it('is an Error with its own name', () => {
    const error = new AnsiblePlaybookExecutionError('boom', 2, 'out', 'err');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AnsiblePlaybookExecutionError');
    expect(error.message).toBe('boom');
  });

  it('exposes code, stdout and stderr', () => {
    const error = new AnsiblePlaybookExecutionError('boom', 'ENOENT', 'o', 'e');

    expect(error.code).toBe('ENOENT');
    expect(error.stdout).toBe('o');
    expect(error.stderr).toBe('e');
  });

  it('accepts a null or undefined code', () => {
    expect(
      new AnsiblePlaybookExecutionError('m', null, '', '').code,
    ).toBeNull();
    expect(
      new AnsiblePlaybookExecutionError('m', undefined, '', '').code,
    ).toBeUndefined();
  });
});
