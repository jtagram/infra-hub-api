import { describe, expect, it } from '@jest/globals';
import { AnsiblePlaybookExecutionError } from '../ansible.exception';
import { AnsibleMapper } from '../ansible.mapper';

describe('AnsibleMapper.toSuccessResult', () => {
  it('maps the outputs to a successful result with exit code 0', () => {
    expect(AnsibleMapper.toSuccessResult('out', 'warn')).toEqual({
      success: true,
      stdout: 'out',
      stderr: 'warn',
      exitCode: 0,
    });
  });

  it('has no error fields', () => {
    const result = AnsibleMapper.toSuccessResult('', '');

    expect(result).not.toHaveProperty('errorMessage');
    expect(result).not.toHaveProperty('errorCode');
  });
});

describe('AnsibleMapper.toFailureResult', () => {
  it('maps the error to a failed result with the numeric code as exit code', () => {
    const error = new AnsiblePlaybookExecutionError(
      'Command failed',
      2,
      'out',
      'err',
    );

    expect(AnsibleMapper.toFailureResult(error)).toEqual({
      success: false,
      stdout: 'out',
      stderr: 'err',
      exitCode: 2,
      errorMessage: 'Command failed',
      errorCode: 2,
    });
  });

  it('keeps a string code (e.g. ENOENT or ETIMEDOUT) as exit code', () => {
    const error = new AnsiblePlaybookExecutionError('x', 'ETIMEDOUT', '', '');

    expect(AnsibleMapper.toFailureResult(error)).toMatchObject({
      exitCode: 'ETIMEDOUT',
      errorCode: 'ETIMEDOUT',
    });
  });

  it('uses a null exit code when the error has no code', () => {
    const error = new AnsiblePlaybookExecutionError('x', undefined, '', '');

    const result = AnsibleMapper.toFailureResult(error);

    expect(result.exitCode).toBeNull();
    expect(result.errorCode).toBeUndefined();
  });

  it('keeps a null code as null', () => {
    const error = new AnsiblePlaybookExecutionError('x', null, '', '');

    expect(AnsibleMapper.toFailureResult(error)).toMatchObject({
      exitCode: null,
      errorCode: null,
    });
  });
});
