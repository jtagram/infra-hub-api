import { describe, expect, it } from '@jest/globals';
import { KubernetesAction } from '../../kubernates-hub-api.playbook';

describe('KubernetesAction', () => {
  it('maps to the kubectl verbs apply, delete and create', () => {
    expect(KubernetesAction).toEqual({
      APPLY: 'apply',
      DELETE: 'delete',
      CREATE: 'create',
    });
  });
});
