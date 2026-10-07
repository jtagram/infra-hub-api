import { describe, expect, it } from '@jest/globals';
import { AnsibleValidator } from '../ansible.validator';

const VALID_PLAYBOOK = `
- hosts: all
  gather_facts: false
  tasks:
    - name: ping
      ansible.builtin.ping:
`;

describe('AnsibleValidator.assertValidYamlPlaybook', () => {
  it('accepts a YAML list of plays', () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook(VALID_PLAYBOOK),
    ).not.toThrow();
  });

  it('accepts an empty list', () => {
    expect(() => AnsibleValidator.assertValidYamlPlaybook('[]')).not.toThrow();
  });

  it('accepts a JSON array (JSON is valid YAML)', () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook('[{"hosts": "all"}]'),
    ).not.toThrow();
  });

  it('does not check that the list items are real plays (only the top level shape)', () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook('- just a string'),
    ).not.toThrow();
  });

  it('rejects syntactically invalid YAML', () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook('- hosts: [all\n  tasks: }'),
    ).toThrow(/^Invalid YAML playbook: /);
  });

  it('rejects a mapping at the top level', () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook('hosts: all\ntasks: []'),
    ).toThrow('Invalid Ansible playbook: expected a YAML list of plays');
  });

  it('rejects a plain scalar', () => {
    expect(() => AnsibleValidator.assertValidYamlPlaybook('hello')).toThrow(
      'Invalid Ansible playbook: expected a YAML list of plays',
    );
  });

  it('rejects an empty document', () => {
    expect(() => AnsibleValidator.assertValidYamlPlaybook('')).toThrow(
      /^Invalid YAML playbook: /,
    );
  });

  it('rejects duplicated mapping keys', () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook('- hosts: a\n  hosts: b'),
    ).toThrow(/^Invalid YAML playbook: /);
  });

  it('rejects JavaScript specific tags (no code execution through the YAML parser)', () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook(
        '- !!js/function "function () { return 1; }"',
      ),
    ).toThrow(/^Invalid YAML playbook: /);
  });

  it('rejects multi document YAML', () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook('- a\n---\n- b'),
    ).toThrow(/^Invalid YAML playbook: /);
  });
});
