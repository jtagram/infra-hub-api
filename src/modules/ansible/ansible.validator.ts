import { load } from 'js-yaml';

export class AnsibleValidator {
  static assertValidYamlPlaybook(fileContent: string): void {
    let parsed: unknown;

    try {
      parsed = load(fileContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid YAML playbook: ${message}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error(
        'Invalid Ansible playbook: expected a YAML list of plays',
      );
    }
  }
}
