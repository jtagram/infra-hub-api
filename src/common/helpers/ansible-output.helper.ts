// Ansible's default callback renders every task result (ok, changed or
// fatal) as `_dump_results`: a pretty-printed JSON object introduced by
// `=> {`. This pulls a single string field's value back out of that block
// regardless of where in the wider ansible-playbook stdout it sits.
function extractQuotedField(text: string, key: string): string | null {
  const match = text.match(
    new RegExp(`"${key}":\\s*"((?:\\\\.|[^"\\\\])*)"`),
  );
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return null;
  }
}

// ansible.builtin.command doesn't print its own stdout to the
// ansible-playbook console on success. A playbook that needs its command's
// real output back has to register it and echo it via ansible.builtin.debug,
// which shows up as the task result's "msg" field.
export function extractAnsibleDebugMessage(stdout: string): string | null {
  return extractQuotedField(stdout, 'msg');
}

// When the command task itself fails (non-zero exit), ansible reports the
// underlying process's own stderr (or, failing that, ansible's own "msg",
// e.g. "non-zero return code") inside that same fatal task-result block —
// this is the actual reason a `kubectl`/`psql` invocation failed, distinct
// from AnsiblePlaybookExecutionError.stderr (which is ansible-playbook's own
// stderr and is typically empty; ansible prints task failures to stdout).
export function extractAnsibleFailureDetail(stdout: string): string | null {
  return extractQuotedField(stdout, 'stderr') || extractQuotedField(stdout, 'msg');
}
