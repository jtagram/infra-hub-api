import { describe, expect, it } from '@jest/globals';
import { AnsibleExecutionResult } from '../../../modules/ansible/ansible.dto';
import {
  OperationResult,
  OperationResultBuilder,
} from '../operation-result.dto';

const executionResult: AnsibleExecutionResult = {
  success: true,
  stdout: 'ok',
  stderr: '',
  exitCode: 0,
};

describe('OperationResultBuilder', () => {
  it('builds an OperationResult', () => {
    expect(new OperationResultBuilder().build()).toBeInstanceOf(
      OperationResult,
    );
  });

  it('sets the execution result', () => {
    const result = new OperationResultBuilder()
      .withExecutionResult(executionResult)
      .build();

    expect(result.executionResult).toBe(executionResult);
  });

  it('sets the log id', () => {
    const result = new OperationResultBuilder().withLogId('log-1').build();

    expect(result.logId).toBe('log-1');
  });

  it('chains the setters and returns the builder', () => {
    const builder = new OperationResultBuilder();

    expect(builder.withLogId('a')).toBe(builder);
    expect(builder.withExecutionResult(executionResult)).toBe(builder);
  });

  it('builds a result with both fields', () => {
    const result = new OperationResultBuilder()
      .withExecutionResult(executionResult)
      .withLogId('log-2')
      .build();

    expect(result).toEqual({ executionResult, logId: 'log-2' });
  });
});
